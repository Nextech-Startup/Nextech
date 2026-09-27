-- Motor de conversa, parte 3: escalada de urgência (conversation-engine-v1,
-- comportamento 4).
--
-- A recepção detecta a palavra-chave de uma regra ATIVA da clínica e chama
-- esta função, antes do 200. Numa transação só, ela marca a conversa como
-- urgente, passa para a equipe e reserva o protocolo da própria clínica
-- como resposta `pending` à mensagem do paciente. O envio roda depois, no
-- after() da rota, com o telefone e a credencial lidos aqui, sob trava.
--
-- Por que na recepção e numa transação: se o envio do protocolo falhar, a
-- marca já está gravada e o alerta aparece; se a gravação falhar, a rota
-- devolve 500 e a Meta reenvia. Uma resposta da IA em curso para uma
-- mensagem anterior cai na reserva, que confere is_urgent sob trava.
--
-- A escalada vale também com a equipe atendendo (handled_by = human):
-- decisão do Jhones, 2026-09-27. A clínica confirmou a regra, e quem
-- respondeu pelo celular há uma hora pode não estar olhando agora.

create function public.escalate_urgent_conversation(
  p_clinic_id uuid,
  p_conversation_id uuid,
  -- A mensagem do paciente que casou a regra: o protocolo responde a ela.
  p_message_id uuid,
  -- O protocol_message da regra, cifrado pela aplicação.
  p_content_encrypted text,
  p_occurred_at timestamptz,
  p_within_window boolean,
  p_billable boolean,
  -- O número pelo qual a mensagem chegou. Se mudou, o protocolo não sai.
  p_phone_number_id text
)
returns table (
  message_id uuid,
  patient_phone text,
  phone_number_id text,
  access_token_encrypted text,
  -- Nulo quando reservou o protocolo. Senão, por que não: o mesmo
  -- vocabulário da reserve_ai_reply.
  motivo text
)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_paciente uuid;
  v_agente uuid;
  v_anonimizado timestamptz;
  v_telefone text;
  v_urgente boolean;
  v_ultima_do_paciente timestamptz;
  v_status public.agent_status;
  v_numero text;
  v_token text;
  v_id uuid;
begin
  select c.patient_id, c.agent_id into v_paciente, v_agente
  from public.conversations c
  where c.id = p_conversation_id and c.clinic_id = p_clinic_id;
  if v_paciente is null then
    raise exception 'Conversa inexistente nesta clínica.' using errcode = '22023';
  end if;

  -- 1. Travas: paciente, agente, conversa. A mesma ordem da reserve_ai_reply
  -- e da gravação de mensagem; a exclusão em cascata trava o agente antes
  -- das conversas. Sem ciclo de espera.
  select p.anonymized_at, p.whatsapp_phone_number into v_anonimizado, v_telefone
  from public.patients p
  where p.id = v_paciente and p.clinic_id = p_clinic_id
  for share;

  select a.status, a.whatsapp_phone_number_id, a.whatsapp_access_token_encrypted
    into v_status, v_numero, v_token
  from public.agents a
  where a.id = v_agente and a.clinic_id = p_clinic_id
  for share;

  select c.is_urgent, c.last_inbound_at into v_urgente, v_ultima_do_paciente
  from public.conversations c
  where c.id = p_conversation_id and c.clinic_id = p_clinic_id
  for update;

  perform 1
  from public.messages m
  where m.id = p_message_id
    and m.clinic_id = p_clinic_id
    and m.conversation_id = p_conversation_id
    and m.author = 'patient';
  if not found then
    raise exception 'O protocolo responde a uma mensagem do paciente da mesma conversa.'
      using errcode = '22023';
  end if;

  -- 2. Recusas que não gravam nada.
  if v_anonimizado is not null then
    return query select null::uuid, null::text, null::text, null::text, 'paciente-anonimizado';
    return;
  end if;

  -- Agente fora do ar: o Nextech não age na conversa, nem para escalar.
  if v_status is distinct from 'active' or v_numero is distinct from p_phone_number_id or v_token is null then
    return query select null::uuid, null::text, null::text, null::text, 'agente-fora-do-ar';
    return;
  end if;

  -- Já escalada: o protocolo foi mandado uma vez, e só a equipe desfaz.
  if v_urgente then
    return query select null::uuid, null::text, null::text, null::text, 'urgente';
    return;
  end if;

  -- Esta mensagem já tem resposta: é reenvio da Meta, depois de a equipe
  -- ter desfeito a urgência. Não escala de novo pelo mesmo fato.
  if exists (
    select 1 from public.messages m
    where m.reply_to_message_id = p_message_id and m.clinic_id = p_clinic_id
  ) then
    return query select null::uuid, null::text, null::text, null::text, 'ja-respondida';
    return;
  end if;

  -- 3. A escalada. O check conversations_urgente_e_humana exige as duas.
  update public.conversations c
     set is_urgent = true,
         handled_by = 'human'
   where c.id = p_conversation_id and c.clinic_id = p_clinic_id;

  -- Reenvio tardio, com a janela da Meta fechada: a marca fica (o alerta
  -- aparece), mas texto livre já não sai.
  if v_ultima_do_paciente is null or v_ultima_do_paciente <= p_occurred_at - interval '24 hours' then
    return query select null::uuid, null::text, null::text, null::text, 'fora-da-janela';
    return;
  end if;

  -- 4. A reserva do protocolo, com a trava de uma resposta por mensagem.
  insert into public.messages as m (
    clinic_id, conversation_id, direction, author, content_encrypted, media_type,
    occurred_at, delivery_status, delivery_updated_at,
    category, within_24h_window, billable, reply_to_message_id
  )
  values (
    p_clinic_id, p_conversation_id, 'outbound', 'ai', p_content_encrypted, 'text',
    p_occurred_at, 'pending', p_occurred_at,
    'SERVICE', p_within_window, p_billable, p_message_id
  )
  on conflict (reply_to_message_id) where reply_to_message_id is not null do nothing
  returning m.id into v_id;

  if v_id is null then
    return query select null::uuid, null::text, null::text, null::text, 'ja-respondida';
    return;
  end if;

  return query select v_id, v_telefone, v_numero, v_token, null::text;
end;
$$;

comment on function public.escalate_urgent_conversation(
  uuid, uuid, uuid, text, timestamptz, boolean, boolean, text
) is
  'Urgência (conversation-engine-v1, comportamento 4): marca is_urgent, passa '
  'a conversa para a equipe e reserva o protocolo da clínica como resposta '
  'pending à mensagem do paciente. Só o webhook (service_role) chama.';

-- O Supabase concede EXECUTE a anon e authenticated por padrão em função
-- nova do schema public. Esta só pode ser chamada pelo webhook.
revoke execute on function public.escalate_urgent_conversation(
  uuid, uuid, uuid, text, timestamptz, boolean, boolean, text
) from public, anon, authenticated;

grant execute on function public.escalate_urgent_conversation(
  uuid, uuid, uuid, text, timestamptz, boolean, boolean, text
) to service_role;

-- ─────────────────────────────────────────────────────────────
-- Reserva da resposta da IA: o áudio responde pelo grupo (motor de
-- conversa, parte 5b, revisão de QA, achado I2)
--
-- Sem consentimento, a transcrição do áudio só existe na execução que o
-- transcreveu. Se o paciente manda um texto logo depois ("?"), a execução
-- do texto responderia sem ela, e o modelo ignoraria o áudio. Por isso o
-- texto que chega ao servidor até 10 s depois do áudio cede a vez
-- (lib/conversations/resposta.ts, responsavelPeloGrupo), e a execução do
-- áudio responde pelos dois.
--
-- A reserva recusava qualquer mensagem do paciente mais nova que a
-- respondida. Agora recebe a mais nova que a geração viu
-- (p_seen_up_to_message_id) e só recusa o que veio depois dela: o
-- paciente que escreve durante a geração continua sendo respondido pela
-- execução da mensagem nova.
--
-- Mesmo corpo de 20260927170000, com o parâmetro novo. A assinatura muda:
-- drop, create e os grants de novo, como em 20260927160000.
-- ─────────────────────────────────────────────────────────────

drop function public.reserve_ai_reply(uuid, uuid, uuid, text, timestamptz, boolean, boolean, text);

create function public.reserve_ai_reply(
  p_clinic_id uuid,
  p_conversation_id uuid,
  p_reply_to_message_id uuid,
  p_content_encrypted text,
  p_occurred_at timestamptz,
  p_within_window boolean,
  p_billable boolean,
  -- O número pelo qual a decisão foi tomada. Se mudou, a resposta não sai.
  p_phone_number_id text,
  -- A mensagem do paciente mais nova que a geração viu (parte 5b): o áudio
  -- que responde pelo grupo responde também pelos textos que vieram depois
  -- dele. Nulo: a própria p_reply_to_message_id, como antes.
  p_seen_up_to_message_id uuid default null
)
returns table (
  message_id uuid,
  patient_phone text,
  phone_number_id text,
  access_token_encrypted text,
  -- Nulo quando reservou. Senão, por que não: o mesmo vocabulário do
  -- desfecho em lib/conversations/resposta.ts.
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
  v_handled_by public.conversation_handler;
  v_urgente boolean;
  v_marco timestamptz;
  v_ultima_do_paciente timestamptz;
  v_ref_ocorrida timestamptz;
  v_ref_criada timestamptz;
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

  -- 1. Travas: paciente, agente, conversa. O paciente antes da conversa, como
  -- na register_whatsapp_message; o agente antes da conversa, como na
  -- exclusão em cascata (agente, depois conversas). Sem ciclo de espera.
  select p.anonymized_at, p.whatsapp_phone_number into v_anonimizado, v_telefone
  from public.patients p
  where p.id = v_paciente and p.clinic_id = p_clinic_id
  for share;

  select a.status, a.whatsapp_phone_number_id, a.whatsapp_access_token_encrypted
    into v_status, v_numero, v_token
  from public.agents a
  where a.id = v_agente and a.clinic_id = p_clinic_id
  for share;

  select c.handled_by, c.is_urgent, greatest(c.human_took_over_at, c.ai_failed_at), c.last_inbound_at
    into v_handled_by, v_urgente, v_marco, v_ultima_do_paciente
  from public.conversations c
  where c.id = p_conversation_id and c.clinic_id = p_clinic_id
  for update;

  select m.occurred_at, m.created_at into v_ref_ocorrida, v_ref_criada
  from public.messages m
  where m.id = p_reply_to_message_id
    and m.clinic_id = p_clinic_id
    and m.conversation_id = p_conversation_id
    and m.author = 'patient';
  if not found then
    raise exception 'A resposta da IA responde a uma mensagem do paciente da mesma conversa.'
      using errcode = '22023';
  end if;

  if p_seen_up_to_message_id is not null then
    select m.occurred_at, m.created_at into v_ref_ocorrida, v_ref_criada
    from public.messages m
    where m.id = p_seen_up_to_message_id
      and m.clinic_id = p_clinic_id
      and m.conversation_id = p_conversation_id
      and m.author = 'patient'
      and (m.occurred_at, m.created_at) >= (v_ref_ocorrida, v_ref_criada);
    if not found then
      raise exception 'A última mensagem vista é do paciente, da mesma conversa, e não anterior à respondida.'
        using errcode = '22023';
    end if;
  end if;

  -- 2. Revalidação. Cada recusa devolve o motivo e não grava nada.
  if v_anonimizado is not null then
    return query select null::uuid, null::text, null::text, null::text, 'paciente-anonimizado';
    return;
  end if;

  if v_status is distinct from 'active' or v_numero is distinct from p_phone_number_id or v_token is null then
    return query select null::uuid, null::text, null::text, null::text, 'agente-fora-do-ar';
    return;
  end if;

  if v_urgente then
    return query select null::uuid, null::text, null::text, null::text, 'urgente';
    return;
  end if;

  if v_ultima_do_paciente is null or v_ultima_do_paciente <= p_occurred_at - interval '24 hours' then
    return query select null::uuid, null::text, null::text, null::text, 'fora-da-janela';
    return;
  end if;

  -- O paciente escreveu de novo durante a geração (depois da última que a
  -- geração viu): a mais nova responde.
  if exists (
    select 1 from public.messages m
    where m.conversation_id = p_conversation_id
      and m.clinic_id = p_clinic_id
      and m.author = 'patient'
      and (m.occurred_at, m.created_at) > (v_ref_ocorrida, v_ref_criada)
  ) then
    return query select null::uuid, null::text, null::text, null::text, 'agrupada';
    return;
  end if;

  -- Com a equipe: só retoma 24h depois do marco mais recente (resposta
  -- humana ou falha). Um eco que chegou durante a geração renovou o marco.
  if v_handled_by = 'human' then
    if v_marco is null or v_marco > p_occurred_at - interval '24 hours' then
      return query select null::uuid, null::text, null::text, null::text, 'humano-atendendo';
      return;
    end if;
    update public.conversations c
       set handled_by = 'ai'
     where c.id = p_conversation_id and c.clinic_id = p_clinic_id;
  end if;

  -- 3. A reserva, com a trava de uma resposta por mensagem do paciente.
  insert into public.messages as m (
    clinic_id, conversation_id, direction, author, content_encrypted, media_type,
    occurred_at, delivery_status, delivery_updated_at,
    category, within_24h_window, billable, reply_to_message_id
  )
  values (
    p_clinic_id, p_conversation_id, 'outbound', 'ai', p_content_encrypted, 'text',
    p_occurred_at, 'pending', p_occurred_at,
    'SERVICE', p_within_window, p_billable, p_reply_to_message_id
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

revoke execute on function public.reserve_ai_reply(uuid, uuid, uuid, text, timestamptz, boolean, boolean, text, uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_ai_reply(uuid, uuid, uuid, text, timestamptz, boolean, boolean, text, uuid)
  to service_role;

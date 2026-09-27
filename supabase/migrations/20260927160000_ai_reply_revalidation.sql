-- Motor de conversa, parte 2: a reserva da resposta revalida tudo sob trava.
--
-- Referências:
--   docs/superpowers/plans/2026-09-27-motor-de-conversa-parte-2.md (tarefa 9b)
--   20260927150000_ai_replies.sql (a reserva anterior)
--   20260927140000_patient_anonymization.sql (a mesma corrida na recepção)
--
-- Achados da revisão de segurança da parte 2. A decisão de responder era
-- tomada uma vez, antes de até ~65 s de modelo, e a reserva só conferia que
-- a mensagem era do paciente. No meio da geração podiam acontecer, e eram
-- ignorados:
--   - o owner anonimizar o paciente (B1): a resposta gravava conteúdo de
--     quem pediu exclusão e ia para o telefone já apagado;
--   - a equipe responder pelo app (B2): a IA respondia por cima;
--   - o paciente mandar outra mensagem (B2): saíam duas respostas;
--   - o agente ser pausado ou o número trocado (B2): a resposta saía pela
--     credencial antiga;
--   - um eco chegar entre a decisão e a retomada (B2): a retomada o
--     atropelava.
--
-- Agora a reserva revalida tudo numa transação, com o paciente em
-- `for share` e a conversa em `for update`, na mesma ordem de trava da
-- register_whatsapp_message (paciente, depois conversa): sem ciclo de
-- espera. A retomada em 24h também acontece aqui, e não mais antes da
-- geração. A regra é a mesma de lib/conversations/decisao.ts, que continua
-- decidindo se vale gastar a chamada ao modelo; esta é a palavra final.
--
-- A reserva devolve o telefone do paciente e a credencial do agente lidos
-- sob a trava: o envio usa estes, e não os lidos antes da geração.

drop function public.reserve_ai_reply(uuid, uuid, uuid, text, timestamptz, boolean, boolean);

create function public.reserve_ai_reply(
  p_clinic_id uuid,
  p_conversation_id uuid,
  p_reply_to_message_id uuid,
  p_content_encrypted text,
  p_occurred_at timestamptz,
  p_within_window boolean,
  p_billable boolean,
  -- O número pelo qual a decisão foi tomada. Se mudou, a resposta não sai.
  p_phone_number_id text
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

  -- 1. Travas, na ordem da register_whatsapp_message.
  select p.anonymized_at, p.whatsapp_phone_number into v_anonimizado, v_telefone
  from public.patients p
  where p.id = v_paciente and p.clinic_id = p_clinic_id
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

  -- 2. Revalidação. Cada recusa devolve o motivo e não grava nada.
  if v_anonimizado is not null then
    return query select null::uuid, null::text, null::text, null::text, 'paciente-anonimizado';
    return;
  end if;

  select a.status, a.whatsapp_phone_number_id, a.whatsapp_access_token_encrypted
    into v_status, v_numero, v_token
  from public.agents a
  where a.id = v_agente and a.clinic_id = p_clinic_id
  for share;
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

  -- O paciente escreveu de novo durante a geração: a mais nova responde.
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

comment on function public.reserve_ai_reply(uuid, uuid, uuid, text, timestamptz, boolean, boolean, text) is
  'Revalida sob trava (paciente anonimizado, agente e número, urgência, janela, '
  'mensagem mais nova, equipe atendendo e retomada em 24h) e grava a resposta '
  'da IA como pending. Devolve o telefone e a credencial para o envio, ou o '
  'motivo da recusa. Só o webhook (service_role) chama.';

revoke execute on function public.reserve_ai_reply(uuid, uuid, uuid, text, timestamptz, boolean, boolean, text)
  from public, anon, authenticated;
grant execute on function public.reserve_ai_reply(uuid, uuid, uuid, text, timestamptz, boolean, boolean, text)
  to service_role;

-- ─────────────────────────────────────────────────────────────
-- Confirmação: o filtro de clínica também na sessão
-- ─────────────────────────────────────────────────────────────
-- A FK composta já garante a clínica; o filtro repete a regra por defesa
-- em profundidade (revisão de segurança da parte 2, N6). `create or
-- replace` mantém os grants.
create or replace function public.confirm_ai_reply(
  p_clinic_id uuid,
  p_message_id uuid,
  p_wa_message_id text,
  p_sent_at timestamptz
)
returns table (ai_response_count integer, session_closed boolean)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_conversa uuid;
  v_sessao uuid;
  v_contagem integer;
begin
  if p_wa_message_id is null or length(trim(p_wa_message_id)) = 0 then
    raise exception 'A confirmação precisa do id da Meta.' using errcode = '22023';
  end if;

  update public.messages m
     set wa_message_id = p_wa_message_id,
         delivery_status = 'sent',
         delivery_updated_at = p_sent_at,
         -- A ordem da conversa segue o envio, e não a reserva.
         occurred_at = p_sent_at
   where m.id = p_message_id
     and m.clinic_id = p_clinic_id
     and m.author = 'ai'
     and m.delivery_status = 'pending'
  returning m.conversation_id into v_conversa;

  if v_conversa is null then
    return;
  end if;

  update public.conversations c
     set last_message_at = greatest(c.last_message_at, p_sent_at)
   where c.id = v_conversa and c.clinic_id = p_clinic_id;

  select s.id into v_sessao
  from public.attendance_sessions s
  where s.conversation_id = v_conversa and s.clinic_id = p_clinic_id and s.status = 'open'
  for update;

  if v_sessao is null then
    return query select null::integer, false;
    return;
  end if;

  -- A quinta resposta fecha a sessão e conta um atendimento (regra 2).
  update public.attendance_sessions s
     set ai_response_count = s.ai_response_count + 1,
         last_message_at = greatest(s.last_message_at, p_sent_at),
         status = case
           when s.ai_response_count + 1 >= 5 then 'closed_by_count'::public.attendance_session_status
           else s.status
         end,
         closed_at = case when s.ai_response_count + 1 >= 5 then p_sent_at else s.closed_at end
   where s.id = v_sessao
  returning s.ai_response_count into v_contagem;

  return query select v_contagem, v_contagem >= 5;
end;
$$;


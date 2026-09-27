-- Motor de conversa, parte 3: a confirmação não conta em sessão vencida.
--
-- Conferência da revisão de segurança sobre 20260927210000 (folga de 1 h no
-- cron). A confirm_ai_reply somava a resposta e estendia last_message_at de
-- qualquer sessão `open`, sem conferir se ela já tinha vencido. Com a
-- folga, uma sessão vencida fica aberta até ~1h20, e a resposta a uma
-- mensagem atrasada a "reabria": um atendimento a menos, fechamento por
-- contagem no lugar do timeout e closed_at deslocado (que pode mudar o mês).
--
-- Agora a confirmação aplica a regra da recepção (register_whatsapp_message):
-- a sessão parada há mais de 20 min no instante do envio fecha no instante
-- em que venceu (closed_by_timeout, last_message_at + 20 min), e a resposta
-- não conta nela, como quando não há sessão aberta.
--
-- Mesma assinatura e mesmo corpo no resto; `create or replace` mantém os
-- grants.

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
  v_ultima timestamptz;
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

  select s.id, s.last_message_at into v_sessao, v_ultima
  from public.attendance_sessions s
  where s.conversation_id = v_conversa and s.clinic_id = p_clinic_id and s.status = 'open'
  for update;

  if v_sessao is null then
    return query select null::integer, false;
    return;
  end if;

  -- Sessão vencida que o cron ainda não fechou (ele tem 1 h de folga): fecha
  -- no instante em que venceu, como a recepção, e a resposta não conta nela.
  if v_ultima < p_sent_at - interval '20 minutes' then
    update public.attendance_sessions s
       set status = 'closed_by_timeout',
           closed_at = v_ultima + interval '20 minutes'
     where s.id = v_sessao;
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

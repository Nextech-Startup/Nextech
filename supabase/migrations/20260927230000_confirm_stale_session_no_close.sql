-- Motor de conversa, parte 3: a confirmação não fecha a sessão vencida.
--
-- Conferência de segurança sobre 20260927220000. Fechar a sessão na
-- confirmação trazia de volta o O9, que a folga de 1 h do cron resolve: a
-- confirmação julga o vencimento pelo relógio do envio, e a recepção, pelo
-- occurred_at da mensagem. Com a Meta reenviando um lote atrasado, a
-- mensagem que ocorreu às 15:10 e chegou depois da confirmação das 15:50
-- achava a sessão fechada às 15:20 e abria outra: um atendimento a mais
-- cobrado da clínica.
--
-- Agora a confirmação só não conta a resposta na sessão vencida, sem mexer
-- nela. Quem fecha é a recepção, pelo occurred_at, ou o cron depois de
-- 1h20, e os dois gravam o mesmo closed_at (last_message_at + 20 min).
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

  -- Sem sessão aberta, ou com a sessão vencida que ninguém fechou ainda: a
  -- resposta não conta, e a sessão fica como está. Uma mensagem atrasada do
  -- paciente, anterior ao vencimento, ainda cai nela.
  if v_sessao is null or v_ultima < p_sent_at - interval '20 minutes' then
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

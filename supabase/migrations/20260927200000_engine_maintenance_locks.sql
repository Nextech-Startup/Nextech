-- Motor de conversa, parte 3: travas da manutenção do pg_cron.
--
-- Revisão de segurança sobre 20260927190000 (observações O1 e O3):
--
-- O1. A varredura travava as mensagens órfãs e depois as conversas. A
-- exclusão em cascata (agente ou clínica apagados pelo admin) trava a
-- conversa e depois apaga as mensagens dela: ordem inversa, e o Postgres
-- abortaria uma das duas (40P01). Agora a varredura trava as conversas
-- primeiro, e as duas funções usam `skip locked`: nunca esperam linha de
-- outra transação, então não entram em ciclo de espera. O que ficou
-- travado entra no próximo tique.
--
-- O3. Os 5 minutos só são seguros para a resposta que nasce na rota do
-- webhook (maxDuration = 120 s): a da IA e o protocolo de urgência, que
-- sempre respondem a uma mensagem do paciente. Um envio futuro com outra
-- duração (sequências, em lote) não pode cair nesta varredura.
--
-- Mesmas assinaturas; `create or replace` mantém os grants e os jobs.

create or replace function public.close_stale_attendance_sessions()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total integer;
begin
  -- closed_at é o instante em que a sessão venceu, e não a hora do cron: a
  -- mesma fórmula da register_whatsapp_message. A sessão que a recepção
  -- está estendendo agora fica para o próximo tique (skip locked).
  update public.attendance_sessions s
     set status = 'closed_by_timeout',
         closed_at = s.last_message_at + interval '20 minutes'
   where s.id in (
     select v.id
     from public.attendance_sessions v
     where v.status = 'open'
       and v.last_message_at < now() - interval '20 minutes'
     for update skip locked
   );

  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

create or replace function public.sweep_stale_ai_replies()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_conversas uuid[];
  v_total integer;
begin
  -- 1. As conversas com resposta órfã, travadas antes das mensagens: a
  -- ordem da exclusão em cascata.
  select coalesce(array_agg(c.id), '{}') into v_conversas
  from (
    select c.id
    from public.conversations c
    where (c.id, c.clinic_id) in (
      select m.conversation_id, m.clinic_id
      from public.messages m
      where m.delivery_status = 'pending'
        and m.author = 'ai'
        and m.reply_to_message_id is not null
        and m.created_at < now() - interval '5 minutes'
    )
    for update skip locked
  ) c;

  -- 2. As órfãs dessas conversas viram failed, e a conversa passa para a
  -- equipe, como na fail_ai_reply. Cinco minutos é seguro: a rota tem
  -- maxDuration = 120 s. Não dá para saber se a Meta entregou; o alerta faz
  -- alguém olhar.
  with orfas as (
    select m.id
    from public.messages m
    where m.conversation_id = any (v_conversas)
      and m.delivery_status = 'pending'
      and m.author = 'ai'
      and m.reply_to_message_id is not null
      and m.created_at < now() - interval '5 minutes'
    for update skip locked
  ),
  falhas as (
    update public.messages m
       set delivery_status = 'failed',
           delivery_error_code = 'sem-confirmacao',
           delivery_updated_at = now()
      from orfas o
     where m.id = o.id
    returning m.clinic_id, m.conversation_id
  ),
  equipe as (
    update public.conversations c
       set handled_by = 'human',
           ai_failed_at = now()
      from (select distinct f.clinic_id, f.conversation_id from falhas f) f
     where c.id = f.conversation_id
       and c.clinic_id = f.clinic_id
    returning c.id
  )
  select count(*) into v_total from falhas;

  return v_total;
end;
$$;

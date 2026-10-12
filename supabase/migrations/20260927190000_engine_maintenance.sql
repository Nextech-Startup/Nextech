-- Motor de conversa, parte 3: manutenção agendada pelo pg_cron.
--
-- Dois jobs que só mexem no banco, a cada 5 minutos:
--   1. fechar a sessão de atendimento parada há mais de 20 min
--      (atendimento-billing-v1, regra 3);
--   2. varrer a resposta da IA que ficou `pending`: o processo morreu entre
--      a reserva e o envio, ou a confirmação falhou depois do envio.
--
-- Por que pg_cron, e não Vercel Cron: na Vercel Hobby o cron roda uma vez
-- por dia, e os dois jobs são SQL puro (decisão do Jhones, 2026-09-27).
-- Regra desde então: job que só mexe no banco vai para o pg_cron, nesta
-- pasta; job que precisa da aplicação fica em app/api/cron/* (no Hobby,
-- disparado por pg_cron com pg_net).

create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- ─────────────────────────────────────────────────────────────
-- 1. Fechamento por timeout
-- ─────────────────────────────────────────────────────────────

create function public.close_stale_attendance_sessions()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total integer;
begin
  -- closed_at é o instante em que a sessão venceu, e não a hora do cron: a
  -- mesma fórmula da register_whatsapp_message. Assim, a frequência do
  -- job não muda a contagem do mês.
  --
  -- Corrida com a recepção: as duas travam a linha da sessão. Quem chega
  -- depois reavalia a linha e não acha nada a fazer (a sessão já fechou,
  -- ou a mensagem nova a estendeu e ela não está mais vencida).
  update public.attendance_sessions s
     set status = 'closed_by_timeout',
         closed_at = s.last_message_at + interval '20 minutes'
   where s.status = 'open'
     and s.last_message_at < now() - interval '20 minutes';

  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

comment on function public.close_stale_attendance_sessions() is
  'Fecha (closed_by_timeout) toda sessão aberta sem mensagem há mais de 20 '
  'min, com closed_at = última mensagem + 20 min. Todas as clínicas: cada '
  'linha mantém o próprio clinic_id. Roda pelo pg_cron.';

-- A varredura só olha sessão aberta: índice parcial, pequeno.
create index attendance_sessions_open_last_message_idx
  on public.attendance_sessions (last_message_at)
  where status = 'open';

-- ─────────────────────────────────────────────────────────────
-- 2. Respostas órfãs
-- ─────────────────────────────────────────────────────────────

create function public.sweep_stale_ai_replies()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total integer;
begin
  -- Cinco minutos é seguro: a rota tem maxDuration = 120 s, então nenhum
  -- processo vivo ainda vai enviar ou confirmar essa resposta. Não dá para
  -- saber se a Meta entregou; passar para a equipe faz alguém olhar.
  -- `skip locked`: nunca espera nem disputa linha com quem a está usando.
  with orfas as (
    select m.id
    from public.messages m
    where m.delivery_status = 'pending'
      and m.author = 'ai'
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
  -- Como a fail_ai_reply: a conversa passa para a equipe, com o marco do
  -- alerta e da retomada em 24h.
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

comment on function public.sweep_stale_ai_replies() is
  'Resposta da IA pending há mais de 5 min vira failed (sem-confirmacao), e '
  'a conversa passa para a equipe com ai_failed_at. Todas as clínicas. '
  'Roda pelo pg_cron.';

-- Só respostas da IA ficam pending, e por pouco tempo: índice minúsculo.
create index messages_pending_created_idx
  on public.messages (created_at)
  where delivery_status = 'pending';

-- ─────────────────────────────────────────────────────────────
-- Permissões e agendamento
-- ─────────────────────────────────────────────────────────────

-- O Supabase concede EXECUTE a anon e authenticated por padrão em função
-- nova do schema public. O postgres (dono) roda o cron; o service_role,
-- os testes.
revoke execute on function public.close_stale_attendance_sessions() from public, anon, authenticated;
revoke execute on function public.sweep_stale_ai_replies() from public, anon, authenticated;
grant execute on function public.close_stale_attendance_sessions() to service_role;
grant execute on function public.sweep_stale_ai_replies() to service_role;

-- cron.schedule por nome atualiza o job existente: reaplicar não duplica.
select cron.schedule(
  'nextech-fechar-sessoes-vencidas',
  '*/5 * * * *',
  $$select public.close_stale_attendance_sessions()$$
);

select cron.schedule(
  'nextech-varrer-respostas-orfas',
  '*/5 * * * *',
  $$select public.sweep_stale_ai_replies()$$
);

-- O histórico de execuções cresce ~600 linhas por dia com os dois jobs.
select cron.schedule(
  'nextech-limpar-historico-do-cron',
  '0 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$
);

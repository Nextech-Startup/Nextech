-- Motor de conversa, parte 3: folga de 1 hora no fechamento por timeout.
--
-- Observação O9 da revisão de segurança, decidida pelo Jhones em
-- 2026-09-27. O cron fechava a sessão 20 min depois da última mensagem,
-- pelo relógio real. Uma mensagem atrasada (o reenvio da Meta depois de um
-- 500) que tivesse ocorrido dentro desses 20 min encontrava a sessão já
-- fechada e abria outra: um atendimento a mais na conta da clínica.
--
-- Agora o cron só fecha a sessão parada há mais de 1h20. O closed_at
-- continua sendo a última mensagem + 20 min, então a contagem do mês não
-- muda; a mensagem atrasada em até 1 h estende a sessão certa. A recepção
-- segue fechando a vencida na hora em que o paciente volta a escrever.
--
-- Mesma assinatura; `create or replace` mantém os grants e o job.

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
       -- 20 min de sessão mais 1 h de folga para mensagem atrasada.
       and v.last_message_at < now() - interval '1 hour 20 minutes'
     for update skip locked
   );

  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

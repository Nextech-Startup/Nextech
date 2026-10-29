-- ─────────────────────────────────────────────────────────────
-- Teto do teste de conversa do agente (agent-config-v1, preview; motor
-- de conversa, parte 5)
--
-- O teste roda a IA de verdade sem salvar a conversa: o histórico fica
-- no navegador. O limite de turnos da tela, sozinho, se contorna com
-- "Recomeçar", e cada rodada é uma chamada paga ao modelo. O teto por
-- clínica mora aqui: uma linha por chamada, só com a clínica e a hora —
-- nem o que foi digitado, nem a resposta.
--
-- Só o service_role lê e escreve (RLS ligada, sem policy).
-- ─────────────────────────────────────────────────────────────

create table public.agent_preview_calls (
  id bigint generated always as identity primary key,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index agent_preview_calls_clinic_idx on public.agent_preview_calls (clinic_id, created_at desc);

alter table public.agent_preview_calls enable row level security;
revoke all on public.agent_preview_calls from anon, authenticated;

comment on table public.agent_preview_calls is
  'Chamadas do teste de conversa do agente, por clínica (teto de custo). Sem conteúdo. Só service_role.';

-- Registra a chamada e devolve quantas houve na janela, numa ida só. Apaga
-- o que passou de um dia da mesma clínica.
create or replace function public.register_agent_preview_call(p_clinic uuid, p_janela interval)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total integer;
begin
  delete from public.agent_preview_calls
   where clinic_id = p_clinic and created_at < now() - interval '1 day';

  insert into public.agent_preview_calls (clinic_id) values (p_clinic);

  select count(*) into v_total
    from public.agent_preview_calls
   where clinic_id = p_clinic and created_at > now() - p_janela;

  return v_total;
end;
$$;

revoke execute on function public.register_agent_preview_call(uuid, interval) from public, anon, authenticated;
grant execute on function public.register_agent_preview_call(uuid, interval) to service_role;

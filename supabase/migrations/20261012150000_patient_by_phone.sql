-- A busca de paciente por telefone, por POST.
--
-- A identificação do paciente (a cada mensagem recebida, pela Meta e pela
-- Evolution), a busca da tela e o eco do canal de demonstração filtravam
-- por telefone com um GET do PostgREST: o número ia na URL
-- (?whatsapp_phone_number=eq.+55...), e a URL fica no log de API do
-- Supabase (lgpd-security, regra 1; achado da revisão de segurança de
-- 2026-10-11). Por esta função, o número vai no corpo do POST, como na
-- busca da tela de Conversas (search_conversations).
--
-- security invoker: com a sessão, a RLS de patients vale; com o
-- service_role (webhook), o filtro de clínica explícito é a barreira.
-- Só cria função nova: nenhuma tabela nem grant existente muda.

create function public.patient_by_phone(p_clinic_id uuid, p_phone text)
returns setof public.patients
language sql
stable
security invoker
set search_path = ''
as $$
  select p.*
    from public.patients p
   where p.clinic_id = p_clinic_id
     and p.whatsapp_phone_number = p_phone   -- PII: chega no corpo do POST
   limit 1
$$;

comment on function public.patient_by_phone(uuid, text) is
  'O paciente da clínica com este telefone (E.164), por POST: o número '
  'nunca vai na URL do PostgREST, que cai no log. security invoker: a RLS '
  'de patients vale para a sessão; para o service_role, o filtro de '
  'clínica é a barreira.';

revoke execute on function public.patient_by_phone(uuid, text) from public, anon;
grant execute on function public.patient_by_phone(uuid, text) to authenticated, service_role;

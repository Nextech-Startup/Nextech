-- Motor de conversa, parte 4: a busca da fila de Conversas por POST
-- (decisão do Jhones, 2026-10-11, sobre achado da revisão de segurança).
--
-- Antes, a busca ia na URL da tela (?q=) e num GET do PostgREST
-- (patients?name=ilike.*Maria*): o nome ou o telefone do paciente caía no
-- log do Supabase e da Vercel e no histórico do navegador da clínica
-- (lgpd-security, regra 1). O supabase.rpc manda os argumentos no corpo do
-- POST, que não vai para o log; a tela guarda o termo só no estado.
--
-- Os padrões chegam prontos de lib/conversations/busca.ts (padraoDeBusca),
-- com % e _ escapados. security invoker: a RLS de conversations e de
-- patients vale para quem chama, além do filtro de clínica.

create function public.search_conversations(p_clinic_id uuid, p_nome text, p_telefone text)
returns setof uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id
    from public.conversations c
    join public.patients p
      on p.id = c.patient_id
     and p.clinic_id = c.clinic_id
   where c.clinic_id = p_clinic_id
     and (
       (p_nome is not null and p.name ilike p_nome)
       or (p_telefone is not null and p.whatsapp_phone_number like p_telefone)
     )
   order by c.last_message_at desc
   limit 100
$$;

comment on function public.search_conversations(uuid, text, text) is
  'Busca da fila de Conversas por nome ou telefone do paciente, por POST: o '
  'termo nunca vai para URL nem log. security invoker: a RLS vale.';

revoke execute on function public.search_conversations(uuid, text, text) from public, anon, service_role;
grant execute on function public.search_conversations(uuid, text, text) to authenticated;

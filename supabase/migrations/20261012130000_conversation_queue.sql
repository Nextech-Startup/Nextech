-- A fila da tela de Conversas numa ida só ao banco.
--
-- Antes, a fila eram duas idas em série: as conversas (as recentes e as
-- urgentes, em paralelo, com agente, paciente e convênio pelo PostgREST) e,
-- com os ids delas, a prévia de cada uma (conversation_previews). Com o
-- Supabase em us-west-2, cada ida custa ~300 ms rodando do Brasil; esta
-- função devolve tudo de uma vez.
--
-- Mesmo contrato da conversation_previews (20261011150000): security
-- invoker (a RLS de conversations, agents, patients, insurances e messages
-- vale), filtro explícito de clínica em toda tabela, e execução só para o
-- membro logado. O conteúdo da prévia continua cifrado: quem decifra é a
-- aplicação.
--
-- Só cria função nova: nenhuma tabela nem grant existente muda.

create function public.conversation_queue(p_clinic_id uuid, p_limit integer)
returns table (
  id uuid,
  handled_by public.conversation_handler,
  is_urgent boolean,
  human_took_over_at timestamptz,
  ai_failed_at timestamptz,
  qualified_at timestamptz,
  last_inbound_at timestamptz,
  last_message_at timestamptz,
  agent_name text,
  patient_id uuid,
  patient_name text,                          -- PII
  patient_phone text,                         -- PII
  patient_consent_given_at timestamptz,
  patient_opted_out boolean,
  patient_created_at timestamptz,
  insurance_name text,
  preview_author public.message_author,
  preview_media_type public.message_media_type,
  preview_content_encrypted text,             -- PII (cifrado)
  preview_content_redacted_at timestamptz,
  preview_occurred_at timestamptz,
  preview_delivery_status public.message_delivery_status
)
language sql
stable
security invoker
set search_path = ''
as $$
  -- As p_limit mais recentes e todas as urgentes: nenhuma urgente fica de
  -- fora por ser antiga. O union tira a repetida.
  with ids as (
    (select c.id
       from public.conversations c
      where c.clinic_id = p_clinic_id
      order by c.last_message_at desc
      limit p_limit)
    union
    (select c.id
       from public.conversations c
      where c.clinic_id = p_clinic_id
        and c.is_urgent)
  )
  select c.id, c.handled_by, c.is_urgent, c.human_took_over_at, c.ai_failed_at, c.qualified_at,
         c.last_inbound_at, c.last_message_at,
         a.name,
         p.id, p.name, p.whatsapp_phone_number, p.consent_given_at, p.opted_out, p.created_at,
         i.name,
         m.author, m.media_type, m.content_encrypted, m.content_redacted_at, m.occurred_at, m.delivery_status
    from ids
    join public.conversations c on c.id = ids.id and c.clinic_id = p_clinic_id
    -- Agente e paciente são FK da conversa: sem um deles, a linha está fora
    -- do que o banco garante, e não aparece (como antes, na aplicação).
    join public.agents a on a.id = c.agent_id and a.clinic_id = p_clinic_id
    join public.patients p on p.id = c.patient_id and p.clinic_id = p_clinic_id
    left join public.insurances i on i.id = p.insurance_id and i.clinic_id = p_clinic_id
    -- A prévia: a última mensagem visível. A resposta da IA que não chegou
    -- ao paciente não conta.
    left join lateral (
      select m.author, m.media_type, m.content_encrypted, m.content_redacted_at, m.occurred_at, m.delivery_status
        from public.messages m
       where m.clinic_id = p_clinic_id
         and m.conversation_id = c.id
         and not (m.author = 'ai' and m.delivery_status = 'failed')
       order by m.occurred_at desc, m.created_at desc
       limit 1
    ) m on true
$$;

comment on function public.conversation_queue(uuid, integer) is
  'A fila da tela de Conversas numa ida só: as p_limit conversas mais '
  'recentes e todas as urgentes, com agente, paciente, convênio e a prévia '
  'cifrada. security invoker: a RLS das tabelas vale, e o filtro de clínica '
  'também. Nome, telefone e prévia são PII: nunca logar.';

revoke execute on function public.conversation_queue(uuid, integer) from public, anon, service_role;
grant execute on function public.conversation_queue(uuid, integer) to authenticated;

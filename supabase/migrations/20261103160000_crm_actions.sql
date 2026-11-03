-- CRM próprio, parte 2 (spec crm-v1, seções 3 e 4): o que a equipe faz.
--
-- - move_opportunity: a mudança manual de etapa, de linha única, sobre a
--   etapa que a tela viu, com o evento na mesma transação;
-- - update_opportunity_details: procedimento, valor, responsável, próxima
--   ação e nota (que chega já cifrada pela lib);
-- - search_opportunities: a busca por POST (o termo nunca vai para URL);
-- - crm_team: quem pode ser responsável (owner e staff), com o e-mail;
-- - anonymize_patient passa a apagar a nota (spec, "Exclusão LGPD").
--
-- As duas escritas conferem papel e plano no banco, além da lib: server
-- action é endpoint público, e a RPC também é (PostgREST).

set lock_timeout = '5s';

-- ─────────────────────────────────────────────────────────────
-- Mover
-- ─────────────────────────────────────────────────────────────
create function public.move_opportunity(
  p_opportunity_id uuid,
  p_from public.opportunity_stage,
  p_to public.opportunity_stage,
  p_procedure_id uuid default null,
  p_value_cents integer default null,
  p_lost_reason public.opportunity_lost_reason default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinica uuid;
  v_mudou uuid;
begin
  select o.clinic_id into v_clinica
    from public.opportunities o
   where o.id = p_opportunity_id;
  if v_clinica is null
     or not private.can_operate_crm(v_clinica)
     or not private.clinic_has_crm(v_clinica) then
    return 'nao-encontrada';
  end if;

  -- Etapa nula não é pedido válido (viraria 23502 e o PostgREST repete a linha).
  if p_from is null or p_to is null then
    return 'invalido';
  end if;
  if p_from = p_to then
    return 'sem-mudanca';
  end if;

  if p_to = 'ganho' and (
       p_procedure_id is null
       or p_value_cents is null
       or p_value_cents <= 0
       or p_value_cents > 100000000
       or not exists (
         select 1 from public.procedures pr
          where pr.id = p_procedure_id and pr.clinic_id = v_clinica
       )
     ) then
    return 'invalido';
  end if;
  if p_to = 'perdido' and p_lost_reason is null then
    return 'invalido';
  end if;

  -- Linha única, sobre a etapa que a tela viu. Encerrada não volta.
  update public.opportunities o
     set stage = p_to,
         stage_changed_at = now(),
         last_activity_at = now(),
         closed_at = case when p_to in ('ganho', 'perdido') then now() else null end,
         procedure_id = case when p_to = 'ganho' then p_procedure_id else o.procedure_id end,
         value_cents = case when p_to = 'ganho' then p_value_cents else o.value_cents end,
         lost_reason = case when p_to = 'perdido' then p_lost_reason else null end
   where o.id = p_opportunity_id
     and o.stage = p_from
     and o.closed_at is null
  returning o.id into v_mudou;
  if v_mudou is null then
    return 'sem-mudanca';
  end if;

  -- VALUES, e não INSERT ... SELECT de auth.users: sem o usuário, o NOT
  -- NULL implícito do autor falha e desfaz tudo (lição de 20261011150000).
  insert into public.opportunity_events (clinic_id, opportunity_id, from_stage, to_stage, actor_user_id, actor_email)
  values (
    v_clinica,
    p_opportunity_id,
    p_from,
    p_to,
    (select auth.uid()),
    (select u.email from auth.users u where u.id = (select auth.uid()))
  );
  return 'ok';
end;
$$;

comment on function public.move_opportunity(uuid, public.opportunity_stage, public.opportunity_stage, uuid, integer, public.opportunity_lost_reason) is
  'Mudança manual de etapa (crm-v1). ok, sem-mudanca (a etapa não é a que a '
  'tela viu, ou a oportunidade encerrou), nao-encontrada (outra clínica, '
  'papel ou plano) ou invalido (faltam os campos de Ganho/Perdido).';

revoke execute on function public.move_opportunity(uuid, public.opportunity_stage, public.opportunity_stage, uuid, integer, public.opportunity_lost_reason) from public, anon;
grant execute on function public.move_opportunity(uuid, public.opportunity_stage, public.opportunity_stage, uuid, integer, public.opportunity_lost_reason) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Editar os outros campos
-- ─────────────────────────────────────────────────────────────
create function public.update_opportunity_details(
  p_opportunity_id uuid,
  p_procedure_id uuid,
  p_value_cents integer,
  p_owner_user_id uuid,
  p_next_action_at timestamptz,
  p_notes_encrypted text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinica uuid;
  v_paciente uuid;
  v_etapa public.opportunity_stage;
  v_procedimento_atual uuid;
  v_anonimizado timestamptz;
begin
  -- Leitura sem trava, só para saber clínica e paciente (não mudam nunca).
  select o.clinic_id, o.patient_id into v_clinica, v_paciente
    from public.opportunities o
   where o.id = p_opportunity_id;
  if v_clinica is null
     or not private.can_operate_crm(v_clinica)
     or not private.clinic_has_crm(v_clinica) then
    return 'nao-encontrada';
  end if;

  -- Validações que não dependem da etapa.
  if p_value_cents is not null and (p_value_cents <= 0 or p_value_cents > 100000000) then
    return 'invalido';
  end if;
  if p_procedure_id is not null and not exists (
       select 1 from public.procedures pr where pr.id = p_procedure_id and pr.clinic_id = v_clinica
     ) then
    return 'invalido';
  end if;
  if p_owner_user_id is not null and not exists (
       select 1 from public.clinic_members m
        where m.clinic_id = v_clinica and m.user_id = p_owner_user_id and m.role in ('owner', 'staff')
     ) then
    return 'invalido';
  end if;
  -- Nota só cifrada (mesma expressão do check opportunities_nota_cifrada:
  -- base64 de 30 a 8029 bytes, 40 a 10708 caracteres). Devolve invalido, e
  -- não 23514, para o erro do PostgREST não repetir a nota.
  if p_notes_encrypted is not null and not (
       p_notes_encrypted ~ '^[A-Za-z0-9+/]+={0,2}$'
       and length(p_notes_encrypted) % 4 = 0
       and length(p_notes_encrypted) between 40 and 10708
     ) then
    return 'invalido';
  end if;

  -- Ordem de trava: paciente (for share) PRIMEIRO, como save_message_transcript
  -- e register_whatsapp_message; só depois a oportunidade. O anonymize_patient
  -- trava paciente (for update) e depois a oportunidade: a mesma ordem, sem ciclo.
  -- Não inverter.
  select p.anonymized_at into v_anonimizado
    from public.patients p
   where p.id = v_paciente and p.clinic_id = v_clinica
     for share;

  -- Trava a oportunidade e relê a etapa: um Ganho gravado há instantes por
  -- move_opportunity é visto aqui, e a edição não sobrescreve o que ele gravou.
  select o.stage, o.procedure_id into v_etapa, v_procedimento_atual
    from public.opportunities o
   where o.id = p_opportunity_id
     for update;
  if v_etapa is null then
    return 'nao-encontrada';
  end if;

  -- Ganho pede valor e não perde o procedimento (spec crm-v1): um formulário
  -- velho (procedimento nulo) não apaga o de um Ganho. Mas o Ganho cujo
  -- procedimento foi apagado do perfil (FK on delete set null: "o campo fica
  -- vazio, o valor fica") continua editável, com o procedimento ainda nulo.
  if v_etapa = 'ganho' and (
       p_value_cents is null
       or (p_procedure_id is null and v_procedimento_atual is not null)
     ) then
    return 'invalido';
  end if;

  update public.opportunities o
     set procedure_id = p_procedure_id,
         value_cents = p_value_cents,
         owner_user_id = p_owner_user_id,
         next_action_at = p_next_action_at,
         notes_encrypted = case when v_anonimizado is null then p_notes_encrypted else null end
   where o.id = p_opportunity_id;
  return 'ok';
end;
$$;

comment on function public.update_opportunity_details(uuid, uuid, integer, uuid, timestamptz, text) is
  'Procedimento, valor, responsável, próxima ação e nota (já cifrada pela '
  'lib, AAD da clínica). Não muda etapa nem grava evento.';

revoke execute on function public.update_opportunity_details(uuid, uuid, integer, uuid, timestamptz, text) from public, anon;
grant execute on function public.update_opportunity_details(uuid, uuid, integer, uuid, timestamptz, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Buscar (por POST)
-- ─────────────────────────────────────────────────────────────
-- Mesmo contrato de search_conversations (20261011170000): os padrões
-- chegam prontos de lib/conversations/busca.ts (padraoDeBusca). security
-- invoker: a RLS de opportunities (owner e staff) e de patients vale.
create function public.search_opportunities(p_clinic_id uuid, p_nome text, p_telefone text)
returns setof uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select o.id
    from public.opportunities o
    join public.patients p
      on p.id = o.patient_id
     and p.clinic_id = o.clinic_id
   where o.clinic_id = p_clinic_id
     and (
       (p_nome is not null and p.name ilike p_nome)
       or (p_telefone is not null and p.whatsapp_phone_number like p_telefone)
     )
   order by o.last_activity_at desc
   limit 200
$$;

revoke execute on function public.search_opportunities(uuid, text, text) from public, anon, service_role;
grant execute on function public.search_opportunities(uuid, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- A equipe do CRM
-- ─────────────────────────────────────────────────────────────
-- O painel não tem nome de membro: a tela mostra o e-mail (lib/crm/equipe.ts).
-- auth.users não é legível pela sessão; a função lê como dono e só
-- devolve algo a quem opera o CRM da clínica pedida.
create function public.crm_team(p_clinic_id uuid)
returns table (user_id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, u.email::text
    from public.clinic_members m
    join auth.users u on u.id = m.user_id
   where m.clinic_id = p_clinic_id
     and m.role in ('owner', 'staff')
     and (select private.can_operate_crm(p_clinic_id))
   order by u.email
$$;

revoke execute on function public.crm_team(uuid) from public, anon, service_role;
grant execute on function public.crm_team(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Exclusão LGPD: a nota sai junto
-- ─────────────────────────────────────────────────────────────
-- Corpo de 20261103120000_message_transcripts, com o bloco do CRM no fim.
-- Mesma assinatura: `create or replace` mantém os grants. A oportunidade
-- fica com etapa, datas e valor, para o funil histórico não mudar.
create or replace function public.anonymize_patient(p_patient_id uuid, p_phone_marker text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
  v_total integer;
begin
  if p_phone_marker is null or p_phone_marker !~ '^\+999[0-9]{11}$' then
    raise exception 'Marcador de telefone fora do formato de anonimização.'
      using errcode = '22023';
  end if;

  -- A trava serializa com a gravação de mensagem (for share em
  -- register_whatsapp_message), com a da transcrição
  -- (save_message_transcript) e com a da nota do CRM
  -- (update_opportunity_details): nada entra no meio.
  select p.clinic_id into v_clinic_id
  from public.patients p
  where p.id = p_patient_id
  for update;

  if v_clinic_id is null or not private.is_clinic_owner(v_clinic_id) then
    raise exception 'Apenas o owner da clínica do paciente atende o pedido de exclusão.'
      using errcode = '42501';
  end if;

  update public.patients p
     set whatsapp_phone_number = p_phone_marker,
         name = null,
         consent_given_at = null,
         -- Nenhuma sequência futura o alcança.
         opted_out = true,
         -- Idempotente: o segundo pedido não recarimba.
         anonymized_at = coalesce(p.anonymized_at, now())
   where p.id = p_patient_id
     and p.clinic_id = v_clinic_id;

  update public.messages m
     set content_encrypted = null,
         transcript_encrypted = null,
         content_redacted_at = now()
    from public.conversations c
   where c.id = m.conversation_id
     and c.clinic_id = v_clinic_id
     and c.patient_id = p_patient_id
     and m.clinic_id = v_clinic_id
     and m.content_redacted_at is null;

  get diagnostics v_total = row_count;

  -- CRM: a nota da oportunidade (crm-v1). Etapa, datas e valor ficam.
  update public.opportunities o
     set notes_encrypted = null,
         notes_redacted_at = now()
   where o.clinic_id = v_clinic_id
     and o.patient_id = p_patient_id
     and o.notes_redacted_at is null;

  return v_total;
end;
$$;

reset lock_timeout;

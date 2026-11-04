-- CRM próprio, endurecimento depois da revisão de segurança da parte 2
-- (spec crm-v1, "Segurança e LGPD"; docs/status.md, pendências da parte 2):
--
-- 1. update_opportunity_details ganha p_keep_notes: "não mexer na nota" é
--    decidido sob a trava da linha. Antes, a lib relia o blob e o regravava
--    em duas idas ao banco, e a nota salva por outra pessoa no meio se perdia.
-- 2. update_opportunity_details ganha p_clinic_id: a nota é cifrada com a
--    clínica da sessão (AAD), e a RPC só grava em oportunidade dessa clínica.
--    Sem isso, um usuário de duas clínicas gravaria nota ilegível na outra.
-- 3. A leitura também exige o plano: crm_clinic_ids() (RLS de opportunities
--    e opportunity_events, busca e o canal ao vivo) e crm_team passam a
--    conferir clinic_has_crm. O dado continua gravado em todo plano.
--
-- A assinatura de update_opportunity_details muda: a antiga sai (drop) e a
-- nova nasce com revoke e grant explícitos. crm_clinic_ids e crm_team mantêm
-- a assinatura e existem na última migration (20261103150000/160000), então
-- o `create or replace` preserva os grants.

set lock_timeout = '5s';

-- ─────────────────────────────────────────────────────────────
-- 3. Leitura com plano
-- ─────────────────────────────────────────────────────────────
create or replace function private.crm_clinic_ids()
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select m.clinic_id
  from public.clinic_members m
  where m.user_id = (select auth.uid())
    and m.role in ('owner', 'staff')
    and (select private.sessao_ativa())
    and private.clinic_has_crm(m.clinic_id)
$$;

create or replace function public.crm_team(p_clinic_id uuid)
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
     and (select private.clinic_has_crm(p_clinic_id))
   order by u.email
$$;

-- ─────────────────────────────────────────────────────────────
-- 1 e 2. Editar os outros campos
-- ─────────────────────────────────────────────────────────────
drop function public.update_opportunity_details(uuid, uuid, integer, uuid, timestamptz, text);

create function public.update_opportunity_details(
  p_clinic_id uuid,
  p_opportunity_id uuid,
  p_procedure_id uuid,
  p_value_cents integer,
  p_owner_user_id uuid,
  p_next_action_at timestamptz,
  p_notes_encrypted text,
  p_keep_notes boolean
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
  -- A clínica da sessão (p_clinic_id, a AAD da nota) tem de ser a da
  -- oportunidade. A resposta é a mesma de "não existe", sem distinguir.
  if v_clinica is null
     or v_clinica is distinct from p_clinic_id
     or not private.can_operate_crm(v_clinica)
     or not private.clinic_has_crm(v_clinica) then
    return 'nao-encontrada';
  end if;

  -- Validações que não dependem da etapa.
  if p_keep_notes is null then
    return 'invalido';
  end if;
  -- Manter e mandar nota ao mesmo tempo é pedido ambíguo.
  if p_keep_notes and p_notes_encrypted is not null then
    return 'invalido';
  end if;
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

  -- A nota: apagada de vez depois da exclusão LGPD; mantida sob a trava
  -- quando a equipe não mexeu nela; senão, a que chegou (ou null, apagar).
  update public.opportunities o
     set procedure_id = p_procedure_id,
         value_cents = p_value_cents,
         owner_user_id = p_owner_user_id,
         next_action_at = p_next_action_at,
         notes_encrypted = case
           when v_anonimizado is not null then null
           when p_keep_notes then o.notes_encrypted
           else p_notes_encrypted
         end
   where o.id = p_opportunity_id;
  return 'ok';
end;
$$;

comment on function public.update_opportunity_details(uuid, uuid, uuid, integer, uuid, timestamptz, text, boolean) is
  'Procedimento, valor, responsável, próxima ação e nota (já cifrada pela '
  'lib, AAD da clínica da sessão, que vem em p_clinic_id). p_keep_notes '
  'mantém a nota gravada sob a trava. Não muda etapa nem grava evento.';

revoke execute on function public.update_opportunity_details(uuid, uuid, uuid, integer, uuid, timestamptz, text, boolean) from public, anon;
grant execute on function public.update_opportunity_details(uuid, uuid, uuid, integer, uuid, timestamptz, text, boolean) to authenticated;

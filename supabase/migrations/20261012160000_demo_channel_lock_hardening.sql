-- A trava do canal de demonstração sem as duas brechas da revisão de
-- segurança de 2026-10-11 (achados baixos 1 e 2).
--
-- 1. Papel nulo. Em private.agent_block_demo (20261012120000), com
--    auth.role() nulo (conexão direta ao banco, editor SQL, pg_cron), o
--    "not (v_canal and auth.role() = 'service_role')" dava null, e o if não
--    disparava: gravava e publicava evolution:% na demonstração. A intenção
--    era "só o service_role". O coalesce fecha.
-- 2. Desmarcar a demonstração. private.clinic_block_demo_with_whatsapp só
--    olhava a ida para demonstração. Tirar o is_demo com o canal conectado
--    deixava o evolution:% numa clínica comum, o que o NX005 promete
--    impedir. Agora a volta é recusada enquanto houver canal.
--
-- Só troca o corpo das duas funções (create or replace): os gatilhos, as
-- assinaturas e os grants ficam.

create or replace function private.agent_block_demo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_demo boolean;
  -- coalesce: com o identificador nulo, o like daria null, e o "not (... and
  -- null)" lá embaixo deixaria publicar sem número na demonstração.
  v_canal boolean := coalesce(new.whatsapp_phone_number_id like 'evolution:%', false);
  -- coalesce: sem papel do PostgREST (conexão direta, pg_cron), auth.role()
  -- é nulo, e a comparação nula deixaria passar.
  v_script boolean := coalesce(auth.role(), '') = 'service_role';
begin
  if new.whatsapp_phone_number_id is null and new.status <> 'active' then
    return new;
  end if;

  select c.is_demo into v_demo from public.clinics c where c.id = new.clinic_id;

  if v_canal and not coalesce(v_demo, false) then
    raise exception
      'Canal de demonstração só existe na clínica de demonstração.'
      using errcode = 'NX005';
  end if;

  if coalesce(v_demo, false) and not (v_canal and v_script) then
    raise exception
      'A clínica de demonstração não conecta WhatsApp nem publica agente.'
      using errcode = 'NX004';
  end if;

  return new;
end;
$$;

create or replace function private.clinic_block_demo_with_whatsapp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_demo and not old.is_demo
     and exists (
       select 1 from public.agents a
       where a.clinic_id = new.id
         and (a.whatsapp_phone_number_id is not null or a.status = 'active')
     ) then
    raise exception
      'Clínica com agente conectado não vira demonstração.'
      using errcode = 'NX004';
  end if;

  -- O canal de demonstração não sobra numa clínica comum: a limpeza
  -- (scripts/canal-demo.ts limpar) vem antes de tirar a marca.
  if old.is_demo and not new.is_demo
     and exists (
       select 1 from public.agents a
       where a.clinic_id = new.id
         and a.whatsapp_phone_number_id like 'evolution:%'
     ) then
    raise exception
      'Com o canal de demonstração conectado, a clínica não deixa de ser demonstração.'
      using errcode = 'NX005';
  end if;

  return new;
end;
$$;

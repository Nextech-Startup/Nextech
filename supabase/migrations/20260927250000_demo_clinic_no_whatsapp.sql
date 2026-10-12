-- A clínica de demonstração não conecta WhatsApp nem publica agente
-- (docs/specs/demo-account-v1.md, "LGPD" e o edge case "Conta de
-- demonstração com dado real").
--
-- Achado M2 da revisão de segurança de 2026-09-27: `is_demo` só mudava a
-- tela. O dono da demonstração, cuja senha é usada diante de terceiros,
-- conseguia conectar um número pela server action ou direto no PostgREST
-- (o authenticated tem update nas colunas do WhatsApp de agents). A clínica
-- passaria a receber e guardar mensagem de paciente real atrás de um painel
-- que só mostra dado de exemplo, sem ninguém ver as urgências. Fica no
-- banco para valer em todo caminho, inclusive no service_role do painel
-- interno.
--
-- Duas pontas da mesma regra:
--   1. agente de clínica de demonstração não recebe número nem fica ativo;
--   2. clínica com agente conectado ou ativo não vira demonstração.
--
-- O trigger de agents se chama agents_block_demo para rodar antes de
-- agents_enforce_publish (a ordem é alfabética): a recusa que chega é
-- esta, e não a de publicar sem número.
--
-- Nota sobre o comentário da 20260927240000: além de (legal_name, cnpj), o
-- authenticated tem update nos campos regulatórios da 20260916230000. Nunca
-- em is_demo, e a conclusão de lá não muda.

create or replace function private.agent_block_demo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.whatsapp_phone_number_id is not null or new.status = 'active')
     and exists (
       select 1 from public.clinics c
       where c.id = new.clinic_id and c.is_demo
     ) then
    raise exception
      'A clínica de demonstração não conecta WhatsApp nem publica agente.'
      using errcode = 'NX004';
  end if;

  return new;
end;
$$;

comment on function private.agent_block_demo() is
  'Clínica de demonstração não recebe mensagem real (demo-account-v1). No '
  'banco porque o authenticated escreve direto nas colunas do WhatsApp.';

create trigger agents_block_demo
  before insert or update on public.agents
  for each row
  execute function private.agent_block_demo();

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

  return new;
end;
$$;

comment on function private.clinic_block_demo_with_whatsapp() is
  'A outra ponta de agent_block_demo: marcar is_demo não esconde atrás do '
  'dado de exemplo uma clínica que já atende pelo WhatsApp.';

create trigger clinics_block_demo_with_whatsapp
  before update of is_demo on public.clinics
  for each row
  execute function private.clinic_block_demo_with_whatsapp();

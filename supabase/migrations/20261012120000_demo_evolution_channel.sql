-- Canal de demonstração pela Evolution API (docs/specs/evolution-demo-v1.md,
-- "A trava da demonstração (NX004), numa migration nova").
--
-- Até aqui, a clínica de demonstração não recebia mensagem real por nenhum
-- caminho (20260927250000). Para a apresentação a investidor, ela passa a
-- receber pelo canal de demonstração, e só por ele:
--   1. o authenticated continua recusado (NX004) ao gravar qualquer
--      identificador e ao publicar agente na demonstração. O dono dela, cuja
--      senha é usada diante de terceiros, segue sem conectar nada;
--   2. o service_role (o script scripts/canal-demo.ts) grava, na
--      demonstração, só identificador `evolution:%`, e publica esse agente.
--      Identificador da Meta continua recusado lá, por qualquer papel;
--   3. `evolution:%` fora da demonstração é recusado por qualquer papel
--      (NX005). `whatsapp_phone_number_id` é UNIQUE global: sem esta trava,
--      outra clínica poderia tomar o identificador do canal antes do script,
--      e a recepção entregaria a ela a mensagem do investidor.
--
-- O papel vem de auth.role() (o claim do JWT): dentro de função security
-- definer, current_user é o dono da função. Só troca o corpo da função do
-- trigger agents_block_demo, que mantém o nome (roda antes de
-- agents_enforce_publish). clinic_block_demo_with_whatsapp não muda, e
-- nenhum grant muda.

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

  if coalesce(v_demo, false) and not (v_canal and auth.role() = 'service_role') then
    raise exception
      'A clínica de demonstração não conecta WhatsApp nem publica agente.'
      using errcode = 'NX004';
  end if;

  return new;
end;
$$;

comment on function private.agent_block_demo() is
  'Clínica de demonstração só recebe mensagem pelo canal de demonstração '
  '(evolution-demo-v1): identificador evolution:% gravado pelo service_role. '
  'O authenticated segue recusado (NX004), e evolution:% fora da '
  'demonstração é recusado por qualquer papel (NX005).';

---
name: nextech-fase-de-prototipo
description: "Nextech está em fase de protótipo, sem clientes reais; dado de exemplo no painel da clínica é aceitável"
metadata:
  node_type: memory
  type: project
  originSessionId: 2bc4f920-d255-4713-8281-44fccc488b1e
  modified: 2026-10-12T02:15:20.133Z
---

Em 2026-09-27 o Jhones disse: "estamos em fase de protótipo, não temos clientes". O painel em `app.nextech.ia.br` não tem clínica real usando.

Decisão dele no mesmo dia: as telas "em breve" do painel da clínica aparecem no menu com o protótipo e dado de exemplo (fixtures), para ele ver tudo navegando como cliente; depois cada uma é ligada ao backend da sua fase. Isso substitui a regra antiga "dado inventado nunca em `app/(dashboard)`".

**Implementado em 2026-09-27** (spec `docs/specs/demo-account-v1.md`): a "Clínica Demonstração Nextech" (`d09aa757-fc21-446a-8018-7586d88859e8`) tem `is_demo = true`, plano healthtech, e o `clinica@` e o `admin@` como donos. Só nela as telas abrem com fixture; nas outras, "em breve". Para demonstrar, usar o `clinica@` (sem atalho do painel interno) e nunca entregar a senha, que é de dono. A clínica de demonstração não conecta WhatsApp (trigger NX004).

**Canal de demonstração na Evolution API** (spec `docs/specs/evolution-demo-v1.md`): fora do produto, roda só localmente (app com `next start -H 127.0.0.1`, sem túnel), com números cadastrados em `EVOLUTION_ALLOWED_NUMBERS` e teto diário. A conversa real cai na própria conta de demonstração; o NX004 continua barrando o `authenticated` (só o `service_role` conecta o canal `evolution:`). Ao fim do uso: `scripts/canal-demo.ts limpar`.

**Prioridade atual (desde 2026-10-26):** desenvolvimento do produto, seguindo as specs na ordem do `docs/status.md`.

**Why:** ele quer ver o produto inteiro navegável antes de fazer funcionar; o risco de clínica real ver dado falso não existe enquanto não houver cliente.

**How to apply:** não alertar sobre "clínica real veria dado falso" enquanto não houver cliente. Quando o primeiro cliente for entrar, lembrar que as telas com fixtures precisam virar reais ou voltar a "em breve". Ver [[nextech-sistema-de-design]].

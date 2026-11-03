---
name: nextech-git-flow
description: "No Nextech, commitar sempre em staging e nunca em main — main só por PR aprovado pelo Jhones"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 14878c52-ee21-42f4-8b66-5de0186a4996
  modified: 2026-09-16T22:10:53.452Z
---

No projeto Nextech, commitar em `staging` (ou branch de spec que sai dela) sem pedir aprovação a cada commit. Nunca commitar direto em `main`. Abrir o PR e o merge exigem autorização explícita do Jhones — mas ele a dá com frequência, caso a caso, quando a entrega está verificada.

**Why:** O Jhones é engenheiro de software e revisa código, mas não implementa. O PR é o único ponto de revisão humana do fluxo. O que ele reserva para si é a *decisão*, não o clique: dito "te autorizo o merge", executar é o esperado — voltar a pedir confirmação vira atrito.

**How to apply:** Ao concluir uma spec, commitar em `staging`, rodar as verificações e avisar. Abrir PR e mergear só depois de ele autorizar; a autorização vale para aquela entrega, não para as seguintes. Quando já houver PR aberto não aprovado, perguntar se o novo trabalho entra nele ou vai para um PR próprio — em 2026-09-16 ele preferiu somar ao PR existente. Relacionado: [[nextech-testing-bar]], [[nextech-session-rhythm]].

**PR pelo `gh` (2026-10-29):** se a conta ativa do `gh` não for colaboradora de `Nextech-Startup/Nextech` , o `gh pr create` falha com "must be a collaborator". A colaboradora é `JhonB-DEVLP`. Usar só no comando, sem trocar a conta ativa: `GH_TOKEN=$(gh auth token --user JhonB-DEVLP) gh pr create ...`.

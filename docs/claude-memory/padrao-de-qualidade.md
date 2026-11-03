---
name: padrao-de-qualidade
description: "O usuário exige a solução recomendada e bem-feita, nunca o remendo mínimo."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d85dfc7f-9653-4ddd-bfe4-6f7ef21b6142
  modified: 2026-09-08T04:34:24.617Z
---

Sempre entregar a solução correta e recomendada pela boa prática, não o menor remendo que faz funcionar. Perguntar quando houver dúvida real, em vez de assumir.

**Why:** Pedido textual do usuário: "Eu exijo boas práticas e a solução mais recomendada em toda mudança, não o remendo mínimo; perguntar quando houver dúvida."

**How to apply:** Atacar a causa raiz (ex.: criar token/variável única em vez de repetir valor mágico em vários lugares). Usar AskUserQuestion para decisões que mudam materialmente o trabalho — escopo de redesenho, links sem destino, nível de suporte a tema. Ver [[nextech-sistema-de-design]].

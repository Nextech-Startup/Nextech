---
name: economia-de-tokens
description: Jhones reclama de exploração longa antes de agir; ler só o necessário e preferir planos enxutos
metadata:
  node_type: memory
  type: feedback
  originSessionId: 36393f81-96a1-4360-809e-68f9b5b4af72
  modified: 2026-09-26T23:20:41.625Z
---

Em 2026-09-26, na parte 2 do redesign, o Jhones interrompeu reclamando de ~35k tokens gastos lendo arquivos e pensando antes de escrever qualquer coisa. Ele escolheu plano "enxuto": código completo só para lógica pura e testes; telas descritas por props, estrutura e estados, com o TSX escrito uma vez direto no arquivo.

**Why:** exploração exaustiva e código duplicado (plano + arquivo) custam tokens sem mudar o resultado.

**How to apply:** ler só o que a próxima ação exige; parar de explorar assim que der para agir; não escrever o mesmo código duas vezes. Ver [[jhones-prefere-alternativas]] e [[padrao-de-qualidade]].

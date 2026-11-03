---
name: jhones-prefere-alternativas
description: "Jhones quer decisões apresentadas como alternativas selecionáveis, não como pergunta em texto aberto"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e52ac1a7-7a14-4858-838e-4f1fd3e16d3a
  modified: 2026-10-12T02:15:22.712Z
---

Sempre que houver uma decisão para o Jhones tomar, apresentar as opções pela ferramenta de pergunta (alternativas selecionáveis), não como pergunta em texto corrido no fim da mensagem. Ele pediu isso explicitamente em 2026-09-16, depois de duas vezes em que terminei a mensagem com "qual você prefere?" em texto.

Vale inclusive para decisões que parecem simples ou binárias.

**Why:** ler texto e formular a resposta custa mais do que escolher; e alternativas explícitas mostram o trade-off de cada caminho, que é o que ele realmente precisa para decidir.

**Quando ele avisa que vai sair** (2026-10-11: "se for tomar decisões faça sempre o mais recomendado. E use o aios para lhe auxiliar na decisão"): seguir sozinho pela opção recomendada, usando como critério os princípios dos agentes `po` (qualidade, completude, documentação consistente) e `pm` (foco no essencial, risco identificado) do AIOS em `.claude/commands/AIOS/agents/`, e registrar cada decisão no plano ou no status para ele revisar.

**How to apply:** ao chegar num ponto de decisão, montar 2-4 opções com a recomendada em primeiro lugar, marcada como tal, e a consequência de cada uma descrita. Ver [[padrao-de-qualidade]] — a recomendação deve ser a solução bem-feita, não a mais rápida.

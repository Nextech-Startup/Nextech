---
name: nextech-testing-bar
description: "No Nextech a cobertura de teste é ampla (toda lógica de negócio), não só o caminho crítico"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 14878c52-ee21-42f4-8b66-5de0186a4996
  modified: 2026-09-15T00:58:13.366Z
---

No Nextech, toda lógica de negócio leva teste — não só o caminho crítico. Teste faz parte da entrega da spec, nunca de uma fase posterior.

**Why:** Quem implementa e quem escreve o teste é o mesmo agente, e a revisão humana só acontece no PR. O teste é o portão real de qualidade, não a leitura do diff. O produto ainda mexe com dado de saúde sob LGPD.

**How to apply:** Derivar os casos do critério de aceite da spec, não da implementação recém-escrita. Para diff que toca paciente/mensagem/billing, rodar o subagente `security-reviewer` antes do PR. Relacionado: [[nextech-git-flow]].

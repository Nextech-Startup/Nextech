---
name: nextech-session-rhythm
description: "Uma spec de docs/specs/ por sessão no Nextech; pré-requisitos de infra da fase 3 já resolvidos"
metadata: 
  node_type: memory
  type: project
  originSessionId: 14878c52-ee21-42f4-8b66-5de0186a4996
  modified: 2026-09-16T22:11:04.695Z
---

Ritmo de trabalho no Nextech: uma spec de `docs/specs/` por sessão — implementa inteira, testa, commita, encerra. Contexto limpo entre specs.

Em 2026-09-16 os bloqueios de infra da fase 3 foram resolvidos: o projeto Supabase **já existia** (a landing usa em produção, tabela `chatbot_leads`) — o registro anterior de "criar o Supabase" estava errado, faltava só a chave no `.env`. A branch `staging` existe no GitHub e na Vercel. O `.env` está preenchido e há `.env.example` versionado.

Segue valendo: teste de RLS exige banco real, então nenhuma tabela sensível entra sem o teste de isolamento junto.

Em 2026-09-16, ao fim de `clinic-profile-v1`, a fase 3a ficou com **uma única pendência: `agent-config-v1`**. Fase 3c concluída; 3b com spec escrita e nada implementado, bloqueada por credenciais da Meta (dá para construir com mock).

Testar contra o banco real se provou insubstituível: em `clinic-profile-v1`, dois defeitos de CHECK constraint e privilégio de schema só apareceram ali — nenhum teste unitário ou revisão de leitura os pegaria.

**Why:** Jhones optou por fundação sólida sem pressa de prazo, então a ordem de dependência do roadmap vale sem atalho.

**How to apply:** A fase 3 está destravada e dividida em 3a/3b — ver [[nextech-arquitetura-decisoes]]. Ao implementar uma spec, aplicar a migration e rodar os testes de RLS contra o banco antes de considerar qualquer coisa pronta. Relacionado: [[nextech-git-flow]], [[nextech-testing-bar]].

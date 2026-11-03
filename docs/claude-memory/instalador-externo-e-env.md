---
name: instalador-externo-e-env
description: Instalador de terceiro pode sobrescrever o .env sem backup (aios-core fez isso em 2026-10-11); chaves de API são tarefa do Jhones
metadata:
  node_type: memory
  type: feedback
  originSessionId: fd159c7d-7029-475d-8296-27f192a6c127
  modified: 2026-10-11T23:36:43.841Z
---

Em 2026-10-11, o instalador do `aios-core` (v4.4.6), rodado com `--dry-run` e `quiet`, ignorou a simulação, instalou de verdade e **sobrescreveu o `.env` da raiz sem backup**. O modo silencioso compara `'BROWNFIELD'` com `'brownfield'` e cai em "overwrite". Também trocou o `.env.example` e o `.gitignore`. O `.env` só voltou porque um `next start` em execução ainda tinha os valores na memória.

Além disso, o Jhones disse que **preencher as chaves de API é tarefa dele**, em outro momento: não validar, testar nem mexer em chave sem ele pedir.

**Why:** o `.env` não está no git, e nada guarda cópia dele; um instalador desconhecido pode apagá-lo sem aviso, e o `--dry-run` de terceiro não é garantia.

**How to apply:** antes de rodar qualquer instalador ou ferramenta externa que escreve no repositório, copiar o `.env` (e o `scripts/canal-demo/.env`) para fora do repositório e conferir `git status` depois. Nunca confiar no `--dry-run` de ferramenta que não foi testada. Ver [[economia-de-tokens]] e [[nextech-ambiente-supabase]].

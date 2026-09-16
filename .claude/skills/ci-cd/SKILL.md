---
name: ci-cd
description: Pipeline de deploy do Nextech — Vercel, ambientes de staging/produção, GitHub Actions. Use ao configurar ou alterar deploy, ambientes ou pipeline de CI.
---

# CI/CD — Nextech

## Ambientes
- `staging` → branch de desenvolvimento, deploy automático no Vercel em domínio de staging.
- `main` → produção, deploy automático após checks passarem.
- Mesmo padrão já usado em outro projeto: staging aponta pra um subdomínio dedicado, produção pro domínio principal.

> Estado atual: a branch `staging` ainda não existe no repositório (só `main`). Criar antes de começar a fase 3.

## Regra de branch para o agente
O Claude commita em `staging` (ou em branch de spec que sai de `staging`) sem pedir aprovação a cada commit. **Nunca** commita direto em `main` e **nunca** faz merge do PR — a aprovação de `staging` → `main` é do Jhones, e é o único ponto de revisão humana do fluxo.

## Gate antes de merge
Nenhum PR entra em `main` sem:
1. Build passando.
2. Suite de testes (E2E + RLS) passando — ver skill `qa-testing`.
3. Nenhuma variável de ambiente sensível exposta no diff.
4. Para diff que toca dado de paciente, mensagem ou billing: revisão do subagente `security-reviewer` — obrigatória porque o autor do código e o autor do teste são o mesmo agente.

## Variáveis de ambiente
- Nunca comitar `.env`. Cada ambiente (staging/produção) tem seu próprio conjunto de secrets configurado direto no Vercel.
- Chaves de provider externo (WhatsApp/Meta, CRM, OpenRouter, Resend, Google Calendar) são diferentes entre staging e produção sempre que o provider oferecer sandbox — para não gerar mensagem real de teste para paciente de verdade.

## Ao configurar um workflow novo
Preferir GitHub Actions rodando lint + testes antes do Vercel buildar — falha rápido custa menos que falha no deploy.

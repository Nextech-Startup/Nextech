---
name: product-spec
description: Fluxo de definição de escopo (papel de PO) do Nextech. Use no início de qualquer feature nova, antes de escrever qualquer código.
---

# Product Spec — Nextech

Nenhuma feature começa a ser codada sem spec escrita. O objetivo é forçar decisão explícita antes de gastar tempo de implementação.

## Fluxo
1. Descreva a feature em uma frase.
2. Peça para o Claude entrevistar sobre: comportamento esperado, edge cases, o que acontece em erro, qual plano(s) tem acesso a essa feature, impacto em dado de paciente (se houver, ativa `lgpd-security`).
3. A entrevista termina num `SPEC.md` na raiz da feature (ou em `docs/specs/<feature>.md`), cobrindo: objetivo, comportamento, edge cases, critério de aceite, planos afetados.
4. Só depois disso abre uma sessão nova para implementar a partir do spec.

## Perguntas que sempre precisam de resposta antes de codar
- Essa feature está disponível em qual plano (Starter / Pro / HealthTech)?
- Ela toca em dado de paciente ou mensagem? Se sim, quais regras de `lgpd-security` se aplicam?
- O que acontece se a integração externa (CRM, Evolution API, provedor de IA) falhar no meio do fluxo?
- Como isso é medido depois de no ar (o que conta como sucesso)?

## Critério de aceite
Todo `SPEC.md` termina com uma lista de critérios de aceite verificáveis — não "funciona bem", e sim algo testável (ver skill `qa-testing`).

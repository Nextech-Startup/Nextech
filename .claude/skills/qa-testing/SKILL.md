---
name: qa-testing
description: Padrão de testes do Nextech — E2E e isolamento multi-tenant (RLS). Use antes de considerar qualquer feature "pronta", ou ao escrever teste novo.
---

# QA — Nextech

Segue o mesmo padrão já validado em produção em outro projeto do Jhon: E2E com Playwright + suite dedicada de isolamento entre tenants.

## Nível de cobertura: ampla (decidido em 2026-09-14)
Toda lógica de negócio tem teste — não só o caminho crítico. A razão é estrutural: quem implementa e quem escreve o teste é o mesmo agente, e a revisão humana só acontece no PR de `staging` → `main`. Teste é o portão real, não a leitura do diff.

Consequência prática: ao implementar uma spec, o teste faz parte da entrega, nunca de uma fase posterior. Spec sem teste não está pronta.

Como teste escrito pelo autor tende a confirmar a intenção do autor, derive os casos do **critério de aceite da spec**, não da implementação que você acabou de escrever. Se o único jeito de fazer o teste passar é olhar pro código, o teste está errado.

## O que testar sempre
1. **Isolamento entre clínicas**: para toda tabela nova com `clinic_id`, existe teste garantindo que a clínica A não enxerga dado da clínica B, mesmo manipulando request diretamente.
2. **Fluxo E2E do caminho crítico**: recebimento de mensagem WhatsApp → resposta da IA → atualização de status no painel, coberto por teste Playwright.
3. **Limite de plano**: teste garantindo que uma clínica no plano Starter não consegue passar de 150 atendimentos/mês sem erro tratado (não crash).
4. **Webhook de billing**: simular evento de pagamento e confirmar que o plano da clínica muda corretamente.
5. **Sequência de mensagem** (recall, reativação, follow-up): teste garantindo que resposta do paciente, agendamento ou opt-out para o enrollment automaticamente, e que nenhum paciente fica `active` em duas sequências ao mesmo tempo.

## Critério de "pronto"
"Deve funcionar" não é evidência. Antes de marcar uma tarefa como concluída:
- rodar a suite de testes relevante e mostrar o resultado;
- se a feature envolve UI, capturar evidência visual (print ou descrição do fluxo manual testado).

## Revisão independente
Para tarefas que envolvem dado de paciente ou billing, pedir revisão do subagente `qa-reviewer` antes de considerar concluído — ele avalia o diff sem o contexto da implementação, só com o critério de aceite.

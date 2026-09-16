# Spec: Visão Geral do Painel (v1)

## Objetivo
Tela inicial do painel da clínica — visão operacional do que está acontecendo agora, diferente do `clinic-profile-v1.md` (que é cadastro/configuração).

## Escopo v1
- KPIs no topo: atendimentos do mês, taxa de conversão lead → agendamento, taxa de no-show, pacientes reativados (via `message-sequences-v1.md`)
- Funil de qualificação — mesmo dado do "relatório semanal de pacientes qualificados" já prometido no plano Pro do site
- Lista de conversas com status: `ai_handling` | `human_handling` | `waiting` — usa o evento de eco da coexistência (`agent-config-v1.md`)
- Alertas operacionais: template pendente de aprovação da Meta (`whatsapp-templates-v1.md`), paciente esperando resposta há mais de X minutos

## Comportamento
1. Dashboard carrega os KPIs do período (mês corrente por padrão, com seletor de período).
2. Lista de conversas atualiza em tempo real (ver skill `ui-ux`, "painel ao vivo").
3. Alertas aparecem no topo, ordenados por urgência: template rejeitado > paciente esperando resposta > demais.

## Edge cases
- Clínica nova sem dado histórico — dashboard não pode quebrar nem mostrar erro; mostra estado vazio com call-to-action (ex: "publique seu primeiro agente"), nunca zero disfarçado de dado real.
- KPI de no-show depende do motor de agendamento (fase 5 do roadmap) — nesta v1, mostrar como "em breve" enquanto essa feature não estiver ativa.

## Critério de aceite
- [ ] KPIs corretos por clínica, isolados por RLS.
- [ ] Lista de conversas reflete status ai/human corretamente.
- [ ] Alertas de template pendente aparecem quando aplicável.
- [ ] Estado vazio (clínica nova) não quebra nem mostra número zerado enganoso.

## Em aberto
- Fonte exata do "lead qualificado" pro funil — depende de como a IA marca um contato como qualificado, ainda não especificado em nenhum spec anterior. Decidir isso faz parte do desenho do motor de conversa (fase 3 do roadmap).

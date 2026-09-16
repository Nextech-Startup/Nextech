# Spec: Templates de Mensagem WhatsApp (v1)

## Por que isso existe
A API oficial da Meta não permite texto livre fora da janela de atendimento de 24h. Qualquer mensagem que o Nextech inicia sem o paciente ter mandado algo nas últimas 24h precisa ser um **template pré-aprovado pela Meta** — isso é regra da plataforma, não escolha de produto.

## Objetivo
Permitir que a clínica configure, submeta e acompanhe a aprovação dos templates usados pelos três disparos fora da janela de 24h: lembrete de consulta, recall de retorno de rotina, reativação de paciente dormente e follow-up pós-atendimento. O uso desses templates em sequência automatizada (múltiplos passos, parada por resposta/agendamento) é desenhado em `docs/specs/message-sequences-v1.md` — este spec cobre só o ciclo de vida do template em si.

## Escopo v1
Cada agente pode ter um conjunto pequeno e fixo de templates:
- **Lembrete de consulta** — categoria `UTILITY` (exemplo oficial da Meta pra essa categoria é literalmente um lembrete de consulta)
- **Recall de retorno de rotina** (paciente ativo, sem consulta marcada, devido ao próximo retorno) — categoria `MARKETING`: não referencia uma transação existente, mesma lógica do "abandoned cart" que a Meta também trata como marketing
- **Reativação de paciente dormente** — categoria `MARKETING`
- **Follow-up pós-atendimento** (check-in ou nudge de tratamento incompleto) — escrever de forma neutra pra tentar `UTILITY`, mas o sistema **assume custo de `MARKETING`** no cálculo por padrão; se a Meta aprovar como Utility, é economia extra, não a base do cálculo

Categoria `MARKETING` não tem desconto por volume e, a partir de outubro/2026, passa a ser cobrada mesmo dentro da janela de 24h — ver `docs/specs/agent-config-v1.md`.

Campos por template:
- `name` — nome interno, também usado como nome do template na Meta (minúsculo, underscore)
- `category` — `UTILITY` | `MARKETING`
- `body` — corpo com variáveis posicionais (ex: "Olá {{1}}, lembrando sua consulta dia {{2}} às {{3}}")
- `status` — `draft` | `pending_review` | `approved` | `rejected`
- `meta_template_id` — id retornado pela Meta após submissão (null até enviar)
- `rejection_reason` — preenchido só se `status = rejected`

## Comportamento
1. Clínica preenche o template no painel → `draft`.
2. Botão "Enviar pra aprovação" submete o template pela Business Management API da Meta → `status` vira `pending_review`.
3. Atualização de status vinda da Meta (aprovação/rejeição) atualiza `status` pra `approved` ou `rejected` com `rejection_reason`.
4. Só template `approved` pode ser usado nos fluxos de lembrete, recall, reativação e follow-up.
5. Se uma sequência (`docs/specs/message-sequences-v1.md`) precisa mandar um passo e o template do passo ainda não está `approved`, o envio não acontece e a falha fica registrada — **nunca cai pra texto livre como fallback**, isso violaria a política da Meta e arrisca o número da clínica.

## Edge cases
- Template rejeitado: a clínica edita e reenvia; `status` volta pra `draft`, `meta_template_id` é limpo.
- Aprovação pode levar de minutos a mais de um dia — a UI precisa deixar isso explícito (estado "em análise"), não pode parecer que travou.
- Se a Meta mudar regra de categoria ou exigir campo novo, isso fica isolado no adapter em `lib/whatsapp/` — nunca espalhado na UI ou no motor de agendamento.

## Credenciais e segurança
A submissão de template usa a credencial da própria clínica (`whatsapp_waba_id`, `whatsapp_access_token`, definidos em `docs/specs/agent-config-v1.md`) — segredo por tenant, criptografado em repouso, nunca em texto puro. Ver skill `lgpd-security`.

## Critério de aceite
- [ ] Clínica consegue criar, submeter, ver status e reenviar um template rejeitado.
- [ ] Nenhum envio de lembrete, recall, reativação ou follow-up acontece sem template `approved`.
- [ ] Falha por template ausente/não aprovado é registrada e visível pra clínica, sem fallback pra texto livre.
- [ ] Teste automatizado cobre: bloqueio de envio sem template aprovado, isolamento entre clínicas dos próprios templates.

## Em aberto
- Formato exato de notificação de mudança de status de template da Meta (webhook específico) — confirmar na documentação atual da Meta antes de implementar; isso muda de tempos em tempos.
- Custo da categoria `MARKETING` (sem desconto de volume, cobrada mesmo dentro da janela após out/2026) em três sequências (recall, reativação, follow-up) em vez de uma pode inviabilizar no plano Starter — decidir se ficam restritas a Pro/HealthTech.

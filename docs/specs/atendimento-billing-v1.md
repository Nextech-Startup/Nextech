# Spec: Definição de "Atendimento" e Contagem pro Plano (v1)

## Objetivo
Definir tecnicamente o que conta como "um atendimento" pro limite mensal de cada plano (150 / 500 / 5.000) — sem isso, `plan-limits.ts` (skill `architecture`) não tem o que checar.

## Regra definida
Um atendimento é fechado (contado) quando, dentro de uma sessão de conversa com um paciente, **o agente de IA envia 5 respostas** OU **passam 20 minutos sem nova mensagem do paciente** — o que vier primeiro.

## Modelo de dados
### AttendanceSession
- `id`, `clinic_id`, `agent_id`, `patient_id`
- `started_at` — timestamp da primeira mensagem do paciente que abriu a sessão
- `ai_response_count` — incrementado a cada resposta da IA (nunca por resposta enviada por humano via coexistência)
- `last_message_at` — atualizado a cada mensagem, do paciente ou da IA
- `status` — `open` | `closed_by_count` | `closed_by_timeout`
- `closed_at`

## Comportamento
1. Mensagem do paciente sem sessão `open` associada → cria uma `AttendanceSession` nova.
2. Cada resposta da IA incrementa `ai_response_count`. Ao atingir 5 → sessão fecha (`closed_by_count`), conta 1 atendimento.
3. Job agendado (Vercel Cron) varre sessões `open` com `last_message_at` há mais de 20 minutos → fecha (`closed_by_timeout`), conta 1 atendimento.
4. Nova mensagem do paciente depois de uma sessão fechada abre uma sessão nova — nunca reabre a anterior.
5. Resposta enviada por humano via coexistência (evento de eco, `agent-config-v1.md`) **não** incrementa `ai_response_count` — só resposta gerada pela IA conta pro fechamento por contagem.
6. `plan-limits.ts` soma `AttendanceSession`s fechadas no mês corrente e compara com o limite do plano da clínica.

## Edge cases
- Paciente manda várias mensagens seguidas antes da IA responder (ex: várias fotos) — continua a mesma sessão, não abre uma por mensagem.
- Handoff pra humano no meio da sessão (coexistência) — sessão permanece `open` até o timeout, mas não acumula `ai_response_count` enquanto for humano respondendo; se a IA retomar depois, volta a contar normalmente.
- Mensagem de sequência (`message-sequences-v1.md`) que o paciente responde → abre uma `AttendanceSession` normal. Mensagem de sequência sem resposta não abre sessão — sem interação de volta, não conta como atendimento (mas ver nota de custo em Em aberto).

## Critério de aceite
- [ ] Sessão fecha corretamente por contagem (5 respostas) e por timeout (20 min).
- [ ] Resposta humana via coexistência não conta pro fechamento por contagem.
- [ ] `plan-limits.ts` conta corretamente sessões fechadas no mês, isolado por `clinic_id`.
- [ ] Teste automatizado cobre os dois caminhos de fechamento e o caso de handoff no meio da sessão.

## Em aberto
- O que acontece quando a clínica estoura o limite do plano no meio do mês — bloquear a IA, avisar, cobrar excedente? Não definido.
- Mensagem de sequência sem resposta não conta como atendimento, mas a Meta cobra pelo envio de qualquer forma (categoria `MARKETING`, sem desconto de volume) — existe uma janela de custo real que a clínica não "usa" do próprio limite de plano; vale considerar isso na precificação.

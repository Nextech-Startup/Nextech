# Spec: Sequências de Mensagem — Recall, Reativação e Follow-up (v1)

## Objetivo
Automatizar os três disparos fora da janela de 24h que uma clínica precisa pra manter a base de pacientes ativa: recall de retorno de rotina, reativação de paciente dormente, e follow-up pós-atendimento — rodando como sequências de vários passos, não disparo único, com parada automática quando o paciente responde ou agenda.

## Por que sequência, não disparo único
Uma mensagem só tem taxa de resposta muito menor que uma sequência de 2-3 toques espaçados no tempo. Recall, reativação e follow-up têm gatilho e objetivo diferentes, mas o mecanismo — passos com atraso, referência a um template aprovado, condição de parada — é o mesmo. Por isso é uma entidade genérica (`MessageSequence`), não três features separadas.

## Modelo de dados

### MessageSequence
- `id`, `clinic_id`, `agent_id`
- `name` — rótulo interno (ex: "Recall de limpeza semestral")
- `trigger_type` — `patient_inactive` (reativação) | `routine_recall` (recall) | `post_visit_followup` (follow-up)
- `trigger_config` — parâmetro do gatilho (ex: `{ "days_since_last_contact": 180 }` pra reativação, `{ "days_since_last_visit": 180 }` pra recall, `{ "days_since_appointment": 3 }` pra follow-up)
- `status` — `draft` | `active` | `paused`

### SequenceStep
- `id`, `sequence_id`, `order` (1, 2, 3...)
- `delay_days` — atraso relativo ao passo anterior (ou ao gatilho, se for o passo 1)
- `template_id` — referência a um template aprovado (`docs/specs/whatsapp-templates-v1.md`); nunca texto livre, por definição esses envios são fora da janela de 24h

### SequenceEnrollment (runtime, por paciente)
- `id`, `sequence_id`, `patient_id`
- `current_step`
- `status` — `active` | `stopped_replied` | `stopped_booked` | `stopped_opted_out` | `completed`
- `enrolled_at`, `last_step_sent_at`

## Comportamento
1. Um job agendado (Vercel Cron — nunca n8n, ver regra 5 do `CLAUDE.md`) roda diariamente, verifica quais pacientes batem com o `trigger_config` de cada sequência `active`, e cria um `SequenceEnrollment` novo pra cada um. Um paciente nunca entra duas vezes na mesma sequência.
2. Um job de envio verifica `SequenceEnrollment`s `active` cujo próximo passo já venceu (`last_step_sent_at + delay_days` do próximo `SequenceStep`) e envia o template correspondente.
3. Paciente responde (mensagem chega no Cloud API) com enrollment `active` → `status` vira `stopped_replied`.
4. Paciente agenda uma consulta (qualquer canal) com enrollment `active` → `status` vira `stopped_booked`.
5. Paciente pede opt-out (ex: "PARAR") → `status` vira `stopped_opted_out` **em todas as sequências**, e o paciente é marcado como opted-out pra nunca mais ser matriculado automaticamente.
6. Chegou no último `SequenceStep` sem nenhuma parada acima → `status = completed`.

## Regra de exclusividade
Um paciente só fica `active` em uma sequência por vez — evita mandar recall e reativação pro mesmo paciente na mesma semana. Se ele bate com o gatilho de duas sequências ao mesmo tempo, prioridade: `post_visit_followup` > `routine_recall` > `patient_inactive`.

## Edge cases
- Paciente sem template aprovado pro passo da vez → sequência não avança, falha registrada (mesma regra do `whatsapp-templates-v1.md`: nunca cair pra texto livre).
- Job de envio falha no meio (ex: rate limit de 20 mps da coexistência) → reentrada precisa ser segura, nunca duplicar o mesmo passo pro mesmo paciente.
- Paciente agenda e depois cancela: `stopped_booked` não reabre sozinho — reengajar exige um novo gatilho natural (ex: ficou inativo de novo depois de X dias).

## Critério de aceite
- [ ] As três sequências (recall, reativação, follow-up) podem ser configuradas com N passos e delay entre eles.
- [ ] Enrollment para automaticamente por resposta, agendamento ou opt-out.
- [ ] Nenhum envio acontece sem template aprovado.
- [ ] Paciente nunca fica `active` em mais de uma sequência ao mesmo tempo.
- [ ] Teste automatizado cobre: parada por resposta, parada por opt-out, não-duplicação de enrollment.

## Em aberto
- Custo: recall + reativação + follow-up em `MARKETING` (sem desconto de volume) pode ser caro demais pro plano Starter — decidir se ficam restritas a Pro/HealthTech (mesmo ponto do `whatsapp-templates-v1.md`, agora valendo pras três sequências).
- Detecção de "paciente agendou por qualquer canal" depende do motor de agendamento (fase 5 do roadmap) — aqui assume que esse evento já existe disponível pro `SequenceEnrollment` escutar.

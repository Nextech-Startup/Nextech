# Spec: Paciente (v1)

## Objetivo
Modelo mínimo viável de paciente — o suficiente pra sustentar conversa, convênio, sequências e consentimento, sem entrar em prontuário ou histórico clínico.

## Escopo v1 (mínimo viável)
### Patient
- `id`, `clinic_id`
- `whatsapp_phone_number` — E.164, identificador primário do contato
- `name` — como informado pelo paciente ou capturado pela IA na conversa (nullable até ser conhecido)
- `insurance_id` — nullable, FK pra `Insurance` (`clinic-profile-v1.md`)
- `created_at` — primeiro contato
- `last_contact_at` — usado pelo `trigger_config` de sequências (dias desde o último contato)
- `consent_given_at` — nullable, quando aceitou o `ConsentText` da clínica
- `opted_out` — boolean, ver regra 8 da skill `lgpd-security`

Fora do escopo v1: histórico de atendimento estruturado, prontuário, observações clínicas — só faz sentido guardar histórico rico quando existir algo consumindo esse histórico (motor de agendamento/conversa, fases 3 e 5 do roadmap).

## Comportamento
1. Primeiro contato via WhatsApp cria o `Patient` automaticamente, se o número ainda não existir pra aquela clínica — `name` fica nulo até a IA perguntar ou o paciente informar.
2. `Patient` pertence à clínica, não ao agente — o mesmo paciente pode conversar com agentes diferentes da mesma clínica (múltiplas especialidades) sem duplicar cadastro.
3. `last_contact_at` atualiza a cada mensagem recebida do paciente (não a cada resposta da IA) — alimenta o gatilho `patient_inactive` das sequências.

## Edge cases
- Paciente muda de número de telefone — sem reconciliação automática na v1; vira um `Patient` novo. Limitação conhecida.
- Paciente pede exclusão do próprio dado (direito LGPD) — remove ou anonimiza `Patient` e desmatricula de qualquer `SequenceEnrollment` ativo.

## Critério de aceite
- [ ] Paciente é criado automaticamente no primeiro contato, sem duplicar por número já existente na clínica.
- [ ] `last_contact_at` atualiza corretamente e alimenta o gatilho de reativação.
- [ ] RLS isola `Patient` por `clinic_id`.

## Em aberto
- Reconciliação de paciente que troca de número — não resolvido, fica como limitação conhecida da v1.
- Vínculo `Patient` ↔ `Professional` (pra role `professional` de `team-access-v1.md` enxergar só os próprios pacientes) ainda não existe — hoje o vínculo é só com a clínica.

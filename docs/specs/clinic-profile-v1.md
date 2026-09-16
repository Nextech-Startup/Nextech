# Spec: Perfil da Clínica (v1)

## Objetivo
Capturar as informações que só uma clínica de saúde preencheria — identidade regulatória, equipe, convênios, procedimentos, política de agendamento, triagem de urgência e consentimento — como base de dados que os outros módulos (agente, agendamento, sequências) consultam. Isso é o que separa o Nextech de um SaaS genérico de agendamento.

## Escopo v1

### Identidade regulatória
- `legal_name` (razão social), `cnpj`
- `technical_responsible_name`, `technical_responsible_council` (CRM, CRO, CREFITO, CRP, CRN...), `technical_responsible_registration_number`
- `sanitary_license` — opcional

### Equipe (`Professional`)
- `name`, `specialty`, `council`, `registration_number`, `photo_url`
- `google_calendar_id` — cada profissional pode ter o próprio calendário, não necessariamente um só da clínica inteira
- `accepted_insurance_ids` — convênio aceito por profissional, não só por clínica (pode variar dentro da mesma equipe)

### Convênios (`Insurance`)
- `name` (Unimed, Amil, Bradesco Saúde, SulAmérica, Hapvida, Particular...)
- `active`

### Procedimentos (`Procedure`)
- `name`, `specialty`
- `duration_minutes` — crítico pro motor de agendamento (fase 5 do roadmap)
- `price` (particular)
- `covered_insurance_ids`

### Política de agendamento (`SchedulingPolicy`, por clínica)
- `default_slot_duration_minutes`, `min_advance_hours`, `min_cancellation_hours`
- `no_show_policy` — enum (`fee` | `block_rebooking` | `none`)

### Triagem de urgência (`UrgencyRule`)
- `keywords` — termos que disparam escalonamento imediato pra humano (dor no peito, sangramento, falta de ar...)
- `protocol_message` — resposta padrão (ex: orientar a procurar pronto-socorro)
- Nunca fica ativa só com texto padrão do Nextech sem revisão explícita da própria clínica — ver Edge cases.

### Consentimento (`ConsentText`)
- `body` — texto do termo de consentimento pra tratamento de dado de saúde, editável pela própria clínica, não um texto genérico do Nextech
- `retention_years` — prazo de retenção de prontuário; cada conselho tem regra própria (ex: CFM exige 20 anos pra prontuário médico) — não usar um número fixo genérico pro produto inteiro

### Identidade do agente
Reaproveita `name`/`persona_instructions` já definidos em `agent-config-v1.md` — adiciona `display_name` e `avatar_url`.

### Sistemas existentes (`ExistingSystem`)
- `software_name` (Clinicorp, iClinic, Simples Dental, Feegow...) — só cadastro informativo na v1, sem integração real.

## Comportamento
1. Cadastro inicial passa por essas seções antes de a clínica poder publicar o primeiro agente.
2. Campos regulatórios (CNPJ, responsável técnico) são obrigatórios pra sair do status `draft` da clínica.
3. Regra de urgência exige confirmação explícita de alguém da clínica antes de ativar.

## Edge cases
- Clínica multi-especialidade com profissionais de conselhos diferentes — conselho é campo do profissional, não da clínica.
- Texto de urgência mal configurado é risco de responsabilidade clínica, não só bug de produto — UI precisa deixar explícito que o conteúdo é de responsabilidade da própria clínica.
- Prazo de retenção de prontuário definido aqui prevalece sobre o default genérico já configurado em `lgpd-security` (regra 5) quando informado.

## Critério de aceite
- [ ] Clínica consegue preencher identidade regulatória, equipe, convênios, procedimentos, política de agendamento, triagem de urgência e consentimento.
- [ ] Duração de procedimento fica disponível pro motor de agendamento.
- [ ] Regra de urgência não fica ativa sem confirmação explícita da clínica.
- [ ] RLS isola todos os campos acima por `clinic_id`.

## Em aberto
- Validar texto/keywords padrão de triagem de urgência com alguém da área clínica antes de oferecer qualquer "modelo pronto" — risco de responsabilidade se o Nextech sugerir um protocolo insuficiente.
- Decidir se o prazo de retenção deve sugerir automaticamente por conselho (ex: 20 anos se `technical_responsible_council = CRM`) ou ficar livre pra clínica preencher.

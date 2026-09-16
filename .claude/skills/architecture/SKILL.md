---
name: architecture
description: Convenções de arquitetura multi-tenant do Nextech — modelo de clínica/tenant, onde cada tipo de código mora, quando criar módulo novo. Use ao criar entidade, endpoint ou decidir onde um código deve morar.
---

# Arquitetura Nextech

## Convivendo com a landing page
Este projeto nasceu como landing page (nextech.ia.br) e o SaaS é construído no mesmo repositório. Hoje a landing é `app/page.tsx` + `app/layout.tsx` na raiz do App Router (não existe route group `(marketing)`) — mover a landing pra dentro de um group é uma decisão a tomar quando as rotas autenticadas entrarem, não antes. Middleware de autenticação se aplica só às rotas de `(dashboard)` e `(admin)` — a landing pública continua sem autenticação. Nunca alterar rota, componente ou estilo da landing existente sem necessidade direta da tarefa.

## Modelo de tenant
- Cada clínica é um tenant. Toda tabela com dado de clínica tem coluna `clinic_id`.
- `clinic_id` sempre resolvido no servidor a partir da sessão autenticada — nunca aceito como parâmetro vindo do client.
- RLS ativo em toda tabela sensível, filtrando por `clinic_id`.
- `Clinic` carrega identidade regulatória (CNPJ, responsável técnico), equipe (`Professional`), convênios (`Insurance`), procedimentos (`Procedure`), política de agendamento e triagem de urgência — ver `docs/specs/clinic-profile-v1.md`. Esses dados alimentam outros módulos (agendamento lê `duration_minutes` do procedimento; sequências e agente leem a política de urgência) — nunca duplicar esse dado em outro lugar, sempre referenciar.

## Modelo de agente
- Uma clínica pode ter vários agentes (ex: um por especialidade/unidade). `Agent` pertence a `Clinic` via `clinic_id` — mesma regra de RLS se aplica a ele.
- Assunção de v1: cada agente está vinculado a um único `phone_number_id` da API oficial da Meta (WhatsApp Business Platform) — não existe roteamento de intenção entre agentes dentro do mesmo número. Se surgir caso de múltiplos agentes num único número, essa assunção precisa ser revisitada antes de codar (ver `docs/specs/agent-config-v1.md`).
- Agente tem `status` (`draft` | `active` | `paused`). Só agente `active` com `phone_number_id` conectado responde tráfego real.
- Mensagem enviada fora da janela de atendimento de 24h exige template aprovado pela Meta — não é texto livre como era com o Evolution API. Ver skill `integrations` e `docs/specs/whatsapp-templates-v1.md`.
- Credencial da Meta de cada clínica (`whatsapp_access_token`, `whatsapp_waba_id`) é dado por tenant, criptografado em repouso — nunca um `.env` de infraestrutura. Ver skill `lgpd-security`.
- O preview de conversa nunca depende do registro salvo no banco — roda com o payload atual do formulário, sem persistir nada. Isso existe pra permitir testar antes de salvar/publicar.

## Modelo de paciente
- `Patient` pertence à clínica (`clinic_id`), não ao agente — o mesmo paciente conversa com agentes diferentes da mesma clínica sem duplicar cadastro. Modelo mínimo em `docs/specs/patient-v1.md`.
- `last_contact_at` do paciente é o que alimenta o gatilho `patient_inactive` das sequências (`docs/specs/message-sequences-v1.md`) — nunca recalcular essa data em outro lugar.

## Onboarding e acesso
- Onboarding é consultivo, não self-service: a equipe Nextech cria a clínica pelo `(admin)` e configura o perfil junto com o cliente. Ver `docs/specs/team-access-v1.md`.
- Acesso dentro da clínica é por papel (`owner` | `staff` | `professional`) via tabela `ClinicMember` sobre o Supabase Auth — nunca checar permissão comparando e-mail ou heurística ad hoc, sempre pelo `role` de `ClinicMember`.

## Onde cada coisa mora
- Regra de negócio pura → `lib/<dominio>/` (ex: `lib/scheduling/`).
- Rota HTTP → `app/api/<recurso>/route.ts`, fina, só orquestra chamadas pro `lib`.
- Cliente de serviço externo (WhatsApp, provider de CRM, OpenRouter, Resend, Google Calendar, Asaas) → `lib/<provider>/client.ts`, nunca instanciado direto num componente ou rota.
- UI do painel da clínica → `app/(dashboard)`. UI interna da Nextech (métricas, suporte, onboarding de clínica) → `app/(admin)`.

## Quando criar um adapter novo
Toda vez que uma integração externa (CRM, calendário, canal de mensagem) tiver mais de uma implementação possível, ela é um adapter que satisfaz uma interface comum — nunca um `if (provider === 'x')` espalhado pelo código. Ver skill `integrations`.

## Feature gating por plano
Limites de plano (150 / 500 / 5.000 atendimentos por mês, integrações disponíveis, SSO) são verificados numa camada central (`lib/billing/plan-limits.ts`), nunca checados ad hoc em cada rota. A definição técnica de "um atendimento" (contagem por `AttendanceSession`) está em `docs/specs/atendimento-billing-v1.md` — nunca reimplementar essa contagem em outro lugar.

## Sinal de que algo está errado
- Query ao Supabase escrita direto num componente ou numa rota, em vez de passar por um módulo de `lib/`.
- `clinic_id` vindo de body/query param sem validar contra a sessão.
- Lógica de negócio dentro de um arquivo em `app/api`.

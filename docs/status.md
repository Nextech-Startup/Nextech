# Status do Projeto — Nextech SaaS

> Atualizado em 2026-09-16. Documento de acompanhamento: o que está pronto, o que falta e o que bloqueia.

## Onde estamos

| Fase | Estado |
|---|---|
| 1 — Specs do MVP | ✅ concluída — 9 specs |
| 2 — Repo, CLAUDE.md, skills | ✅ concluída |
| **3a — Fundação multi-tenant** | 🟡 ~60% |
| **3b — Motor de conversa** | ⬜ spec pronta, nada implementado |
| **3c — Shell de navegação** | ⬜ desenho pronto, nada implementado |
| 4 a 10 | ⬜ não iniciadas |

**64 testes passando** · 5 migrations aplicadas · em produção em `app.nextech.ia.br`

---

## Fase 3a — Fundação multi-tenant

### Concluído

- [x] **Infra**: Next 16.3.5 (`npm audit` de 6 vulnerabilidades, 1 crítica, para 0), Vitest 5, Supabase CLI, branch `staging`
- [x] **Migrations**: baseline das tabelas da landing, `clinics` + `clinic_members` com RLS, restrição de coluna, `platform_admins`, `admin_audit_log`
- [x] **`requireClinicContext()`** — porta única de resolução de tenant, sem argumento: não há como pedir o contexto de outra clínica
- [x] **Guarda arquitetural** — teste que falha se alguém instanciar client Supabase fora da fachada, ou logar objeto de erro cru
- [x] **Route groups** — landing em `(marketing)`, painel em `(dashboard)` e `(admin)`, com roteamento por hostname
- [x] **Login** — e-mail e senha, com proteção contra open redirect e mensagem genérica (não permite enumerar clientes)
- [x] **`platform_admins`** — superusuário sem furar a RLS das clínicas
- [x] **Painel `(admin)`** — listar clínicas, criar, convidar responsável
- [x] **Trilha de auditoria** — imutável: sem policy de insert, update ou delete para usuário autenticado
- [x] **`lib/clinics/`** — primeira fatia vertical (schema Zod strict, queries, mutations)

### Falta

- [ ] **`clinic-profile-v1`** — identidade regulatória, equipe, convênios, procedimentos, política de agendamento, triagem de urgência, consentimento. A maior spec pendente, e a que alimenta o motor de conversa e o de agendamento
- [ ] **`patient-v1`** — modelo mínimo de paciente. Pequena, mas pré-requisito da 3b
- [ ] **`agent-config-v1`** — agente em `draft` com formulário (o preview de conversa é 3b)

---

## Fase 3b — Motor de conversa

Spec escrita em `docs/specs/conversation-engine-v1.md`. Nada implementado.

Decisões já tomadas: retomada da IA por inatividade de 24h; urgência responde o protocolo da própria clínica e escala; qualificação por intenção de agendar; falha de IA escala em silêncio, sem avisar o paciente.

**Bloqueio externo:** credenciais da Meta não existem. Dá para construir e testar com mock, mas WhatsApp real depende de aprovação da Meta — vale iniciar esse processo em paralelo, porque não trava código.

---

## Fase 3c — Shell de navegação

Desenho em `docs/superpowers/specs/2026-09-16-navegacao-e-rotas-design.md`. Nada implementado.

Sidebar do painel da clínica em três grupos (Operação, Automação, Configuração), filtrado por papel; sidebar do painel interno com seis itens; cabeçalho com usuário e "Sair" nos dois.

---

## Acessos

| Conta | Credencial | Onde entra |
|---|---|---|
| Equipe Nextech | `admin@nextech.ia.br` / `NextechAdmin2026` | `app.nextech.ia.br/admin` |
| Clínica (owner) | `clinica@nextech.ia.br` / `NextechClinica2026` | `app.nextech.ia.br/dashboard` |

---

## Pendências

### Precisam de ação do Jhones

- [ ] **Merge do PR #3** — corrige erro 500 no `/dashboard` da conta admin (sem clínica vinculada). Enquanto não fecha, `admin@nextech.ia.br` quebra ao abrir `/dashboard`
- [ ] **DNS de `nextech.ia.br` sem `www`** — não resolve. Precisa de registro `A` para `76.76.21.21` ou o ALIAS que a Vercel indicar; CNAME não funciona em domínio raiz
- [ ] **Proteção de deployment do `staging`** — hoje exige login da Vercel (302 para SSO). Desativar em Settings → Deployment Protection, se quiser acesso direto
- [ ] **Credenciais da Meta** — iniciar o processo, que leva tempo e não trava código

### Dívida técnica conhecida

- [ ] **Staging escreve no banco de produção** — há um único projeto Supabase. Aceitável até o primeiro cliente real, não depois
- [ ] **Tabela `projetoAtivo`** — existe no banco, nenhum código a referencia. Resíduo ou uso externo? Mantida na baseline com nota
- [ ] **Convite mostra senha na tela** — o `(admin)` exibe a senha provisória porque o Resend não está configurado. Vira convite por e-mail quando estiver
- [ ] **`admin_audit_log` precisa de justificativa** — a fase 3c decidiu que ver conversa de paciente exige motivo registrado. Estende a tabela com `conversation.view` e campo de justificativa

---

## Decisões que valem lembrar

- **Fase 3 foi dividida** em 3a (fundação), 3b (motor de conversa) e 3c (navegação). O motor era o único subsistema sem spec e aparecia como dependência em 6 das 8 specs originais
- **Supabase Auth**: signup público estava **aberto** — qualquer pessoa criava conta com a anon key, que é pública. Fechado em 2026-09-16. Usuário novo só nasce por `service_role`
- **`chatbot_leads` já tinha RLS** — a suspeita anterior de PII exposta estava errada
- **npm é o gerenciador** — o `pnpm-lock.yaml` era vestígio vazio do scaffold, removido

---

## Intencionalmente adiado

- Contrato controlador/operador de LGPD entre Nextech e cada clínica — jurídico, corre em paralelo
- Operação do SLA do plano HealthTech — só importa com cliente pagante nesse plano
- Preço final dos planos — decisão de negócio; a definição técnica de "atendimento" já existe
- Mobile, busca global, notificações, rede com múltiplas unidades — dependem de uso real para serem decididos bem

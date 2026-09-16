# Navegação e Rotas do SaaS — Design

> Mapa completo de rotas, sidebar e telas do produto. Gerado com a skill `superpowers:brainstorming` (caminho arquitetural) em 2026-09-16.

## Por que este documento existe

O roadmap organiza o trabalho por **domínio** (multi-tenant, conversa, agendamento, billing). Isso funciona para ordem de dependência, mas não responde a uma pergunta prática: quais telas o produto vai ter, e como alguém navega entre elas.

A consequência apareceu na prática: hoje existem `/dashboard` e `/admin` sem nenhum link entre si — navega-se digitando URL. Cada spec adiciona sua tela, e ninguém é dono da estrutura que as conecta.

Este documento é esse dono. Ele vira a **Fase 3c** do roadmap.

## Princípio

Cada spec continua criando a própria tela. O que este documento define é onde ela encaixa, quem a enxerga e como se chega até ela — o shell, não o conteúdo.

---

## 1. Painel da clínica — `app/(dashboard)`

Sidebar em três grupos. A divisão segue frequência de uso, não afinidade temática: o que a recepção abre todo dia fica no topo, o que se configura uma vez fica no fim.

### Operação
Uso diário. É onde a recepção vive.

| Item | Rota | Fase | O que faz |
|---|---|---|---|
| Visão geral | `/dashboard` | 10 | KPIs, funil, alertas |
| Conversas | `/dashboard/conversations` | 3b | Lista ao vivo com status `ai` / `humano` / `aguardando`; abrir uma abre o chat |
| Agenda | `/dashboard/schedule` | 5 | Consultas do dia, reagendamento, cancelamento |
| Pacientes | `/dashboard/patients` | 3a | Busca, histórico de contato, consentimento, opt-out |

### Automação
Configura uma vez, roda sozinho.

| Item | Rota | Fase | O que faz |
|---|---|---|---|
| Agentes | `/dashboard/agents` | 3a / 3b | Lista; `/agents/[id]` é o editor com preview lado a lado |
| Sequências | `/dashboard/sequences` | 4 | Recall, reativação, follow-up: passos e gatilhos |
| Templates | `/dashboard/templates` | 4 | Ciclo de vida do template na Meta, com estado da aprovação |

### Configuração
Só `owner`.

| Item | Rota | Fase | O que faz |
|---|---|---|---|
| Perfil da clínica | `/dashboard/settings` | 3a | 7 abas (abaixo) |
| Equipe e acessos | `/dashboard/settings/team` | 3a | Convidar staff, vincular profissional |
| Plano e cobrança | `/dashboard/billing` | 7 | Consumo do mês, limite, faturas |

### As 7 abas do perfil

`/dashboard/settings` com abas, não sete itens no sidebar: é conteúdo de cadastro, mexido no onboarding e raramente depois.

`Clínica` (identidade regulatória) · `Equipe` · `Convênios` · `Procedimentos` · `Agendamento` (política) · `Urgência` (triagem) · `Consentimento`

Todas vêm de `clinic-profile-v1.md`.

---

## 2. Visibilidade por papel

Decidido: **esconder o que o papel não acessa**. Interface limpa, e ninguém clica no que vai dar erro.

| Papel | Vê |
|---|---|
| `owner` | Tudo |
| `staff` | Operação + Automação. Sem Configuração, sem billing |
| `professional` | Só Agenda e Pacientes — os próprios |

**Esconder é usabilidade, não segurança.** A barreira real continua sendo a RLS e a checagem de papel em `lib/`. Um sidebar filtrado sem RLS por trás seria segurança por obscuridade; aqui é o contrário — a RLS já existe e foi testada, e o sidebar só evita frustração.

O filtro usa o `role` que `requireClinicContext()` já devolve. Nenhuma consulta nova.

---

## 3. Painel interno — `app/(admin)`

| Item | Rota | O que faz | Lê dado de paciente? |
|---|---|---|---|
| Clínicas | `/admin` | Listar, criar, convidar responsável | Não |
| Consumo | `/admin/usage` | Atendimentos por clínica contra o limite do plano | Não — só agregado |
| Conexões | `/admin/connections` | Estado do WhatsApp por clínica: conectado, `ACCOUNT_OFFBOARDED`, template rejeitado | Não |
| Saúde | `/admin/health` | Falhas de webhook, erros do OpenRouter, cron que não rodou | Não |
| Conversas | `/admin/clinics/[id]/conversations` | Suporte: abrir conversa de paciente | **Sim** |
| Auditoria | `/admin/audit` | A própria trilha, consultável | Não |

### A tela de conversas exige proteção própria

É a única que lê dado de saúde. Sob LGPD, a Nextech é operadora: ver a conversa de um paciente para dar suporte é legítimo, mas precisa deixar rastro que responda *por quê*, não só *quem*.

Decidido: **justificativa obrigatória + auditoria por acesso**.

1. Antes de abrir, a pessoa informa o motivo (número do chamado ou descrição).
2. O registro grava: quem, quando, qual clínica, qual conversa, e a justificativa.
3. Sem justificativa, não abre. Não é aviso — é bloqueio.

Isso exige estender `admin_audit_log` com a ação `conversation.view` e um campo de justificativa. A trilha atual registra `clinic.list`; ela precisa registrar "fulano abriu a conversa do paciente X às 14h porque o chamado #123 dizia que a IA não respondeu".

---

## 4. Rotas públicas

| Rota | Grupo | Estado |
|---|---|---|
| `/` | `(marketing)` | Existe — landing |
| `/login` | `(auth)` | Existe |
| `/forgot-password`, `/reset-password` | `(auth)` | Faltam — dependem do Resend |
| `/accept-invite` | `(auth)` | Falta — hoje a senha provisória é passada pela equipe |

---

## 5. O que muda no que já existe

1. **`app/(dashboard)/layout.tsx`** ganha o sidebar e o cabeçalho com usuário e "Sair".
2. **`app/(admin)/admin/layout.tsx`** ganha o sidebar interno.
3. **Link entre os painéis**: quem é `platform_admin` e também tem clínica vê um atalho. Hoje não existe caminho entre os dois.
4. **Estado vazio** em cada tela: clínica nova não pode ver tabela vazia sem explicação. Cada tela tem um estado inicial com o próximo passo — `dashboard-overview-v1.md` já exige isso, e a regra vale para todas.

---

## 6. Ordem de construção

O shell vem antes das telas, mas não muito antes: construir navegação para telas que não existem é adivinhação.

**Fase 3c — Shell de navegação** (esta spec)
1. Sidebar do `(dashboard)` com filtro por papel, com os itens já existentes ativos e os futuros desabilitados com marca de "em breve".
2. Sidebar do `(admin)`.
3. Cabeçalho com usuário, papel e "Sair" nos dois.
4. Link entre os painéis para quem é das duas coisas.

**Depois:** cada spec preenche a própria rota, e o item do sidebar deixa de ser "em breve".

Itens desabilitados são deliberados: mostram à clínica o que o produto vai ter, e a nós o que falta. O risco é prometer o que não existe — por isso a marca "em breve" precisa ser explícita, nunca um link que leva a uma tela vazia.

---

## 7. Em aberto

- **Mobile.** A recepção usa desktop, mas o dono da clínica olha do celular. Sidebar vira gaveta, e a tabela do `(admin)` não cabe em 375px — decidir quando houver uso real.
- **Busca global.** Com pacientes e conversas crescendo, procurar por nome ou telefone vira necessidade. Fora do escopo agora.
- **Notificações.** `dashboard-overview-v1.md` prevê alertas na tela. Se viram sino no cabeçalho ou ficam só na visão geral, decidir junto com a fase 10.
- **Multi-clínica por usuário.** Hoje `requireClinicContext()` pega o primeiro vínculo. Rede com várias unidades precisaria de seletor no cabeçalho — não é caso conhecido ainda, mas o modelo já suportaria.

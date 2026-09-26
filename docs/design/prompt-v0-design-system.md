# Design system e telas do painel Nextech

## Contexto

Você está no repositório do **Nextech**, um SaaS multi-tenant de assistentes de IA no WhatsApp para clínicas e consultórios (atendimento 24/7, qualificação, agendamento, follow-up). Cada clínica é um tenant isolado, com plano Starter, Pro ou HealthTech.

O mesmo repositório Next.js serve duas coisas:

- **A landing** (`nextech.ia.br`): está em produção, com PageSpeed otimizado e identidade visual forte.
- **O painel** (`app.nextech.ia.br`): foi construído pela regra de negócio e pelo teste, e visualmente não tem identidade nenhuma.

No painel, cada tela monta os próprios inputs com classes `[var(--x)]` copiadas entre arquivos. Os arquivos `settings/ui.tsx` e `agents/ui.tsx` são cópias um do outro. Não existe biblioteca de componentes nem tokens de estado. No celular, o menu é só uma faixa empilhada. Metade das telas do produto nem existe ainda.

## Objetivo

Construir um design system de verdade para o painel, sobre **shadcn/ui**, com a identidade da landing, e desenhar **todas** as telas do produto com ele. O painel precisa parecer o mesmo produto do site e ter nível de Linear, Vercel, Raycast e Attio. Nada de cara de template shadcn padrão.

O resultado final tem três partes:

1. **Fundação.** Tokens e primitivos shadcn estilizados para a marca.
2. **Padrões reaproveitáveis.** As composições que toda tela usa, para que tela nova seja montagem e não reinvenção.
3. **Telas.** As existentes, refeitas com dado real. As futuras, prototipadas com dado fictício, prontas para receber dado real quando o backend existir.

## Leia antes de começar

- `app/globals.css`: os tokens. É a fonte da verdade da identidade.
- `app/layout.tsx`: fontes e ThemeProvider.
- A assinatura visual da landing: `components/hero.tsx`, `components/navbar.tsx`, `components/background.tsx`, `components/aurora.tsx`, `components/ui/liquidMetalButton.tsx`, `components/pricing.tsx`.
- O painel atual: `components/shell/*`, `app/(dashboard)/**`, `app/(admin)/**`, `app/(auth)/**`.
- `lib/navigation/*`: o mapa de rotas como dado, filtrado por papel.
- `.claude/skills/ui-ux/SKILL.md`: as regras de UX do produto.
- `docs/superpowers/specs/2026-09-16-navegacao-e-rotas-design.md`: todas as telas do produto, quem vê cada uma e o que cada uma faz.
- `docs/specs/*.md`: a spec de cada domínio. As telas futuras saem daqui (a lista está mais abaixo).

## Stack (não mude)

- Next.js 16 (App Router), React 19, TypeScript, npm.
- Tailwind CSS v4. Não há `tailwind.config`: o tema fica em `@theme inline`, dentro de `app/globals.css`.
- shadcn/ui já configurado em `components.json` (style `new-york`, aliases `@/components/ui` e `@/lib/utils`).
- lucide-react, framer-motion, sonner, react-hook-form, zod.
- next-themes: tema escuro por padrão, `enableSystem: false`, classe `.dark`.
- Cores em OKLCH.

Pode adicionar dependência que o shadcn exija: `cmdk`, `@tanstack/react-table`, `recharts`, `react-day-picker`, `date-fns` e pacotes Radix mais novos.

## A identidade da landing, e quanto dela entra no painel

**O que existe na landing:**

- **Fundo.** Quase preto neutro (`oklch(0.09 0 0)`) no tema escuro, que é o padrão. O tema claro também está completo, e o painel precisa dos dois.
- **Cor.** Todo neutro é levemente tingido de hue 165. Há um único acento emerald: `oklch(0.75 0.14 165)` no escuro e bem mais escuro no claro, por contraste. O acento é escasso: sinaliza, não decora.
- **Superfícies por papel.** `surface-0`, `surface-1` e `surface-2`, hairlines de 10% de branco e texto em três níveis (`ink-1`, `ink-2`, `ink-3`).
- **Tipografia.** Cal Sans (`font-display`) em títulos. Manrope no corpo. Instrument Sans carregada para texto secundário.
- **Raios semânticos.** `rounded-pill`, `rounded-card` (1.25rem) e `rounded-panel` (2.5rem).
- **Elementos de assinatura:**
  - badge em pílula com ponto de acento (hero);
  - vidro (`.glass-effect`);
  - aurora em WebGL, em slate-blue (`#607585`);
  - ruído sutil global;
  - border-beam;
  - CTA primário em pílula clara sobre o escuro;
  - botão de metal líquido.

**Como isso entra no painel.** O painel é ferramenta de trabalho: a recepção olha para ele o dia inteiro. Densidade e legibilidade vêm antes de efeito, e as assinaturas entram em dose:

- **Cal Sans:** título de página e número grande de KPI. Nunca em texto de formulário.
- **Badge em pílula com ponto:** vira o padrão de status do produto inteiro.
- **Vidro:** só em camadas flutuantes (command palette, popover, header quando a página rola).
- **Aurora:** só no login, em estado vazio e no onboarding. Nunca atrás de tabela ou formulário, e sempre carregada sob demanda.
- **Border-beam:** reservado para "agente ao vivo".
- **Metal líquido:** fora do painel, ou no máximo em um único CTA de onboarding.
- **Números:** tabulares (`tabular-nums`) em toda tabela e KPI.

## Correções de fundação (faça primeiro)

### 1. Conflito do token `accent`

No shadcn, `accent` é a superfície **neutra** de hover e seleção: `hover:bg-accent` no Button outline/ghost, `focus:bg-accent` no Select, DropdownMenu e Command. Aqui, `--accent` é o **verde da marca**. Resultado: todo hover de componente shadcn vira um bloco verde, e `text-accent-foreground` nem existe. Isso vai piorar a cada componente que você gerar.

Resolva renomeando a família do verde para `brand`:

- tokens: `--accent` → `--brand`, `--accent-strong` → `--brand-strong`, `--accent-dim` → `--brand-dim`, `--accent-on-light` → `--brand-on-light`;
- utilitários: `text-accent`, `bg-accent`, `border-accent`, `shadow-accent` e `fill-accent` viram as versões `brand`;
- todo `var(--accent…)` em classe arbitrária.

Depois, defina `--accent` e `--accent-foreground` como o shadcn espera: neutros, derivados de `surface-2` e `ink-1`. O anel de foco (`--ring` e `:focus-visible`) continua verde.

É uma troca de nome mecânica em cerca de 25 arquivos, **incluindo a landing**. A landing precisa ficar pixel a pixel igual: nenhuma cor muda, só o nome.

### 2. Mapeamento incompleto no `@theme inline`

Hoje não estão mapeados `popover`, `secondary`, `muted`, `muted-foreground`, `destructive` e `input`. Por isso `text-muted-foreground`, `bg-popover` e `border-input` não geram CSS nenhum.

Complete no padrão shadcn para Tailwind v4, incluindo:

- `--radius-sm/md/lg/xl` derivados de `--radius`;
- tokens `sidebar-*`;
- `chart-1` a `chart-5`, derivados do hue da marca e de neutros, sem arco-íris.

Aproveite para limpar duas coisas, sem mudar o visual:

- `--animate-marquee` está duplicado;
- os seletores `[data-radix-slider-*]` usam cor fixa (`#10b981`, `rgba`); troque por token.

### 3. Tokens que o painel precisa e a landing não tem

**Tons de estado:** `success`, `warning`, `danger`, `info` e `neutral`.

- Cada tom tem `-bg`, `-fg` e `-border`, nos dois temas.
- Todos saem da mesma escala OKLCH: hue próprio, mas luminosidade e croma equivalentes entre si.
- Contraste AA em todos.

Eles representam:

- status de agente: `draft`, `active`, `paused`;
- status de conversa: IA atendendo, humano atendendo, aguardando, urgente;
- status de template: `draft`, `pending_review`, `approved`, `rejected`;
- status de sequência e de inscrição;
- estado de conexão do WhatsApp;
- nível de consumo do plano.

**Densidade:** altura de controle e de linha de tabela, em uma escala confortável e outra compacta.

## Arquitetura de componentes (o coração do trabalho)

Tudo que aparece em mais de uma tela vira componente reaproveitável. Estrutura:

```
components/
  ui/          primitivos shadcn — gerados pela CLI, estilizados por token, edição mínima
  patterns/    composições reutilizáveis entre domínios — não conhecem regra de negócio
  shell/       sidebar, header, breadcrumb, command palette, menu do usuário
  <dominio>/   views de cada domínio — agents, clinic-profile, conversations, patients,
               schedule, sequences, templates, team, billing, account, admin
  marketing/   componentes da landing, hoje soltos na raiz de components/
               (só mover e ajustar import — nenhuma mudança de conteúdo)
```

**Regras:**

- **Direção da dependência:** `ui` ← `patterns` ← `<dominio>` ← `app/`. Nunca o contrário. `ui` e `patterns` não sabem o que é agente, paciente ou template.
- **Componentes de domínio não buscam dado.** Recebem props tipadas, com o tipo declarado ao lado do componente. A página em `app/` (server component) chama a função de `lib/` que já existe e passa o resultado adiante. É isso que deixa o mesmo componente servir ao protótipo agora, com dado fictício, e à tela real depois.
- **Status:** `patterns/status-badge` recebe um `tone` e um rótulo. Cada domínio tem o próprio mapa de status para tom, na própria pasta. Reaproveite os rótulos que já existem em `lib/` (ex.: `ROTULO_DO_STATUS` em `lib/agent-config/schema`, `ROTULO_DO_PAPEL` em `lib/navigation/landing`). Não duplique texto.
- **Variantes via `cva`.** Nenhuma string de classe repetida entre arquivos, e nenhum `bg-[var(--x)]`: use os utilitários do tema (`bg-surface-1`, `text-ink-2`, `border-hairline`, `text-brand`).
- **Substituições.** `settings/ui.tsx` e `agents/ui.tsx` somem, trocados por `patterns/`. `components/ui/button.tsx`, `card.tsx`, `select.tsx` e `slider.tsx` são trocados pelas versões novas **sem mudar a aparência da landing**, que também os usa (hero, final-cta, problem, calculatorROI). Se a landing depender de algo que a versão nova não tem, preserve como variante.

**Primitivos (`ui/`), instale e estilize:** button, input, textarea, label, select, checkbox, switch, radio-group, form, card, badge, table, tabs, dialog, alert-dialog, sheet, drawer, dropdown-menu, popover, tooltip, command, sidebar, breadcrumb, avatar, separator, skeleton, sonner, alert, progress, scroll-area, chart, calendar, pagination, toggle-group, hover-card.

**Padrões (`patterns/`), no mínimo:**

- **Estrutura de página:**
  - `PageHeader`: título, descrição, ações, slot de breadcrumb e de status.
  - `SettingsSection`: título e descrição à esquerda, conteúdo à direita.
  - `SettingsLayout`: subnavegação vertical, com a seção ativa na query string.
- **Formulário:**
  - `FormField`: rótulo, dica, erro, obrigatório.
  - `SubmitBar`: barra de salvar fixa quando há alteração, com estado pendente e toast de sucesso.
  - `FormFeedback`: resultado da server action.
- **Dados:**
  - `DataTable`: ordenação, filtro, paginação, densidade, ações por linha, seleção e estado vazio embutido.
  - `FilterBar`, `SearchInput` e `KeyValueList` (tela de detalhe).
  - `CopyField`: ids técnicos como `phone_number_id`.
- **Status e métricas:**
  - `StatusBadge`, `StatusDot`, `KpiCard` (com tendência e com estado "em breve").
  - `UsageMeter`: consumo contra o limite do plano, com tom que muda perto do limite.
  - `Funnel` e `Timeline`/`ActivityFeed`.
- **Estados:**
  - `EmptyState`: ilustração leve, próximo passo e CTA.
  - `ErrorState` e skeletons por layout (lista, tabela, formulário, detalhe).
  - `ComingSoon`.
- **Confirmação:**
  - `ConfirmDialog`, com variante "digite para confirmar" para ações destrutivas.
  - `JustificationDialog`: motivo obrigatório antes de uma ação auditada.
- **Conversa:**
  - `ChatBubble`: paciente à esquerda; clínica à direita, marcando se quem respondeu foi a IA ou um humano.
  - `ChatThread` e `ChatComposer`.
  - `EventCard`: evento automatizado (agendamento confirmado, lembrete enviado, CRM atualizado), curto e com ícone, nunca texto corrido.
  - `WhatsAppPreview`: mensagem ou template renderizado como no celular.
- **Fluxo:** `Stepper`/`StepList` (passos de sequência e checklist de onboarding) e `PlanCard`.

## Telas

### A. Existentes: refazer com dado real

As páginas já buscam dado de `lib/`. Mantenha isso e troque só a apresentação.

- **Login** (`app/(auth)/login`)
  - É aqui que aurora e vidro entram de verdade.
  - Mantenha a mensagem de erro genérica (não pode revelar se o e-mail existe) e o tratamento de redirect.
- **Visão geral** (`/dashboard`)
  - Hoje está quase vazia.
  - Não invente KPI: o que não tem fonte de dado aparece como estado vazio com próximo passo, ou "em breve". Nunca como zero disfarçado de dado (regra de `docs/specs/dashboard-overview-v1.md`).
  - O papel `professional` tem estado próprio aqui. Veja `app/(dashboard)/dashboard/page.tsx`.
- **Agentes** (`/dashboard/agents` e `/dashboard/agents/[id]`)
  - Badge de status sempre visível no topo.
  - Formulário e preview de conversa lado a lado, e em abas no celular (`.claude/skills/ui-ux/SKILL.md`).
  - O preview ainda não funciona, porque o motor de conversa não existe. Desenhe-o como mock inerte, bonito, com conversa fictícia no estilo WhatsApp e um aviso claro de que ainda não está disponível.
  - Credenciais da Meta: o token nunca é exibido de volta, e trocar credencial exige colar as três de novo. Deixe isso claro na interface.
- **Perfil da clínica** (`/dashboard/settings`)
  - Sete blocos: Clínica, Equipe, Convênios, Procedimentos, Agendamento, Urgência e Consentimento.
  - Proponha subnavegação vertical em vez das 7 abas horizontais.
  - A seção escolhida continua na query string: o link é compartilhável e salvar não volta para a primeira.
  - Urgência e Consentimento exigem confirmação explícita, e editar uma regra de urgência derruba a confirmação dela. Preserve esse comportamento e deixe-o mais visível.
  - Convênio, profissional e procedimento se **desativam**, não se apagam.
- **Clínicas** (`/admin`)
  - Tabela densa, criação de clínica e convite de responsável.
  - O convite hoje mostra a senha provisória na tela. Mantenha, mas com um tratamento de "copie agora, não será mostrada de novo".

### B. Futuras: protótipo com dado fictício

Não existe backend para estas telas ainda. Construa:

1. O componente de domínio em `components/<dominio>/`, recebendo props tipadas.
2. Uma página de protótipo em `app/(admin)/admin/design-system/telas/<tela>/page.tsx`, que alimenta o componente com dado fictício de `app/(admin)/admin/design-system/_fixtures/`.
3. Cada protótipo mostra os estados: carregando, vazio (clínica nova), com dados, erro. Quando o papel muda o que se vê, mostra também a versão de cada papel.

**Não crie** a rota real em `app/(dashboard)`. O item do menu continua "em breve" até a fase de backend ligar o dado. Assim a clínica nunca vê tela vazia nem dado falso, e a equipe revisa tudo no admin.

**Painel da clínica:**

| Tela | Rota futura | Spec | O essencial |
|---|---|---|---|
| Conversas | `/dashboard/conversations` | `conversation-engine-v1` | Lista ao vivo com status (IA / humano / aguardando), urgência em destaque, qualificado. Abrir mostra o chat com quem respondeu cada mensagem, assumir e devolver para a IA, e a janela de 24h da Meta visível |
| Agenda | `/dashboard/schedule` | `clinic-profile-v1` (política de agendamento) | Dia e semana por profissional, reagendar, cancelar, respeitando antecedência mínima e prazo de cancelamento |
| Pacientes | `/dashboard/patients` | `patient-v1` | Busca por nome e telefone, convênio, consentimento, opt-out, último contato. O detalhe mostra o histórico de contato. `professional` vê só os próprios |
| Sequências | `/dashboard/sequences` | `message-sequences-v1` | Recall, reativação e follow-up. Editor de passos (atraso em dias + template aprovado, nunca texto livre), gatilho, status, inscritos e motivo de parada |
| Templates | `/dashboard/templates` | `whatsapp-templates-v1` | Categoria, corpo com variáveis `{{1}}`, status de aprovação da Meta com motivo de rejeição, preview estilo WhatsApp |
| Equipe e acessos | `/dashboard/settings/team` | `team-access-v1` | Membros, papel (owner / staff / professional), convidar, vincular um membro a um profissional |
| Plano e cobrança | `/dashboard/billing` | `atendimento-billing-v1` | Os dois limites: atendimentos por mês (150 / 500 / 5.000) e agentes (1 / 3 / ilimitado). Consumo do mês e faturas |
| Minha conta | a definir (menu do usuário) | — | Nome, e-mail, troca de senha, aparência (tema). Deixe o lugar pronto para um seletor de clínica, para quem é membro de mais de uma |

**Painel interno (admin):**

| Tela | Rota futura | O essencial |
|---|---|---|
| Detalhe da clínica | `/admin/clinics/[id]` | Plano (com troca de plano, que hoje não existe), membros, agentes, conexão, consumo |
| Consumo | `/admin/usage` | Atendimentos por clínica contra o limite do plano. Só dado agregado |
| Conexões | `/admin/connections` | Estado do WhatsApp por clínica: conectado, `ACCOUNT_OFFBOARDED`, template rejeitado |
| Saúde | `/admin/health` | Falhas de webhook, erros do OpenRouter, cron que não rodou |
| Conversas | `/admin/clinics/[id]/conversations` | Única tela interna que lê dado de saúde. **Justificativa obrigatória antes de abrir**: bloqueio, não aviso. Deixe claro que o acesso fica registrado |
| Auditoria | `/admin/audit` | A trilha: quem, quando, qual clínica, ação, justificativa. Com filtros |

**Autenticação:** `/forgot-password`, `/reset-password` e `/accept-invite`, na mesma linguagem visual do login.

## Etapas

Trabalhe em etapas. Ao fim de cada uma, **pare**, mostre o resultado e espere minha aprovação antes de começar a próxima. Abra um PR por etapa.

- **Etapa 0: diagnóstico e direção (sem código)**
  1. O que está ruim em cada tela existente: hierarquia, densidade, consistência, navegação, celular.
  2. A direção visual, em uma página: como cada assinatura da landing entra no painel, e o que fica de fora.
  3. A árvore final de `components/`, com a lista de padrões.
  4. As mudanças de arquitetura de informação que você propõe (agrupamento do menu, subnavegação do perfil, onde fica "Minha conta"), cada uma com a justificativa. Não aplique antes de eu aprovar.
- **Etapa 1: fundação**
  - As três correções de fundação e a instalação dos primitivos.
  - Os padrões de estrutura, formulário, status e estados.
  - Mover a landing para `components/marketing/`.
  - A vitrine em `app/(admin)/admin/design-system/page.tsx`: todos os tokens e componentes, nos dois temas, em todos os estados (hover, foco, desabilitado, erro, carregando). O layout do `(admin)` já exige login da equipe. Não adicione item ao menu.
- **Etapa 2: shell**
  - Sidebar do shadcn, recolhível em modo ícone no desktop e em gaveta (`Sheet`) no celular.
  - Header com breadcrumb, nome da clínica, command palette (⌘K / Ctrl+K), troca de tema e menu do usuário: nome, papel, "Minha conta", atalho entre painéis quando existir, e "Sair" pela server action `logout`, que já existe.
  - Login e as três telas de autenticação.
- **Etapa 3: telas existentes com dado real (seção A)**
- **Etapa 4: protótipos do painel da clínica (seção B), incluindo Minha conta**
  - Inclui os padrões de conversa, métricas e fluxo.
- **Etapa 5: protótipos do painel interno (seção B)**

## Regras que não podem ser quebradas

1. **Não altere** `lib/**` (exceto `lib/utils.ts`, se o shadcn precisar), `supabase/**`, `tests/**`, `middleware.ts` nem arquivos `actions.ts`. Ali estão a regra de negócio, o isolamento entre clínicas e os testes. Se uma mudança de estrutura exigir mexer em `lib/navigation`, pare e me pergunte.
2. **Os formulários usam server actions** com `useActionState` e leem `FormData`.
   - Todo campo mantém exatamente o mesmo `name` e o mesmo formato de valor.
   - Select, Checkbox, Switch e RadioGroup do Radix só servem se enviarem o valor no `FormData` via `name`. Confirme campo a campo.
   - Não troque por react-hook-form onde isso mude o que chega na action.
3. **Supabase e erros.** Nenhum arquivo em `app/` ou `components/` importa `@supabase/*`. Nenhum `console.error`/`log`/`warn` recebe objeto de erro cru. Um teste de arquitetura quebra se isso acontecer.
4. **Dado de saúde (LGPD).** Protótipo, preview, vitrine e fixture usam só dado fictício: nada de nome, telefone ou mensagem de paciente real. Nada de dado de paciente em log.
5. **Landing** (`app/(marketing)` e os componentes dela): nenhuma mudança visual e nenhuma regressão de performance. As únicas mudanças permitidas lá são o rename `accent` → `brand` e a mudança para `components/marketing/`.
6. **Menu e permissão.** O que cada papel vê (`owner`, `staff`, `professional`) continua vindo de `resolveDashboardNav`/`resolveAdminNav`. Nenhum item escrito à mão no markup. O ícone de cada item vem de um mapa `href → ícone` em `components/shell`, não em `lib/`. Item "em breve" continua sem link, sem foco de teclado e nunca aceso como atual. Esconder é usabilidade, não segurança: não crie checagem de acesso no client.
7. **Texto de interface** em português do Brasil, sem jargão técnico. Quem usa é recepção e gestão de clínica.
8. **Acessibilidade:** WCAG AA nos dois temas, foco visível em tudo, navegação completa por teclado, `prefers-reduced-motion` respeitado (a landing já faz; mantenha o padrão).
9. **Celular.** O dono da clínica olha pelo celular: Visão geral, Conversas e Agenda precisam ser boas em 375px. O painel interno pode priorizar desktop, mas não pode quebrar.
10. **Git.** A base e o destino de todo PR é a branch `staging`. Nunca `main`.

## Critério de pronto de cada etapa

- `npm run build` passa. Se falhar só por falta de variável de ambiente, registre no PR em vez de contornar.
- `npx vitest run tests/architecture lib/navigation` passa. Os outros testes precisam de banco e rodam na revisão local.
- A landing não tem nenhuma diferença visual, nos dois temas, em desktop e em 375px.
- O painel foi conferido em 375px, 768px e 1440px, nos dois temas.
- A descrição do PR lista o que mudou, o que foi decidido e por quê, e o que ficou em aberto.

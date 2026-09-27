# Redesign do painel, parte 4: plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:executing-plans`, tarefa por tarefa, numa sessão nova e sem subagentes. Carregue `frontend-design` antes de desenhar cada tela, e `dataviz` antes de Consumo. Os passos usam checkbox (`- [ ]`).

## Status da execução: ✅ concluído em 2026-09-26

- **Feito:** tarefas 1 a 11, na `staging` local, sem push. Commits `545ad07` até o `docs:` que fecha a parte 4. A execução foi na mesma sessão do plano, a pedido do Jhones.
- **Testes:** 753 passando (eram 686 no fim da parte 3). `tsc` limpo e `npm run build` passando.
- **Visual:** as seis rotas novas nos dois temas, em 1440px e 390px, sem rolagem horizontal. A rota dinâmica `telas/suporte/[clinica]` foi conferida num `next start -p 3100`, porque o `next dev` devolveu o 500 "Jest worker" de novo. O `--accent` da landing continua `lab(72.8575% -47.9172 13.5998)`.

Ajustes feitos durante a execução, além do que o plano descrevia:

| Tarefa | Ajuste | Por quê |
|---|---|---|
| 2 | `ConsumoDaClinica.ciclo` é `Omit<CicloDeConsumo, "plano">` | O plano vem da clínica; uma cópia dentro do ciclo poderia divergir |
| 2 | A projeção é o trecho mais claro da própria barra; o limite vira linha só quando alguém passa dele; entrou uma legenda | O traço da projeção e a linha do limite eram duas marcas cinza iguais, sem legenda |
| 4 | `ConexoesDoPainel` tem uma lista só de agentes (nome, status, conexão, número e desde), no lugar de `conexoes` e `numeros` | O objeto vai direto para `diagnosticarConexoes`, sem duplicar os agentes |
| 4 | `desdeQuando` saiu da tela de Integrações para `components/integrations/estado.ts` | Conexões usa a mesma frase ("há 2 h", "desde 9 set") |
| 4 | Agente sem número deixa a coluna do número vazia | O selo ao lado já diz "Sem número" |
| 4 | Limite conhecido: a linha de template rejeitado usa a cor do estado da clínica, vermelha quando a clínica também tem erro | `problemas` não diz a gravidade de cada item; separar pediria mudar a regra da tarefa 3 |
| 6 | Cada bloco mostra o número com o contexto ("de 1.840 eventos na última hora"); a frase do diagnóstico fica no `title` e para o leitor de tela | O número repetia a frase logo abaixo |
| 8 | `TelaDeAcessoDeSuporte` recebe `hrefDaLista` | O link de voltar, como em Agentes |
| 8 | Contagens da Sorriso Recife derivadas das conversas (7 abertas, 1 aguardando, 1 com falha), e "aguardando" vem antes de "com a equipe" | Coerência com Conversas e com os 2 que esperam na Visão geral; paciente esperando pesa mais que quem atende |
| 8 | `Contagens` em `span` | Também entra na descrição do `PageHeader`, que já é um parágrafo |
| 8 | No celular, "Abrir conversa" fica na linha do selo | Um botão numa linha própria em cada conversa pesava |
| 10 | O alvo da conversa na trilha é um uuid | Os ids da fixture de Conversas ("c-urgente") viravam "c-urgent" ao encurtar |
| 10 | Registro sem clínica deixa a célula vazia | "Sem clínica" em toda listagem de clínicas era ruído |

**Depois do plano (2026-09-27):** a Auditoria entrou no ar com dado real, pela spec `docs/specs/admin-audit-v1.md`. `/admin/audit` saiu de "em breve"; as outras quatro telas do painel interno seguem "em breve" até o backend delas existir.

### O que a próxima sessão precisa saber

- **O redesign terminou.** Todas as telas existem como protótipo em `/admin/design-system`. Item de menu só sai de "em breve" com dado real, e sair de "em breve" é decisão do Jhones: em 2026-09-27 ele preferiu não antecipar Pacientes nem Equipe.
- **Próxima etapa: fase 3b, motor de conversa** (`docs/specs/conversation-engine-v1.md`). A spec está pronta, não há plano, e as credenciais da Meta ainda não chegaram: o webhook e o envio são construídos contra um mock. A fase 3b destrava Conversas, a Visão geral com número real, Consumo, Conexões, Saúde e Conversas de suporte.
- **O que a 3b reaproveita do redesign:**
  - `lib/whatsapp/conexao.ts` (eventos `ACCOUNT_OFFBOARDED` e `ACCOUNT_RECONNECTED`);
  - `lib/agent-config/saude.ts` (saúde do agente);
  - `lib/conversations/janela.ts` (janela de 24h);
  - `lib/admin/acesso-de-suporte.ts` (justificativa e registro de suporte);
  - as telas de `components/conversations/` e `components/admin/`.
- **Acesso de suporte na 3b:** `AcaoDeSuporte` se junta ao `AdminAction`, sem migration (a coluna `action` é texto e `metadata` é jsonb).
- **Ambiente:** o `next dev` devolve 500 ("Jest worker") nas rotas dinâmicas. Confira essas rotas num `next start -p 3100` depois do build, com `BASE=http://localhost:3100` no script de captura, e veja antes se a porta não ficou ocupada por um servidor antigo.

## Decisões do Jhones (2026-09-26)

| Tema | Decisão |
|---|---|
| Recorte e ordem | As cinco telas do painel interno num plano só, por dependência: Consumo, Conexões, Saúde, Conversas de suporte e Auditoria. As duas últimas ficam juntas no fim, porque a Auditoria mostra o registro que o acesso de suporte gera |
| O que se vê antes da justificativa | Escolher a clínica mostra só números. Para ver a lista de conversas, que tem nome de paciente, a pessoa informa o motivo uma vez, e o acesso vale 30 min. Ver a lista e cada conversa aberta viram registros separados na auditoria, com a mesma justificativa |
| Formato da justificativa | Motivo escolhido numa lista e número do chamado, obrigatórios. Sem texto livre: a trilha nunca guarda nome de paciente |

**Formato:** plano enxuto, como nas partes 2 e 3. O código completo aparece só na lógica pura e nos testes dela, que são o contrato. Cada tela é descrita por props, estrutura, estados e critério visual. O TSX é escrito uma vez só, direto no arquivo.

**Objetivo:** desenhar como protótipo as cinco telas "em breve" do painel interno, com as regras puras que o backend das fases 3b a 7 vai reaproveitar.

**Arquitetura:**
- **Regras puras** em `lib/admin/`, ao lado do `audit.ts` real, cada uma com teste. Nenhuma lê banco nem relógio: recebem `agora` e os sinais.
- **Telas** em `components/admin/`, com props tipadas; dado fictício em `_fixtures/`; rotas em `/admin/design-system/telas/*`, como nas partes 2 e 3.
- **Rota real futura de Conversas:** o item do menu (`/admin/conversations`) é a escolha da clínica, e a clínica abre em `/admin/clinics/[id]/conversations`, como a seção 3 do desenho de navegação previa. Nada disso é criado agora.
- **Acesso de suporte:** `AcaoDeSuporte` (`conversation.list` e `conversation.view`) é tipo próprio de `lib/admin/acesso-de-suporte.ts`. Na fase 3b ele se junta ao `AdminAction` de `lib/admin/audit.ts`. Até lá, nada escreve essas ações.

**Tecnologias:** Next.js 16.3 (App Router), React 19, Tailwind v4, shadcn/ui, lucide-react e Vitest (ambiente `node`, testes de componente com `renderToStaticMarkup`).

**Specs:**
- `docs/superpowers/specs/2026-09-16-navegacao-e-rotas-design.md`, seção 3 (painel interno e a proteção da tela de conversas).
- `docs/specs/atendimento-billing-v1.md` (limites de atendimento) e `docs/specs/message-sequences-v1.md` (os crons).
- `docs/design/prompt-mestre-v0.md`, seções 6, 7 e 12.
- As "Restrições globais" das partes 2 e 3 continuam valendo.

## Restrições globais

- **Das partes 1 a 3, todas continuam valendo:**
  - texto pt-BR sem caixa alta, sem `·` e sem `→` em botão;
  - cor só por token;
  - verde (`brand`) só no item ativo, no foco, em uma ação que liga algo por tela e em estado positivo;
  - raios: `control`, `xl`, `card`, `sheet` e `pill`;
  - Cal Sans só em título de página, título de destaque e número de KPI, sem `tabular-nums`.
- **Não alterar:** `supabase/**`, `middleware.ts`, `lib/auth/**`, `actions.ts`, `lib/navigation/**` e os arquivos que já existem em `lib/admin/` (`audit.ts`, `context.ts`, `mutations.ts`, `queries.ts` e `schema.ts`). Em `lib/`, só os novos e puros `lib/admin/{consumo,conexoes,saude,acesso-de-suporte,auditoria}.ts`.
- **Rotas reais:** nenhuma. Os cinco itens do `ADMIN_NAV` continuam "em breve", e item "em breve" não tem rota (`tests/architecture/rotas.test.ts`). Deixar de ser "em breve" é decisão do Jhones.
- **Dado inventado:** só em `/admin/design-system/telas/*`, com `AvisoDePrototipo`. Os testes de `tests/architecture/` só ganham regras.
- **LGPD:**
  - Consumo, Conexões, Saúde e Auditoria nunca mostram nome de paciente, telefone ou mensagem;
  - nome de paciente só aparece em Conversas de suporte, e só com acesso vigente;
  - o registro de suporte guarda só ids, o motivo e o número do chamado;
  - motivo de falha é texto nosso, por categoria, nunca a resposta crua da API.
- **Tempo determinístico:** componente não chama `new Date()`. Recebe `agora` (ISO) por prop; no protótipo, `AGORA` vem de `_fixtures/agora.ts` (segunda, 28/09/2026, 14:32). Datas só por `lib/formatters`.
- **Celular:** o desenho de navegação (seção 7) deixou a tabela do admin em 375px para "quando houver uso real". Mesmo assim, nenhuma tela nova tem rolagem horizontal em 390px: listas viram linhas empilhadas, como em Agentes.
- **Ações de escrita no protótipo:** botão desabilitado com `title="Protótipo: a ação ainda não existe"`.
- **Git:** commits pequenos na `staging`, com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sem push e sem PR.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/admin/consumo.ts` (+ teste) | Nível de consumo de uma clínica e a ordem por risco de estourar |
| `lib/admin/conexoes.ts` (+ teste) | O pior estado de conexão de uma clínica e a ordem por gravidade |
| `lib/admin/saude.ts` (+ teste) | Leitura de uma taxa de falha (webhook, IA) e de um cron |
| `lib/admin/acesso-de-suporte.ts` (+ teste) | Justificativa, acesso vigente de 30 min e o registro de auditoria |
| `lib/admin/auditoria.ts` (+ teste) | Frase de cada registro da trilha e o filtro |
| `components/admin/{tipos.ts,estado.ts}` | Tipos das telas e rótulos e tons compartilhados |
| `components/admin/{tela-de-consumo,tela-de-conexoes,tela-de-saude,tela-de-suporte,tela-de-auditoria}.tsx` (+ testes) | Telas |
| `app/(admin)/admin/design-system/_fixtures/painel-interno.ts` | Clínicas, consumo, conexões, saúde, conversas e trilha fictícios |
| `app/(admin)/admin/design-system/telas/{consumo,conexoes,saude,suporte,suporte/[clinica],auditoria}/page.tsx` | Rotas de protótipo |

## Verificação visual

Copie `docs/design/shot-referencia.mjs` para `$SCRATCH/shot/shot.mjs` e rode `npm i playwright-core@1` nessa pasta. As instruções estão no topo do script. Para rotas dinâmicas, se o `next dev` devolver 500 ("Jest worker"), rode `npm run build`, suba `npx next start -p 3100` (antes, veja se a porta não ficou ocupada) e use `BASE=http://localhost:3100`.

Para cada tela, gere `dark:1440`, `light:1440` e `dark:390` e critique cada captura com a seção 12 do prompt mestre:
- a hierarquia se entende em 5 segundos?
- a ação primária é evidente?
- há borda de mais?
- o celular parece projetado?

Confira também que não há rolagem horizontal em 390px (`ROLAGEM-H`). Antes de trocar de branch, rode `git checkout -- CLAUDE.md`.

---

### Tarefa 1: Regra de consumo

**Arquivos:**
- Criar: `lib/admin/consumo.ts` e `lib/admin/consumo.test.ts`.

**Interfaces:**
- Consome: `projetarConsumo` (`lib/billing/consumo.ts`), `LIMITE_DE_ATENDIMENTOS` (`lib/billing/plan-limits.ts`) e `ClinicPlan`.
- Produz: `CicloDeConsumo`, `NivelDeConsumo`, `AvaliacaoDeConsumo`, `LIMIAR_DE_PERTO`, `avaliarConsumo()` e `ordenarPorRisco()`.

- [x] **Passo 1: teste que falha**

```ts
import { describe, expect, it } from "vitest"
import { avaliarConsumo, ordenarPorRisco, type AvaliacaoDeConsumo, type CicloDeConsumo } from "./consumo"

const AGORA = "2026-09-28T14:32:00-03:00"
const SETEMBRO = { inicio: "2026-09-01T00:00:00-03:00", fim: "2026-10-01T00:00:00-03:00" }
const ciclo = (p: Pick<CicloDeConsumo, "plano" | "usados">, datas = SETEMBRO): CicloDeConsumo => ({ ...p, ...datas })

describe("avaliarConsumo", () => {
  it("no limite, estourou", () => {
    expect(avaliarConsumo(ciclo({ plano: "starter", usados: 150 }), AGORA)).toMatchObject({
      nivel: "estourou",
      limite: 150,
      usados: 150,
    })
  })

  it("abaixo do limite, mas o ritmo passa dele até o fim do ciclo: vai estourar", () => {
    const a = avaliarConsumo(ciclo({ plano: "starter", usados: 140 }), AGORA)
    expect(a.nivel).toBe("vai-estourar")
    expect(a.projecao).toBe(152)
  })

  it("projeção a partir de 80% do limite: perto", () => {
    const a = avaliarConsumo(ciclo({ plano: "pro", usados: 380 }), AGORA)
    expect(a.nivel).toBe("perto")
    expect(a.projecao).toBe(413)
    expect(a.fracao).toBeCloseTo(0.826)
  })

  it("com folga", () => {
    const a = avaliarConsumo(ciclo({ plano: "pro", usados: 200 }), AGORA)
    expect(a.nivel).toBe("folga")
    expect(a.projecao).toBe(217)
  })

  it("no primeiro dia não há projeção, e o nível sai só do que já foi usado", () => {
    const primeiroDia = { inicio: "2026-09-28T08:00:00-03:00", fim: "2026-10-28T08:00:00-03:00" }
    expect(avaliarConsumo(ciclo({ plano: "starter", usados: 130 }, primeiroDia), AGORA)).toMatchObject({
      nivel: "perto",
      projecao: null,
    })
    expect(avaliarConsumo(ciclo({ plano: "starter", usados: 10 }, primeiroDia), AGORA).nivel).toBe("folga")
  })
})

describe("ordenarPorRisco", () => {
  const item = (id: string, consumo: Pick<AvaliacaoDeConsumo, "nivel" | "fracao">) => ({
    id,
    consumo: { limite: 100, usados: 0, projecao: null, ...consumo },
  })

  it("quem estoura primeiro sobe; no mesmo nível, a maior fração do limite", () => {
    const ordem = ordenarPorRisco([
      item("folga", { nivel: "folga", fracao: 0.3 }),
      item("perto-alto", { nivel: "perto", fracao: 0.95 }),
      item("estourou", { nivel: "estourou", fracao: 1.02 }),
      item("perto-baixo", { nivel: "perto", fracao: 0.81 }),
      item("vai", { nivel: "vai-estourar", fracao: 1.1 }),
    ]).map((i) => i.id)
    expect(ordem).toEqual(["estourou", "vai", "perto-alto", "perto-baixo", "folga"])
  })

  it("não altera a lista recebida", () => {
    const lista = [item("a", { nivel: "folga", fracao: 0.1 }), item("b", { nivel: "estourou", fracao: 1 })]
    ordenarPorRisco(lista)
    expect(lista.map((i) => i.id)).toEqual(["a", "b"])
  })
})
```

- [x] **Passo 2:** `npx vitest run lib/admin/consumo.test.ts`. Esperado: FALHA (módulo inexistente).

- [x] **Passo 3: implementação** (`lib/admin/consumo.ts`)

```ts
import type { ClinicPlan } from "@/lib/agent-config/schema"
import { projetarConsumo } from "@/lib/billing/consumo"
import { LIMITE_DE_ATENDIMENTOS } from "@/lib/billing/plan-limits"

/** O ciclo de cobrança de uma clínica e quanto já foi usado nele. */
export type CicloDeConsumo = { plano: ClinicPlan; usados: number; inicio: string; fim: string }

export type NivelDeConsumo = "estourou" | "vai-estourar" | "perto" | "folga"

export type AvaliacaoDeConsumo = {
  nivel: NivelDeConsumo
  limite: number
  usados: number
  /** Fim do ciclo no ritmo atual. `null` no primeiro dia, quando o ritmo é ruído. */
  projecao: number | null
  /** Fração do limite usada no fim do ciclo, ou a já usada, se for maior. */
  fracao: number
}

/** O mesmo limiar do `MedidorDeUso`: a partir de 80% do limite, dá tempo de conversar sobre o plano. */
export const LIMIAR_DE_PERTO = 0.8

/**
 * Como a clínica chega ao fim do ciclo. Para a equipe Nextech, o que
 * importa é quem vai estourar antes de estourar: é quando cabe oferecer o
 * plano de cima (atendimento-billing-v1).
 */
export function avaliarConsumo(c: CicloDeConsumo, agora: string): AvaliacaoDeConsumo {
  const limite = LIMITE_DE_ATENDIMENTOS[c.plano]
  const projecao = projetarConsumo({ usados: c.usados, inicio: c.inicio, fim: c.fim, agora })
  const fracao = Math.max(c.usados, projecao ?? 0) / limite

  let nivel: NivelDeConsumo = "folga"
  if (c.usados >= limite) nivel = "estourou"
  else if (projecao !== null && projecao > limite) nivel = "vai-estourar"
  else if (fracao >= LIMIAR_DE_PERTO) nivel = "perto"

  return { nivel, limite, usados: c.usados, projecao, fracao }
}

const ORDEM: Record<NivelDeConsumo, number> = { estourou: 0, "vai-estourar": 1, perto: 2, folga: 3 }

/** Quem estoura primeiro sobe: pelo nível e, dentro dele, pela fração do limite. */
export function ordenarPorRisco<T extends { consumo: AvaliacaoDeConsumo }>(lista: readonly T[]): T[] {
  return [...lista].sort(
    (a, b) => ORDEM[a.consumo.nivel] - ORDEM[b.consumo.nivel] || b.consumo.fracao - a.consumo.fracao,
  )
}
```

- [x] **Passo 4:** `npx vitest run lib/admin/consumo.test.ts`. Esperado: PASSA.

- [x] **Passo 5: commit.** `feat(admin): nível de consumo e ordem por risco como regra pura`

---

### Tarefa 2: Consumo (protótipo)

> Carregue `frontend-design` e `dataviz` antes de desenhar.

**Arquivos:**
- Criar: `components/admin/{tipos.ts,estado.ts,tela-de-consumo.tsx}` e `components/admin/consumo.test.tsx`.
- Criar: `_fixtures/painel-interno.ts` e `telas/consumo/page.tsx`.

**Interfaces:**
- Consome: `avaliarConsumo`, `ordenarPorRisco`, `ROTULO_DO_PLANO`, `formatarNumero`, `formatarPercentual`, `formatarDataCurta` e `plural`.
- **Tipos** (`components/admin/tipos.ts`, crescem nas próximas tarefas):
  - `ClinicaDoPainel`: `{ id: string; nome: string; plano: ClinicPlan }`;
  - `ConsumoDaClinica`: `ClinicaDoPainel & { ciclo: CicloDeConsumo }`.
- **Estado** (`components/admin/estado.ts`): `TOM_DO_CONSUMO: Record<NivelDeConsumo, StatusTone>` (`estourou` → `danger`, `vai-estourar` → `warning`, `perto` → `warning`, `folga` → `neutral`) e `ROTULO_DO_CONSUMO` ("Estourou", "Vai estourar", "Perto do limite", "Com folga").
- **Tela:** `TelaDeConsumo({ clinicas: ConsumoDaClinica[], agora })`.

- [x] **Passo 1: fixture** (`_fixtures/painel-interno.ts`). Seis clínicas, todas no ciclo de 1º de setembro a 1º de outubro:

  | Clínica | Plano | Usados | Nível |
  |---|---|---|---|
  | Clínica Sorriso Recife | HealthTech | 1.180 | folga |
  | Odonto Vida Olinda | Starter | 140 | vai estourar (projeção 152) |
  | Instituto Pele Viva | Pro | 512 | estourou |
  | Movimento Fisioterapia | Pro | 380 | perto (projeção 413) |
  | Nutri Equilíbrio | Starter | 38 | folga |
  | Mente Serena Psicologia | HealthTech | 2.310 | folga |

  As tarefas 4, 6, 8 e 10 acrescentam exportações a este arquivo, sem mudar `CLINICAS`.

- [x] **Passo 2: teste de componente que falha** (`components/admin/consumo.test.tsx`):
  - a ordem na tela é estourou, vai estourar, perto e folga;
  - cada linha mostra "{usados} de {limite}" em `tabular-nums`, a projeção ("152 no fim do ciclo") e o selo;
  - sem projeção (primeiro dia), a linha diz "Projeção a partir do 2º dia";
  - o resumo do topo diz "1 estourou, 2 perto do limite" (conta `vai-estourar` e `perto` juntos), ou "Todas com folga";
  - o HTML não tem nome de paciente nem telefone (a fixture do teste não tem, e a tela não pede).

- [x] **Passo 3: tela** (`TelaDeConsumo`).
  - **`PageHeader`:** "Consumo", com a descrição "Atendimentos do ciclo contra o limite do plano. Só números agregados."
  - **Resumo:** uma frase no topo, com a contagem por nível.
  - **Lista:** uma linha por clínica, na ordem de `ordenarPorRisco`:
    - nome e plano (`ROTULO_DO_PLANO`);
    - barra do usado sobre o limite, com a marca da projeção quando houver (barra em `bg-ink-2`, que passa a `bg-warning-fg` ou `bg-danger-fg` pelo nível, como no `MedidorDeUso`; a projeção é um traço vertical, não outra cor);
    - "{usados} de {limite}", a projeção e o fim do ciclo ("fecha em 1 out");
    - selo do nível.
  - **Desktop:** colunas alinhadas (clínica | barra | números | selo). **Celular:** nome e selo na primeira linha, barra na segunda, números na terceira.
  - **Critério visual:** a barra é o único gráfico; sem legenda separada, porque os números estão escritos ao lado.

- [x] **Passo 4: rota.** `telas/consumo/page.tsx`, com o aviso "contagem de atendimentos (fase 3b) e cobrança (fase 7)".

- [x] **Passo 5:** `npx vitest run components/admin lib/admin && npx tsc --noEmit`. Esperado: PASSA.

- [x] **Passo 6: visual.** Capture nos 3 tamanhos. Critique e ajuste.

- [x] **Passo 7: commit.** `feat(admin): protótipo de consumo por clínica contra o limite do plano`

---

### Tarefa 3: Regra de conexões

**Arquivos:**
- Criar: `lib/admin/conexoes.ts` e `lib/admin/conexoes.test.ts`.

**Interfaces:**
- Consome: `EstadoDaIntegracao` (`lib/integrations/estado.ts`), `ConexaoDoWhatsapp`, `AgentStatus` e `plural`.
- Produz: `ConexoesDaClinica`, `DiagnosticoDeConexoes`, `diagnosticarConexoes()` e `ordenarPorGravidade()`.

- [x] **Passo 1: teste que falha**

```ts
import { describe, expect, it } from "vitest"
import { diagnosticarConexoes, ordenarPorGravidade, type ConexoesDaClinica } from "./conexoes"

const agente = (
  nome: string,
  conexao: ConexoesDaClinica["agentes"][number]["conexao"],
  status: ConexoesDaClinica["agentes"][number]["status"] = "active",
) => ({ nome, conexao, status })

describe("diagnosticarConexoes", () => {
  it("tudo conectado e nenhum template rejeitado", () => {
    expect(diagnosticarConexoes({ agentes: [agente("Recepção", "conectado")], templatesRejeitados: 0 })).toEqual({
      estado: "conectada",
      problemas: [],
    })
  })

  it("número desconectado pela Meta é erro, com o nome do agente", () => {
    const d = diagnosticarConexoes({
      agentes: [agente("Recepção", "conectado"), agente("Implantes", "desconectado-pela-meta", "paused")],
      templatesRejeitados: 0,
    })
    expect(d).toEqual({ estado: "erro", problemas: ["Implantes: a Meta desconectou o número."] })
  })

  it("agente ativo sem número é erro; rascunho sem número não é problema", () => {
    expect(diagnosticarConexoes({ agentes: [agente("Estética", "sem-numero")], templatesRejeitados: 0 })).toEqual({
      estado: "erro",
      problemas: ["Estética: publicado sem número."],
    })
    expect(
      diagnosticarConexoes({
        agentes: [agente("Recepção", "conectado"), agente("Ortodontia", "sem-numero", "draft")],
        templatesRejeitados: 0,
      }).estado,
    ).toBe("conectada")
  })

  it("template rejeitado pede atenção e vem depois dos erros", () => {
    expect(diagnosticarConexoes({ agentes: [agente("Recepção", "conectado")], templatesRejeitados: 2 })).toEqual({
      estado: "atencao",
      problemas: ["2 templates rejeitados pela Meta."],
    })
    expect(
      diagnosticarConexoes({ agentes: [agente("Implantes", "desconectado-pela-meta")], templatesRejeitados: 1 }).problemas,
    ).toEqual(["Implantes: a Meta desconectou o número.", "1 template rejeitado pela Meta."])
  })

  it("sem nenhum número conectado, a clínica ainda não está conectada", () => {
    expect(
      diagnosticarConexoes({ agentes: [agente("Nutrição", "sem-numero", "draft")], templatesRejeitados: 0 }),
    ).toEqual({ estado: "desconectada", problemas: [] })
    expect(diagnosticarConexoes({ agentes: [], templatesRejeitados: 0 }).estado).toBe("desconectada")
  })
})

describe("ordenarPorGravidade", () => {
  it("erro, atenção, não conectada e conectada, mantendo a ordem de quem empata", () => {
    const c = (id: string, estado: "conectada" | "atencao" | "erro" | "desconectada") => ({
      id,
      diagnostico: { estado, problemas: [] },
    })
    const ordem = ordenarPorGravidade([
      c("ok", "conectada"),
      c("nova", "desconectada"),
      c("erro-1", "erro"),
      c("aviso", "atencao"),
      c("erro-2", "erro"),
    ]).map((i) => i.id)
    expect(ordem).toEqual(["erro-1", "erro-2", "aviso", "nova", "ok"])
  })
})
```

- [x] **Passo 2:** `npx vitest run lib/admin/conexoes.test.ts`. Esperado: FALHA.

- [x] **Passo 3: implementação** (`lib/admin/conexoes.ts`)

```ts
import type { AgentStatus } from "@/lib/agent-config/schema"
import { plural } from "@/lib/formatters/texto"
import type { EstadoDaIntegracao } from "@/lib/integrations/estado"
import type { ConexaoDoWhatsapp } from "@/lib/whatsapp/conexao"

/** O que a equipe Nextech precisa saber das conexões de uma clínica com a Meta. */
export type ConexoesDaClinica = {
  agentes: readonly { nome: string; status: AgentStatus; conexao: ConexaoDoWhatsapp }[]
  templatesRejeitados: number
}

export type DiagnosticoDeConexoes = { estado: EstadoDaIntegracao; problemas: string[] }

/**
 * O pior estado da clínica, com cada problema em uma frase: primeiro o
 * que impede de atender (número desconectado, agente ativo sem número),
 * depois o que só atrapalha (template rejeitado). Rascunho sem número é
 * o caminho normal de quem ainda está configurando.
 */
export function diagnosticarConexoes(c: ConexoesDaClinica): DiagnosticoDeConexoes {
  const erros: string[] = []
  for (const a of c.agentes) {
    if (a.conexao === "desconectado-pela-meta") erros.push(`${a.nome}: a Meta desconectou o número.`)
    // O trigger de publicação exige número; ativo sem número passou por fora.
    else if (a.conexao === "sem-numero" && a.status === "active") erros.push(`${a.nome}: publicado sem número.`)
  }
  const avisos =
    c.templatesRejeitados > 0
      ? [`${plural(c.templatesRejeitados, "template rejeitado", "templates rejeitados")} pela Meta.`]
      : []

  const problemas = [...erros, ...avisos]
  if (erros.length > 0) return { estado: "erro", problemas }
  if (avisos.length > 0) return { estado: "atencao", problemas }
  const conectados = c.agentes.filter((a) => a.conexao === "conectado").length
  return { estado: conectados > 0 ? "conectada" : "desconectada", problemas }
}

/** A clínica que ainda não conectou vem antes da que está bem: é onboarding parado. */
const GRAVIDADE: Record<EstadoDaIntegracao, number> = { erro: 0, atencao: 1, desconectada: 2, conectada: 3 }

export function ordenarPorGravidade<T extends { diagnostico: DiagnosticoDeConexoes }>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) => GRAVIDADE[a.diagnostico.estado] - GRAVIDADE[b.diagnostico.estado])
}
```

- [x] **Passo 4:** `npx vitest run lib/admin/conexoes.test.ts`. Esperado: PASSA.

- [x] **Passo 5: commit.** `feat(admin): diagnóstico de conexões por clínica como regra pura`

---

### Tarefa 4: Conexões (protótipo)

> Carregue `frontend-design` antes de desenhar.

**Arquivos:**
- Criar: `components/admin/tela-de-conexoes.tsx` e `components/admin/conexoes.test.tsx`.
- Modificar: `components/admin/tipos.ts` e `_fixtures/painel-interno.ts`.
- Criar: `telas/conexoes/page.tsx`.

**Interfaces:**
- Consome: `diagnosticarConexoes`, `ordenarPorGravidade`, `TOM_DA_INTEGRACAO` e `ROTULO_DA_INTEGRACAO` (`components/integrations/estado.ts`), `ROTULO_DA_CONEXAO`, `formatarTelefone` e `tempoRelativo`.
- **Tipo:** `ConexoesDoPainel`: `ClinicaDoPainel & { conexoes: ConexoesDaClinica; numeros: { agente: string; numero: string | null; conexao: ConexaoDoWhatsapp; desde: string | null }[] }`.
- **Tela:** `TelaDeConexoes({ clinicas: ConexoesDoPainel[], agora })`.

- [x] **Passo 1: fixture.** `CONEXOES` em `_fixtures/painel-interno.ts`:
  - **Clínica Sorriso Recife:** os agentes vêm de `AGENTES` (`_fixtures/agentes.ts`), com Implantes desconectado pela Meta há 2 h. Os templates rejeitados são contados de `_fixtures/templates.ts` (`status === "rejected"`);
  - **Instituto Pele Viva:** um agente ativo sem número (erro);
  - **Movimento Fisioterapia:** tudo conectado e 2 templates rejeitados (atenção);
  - **Nutri Equilíbrio:** um rascunho sem número (não conectada);
  - as outras duas, conectadas.

- [x] **Passo 2: teste de componente que falha** (`components/admin/conexoes.test.tsx`):
  - a ordem é erro, atenção, não conectada e conectada;
  - a clínica com erro mostra "Com erro" e "Implantes: a Meta desconectou o número.";
  - cada número aparece formatado, com o estado (`ROTULO_DA_CONEXAO`) e "há 2 h" ou "desde 9 set";
  - a conectada não lista problema e diz "Todos os números conectados.";
  - a não conectada diz "Nenhum número conectado ainda.";
  - nenhuma credencial aparece (o HTML não tem `<input`).

- [x] **Passo 3: tela** (`TelaDeConexoes`).
  - **`PageHeader`:** "Conexões", com a descrição "Números do WhatsApp e templates de cada clínica com a Meta."
  - **Resumo:** "{n} com erro, {m} pedem atenção" ou "Todas conectadas".
  - **Lista:** uma linha por clínica, na ordem de `ordenarPorGravidade`:
    - nome e selo (`TOM_DA_INTEGRACAO`/`ROTULO_DA_INTEGRACAO`);
    - os problemas, um por linha, com a cor do tom só no texto;
    - os números de cada agente, compactos (agente, número e estado), em `<details>` fechado quando a clínica está conectada e aberto quando tem problema.
  - **Critério visual:** a mesma regra de Integrações. O erro chama atenção só pelo selo e pela linha do motivo, nunca pelo fundo inteiro.

- [x] **Passo 4: rota.** `telas/conexoes/page.tsx`, com o aviso "eventos da Meta (fase 3b) e templates (fase 4)".

- [x] **Passo 5:** `npx vitest run components/admin lib/admin && npx tsc --noEmit`. Esperado: PASSA.

- [x] **Passo 6: visual.** Capture nos 3 tamanhos. Critique e ajuste.

- [x] **Passo 7: commit.** `feat(admin): protótipo de conexões com a Meta por clínica`

---

### Tarefa 5: Regra de saúde da operação

**Arquivos:**
- Criar: `lib/admin/saude.ts` e `lib/admin/saude.test.ts`.

**Interfaces:**
- Consome: `formatarDuracao`, `formatarNumero`, `formatarPercentual` e `plural`.
- Produz: `NivelOperacional`, `Leitura`, `JanelaDeEventos`, `ExecucaoDeCron`, `TAXA_CRITICA`, `MINIMO_PARA_TAXA`, `lerTaxa()` e `lerCron()`.

- [x] **Passo 1: teste que falha**

```ts
import { describe, expect, it } from "vitest"
import { lerCron, lerTaxa, type ExecucaoDeCron } from "./saude"

const AGORA = "2026-09-28T14:32:00-03:00"
const MIN = 60 * 1000

describe("lerTaxa", () => {
  it("sem falha está ok, com ou sem movimento", () => {
    expect(lerTaxa({ total: 0, falhas: 0 })).toEqual({ nivel: "ok", motivo: "Nenhum evento na última hora." })
    expect(lerTaxa({ total: 1840, falhas: 0 })).toEqual({
      nivel: "ok",
      motivo: "1.840 eventos na última hora, sem falha.",
    })
  })

  it("qualquer falha pede atenção", () => {
    expect(lerTaxa({ total: 1840, falhas: 3 })).toEqual({
      nivel: "atencao",
      motivo: "3 de 1.840 eventos falharam na última hora.",
    })
    expect(lerTaxa({ total: 40, falhas: 1 }).motivo).toBe("1 de 40 eventos falhou na última hora.")
  })

  it("a partir de 5% das falhas, com movimento suficiente, é falha, e diz a taxa", () => {
    expect(lerTaxa({ total: 912, falhas: 61 })).toEqual({
      nivel: "falha",
      motivo: "61 de 912 eventos falharam na última hora (7%).",
    })
  })

  it("com pouco movimento, a taxa não diz nada: só atenção", () => {
    expect(lerTaxa({ total: 10, falhas: 5 }).nivel).toBe("atencao")
  })
})

describe("lerCron", () => {
  const cron = (p: Partial<ExecucaoDeCron>): ExecucaoDeCron => ({
    nome: "Envio de sequências",
    intervaloMs: 15 * MIN,
    ultimaExecucao: "2026-09-28T14:30:00-03:00",
    ultimoResultado: "ok",
    ...p,
  })

  it("rodou no intervalo e deu certo", () => {
    expect(lerCron(cron({}), AGORA)).toEqual({ nivel: "ok", motivo: "Rodou há 2 min." })
  })

  it("nunca rodou é falha", () => {
    expect(lerCron(cron({ ultimaExecucao: null, ultimoResultado: null }), AGORA)).toEqual({
      nivel: "falha",
      motivo: "Nunca rodou.",
    })
  })

  it("parado há mais de dois intervalos é falha, e diz o esperado", () => {
    expect(lerCron(cron({ intervaloMs: 60 * MIN, ultimaExecucao: "2026-09-28T11:00:00-03:00" }), AGORA)).toEqual({
      nivel: "falha",
      motivo: "Não roda há 3 h 32 min. Deveria rodar a cada 1 h.",
    })
  })

  it("um atraso de até dois intervalos ainda não é falha", () => {
    expect(lerCron(cron({ ultimaExecucao: "2026-09-28T14:02:00-03:00" }), AGORA).nivel).toBe("ok")
  })

  it("a última execução com erro pede atenção", () => {
    expect(lerCron(cron({ ultimaExecucao: "2026-09-28T14:31:00-03:00", ultimoResultado: "erro" }), AGORA)).toEqual({
      nivel: "atencao",
      motivo: "A última execução, há 1 min, terminou com erro.",
    })
  })
})
```

- [x] **Passo 2:** `npx vitest run lib/admin/saude.test.ts`. Esperado: FALHA.

- [x] **Passo 3: implementação** (`lib/admin/saude.ts`)

```ts
import { formatarDuracao } from "@/lib/formatters/data"
import { formatarNumero, formatarPercentual } from "@/lib/formatters/numero"
import { plural } from "@/lib/formatters/texto"

export type NivelOperacional = "ok" | "atencao" | "falha"
export type Leitura = { nivel: NivelOperacional; motivo: string }

/**
 * Eventos de uma fila na última hora: webhooks recebidos da Meta ou
 * chamadas ao OpenRouter. `falhas` nunca passa de `total`.
 */
export type JanelaDeEventos = { total: number; falhas: number }

/** Acima disto, as falhas deixam de ser pontuais: é mensagem perdida em série. */
export const TAXA_CRITICA = 0.05
/** Abaixo disto, a taxa é ruído: 1 de 2 é 50% por acaso. */
export const MINIMO_PARA_TAXA = 20

/**
 * Qualquer falha pede atenção; uma taxa alta com movimento real é falha.
 * A porcentagem só aparece na falha: em "3 de 1.840" ela arredondaria
 * para 0% e desmentiria a própria frase.
 */
export function lerTaxa(j: JanelaDeEventos): Leitura {
  if (j.falhas === 0) {
    return {
      nivel: "ok",
      motivo:
        j.total === 0
          ? "Nenhum evento na última hora."
          : `${plural(j.total, "evento", "eventos")} na última hora, sem falha.`,
    }
  }
  const taxa = j.falhas / j.total
  const critica = j.total >= MINIMO_PARA_TAXA && taxa >= TAXA_CRITICA
  const verbo = j.falhas === 1 ? "falhou" : "falharam"
  const frase = `${formatarNumero(j.falhas)} de ${plural(j.total, "evento", "eventos")} ${verbo} na última hora`
  return critica
    ? { nivel: "falha", motivo: `${frase} (${formatarPercentual(taxa)}).` }
    : { nivel: "atencao", motivo: `${frase}.` }
}

/** Um job do Vercel Cron: quanto espera entre execuções e como foi a última. */
export type ExecucaoDeCron = {
  /** Nome para pessoas: "Envio de sequências". */
  nome: string
  intervaloMs: number
  ultimaExecucao: string | null
  ultimoResultado: "ok" | "erro" | null
}

const ms = (iso: string) => new Date(iso).getTime()

/**
 * Um cron que não roda não avisa ninguém: a sequência simplesmente não
 * sai. Por isso o atraso conta mais que o erro, e dois intervalos sem
 * rodar já são falha (um atraso só pode ser a fila da Vercel).
 */
export function lerCron(c: ExecucaoDeCron, agora: string): Leitura {
  if (c.ultimaExecucao === null) return { nivel: "falha", motivo: "Nunca rodou." }
  const atraso = ms(agora) - ms(c.ultimaExecucao)
  if (atraso > 2 * c.intervaloMs) {
    return {
      nivel: "falha",
      motivo: `Não roda há ${formatarDuracao(atraso)}. Deveria rodar a cada ${formatarDuracao(c.intervaloMs)}.`,
    }
  }
  if (c.ultimoResultado === "erro") {
    return { nivel: "atencao", motivo: `A última execução, há ${formatarDuracao(atraso)}, terminou com erro.` }
  }
  return { nivel: "ok", motivo: `Rodou há ${formatarDuracao(atraso)}.` }
}
```

- [x] **Passo 4:** `npx vitest run lib/admin/saude.test.ts`. Esperado: PASSA.

- [x] **Passo 5: commit.** `feat(admin): leitura de taxa de falha e de cron como regra pura`

---

### Tarefa 6: Saúde (protótipo)

> Carregue `frontend-design` antes de desenhar.

**Arquivos:**
- Criar: `components/admin/tela-de-saude.tsx` e `components/admin/saude.test.tsx`.
- Modificar: `components/admin/{tipos.ts,estado.ts}` e `_fixtures/painel-interno.ts`.
- Criar: `telas/saude/page.tsx`.

**Interfaces:**
- Consome: `lerTaxa`, `lerCron` e `tempoRelativo`.
- **Tipo:** `SaudeDaOperacao`: `{ webhooks: JanelaDeEventos; ia: JanelaDeEventos; crons: ExecucaoDeCron[] }`.
- **Estado:** `TOM_OPERACIONAL: Record<NivelOperacional, StatusTone>` (`ok` → `success`, `atencao` → `warning`, `falha` → `danger`) e `ROTULO_OPERACIONAL` ("Normal", "Atenção", "Com falha").
- **Tela:** `TelaDeSaude({ saude: SaudeDaOperacao, agora })`.

- [x] **Passo 1: fixture.** `SAUDE` em `_fixtures/painel-interno.ts`:
  - **webhooks da Meta:** 1.840 eventos, 3 falhas (atenção);
  - **IA (OpenRouter):** 912 chamadas, 61 falhas (falha);
  - **crons** (nomes de `message-sequences-v1`): "Inscrição em sequências" a cada 15 min, rodou às 14:30 (ok); "Envio de sequências" a cada 5 min, rodou às 14:31 com erro (atenção); "Lembretes de consulta" a cada 1 h, rodou às 11:00 (falha).

- [x] **Passo 2: teste de componente que falha** (`components/admin/saude.test.tsx`):
  - a tela mostra as três áreas (WhatsApp, IA e tarefas agendadas), cada uma com selo e motivo;
  - o resumo conta webhooks, IA e cada cron, com a falha antes da atenção: "2 com falha, 2 pedem atenção";
  - cada cron mostra o nome, "a cada 15 min" e o motivo de `lerCron`;
  - com tudo ok, o resumo diz "Tudo funcionando".

- [x] **Passo 3: tela** (`TelaDeSaude`).
  - **`PageHeader`:** "Saúde", com a descrição "O que pode parar o atendimento de todas as clínicas de uma vez."
  - **Resumo:** frase com a contagem por nível, falha primeiro.
  - **Faixa de três blocos** (`lg:grid-cols-3`, dividida por `divide-x`, como o "Agora" da Visão geral): WhatsApp (webhooks da Meta), IA (OpenRouter) e tarefas agendadas. Cada bloco traz o selo, um número em Cal Sans (falhas na última hora, ou tarefas com problema) e o motivo. O selo das tarefas é o do pior cron.
  - **Lista de crons:** nome, intervalo, "rodou há X" e selo. O cron com falha sobe.
  - **Critério visual:** sem gráfico de série temporal; o dado do protótipo é uma janela só, e uma linha inventada sugeriria histórico que não existe.

- [x] **Passo 4: rota.** `telas/saude/page.tsx`, com o aviso "motor de conversa (fase 3b) e sequências (fase 4)".

- [x] **Passo 5:** `npx vitest run components/admin lib/admin && npx tsc --noEmit`. Esperado: PASSA.

- [x] **Passo 6: visual.** Capture nos 3 tamanhos. Critique e ajuste.

- [x] **Passo 7: commit.** `feat(admin): protótipo de saúde da operação com webhooks, IA e crons`

---

### Tarefa 7: Regra do acesso de suporte

**Arquivos:**
- Criar: `lib/admin/acesso-de-suporte.ts` e `lib/admin/acesso-de-suporte.test.ts`.

**Interfaces:**
- Produz: `MOTIVOS_DE_SUPORTE`, `MotivoDeSuporte`, `ROTULO_DO_MOTIVO`, `Justificativa`, `AcaoDeSuporte`, `DURACAO_DO_ACESSO_MS`, `AcessoDeSuporte`, `RegistroDeSuporte`, `validarJustificativa()`, `acessoVigente()` e `registroDeSuporte()`.

- [x] **Passo 1: teste que falha**

```ts
import { describe, expect, it } from "vitest"
import {
  acessoVigente,
  registroDeSuporte,
  validarJustificativa,
  type AcessoDeSuporte,
  type Justificativa,
} from "./acesso-de-suporte"

const AGORA = "2026-09-28T14:32:00-03:00"
const J: Justificativa = { motivo: "ia-nao-respondeu", chamado: "4821" }

describe("validarJustificativa", () => {
  it("aceita motivo da lista e chamado só com dígitos, com ou sem #", () => {
    expect(validarJustificativa({ motivo: "ia-nao-respondeu", chamado: " #4821 " })).toEqual({ ok: true, justificativa: J })
    expect(validarJustificativa({ motivo: "outro", chamado: "7" })).toEqual({
      ok: true,
      justificativa: { motivo: "outro", chamado: "7" },
    })
  })

  it("sem motivo da lista, recusa", () => {
    expect(validarJustificativa({ motivo: "", chamado: "4821" })).toEqual({ ok: false, erro: "Escolha o motivo do acesso." })
    expect(validarJustificativa({ motivo: "curiosidade", chamado: "4821" }).ok).toBe(false)
  })

  it("chamado com texto é recusado: é por ali que um nome de paciente entraria na trilha", () => {
    const erro = { ok: false, erro: "Informe o número do chamado, só com dígitos." }
    expect(validarJustificativa({ motivo: "outro", chamado: "" })).toEqual(erro)
    expect(validarJustificativa({ motivo: "outro", chamado: "Maria 4821" })).toEqual(erro)
    expect(validarJustificativa({ motivo: "outro", chamado: "12345678901" })).toEqual(erro)
  })
})

describe("acessoVigente", () => {
  const acesso = (clinicaId: string, concedidoEm: string, chamado = "4821"): AcessoDeSuporte => ({
    clinicaId,
    concedidoEm,
    justificativa: { motivo: "ia-nao-respondeu", chamado },
  })

  it("vale por 30 min a partir de quando foi concedido, e diz até quando", () => {
    expect(acessoVigente([acesso("c1", "2026-09-28T14:10:00-03:00")], "c1", AGORA)).toEqual({
      ...acesso("c1", "2026-09-28T14:10:00-03:00"),
      expiraEm: "2026-09-28T17:40:00.000Z",
    })
  })

  it("com 30 min completos, já não vale", () => {
    expect(acessoVigente([acesso("c1", "2026-09-28T14:02:00-03:00")], "c1", AGORA)).toBeNull()
  })

  it("é por clínica: o acesso a outra clínica não libera esta", () => {
    expect(acessoVigente([acesso("c2", "2026-09-28T14:20:00-03:00")], "c1", AGORA)).toBeNull()
  })

  it("com mais de um vigente, vale o mais recente", () => {
    const vigente = acessoVigente(
      [acesso("c1", "2026-09-28T14:05:00-03:00", "1"), acesso("c1", "2026-09-28T14:25:00-03:00", "2")],
      "c1",
      AGORA,
    )
    expect(vigente?.justificativa.chamado).toBe("2")
  })

  it("acesso com data no futuro não vale", () => {
    expect(acessoVigente([acesso("c1", "2026-09-28T15:00:00-03:00")], "c1", AGORA)).toBeNull()
  })
})

describe("registroDeSuporte", () => {
  it("ver a lista registra conversation.list, sem alvo", () => {
    expect(registroDeSuporte({ clinicaId: "c1", justificativa: J })).toEqual({
      action: "conversation.list",
      clinicId: "c1",
      metadata: { motivo: "ia-nao-respondeu", chamado: "4821" },
    })
  })

  it("abrir uma conversa registra conversation.view, com a conversa como alvo", () => {
    expect(registroDeSuporte({ clinicaId: "c1", justificativa: J, conversaId: "conv-9" })).toEqual({
      action: "conversation.view",
      clinicId: "c1",
      targetTable: "conversations",
      targetId: "conv-9",
      metadata: { motivo: "ia-nao-respondeu", chamado: "4821" },
    })
  })

  it("o metadado guarda só o motivo e o chamado", () => {
    const r = registroDeSuporte({ clinicaId: "c1", justificativa: J, conversaId: "conv-9" })
    expect(Object.keys(r.metadata).sort()).toEqual(["chamado", "motivo"])
  })
})
```

- [x] **Passo 2:** `npx vitest run lib/admin/acesso-de-suporte.test.ts`. Esperado: FALHA.

- [x] **Passo 3: implementação** (`lib/admin/acesso-de-suporte.ts`)

```ts
/**
 * Por que alguém da equipe Nextech abre conversas de uma clínica. É uma
 * lista fechada: texto livre levaria nome de paciente para a trilha de
 * auditoria (desenho de navegação, seção 3; lgpd-security).
 */
export const MOTIVOS_DE_SUPORTE = [
  "ia-nao-respondeu",
  "resposta-errada",
  "falha-de-envio",
  "pedido-da-clinica",
  "outro",
] as const

export type MotivoDeSuporte = (typeof MOTIVOS_DE_SUPORTE)[number]

export const ROTULO_DO_MOTIVO: Record<MotivoDeSuporte, string> = {
  "ia-nao-respondeu": "A IA não respondeu",
  "resposta-errada": "A IA respondeu errado",
  "falha-de-envio": "A mensagem não chegou ao paciente",
  "pedido-da-clinica": "Pedido da clínica",
  outro: "Outro motivo",
}

export type Justificativa = { motivo: MotivoDeSuporte; chamado: string }

/** Na fase 3b, estas ações se juntam ao `AdminAction` de `audit.ts`. */
export type AcaoDeSuporte = "conversation.list" | "conversation.view"

/** Tempo para investigar um chamado sem justificar de novo a cada conversa. */
export const DURACAO_DO_ACESSO_MS = 30 * 60 * 1000

/** Só dígitos, com "#" opcional: o chamado é um número, nunca uma descrição. */
const CHAMADO = /^#?\s*(\d{1,10})$/

const ehMotivo = (m: string): m is MotivoDeSuporte => (MOTIVOS_DE_SUPORTE as readonly string[]).includes(m)

/** Sem justificativa, não abre: é bloqueio, não aviso. */
export function validarJustificativa(bruto: {
  motivo: string
  chamado: string
}): { ok: true; justificativa: Justificativa } | { ok: false; erro: string } {
  if (!ehMotivo(bruto.motivo)) return { ok: false, erro: "Escolha o motivo do acesso." }
  const m = CHAMADO.exec(bruto.chamado.trim())
  if (!m) return { ok: false, erro: "Informe o número do chamado, só com dígitos." }
  return { ok: true, justificativa: { motivo: bruto.motivo, chamado: m[1] } }
}

/** Um acesso concedido: vem dos registros `conversation.list` de quem está logado. */
export type AcessoDeSuporte = { clinicaId: string; concedidoEm: string; justificativa: Justificativa }

const ms = (iso: string) => new Date(iso).getTime()

/**
 * O acesso que libera a lista de conversas desta clínica agora: o mais
 * recente com menos de 30 min. `expiraEm` sai em ISO (UTC); a tela formata.
 */
export function acessoVigente(
  acessos: readonly AcessoDeSuporte[],
  clinicaId: string,
  agora: string,
): (AcessoDeSuporte & { expiraEm: string }) | null {
  const t = ms(agora)
  const vigente = acessos
    .filter((a) => a.clinicaId === clinicaId && ms(a.concedidoEm) <= t && t - ms(a.concedidoEm) < DURACAO_DO_ACESSO_MS)
    .sort((a, b) => ms(b.concedidoEm) - ms(a.concedidoEm))[0]
  if (!vigente) return null
  return { ...vigente, expiraEm: new Date(ms(vigente.concedidoEm) + DURACAO_DO_ACESSO_MS).toISOString() }
}

/** O formato que `registrarAcao` (lib/admin/audit.ts) recebe. */
export type RegistroDeSuporte = {
  action: AcaoDeSuporte
  clinicId: string
  targetTable?: "conversations"
  targetId?: string
  metadata: { motivo: MotivoDeSuporte; chamado: string }
}

/**
 * O registro de cada acesso: ver a lista (sem alvo) ou abrir uma conversa
 * (com o id dela). Responde quem, quando, qual clínica, qual conversa e
 * por quê, e nada além disso.
 */
export function registroDeSuporte(p: {
  clinicaId: string
  justificativa: Justificativa
  conversaId?: string
}): RegistroDeSuporte {
  const metadata = { motivo: p.justificativa.motivo, chamado: p.justificativa.chamado }
  if (p.conversaId === undefined) return { action: "conversation.list", clinicId: p.clinicaId, metadata }
  return {
    action: "conversation.view",
    clinicId: p.clinicaId,
    targetTable: "conversations",
    targetId: p.conversaId,
    metadata,
  }
}
```

- [x] **Passo 4:** `npx vitest run lib/admin/acesso-de-suporte.test.ts`. Esperado: PASSA.

- [x] **Passo 5: commit.** `feat(admin): justificativa e acesso de suporte com prazo como regra pura`

---

### Tarefa 8: Conversas de suporte (protótipo)

> Carregue `frontend-design` antes de desenhar.

**Arquivos:**
- Criar: `components/admin/tela-de-suporte.tsx` e `components/admin/suporte.test.tsx`.
- Modificar: `components/admin/tipos.ts` e `_fixtures/painel-interno.ts`.
- Criar: `telas/suporte/page.tsx` e `telas/suporte/[clinica]/page.tsx`.

**Interfaces:**
- Consome: `acessoVigente`, `MOTIVOS_DE_SUPORTE`, `ROTULO_DO_MOTIVO`, `DURACAO_DO_ACESSO_MS`, `formatarHora`, `tempoRelativo` e os padrões `Campo`, `Select`, `Input` e `Botao`.
- **Tipos:**
  - `ResumoDeSuporte`: `ClinicaDoPainel & { abertas: number; aguardando: number; comFalha: number }`. Só números: é o que se vê antes da justificativa;
  - `ConversaDeSuporte`: `{ id: string; paciente: string; agente: string; estado: "ia" | "aguardando" | "humano" | "falha"; ultimaAtividade: string }`.
- **Telas:**
  - `ClinicasParaSuporte({ clinicas: ResumoDeSuporte[], hrefDaClinica })`: a escolha da clínica;
  - `TelaDeAcessoDeSuporte({ clinica: ResumoDeSuporte, acesso: (AcessoDeSuporte & { expiraEm }) | null, conversas: ConversaDeSuporte[], agora, acaoDesabilitada })`: sem acesso, o formulário; com acesso, a lista.

- [x] **Passo 1: fixture.** Em `_fixtures/painel-interno.ts`:
  - `RESUMOS_DE_SUPORTE`, para as seis clínicas (a Sorriso Recife com 12 abertas, 2 aguardando e 1 com falha);
  - `CONVERSAS_DE_SUPORTE` da Sorriso Recife: as mesmas pessoas de `_fixtures/conversas.ts`, com agente, estado e última atividade;
  - `ACESSO_DE_EXEMPLO`: concedido às 14:20 por "Marina Costa" (equipe Nextech), chamado 4821, "A IA não respondeu". Vale até 14:50.

- [x] **Passo 2: teste de componente que falha** (`components/admin/suporte.test.tsx`):
  - **escolha da clínica:** mostra as contagens e nenhum nome de paciente;
  - **sem acesso:**
    - o formulário tem o motivo (as cinco opções de `ROTULO_DO_MOTIVO`) e o número do chamado, sem campo de texto livre (`<textarea` ausente);
    - o texto explica que "ver a lista e cada conversa aberta ficam registrados na auditoria";
    - o botão "Liberar acesso por 30 min" fica desabilitado, com o `title` do protótipo;
    - nenhum nome de paciente no HTML, mesmo recebendo `conversas`;
  - **com acesso:**
    - a faixa diz "Acesso liberado até 14:50", o chamado ("#4821") e o motivo;
    - a lista traz os pacientes, com agente, estado e "há X";
    - "Abrir conversa" fica desabilitado, e o `title` diz que a abertura vira um registro na auditoria;
    - "Encerrar acesso" fica desabilitado.

- [x] **Passo 3: telas.**
  - **`ClinicasParaSuporte`:**
    - `PageHeader` "Conversas de suporte", com a descrição "Para abrir conversas de pacientes, escolha a clínica e informe o motivo. Cada acesso fica na auditoria.";
    - uma linha por clínica, como link: nome e, em `tabular-nums`, abertas, aguardando e com falha. A que tem falha sobe.
  - **`TelaDeAcessoDeSuporte` sem acesso:**
    - voltar para a lista de clínicas; nome da clínica e os mesmos números;
    - um cartão "Por que você precisa ver as conversas?" com o `Select` do motivo, o `Input` do chamado (`inputMode="numeric"`) e o botão;
    - embaixo, em `text-ink-3`: "O acesso vale 30 min. Ver a lista e cada conversa aberta ficam registrados na auditoria com este motivo e este chamado.";
    - a lista não é renderizada: sem acesso, os nomes nem chegam ao HTML.
  - **`TelaDeAcessoDeSuporte` com acesso:**
    - faixa `info` no topo: "Acesso liberado até {hora}", motivo, chamado e "Encerrar acesso";
    - a lista: paciente, agente, estado (selo) e última atividade, uma linha por conversa. A com falha e a aguardando sobem.
  - **Critério visual:** o formulário é o centro da tela sem acesso. Nada ali sugere que dá para ver as conversas sem justificar.

- [x] **Passo 4: rotas.**
  - `telas/suporte/page.tsx`: `ClinicasParaSuporte`, com o aviso "motor de conversa (fase 3b) e a trilha de acesso de suporte".
  - `telas/suporte/[clinica]/page.tsx`:
    - `params` e `searchParams` são Promise;
    - `notFound()` para clínica fora da fixture;
    - `?acesso=liberado` passa `ACESSO_DE_EXEMPLO` (só para a Sorriso Recife) por `acessoVigente` com `AGORA`; sem o parâmetro, `acesso` é `null`;
    - abaixo do aviso, um link do próprio protótipo, "Ver com o acesso liberado" ou "Ver sem acesso", que alterna o parâmetro. Ele fica na rota, não no componente.

- [x] **Passo 5:** `npx vitest run components/admin lib/admin && npx tsc --noEmit`. Esperado: PASSA.

- [x] **Passo 6: visual.** Capture a escolha da clínica e a Sorriso Recife sem e com acesso, nos 3 tamanhos. Critique e ajuste.

- [x] **Passo 7: commit.** `feat(admin): protótipo de conversas de suporte com justificativa e prazo`

---

### Tarefa 9: Regra da trilha de auditoria

**Arquivos:**
- Criar: `lib/admin/auditoria.ts` e `lib/admin/auditoria.test.ts`.

**Interfaces:**
- Consome: `AdminAction` (`lib/admin/audit.ts`, só o tipo), `AcaoDeSuporte`, `MotivoDeSuporte` e `ROTULO_DO_MOTIVO`.
- Produz: `AcaoDaTrilha`, `RegistroDaTrilha`, `DescricaoDoRegistro`, `TipoDeRegistro`, `descreverRegistro()` e `filtrarTrilha()`.

- [x] **Passo 1: teste que falha**

```ts
import { describe, expect, it } from "vitest"
import { descreverRegistro, filtrarTrilha, type RegistroDaTrilha } from "./auditoria"

const registro = (p: Partial<RegistroDaTrilha> & Pick<RegistroDaTrilha, "id" | "acao">): RegistroDaTrilha => ({
  instante: "2026-09-28T14:20:00-03:00",
  autor: "Marina Costa",
  clinica: "Clínica Sorriso Recife",
  alvo: null,
  metadata: {},
  ...p,
})

describe("descreverRegistro", () => {
  it("descreve as ações de clínica sem artigo antes do nome, que varia", () => {
    expect(descreverRegistro(registro({ id: "1", acao: "clinic.list", clinica: null }))).toEqual({
      acao: "Abriu a lista de clínicas",
      suporte: false,
    })
    expect(descreverRegistro(registro({ id: "2", acao: "clinic.create" })).acao).toBe("Criou a clínica")
    expect(descreverRegistro(registro({ id: "3", acao: "clinic.update_status", metadata: { status: "active" } })).acao).toBe(
      "Ativou a clínica",
    )
    expect(descreverRegistro(registro({ id: "4", acao: "clinic.update_status", metadata: { status: "draft" } })).acao).toBe(
      "Voltou a clínica para rascunho",
    )
  })

  it("o convite diz se a conta é nova, sem o e-mail", () => {
    expect(descreverRegistro(registro({ id: "5", acao: "member.invite", metadata: { role: "owner", usuario_novo: true } }))).toEqual({
      acao: "Convidou o responsável",
      detalhe: "Conta nova, com senha provisória.",
      suporte: false,
    })
  })

  it("o acesso de suporte traz o motivo e o chamado", () => {
    const metadata = { motivo: "ia-nao-respondeu", chamado: "4821" }
    expect(descreverRegistro(registro({ id: "6", acao: "conversation.list", metadata }))).toEqual({
      acao: "Abriu as conversas",
      detalhe: "A IA não respondeu, chamado #4821",
      suporte: true,
    })
    expect(descreverRegistro(registro({ id: "7", acao: "conversation.view", alvo: "conv-9", metadata })).acao).toBe(
      "Abriu uma conversa",
    )
  })

  it("acesso de suporte sem justificativa na trilha é anomalia, e a frase diz isso", () => {
    expect(descreverRegistro(registro({ id: "8", acao: "conversation.view" })).detalhe).toBe(
      "Sem justificativa registrada",
    )
  })
})

describe("filtrarTrilha", () => {
  const TRILHA = [
    registro({ id: "a", acao: "clinic.create", instante: "2026-09-27T10:00:00-03:00", clinica: "Nutri Equilíbrio" }),
    registro({ id: "b", acao: "conversation.list", instante: "2026-09-28T14:20:00-03:00" }),
    registro({ id: "c", acao: "conversation.view", instante: "2026-09-28T14:23:00-03:00", autor: "Rafael Nunes" }),
    registro({ id: "d", acao: "clinic.list", instante: "2026-09-28T09:00:00-03:00", clinica: null }),
  ]

  it("do mais recente para o mais antigo", () => {
    expect(filtrarTrilha(TRILHA, { tipo: "todos" }).map((r) => r.id)).toEqual(["c", "b", "d", "a"])
  })

  it("separa os acessos de suporte do resto", () => {
    expect(filtrarTrilha(TRILHA, { tipo: "suporte" }).map((r) => r.id)).toEqual(["c", "b"])
    expect(filtrarTrilha(TRILHA, { tipo: "clinicas" }).map((r) => r.id)).toEqual(["d", "a"])
  })

  it("filtra por clínica e por pessoa", () => {
    expect(filtrarTrilha(TRILHA, { tipo: "todos", clinica: "Nutri Equilíbrio" }).map((r) => r.id)).toEqual(["a"])
    expect(filtrarTrilha(TRILHA, { tipo: "todos", autor: "Rafael Nunes" }).map((r) => r.id)).toEqual(["c"])
  })
})
```

- [x] **Passo 2:** `npx vitest run lib/admin/auditoria.test.ts`. Esperado: FALHA.

- [x] **Passo 3: implementação** (`lib/admin/auditoria.ts`)

```ts
import type { AdminAction } from "./audit"
import { MOTIVOS_DE_SUPORTE, ROTULO_DO_MOTIVO, type AcaoDeSuporte, type MotivoDeSuporte } from "./acesso-de-suporte"

export type AcaoDaTrilha = AdminAction | AcaoDeSuporte

/** Um registro de `admin_audit_log`, com o autor e a clínica já resolvidos em nome. */
export type RegistroDaTrilha = {
  id: string
  instante: string
  autor: string
  acao: AcaoDaTrilha
  /** `null` quando a ação não tem clínica (listar clínicas) ou a clínica foi removida. */
  clinica: string | null
  /** O id do alvo, quando há (a conversa aberta). */
  alvo: string | null
  metadata: Record<string, string | number | boolean>
}

export type DescricaoDoRegistro = { acao: string; detalhe?: string; suporte: boolean }

const ehMotivo = (m: unknown): m is MotivoDeSuporte =>
  typeof m === "string" && (MOTIVOS_DE_SUPORTE as readonly string[]).includes(m)

function justificativa(r: RegistroDaTrilha): string {
  const { motivo, chamado } = r.metadata
  if (!ehMotivo(motivo) || typeof chamado !== "string") return "Sem justificativa registrada"
  return `${ROTULO_DO_MOTIVO[motivo]}, chamado #${chamado}`
}

/**
 * O que a pessoa fez, em uma frase sem sujeito nem clínica: a tela mostra
 * os dois em colunas próprias. Sem artigo antes do nome da clínica, que
 * pode ser "Clínica", "Instituto" ou "Consultório".
 */
export function descreverRegistro(r: RegistroDaTrilha): DescricaoDoRegistro {
  switch (r.acao) {
    case "clinic.list":
      return { acao: "Abriu a lista de clínicas", suporte: false }
    case "clinic.create":
      return { acao: "Criou a clínica", suporte: false }
    case "clinic.update_status":
      return {
        acao: r.metadata.status === "active" ? "Ativou a clínica" : "Voltou a clínica para rascunho",
        suporte: false,
      }
    case "member.invite":
      return {
        acao: "Convidou o responsável",
        detalhe: r.metadata.usuario_novo ? "Conta nova, com senha provisória." : "Pessoa que já tinha conta.",
        suporte: false,
      }
    case "conversation.list":
      return { acao: "Abriu as conversas", detalhe: justificativa(r), suporte: true }
    case "conversation.view":
      return { acao: "Abriu uma conversa", detalhe: justificativa(r), suporte: true }
  }
}

export type TipoDeRegistro = "todos" | "suporte" | "clinicas"

const ehSuporte = (a: AcaoDaTrilha) => a === "conversation.list" || a === "conversation.view"

/** A trilha do mais recente para o mais antigo, com os recortes da tela. */
export function filtrarTrilha(
  registros: readonly RegistroDaTrilha[],
  filtro: { tipo: TipoDeRegistro; clinica?: string; autor?: string },
): RegistroDaTrilha[] {
  return registros
    .filter((r) => filtro.tipo === "todos" || (filtro.tipo === "suporte") === ehSuporte(r.acao))
    .filter((r) => filtro.clinica === undefined || r.clinica === filtro.clinica)
    .filter((r) => filtro.autor === undefined || r.autor === filtro.autor)
    .sort((a, b) => new Date(b.instante).getTime() - new Date(a.instante).getTime())
}
```

- [x] **Passo 4:** `npx vitest run lib/admin/auditoria.test.ts`. Esperado: PASSA.

- [x] **Passo 5: commit.** `feat(admin): frase e filtro da trilha de auditoria como regra pura`

---

### Tarefa 10: Auditoria (protótipo)

> Carregue `frontend-design` antes de desenhar.

**Arquivos:**
- Criar: `components/admin/tela-de-auditoria.tsx` e `components/admin/auditoria.test.tsx`.
- Modificar: `_fixtures/painel-interno.ts`.
- Criar: `telas/auditoria/page.tsx`.

**Interfaces:**
- Consome: `descreverRegistro`, `filtrarTrilha`, `FiltroSegmentado`, `formatarHora`, `formatarDataCurta` e `tempoRelativo`.
- **Tela:** `TelaDeAuditoria({ registros: RegistroDaTrilha[], tipo: TipoDeRegistro, hrefDoTipo: Record<TipoDeRegistro, string>, agora })`.

- [x] **Passo 1: fixture.** `TRILHA` em `_fixtures/painel-interno.ts`, de 10 a 12 registros de 26 a 28/09 por "Marina Costa" e "Rafael Nunes":
  - o acesso de `ACESSO_DE_EXEMPLO` (`conversation.list` às 14:20) e duas conversas abertas em seguida (`conversation.view` às 14:23 e 14:27);
  - um acesso de suporte de ontem a outra clínica;
  - o resto: listar, criar, ativar clínica e convidar responsável.

- [x] **Passo 2: teste de componente que falha** (`components/admin/auditoria.test.tsx`):
  - cada registro mostra a hora, o autor, a ação (`descreverRegistro`) e a clínica;
  - o acesso de suporte traz o motivo e o chamado, e tem uma marca própria, com texto, não só cor ("Acesso a dado de paciente");
  - o filtro "Acessos de suporte" mostra só `conversation.*`;
  - o HTML não tem nome de paciente, e a conversa aberta aparece pelo id curto (os 8 primeiros caracteres), não pelo paciente;
  - sem registros no recorte: "Nenhum registro neste recorte."

- [x] **Passo 3: tela** (`TelaDeAuditoria`).
  - **`PageHeader`:** "Auditoria", com a descrição "Tudo o que a equipe Nextech fez no painel. Os registros não podem ser apagados." Ação: `FiltroSegmentado` com Todos, Acessos de suporte e Clínicas.
  - **Lista agrupada por dia** ("Hoje", "Ontem", "26 set"), cada registro numa linha: hora (`tabular-nums`), autor, ação, clínica e detalhe.
  - **Acesso de suporte:** ícone de escudo e selo `info` "Acesso a dado de paciente", com o detalhe (motivo e chamado) sempre visível.
  - **Critério visual:** a trilha lê como lista, não como `LinhaDoTempo`; com dezenas de registros por dia, os pontos e a linha vertical virariam ruído.

- [x] **Passo 4: rota.** `telas/auditoria/page.tsx`, com o aviso "acesso de suporte (fase 3b); a trilha de clínicas já existe", e `?tipo=` lido de `searchParams` (Promise).

- [x] **Passo 5:** `npx vitest run components/admin lib/admin && npx tsc --noEmit`. Esperado: PASSA.

- [x] **Passo 6: visual.** Capture Todos e Acessos de suporte nos 3 tamanhos. Critique e ajuste.

- [x] **Passo 7: commit.** `feat(admin): protótipo da trilha de auditoria com acessos de suporte`

---

### Tarefa 11: Galeria, verificação final e docs

**Arquivos:**
- Modificar: `app/(admin)/admin/design-system/page.tsx`. A lista ganha um segundo grupo, "Painel interno", com as cinco telas, cada uma com "O que mostra" e "Entra no ar com".
- Modificar: `tests/architecture/prototipos.test.ts`. O mínimo de telas sobe de 13 para 19 (é só aperto).
- Modificar: este plano, `docs/roadmap.md`, `docs/status.md` e a memória `nextech-sistema-de-design.md`.

- [x] **Passo 1: suíte inteira.** `npx vitest run`, `npx tsc --noEmit` e `npm run build`. Esperado: tudo passa.
- [x] **Passo 2: passada visual.**
  - as seis rotas de protótipo novas e a galeria;
  - `--cores /`, que precisa mostrar `--accent no escopo -> lab(72.8575% -47.9172 13.5998)`.
- [x] **Passo 3: docs.**
  - **Plano:** status "✅ concluído", com o número de testes e a tabela de ajustes.
  - **Roadmap:** seção "Redesign do painel — quarta parte", com o que entrou e as três decisões de suporte (justificativa por clínica, 30 min, motivo e chamado sem texto livre).
  - **Status:** número de testes e linha do redesign ("partes 1 a 4").
  - **Memória:** a parte 4 e a regra de que a justificativa de suporte não tem texto livre.
- [x] **Passo 4: commit.** `docs: fecha a parte 4 do redesign no plano, roadmap e status`

# Motor de conversa, parte 3 (qualificação de lead): plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:executing-plans`, tarefa por tarefa, sem subagentes. Os passos usam checkbox (`- [ ]`).

## Status da execução: ✅ concluído em 2026-09-27

- **Feito:** tarefas 1 a 4, na `staging` local, sem push.
  - `229f7f7`: pendência da sessão anterior, os achados da terceira conferência de segurança (sobre `236a928`);
  - `cb052c9`: este plano;
  - `a0314ae`, `1691e03` e `9189e93`: tarefas 1 a 3;
  - `396576a` e `1a43fe5`: lacunas da revisão de QA e o nome de um caso, pedido na conferência;
  - o `docs:` que fecha a parte.
- **Banco:** uma migration de correção, `20260927230000_confirm_stale_session_no_close.sql`, aplicada depois do `--dry-run`. O banco tem 21. A qualificação não tem migration.
- **Testes:** 1129 passando em 100 arquivos no `1a43fe5`, com o commit e a saída 0 gravados no próprio arquivo da suíte. `tsc` limpo, e `npm run build` passando no `9189e93` (depois dele, só testes mudaram).
- **Revisões:** `security-reviewer` com a conferência do `229f7f7` e a revisão da qualificação; `qa-reviewer` com revisão e conferência.

**Pendência da sessão anterior** (conferência de segurança do `236a928`):
- média: a `confirm_ai_reply` fechava a sessão vencida pelo relógio do envio, e a mensagem atrasada que chegava depois abria outro atendimento. Agora ela só não conta a resposta; quem fecha é a recepção ou o cron. Teste com a mensagem atrasada caindo na mesma sessão;
- baixa: a reserva gravada com a resposta perdida na rede passava por resposta de outra execução. A marca `reservando` fica ligada desde o pedido da reserva.

**Segurança** (sobre `229f7f7` a `9189e93`; nenhum achado):
- a conferência do `229f7f7` fechou os dois achados;
- **observação:** o `reservando` troca um alerta atrasado por um possível alerta falso (duas falhas raras ao mesmo tempo). É o lado seguro, e há teste que fixa a troca (`396576a`);
- **observação:** sem endpoint com ZDR e saída estruturada, todo pedido falha fechado. Foi para os bloqueios de go-live em `docs/status.md`: conferir o `OPENROUTER_MODEL` de produção;
- **observação:** o paciente pode induzir uma resposta longa que vira `resposta-truncada` e passa a conversa para a equipe. Antes, o texto cortado ia ao paciente. Fica na medição com tráfego real.

**QA** (sobre `9189e93`):
- bloqueante: a escrita da qualificação é do `service_role`, fora da RLS, e remover o filtro de id passava em todos os testes. Entrou um caso com a conversa vizinha da mesma clínica e a de outra clínica, conferido por mutação;
- menores: duas execuções qualificando, o erro lançado ao gravar e a troca do `reservando`, todos com caso.

### O que a próxima sessão precisa saber

- **Próxima etapa:** parte 4 da 3b, a tela real de Conversas (Realtime, assumir e devolver, desfazer urgência, alertas de urgência e de falha).
- **Contrato com o modelo:** `Dependencias.gerar` devolve `SaidaDoModelo` (`{ texto, intencaoDeAgendar }`). O preview do agente (parte 5) deve usar o mesmo `FORMATO_DA_RESPOSTA`, porque o system prompt pede o JSON.
- **Antes do go-live:** conferir o `OPENROUTER_MODEL` de produção (ZDR e saída estruturada no mesmo endpoint).

**Objetivo:** gravar `conversations.qualified_at` na primeira intenção de agendar que o modelo detectar. Com isso, a parte 3 fecha, e sai um pré-requisito do go-live.

**Arquitetura:**
- **Mesma chamada:** o modelo devolve JSON, `{ resposta, intencao_de_agendar }`, por saída estruturada do OpenRouter (`response_format` com `json_schema`).
- **Roteamento:** `provider.require_parameters: true` garante que o pedido só vá a provedor que aceita o schema. O `zdr: true` e o `data_collection: "deny"` continuam fixos.
- **Gravação:** a intenção é gravada logo depois da geração, antes da reserva, com um `update ... where qualified_at is null`.
- **Sem migration.**

**Tecnologias:** OpenRouter (saída estruturada), Zod 3.25, Supabase (PostgREST), Vitest.

**Specs:**
- `docs/specs/conversation-engine-v1.md`: comportamento 6 e "Em aberto" (detecção de qualificação);
- `docs/specs/dashboard-overview-v1.md`: o funil, que consome `qualified_at`;
- plano anterior: `docs/superpowers/plans/2026-09-27-motor-de-conversa-parte-3.md`.

## Decisões deste plano

As decisões 1 e 2 são do Jhones (2026-09-27). As demais seguem o desenho aprovado por ele na mesma data.

1. **Mesma chamada, com saída estruturada**, e não uma segunda chamada nem heurística por palavra.
   - O dado de saúde sai uma vez só.
   - O modelo decide com o histórico inteiro, e é o que a spec já descreve ("devolve essa marcação junto com a resposta").
   - **Conferido na documentação e na API pública do OpenRouter em 2026-09-27:**
     - dos 7 endpoints do `google/gemini-2.5-flash`, só os 4 do Google Vertex são ZDR, e os 4 aceitam `structured_outputs`;
     - sem `require_parameters`, um provedor que ignora `response_format` continua elegível e devolveria texto solto;
     - o rigor do `strict` varia por provedor ("alguns tratam o schema como dica forte"): a saída é validada do nosso lado.
2. **A gravação acontece logo depois da geração**, e não na reserva nem na confirmação.
   - Ela mede a intenção do paciente, não a nossa resposta, então vale mesmo que a equipe assuma durante a geração ou que o envio falhe.
   - `is null` no filtro: grava uma vez só, também com duas execuções pela mesma mensagem.
3. **A falha ao gravar não impede a resposta.** É métrica do funil: loga `{ etapa: "qualificacao", conversa, ...erroParaLog }`, e a resposta segue. O próximo sinal de intenção grava com a hora dele.
4. **JSON inválido é falha da IA repetível** (`saida-invalida`). A leitura fica dentro da retentativa, e as três falhas seguem o caminho de sempre: equipe e `ai_failed_at`, sem nada para o paciente.
5. **`finish_reason: "length"` vira `IaError("resposta-truncada", true)`, com ou sem formato.**
   - Hoje um texto cortado seria enviado.
   - O doc do OpenRouter diz que, na maioria dos provedores, o `max_tokens` soma raciocínio e saída. O raciocínio do Gemini 2.5 Flash não é configurado sem medir: vai para "Em aberto".
6. **O critério fica numa constante só** (`CRITERIO_DE_QUALIFICACAO`) e aparece em dois lugares: no system prompt e na `description` do campo.
7. **Limites registrados na spec:**
   - conversa atendida só pela equipe nunca qualifica, porque o modelo não roda nela;
   - o paciente pode "se qualificar" por injeção de prompt, e o impacto fica restrito ao funil da própria conversa.

## Fora desta parte

- **Fase 10:** o funil do painel (`dashboard-overview-v1.md`) e o relatório semanal do plano Pro, que leem `qualified_at`.
- **Parte 4:** a tela de Conversas.
- **Medir com tráfego real:**
  - a taxa de `saida-invalida` e de `resposta-truncada` no log;
  - o orçamento de raciocínio do Gemini dentro dos 600 tokens.

## Restrições globais

- **Banco:** nenhuma migration. `authenticated` só tem `select` em `conversations`, e a escrita é do `service_role`, sempre com o filtro de `clinic_id`, que vem da recepção.
- **LGPD:**
  - nenhum log com conteúdo, resposta do modelo ou dado de paciente, só `erroParaLog` e o id da conversa;
  - o `IaError` tem mensagem fixa e nunca carrega o JSON do modelo;
  - o modelo não recebe telefone nem nome.
- **OpenRouter:** o modelo vem só de `OPENROUTER_MODEL`; `data_collection: "deny"` e `zdr: true` continuam fixos; a Meta e o OpenRouter seguem contra mock.
- **Tempo nos testes de banco:** a base fica no futuro (`T0`), calculada na execução. Arquivos de banco, um de cada vez.
- **Sem tela:** nenhuma rota do painel muda, e os testes de `tests/architecture/` não mudam.
- **Git:** commits pequenos na `staging`, com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sem push e sem PR.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/agent-config/saida.ts` (+ teste) | Critério, schema e leitura da saída do modelo |
| `lib/agent-config/prompt.ts` (+ teste) | A regra do JSON no system prompt |
| `lib/ai/client.ts` (+ teste) | `formato` opcional, `require_parameters` e corte por `length` |
| `lib/conversations/resposta.ts` | `gerar` devolve `SaidaDoModelo`; `marcarQualificada` |
| `lib/conversations/dependencias.test.ts` | O caminho de produção do `gerar`, com o JSON |
| `tests/conversations/resposta.test.ts` | Qualificação de ponta a ponta, contra o banco |
| `tests/conversations/urgencia.test.ts`, `tests/whatsapp/webhook.test.ts` | O `gerar` falso no formato novo |

---

### Tarefa 1: Contrato de saída do modelo

**Arquivos:**
- Criar: `lib/agent-config/saida.ts` e `lib/agent-config/saida.test.ts`.
- Alterar: `lib/agent-config/prompt.ts` e `lib/agent-config/prompt.test.ts`.

**Interfaces:**
- Produz:
  - `CRITERIO_DE_QUALIFICACAO: string`;
  - `FORMATO_DA_RESPOSTA: { nome: string; schema: {...} }`, compatível com `FormatoDaSaida` da tarefa 2;
  - `type SaidaDoModelo = { texto: string; intencaoDeAgendar: boolean }`;
  - `lerSaidaDoModelo(conteudo: string): SaidaDoModelo`, que lança `IaError`.

**Lógica pura** (`lib/agent-config/saida.ts`):

```ts
import { z } from "zod"
import { IaError } from "@/lib/ai/client"

/**
 * O que conta como intenção de agendar (conversation-engine-v1,
 * comportamento 6). Vai no system prompt e na descrição do campo: há
 * provedor que trata o schema só como dica forte.
 */
export const CRITERIO_DE_QUALIFICACAO =
  "true se o paciente pede para marcar consulta ou pergunta sobre horário, preço, convênio ou disponibilidade; " +
  "false em qualquer outro caso, como cumprimento, dúvida sobre sintoma ou pedido para desmarcar."

/** A saída estruturada que o OpenRouter pede ao provedor (`response_format`). */
export const FORMATO_DA_RESPOSTA = {
  nome: "resposta_ao_paciente",
  schema: {
    type: "object",
    properties: {
      resposta: { type: "string", description: "A mensagem que vai ao paciente, pronta para o WhatsApp." },
      intencao_de_agendar: { type: "boolean", description: CRITERIO_DE_QUALIFICACAO },
    },
    required: ["resposta", "intencao_de_agendar"],
    additionalProperties: false,
  },
} as const

export type SaidaDoModelo = { texto: string; intencaoDeAgendar: boolean }

const Saida = z.object({ resposta: z.string(), intencao_de_agendar: z.boolean() })

/**
 * Lê o JSON do modelo. Fora do formato é falha passageira da IA
 * (`saida-invalida`): a próxima tentativa costuma vir certa. O erro nunca
 * carrega o conteúdo, que é resposta a paciente.
 */
export function lerSaidaDoModelo(conteudo: string): SaidaDoModelo {
  // Há provedor que embrulha o JSON em cerca de código.
  const semCerca = conteudo.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  let bruto: unknown
  try {
    bruto = JSON.parse(semCerca)
  } catch {
    throw new IaError("saida-invalida", true)
  }
  const lido = Saida.safeParse(bruto)
  if (!lido.success) throw new IaError("saida-invalida", true)
  const texto = lido.data.resposta.trim()
  if (!texto) throw new IaError("resposta-vazia", true)
  return { texto, intencaoDeAgendar: lido.data.intencao_de_agendar }
}
```

**Teste unitário** (`lib/agent-config/saida.test.ts`):

```ts
import { inspect } from "node:util"
import { describe, expect, it } from "vitest"
import { CRITERIO_DE_QUALIFICACAO, FORMATO_DA_RESPOSTA, lerSaidaDoModelo } from "./saida"

const erroDe = (f: () => unknown): unknown => {
  try {
    f()
  } catch (erro) {
    return erro
  }
  return null
}

describe("lerSaidaDoModelo", () => {
  it("lê a resposta e a intenção, sem espaço sobrando", () => {
    expect(lerSaidaDoModelo('{"resposta":"  Temos horário amanhã.  ","intencao_de_agendar":true}')).toEqual({
      texto: "Temos horário amanhã.",
      intencaoDeAgendar: true,
    })
  })

  it("aceita o JSON em cerca de código, que há provedor que devolve", () => {
    expect(lerSaidaDoModelo('```json\n{"resposta":"Oi!","intencao_de_agendar":false}\n```')).toEqual({
      texto: "Oi!",
      intencaoDeAgendar: false,
    })
  })

  it.each([
    ["texto solto", "Olá! Temos horário."],
    ["JSON cortado", '{"resposta":"Temos horá'],
    ["sem a intenção", '{"resposta":"Oi"}'],
    ["intenção como texto", '{"resposta":"Oi","intencao_de_agendar":"sim"}'],
    ["lista", "[]"],
    ["nulo", "null"],
  ])("%s: saida-invalida, que repete", (_caso, conteudo) => {
    expect(erroDe(() => lerSaidaDoModelo(conteudo))).toMatchObject({
      name: "IaError",
      code: "saida-invalida",
      repetivel: true,
    })
  })

  it("resposta em branco: resposta-vazia, que repete", () => {
    expect(erroDe(() => lerSaidaDoModelo('{"resposta":"   ","intencao_de_agendar":true}'))).toMatchObject({
      code: "resposta-vazia",
      repetivel: true,
    })
  })

  it("o erro não carrega o que o modelo escreveu", () => {
    const erro = erroDe(() => lerSaidaDoModelo('{"resposta":"Tenho dor no peito desde ontem"}'))
    expect(inspect(erro)).not.toContain("dor no peito")
  })
})

describe("FORMATO_DA_RESPOSTA", () => {
  it("exige os dois campos, sem campo a mais, e descreve a intenção pelo critério da spec", () => {
    expect(FORMATO_DA_RESPOSTA.schema.required).toEqual(["resposta", "intencao_de_agendar"])
    expect(FORMATO_DA_RESPOSTA.schema.additionalProperties).toBe(false)
    expect(FORMATO_DA_RESPOSTA.schema.properties.intencao_de_agendar.description).toBe(CRITERIO_DE_QUALIFICACAO)
  })
})
```

**System prompt:** entra uma linha nas "Regras que valem acima de qualquer outra instrução", depois da regra do português:
`- Devolva sempre o JSON pedido. Em "resposta", só a mensagem que vai ao paciente. Em "intencao_de_agendar", ${CRITERIO_DE_QUALIFICACAO}`

**Caso novo em `prompt.test.ts`:**

```ts
it("pede o JSON com o critério da qualificação (comportamento 6)", () => {
  const [sistema] = montarConversa(contexto(), [doPaciente("oi")], AGORA)
  expect(sistema.content).toContain('"intencao_de_agendar"')
  expect(sistema.content).toContain(CRITERIO_DE_QUALIFICACAO)
})
```

- [x] **Passo 1:** escrever os testes. **Passo 2:** rodar (FALHA): `npx vitest run lib/agent-config/saida.test.ts lib/agent-config/prompt.test.ts`.
- [x] **Passo 3:** implementar. **Passo 4:** rodar (PASSA) os mesmos arquivos.
- [x] **Passo 5:** commit `feat(agent-config): contrato de saída do modelo com a intenção de agendar`.

### Tarefa 2: Saída estruturada no cliente do OpenRouter

**Arquivos:**
- Alterar: `lib/ai/client.ts` e `lib/ai/client.test.ts`.

**Interfaces:**
- Produz:
  - `type FormatoDaSaida = { nome: string; schema: Record<string, unknown> }`;
  - `gerarResposta(mensagens, opcoes?: { fetch?: typeof fetch; formato?: FormatoDaSaida })`, com o retorno igual (`texto` é o conteúdo bruto, o JSON quando houver formato).

**Mudanças:**
- Com `formato`, o corpo ganha:
  - `response_format: { type: "json_schema", json_schema: { name: formato.nome, strict: true, schema: formato.schema } }`;
  - `provider.require_parameters: true`.
- Sem `formato`, o corpo fica exatamente como hoje.
- `CorpoDaResposta.choices[]` ganha `finish_reason?: unknown`. Se ele for `"length"`, o cliente lança `IaError("resposta-truncada", true)`. Essa conferência vem antes da de resposta vazia, porque o raciocínio que esgota o limite devolve conteúdo vazio com `length`.
- O comentário do topo explica por que o `require_parameters` só acompanha o formato: um provedor que ignora o `response_format` devolveria texto solto.

**Casos novos em `client.test.ts`:**

```ts
it("com formato: pede o JSON schema estrito, e só a provedor que aceita todos os parâmetros, sem afrouxar a política", async () => {
  const conteudo = '{"resposta":"Oi","intencao_de_agendar":false}'
  const fetch = vi.fn(async (..._args: unknown[]) =>
    json(200, { choices: [{ message: { content: conteudo }, finish_reason: "stop" }] }),
  )
  const formato = { nome: "saida_de_teste", schema: { type: "object" } }
  await expect(gerarResposta(MENSAGENS, { fetch, formato })).resolves.toMatchObject({ texto: conteudo })
  const [, init] = fetch.mock.calls[0] as unknown as Chamada
  const corpo = JSON.parse(init.body as string)
  expect(corpo.response_format).toEqual({
    type: "json_schema",
    json_schema: { name: "saida_de_teste", strict: true, schema: { type: "object" } },
  })
  expect(corpo.provider).toEqual({ data_collection: "deny", zdr: true, require_parameters: true })
})

it("resposta cortada pelo limite de tokens: resposta-truncada, que repete, e o texto cortado não sai", async () => {
  const fetch = vi.fn(async () =>
    json(200, { choices: [{ message: { content: "Temos horário amanhã às" }, finish_reason: "length" }] }),
  )
  await expect(gerarResposta(MENSAGENS, { fetch })).rejects.toMatchObject({
    name: "IaError",
    code: "resposta-truncada",
    repetivel: true,
  })
})
```

O primeiro caso do arquivo, que é sem formato, ganha `expect(corpo.response_format).toBeUndefined()`, e o `provider` continua `{ data_collection: "deny", zdr: true }`.

- [x] **Passo 1:** testes. **Passo 2:** rodar (FALHA) `npx vitest run lib/ai/client.test.ts`.
- [x] **Passo 3:** implementar. **Passo 4:** rodar (PASSA).
- [x] **Passo 5:** commit `feat(ai): saída estruturada e corte por limite de tokens no cliente do OpenRouter`.

### Tarefa 3: Qualificação na resposta

**Arquivos:**
- Alterar:
  - `lib/conversations/resposta.ts`;
  - `lib/conversations/dependencias.test.ts`;
  - `tests/conversations/resposta.test.ts`;
  - `tests/conversations/urgencia.test.ts`;
  - `tests/whatsapp/webhook.test.ts`.

**Interfaces:**
- Consome: `FORMATO_DA_RESPOSTA`, `lerSaidaDoModelo` e `SaidaDoModelo` (tarefa 1); `gerarResposta(m, { formato })` (tarefa 2).
- Produz: `Dependencias.gerar: (mensagens: MensagemDoModelo[]) => Promise<SaidaDoModelo>`.

**Mudanças em `resposta.ts`:**
- `DEPENDENCIAS_PADRAO.gerar` passa a ser `comRetentativas(async () => lerSaidaDoModelo((await gerarResposta(mensagens, { formato: FORMATO_DA_RESPOSTA })).texto), { esperas: ESPERAS_DA_IA_MS, repetivel, dormir })`. A leitura fica dentro da retentativa.
- Em `responder`, depois do `try` da geração:
  - `if (saida.intencaoDeAgendar) await marcarQualificada(supabase, clinicId, conversationId, deps.agora())`;
  - o resto usa `saida.texto`.
- **`marcarQualificada`**, função privada, ao lado de `registrarFalha`:
  - o update é `.from("conversations").update({ qualified_at: agora }).eq("id", conversationId).eq("clinic_id", clinicId).is("qualified_at", null)`;
  - erro retornado ou lançado vai para um `try/catch` que loga `{ etapa: "qualificacao", conversa: conversationId, ...erroParaLog(erro) }` e não relança.
- **Trava:** o update trava só a linha da conversa, por um instante, e não segura trava nenhuma. Não disputa ordem com a reserva (paciente, agente, conversa).

**`dependencias.test.ts`**, com dois casos novos em `DEPENDENCIAS_PADRAO.gerar`:

```ts
it("pede o formato e devolve o texto e a intenção lidos do JSON", async () => {
  const fetch = vi.fn(async (..._args: unknown[]) =>
    json(200, { choices: [{ message: { content: '{"resposta":"Temos horário.","intencao_de_agendar":true}' }, finish_reason: "stop" }] }),
  )
  vi.stubGlobal("fetch", fetch)
  await expect(DEPENDENCIAS_PADRAO.gerar([{ role: "user", content: "tem horário?" }])).resolves.toEqual({
    texto: "Temos horário.",
    intencaoDeAgendar: true,
  })
  const corpo = JSON.parse((fetch.mock.calls[0][1] as RequestInit).body as string)
  expect(corpo.response_format.json_schema.name).toBe("resposta_ao_paciente")
  expect(corpo.provider).toMatchObject({ data_collection: "deny", zdr: true, require_parameters: true })
})

it("JSON fora do formato: três tentativas, com 1 s e 4 s de espera, e desiste com saida-invalida", async () => {
  const fetch = vi.fn(async () => json(200, { choices: [{ message: { content: "Olá! Temos horário." }, finish_reason: "stop" }] }))
  vi.stubGlobal("fetch", fetch)
  const relogio = vi.spyOn(globalThis, "setTimeout")

  const resultado = DEPENDENCIAS_PADRAO.gerar([{ role: "user", content: "oi" }]).catch((e: unknown) => e)
  await vi.runAllTimersAsync()

  expect(await resultado).toMatchObject({ name: "IaError", code: "saida-invalida" })
  expect(fetch).toHaveBeenCalledTimes(3)
  expect(esperasPedidas(relogio)).toEqual([1000, 4000])
})
```

**Fixtures:** todo `gerar` falso que devolve texto passa a devolver `{ texto, intencaoDeAgendar: false }`:
- em `resposta.test.ts`: o padrão do `dependencias()`, o `gerandoEnquanto` e o "TEXTO QUE NÃO CHEGOU";
- em `urgencia.test.ts`: as linhas 113 e 276;
- em `webhook.test.ts`: a linha 785.

**Simulação da falha** (`resposta.test.ts`):
- `const falhaDaQualificacao = vi.hoisted(() => ({ ativa: false }))`.
- No mock do `serviceContext`, o `from` é embrulhado. Para `"conversations"` com a marca ativa, o `update` do construtor devolvido é trocado por uma cadeia `{ eq: () => cadeia, is: () => Promise.resolve({ data: null, error: { code: "08006", message: "simulado", details: null, hint: null } }) }`. A marca é desligada no primeiro uso, e o `select` continua real.

**Casos de banco** (`resposta.test.ts`, describe novo "qualificação (conversation-engine-v1, comportamento 6)"):

```ts
describe("qualificação (conversation-engine-v1, comportamento 6)", () => {
  const comIntencao = (intencaoDeAgendar: boolean) =>
    vi.fn(async (_mensagens: MensagemDoModelo[]) => ({ texto: RESPOSTA, intencaoDeAgendar }))
  const qualificadaEm = async (id: string) => {
    const { qualified_at } = await conversa(id)
    return qualified_at === null ? null : Date.parse(qualified_at)
  }

  it("a intenção de agendar grava qualified_at na hora da detecção, uma vez só", async () => {
    const waId = novoWaId()
    const r1 = await receber(waId, T0, "Quanto custa a consulta?")
    expect(await responderConversa(r1, dependencias({ agora: T0 + 15, gerar: comIntencao(true) }))).toBe("respondida")
    expect(await qualificadaEm(r1.conversationId)).toBe((T0 + 15) * 1000)

    // Outra intenção depois não muda a data: o funil mede conversão, não recorrência.
    const r2 = await receber(waId, T0 + 120, "Tem horário amanhã?")
    expect(await responderConversa(r2, dependencias({ agora: T0 + 135, gerar: comIntencao(true) }))).toBe("respondida")
    expect(await qualificadaEm(r2.conversationId)).toBe((T0 + 15) * 1000)
  })

  it("sem intenção, qualified_at fica nulo", async () => {
    const r = await receber(novoWaId(), T0, "Bom dia")
    expect(await responderConversa(r, dependencias({ agora: T0 + 15, gerar: comIntencao(false) }))).toBe("respondida")
    expect(await qualificadaEm(r.conversationId)).toBeNull()
  })

  it("vale mesmo quando a reserva recusa: a intenção é do paciente, não da nossa resposta", async () => {
    const waId = novoWaId()
    const r = await receber(waId, T0, "Qual o valor da limpeza?")
    const gerar = vi.fn(async (_mensagens: MensagemDoModelo[]) => {
      await eco(waId, T0 + 12, "Oi, aqui é da recepção")
      return { texto: RESPOSTA, intencaoDeAgendar: true }
    })
    const deps = dependencias({ agora: T0 + 15, gerar })
    expect(await responderConversa(r, deps)).toBe("humano-atendendo")
    expect(deps.enviar).not.toHaveBeenCalled()
    expect(await qualificadaEm(r.conversationId)).toBe((T0 + 15) * 1000)
  })

  it("a falha ao gravar não impede a resposta, e o log só tem o código", async () => {
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {})
    const r = await receber(novoWaId(), T0, "Aceitam o meu convênio?")
    falhaDaQualificacao.ativa = true
    try {
      expect(await responderConversa(r, dependencias({ agora: T0 + 15, gerar: comIntencao(true) }))).toBe("respondida")
      expect(espiao).toHaveBeenCalledWith("[whatsapp-webhook]", {
        etapa: "qualificacao",
        conversa: r.conversationId,
        tipo: "postgrest",
        codigo: "08006",
      })
      for (const chamada of espiao.mock.calls) expect(logPermitido(chamada)).toBe(true)
    } finally {
      espiao.mockRestore()
      falhaDaQualificacao.ativa = false
    }
    const c = await conversa(r.conversationId)
    expect(c.qualified_at).toBeNull()
    expect(c.handled_by).toBe("ai")
  })
})
```

- [x] **Passo 1:** testes e fixtures. **Passo 2:** rodar (FALHA): `lib/conversations/dependencias.test.ts` e depois `tests/conversations/resposta.test.ts`.
- [x] **Passo 3:** implementar. **Passo 4:** rodar (PASSA), um de cada vez:
  - `lib/conversations/dependencias.test.ts`;
  - `tests/conversations/resposta.test.ts`;
  - `tests/conversations/urgencia.test.ts`;
  - `tests/whatsapp/webhook.test.ts`.
- [x] **Passo 5:** `npx tsc --noEmit` e commit `feat(conversations): qualificação de lead pela intenção de agendar`.

### Tarefa 4: Documentação

- [x] **`conversation-engine-v1.md`:**
  - comportamento 6 com a implementação;
  - o critério de aceite marcado, com a referência dos testes;
  - "Em aberto": a detecção de qualificação sai (decidida), e entram o orçamento de raciocínio do Gemini dentro dos 600 tokens e a medição de `saida-invalida` e `resposta-truncada`;
  - a seção "Parte 3" ganha a qualificação e os dois limites (decisão 7).
- [x] **`dashboard-overview-v1.md`:** a fonte do "lead qualificado" deixa de estar em aberto e passa a ser `conversations.qualified_at`, com os limites.
- [x] **`docs/roadmap.md` e `docs/status.md`:** a parte 3 fica ✅, e a qualificação sai dos bloqueios de go-live. Atualizar também o número de testes.
- [x] **Este plano:** "Status da execução", ajustes, revisões e "O que a próxima sessão precisa saber".
- [x] **Memória:** `nextech-arquitetura-decisoes.md`, com a qualificação.
- [x] **Commit** `docs: fecha a parte 3 do motor de conversa com a qualificação`.

## Verificação final (antes da tarefa 4)

- [x] `npx vitest run` inteiro, com a saída em arquivo, o commit no topo e `echo exit=$?` no fim.
- [x] `npx tsc --noEmit` e `npm run build`.
- [x] Revisão do `qa-reviewer` e do `security-reviewer`. O `security-reviewer` também confere o `229f7f7`, as correções da terceira conferência. Tratar os achados e pedir a conferência das correções.

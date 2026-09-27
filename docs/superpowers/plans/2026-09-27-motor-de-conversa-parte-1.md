# Motor de conversa, parte 1 (dados e recepção): plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:executing-plans`, tarefa por tarefa, sem subagentes. A pedido do Jhones, a execução acontece na mesma sessão do plano. Carregue `supabase-postgres-best-practices` antes da tarefa 6. Os passos usam checkbox (`- [ ]`).

## Status da execução: ✅ concluído em 2026-09-27

- **Feito:** tarefas 1 a 8, mais a 7b (achados das revisões), na `staging` local, sem push. Os commits vão de `8f28917` (plano) até o `docs:` que fecha a parte, passando por `bd9d8be` (webhook), `a56c225`, `ffb49ca`, `9e7d8ed`, `c45e5a3`, `6487839` e `c30e3e7` (tarefa 7b).
- **Banco:** três migrations aplicadas com `supabase db push`, uma de cada vez, conferidas com `--dry-run`:
  - `20260927120000_conversation_engine.sql`;
  - `20260927130000_message_redaction.sql`;
  - `20260927140000_patient_anonymization.sql`.

  O banco tem 11 migrations.
- **Testes:** 926 passando em 81 arquivos (eram 781 antes da parte), com a saída inteira lida. `tsc` limpo e `npm run build` passando.
- **Revisões:** `security-reviewer` e `qa-reviewer`, os dois duas vezes: a revisão e a conferência das correções. Os achados e as decisões estão na tarefa 7b.
- **Env:** `MESSAGE_CONTENT_ENCRYPTION_KEY` está só no `.env` local. Na Vercel é ação do Jhones (`docs/status.md`).

Ajustes feitos durante a execução, além do que o plano descrevia:

| Tarefa | Ajuste | Por quê |
|---|---|---|
| 1 | A chave local foi gerada com `node -e "crypto.randomBytes(32)"` | Não há `openssl` no Windows do projeto; o formato é o mesmo, 32 bytes em base64 |
| 2 | O caso "recusa pedido sem challenge" monta os parâmetros sem desestruturar | Evita uma variável não usada |
| 6 | Índice `attendance_sessions_conversation_idx` em `(conversation_id)` | O índice único parcial só cobre as sessões abertas; a FK em cascata precisa das fechadas também |
| 6 | Check `(event = 'ACCOUNT_OFFBOARDED') = (agent_status_before is not null)` | É mais estrito que o plano: a desconexão sempre guarda o status anterior, e a reconexão nunca guarda |
| 6 | `force row level security` nas quatro tabelas | Mesmo padrão de `patients` |
| 6 | A função também recusa `p_wa_message_id` nulo (`22023`) | A recepção sempre tem o id da Meta; sem ele, a idempotência não existe |
| 6 | `#variable_conflict use_column` na função | As colunas de saída (`conversation_id`...) têm o mesmo nome das colunas das tabelas |
| 7 | Chamar `touchLastContact` em **toda** mensagem do paciente, inclusive no reenvio, e não só quando `inserted` | Se o `touchLastContact` falhar depois da RPC, a rota devolve 500, a Meta reenvia e o reenvio chega como duplicado. Pela regra do plano, o `last_contact_at` nunca seria gravado, e a sequência de reativação alcançaria quem acabou de escrever. Carimbar "agora" num reenvio atrasado é o erro menor |
| 7 | A clínica do teste de ponta a ponta nasce em `healthtech` | O trigger de limite de agentes recusava o segundo agente no `starter` padrão. O teste tem cinco agentes, um por cenário de conta |
| 7 | O reenvio do evento de conta também passa pela regra pura, em vez de ser pulado | Se a pausa falhasse depois do registro gravado, o reenvio nunca pausaria o agente. A regra é idempotente no reenvio: o "último" lido é o próprio evento |
| 7 | A recepção cifra antes de identificar o paciente | Sem a chave, a requisição falha sem ter criado nada pela metade |
| 8 | Registrar no `infra-setup` também `WHATSAPP_APP_SECRET` e `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | São as outras duas envs que o webhook exige na Vercel |

### O que a próxima sessão precisa saber

- **Próxima etapa:** parte 2 (decisão e resposta da IA), com o plano em `docs/superpowers/plans/2026-09-27-motor-de-conversa-parte-2.md`.
- **Bloqueio de go-live:** a conexão grava os IDs digitados. A prova de posse entra na tarefa 9 da parte 2. A recepção já recusa WABA divergente.
- **Contrato para a parte 2:**
  - `receberMensagem` devolve `ResultadoDaRecepcao`;
  - a rota tem um `try` por evento. Falha definitiva pula o evento; falha transitória, inclusive `NX010`, devolve 500;
  - a parte 2 deve pular os eventos seguintes da mesma conversa depois de uma falha transitória.
- **Teste de banco:** um login por usuário por arquivo. Um login por caso estoura o limite do Supabase Auth quando a suíte roda inteira ou em paralelo com outra.

**Objetivo:** receber o webhook da Meta (por enquanto contra um mock) e registrar o que chegou: paciente no primeiro contato, conversa, mensagem cifrada, sessão de atendimento, eco da coexistência e eventos de conta. A IA ainda não entra.

**Arquitetura:**
- **Regras puras**, cada uma com teste:
  - `lib/whatsapp/`: assinatura, leitura do payload e efeito do evento de conta;
  - `lib/conversations/conteudo.ts`: cifra do conteúdo;
  - `lib/security/erro-para-log.ts`: o que se pode logar de um erro.
- **Gravação atômica** numa função SQL (`public.register_whatsapp_message`): a mensagem, a conversa e a sessão entram numa transação só, e a unicidade do banco resolve reenvio e corrida.
- **Rota fina** em `app/api/whatsapp/webhook/route.ts`: valida, lê o payload e repassa para `lib/conversations/recepcao.ts` e `lib/whatsapp/conta.ts`.

**Tecnologias:** Next.js 16.3 (App Router, route handler), Supabase (Postgres, RLS e RPC), `node:crypto` (AES-256-GCM e HMAC-SHA256) e Vitest (ambiente `node`; os testes de banco rodam contra o banco real).

**Specs:**
- `docs/specs/conversation-engine-v1.md`: modelo de dados; comportamentos 1 (recepção) e 2 (eco); edge cases de `ACCOUNT_OFFBOARDED` e de reenvio.
- `docs/specs/atendimento-billing-v1.md`: abertura e continuidade da `AttendanceSession`.
- `docs/specs/patient-v1.md`: paciente criado no primeiro contato.
- Formato dos payloads: documentação da Meta de coexistência (`smb_message_echoes`, `account_update`), conferida em 2026-09-27.

## Decisões do Jhones (2026-09-27)

| Tema | Decisão |
|---|---|
| Recorte da 3b | Cinco partes, por dependência: (1) dados e recepção; (2) decisão e resposta da IA; (3) urgência, opt-out e qualificação; (4) tela real de Conversas; (5) preview do agente e áudio |
| Chave do conteúdo | Chave própria, `MESSAGE_CONTENT_ENCRYPTION_KEY`, separada da `TENANT_SECRETS_ENCRYPTION_KEY` |
| Mesma clínica | FK composta, com `unique (id, clinic_id)` aditivo em `agents` e `patients`, no padrão da clinic-profile |

## Decisões deste plano

1. **Grava antes do 200; a IA roda depois dele.** A spec pede 200 imediato para a Meta não reenviar por timeout, e o que demora é a IA (parte 2, com `after()`). A gravação leva milissegundos e vem antes do 200. Se ela falhar, a rota devolve 500 e a Meta reenvia, o que é inofensivo por causa da idempotência. Um 200 com gravação falha perderia a mensagem para sempre.
2. **Idempotência e corrida no banco.** `unique (clinic_id, wa_message_id)` em `messages`, `unique (agent_id, patient_id)` em `conversations` e índice único parcial de uma sessão `open` por conversa. A função SQL trata o conflito como caminho normal.
3. **Sessão fecha por inatividade também na recepção.** Se a sessão aberta está parada há mais de 20 min quando o paciente volta a escrever, a própria recepção a fecha (`closed_by_timeout`, com `closed_at` = última mensagem + 20 min) e abre outra. O cron da parte 3 só varre as sessões em que ninguém mais escreveu. Sem isso, uma mensagem que chegasse antes do cron continuaria uma sessão vencida.
4. **Eventos de conta em tabela própria** (`whatsapp_account_events`). A Meta identifica a conta pelo **WABA** (`entry.id`), e o evento vale para todos os agentes daquele WABA. A desconexão pausa quem estava atendendo e guarda o status anterior. A reconexão devolve ao ar só quem a desconexão tirou do ar. Um evento atrasado fica registrado, mas não muda o status.
5. **Tipos de mensagem:**
   - texto, botão e lista viram `text`;
   - áudio, imagem e documento guardam o tipo e, quando houver, a legenda;
   - o resto (vídeo, figurinha, localização, contato) vira `other`, sem conteúdo, para não sumir do histórico;
   - reação e status de entrega são ignorados.
6. **Conteúdo cifrado amarrado à clínica.** O `clinic_id` entra como dado autenticado (AAD) do GCM. Um blob copiado para outra clínica não decifra.
7. **Log só com metadado.** No caminho de mensagem, só se loga `erroParaLog(erro)`: tipo e código, nunca `message` nem `details`.

## Desvios da spec (atualizar as specs na tarefa 8)

- `attendance_sessions` referencia `conversation_id` (FK composta) no lugar de `agent_id` + `patient_id`. A conversa já é o par agente + paciente, e duas colunas soltas poderiam apontar para um par sem conversa.
- `messages` ganha `occurred_at` (o carimbo da Meta), além de `created_at` (o registro). A ordem da conversa segue o carimbo, e um reenvio horas depois não pode reordenar o histórico.
- `media_type` ganha `other`.

## Fora desta parte

- **Parte 2:**
  - decidir se a IA responde: retomada em 24h, janela e agente ativo;
  - agrupamento de ~10s, OpenRouter, envio, `ai_response_count`;
  - colunas de custo (`category`, `within_24h_window`, `billable`);
  - status de entrega da Meta.
- **Parte 3:** urgência, opt-out, qualificação e o cron de timeout da sessão.
- **Parte 4:** tela de Conversas, Realtime, aviso de desconexão no painel e `AcaoDeSuporte` junto do `AdminAction`.
- **Parte 5:** baixar mídia e transcrever áudio.
- **Não entram na 3b:**
  - retenção de conversa (`lgpd-security`, regra 5);
  - webhook `history` (histórico de 6 meses da coexistência);
  - número brasileiro antigo, cujo `wa_id` vem sem o nono dígito.

## Restrições globais

- **Banco:**
  - schema só por migration em `supabase/migrations/`;
  - RLS por `clinic_id` em toda tabela nova, com teste de isolamento rodado contra o banco real;
  - banco compartilhado com a landing em produção: a migration é aditiva e as tabelas da landing não são tocadas.
- **LGPD:**
  - nunca logar conteúdo, telefone, nome nem `wa_id`;
  - `content_encrypted` marcado `-- PII` na migration;
  - o conteúdo só é decifrado no servidor.
- **Integrações:**
  - HTTP client externo fica em `lib/*` (esta parte não chama a Meta: só recebe);
  - o segredo do app (`WHATSAPP_APP_SECRET`) e o token de verificação (`WHATSAPP_WEBHOOK_VERIFY_TOKEN`) são segredos de infraestrutura, lidos da env a cada requisição.
- **Mock da Meta:** os payloads de teste seguem o formato documentado (`tests/fixtures/meta-webhook.ts`) e são assinados com um segredo de teste.
- **Sem tela nesta parte:**
  - nenhuma rota do painel muda;
  - nenhum item do menu sai de "em breve";
  - os testes de `tests/architecture/` não mudam.
- **Git:** commits pequenos na `staging`, com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sem push e sem PR.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/conversations/conteudo.ts` (+ teste) | Cifra e decifra o conteúdo da mensagem, amarrado à clínica |
| `lib/whatsapp/assinatura.ts` (+ teste) | `X-Hub-Signature-256` e handshake do webhook |
| `lib/whatsapp/webhook.ts` (+ teste) | Payload da Meta → eventos (`mensagem` e `conta`) |
| `lib/whatsapp/conexao.ts` (+ teste novo) | Efeito de um evento de conta no status do agente |
| `lib/security/erro-para-log.ts` (+ teste) | O que se pode logar de um erro |
| `tests/fixtures/meta-webhook.ts` | Payloads no formato da Meta e assinatura de teste |
| `supabase/migrations/20260927120000_conversation_engine.sql` | Tabelas, RLS e `register_whatsapp_message` |
| `tests/rls/conversations.test.ts` | Isolamento entre clínicas das quatro tabelas novas |
| `lib/conversations/recepcao.ts` | Mensagem → agente → paciente → cifra → função SQL |
| `lib/whatsapp/conta.ts` | Evento de conta → agentes do WABA → registro e status |
| `app/api/whatsapp/webhook/route.ts` | GET (handshake) e POST (recepção), fina |
| `tests/whatsapp/webhook.test.ts` | Recepção de ponta a ponta contra o banco real |

---

### Tarefa 1: Cifra do conteúdo da mensagem

**Arquivos:**
- Criar: `lib/conversations/conteudo.ts` e `lib/conversations/conteudo.test.ts`.
- Alterar: `.env.example`, com `MESSAGE_CONTENT_ENCRYPTION_KEY` na seção de criptografia, e o `.env` local, com uma chave gerada por `openssl rand -base64 32` (o `.env` não é versionado).

**Interfaces:**
- Produz: `ConteudoError`, `cifrarConteudo(clinicId, texto): string` e `decifrarConteudo(clinicId, blob): string`.

- [x] **Passo 1: teste que falha**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { randomBytes } from "node:crypto"
import { cifrarConteudo, decifrarConteudo, ConteudoError } from "./conteudo"

const CLINICA_A = "11111111-1111-4111-8111-111111111111"
const CLINICA_B = "22222222-2222-4222-8222-222222222222"
const TEXTO = "Estou com dor no peito desde ontem 😟"
const TRECHO = "dor no peito"

const originais = {
  conteudo: process.env.MESSAGE_CONTENT_ENCRYPTION_KEY,
  segredos: process.env.TENANT_SECRETS_ENCRYPTION_KEY,
}

function restaurar(nome: string, valor: string | undefined) {
  if (valor === undefined) delete process.env[nome]
  else process.env[nome] = valor
}

beforeEach(() => {
  process.env.MESSAGE_CONTENT_ENCRYPTION_KEY = randomBytes(32).toString("base64")
})

afterEach(() => {
  restaurar("MESSAGE_CONTENT_ENCRYPTION_KEY", originais.conteudo)
  restaurar("TENANT_SECRETS_ENCRYPTION_KEY", originais.segredos)
})

/** Inverte um byte do blob na posição dada. */
function adulterar(blob: string, posicao: number): string {
  const bytes = Buffer.from(blob, "base64")
  bytes[posicao] ^= 0xff
  return bytes.toString("base64")
}

describe("ciclo de cifra", () => {
  it("decifra de volta o texto original, com acento e emoji", () => {
    expect(decifrarConteudo(CLINICA_A, cifrarConteudo(CLINICA_A, TEXTO))).toBe(TEXTO)
  })

  it("o blob não contém o texto puro", () => {
    const blob = cifrarConteudo(CLINICA_A, TEXTO)
    expect(blob).not.toContain(TRECHO)
    expect(Buffer.from(blob, "base64").toString("utf8")).not.toContain(TRECHO)
  })

  it("cifrar o mesmo texto duas vezes dá blobs diferentes", () => {
    expect(cifrarConteudo(CLINICA_A, TEXTO)).not.toBe(cifrarConteudo(CLINICA_A, TEXTO))
  })
})

describe("amarração à clínica", () => {
  it("o blob de uma clínica não decifra na outra", () => {
    const blob = cifrarConteudo(CLINICA_A, TEXTO)
    expect(() => decifrarConteudo(CLINICA_B, blob)).toThrow(ConteudoError)
  })

  it("recusa cifrar sem clínica", () => {
    expect(() => cifrarConteudo("", TEXTO)).toThrow(ConteudoError)
  })
})

describe("adulteração e formato", () => {
  it("recusa ciphertext alterado", () => {
    const blob = cifrarConteudo(CLINICA_A, TEXTO)
    const ultimo = Buffer.from(blob, "base64").length - 1
    expect(() => decifrarConteudo(CLINICA_A, adulterar(blob, ultimo))).toThrow(ConteudoError)
  })

  it("recusa authTag alterado", () => {
    const blob = cifrarConteudo(CLINICA_A, TEXTO)
    expect(() => decifrarConteudo(CLINICA_A, adulterar(blob, 1 + 12))).toThrow(ConteudoError)
  })

  it("recusa blob truncado", () => {
    expect(() => decifrarConteudo(CLINICA_A, "AQ==")).toThrow(ConteudoError)
  })

  it("recusa versão de formato desconhecida", () => {
    const bytes = Buffer.from(cifrarConteudo(CLINICA_A, TEXTO), "base64")
    bytes[0] = 2
    expect(() => decifrarConteudo(CLINICA_A, bytes.toString("base64"))).toThrow(/Versão/)
  })

  it("recusa conteúdo vazio", () => {
    expect(() => cifrarConteudo(CLINICA_A, "")).toThrow(ConteudoError)
  })

  it("a mensagem de erro nunca ecoa o blob nem o texto", () => {
    const blob = cifrarConteudo(CLINICA_A, TEXTO)
    let mensagem = ""
    try {
      decifrarConteudo(CLINICA_B, blob)
    } catch (erro) {
      mensagem = (erro as Error).message
    }
    expect(mensagem).not.toBe("")
    expect(mensagem).not.toContain(blob.slice(0, 16))
    expect(mensagem).not.toContain(TRECHO)
  })
})

describe("chave", () => {
  it("falha com mensagem acionável quando a chave não existe", () => {
    delete process.env.MESSAGE_CONTENT_ENCRYPTION_KEY
    expect(() => cifrarConteudo(CLINICA_A, TEXTO)).toThrow(/MESSAGE_CONTENT_ENCRYPTION_KEY ausente/)
  })

  it("falha se a chave não tem 32 bytes", () => {
    process.env.MESSAGE_CONTENT_ENCRYPTION_KEY = randomBytes(16).toString("base64")
    expect(() => cifrarConteudo(CLINICA_A, TEXTO)).toThrow(/32 bytes/)
  })

  it("não decifra com outra chave", () => {
    const blob = cifrarConteudo(CLINICA_A, TEXTO)
    process.env.MESSAGE_CONTENT_ENCRYPTION_KEY = randomBytes(32).toString("base64")
    expect(() => decifrarConteudo(CLINICA_A, blob)).toThrow(ConteudoError)
  })

  it("não cai para a chave dos segredos por tenant", () => {
    delete process.env.MESSAGE_CONTENT_ENCRYPTION_KEY
    process.env.TENANT_SECRETS_ENCRYPTION_KEY = randomBytes(32).toString("base64")
    expect(() => cifrarConteudo(CLINICA_A, TEXTO)).toThrow(/MESSAGE_CONTENT_ENCRYPTION_KEY ausente/)
  })
})
```

- [x] **Passo 2:** `npx vitest run lib/conversations/conteudo.test.ts`. Esperado: FALHA, porque o módulo não existe.

- [x] **Passo 3: implementação**

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

/**
 * Cifra do conteúdo das mensagens do WhatsApp (conversation-engine-v1,
 * `content_encrypted`). Mensagem de paciente é dado de saúde: fica cifrada
 * em repouso e só é decifrada no servidor, para mostrar na tela ou mandar
 * para a IA.
 *
 * Mesmo formato de `lib/security/tenant-secrets.ts` (AES-256-GCM,
 * `versão || IV || authTag || ciphertext` em base64), com duas diferenças:
 * - chave própria (decisão do Jhones, 2026-09-27): vazar ou rotacionar a
 *   chave dos tokens da Meta não expõe nem obriga a re-cifrar o histórico
 *   clínico, e vice-versa;
 * - o `clinic_id` entra como dado autenticado (AAD): o blob só decifra na
 *   clínica que o gravou. Copiar o conteúdo para a linha de outra clínica,
 *   mesmo com acesso de escrita ao banco, dá erro em vez de texto.
 */

const ALGORITMO = "aes-256-gcm"
const TAMANHO_IV = 12
const TAMANHO_TAG = 16
const TAMANHO_CHAVE = 32
const VERSAO = 1
const NOME_DA_CHAVE = "MESSAGE_CONTENT_ENCRYPTION_KEY"

export class ConteudoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ConteudoError"
  }
}

/** Lida a cada chamada, pelo mesmo motivo de `tenant-secrets.ts`. */
function chave(): Buffer {
  const bruta = process.env[NOME_DA_CHAVE]
  if (!bruta) {
    throw new ConteudoError(
      `${NOME_DA_CHAVE} ausente: sem ela a mensagem não pode ser guardada. ` +
        "Gere com `openssl rand -base64 32`.",
    )
  }
  const valor = Buffer.from(bruta, "base64")
  if (valor.length !== TAMANHO_CHAVE) {
    throw new ConteudoError(
      `${NOME_DA_CHAVE} precisa ter ${TAMANHO_CHAVE} bytes em base64 (tem ${valor.length}).`,
    )
  }
  return valor
}

function contexto(clinicId: string): Buffer {
  if (!clinicId) throw new ConteudoError("Conteúdo sem clínica: não há a que amarrar a cifra.")
  return Buffer.from(`clinic:${clinicId}`, "utf8")
}

export function cifrarConteudo(clinicId: string, texto: string): string {
  if (typeof texto !== "string" || texto.length === 0) {
    throw new ConteudoError("Nada a cifrar: o conteúdo está vazio.")
  }
  const aad = contexto(clinicId)
  const iv = randomBytes(TAMANHO_IV)
  const cipher = createCipheriv(ALGORITMO, chave(), iv, { authTagLength: TAMANHO_TAG })
  cipher.setAAD(aad)
  const ciphertext = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()])
  return Buffer.concat([Buffer.from([VERSAO]), iv, cipher.getAuthTag(), ciphertext]).toString(
    "base64",
  )
}

/**
 * A mensagem de erro nunca inclui o blob nem o texto: um erro de decifra
 * que ecoasse um ou outro os levaria para o log (lgpd-security, regra 1).
 */
export function decifrarConteudo(clinicId: string, blob: string): string {
  const aad = contexto(clinicId)
  const bytes = Buffer.from(blob, "base64")
  if (bytes.length < 1 + TAMANHO_IV + TAMANHO_TAG + 1) {
    throw new ConteudoError("Conteúdo em formato inválido.")
  }
  if (bytes[0] !== VERSAO) {
    throw new ConteudoError(`Versão de formato desconhecida (${bytes[0]}).`)
  }

  const iv = bytes.subarray(1, 1 + TAMANHO_IV)
  const tag = bytes.subarray(1 + TAMANHO_IV, 1 + TAMANHO_IV + TAMANHO_TAG)
  const ciphertext = bytes.subarray(1 + TAMANHO_IV + TAMANHO_TAG)

  const decipher = createDecipheriv(ALGORITMO, chave(), iv, { authTagLength: TAMANHO_TAG })
  decipher.setAAD(aad)
  decipher.setAuthTag(tag)
  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
  } catch {
    throw new ConteudoError(
      "Não foi possível decifrar o conteúdo: chave, clínica ou dado não conferem.",
    )
  }
}
```

- [x] **Passo 4:** rodar o teste de novo. Esperado: PASSA.
- [x] **Passo 5:** `.env.example`, logo abaixo de `TENANT_SECRETS_ENCRYPTION_KEY`:

```
# Chave que cifra o CONTEÚDO das mensagens do WhatsApp em repouso (dado de
# saúde). Separada da chave acima: vazar ou rotacionar uma não expõe nem
# obriga a re-cifrar a outra. Gerar com: openssl rand -base64 32
MESSAGE_CONTENT_ENCRYPTION_KEY=
```

- [x] **Passo 6:** commit `feat(conversations): cifra do conteúdo da mensagem com chave própria e amarrada à clínica`.

---

### Tarefa 2: Assinatura e handshake do webhook

**Arquivos:**
- Criar: `lib/whatsapp/assinatura.ts` e `lib/whatsapp/assinatura.test.ts`.

**Interfaces:**
- Consome: `comparacaoSegura` (`lib/security/tenant-secrets.ts`).
- Produz: `assinaturaValida(corpo, cabecalho, segredo): boolean` e `desafioDaVerificacao(params, tokenEsperado): string | null`.

- [x] **Passo 1: teste que falha**

```ts
import { describe, it, expect } from "vitest"
import { createHmac } from "node:crypto"
import { assinaturaValida, desafioDaVerificacao } from "./assinatura"

const SEGREDO = "segredo-do-app-de-teste"
const CORPO = '{"object":"whatsapp_business_account","entry":[]}'

function assinar(corpo: string, segredo = SEGREDO): string {
  return `sha256=${createHmac("sha256", segredo).update(corpo, "utf8").digest("hex")}`
}

describe("assinaturaValida", () => {
  it("aceita a assinatura do corpo exato", () => {
    expect(assinaturaValida(CORPO, assinar(CORPO), SEGREDO)).toBe(true)
  })

  it("aceita o hex em maiúsculas", () => {
    const hex = assinar(CORPO).slice("sha256=".length)
    expect(assinaturaValida(CORPO, `sha256=${hex.toUpperCase()}`, SEGREDO)).toBe(true)
  })

  it("recusa o corpo alterado, mesmo que por um espaço", () => {
    expect(assinaturaValida(CORPO.replace(":", ": "), assinar(CORPO), SEGREDO)).toBe(false)
  })

  it("recusa a assinatura feita com outro segredo", () => {
    expect(assinaturaValida(CORPO, assinar(CORPO, "outro"), SEGREDO)).toBe(false)
  })

  it("recusa cabeçalho ausente", () => {
    expect(assinaturaValida(CORPO, null, SEGREDO)).toBe(false)
  })

  it("recusa cabeçalho sem o prefixo sha256=", () => {
    expect(assinaturaValida(CORPO, assinar(CORPO).slice("sha256=".length), SEGREDO)).toBe(false)
  })

  it("recusa segredo vazio, mesmo com a assinatura calculada com ele", () => {
    expect(assinaturaValida(CORPO, assinar(CORPO, ""), "")).toBe(false)
  })
})

describe("desafioDaVerificacao", () => {
  const params = (p: Record<string, string>) => new URLSearchParams(p)
  const certo = { "hub.mode": "subscribe", "hub.verify_token": "token-certo", "hub.challenge": "1158201444" }

  it("devolve o challenge quando o token confere", () => {
    expect(desafioDaVerificacao(params(certo), "token-certo")).toBe("1158201444")
  })

  it("recusa token errado", () => {
    expect(desafioDaVerificacao(params({ ...certo, "hub.verify_token": "outro" }), "token-certo")).toBeNull()
  })

  it("recusa modo diferente de subscribe", () => {
    expect(desafioDaVerificacao(params({ ...certo, "hub.mode": "unsubscribe" }), "token-certo")).toBeNull()
  })

  it("recusa pedido sem challenge", () => {
    const { "hub.challenge": _, ...semDesafio } = certo
    expect(desafioDaVerificacao(params(semDesafio), "token-certo")).toBeNull()
  })

  it("recusa quando não há token configurado", () => {
    expect(desafioDaVerificacao(params({ ...certo, "hub.verify_token": "" }), "")).toBeNull()
  })
})
```

- [x] **Passo 2:** `npx vitest run lib/whatsapp/assinatura.test.ts`. Esperado: FALHA.
- [x] **Passo 3: implementação**

```ts
import { createHmac } from "node:crypto"
import { comparacaoSegura } from "@/lib/security/tenant-secrets"

const PREFIXO = "sha256="

/**
 * Confere o `X-Hub-Signature-256` do webhook da Meta: HMAC-SHA256 do corpo
 * CRU com o app secret do Nextech. O corpo tem de ser o texto recebido,
 * byte a byte, porque reserializar o JSON muda espaços e ordem e invalida
 * a assinatura.
 *
 * Segredo vazio nunca valida. Sem esta guarda, uma env faltando viraria
 * um HMAC de chave vazia, que qualquer um sabe calcular.
 */
export function assinaturaValida(
  corpo: string,
  cabecalho: string | null,
  segredo: string,
): boolean {
  if (!segredo || !cabecalho || !cabecalho.startsWith(PREFIXO)) return false
  const esperada = createHmac("sha256", segredo).update(corpo, "utf8").digest("hex")
  return comparacaoSegura(cabecalho.slice(PREFIXO.length).toLowerCase(), esperada)
}

/**
 * Handshake do webhook: a Meta chama GET com `hub.mode=subscribe`,
 * `hub.verify_token` e `hub.challenge`, e espera o challenge de volta.
 * Devolve o challenge só se o token conferir. `null` é recusa.
 */
export function desafioDaVerificacao(
  params: URLSearchParams,
  tokenEsperado: string,
): string | null {
  if (!tokenEsperado || params.get("hub.mode") !== "subscribe") return null
  const desafio = params.get("hub.challenge")
  const token = params.get("hub.verify_token") ?? ""
  if (!desafio || !comparacaoSegura(token, tokenEsperado)) return null
  return desafio
}
```

- [x] **Passo 4:** rodar o teste. Esperado: PASSA.
- [x] **Passo 5:** commit `feat(whatsapp): assinatura e handshake do webhook da Meta`.

---

### Tarefa 3: Leitura do payload da Meta

**Arquivos:**
- Criar: `tests/fixtures/meta-webhook.ts` (usado aqui e na tarefa 7), `lib/whatsapp/webhook.ts` e `lib/whatsapp/webhook.test.ts`.

**Interfaces:**
- Consome: `EventoDaConta` (`lib/whatsapp/conexao.ts`).
- Produz: `MidiaDaMensagem`, `MensagemDoWebhook`, `EventoDeContaDoWebhook`, `EventoDoWebhook` e `interpretarWebhook(payload: unknown): EventoDoWebhook[]`.
- As fábricas de teste produzem: `WABA_ID`, `mensagem()`, `webhookDeMensagens()`, `webhookDeEcos()`, `webhookDeConta()` e `assinar()`.

- [x] **Passo 1: fábricas no formato da Meta** (`tests/fixtures/meta-webhook.ts`)

```ts
import { createHmac } from "node:crypto"

/**
 * Mock da Meta: payloads no formato documentado da Cloud API e da
 * coexistência (campos `messages`, `smb_message_echoes` e
 * `account_update`, conferidos em 2026-09-27). Enquanto as credenciais
 * reais não chegam, é contra isto que o webhook é construído.
 */

export const WABA_ID = "102290129340398"
const NUMERO_DA_CLINICA = "558130000000"

export type MensagemBruta = { id: string; timestamp: number; type: string } & Record<string, unknown>

/** Uma mensagem de texto; `corpo` como objeto troca o tipo e o conteúdo. */
export function mensagem(
  id: string,
  timestamp: number,
  corpo: string | Record<string, unknown>,
): MensagemBruta {
  return typeof corpo === "string"
    ? { id, timestamp, type: "text", text: { body: corpo } }
    : { id, timestamp, type: "text", ...corpo }
}

function envelope(wabaId: string, field: string, value: Record<string, unknown>) {
  return { object: "whatsapp_business_account", entry: [{ id: wabaId, changes: [{ field, value }] }] }
}

function metadata(phoneNumberId: string) {
  return { display_phone_number: NUMERO_DA_CLINICA, phone_number_id: phoneNumberId }
}

/** Campo `messages`: o paciente escreveu. `nome: null` omite `contacts`. */
export function webhookDeMensagens(p: {
  phoneNumberId: string
  waId: string
  nome?: string | null
  mensagens: MensagemBruta[]
}) {
  return envelope(WABA_ID, "messages", {
    messaging_product: "whatsapp",
    metadata: metadata(p.phoneNumberId),
    contacts: p.nome === null ? [] : [{ profile: { name: p.nome ?? "Maria Souza" }, wa_id: p.waId }],
    messages: p.mensagens.map((m) => ({ from: p.waId, ...m, timestamp: String(m.timestamp) })),
  })
}

/** Campo `smb_message_echoes`: a clínica respondeu pelo app do celular. */
export function webhookDeEcos(p: { phoneNumberId: string; waId: string; ecos: MensagemBruta[] }) {
  return envelope(WABA_ID, "smb_message_echoes", {
    messaging_product: "whatsapp",
    metadata: metadata(p.phoneNumberId),
    message_echoes: p.ecos.map((m) => ({
      from: NUMERO_DA_CLINICA,
      to: p.waId,
      ...m,
      timestamp: String(m.timestamp),
    })),
  })
}

/** Campo `account_update`: identifica a conta pelo WABA, com `time` numérico. */
export function webhookDeConta(p: { wabaId?: string; evento: string; time: number }) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: p.wabaId ?? WABA_ID,
        time: p.time,
        changes: [{ field: "account_update", value: { event: p.evento } }],
      },
    ],
  }
}

export function assinar(corpo: string, segredo: string): string {
  return `sha256=${createHmac("sha256", segredo).update(corpo, "utf8").digest("hex")}`
}
```

- [x] **Passo 2: teste que falha** (`lib/whatsapp/webhook.test.ts`)

```ts
import { describe, it, expect } from "vitest"
import { interpretarWebhook } from "./webhook"
import {
  WABA_ID,
  mensagem,
  webhookDeConta,
  webhookDeEcos,
  webhookDeMensagens,
} from "@/tests/fixtures/meta-webhook"

const PHONE = "106540352242922"
const WA_ID = "5581999112895"
const T = 1790000000 // 2026-09-21T14:13:20Z

function unica(corpo: string | Record<string, unknown>, nome?: string | null) {
  return interpretarWebhook(
    webhookDeMensagens({ phoneNumberId: PHONE, waId: WA_ID, nome, mensagens: [mensagem("wamid.1", T, corpo)] }),
  )
}

describe("mensagem do paciente", () => {
  it("lê texto com autor, número, perfil e carimbo", () => {
    expect(unica("Queria marcar uma consulta")).toEqual([
      {
        tipo: "mensagem",
        autor: "patient",
        phoneNumberId: PHONE,
        waMessageId: "wamid.1",
        waIdDoPaciente: WA_ID,
        nomeDoPerfil: "Maria Souza",
        ocorridaEm: "2026-09-21T14:13:20.000Z",
        midia: "text",
        texto: "Queria marcar uma consulta",
      },
    ])
  })

  it("várias mensagens no mesmo payload viram vários eventos, na ordem", () => {
    const eventos = interpretarWebhook(
      webhookDeMensagens({
        phoneNumberId: PHONE,
        waId: WA_ID,
        mensagens: [mensagem("wamid.a", T, "oi"), mensagem("wamid.b", T + 5, "tudo bem?")],
      }),
    )
    expect(eventos.map((e) => e.tipo === "mensagem" && e.waMessageId)).toEqual(["wamid.a", "wamid.b"])
  })

  it("sem contacts, o nome do perfil fica nulo", () => {
    expect(unica("oi", null)[0]).toMatchObject({ nomeDoPerfil: null })
  })
})

describe("tipos de mensagem", () => {
  it.each([
    ["áudio", { type: "audio", audio: { id: "m1", mime_type: "audio/ogg", voice: true } }, "audio", null],
    ["imagem com legenda", { type: "image", image: { id: "m2", caption: "exame" } }, "image", "exame"],
    ["imagem sem legenda", { type: "image", image: { id: "m3" } }, "image", null],
    ["documento com legenda", { type: "document", document: { id: "m4", caption: "pedido" } }, "document", "pedido"],
    ["botão de template", { type: "button", button: { text: "Confirmar", payload: "x" } }, "text", "Confirmar"],
    ["resposta de botão", { type: "interactive", interactive: { type: "button_reply", button_reply: { id: "b", title: "Sim" } } }, "text", "Sim"],
    ["resposta de lista", { type: "interactive", interactive: { type: "list_reply", list_reply: { id: "l", title: "Manhã" } } }, "text", "Manhã"],
    ["vídeo", { type: "video", video: { id: "m5", caption: "olha" } }, "other", null],
    ["figurinha", { type: "sticker", sticker: { id: "m6" } }, "other", null],
    ["texto vazio", { type: "text", text: { body: "   " } }, "other", null],
  ])("%s", (_, corpo, midia, texto) => {
    expect(unica(corpo)[0]).toMatchObject({ midia, texto })
  })

  it("reação é ignorada", () => {
    expect(unica({ type: "reaction", reaction: { message_id: "wamid.0", emoji: "👍" } })).toEqual([])
  })
})

describe("eco da coexistência", () => {
  it("vira mensagem de autor humano, com o paciente no `to`", () => {
    const [eco] = interpretarWebhook(
      webhookDeEcos({ phoneNumberId: PHONE, waId: WA_ID, ecos: [mensagem("wamid.eco", T, "Pode vir às 15h")] }),
    )
    expect(eco).toMatchObject({
      tipo: "mensagem",
      autor: "human",
      waIdDoPaciente: WA_ID,
      nomeDoPerfil: null,
      texto: "Pode vir às 15h",
    })
  })
})

describe("eventos de conta", () => {
  it.each(["ACCOUNT_OFFBOARDED", "ACCOUNT_RECONNECTED"])("lê %s pelo WABA", (evento) => {
    expect(interpretarWebhook(webhookDeConta({ evento, time: T }))).toEqual([
      { tipo: "conta", wabaId: WABA_ID, evento, ocorridoEm: "2026-09-21T14:13:20.000Z" },
    ])
  })

  it("ignora outros eventos de conta", () => {
    expect(interpretarWebhook(webhookDeConta({ evento: "VERIFIED_ACCOUNT", time: T }))).toEqual([])
  })
})

describe("o que não é mensagem nem evento de conta", () => {
  it("ignora status de entrega", () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [{ id: WABA_ID, changes: [{ field: "messages", value: {
        metadata: { phone_number_id: PHONE },
        statuses: [{ id: "wamid.1", status: "delivered", timestamp: String(T), recipient_id: WA_ID }],
      } }] }],
    }
    expect(interpretarWebhook(payload)).toEqual([])
  })

  it("ignora payload de outro objeto e payload que não é objeto", () => {
    expect(interpretarWebhook({ object: "page", entry: [] })).toEqual([])
    expect(interpretarWebhook(null)).toEqual([])
    expect(interpretarWebhook("texto")).toEqual([])
  })

  it("pula a mensagem malformada e mantém a vizinha válida", () => {
    const payload = webhookDeMensagens({
      phoneNumberId: PHONE,
      waId: WA_ID,
      mensagens: [mensagem("wamid.ok", T, "oi"), mensagem("", T, "sem id")],
    })
    expect(interpretarWebhook(payload)).toHaveLength(1)
  })

  it("pula a mensagem com carimbo inválido", () => {
    const payload = webhookDeMensagens({ phoneNumberId: PHONE, waId: WA_ID, mensagens: [mensagem("wamid.1", T, "oi")] })
    ;(payload.entry[0].changes[0].value.messages as Array<Record<string, unknown>>)[0].timestamp = "ontem"
    expect(interpretarWebhook(payload)).toEqual([])
  })
})
```

- [x] **Passo 3:** `npx vitest run lib/whatsapp/webhook.test.ts`. Esperado: FALHA.
- [x] **Passo 4: implementação**

```ts
import type { EventoDaConta } from "./conexao"

/**
 * Leitura do webhook da Meta (conversation-engine-v1, recepção e eco).
 * Tolerante de propósito: uma entrada malformada é pulada, e as vizinhas
 * seguem. Um payload com uma mensagem estranha não pode derrubar as
 * outras que vieram junto.
 */

export type MidiaDaMensagem = "text" | "audio" | "image" | "document" | "other"

export type MensagemDoWebhook = {
  tipo: "mensagem"
  /** `patient`: o paciente escreveu. `human`: eco da coexistência, alguém da clínica respondeu pelo app. */
  autor: "patient" | "human"
  phoneNumberId: string
  waMessageId: string
  /** `wa_id` do paciente, só dígitos, como a Meta manda. */
  waIdDoPaciente: string
  /** Nome do perfil do WhatsApp. Só existe em mensagem do paciente. */
  nomeDoPerfil: string | null
  ocorridaEm: string
  midia: MidiaDaMensagem
  texto: string | null
}

export type EventoDeContaDoWebhook = {
  tipo: "conta"
  /** A Meta identifica a conta pelo WABA (`entry.id`), não pelo número. */
  wabaId: string
  evento: EventoDaConta
  ocorridoEm: string
}

export type EventoDoWebhook = MensagemDoWebhook | EventoDeContaDoWebhook

type Bruto = Record<string, unknown>

const EVENTOS_DA_CONTA: readonly string[] = ["ACCOUNT_OFFBOARDED", "ACCOUNT_RECONNECTED"]

function objeto(v: unknown): Bruto | null {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Bruto) : null
}

function lista(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null
}

/** Segundos Unix: em string nas mensagens, em número no `entry.time`. */
function instante(v: unknown): string | null {
  const segundos =
    typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : NaN
  if (!Number.isFinite(segundos) || segundos <= 0) return null
  return new Date(segundos * 1000).toISOString()
}

function comoTexto(valor: string | null): { midia: MidiaDaMensagem; texto: string | null } {
  return valor ? { midia: "text", texto: valor } : { midia: "other", texto: null }
}

/**
 * O que guardar de cada tipo. `null` quer dizer ignorar: a reação é um
 * emoji sobre outra mensagem, não algo a responder nem a contar. Texto de
 * botão e de lista é o que o paciente escolheu, e vale como texto. O resto
 * (vídeo, figurinha, localização, contato) fica registrado como `other`,
 * sem conteúdo, para não sumir do histórico.
 */
function conteudoDaMensagem(m: Bruto): { midia: MidiaDaMensagem; texto: string | null } | null {
  switch (m.type) {
    case "reaction":
      return null
    case "text":
      return comoTexto(texto(objeto(m.text)?.body))
    case "button":
      return comoTexto(texto(objeto(m.button)?.text))
    case "interactive": {
      const i = objeto(m.interactive)
      return comoTexto(texto(objeto(i?.button_reply)?.title) ?? texto(objeto(i?.list_reply)?.title))
    }
    case "audio":
      return { midia: "audio", texto: null }
    case "image":
      return { midia: "image", texto: texto(objeto(m.image)?.caption) }
    case "document":
      return { midia: "document", texto: texto(objeto(m.document)?.caption) }
    default:
      return { midia: "other", texto: null }
  }
}

function mensagens(
  value: Bruto,
  chave: "messages" | "message_echoes",
  autor: MensagemDoWebhook["autor"],
): MensagemDoWebhook[] {
  const phoneNumberId = texto(objeto(value.metadata)?.phone_number_id)
  if (!phoneNumberId) return []

  const nomes = new Map<string, string>()
  for (const c of lista(value.contacts)) {
    const contato = objeto(c)
    const waId = texto(contato?.wa_id)
    const nome = texto(objeto(contato?.profile)?.name)
    if (waId && nome) nomes.set(waId, nome.trim())
  }

  const saida: MensagemDoWebhook[] = []
  for (const bruta of lista(value[chave])) {
    const m = objeto(bruta)
    if (!m) continue
    // No eco, o paciente é o destinatário; na mensagem, é o remetente.
    const waIdDoPaciente = texto(autor === "human" ? m.to : m.from)
    const waMessageId = texto(m.id)
    const ocorridaEm = instante(m.timestamp)
    const conteudo = conteudoDaMensagem(m)
    if (!waIdDoPaciente || !waMessageId || !ocorridaEm || !conteudo) continue
    saida.push({
      tipo: "mensagem",
      autor,
      phoneNumberId,
      waMessageId,
      waIdDoPaciente,
      nomeDoPerfil: autor === "patient" ? (nomes.get(waIdDoPaciente) ?? null) : null,
      ocorridaEm,
      ...conteudo,
    })
  }
  return saida
}

function eventoDeConta(entry: Bruto, value: Bruto): EventoDeContaDoWebhook | null {
  const wabaId = texto(entry.id)
  const ocorridoEm = instante(entry.time)
  if (!wabaId || !ocorridoEm || !EVENTOS_DA_CONTA.includes(value.event as string)) return null
  return { tipo: "conta", wabaId, evento: value.event as EventoDaConta, ocorridoEm }
}

export function interpretarWebhook(payload: unknown): EventoDoWebhook[] {
  const raiz = objeto(payload)
  if (raiz?.object !== "whatsapp_business_account") return []

  const eventos: EventoDoWebhook[] = []
  for (const e of lista(raiz.entry)) {
    const entry = objeto(e)
    if (!entry) continue
    for (const c of lista(entry.changes)) {
      const change = objeto(c)
      const value = objeto(change?.value)
      if (!change || !value) continue
      if (change.field === "messages") eventos.push(...mensagens(value, "messages", "patient"))
      else if (change.field === "smb_message_echoes")
        eventos.push(...mensagens(value, "message_echoes", "human"))
      else if (change.field === "account_update") {
        const evento = eventoDeConta(entry, value)
        if (evento) eventos.push(evento)
      }
    }
  }
  return eventos
}
```

- [x] **Passo 5:** rodar o teste. Esperado: PASSA.
- [x] **Passo 6:** commit `feat(whatsapp): leitura do webhook da Meta com mensagem, eco e evento de conta`.

---

### Tarefa 4: Efeito do evento de conta no status do agente

**Arquivos:**
- Alterar: `lib/whatsapp/conexao.ts` (acrescentar ao fim).
- Criar: `lib/whatsapp/conexao.test.ts`.

**Interfaces:**
- Consome: `AgentStatus` (`lib/agent-config/schema.ts`).
- Produz: `EventoRegistrado` e `aplicarEventoDaConta(p): { novoStatus: AgentStatus | null; statusAntes: AgentStatus | null }`.

- [x] **Passo 1: teste que falha**

```ts
import { describe, it, expect } from "vitest"
import { aplicarEventoDaConta, conexaoDoWhatsapp, type EventoRegistrado } from "./conexao"

const T1 = "2026-09-21T10:00:00.000Z"
const T2 = "2026-09-21T11:00:00.000Z"
const desconexao = (statusAntes: EventoRegistrado["statusAntes"]): EventoRegistrado => ({
  evento: "ACCOUNT_OFFBOARDED",
  ocorridoEm: T1,
  statusAntes,
})

describe("desconexão (ACCOUNT_OFFBOARDED)", () => {
  it("pausa o agente que estava atendendo e guarda que ele estava ativo", () => {
    expect(
      aplicarEventoDaConta({ evento: "ACCOUNT_OFFBOARDED", ocorridoEm: T1, statusAtual: "active", ultimo: null }),
    ).toEqual({ novoStatus: "paused", statusAntes: "active" })
  })

  it.each(["paused", "draft"] as const)("não mexe em agente %s", (statusAtual) => {
    expect(
      aplicarEventoDaConta({ evento: "ACCOUNT_OFFBOARDED", ocorridoEm: T1, statusAtual, ultimo: null }),
    ).toEqual({ novoStatus: null, statusAntes: statusAtual })
  })

  it("desconexão repetida mantém o status de antes da primeira", () => {
    expect(
      aplicarEventoDaConta({
        evento: "ACCOUNT_OFFBOARDED",
        ocorridoEm: T2,
        statusAtual: "paused",
        ultimo: desconexao("active"),
      }),
    ).toEqual({ novoStatus: null, statusAntes: "active" })
  })
})

describe("reconexão (ACCOUNT_RECONNECTED)", () => {
  const reconexao = (statusAtual: "active" | "paused" | "draft", ultimo: EventoRegistrado | null) =>
    aplicarEventoDaConta({ evento: "ACCOUNT_RECONNECTED", ocorridoEm: T2, statusAtual, ultimo })

  it("devolve ao ar quem a desconexão pausou", () => {
    expect(reconexao("paused", desconexao("active"))).toEqual({ novoStatus: "active", statusAntes: null })
  })

  it("não reativa quem a clínica já tinha pausado antes da desconexão", () => {
    expect(reconexao("paused", desconexao("paused")).novoStatus).toBeNull()
  })

  it("não mexe em agente que a clínica já publicou de novo", () => {
    expect(reconexao("active", desconexao("active")).novoStatus).toBeNull()
  })

  it("não mexe sem desconexão registrada", () => {
    expect(reconexao("paused", null).novoStatus).toBeNull()
  })

  it("não mexe em rascunho", () => {
    expect(reconexao("draft", desconexao("active")).novoStatus).toBeNull()
  })
})

describe("evento atrasado", () => {
  it("fica registrado, mas não muda o status decidido por um evento mais novo", () => {
    const reconectadoDepois: EventoRegistrado = { evento: "ACCOUNT_RECONNECTED", ocorridoEm: T2, statusAntes: null }
    expect(
      aplicarEventoDaConta({ evento: "ACCOUNT_OFFBOARDED", ocorridoEm: T1, statusAtual: "active", ultimo: reconectadoDepois }),
    ).toEqual({ novoStatus: null, statusAntes: "active" })
  })
})

describe("conexaoDoWhatsapp", () => {
  it("o último evento decide, e sem número não há conexão", () => {
    expect(conexaoDoWhatsapp({ temNumero: true, ultimoEvento: "ACCOUNT_OFFBOARDED" })).toBe("desconectado-pela-meta")
    expect(conexaoDoWhatsapp({ temNumero: true, ultimoEvento: "ACCOUNT_RECONNECTED" })).toBe("conectado")
    expect(conexaoDoWhatsapp({ temNumero: false, ultimoEvento: null })).toBe("sem-numero")
  })
})
```

- [x] **Passo 2:** `npx vitest run lib/whatsapp/conexao.test.ts`. Esperado: FALHA.
- [x] **Passo 3: implementação** (acrescentar a `lib/whatsapp/conexao.ts`, com `import type { AgentStatus } from "@/lib/agent-config/schema"` no topo)

```ts
/** Evento de conta já registrado para um agente (`whatsapp_account_events`). */
export type EventoRegistrado = {
  evento: EventoDaConta
  ocorridoEm: string
  /** Status do agente antes da desconexão; só existe em ACCOUNT_OFFBOARDED. */
  statusAntes: AgentStatus | null
}

/**
 * O que um evento de conta faz com o status do agente (conversation-engine-v1,
 * edge case ACCOUNT_OFFBOARDED). A desconexão pausa quem estava atendendo e
 * guarda que ele estava ativo. A reconexão devolve ao ar só quem a desconexão
 * pausou. Um agente que a clínica tinha pausado, ou que era rascunho, fica
 * como estava, porque reconectar o número não é publicar.
 *
 * `novoStatus: null` = não mexe. `statusAntes` é o que se grava no registro.
 */
export function aplicarEventoDaConta(p: {
  evento: EventoDaConta
  ocorridoEm: string
  statusAtual: AgentStatus
  /** O evento de conta mais recente já registrado para o agente. */
  ultimo: EventoRegistrado | null
}): { novoStatus: AgentStatus | null; statusAntes: AgentStatus | null } {
  const desconexao = p.evento === "ACCOUNT_OFFBOARDED"

  // A Meta não garante a ordem. Um evento mais antigo que o último já
  // registrado chega atrasado: o mais novo já decidiu o status.
  if (p.ultimo && Date.parse(p.ocorridoEm) < Date.parse(p.ultimo.ocorridoEm)) {
    return { novoStatus: null, statusAntes: desconexao ? p.statusAtual : null }
  }

  if (desconexao) {
    // Desconexão repetida: o agente já foi pausado pela primeira, e o
    // status que importa para a reconexão é o de antes dela.
    const statusAntes =
      p.ultimo?.evento === "ACCOUNT_OFFBOARDED" ? p.ultimo.statusAntes : p.statusAtual
    return { novoStatus: p.statusAtual === "active" ? "paused" : null, statusAntes }
  }

  const reativa =
    p.statusAtual === "paused" &&
    p.ultimo?.evento === "ACCOUNT_OFFBOARDED" &&
    p.ultimo.statusAntes === "active"
  return { novoStatus: reativa ? "active" : null, statusAntes: null }
}
```

- [x] **Passo 4:** rodar o teste. Esperado: PASSA.
- [x] **Passo 5:** commit `feat(whatsapp): desconexão e reconexão da Meta sobre o status do agente como regra pura`.

---

### Tarefa 5: O que se pode logar de um erro

**Arquivos:**
- Criar: `lib/security/erro-para-log.ts` e `lib/security/erro-para-log.test.ts`.

**Interfaces:**
- Consome: `ehErroDoPostgrest` (`lib/supabase/errors.ts`).
- Produz: `ErroParaLog` e `erroParaLog(erro: unknown): ErroParaLog`.

- [x] **Passo 1: teste que falha**

```ts
import { describe, it, expect } from "vitest"
import { erroParaLog } from "./erro-para-log"

describe("erroParaLog", () => {
  it("do erro do Postgres, fica só o código, nunca o valor rejeitado", () => {
    const erro = {
      code: "23505",
      message: "duplicate key value violates unique constraint",
      details: "Key (whatsapp_phone_number)=(+5581999112895) already exists.",
      hint: null,
    }
    const saida = erroParaLog(erro)
    expect(saida).toEqual({ tipo: "postgrest", codigo: "23505" })
    expect(JSON.stringify(saida)).not.toContain("5581999112895")
  })

  it("de um Error, fica o nome da classe, nunca a mensagem", () => {
    const saida = erroParaLog(new Error("Paciente disse: estou com dor no peito"))
    expect(saida).toEqual({ tipo: "Error", codigo: null })
    expect(JSON.stringify(saida)).not.toContain("dor no peito")
  })

  it("preserva o nome de erro próprio e o código de máquina", () => {
    class ConteudoError extends Error {
      name = "ConteudoError"
      code = "ERR_CRYPTO"
    }
    expect(erroParaLog(new ConteudoError("x"))).toEqual({ tipo: "ConteudoError", codigo: "ERR_CRYPTO" })
  })

  it("descarta um código que parece telefone", () => {
    const erro = Object.assign(new Error("x"), { code: "5581999112895" })
    expect(erroParaLog(erro).codigo).toBeNull()
  })

  it("de algo que não é erro, fica só o tipo", () => {
    expect(erroParaLog("texto do paciente")).toEqual({ tipo: "string", codigo: null })
    expect(erroParaLog(undefined)).toEqual({ tipo: "undefined", codigo: null })
  })
})
```

- [x] **Passo 2:** `npx vitest run lib/security/erro-para-log.test.ts`. Esperado: FALHA.
- [x] **Passo 3: implementação**

```ts
import { ehErroDoPostgrest } from "@/lib/supabase/errors"

export type ErroParaLog = { tipo: string; codigo: string | null }

/** Código curto de máquina: SQLSTATE, código da Meta, código do Node. */
const CODIGO = /^[A-Za-z0-9_.-]{1,40}$/
/** Oito dígitos ou mais seguidos já podem ser um telefone. */
const PARECE_TELEFONE = /^\d{8,}$/

function seguro(valor: unknown): string | null {
  return typeof valor === "string" && CODIGO.test(valor) && !PARECE_TELEFONE.test(valor)
    ? valor
    : null
}

/**
 * O que se pode logar de um erro no caminho da mensagem de paciente: o tipo
 * e o código, nunca a mensagem. O `message` e o `details` do Postgres
 * repetem o valor rejeitado (telefone, nome), e uma exceção pode citar o
 * texto que o paciente mandou (lgpd-security, regra 1). O reconhecimento
 * do erro do PostgREST é pelo formato: ele não é `instanceof Error`.
 */
export function erroParaLog(erro: unknown): ErroParaLog {
  if (ehErroDoPostgrest(erro)) return { tipo: "postgrest", codigo: seguro(erro.code) }
  if (erro instanceof Error) {
    return {
      tipo: seguro(erro.name) ?? "Error",
      codigo: seguro((erro as { code?: unknown }).code),
    }
  }
  return { tipo: typeof erro, codigo: null }
}
```

- [x] **Passo 4:** rodar o teste. Esperado: PASSA.
- [x] **Passo 5:** commit `feat(security): erro para log só com tipo e código`.

---

### Tarefa 6: Migration e isolamento entre clínicas

Carregue `supabase-postgres-best-practices` antes. Siga o estilo das migrations anteriores: comentário do porquê em cada decisão não óbvia, `comment on`, `set search_path = ''` em função e índice na coluna da policy.

**Arquivos:**
- Criar: `supabase/migrations/20260927120000_conversation_engine.sql` e `tests/rls/conversations.test.ts`.

**Interfaces:**
- Produz: as tabelas `conversations`, `messages`, `attendance_sessions` e `whatsapp_account_events`.
- Produz também a função `public.register_whatsapp_message(p_clinic_id uuid, p_agent_id uuid, p_patient_id uuid, p_wa_message_id text, p_author message_author, p_media_type message_media_type, p_content_encrypted text, p_occurred_at timestamptz)`, que devolve `table (conversation_id uuid, message_id uuid, inserted boolean)`.

**Conteúdo da migration:**

1. **Aditivo em tabela existente:** `alter table public.agents add constraint agents_id_clinic_id_key unique (id, clinic_id)`, e o mesmo em `patients` (`patients_id_clinic_id_key`). Não falha, porque `id` já é PK. É o que permite a FK composta.
2. **Enums:**
   - `conversation_handler` (`ai`, `human`);
   - `conversation_status` (`active`, `archived`);
   - `message_direction` (`inbound`, `outbound`);
   - `message_author` (`patient`, `ai`, `human`);
   - `message_media_type` (`text`, `audio`, `image`, `document`, `other`);
   - `attendance_session_status` (`open`, `closed_by_count`, `closed_by_timeout`);
   - `whatsapp_account_event` (`ACCOUNT_OFFBOARDED`, `ACCOUNT_RECONNECTED`).
3. **`conversations`:**
   - colunas:
     - `id` e `clinic_id`;
     - `agent_id` e `patient_id`, com FK composta `(agent_id, clinic_id)` → `agents(id, clinic_id)` e `(patient_id, clinic_id)` → `patients(id, clinic_id)`, as duas `on delete cascade`;
     - `handled_by`, com default `ai`;
     - `human_took_over_at`;
     - `is_urgent`, com default `false`;
     - `qualified_at`, `last_inbound_at` e `last_message_at` (not null);
     - `status`, com default `active`;
     - `created_at` e `updated_at`, com trigger `private.touch_updated_at()`;
   - `unique (agent_id, patient_id)`: uma conversa por par;
   - `unique (id, clinic_id)`, alvo das FKs abaixo;
   - `check (not is_urgent or handled_by = 'human')`: urgente é sempre humana;
   - índices em `(clinic_id, last_message_at desc)` (RLS e a lista da parte 4) e em `(patient_id)` (FK).
4. **`messages`:**
   - colunas:
     - `id` e `clinic_id`;
     - `conversation_id`, com FK composta `(conversation_id, clinic_id)` → `conversations(id, clinic_id)` `on delete cascade`;
     - `direction`, `author` e `wa_message_id` (nulo só para a IA na parte 2);
     - `content_encrypted text -- PII`;
     - `media_type`, `occurred_at` e `created_at`;
   - `unique (clinic_id, wa_message_id)`: a idempotência, que também serve de índice da RLS;
   - `check ((direction = 'inbound') = (author = 'patient'))`;
   - `check (media_type <> 'text' or content_encrypted is not null)`;
   - índice em `(conversation_id, occurred_at)`;
   - `comment on column content_encrypted`: AES-256-GCM com `MESSAGE_CONTENT_ENCRYPTION_KEY`, amarrado ao `clinic_id`, decifrado só no servidor.
5. **`attendance_sessions`:**
   - colunas:
     - `id` e `clinic_id`;
     - `conversation_id`, com a mesma FK composta;
     - `started_at` e `last_message_at`;
     - `ai_response_count int not null default 0 check (between 0 and 5)`;
     - `status`, com default `open`;
     - `closed_at` e `created_at`;
   - `check ((status = 'open') = (closed_at is null))`;
   - índice único parcial `on (conversation_id) where status = 'open'`;
   - índice em `(clinic_id, closed_at)`, para a contagem mensal da fase 7 e a RLS.
6. **`whatsapp_account_events`:**
   - colunas:
     - `id` e `clinic_id`;
     - `agent_id`, com FK composta para `agents`;
     - `event`;
     - `agent_status_before public.agent_status` (nulo na reconexão);
     - `occurred_at` e `created_at`;
   - `unique (agent_id, event, occurred_at)`, porque a Meta reenvia;
   - índices em `(agent_id, occurred_at desc)` e `(clinic_id)`.
7. **RLS nas quatro:**
   - `enable row level security`;
   - uma policy de `select` para `authenticated`, `clinic_id in (select private.current_clinic_ids())`;
   - `revoke all ... from anon, authenticated` e `grant select ... to authenticated`;
   - nenhuma policy de escrita: quem escreve é o webhook, com `service_role`. A escrita pelo painel (devolver para a IA, resolver urgência) chega na parte 4, com a policy dela.
8. **`public.register_whatsapp_message(...)`:**
   - Características: `plpgsql`, `security invoker`, `set search_path = ''`; `revoke execute ... from public, anon, authenticated`; `grant execute ... to service_role`. Numa transação, faz o seguinte.
   1. `p_author` fora de (`patient`, `human`) → `raise` com errcode `22023`. A resposta da IA entra na parte 2.
   2. Se já existe mensagem com (`p_clinic_id`, `p_wa_message_id`), devolve `(conversation_id, id, false)` sem mexer em nada.
   3. Faz upsert da conversa em `(agent_id, patient_id)`:
      - na criação:
        - `handled_by = human` se o autor é humano;
        - `human_took_over_at` e `last_inbound_at` conforme o autor;
        - `last_message_at = p_occurred_at`;
      - no conflito:
        - `last_message_at = greatest(atual, p_occurred_at)`;
        - para o paciente: `last_inbound_at = greatest(...)` e `status = 'active'` (reabre arquivada);
        - para o humano: `handled_by = 'human'` e `human_took_over_at = greatest(...)`.

      `greatest` ignora nulo e torna o reenvio atrasado inofensivo.
   4. Insere a mensagem, com `direction` derivada do autor, `on conflict (clinic_id, wa_message_id) do nothing`. Se nada entrou (corrida com a mesma mensagem), relê o id e devolve `inserted = false`.
   5. Só para o paciente, a sessão:
      - lê a sessão `open` da conversa `for update`;
      - se `last_message_at < p_occurred_at - interval '20 minutes'`, fecha como `closed_by_timeout`, com `closed_at = last_message_at + interval '20 minutes'`;
      - com sessão aberta, `last_message_at = greatest(...)`;
      - sem ela, insere uma nova (`started_at = last_message_at = p_occurred_at`) `on conflict (conversation_id) where status = 'open' do update set last_message_at = greatest(...)`.

      Resposta humana não toca a sessão (atendimento-billing-v1, regra 5).
   6. Devolve `(conversa, mensagem, true)`.

**Casos do teste de RLS** (`tests/rls/conversations.test.ts`, no padrão de `tests/rls/patients.test.ts`):
- **Cenário:** clínicas A e B, um usuário membro de cada, um agente e um paciente em cada. Pela `register_whatsapp_message`, com `service_role`, cada clínica recebe uma mensagem do paciente e um eco. Cada uma recebe também um evento de conta inserido direto.
- **Casos:**
  1. O membro de A lê as linhas de A nas quatro tabelas (≥ 1 cada) e nenhuma de B, nem filtrando pelo id de B.
  2. O anônimo não lê nada nas quatro.
  3. O membro de A não insere em nenhuma das quatro (erro) e não altera nem apaga uma linha de A. O `update` e o `delete` não afetam nada, e o `service_role` confirma que a linha continua igual.
  4. O membro de A e o anônimo não executam `register_whatsapp_message` (erro `42501`).
  5. FK composta, pelo `service_role`: conversa com `clinic_id` de A e agente de B falha (`23503`), e mensagem com `clinic_id` de A e conversa de B também falha.
  6. O mesmo `wa_message_id` existe em A e em B (a unicidade é por clínica). Repetido em A, devolve `inserted = false`.
  7. `author = 'ai'` na função é recusado (`22023`).

- [x] **Passo 1:** escrever `tests/rls/conversations.test.ts` com os casos acima.
- [x] **Passo 2:** rodar. Esperado: FALHA, porque as tabelas não existem.
- [x] **Passo 3:** escrever a migration.
- [x] **Passo 4:** aplicar com `supabase db push`. A CLI fica em `~/.local/bin` e precisa de `SUPABASE_DB_PASSWORD` e `SUPABASE_ACCESS_TOKEN` do `.env`. Conferir que só a migration nova foi aplicada.
- [x] **Passo 5:** `npx vitest run tests/rls/conversations.test.ts`. Esperado: PASSA. Rodar também `tests/rls/agents.test.ts` e `tests/rls/patients.test.ts`, que tocam as tabelas alteradas.
- [x] **Passo 6:** commit `feat(conversations): conversas, mensagens, sessões e eventos de conta com RLS por clínica`.

---

### Tarefa 7: Recepção de ponta a ponta

**Arquivos:**
- Criar: `lib/conversations/recepcao.ts`, `lib/whatsapp/conta.ts`, `app/api/whatsapp/webhook/route.ts` e `tests/whatsapp/webhook.test.ts`.

**Interfaces:**
- Consome:
  - das tarefas 1 a 6: `cifrarConteudo`, `assinaturaValida`, `desafioDaVerificacao`, `interpretarWebhook`, `aplicarEventoDaConta`, `erroParaLog` e `register_whatsapp_message`;
  - do que já existia: `identifyPatient`, `touchLastContact` e `serviceContext`.
- Produz, para a parte 2:
  - `ResultadoDaRecepcao = { conversationId: string; messageId: string; nova: boolean; autor: "patient" | "human"; agenteAtivo: boolean }`;
  - `receberMensagem(m: MensagemDoWebhook): Promise<ResultadoDaRecepcao | null>`;
  - `receberEventoDeConta(e: EventoDeContaDoWebhook): Promise<void>`.

**`lib/conversations/recepcao.ts`** (`serviceContext`; toda query filtra `clinic_id` explicitamente; ver o ajuste da tarefa 7 no status, sobre o passo 5):
1. Busca o agente por `whatsapp_phone_number_id = m.phoneNumberId` (`id`, `clinic_id`, `status`). Se não houver, devolve `null`: o número não é de nenhum agente nosso.
2. Chama `identifyPatient(clinicId, { whatsapp_phone_number: "+" + m.waIdDoPaciente, name: m.nomeDoPerfil ?? undefined })`, que só grava o nome na criação.
3. Cifra `m.texto` com `cifrarConteudo(clinicId, ...)` quando há texto; senão, `null`.
4. Chama a RPC `register_whatsapp_message`. Um erro sobe como está, e a rota decide o que logar.
5. Se `inserted` e o autor é o paciente, chama `touchLastContact`.
6. Devolve o `ResultadoDaRecepcao`, com `agenteAtivo = status === "active"`. A mensagem de agente pausado ou rascunho fica registrada do mesmo jeito.

**`lib/whatsapp/conta.ts`:**
1. Busca os agentes com `whatsapp_waba_id = e.wabaId`. Para cada um:
   - lê o evento mais recente (`order by occurred_at desc limit 1`);
   - calcula com `aplicarEventoDaConta`;
   - insere o registro com `upsert(..., { onConflict: "agent_id,event,occurred_at", ignoreDuplicates: true }).select("id")`. Sem linha de volta, é reenvio: segue para o próximo agente sem mexer no status;
   - com `novoStatus`, faz `update agents set status` com filtro por `id`, `clinic_id` e o `status` lido, uma trava otimista.
2. Se o `update` for recusado (trigger de publicação ou de limite de plano), o agente fica pausado. Loga `{ etapa: "reativar-agente", ...erroParaLog(erro) }` e segue. Reenviar o webhook não resolveria, porque o registro já existe.

**`app/api/whatsapp/webhook/route.ts`** (fina):
- **`GET`:** `desafioDaVerificacao(url.searchParams, env WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "")`. Com challenge, responde 200 com ele em `text/plain`; sem challenge, 403.
- **`POST`:**
  1. Sem `WHATSAPP_APP_SECRET`, responde 500 e loga `{ etapa: "configuracao" }`.
  2. Lê `corpo = await request.text()`. Com assinatura inválida, responde 401 sem corpo.
  3. `JSON.parse`; se falhar, 400.
  4. `interpretarWebhook`, e cada evento em sequência: `receberMensagem` ou `receberEventoDeConta`.
  5. Qualquer erro responde 500 sem corpo e loga só `console.error("[whatsapp-webhook]", { etapa: "recepcao", eventos: n, ...erroParaLog(erro) })`. Sucesso responde 200. A parte 2 põe o `after()` aqui, com os resultados.

**Casos do teste** (`tests/whatsapp/webhook.test.ts`):
- **Como roda:**
  - chama `GET` e `POST` da rota com `new Request(...)`, contra o banco real;
  - usa `WHATSAPP_APP_SECRET` e `WHATSAPP_WEBHOOK_VERIFY_TOKEN` de teste, definidos no próprio arquivo;
  - usa `phone_number_id` e WABA aleatórios, para não colidir com o UNIQUE global;
  - cada caso usa um `wa_id` próprio.
- **Cenário:**
  - uma clínica e um agente `active`, com número e um token cifrado qualquer, que o trigger de publicação exige;
  - um segundo agente `paused`, no mesmo WABA;
  - limpeza no `afterAll`, apagando a clínica, o que leva tudo em cascata.
- **Casos:**
  1. **Handshake:** com o token certo, 200 com o challenge; com o errado, 403.
  2. **Sem assinatura válida:** 401, e nada gravado para aquele `wa_id`.
  3. **JSON inválido, mas assinado:** 400.
  4. **Primeira mensagem do paciente:** 200. Cria:
     - o paciente, com telefone `+<wa_id>`, o nome do perfil e `last_contact_at` preenchido;
     - a conversa: `handled_by = ai`, `last_inbound_at = last_message_at = carimbo` e `status = active`;
     - a mensagem: `inbound`, `patient` e `text`. O `content_encrypted` decifra para o texto e não o contém;
     - a sessão `open`, com `started_at = last_message_at = carimbo` e `ai_response_count = 0`.
  5. **Reenvio do mesmo payload:** 200, e continua 1 mensagem e 1 sessão, com o `last_message_at` da sessão igual.
  6. **Segunda mensagem 5 min depois:** a mesma sessão, com `last_message_at` novo, e o `last_inbound_at` da conversa atualizado.
  7. **Mensagem 25 min depois da última:**
     - a sessão anterior fecha: `closed_by_timeout`, com `closed_at` = última + 20 min;
     - abre uma nova, `open`, com `started_at` = carimbo novo.
  8. **Eco numa conversa existente:**
     - a mensagem é `outbound` e `human`;
     - a conversa passa a `handled_by = human`, com `human_took_over_at` = carimbo do eco e `last_message_at` = carimbo do eco;
     - `last_inbound_at` e as sessões ficam iguais.
  9. **Eco para um número que nunca escreveu:**
     - cria o paciente sem nome;
     - cria a conversa com `handled_by = human` e `last_inbound_at` nulo;
     - não abre sessão.
  10. **`phone_number_id` sem agente:** 200, e nada gravado.
  11. **Agente pausado:** a mensagem fica registrada.
  12. **Conversa arquivada** (via `service_role`): a mensagem do paciente a reabre (`status = active`).
  13. **Áudio:** `media_type = audio` e `content_encrypted` nulo.
  14. **Eventos de conta:**
      - `ACCOUNT_OFFBOARDED` pausa o agente ativo e registra `agent_status_before = active`;
      - o agente já pausado fica pausado, com `agent_status_before = paused`;
      - `ACCOUNT_RECONNECTED` reativa só o primeiro;
      - o mesmo `OFFBOARDED` reenviado (mesmo `time`) não duplica o registro.
  15. **Falha não vaza conteúdo:**
      - com `vi.spyOn` em `console.error`, `console.warn` e `console.log`, e sem `MESSAGE_CONTENT_ENCRYPTION_KEY`, o POST responde 500;
      - o `JSON.stringify` de todos os argumentos logados não contém o texto, o `wa_id`, o `+<wa_id>` nem o nome;
      - com a chave restaurada, o mesmo payload responde 200 e grava. O reenvio da Meta recupera.

- [x] **Passo 1:** escrever `tests/whatsapp/webhook.test.ts` com os casos acima.
- [x] **Passo 2:** rodar. Esperado: FALHA, porque a rota não existe.
- [x] **Passo 3:** escrever `lib/whatsapp/conta.ts`, `lib/conversations/recepcao.ts` e a rota.
- [x] **Passo 4:** `npx vitest run tests/whatsapp/webhook.test.ts`. Esperado: PASSA.
- [x] **Passo 5:** `npx vitest run tests/architecture`. Esperado: PASSA. A rota não instancia client do Supabase.
- [x] **Passo 6:** commit `feat(whatsapp): webhook da Meta grava mensagem, eco e evento de conta`.

---

### Tarefa 8: Documentação

**Arquivos:**
- Alterar:
  - este plano (status da execução);
  - `docs/roadmap.md`, `docs/status.md`, `docs/specs/conversation-engine-v1.md` e `docs/specs/atendimento-billing-v1.md`;
  - `docs/infra-setup.md`;
  - a memória do projeto.

- [x] **Passo 1:** nas duas specs, registrar os desvios desta parte (`conversation_id` na sessão, `occurred_at`, `other`) e marcar os critérios de aceite que esta parte cumpre: idempotência, RLS e o log sem conteúdo na recepção.
- [x] **Passo 2:** em `docs/infra-setup.md`, na seção da Meta, registrar o que fazer quando as credenciais chegarem:
  - assinar os campos `messages`, `smb_message_echoes` e `account_update`;
  - apontar para `/api/whatsapp/webhook`;
  - criar a `MESSAGE_CONTENT_ENCRYPTION_KEY` na Vercel, nos três ambientes.
- [x] **Passo 3:**
  - `docs/status.md`: 3b em andamento, parte 1 de 5; contagem de testes e de migrations; em "Precisam de ação do Jhones", a env nova na Vercel;
  - `docs/roadmap.md`: as cinco partes, com a 1 marcada;
  - neste plano: status da execução, com a tabela de ajustes, no formato da parte 4.
- [x] **Passo 4:** memória: atualizar `nextech-arquitetura-decisoes` com o recorte da 3b e as decisões 1 a 4 deste plano, e `nextech-ambiente-supabase` com a contagem de migrations.
- [ ] **Passo 5:** commit `docs: fecha a parte 1 do motor de conversa no plano, specs, roadmap e status`.

---

### Tarefa 7b: achados das revisões (acrescentada na execução, 2026-09-27)

As revisões `security-reviewer` e `qa-reviewer` rodaram sobre `bd9d8be`. O Jhones autorizou seguir sozinho com a alternativa recomendada. Cada decisão abaixo fica para a revisão dele no PR.

**Segurança:**

| # | Achado | Decisão |
|---|---|---|
| S1 | Uma clínica pode digitar o `phone_number_id` ou o WABA de outra e receber as mensagens dela. A conexão grava IDs digitados, sem prova de posse | **Agora:** a mensagem leva o `entry.id` (WABA), e a recepção recusa quando ele diverge do WABA do agente. Mais um teste de ponta a ponta com duas clínicas. **Raiz:** provar a posse na conexão, pela Graph API com o token informado (ou pelo Embedded Signup), entra na parte 2, que cria o client da Meta. É bloqueio de go-live em `docs/status.md` |
| S2 | O check `messages_texto_tem_conteudo` impede apagar o conteúdo, e o `anonymizePatient` deixa o histórico legível | Migration nova: `content_redacted_at`, o check relaxado para a mensagem redigida e a função `redact_patient_messages`, só para owner. O `anonymizePatient` passa a chamá-la |
| S3 | Um evento com problema derruba o lote inteiro, e o carimbo fora da faixa do `Date` lança `RangeError` | Carimbo validado. Cada evento em seu próprio `try`. Falha definitiva (Zod, SQLSTATE classes 22 e 23) é logada e pulada; a transitória devolve 500 no fim |
| S4 | HMAC sobre `request.text()` | HMAC sobre os bytes (`arrayBuffer`) |
| S5 | O AAD amarra à clínica, e não à linha | **Não aplicado.** Trocar blobs entre linhas exige escrita com `service_role`, e quem tem isso tem tudo. O AAD por clínica cobre o risco real, que é a cópia entre tenants |
| S6 | O eco cria "paciente" para qualquer destinatário (fornecedor, familiar) | Requisito registrado em `message-sequences-v1`: só é elegível quem já escreveu para a clínica. O dado para isso já existe (`last_inbound_at` da conversa) |
| S7 | Falta isolamento de ponta a ponta no webhook | Junto com S1 |

**QA:**

| # | Achado | Decisão |
|---|---|---|
| B1 | O teste de LGPD serializa com `JSON.stringify`, que descarta `message` e `stack` | `util.inspect`, formato exato de cada chamada por lista do que é permitido, e um arquivo com a recepção simulada que lança erros carregando telefone, nome e texto |
| B2 | O insert falharia por NOT NULL, e o update da mensagem, pelo check | Exigir `42501` no insert. O update mexe em `occurred_at` e relê a coluna |
| B3 | Sessões e eventos de conta sem teste de update e delete | Acrescentados |
| B4 | Corrida sem teste | N chamadas simultâneas da RPC: 1 mensagem, 1 sessão e um só `inserted = true` |
| B5 a B7 | `handled_by` que persiste, chegada fora de ordem e fronteira de 20 min | Casos de ponta a ponta. A fronteira fica fixada: 20 min exatos continuam a sessão |
| B8 | `touchLastContact` no reenvio e no eco | Reenvio regrava. O eco não mexe no `last_contact_at` de quem já existe. A coluna é `not null default now()`, então "fica nulo" não se aplica |
| B9 | Caminhos de erro do `conta.ts` | A reativação recusada pelo trigger de publicação vira caso de ponta a ponta. A falha ao pausar vira unitário com client simulado. O comentário sobre limite de plano está errado (o trigger é só de insert) e foi corrigido |
| B10 | Evidência da verificação final | Já tinha rodado: 882 testes e o build, antes da revisão. Roda de novo no fim |
| N1 a N10 | Contrato do `ResultadoDaRecepcao`, nome que não muda, nada gravado depois do 500, 500 sem segredo, FKs compostas restantes, payload com várias mensagens, `wa_id` com prefixo que não existe, restauração da env e `afterAll` robusto | Todos acrescentados |

- [x] **Passo 1:** S3 e S4, com teste. Commit `fix(whatsapp): assinatura sobre os bytes, carimbo fora da faixa e falha por evento`.
- [x] **Passo 2:** S1 e S7, com teste. Commit `fix(whatsapp): mensagem só entra pelo agente do mesmo WABA`.
- [x] **Passo 3:** S2: migration aplicada, com teste de banco. Commit `feat(patients): exclusão redige o conteúdo das conversas do paciente`.
- [x] **Passo 4:** B1 a B9 e N1 a N10. Commit `test(conversations): lacunas apontadas pela revisão de QA da recepção`.

**Conferência das correções** (os dois revisores de novo, sobre `6487839`):

| Origem | Achado | Decisão |
|---|---|---|
| Segurança | S1 a S6 corretos. Novo: redigir e anonimizar eram duas transações, e uma mensagem em trânsito podia gravar conteúdo no meio | Migration `20260927140000_patient_anonymization.sql`: `anonymize_patient` faz as duas coisas com o paciente em `for update`, e `register_whatsapp_message` trava o paciente em `for share` e recusa o anonimizado com `NX010`. A rota trata `NX010` como transitória: no reenvio, o telefone não acha mais o cadastro apagado, e quem voltou a escrever vira um paciente novo. `redact_patient_messages` saiu |
| Segurança | Com um `try` por evento, uma falha transitória na mensagem N deixa a N+1 entrar e ser respondida antes | Vai para a parte 2, que é quem responde: pular os eventos seguintes da mesma conversa depois de uma falha transitória |
| QA | O arquivo de RLS fazia um login por caso e estourava o limite do Supabase Auth | Um login por usuário no arquivo, com o client reaproveitado |
| QA | `logPermitido` aceitava um `Error` cru, porque `Object.entries` dele é vazio | Exige objeto simples com `etapa`, com teste |

- [x] **Passo 5:** conferência. Commit `fix(patients): anonimização e redação numa transação, com o paciente travado`.

## Verificação final (antes da tarefa 8)

- [x] `npx vitest run` inteiro, `npx tsc --noEmit` e `npm run build`, com a saída lida.
- [x] Revisão pelos subagentes `qa-reviewer` e `security-reviewer`, com os achados tratados antes de fechar. Esta parte toca em mensagem de paciente.
- [x] Sem tela nesta parte: não há verificação visual. Antes de trocar de branch, `git checkout -- CLAUDE.md`.

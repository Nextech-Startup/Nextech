# Canal de demonstração pela Evolution API: plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:executing-plans`, tarefa por tarefa, sem subagentes na execução (os revisores `security-reviewer` e `qa-reviewer` entram só na tarefa 12). Carregue `supabase-postgres-best-practices` antes das tarefas 3 e 9, `integrations` e `lgpd-security` antes das tarefas 4, 5 e 7, e `frontend-design` com `ui-ux` antes das tarefas 8 e 11. Os passos usam checkbox (`- [ ]`).

**Objetivo:** na apresentação para investidor, num login só (`clinica@nextech.ia.br`), o sidebar inteiro abre com o dado de exemplo, e um chip da Nextech responde pelo WhatsApp com o motor de conversa real. A conversa aparece ao vivo na tela de Conversas da demonstração, junto das de exemplo.

**Arquitetura:**
- **Recepção:** rota nova `app/api/whatsapp/evolution`, que só existe com as variáveis `EVOLUTION_*`. Ela traduz o payload da Evolution para o `MensagemDoWebhook` que a recepção do motor já usa, e daí o caminho é o mesmo da Meta.
- **Envio:** escolhido pelo prefixo `evolution:` do identificador do agente, dentro da dependência `enviar` do motor. Sem coluna nova.
- **Banco:** uma migration restringe o NX004 ao `authenticated` e prende o identificador `evolution:` à clínica de demonstração.
- **Tela:** a de Conversas da demonstração junta a conversa real com as de exemplo, e a busca passa a ser por POST.
- **Infra:** tudo roda no computador do Jhones (Docker Compose da Evolution mais `next start`), sem túnel.

**Tecnologias:** Next 16 (App Router, route handler, server actions, `after()`), Supabase (Postgres, PostgREST, Realtime), Evolution API v2 (Docker), Vitest, playwright-core na revisão visual.

**Spec:** `docs/specs/evolution-demo-v1.md`. Afetadas: `docs/specs/demo-account-v1.md` e `docs/specs/conversation-engine-v1.md`.

## Status da execução: 🟨 em andamento

### Feito antes da execução (2026-10-11)
- [x] Spec `docs/specs/evolution-demo-v1.md`, com as decisões do Jhones (commits `16b45ce` e `cf8a789`, mais o deste plano).
- [x] Celular dedicado com o chip da demonstração (Jhones).
- [x] Docker instalado no computador da apresentação (Jhones).
- [ ] Números que vão conversar: pedir ao Jhones no início da tarefa 10. Para o ensaio, é preciso **outro celular, diferente do chip**, para mandar as mensagens.

### Estado de partida
- `staging` em `cf8a789` (mais o commit deste plano), com push. Suíte: 1546 testes em 121 arquivos, saída 0, no `54f552c`; depois disso, só documentação.
- Banco: 29 migrations. Clínica de demonstração `d09aa757-fc21-446a-8018-7586d88859e8` (`is_demo`, plano healthtech, owners `clinica@` e `admin@`), sem paciente e sem agente no banco: os agentes que a tela mostra são fixture.

## Decisões deste plano

1. **A regra fica no banco** (migration da tarefa 3), na função `private.agent_block_demo()`:
   - na clínica de demonstração, o `authenticated` segue recusado (NX004) ao gravar qualquer identificador e ao publicar;
   - o `service_role` (`auth.role() = 'service_role'`) grava só identificador `evolution:%` e publica esse agente; identificador da Meta continua recusado na demonstração;
   - fora da demonstração, `evolution:%` é recusado por qualquer papel, com o código novo NX005. Como `whatsapp_phone_number_id` é UNIQUE global, o identificador do canal só pode existir num lugar.
2. **O canal é escolhido no envio** por `enviarPeloCanal(p: Envio)` (tarefa 5), que olha o prefixo do `phoneNumberId`. `DEPENDENCIAS_PADRAO.enviar` passa a usá-la, então a resposta da IA e o protocolo de urgência (`enviarProtocolo` usa o mesmo `enviar`) saem pelo canal certo sem mudar o motor.
3. **A orquestração por mensagem sai da rota da Meta** para `lib/conversations/entrada.ts` (`tratarMensagem`, tarefa 2), sem mudar o comportamento. As duas rotas usam o mesmo caminho: gravar, agendar o protocolo, agendar a resposta.
4. **Eco ou mensagem nossa.** A Evolution manda `fromMe: true` tanto para a mensagem digitada no celular do chip (eco) quanto, possivelmente, para a que nós enviamos pela API. Se a nossa fosse lida como eco, a IA se calaria na própria resposta. Regra da rota (tarefa 7):
   - `fromMe` cujo `evo:<key.id>` já existe em `messages` é nossa: ignora, com 200;
   - `fromMe` numa conversa com resposta da IA ainda `pending` pode ser a nossa antes do `confirm_ai_reply`: responde 500, e a Evolution reenvia, já com o id gravado;
   - o resto é eco de verdade.

   Se a doc oficial (tarefa 1) mostrar que o envio pela API chega em outro evento (`SEND_MESSAGE`), a regra continua inofensiva, e o teste fica.
5. **Teto diário sem tabela nova:** conta `messages` com `author = 'ai'` da clínica desde a meia-noite de São Paulo. No teto, a conversa passa para a equipe (`handled_by = 'human'`, `ai_failed_at = agora`) por um `update` do `service_role` filtrado por clínica, e a IA não é chamada.
6. **Tela de Conversas da demonstração** (tarefa 8):
   - a fila é a real (`listarConversas`) mais as de exemplo (`relogio.deslocar(CONVERSAS)`);
   - id uuid abre pela leitura real, com `modo: { tipo: "clinica", agir }` e sem ficha;
   - id de fixture (`c-urgente` e afins) abre como hoje, com o protótipo;
   - a busca vira `BuscaDaFila`, e a action `buscar` junta as conversas reais e as de exemplo quando `isDemo`;
   - `?q=` deixa de ser lido também na demonstração.
7. **Limpeza apaga o paciente** (a cascata leva conversas, mensagens, sessões e eventos) e desconecta o agente (`paused`, identificador, WABA e token nulos). A demonstração volta ao estado de antes, e o `prepararContaDeDemonstracao` volta a passar.
8. **Variáveis**, todas só no `.env` local e nunca na Vercel:
   - `EVOLUTION_API_URL` (ex.: `http://localhost:8080`);
   - `EVOLUTION_INSTANCE`;
   - `EVOLUTION_WEBHOOK_SECRET`;
   - `EVOLUTION_ALLOWED_NUMBERS` (E.164 separados por vírgula);
   - `EVOLUTION_DAILY_CAP` (padrão 100);
   - `EVOLUTION_API_KEY` (a chave global do servidor, usada só pelos scripts);
   - `EVOLUTION_INSTANCE_TOKEN` (lido pelo script de conexão, que o grava cifrado no agente).

   Sem as quatro primeiras, a rota responde 404.

## Restrições globais
- **Banco:** migration aditiva em `supabase/migrations/`, com `--dry-run` antes, aplicada uma de cada vez. Migration e o código que a usa no mesmo commit. O banco é compartilhado com a landing em produção. Esta migration troca a função de um trigger existente e não muda grant; mudar grant pede confirmação do Jhones.
- **Dado de paciente:** conteúdo sempre cifrado. Nunca logar conteúdo, telefone nem objeto de erro cru: só `erroParaLog`. Nome e telefone de paciente nunca em URL. RLS por `clinic_id`, com teste de isolamento contra o banco real para toda leitura nova.
- **Testes de banco:** um login por usuário por arquivo; arquivos de banco um de cada vez; datas no futuro, calculadas na execução (pg_cron). Nos testes, clínica de demonstração **temporária** (`is_demo = true`, criada e apagada pelo teste), nunca a real.
- **Dado de exemplo:** só na conta de demonstração. Componente e lib não importam nada de `app/`.
- **Datas:** formatação só por `lib/formatters`, nunca `new Date()` dentro de componente.
- **Vitest:** ler o resultado antes de cada commit, com o código de saída real (`; echo exit=$?`, sem `| tail`). A suíte inteira lê o disco: nada de editar arquivo enquanto ela roda. `beforeEach` com corpo em bloco.
- **`next dev` reescreve o `CLAUDE.md`:** `git checkout -- CLAUDE.md` antes de cada commit e do push.
- **Git:** commits pequenos na `staging`. Nada na `main`, e nenhum PR sem o Jhones pedir.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/conversations/entrada.ts` (novo) | `tratarMensagem`: gravar, agendar protocolo e resposta |
| `app/api/whatsapp/webhook/route.ts` | passa a usar `tratarMensagem` |
| `supabase/migrations/20261012120000_demo_evolution_channel.sql` (novo) | NX004 restrito ao `authenticated`, NX005 |
| `lib/whatsapp/evolution-webhook.ts` (novo) | leitura pura do payload da Evolution |
| `lib/whatsapp/evolution.ts` (novo) | cliente HTTP da Evolution (`sendText`) e `EvolutionError` |
| `lib/whatsapp/canal.ts` (novo) | `enviarPeloCanal`: Meta ou Evolution pelo prefixo |
| `lib/conversations/resposta.ts` | `DEPENDENCIAS_PADRAO.enviar` usa `enviarPeloCanal`; `repetivel` aceita `EvolutionError` |
| `lib/whatsapp/evolution-config.ts` (novo) | lê e valida `EVOLUTION_*` |
| `lib/conversations/teto.ts` (novo) | teto diário e passagem para a equipe |
| `app/api/whatsapp/evolution/route.ts` (novo) | a rota do canal |
| `app/(dashboard)/dashboard/conversations/page.tsx` e `acoes.ts` | a demonstração com a conversa real e a busca por POST |
| `components/conversations/caixa-de-conversas.tsx` | modo da conversa aberta vindo da página |
| `scripts/canal-demo.ts`, `scripts/canal-demo/conectar.ts`, `scripts/canal-demo/limpar.ts` (novos) | conexão e limpeza |
| `scripts/canal-demo/docker-compose.yml` (novo) | Evolution, Postgres e Redis locais |
| `lib/admin/audit.ts` e `lib/admin/auditoria.ts` | ações `clinic.demo_channel_connect` e `clinic.demo_channel_clear` |
| `docs/infra-setup.md`, `.env.example` | passo a passo e variáveis sem valor |

---

### Tarefa 1: Conferir a Evolution na documentação oficial

Nada de código. As fontes da spec eram espelhos. O que for confirmado vai para a seção "Notas da Evolution", no fim deste plano.

- [x] Ler a documentação oficial da Evolution API v2 (`doc.evolution-api.com` e o repositório `EvolutionAPI/evolution-api`, `.env.example` e `docker-compose`) e anotar:
  1. imagem e tag estáveis, e as variáveis mínimas do servidor (`AUTHENTICATION_API_KEY`, banco Postgres, cache Redis, `SERVER_URL`);
  2. criar instância (`POST /instance/create`, com `integration: "WHATSAPP-BAILEYS"`), o token da instância que volta, e pegar o QR (`GET /instance/connect/{instância}`);
  3. configurar o webhook da instância com URL, eventos (`MESSAGES_UPSERT`) e **cabeçalhos próprios** (o segredo);
  4. o formato exato do `MESSAGES_UPSERT`: `event`, `instance`, `data.key.{remoteJid, fromMe, id}`, `data.pushName`, `data.message.{conversation, extendedTextMessage.text, audioMessage...}` e `data.messageTimestamp`;
  5. **se a mensagem enviada pela API chega como `MESSAGES_UPSERT` com `fromMe`, ou só como `SEND_MESSAGE`** (decisão 4);
  6. o `sendText`: corpo (`number`, `text`), cabeçalho `apikey` e o id da mensagem na resposta (`key.id`);
  7. a política de reenvio do webhook (que códigos ele repete).
- [x] Se algum fato contradisser a spec ou este plano, parar e levar ao Jhones antes de seguir.
- [x] Commit: `docs: notas da Evolution API v2 no plano do canal de demonstração`.

### Tarefa 2: Orquestração da mensagem na lib

**Arquivos:** criar `lib/conversations/entrada.ts` e `lib/conversations/entrada.test.ts`; mudar `app/api/whatsapp/webhook/route.ts`.

**Interface produzida:**
```ts
export type Agendar = (etapa: "resposta" | "protocolo", tarefa: () => Promise<unknown>) => void
/** Grava a mensagem e agenda o protocolo e a resposta da IA, como a rota da Meta fazia. */
export async function tratarMensagem(
  m: MensagemDoWebhook,
  agendar: Agendar,
  opcoes?: { podeResponder?: (r: ResultadoDaRecepcao) => Promise<boolean> },
): Promise<ResultadoDaRecepcao | null>
```
- O corpo é o que hoje está no `if (evento.tipo === "mensagem")` da rota: `receberMensagem`, depois agendar `enviarProtocolo` se houver protocolo e `responderConversa` nas mesmas condições (`autor === "patient"`, `nova || !jaRespondida`, `agenteAtivo`, `!optOut`, `!urgente`).
- `podeResponder` (o teto) só é consultado quando a resposta seria agendada.

- [x] Testes em `entrada.test.ts`, com `receberMensagem`, `responderConversa` e `enviarProtocolo` mockados:
  - mensagem nova do paciente agenda só a resposta;
  - urgente com protocolo agenda só o protocolo;
  - opt-out não agenda nada;
  - eco (`human`) não agenda nada;
  - reenvio já respondido não agenda nada, e reenvio sem resposta agenda;
  - agente fora do ar não agenda resposta;
  - `podeResponder` falso não agenda resposta, e o protocolo sai mesmo assim;
  - `receberMensagem` devolvendo `null` não agenda nada.
- [x] Rodar e ver falhar; implementar; mudar a rota para `tratarMensagem(evento, (etapa, t) => after(() => emSegundoPlano(etapa, t)))`.
- [x] `npx vitest run lib/conversations/entrada.test.ts`, depois `tests/whatsapp/webhook.test.ts` sozinho (banco): os 30 casos seguem passando.
- [x] Commit: `refactor(whatsapp): orquestração da mensagem do webhook na lib`.

### Tarefa 3: A trava da demonstração para o canal (migration)

**Arquivos:** criar `supabase/migrations/20261012120000_demo_evolution_channel.sql` e `tests/rls/demo-evolution.test.ts`.

- [x] Ler `20260927250000_demo_clinic_no_whatsapp.sql` (o original) e escrever o `create or replace function private.agent_block_demo()` novo:
  - `new.whatsapp_phone_number_id like 'evolution:%'` numa clínica que **não** é demonstração: `raise … using errcode = 'NX005'` ("Canal de demonstração só existe na clínica de demonstração.");
  - clínica de demonstração com `auth.role() = 'service_role'`: aceita identificador `evolution:%` (e `status = 'active'` com ele); identificador que não começa com `evolution:` continua NX004;
  - clínica de demonstração com qualquer outro papel: NX004, como antes;
  - comentário da função atualizado, citando a spec `evolution-demo-v1`.
- [x] `clinic_block_demo_with_whatsapp` não muda. O trigger continua se chamando `agents_block_demo`, para rodar antes do `agents_enforce_publish`.
- [x] Testes contra o banco, com uma clínica de demonstração temporária (`is_demo = true` pelo `service_role`) e uma clínica comum. Owner da temporária com login próprio, um por arquivo:
  - o owner (`authenticated`) da demonstração não grava `evolution:x` nem identificador da Meta e não publica (NX004);
  - o `service_role` grava `evolution:<id>`, a WABA e o token cifrado, e publica (`active`);
  - o `service_role` não grava identificador da Meta na demonstração (NX004);
  - `evolution:` na clínica comum é recusado para o owner e para o `service_role` (NX005);
  - `tests/rls/conta-demo.test.ts` (o NX004 original) segue passando, rodado sozinho.
- [x] `npx supabase db push --dry-run`, conferir que só entra esta migration, e aplicar (`echo y | npx supabase db push`).
- [x] Rodar `tests/rls/demo-evolution.test.ts` e `tests/rls/conta-demo.test.ts`, um de cada vez.
- [x] Commit (migration e teste juntos): `feat(demo): canal de demonstração só pelo service_role, e só na clínica de demonstração`.

### Tarefa 4: Leitura do payload da Evolution

**Arquivos:** criar `lib/whatsapp/evolution-webhook.ts` e `lib/whatsapp/evolution-webhook.test.ts`.

**Interface produzida:**
```ts
export type MotivoIgnorado = "evento" | "instancia" | "grupo" | "nao-permitido" | "formato"
export type LeituraDaEvolution =
  | { tipo: "mensagem"; mensagem: MensagemDoWebhook }
  | { tipo: "ignorada"; motivo: MotivoIgnorado }
export function interpretarEvolution(
  payload: unknown,
  cfg: { instancia: string; permitidos: ReadonlySet<string> },
): LeituraDaEvolution
export const PREFIXO_DO_CANAL = "evolution:"
export const PREFIXO_DO_ID = "evo:"
```
Mapeamento: `phoneNumberId` e `wabaId` = `evolution:<instância>`; `waMessageId` = `evo:<key.id>`; `waIdDoPaciente` = os dígitos do `remoteJid` (antes de `@s.whatsapp.net`); `autor` = `human` se `fromMe`, senão `patient`; `nomeDoPerfil` = `pushName` só do paciente; `ocorridaEm` = `messageTimestamp` (segundos) em ISO; `midia` e `texto` a partir de `conversation`, `extendedTextMessage.text`, `audioMessage`, `imageMessage` e `documentMessage`.

- [x] Testes com payloads tirados da tarefa 1:
  - texto simples e texto estendido;
  - `fromMe` vira `human`;
  - áudio vira `midia: "audio"` com `texto: null`;
  - grupo (`@g.us`), status (`status@broadcast`) e lista de transmissão são ignorados;
  - outra instância, outro evento e JSON fora do formato são ignorados;
  - número fora da lista é ignorado, e número da lista passa (a comparação é por E.164: `+` mais os dígitos);
  - os ids levam os prefixos.
- [x] Rodar e ver falhar; implementar; rodar.
- [x] Commit: `feat(whatsapp): leitura do webhook da Evolution para o formato da recepção`.

### Tarefa 5: Cliente da Evolution e escolha do canal

**Arquivos:** criar `lib/whatsapp/evolution.ts`, `lib/whatsapp/evolution.test.ts`, `lib/whatsapp/canal.ts` e `lib/whatsapp/canal.test.ts`; mudar `lib/conversations/resposta.ts`.

**Interfaces produzidas:**
```ts
// evolution.ts
export class EvolutionError extends Error {
  constructor(readonly codigo: string, readonly status: number, readonly repetivel: boolean)
}
export async function enviarTextoPelaEvolution(
  p: Envio,
  opcoes?: { fetch?: typeof fetch; url?: string },
): Promise<{ waMessageId: string }>
// canal.ts
export function canalDoAgente(phoneNumberId: string): "meta" | "evolution"
export async function enviarPeloCanal(p: Envio, opcoes?: { fetch?: typeof fetch }): Promise<{ waMessageId: string }>
```
- O envio é `POST ${EVOLUTION_API_URL}/message/sendText/${instância}`, com `apikey: decifrarSegredo(p.tokenCifrado)` e corpo `{ number: p.para, text: p.texto }`. Devolve `evo:<key.id>`.
- Sem `key.id` na resposta, lança `EvolutionError("resposta-sem-id", 200, false)`. 429 é repetível; 5xx não, pela mesma razão da Meta (pode ter enviado).
- `resposta.ts`: `enviar` usa `enviarPeloCanal`, e `repetivel` inclui `EvolutionError`.

- [x] Testes com `fetch` interceptado:
  - URL, cabeçalho e corpo certos;
  - id com prefixo;
  - sem id, 429 e 500 com as classes certas;
  - erro sem conteúdo nem telefone na mensagem;
  - `canalDoAgente` pelo prefixo;
  - `enviarPeloCanal` chama a Meta para identificador comum e a Evolution para `evolution:`.
- [x] `npx vitest run lib/whatsapp lib/conversations`, depois `tests/conversations/resposta.test.ts` sozinho (banco).
- [x] Commit: `feat(whatsapp): cliente da Evolution e envio pelo canal do agente`.

### Tarefa 6: Teto diário

**Arquivos:** criar `lib/conversations/teto.ts` e `tests/conversations/teto.test.ts` (banco).

**Interface produzida:**
```ts
export function inicioDoDiaEmSaoPaulo(agora: string): string
export async function dentroDoTeto(clinicId: string, teto: number, agora: string): Promise<boolean>
export async function passarParaEquipePorTeto(clinicId: string, conversationId: string, agora: string): Promise<void>
```
- [ ] Testes:
  - unitários de `inicioDoDiaEmSaoPaulo` (antes e depois da meia-noite local, e virada de UTC);
  - banco, com clínica temporária: abaixo do teto dá `true`; no teto dá `false`; resposta de ontem não conta; resposta de outra clínica não conta; `passarParaEquipePorTeto` muda só a conversa da clínica dada.
- [ ] Commit: `feat(conversations): teto diário de respostas da IA no canal de demonstração`.

### Tarefa 7: A rota do canal

**Arquivos:** criar `lib/whatsapp/evolution-config.ts` (com teste unitário), `app/api/whatsapp/evolution/route.ts` e `tests/whatsapp/evolution.test.ts` (banco, no padrão de `tests/whatsapp/webhook.test.ts`: `after` mockado, OpenRouter e `fetch` interceptados).

**Interface produzida:**
```ts
export type ConfigDaEvolution = { url: string; instancia: string; segredo: string; permitidos: ReadonlySet<string>; teto: number }
export function lerConfigDaEvolution(env: NodeJS.ProcessEnv): ConfigDaEvolution | null
```
**Fluxo do `POST`:**
1. Sem config, 404.
2. O cabeçalho `x-nextech-secret`, comparado com `comparacaoSegura`. Faltando ou errado, 401.
3. JSON inválido, 400.
4. `interpretarEvolution`. Ignorada: 200, com log `{ etapa: "ignorada", motivo }`, sem telefone.
5. `fromMe`: a regra da decisão 4. Id `evo:` já gravado, 200; resposta `pending` na conversa, 500.
6. `tratarMensagem(m, agendar, { podeResponder })`, em que `podeResponder` chama `dentroDoTeto` e, no teto, `passarParaEquipePorTeto` antes de devolver `false`.
7. Falha transitória, 500; definitiva, 200. Log com `erroParaLog`, como na rota da Meta.

- [ ] Testes contra o banco (clínica de demonstração temporária, com o agente conectado ao canal pelo `service_role`), um por critério de aceite da spec:
  - sem config, 404;
  - segredo errado, 401;
  - número permitido grava e a resposta sai pela Evolution;
  - `fromMe` vira eco e silencia a IA;
  - fora da lista, nada gravado e o log sem o número;
  - grupo e outro evento, 200;
  - o mesmo `key.id` duas vezes dá uma mensagem e uma resposta;
  - urgência manda o protocolo pela Evolution;
  - opt-out sem resposta;
  - falha da Evolution passa a conversa para a equipe sem nada enviado;
  - no teto, nenhuma chamada à IA;
  - `fromMe` com o id da nossa resposta é ignorado, e com resposta `pending` dá 500;
  - log sem conteúdo nem telefone em todos os casos (`console` espionado).
- [ ] **Áudio** (edge case da spec): ler o que `responderConversa` e o histórico do modelo fazem com mensagem sem texto (`midia: "audio"`), escrever um teste que fixe esse comportamento e registrar o resultado em "Ajustes" deste plano. Se a IA responder como se tivesse ouvido, levar ao Jhones antes de seguir.
- [ ] Rodar o arquivo sozinho; depois `tests/whatsapp/webhook.test.ts` sozinho.
- [ ] Commit: `feat(whatsapp): rota do canal de demonstração pela Evolution`.

### Tarefa 8: A tela de Conversas da demonstração com a conversa real

**Arquivos:** mudar `app/(dashboard)/dashboard/conversations/page.tsx`, `app/(dashboard)/dashboard/conversations/acoes.ts` (e `acoes.test.ts`) e `components/conversations/caixa-de-conversas.tsx`; testes em `tests/demo/rotas.test.ts` e `components/conversations/conversas.test.tsx`.

- [ ] Página, no ramo `isDemo`:
  - fila = `[...await listarConversas(), ...relogio.deslocar(CONVERSAS)]`, filtrada e contada como hoje;
  - `pedida` uuid abre por `abrirConversa`, com `modo: { tipo: "clinica", agir }` e sem `caminhoDaFicha`;
  - `pedida` de fixture abre como hoje;
  - `aoVivo={<AoVivo clinicId={clinicId} />}` e `buscar={buscar}` também na demonstração;
  - nenhuma leitura de `params.q`.
- [ ] `acoes.ts`: `buscar` lê `isDemo` pelo `requireClinicContext()`. Na demonstração, junta `buscarConversas(t)` com as fixtures que casam (`filtrarConversas(relogio.deslocar(CONVERSAS), { estado: "todas", busca: t })`).
- [ ] `CaixaDeConversas`: com `buscar`, sempre `BuscaDaFila`; o protótipo da busca em URL (`Busca` com `?q=`) sai da tela de Conversas.
- [ ] Testes:
  - a demonstração junta a real e a de exemplo, na ordem certa e com a contagem certa;
  - a real abre com as ações reais e sem ficha;
  - a de exemplo abre com o protótipo;
  - a página da demonstração não lê `?q=`;
  - a busca da demonstração devolve a real e a de exemplo;
  - fora da demonstração, a busca não traz fixture;
  - o isolamento segue coberto (a leitura real é a da tarefa 4 da parte 4; rodar `tests/conversations/leitura.test.ts` sozinho).
- [ ] Commit: `feat(demo): Conversas da demonstração com a conversa real do canal`.

### Tarefa 9: Scripts de conexão e limpeza

**Arquivos:** criar `scripts/canal-demo.ts` (o executável: `npx tsx scripts/canal-demo.ts conectar|limpar`), `scripts/canal-demo/conectar.ts`, `scripts/canal-demo/limpar.ts` e `tests/rls/canal-demo.test.ts` (banco, com clínica de demonstração temporária); mudar `lib/admin/audit.ts` e `lib/admin/auditoria.ts` (com teste).

**Interfaces produzidas:**
```ts
export async function conectarCanalDeDemonstracao(
  db: SupabaseClient,
  p: { clinicId: string; instancia: string; tokenDaInstancia: string; confirmadorEmail: string },
): Promise<{ agente: "criado" | "atualizado"; regra: "criada" | "ja-existia" }>
export async function limparCanalDeDemonstracao(
  db: SupabaseClient,
  p: { clinicId: string; autorEmail: string },
): Promise<{ pacientesApagados: number }>
```
- [ ] Conectar:
  - recusa clínica sem `is_demo`;
  - cria ou atualiza o agente "Canal de demonstração" com persona, saudação e horário fictícios, `whatsapp_phone_number_id` e `whatsapp_waba_id` = `evolution:<instância>`, `whatsapp_access_token_encrypted = cifrarSegredo(token)` e `status = 'active'`;
  - garante a regra de urgência "Dor forte" ativa, com palavras e protocolo fictícios e confirmação completa (`confirmed_by` do `admin@`, `confirmed_at` e `confirmed_content_hash = hashDoConteudo(...)`);
  - grava `clinic.demo_channel_connect` na trilha.
- [ ] Limpar:
  - apaga os pacientes da clínica (a cascata leva o resto);
  - pausa o agente do canal e zera identificador, WABA e token;
  - grava `clinic.demo_channel_clear`;
  - confere que não sobrou paciente, conversa, mensagem nem agente com identificador.
- [ ] `auditoria.ts`: frases das duas ações novas ("Conectou o canal de demonstração" e "Limpou o canal de demonstração"), com `suporte: false` e teste.
- [ ] Testes contra o banco:
  - conectar duas vezes dá o mesmo estado;
  - o agente fica `active`;
  - a regra fica ativa;
  - conectar em clínica comum é recusado;
  - limpar depois de uma conversa gravada deixa a clínica zerada;
  - limpar duas vezes não falha;
  - depois da limpeza, `prepararContaDeDemonstracao` passa.
- [ ] Commit: `feat(demo): scripts de conexão e limpeza do canal de demonstração`.

### Tarefa 10: Infra local e documentação de uso

**Arquivos:** criar `scripts/canal-demo/docker-compose.yml`; mudar `.env.example`, `docs/infra-setup.md`, `.claude/skills/integrations/SKILL.md`, `.claude/skills/architecture/SKILL.md` e `docs/specs/demo-account-v1.md`.

- [ ] `docker-compose.yml` com a Evolution (imagem e tag da tarefa 1), Postgres e Redis. A porta só em `127.0.0.1:8080`, e `AUTHENTICATION_API_KEY` vinda de um `.env` ao lado, fora do git.
- [ ] `.env.example`: as variáveis `EVOLUTION_*`, sem valor, com um comentário de que nunca vão para a Vercel.
- [ ] `docs/infra-setup.md`, seção "Canal de demonstração (Evolution)", com o roteiro inteiro:
  1. subir o Docker Desktop e o compose;
  2. criar a instância e guardar o token;
  3. escanear o QR com o celular do chip;
  4. configurar o webhook para `http://host.docker.internal:3000/api/whatsapp/evolution`, com o cabeçalho `x-nextech-secret`;
  5. preencher o `.env`;
  6. `npx tsx scripts/canal-demo.ts conectar`;
  7. `npm run build` e `npx next start -p 3000`;
  8. o ensaio;
  9. **no fim, `npx tsx scripts/canal-demo.ts limpar`**.
- [ ] Skills `integrations` e `architecture`: a Evolution continua fora do produto e existe só como canal de demonstração, com a spec citada.
- [ ] `demo-account-v1.md`: a seção da mudança (a conversa real do canal, NX004 restrito ao `authenticated`, busca por POST).
- [ ] Pedir ao Jhones os números da lista de permitidos e do ensaio.
- [ ] Commit: `docs: infra local e roteiro do canal de demonstração`.

### Tarefa 11: Revisão visual e ensaio real

Carregar `frontend-design` e `ui-ux` antes. O ensaio precisa do Jhones presente, com o celular do chip e outro celular.

- [ ] Subir tudo pelo roteiro da tarefa 10. Conferir antes que não há `next start` antigo na porta.
- [ ] **Ensaio** (último critério de aceite da spec), pelo `clinica@`:
  - três conversas do outro celular, cada uma respondida em menos de 30 s;
  - uma urgência com o protocolo;
  - uma resposta digitada no celular do chip, que cala a IA;
  - a conversa aparecendo ao vivo na tela de Conversas, entre as de exemplo;
  - assumir e devolver na conversa real;
  - a busca achando a real.
- [ ] **Capturas** de `/dashboard/conversations` com a conversa real aberta, nos dois temas, em 1440 e 390 px, sem rolagem horizontal (`docs/design/shot-referencia.mjs` copiado para o scratchpad, com `npm i playwright-core@1` lá).
- [ ] Tour pelo sidebar inteiro no mesmo login: nenhuma tela quebrada.
- [ ] **Limpar** (`scripts/canal-demo.ts limpar`) e conferir no banco que a demonstração voltou ao estado de antes.
- [ ] Corrigir o que aparecer, com teste, e fazer o commit `fix(demo): ajustes do ensaio do canal de demonstração`, se houver.

### Tarefa 12: Verificação final, revisões e fechamento

- [ ] `npx vitest run` inteiro em segundo plano, com o commit e o `git status` no topo do arquivo de saída e `echo exit=$?` no fim; `npx tsc --noEmit`; `npm run build`.
- [ ] `security-reviewer` e `qa-reviewer` sobre o diff (commits desde este plano). Tratar os achados, pedir a conferência das correções e a das correções da conferência.
- [ ] Documentação:
  - este plano (status, commits, ajustes, o que a próxima sessão precisa saber);
  - a spec `evolution-demo-v1.md` (critérios marcados);
  - `docs/roadmap.md`;
  - `docs/status.md` (o contador de testes e de migrations, e a próxima sessão: o PR `staging` → `main` quando o Jhones pedir, depois a posse do WhatsApp e o MFA);
  - a memória do projeto.
- [ ] Suíte inteira no último commit, `git status` limpo, `git checkout -- CLAUDE.md` e `git push origin staging`. Se pedir login, parar e avisar o Jhones.

---

## Notas da Evolution (tarefa 1, 2026-10-11)

Fonte: o código da tag `2.3.7` do repositório `EvolutionAPI/evolution-api` (a última estável; a `2.4.0` ainda é `rc2`) e as tags do Docker Hub. Arquivos lidos: `docker-compose.yaml`, `env.example`, `whatsapp.baileys.service.ts`, `channel.service.ts`, `webhook.controller.ts`, `webhook.schema.ts`, `instance.controller.ts`, `sendMessage.router.ts`, `sendMessage.dto.ts`, `auth.guard.ts` e `createJid.ts`.

1. **Imagem e servidor.**
   - Imagem `evoapicloud/evolution-api:v2.3.7` (a `latest` tem outro digest e é de maio de 2026: fixar a tag).
   - O compose oficial sobe API, Postgres 15, Redis e um frontend (`evolution-manager`) na porta **3000**, a mesma do `next start`: o nosso compose deixa o frontend de fora, e também a rede externa `dokploy-network`.
   - Variáveis mínimas: `SERVER_URL`, `AUTHENTICATION_API_KEY`, `DATABASE_PROVIDER=postgresql`, `DATABASE_CONNECTION_URI`, `CACHE_REDIS_ENABLED`, `CACHE_REDIS_URI`, `CACHE_LOCAL_ENABLED=false`.
   - **Padrões que importam para a LGPD:** `DATABASE_SAVE_DATA_NEW_MESSAGE`, `_CONTACTS`, `_CHATS`, `_HISTORIC`, `_LABELS`, `_MESSAGE_UPDATE` e `_IS_ON_WHATSAPP` vêm `true` (a Evolution guarda mensagem, contato e número no Postgres dela, em texto puro); `TELEMETRY_ENABLED=true`; e o serviço faz `console.log(messageRaw)` de toda mensagem recebida, sem nível de log que desligue. Ver a decisão sobre o resíduo, abaixo.
   - `AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=false` (padrão) deixa o campo `apikey` do envelope do webhook nulo. Manter assim.
2. **Instância.** `POST /instance/create` com o cabeçalho `apikey` global e `{ instanceName, integration: "WHATSAPP-BAILEYS", qrcode: true }`. A resposta traz `hash`, que é o token da instância (string; dá para fixar mandando `token` no corpo). O QR vem em `qrcode` na criação e em `GET /instance/connect/{instância}`. O estado sai em `GET /instance/connectionState/{instância}`.
3. **Webhook da instância.** `POST /webhook/set/{instância}` com `{ webhook: { enabled: true, url, headers: { "x-nextech-secret": … }, byEvents: false, base64: false, events: ["MESSAGES_UPSERT"] } }`. Os `headers` vão em toda chamada. Do Docker Desktop para o app no Windows: `http://host.docker.internal:3000/...`.
4. **`MESSAGES_UPSERT`.**
   - Envelope: `{ event: "messages.upsert", instance, data, destination, date_time, sender, server_url, apikey }`. O `event` chega **minúsculo, com ponto**; o nome em maiúsculas é só o da configuração.
   - `data`: `{ key: { remoteJid, fromMe, id, participant?, remoteJidAlt? }, pushName, status, message, contextInfo, messageType, messageTimestamp, instanceId, source }`.
   - `messageTimestamp` é número, em segundos.
   - A Evolution **converte `extendedTextMessage` em `message.conversation`** antes do webhook (`prepareMessage`). A leitura aceita os dois, por segurança.
   - Mídia: `audioMessage`, `imageMessage`, `videoMessage`, `documentMessage` (o `documentWithCaptionMessage` vira `documentMessage`), `stickerMessage`, `ptvMessage`. Com `base64: false`, o conteúdo da mídia não vem.
   - **`@lid`:** o `remoteJid` pode chegar como `<lid>@lid`. A Evolution troca pelo `remoteJidAlt` (o jid do telefone) quando ele existe; sem ele, não há telefone, e a leitura ignora (`formato`).
   - Com `fromMe`, o `pushName` vem `"Você"`; o `remoteJid` é sempre o do outro lado (o paciente).
   - Só os tipos `notify` e `append` do Baileys viram webhook.
5. **A mensagem enviada pela API não chega como `MESSAGES_UPSERT`.** O socket sobe com `emitOwnEvents: false`, e o envio dispara só `SEND_MESSAGE` (não assinado). A regra da decisão 4 fica como defesa e o teste fica, como previsto. A mensagem digitada no celular do chip chega como `MESSAGES_UPSERT` com `fromMe: true`.
6. **`sendText`.** `POST /message/sendText/{instância}`, cabeçalho `apikey` (o global **ou o token da instância**: o guard compara com `instance.token` no banco da Evolution), corpo `{ number, text }`. Resposta **201** com o `messageRaw` enviado, de onde sai `key.id`. O `number` aceita dígitos, com ou sem `+` (o `createJid` tira `+`, espaços e parênteses). Número fora do WhatsApp responde 400.
7. **Reenvio do webhook.** Até 10 tentativas (`WEBHOOK_RETRY_MAX_ATTEMPTS`), espera exponencial a partir de 5 s, teto de 300 s, jitter de 20%. **Não reenvia 400, 401, 403, 404 e 422** (`WEBHOOK_RETRY_NON_RETRYABLE_STATUS_CODES`); 500 e timeout (30 s) são reenviados. Bate com o plano: 500 para falha transitória e para a decisão 4; 401 e 404 encerram.
8. **Nono dígito.** O `createJid` tira o 9 do celular brasileiro com DDD 31 ou maior (formato antigo do WhatsApp), e o `remoteJid` desses números chega com 12 dígitos. A lista de permitidos compara pela mesma chave nos dois formatos: `55` + DDD + 9 + 8 dígitos casa com `55` + DDD + 8 dígitos.

**Decisão do Jhones sobre o resíduo na Evolution (2026-10-11): não guardar.** O compose da tarefa 10 sobe a Evolution com:
- `DATABASE_SAVE_DATA_NEW_MESSAGE`, `_MESSAGE_UPDATE`, `_CONTACTS`, `_CHATS`, `_HISTORIC`, `_LABELS` e `_IS_ON_WHATSAPP` em `false`; `DATABASE_SAVE_DATA_INSTANCE=true` (o guard do token da instância lê a tabela de instâncias);
- `TELEMETRY_ENABLED=false`;
- `logging: driver: none` no serviço da API (o `console.log(messageRaw)` não fica em lugar nenhum).

Fica só a sessão do chip (chaves de cifra por contato, como em qualquer aparelho). Custo aceito: se o celular do investidor pedir reenvio de uma mensagem nossa (falha rara de decifração), o `getMessage` não acha o original, e o reenvio pode sair vazio. O celular do chip guarda a conversa como qualquer WhatsApp: o roteiro da limpeza inclui apagar as conversas nele.

## Ajustes da execução

- **Tarefa 3.** O NX004 original é testado em `tests/rls/demo.test.ts`; o `conta-demo.test.ts` testa o script de preparo. Rodei os dois, um de cada vez (10 e 11 casos). As clínicas temporárias do teste novo são HealthTech, como a real: no Starter, o limite de 1 agente recusa o segundo antes da trava. A função ganhou um `coalesce` no `like`: com o identificador nulo, a comparação daria `null` e deixaria publicar sem número na demonstração (caso coberto no teste).
- **Tarefa 4.** `MotivoIgnorado` ganhou `sem-conteudo` (reação, edição, apagamento, voto): não são formato errado, e o log do ensaio fica legível. A lista de permitidos compara por `chaveDoNumero` (nota 8 da Evolution), e `@lid` sem `remoteJidAlt` é `formato`. A checagem da lista vem antes da leitura do conteúdo.
- **Tarefa 5.** O `EvolutionError` usa `code` (e não `codigo`, como a interface do plano dizia), igual ao `MetaError`: é a propriedade que o `erroParaLog` leva ao log e o `fail_ai_reply` grava. O `status` aceita `null` (sem resposta da Evolution, `rede`). O `resposta-sem-id` leva o status real da resposta (201), não 200. O envio pela Evolution também ganhou casos no `dependencias.test.ts` (o caminho de produção do `enviar`).

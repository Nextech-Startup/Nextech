# Motor de conversa, parte 3 (urgência, opt-out e manutenção): plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:executing-plans`, tarefa por tarefa, sem subagentes. Carregue `supabase-postgres-best-practices` antes das tarefas 2 e 4. Os passos usam checkbox (`- [ ]`).

## Status da execução: ✅ concluído em 2026-09-27

- **Feito:** tarefas 1 a 5, na `staging` local, sem push.
  - `813cb48`: pendência da parte 2, as lacunas da conferência de QA;
  - `f505a79`: este plano;
  - `0942cd9`, `57e65f1`, `e108b29` e `b11b456`: tarefas 1 a 4;
  - `6f23df8`: achados da revisão de segurança;
  - `29464e4`: lacunas da revisão de QA;
  - `6e2b683`, `bc5d85a` e `7c1cdb9`: as decisões do Jhones sobre as observações O7, O6 e O9;
  - `236a928`: achados da conferência de segurança dessas decisões;
  - o `docs:` que fecha a parte.
- **Banco:** cinco migrations, aplicadas uma a uma depois do `--dry-run`. O banco tem 20.
  - `20260927180000_urgency_escalation.sql`;
  - `20260927190000_engine_maintenance.sql`: pg_cron e as duas funções;
  - `20260927200000_engine_maintenance_locks.sql`: conversa antes de mensagem e `skip locked` (O1), e só resposta a mensagem do paciente (O3);
  - `20260927210000_session_timeout_grace.sql`: folga de 1 h no fechamento (O9);
  - `20260927220000_confirm_stale_session.sql`: a confirmação fecha por timeout a sessão vencida e não conta nela.
- **pg_cron:** conferido pela API de gestão do Supabase (`POST /v1/projects/{ref}/database/query`).
  - Três jobs ativos em `cron.job`, com dono `postgres` e `rolbypassrls = true`.
  - Tiques `succeeded` a cada 5 min desde 10:30 UTC, inclusive depois das migrations de correção.
  - Depois do primeiro tique, o banco ficou com 0 sessão vencida aberta e 0 resposta órfã. Antes havia várias, de rodadas de teste.
- **Testes:** 1104 passando em 99 arquivos no `236a928`, com o commit e a saída 0 gravados no próprio arquivo da suíte. `tsc` limpo e `npm run build` passando.
- **Revisões:** `security-reviewer` com revisão e duas conferências (a segunda sobre as decisões O6, O7 e O9); `qa-reviewer` com revisão e conferência. Os achados estão abaixo.

Ajustes feitos durante a execução, além do que o plano descrevia:

| Tarefa | Ajuste | Por quê |
|---|---|---|
| 1 | A recepção usa a `optOut` que já existia (`patient-v1`), e a `registrarOptOut` saiu | Era duplicata (observação O5 da segurança) |
| 2 | O insert em lote das regras de teste diz `active: false` explicitamente | Em lote, o PostgREST preenche com `null` a coluna que falta num dos objetos |
| 2 | `urgente` só quando a conversa ficou urgente (`ficouUrgente`) | Agente fora do ar e paciente anonimizado não marcam nada no banco (O2) |
| 3 | `enviarProtocolo` recebe `{ clinicId, conversationId, protocolo }` | A rota passa o protocolo já sem o nulo |
| 4 | A base de tempo dos testes de banco vai para o futuro | O cron real fecha sessões do passado no meio da rodada |
| — | A triagem casa por início de palavra | "dor" casava "adorei" e calava a IA (O6, decisão do Jhones) |
| — | O reenvio de mensagem ainda sem resposta agenda a resposta | A falha depois de gravar deixava a mensagem sem resposta e sem alerta (O7, decisão do Jhones) |

**Segurança** (revisão sobre `b11b456`; nenhum bloqueante):

| # | Achado | Decisão |
|---|---|---|
| I1 | A regra do `pg_net` não dizia onde fica o segredo | O segredo fica no Vault, e isso está no `CLAUDE.md` e na skill `architecture`. Dois testes de arquitetura: nenhum token literal em migration, e migration com `net.http_` precisa ler `vault.decrypted_secrets` |
| I2 | Nada provava que os jobs mexem em linha (FORCE RLS) | Conferido no banco: `postgres` tem `BYPASSRLS`, e os tiques limparam o que havia |
| O1 | Varredura e fechamento em ordem inversa à exclusão em cascata | Migration `20260927200000`, com teste estrutural |
| O2 | `urgente: true` sem escalada | `ficouUrgente`, com teste |
| O3 | Os 5 min dependem do `maxDuration` da rota | A varredura só pega resposta a mensagem do paciente, e um teste exige `maxDuration` abaixo dela |
| O4 | O opt-out não reconhece frases | Pré-requisito da fase 4 em `docs/status.md` (decisão do Jhones) |
| O5 | `optOut` duplicada | Removida |
| O6 | Substring na triagem | Início de palavra (decisão do Jhones) |
| O7 | Reenvio depois de falha sem resposta | O reenvio sem resposta agenda (decisão do Jhones) |
| O8 | Documentação | Esta tarefa 5 |
| O9 | Mensagem atrasada abria outra sessão | Folga de 1 h no cron (decisão do Jhones) |

**Segurança, conferência das decisões** (sobre `6e2b683`, `bc5d85a` e `7c1cdb9`; tratada no `236a928`):
- a `confirm_ai_reply` somava e estendia a sessão vencida que o cron ainda não tinha fechado. Com a folga, a resposta a uma mensagem atrasada reabria a sessão. Migration `20260927220000`, com teste;
- palavra-chave só de emoji ou símbolo nunca casaria. O schema recusa com mensagem, e a deduplicação usa a forma da triagem. O banco não tinha nenhuma assim;
- a falha de uma segunda execução pela mesma mensagem passava a conversa para a equipe mesmo com a primeira já respondida. Agora não passa, com teste.

**QA** (revisão sobre `b11b456`):
- As cinco correções da parte 2 (`813cb48`) falham quando desfeitas.
- As lacunas da parte 3 estão no `29464e4`:
  - o protocolo agendado no reenvio, com teste de rota e de ponta a ponta;
  - o opt-out gravado no reenvio;
  - escaladas simultâneas reservando um protocolo só;
  - dois casos de `ai-replies` que ainda dividiam conversa;
  - um intervalo instável na manutenção.
- A concorrência do `skip locked` foi para a dívida da ordem de trava.
- A conferência fechou as cinco. Ela apontou que o `urgente` depois de uma recusa da escalada não tinha teste de ponta a ponta. Entrou no `236a928`: o reenvio da mensagem urgente com a urgência desfeita dá `urgente: false`.

### O que a próxima sessão precisa saber

- **Próxima etapa:** a qualificação (`qualified_at`), que fecha a parte 3. Ela muda o retorno do OpenRouter: saída estruturada na mesma chamada ou uma segunda chamada, em aberto na spec.
- **Go-live:** antes de assinar o webhook, falta também a parte 4. Sem a tela, desfazer uma urgência, inclusive por falso positivo, só é possível direto no banco.
- **Teste de banco:**
  - a base de tempo fica no futuro (amanhã), calculada na execução, porque o pg_cron real fecha sessões paradas há mais de 1h20 e varre `pending` com mais de 5 min;
  - um login por usuário por arquivo, e arquivos de banco um de cada vez quando outra rodada estiver em curso.
- **Consultar o cron:** a API de gestão do Supabase roda SQL com o `SUPABASE_ACCESS_TOKEN` do `.env` (`cron.job` e `cron.job_run_details`).

**Objetivo:** fechar os pré-requisitos de go-live do motor de conversa que não mexem no contrato com o modelo.
- A palavra-chave de urgência dispara o protocolo da própria clínica e escala a conversa.
- O "PARAR" do paciente vale na hora, com qualquer estado do agente.
- A sessão vencida fecha sozinha, e a resposta presa em `pending` vai para a equipe.

**Arquitetura:**
- **Opt-out e urgência são detectados na recepção**, antes do 200, e não na resposta.
  - Se a gravação falhar, a rota devolve 500 e a Meta reenvia.
  - A marca (`opted_out`, `is_urgent`) nunca se perde num `after()` que morreu.
- **A escalada é uma função SQL**, `escalate_urgent_conversation`. Numa transação, com a ordem de trava paciente, agente, conversa, ela:
  - marca a conversa como urgente;
  - passa a conversa para a equipe;
  - reserva o protocolo como resposta `pending` à mensagem.
- **O envio do protocolo** roda no `after()`, com o mesmo código de enviar e confirmar da resposta da IA.
- **Manutenção:** duas funções SQL agendadas pelo **pg_cron** do próprio Supabase: fechar sessões vencidas e varrer respostas órfãs.

**Tecnologias:** Next.js 16.3 (`after()`), Supabase (RPC, pg_cron), Vitest.

**Specs:**
- `docs/specs/conversation-engine-v1.md`: comportamento 4 (urgência) e os edge cases de opt-out;
- `docs/specs/atendimento-billing-v1.md`: regra 3 (fechamento por timeout);
- `docs/specs/message-sequences-v1.md`: regra 5 (opt-out em todas as sequências);
- parte 2: `docs/superpowers/plans/2026-09-27-motor-de-conversa-parte-2.md` (reserva, envio e confirmação; decisão 2; tarefa 9b).

## Decisões deste plano

As decisões 1, 2 e 5 são do Jhones (2026-09-27). As demais seguem a alternativa recomendada, para a revisão dele no PR.

1. **Recorte:** esta sessão faz urgência, opt-out e manutenção. A **qualificação** fica para a próxima: ela muda o retorno do OpenRouter (saída estruturada) e ainda tem em aberto se é a mesma chamada ou uma segunda.
2. **Urgência com a equipe atendendo:** envia o protocolo e escala mesmo com `handled_by = human`. A clínica confirmou a regra, e quem respondeu há 1 h pelo celular pode não estar olhando agora.
3. **Detecção na recepção, e não na resposta:**
   - o opt-out é direito do paciente e vale com o agente pausado ou com a equipe atendendo;
   - a urgência precisa da marca gravada mesmo que o envio do protocolo falhe;
   - uma resposta da IA já em curso para uma mensagem anterior cai na reserva, que já confere `is_urgent` sob trava.
4. **O protocolo sai sem os 10 s de agrupamento:**
   - Um protocolo por escalada: com a conversa já urgente, a mensagem seguinte não repete o protocolo. A equipe desfaz a urgência pelo painel (parte 4).
   - Um protocolo por mensagem: `reply_to_message_id` é único, então o reenvio da Meta não manda de novo.
   - O texto é o `protocol_message` da regra, cifrado como qualquer mensagem, com `author = ai`. Conta em `ai_response_count`: é resposta automática.
5. **Agendador: pg_cron no Supabase, a cada 5 min.**
   - Na Vercel Hobby, o cron só roda uma vez por dia, e os dois jobs são SQL puro.
   - Regra nova, registrada no `CLAUDE.md` e na skill `architecture`: job que só mexe no banco vai para o pg_cron; job que precisa da aplicação usa `app/api/cron/*`. No Hobby, esse segundo tipo é disparado por pg_cron com `pg_net`.
6. **Fechamento por timeout:** `closed_at` = última mensagem + 20 min, a mesma fórmula da recepção. A frequência do cron não muda a contagem.
7. **Resposta órfã:** `pending` há mais de 5 min vira `failed`, com o código `sem-confirmacao`, e a conversa passa para a equipe.
   - O limite de 5 min é seguro porque a rota tem `maxDuration = 120`.
   - Não dá para saber se a Meta entregou: o alerta faz alguém olhar.
   - A varredura usa `for update skip locked` e não disputa linha com um processo vivo.
8. **Opt-out:**
   - **O que conta como pedido:** a mensagem inteira, normalizada, precisa ser `parar`, `pare`, `sair`, `stop` ou `descadastrar`. "Quero parar de fumar" não conta, e `cancelar` fica de fora, porque costuma ser "cancelar a consulta".
   - **O que o paciente recebe:** nada, nem resposta da IA nem texto do Nextech em nome da clínica.
   - **Depois do opt-out:** a conversa que o paciente iniciar segue sendo respondida. O opt-out vale para as sequências (`lgpd-security`, regra 8).
9. **Sem triagem com o agente fora do ar:** agente pausado significa que o Nextech não age na conversa. O opt-out vale mesmo assim.
10. **Áudio fica sem triagem até a transcrição (parte 5).** Isso fica registrado como risco de go-live em `docs/status.md`.

## Fora desta parte

- **Próxima sessão:** qualificação (`qualified_at`).
- **Parte 4:**
  - tela de Conversas;
  - desfazer a urgência;
  - alerta de urgência e de falha.
- **Parte 5:** áudio, com transcrição e triagem.
- **Fase 4:** matrícula em sequência. O `opted_out` já fica gravado para ela respeitar.
- **Fase 7:** limite de atendimentos do plano.

## Restrições globais

- **Banco:**
  - migration aditiva em `supabase/migrations/`;
  - funções novas só para `service_role`, com teste de negação para membro e anônimo contra o banco real;
  - migration e o código que a usa no mesmo commit;
  - migration aplicada não se edita.
- **LGPD:**
  - nenhum log com conteúdo, protocolo, telefone ou token, só `erroParaLog` e o id da conversa;
  - o protocolo é o texto da clínica, nunca do Nextech.
- **Integrações:** a Meta continua simulada nos testes (`enviar` falso). O token só é decifrado em `lib/whatsapp/client.ts`.
- **Tempo nos testes de banco:** a base de tempo fica no futuro, calculada na execução.
  - O pg_cron do banco real fecha sessões paradas há mais de 20 min.
  - Um teste que confere sessão aberta com data no passado quebraria ao acaso.
- **Sem tela:**
  - nenhuma rota do painel muda;
  - nenhum item do menu sai de "em breve";
  - os testes de `tests/architecture/` não mudam.
- **Git:** commits pequenos na `staging`, com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sem push e sem PR.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/conversations/opt-out.ts` (+ teste) | O que é pedido de opt-out |
| `lib/patients/mutations.ts` | `registrarOptOut` |
| `lib/conversations/recepcao.ts` | Opt-out, triagem e relógio injetável |
| `supabase/migrations/20260927180000_urgency_escalation.sql` | `escalate_urgent_conversation` |
| `lib/conversations/urgencia.ts` | `triarUrgencia` e `enviarProtocolo` |
| `lib/conversations/resposta.ts` | `enviarReservada`, extraído do fim de `responder` |
| `app/api/whatsapp/webhook/route.ts` | Agenda o protocolo; urgência e opt-out não agendam resposta |
| `supabase/migrations/20260927190000_engine_maintenance.sql` | pg_cron, `close_stale_attendance_sessions` e `sweep_stale_ai_replies` |
| `tests/conversations/opt-out.test.ts` | Opt-out de ponta a ponta, contra o banco |
| `tests/rls/urgencia.test.ts` | A função da escalada contra o banco |
| `tests/conversations/urgencia.test.ts` | Urgência de ponta a ponta, contra o banco |
| `tests/rls/manutencao.test.ts` | As funções do cron contra o banco |
| `tests/conversations/ordem-de-trava.test.ts` | Também a escalada |
| `tests/whatsapp/webhook-log.test.ts` | O que a rota agenda |

---

### Tarefa 1: Opt-out

**Arquivos:**
- Criar: `lib/conversations/opt-out.ts`, `lib/conversations/opt-out.test.ts` e `tests/conversations/opt-out.test.ts`.
- Alterar:
  - `lib/patients/mutations.ts`;
  - `lib/conversations/recepcao.ts`;
  - `app/api/whatsapp/webhook/route.ts`;
  - `tests/whatsapp/webhook-log.test.ts`.

**Interfaces:**
- Produz:
  - `pedidoDeOptOut(texto: string | null): boolean`;
  - `registrarOptOut(clinicId, patientId): Promise<void>`;
  - `ResultadoDaRecepcao.optOut: boolean`;
  - `receberMensagem(m, agora?: () => string)`, com o relógio injetável que a tarefa 2 usa. O padrão é `() => new Date().toISOString()`.

**Lógica pura** (`lib/conversations/opt-out.ts`):

```ts
import { normalizarTexto } from "@/lib/formatters/texto"

/**
 * Pedidos de opt-out (conversation-engine-v1, edge cases; lgpd-security,
 * regra 8). A mensagem inteira precisa ser o pedido: "quero parar de
 * fumar" não é opt-out, e um falso positivo tiraria o paciente das
 * sequências sem ele pedir. "cancelar" fica de fora: no consultório, é
 * "cancelar a consulta".
 */
export const PEDIDOS_DE_OPT_OUT: readonly string[] = ["parar", "pare", "sair", "stop", "descadastrar"]

export function pedidoDeOptOut(texto: string | null): boolean {
  if (!texto) return false
  // Pontuação e emoji viram espaço: "PARAR!!!" e "Sair 🙏" também valem.
  const limpo = normalizarTexto(texto).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()
  return PEDIDOS_DE_OPT_OUT.includes(limpo)
}
```

**Teste unitário** (`lib/conversations/opt-out.test.ts`):

```ts
import { describe, expect, it } from "vitest"
import { pedidoDeOptOut } from "./opt-out"

describe("pedidoDeOptOut", () => {
  it.each(["PARAR", "parar", " Parar. ", "PARAR!!!", "Sair 🙏", "stop", "Pare", "DESCADASTRAR"])(
    "%j é pedido de opt-out",
    (texto) => expect(pedidoDeOptOut(texto)).toBe(true),
  )

  it.each(["quero parar de fumar", "não posso sair hoje", "cancelar", "para", "parar? quando?", "", "   ", null])(
    "%j não é",
    (texto) => expect(pedidoDeOptOut(texto)).toBe(false),
  )
})
```

**`registrarOptOut`:** `update patients set opted_out = true where id and clinic_id and opted_out = false`, pelo `serviceContext`. O filtro de `clinic_id` vai junto, porque `service_role` ignora RLS. Nunca volta a `false`.

**Recepção:**
- Depois do `touchLastContact`, `optOut = m.autor === "patient" && pedidoDeOptOut(m.texto)`. Se for pedido, chama `registrarOptOut`.
- Roda também no reenvio, como o `touchLastContact`: se a primeira tentativa falhou depois de gravar, o reenvio é a única chance.
- O resultado ganha `optOut`.

**Rota:** o `if` que agenda a resposta ganha `&& !r.optOut`.

**Casos do teste de banco** (`tests/conversations/opt-out.test.ts`):
- **Como roda:**
  - clínica com um agente ativo e um pausado;
  - mensagens criadas por `receberMensagem(interpretarWebhook(webhookDeMensagens(...))[0])`;
  - base de tempo `T0 = amanhã`, calculada na execução.
- **Casos:**
  1. "PARAR": `opted_out = true` e `r.optOut = true`. A mensagem fica gravada no histórico.
  2. Pelo agente pausado: o opt-out vale do mesmo jeito.
  3. "quero parar de fumar": `opted_out` continua `false`, e `r.optOut = false`.
  4. Reenvio do mesmo "PARAR" (mesmo `wamid`): `nova = false`, `r.optOut = true`, e o paciente continua `opted_out`.
  5. **Isolamento:** o mesmo telefone como paciente de outra clínica não muda.
  6. O eco da equipe com "parar" não marca o paciente, porque só o paciente pede opt-out.

**Caso da rota** (`webhook-log.test.ts`): o `resultado()` ganha `optOut: false`, e o caso "só mensagem nova do paciente..." ganha uma quinta mensagem com `resultado({ optOut: true })`. `after` continua sendo chamado uma vez.

- [x] **Passo 1:** testes unitário e de banco. **Passo 2:** rodar (FALHA).
- [x] **Passo 3:** implementar. **Passo 4:** rodar (PASSA) `lib/conversations/opt-out.test.ts`, depois `tests/conversations/opt-out.test.ts`, `tests/whatsapp/webhook-log.test.ts` e `tests/whatsapp/webhook.test.ts`, um de cada vez.
- [x] **Passo 5:** commit `feat(conversations): opt-out do paciente na recepção`.

---

### Tarefa 2: Escalada de urgência na recepção

**Arquivos:**
- Criar:
  - `supabase/migrations/20260927180000_urgency_escalation.sql`;
  - `lib/conversations/urgencia.ts`;
  - `tests/rls/urgencia.test.ts`;
  - `tests/conversations/urgencia.test.ts`.
- Alterar: `lib/conversations/recepcao.ts` e `tests/conversations/ordem-de-trava.test.ts`.

**Interfaces:**
- Consome: `listActiveUrgencyRules`, `detectarUrgencia`, `custoDaResposta`, `cifrarConteudo` e o relógio da recepção (tarefa 1).
- Produz:
  - `type ProtocoloReservado = { reservaId: string; phoneNumberId: string; tokenCifrado: string; para: string; texto: string }`, onde `para` é o `wa_id` sem o `+`;
  - `triarUrgencia(p: { clinicId; conversationId; messageId; phoneNumberId; texto: string; ultimaDoPaciente: string; agora: string }): Promise<{ urgente: boolean; protocolo: ProtocoloReservado | null }>`;
  - `ResultadoDaRecepcao.urgente: boolean` e `ResultadoDaRecepcao.protocolo: ProtocoloReservado | null`.

**Migration** (`escalate_urgent_conversation`):
- **Assinatura:** `(p_clinic_id, p_conversation_id, p_message_id, p_content_encrypted, p_occurred_at, p_within_window, p_billable, p_phone_number_id)`.
- **Retorno:** a mesma tabela da `reserve_ai_reply` (`message_id`, `patient_phone`, `phone_number_id`, `access_token_encrypted` e `motivo`).
- **Passos:**
  1. Conversa inexistente na clínica: `22023`.
  2. Travas: paciente `for share`, agente `for share` e conversa `for update`, nessa ordem, como na `reserve_ai_reply`.
  3. `p_message_id` precisa ser mensagem do paciente desta conversa. Senão, `22023`.
  4. **Recusas sem gravar nada**, cada uma com seu `motivo`:
     - paciente anonimizado: `paciente-anonimizado`;
     - agente não `active`, com o número diferente de `p_phone_number_id` ou sem token: `agente-fora-do-ar`;
     - conversa já urgente: `urgente`;
     - já existe resposta com `reply_to_message_id = p_message_id`: `ja-respondida`.
  5. `update conversations set is_urgent = true, handled_by = 'human'`.
  6. **Janela fechada** (reenvio tardio): a marca fica, e a função devolve `fora-da-janela` sem reservar.
  7. **Reserva:** insere o protocolo `pending`, como na `reserve_ai_reply` (`SERVICE`, `within_24h_window`, `billable`, `reply_to_message_id`, com `on conflict do nothing`). Se não inserir, devolve `ja-respondida`.
- **Permissões:** `security invoker` e `set search_path = ''`. `revoke` de `public`, `anon` e `authenticated`; `grant` só a `service_role`. Um `comment on function` descreve a função.

**`triarUrgencia`:**
1. `regra = detectarUrgencia(texto, await listActiveUrgencyRules(clinicId))`. Se nenhuma regra casar, devolve `{ urgente: false, protocolo: null }`.
2. Calcula `custoDaResposta({ enviadaEm: agora, ultimaDoPaciente })` e chama a RPC com `cifrarConteudo(clinicId, regra.protocol_message)` e `p_occurred_at = agora`.
3. Com `motivo`: `{ urgente: true, protocolo: null }`. Sem `motivo`: `protocolo` com o telefone sem `+`, e o texto é o `protocol_message` da regra.

**Recepção:**
- Com `m.autor === "patient"`, `m.texto` e o agente `active`, chama `triarUrgencia` com `ultimaDoPaciente = m.ocorridaEm` e `agora = agora()`.
- Vale também no reenvio: a escalada é idempotente pelos motivos `urgente` e `ja-respondida`.
- Sem triagem, o resultado leva `urgente: false` e `protocolo: null`.

**Casos** (`tests/rls/urgencia.test.ts`):
- **Como roda:**
  - chamadas diretas à RPC, contra o banco real;
  - clínicas A e B, cada uma com agente ativo e paciente;
  - `register_whatsapp_message` para as mensagens;
  - um login só, de membro de A.
- **Casos:**
  1. Membro e anônimo recebem `42501`.
  2. Escala:
     - a conversa fica `is_urgent` e `human`;
     - o protocolo fica `pending`, `author = ai`, `SERVICE`, com `reply_to_message_id`;
     - a função devolve o telefone, o número e o token.
  3. Escala mesmo com a conversa `human` (eco antes).
  4. Conversa já urgente: `urgente`, sem segundo protocolo.
  5. A mesma mensagem, depois de a equipe desfazer a urgência (`is_urgent = false` via `service_role`): `ja-respondida`, sem remarcar.
  6. Agente pausado ou número divergente: `agente-fora-do-ar`, e nada muda.
  7. Paciente anonimizado: `paciente-anonimizado`, e nada muda.
  8. Janela fechada: fica `is_urgent`, sem protocolo, e devolve `fora-da-janela`.
  9. **Isolamento:**
     - conversa de B com o `clinic_id` de A: `22023`;
     - mensagem de outra conversa: `22023`;
     - mensagem da IA: `22023`.

**Casos** (`tests/conversations/urgencia.test.ts`, de ponta a ponta pela recepção):
- **Como roda:**
  - A tem uma regra ativa: `keywords` `["dor no peito", "falta de ar"]` e protocolo `"Ligue 192 ou procure o pronto-socorro mais próximo."`;
  - A tem também uma regra inativa, com `["sangramento"]`;
  - B tem uma regra ativa, com `["dente quebrado"]`.
  - **Ativar a regra no teste:** `insert` com `active: true`, `confirmed_by` (usuário criado por `admin.auth.admin.createUser`, sem login), `confirmed_at` e `confirmed_content_hash = md5(protocol_message + "\x1e" + keywords.join("\x1f"))`, que é a fórmula de `private.urgency_rule_content_hash`.
  - A base de tempo é `T0 = amanhã`, e o relógio da recepção é `() => iso(t + 1)`.
- **Casos:**
  1. "Estou com uma DOR no peito forte":
     - `r.urgente` e `r.protocolo`, com o texto da clínica, o telefone sem `+` e o token do agente;
     - a conversa fica `is_urgent` e `human`;
     - a reserva decifra para o protocolo.
  2. A equipe respondeu pelo app há 1 h: escala igual.
  3. Segunda mensagem urgente na mesma conversa: `urgente`, sem `protocolo`.
  4. Reenvio da mensagem urgente: `urgente`, sem `protocolo`, e um protocolo só no banco.
  5. Agente pausado: `urgente: false`, e a conversa não muda.
  6. "sangramento" (regra inativa) e "dente quebrado" (regra de B): nada.
  7. Mensagem sem texto (fixture de áudio, se existir; senão, imagem sem legenda): nada.
  8. **A resposta em curso cai:** `responderConversa` para uma mensagem "oi" anterior, com um `gerar` que recebe a mensagem urgente no meio, devolve `"urgente"` sem chamar o `enviar`.

**Ordem de trava:** acrescentar `it("escalate_urgent_conversation", ...)` com `["patients", "agents", "conversations"]`.

- [x] **Passo 1:** carregar `supabase-postgres-best-practices`. **Passo 2:** testes. **Passo 3:** migration, com `supabase db push --dry-run` e depois `echo y | supabase db push`. **Passo 4:** `triarUrgencia` e a recepção.
- [x] **Passo 5:** rodar, um de cada vez: `tests/conversations/ordem-de-trava.test.ts`, `tests/rls/urgencia.test.ts`, `tests/conversations/urgencia.test.ts`, `tests/conversations/opt-out.test.ts` e `tests/whatsapp/webhook.test.ts`.
- [x] **Passo 6:** commit `feat(conversations): urgência escala a conversa e reserva o protocolo da clínica`, com a migration e o código juntos.

---

### Tarefa 3: Envio do protocolo

**Arquivos:**
- Alterar:
  - `lib/conversations/resposta.ts`;
  - `lib/conversations/urgencia.ts`;
  - `app/api/whatsapp/webhook/route.ts`;
  - `tests/conversations/urgencia.test.ts`;
  - `tests/whatsapp/webhook-log.test.ts`.

**Interfaces:**
- Produz:
  - `enviarReservada(p: { clinicId: string; conversationId: string; reservaId: string; envio: Envio; etapa: "envio" | "protocolo" }, deps: Pick<Dependencias, "enviar" | "dormir" | "agora">): Promise<"respondida" | "falha-no-envio">`;
  - `enviarProtocolo(r: ResultadoDaRecepcao, deps = DEPENDENCIAS_PADRAO): Promise<"respondida" | "falha-no-envio">`.

**`enviarReservada`:** os passos 10 e 11 da parte 2, extraídos de `responder` sem mudar o comportamento.
- `deps.enviar`. Se falhar: `fail_ai_reply` com a reserva e log `{ etapa, conversa, ...erroParaLog }`.
- Depois, `confirm_ai_reply` com as esperas de 500 ms e 2 s. Se falhar de vez: log `{ etapa: "confirmacao", ... }` e o erro sobe.
- `responder` passa a chamá-la com `etapa: "envio"`.

**`enviarProtocolo(r)`:** `enviarReservada` com a `r.protocolo` e `etapa: "protocolo"`. O erro inesperado sobe para a rota.
- Não chama `fail_ai_reply` sem reserva, porque a conversa já é da equipe e urgente.
- A resposta que ficar `pending` é o caso da varredura (tarefa 4).

**Rota:**
- Com `r?.protocolo`, agenda `after(() => emSegundoPlano("protocolo", () => enviarProtocolo(r)))`.
- A resposta da IA ganha `&& !r.urgente`.
- `responderEmSegundoPlano` vira `emSegundoPlano(etapa, tarefa)`, que loga `{ etapa, ...erroParaLog }`.

**Casos** (`tests/conversations/urgencia.test.ts`, com `deps` falso como em `resposta.test.ts`):
1. **Envia:**
   - o `enviar` recebe exatamente o `protocol_message`, o `wa_id` sem `+`, o número e o token do agente;
   - a mensagem fica `sent`, com o id da Meta;
   - a sessão fica com `ai_response_count = 1`.
2. **Falha no envio** (`MetaError("131047")`):
   - o protocolo fica `failed`, com o código;
   - o log é `{ etapa: "protocolo", conversa, tipo: "MetaError", codigo: "131047" }`;
   - passa pelo `logPermitido` e não contém o protocolo nem o texto do paciente.
3. **Depois do protocolo,** a mensagem seguinte do paciente não é respondida pela IA (`"urgente"`).

**Casos da rota** (`webhook-log.test.ts`, com `vi.mock("@/lib/conversations/urgencia", () => ({ enviarProtocolo: vi.fn() }))` e `resultado()` com `urgente: false` e `protocolo: null`):
1. `resultado({ urgente: true, protocolo: P })` agenda um `after`. Ao rodar, chama `enviarProtocolo`, e não o `responderConversa`.
2. `resultado({ urgente: true, protocolo: null })` não agenda nada.
3. Erro dentro do protocolo em segundo plano: log `{ etapa: "protocolo", tipo, codigo }`, sem conteúdo.

- [x] **Passo 1:** testes. **Passo 2:** FALHA. **Passo 3:** implementar.
- [x] **Passo 4:** rodar (PASSA), um de cada vez: `tests/conversations/urgencia.test.ts`, `tests/conversations/resposta.test.ts` (a extração não muda nada), `tests/whatsapp/webhook-log.test.ts` e `tests/whatsapp/webhook.test.ts`.
- [x] **Passo 5:** commit `feat(conversations): envio do protocolo de urgência no after() da rota`.

---

### Tarefa 4: Manutenção pelo pg_cron

**Arquivos:**
- Criar: `supabase/migrations/20260927190000_engine_maintenance.sql` e `tests/rls/manutencao.test.ts`.
- Alterar:
  - `tests/rls/ai-replies.test.ts`, `tests/whatsapp/webhook.test.ts` e `tests/conversations/resposta.test.ts`, para mudar a base de tempo;
  - `CLAUDE.md` e `.claude/skills/architecture/SKILL.md`.

**Migration:**
- `create extension if not exists pg_cron with schema pg_catalog`, e `grant usage on schema cron to postgres`, como na documentação do Supabase. O `--dry-run` confirma.
- **`close_stale_attendance_sessions() returns integer`:**
  - `update attendance_sessions set status = 'closed_by_timeout', closed_at = last_message_at + interval '20 minutes' where status = 'open' and last_message_at < now() - interval '20 minutes'`;
  - devolve quantas sessões fechou;
  - roda em todas as clínicas, porque cada linha mantém o próprio `clinic_id`.
  - **Corrida com a recepção:** as duas travam a linha da sessão. Quem chega depois reavalia e não acha nada a fazer.
- **`sweep_stale_ai_replies() returns integer`:** CTE com três passos.
  1. `orfas`: `select` de `messages` com `author = 'ai'`, `delivery_status = 'pending'` e `created_at < now() - interval '5 minutes'`, `for update skip locked`.
  2. `update messages` para `failed`, com `delivery_error_code = 'sem-confirmacao'` e `delivery_updated_at = now()`, `returning clinic_id, conversation_id`.
  3. `update conversations set handled_by = 'human', ai_failed_at = now()` para os pares distintos, com o `clinic_id` casado.
  - Devolve quantas respostas mudaram.
- **Índices parciais:**
  - `attendance_sessions (last_message_at) where status = 'open'`;
  - `messages (created_at) where delivery_status = 'pending'`.
- **Permissões:** as duas funções com `security invoker` e `set search_path = ''`. `revoke` de `public`, `anon` e `authenticated`; `grant` a `service_role`. O `postgres`, que é o dono, roda o cron.
- **Agendamento:** `cron.schedule`, que por nome é idempotente.
  - `nextech-fechar-sessoes-vencidas`, a cada 5 min;
  - `nextech-varrer-respostas-orfas`, a cada 5 min;
  - `nextech-limpar-historico-do-cron`, todo dia às 3h, que apaga `cron.job_run_details` com mais de 7 dias.

**Casos** (`tests/rls/manutencao.test.ts`):
- **Como roda:**
  - uma clínica;
  - sessões com `last_message_at` no passado real (`now` menos 2 h e menos 5 min);
  - respostas `pending` com `created_at` no passado real (`now` menos 10 min e agora), gravadas via `service_role`.
  - As funções rodam de verdade, como um tique do cron. O teste confere só as próprias linhas, porque o cron real pode ter passado antes, com o mesmo efeito.
- **Casos:**
  1. Membro e anônimo recebem `42501` nas duas funções.
  2. **Sessão parada há 2 h:**
     - fecha `closed_by_timeout`, com `closed_at` = última + 20 min;
     - a de 5 min continua `open`;
     - a próxima mensagem do paciente abre uma sessão nova (`register_whatsapp_message`).
  3. **Resposta `pending` de 10 min atrás:**
     - vira `failed`, com `sem-confirmacao`;
     - a conversa passa para a equipe, com `ai_failed_at`;
     - a `pending` recente e a `sent` não mudam.
  4. Segunda chamada seguida: não muda nada nas linhas do teste.

**Base de tempo dos testes existentes:** hoje eles usam datas fixas.
- `ai-replies.test.ts` e `webhook.test.ts` usam 21/09.
- `resposta.test.ts` usa 02/10.
- A mudança:
  - `resposta.test.ts`: `T0 = max(amanhã, 02/10)`, porque o `billable` exige data a partir de 1º/out;
  - `webhook.test.ts`: `T0 = amanhã`;
  - `ai-replies.test.ts`: as datas literais `2026-09-21T…` e `2026-09-22T…` passam a derivar de `DIA` (amanhã) e `DIA_SEGUINTE`.

**Verificação do agendamento:** consultar `cron.job` e, depois de 5 min, `cron.job_run_details` pela API de gestão do Supabase (`POST /v1/projects/{ref}/database/query`, com o `SUPABASE_ACCESS_TOKEN` do `.env`). A saída fica anotada no status da execução.

**Regra do agendador:**
- **`CLAUDE.md`:** a linha de `app/api/cron/*` passa a dizer que job de banco vai para o pg_cron, em migration, e job que precisa da aplicação vai para `app/api/cron/*`.
- **Skill `architecture`:** a mesma regra, em "Onde cada coisa mora".
- **Cuidado:** o `next dev` reescreve o `CLAUDE.md`, então a edição vai só no trecho da estrutura.

- [x] **Passo 1:** carregar `supabase-postgres-best-practices`. **Passo 2:** mudar a base de tempo e rodar os três arquivos, um de cada vez (PASSA, antes do cron existir).
- [x] **Passo 3:** teste novo (FALHA). **Passo 4:** migration com `--dry-run` e `push`. **Passo 5:** `tests/rls/manutencao.test.ts` (PASSA).
- [x] **Passo 6:** conferir os jobs no banco. **Passo 7:** `CLAUDE.md` e a skill.
- [x] **Passo 8:** commit `feat(conversations): pg_cron fecha sessões vencidas e varre respostas órfãs`, com a migration, os testes e as regras.

---

### Tarefa 5: Documentação

- [x] **Passo 1:** `docs/specs/conversation-engine-v1.md`:
  - na seção "Implementação", a parte 3 com as decisões 1 a 10;
  - nos critérios de aceite:
    - urgência que dispara o protocolo e escala: marcar;
    - urgência nunca retomada: marcar;
    - opt-out: parcial, porque a marca existe e parar a matrícula é da fase 4;
    - teste de escalonamento: marcar.
- [x] **Passo 2:** `docs/specs/atendimento-billing-v1.md`: o timeout pelo pg_cron. `docs/specs/message-sequences-v1.md`: a recepção grava `opted_out`, e a matrícula precisa respeitá-lo.
- [x] **Passo 3:** `docs/status.md` e `docs/roadmap.md`:
  - a parte 3 da 3b, com a qualificação como próxima;
  - nos bloqueios de go-live: riscar urgência, opt-out e varredura; ficam o limite do plano e a triagem de áudio.
  - Neste plano, o status da execução.
- [x] **Passo 4:** memória `nextech-arquitetura-decisoes`, com as decisões 3, 5 e 7, e a do ambiente Supabase, com o pg_cron e a base de tempo no futuro.
- [x] **Passo 5:** commit `docs: fecha a parte 3 do motor de conversa no plano, specs, roadmap e status`.

---

## Verificação final (antes da tarefa 5)

- [x] `npx vitest run` inteiro. A saída vai para um arquivo, com o commit no topo e `echo exit=$?` no fim. Depois, `npx tsc --noEmit` e `npm run build`.
- [x] Revisão pelos subagentes `qa-reviewer` (inclui a conferência do `813cb48`, a pendência da parte 2) e `security-reviewer`. Tratar os achados e pedir a conferência das correções.
- [x] Sem tela nesta parte. Antes de trocar de branch, `git checkout -- CLAUDE.md`.

# Spec: Motor de Conversa (v1)

## Por que isso existe
É o subsistema que todas as outras specs assumem pronto e nenhuma descreve. `agent-config-v1.md` adia a modelagem de `Conversation` para cá; `atendimento-billing-v1.md` depende de saber quando a IA respondeu; `dashboard-overview-v1.md` depende da definição de "lead qualificado"; `message-sequences-v1.md` depende do evento "paciente respondeu". É o coração do produto e o último a ser desenhado.

## Objetivo
Receber a mensagem do paciente no WhatsApp, decidir se a IA deve responder, gerar a resposta e registrar o que aconteceu — respeitando coexistência (um humano pode assumir a qualquer momento), triagem de urgência e a contagem de atendimento do plano.

## Escopo v1

### Modelo de dados

#### Conversation
Uma por par paciente + agente. É o estado de longo prazo do relacionamento, diferente da `AttendanceSession`, que é a unidade de cobrança.

- `id`, `clinic_id`, `agent_id`, `patient_id`
- `handled_by` — `ai` | `human`
- `human_took_over_at` — nullable; quando um humano respondeu pela última vez
- `is_urgent` — boolean; disparado pela triagem, só limpo por ação humana
- `qualified_at` — nullable; quando a IA detectou intenção de agendar
- `last_inbound_at` — última mensagem **do paciente** (define a janela de 24h da Meta)
- `last_message_at` — última mensagem de qualquer origem
- `status` — `active` | `archived`

#### Message
- `id`, `clinic_id`, `conversation_id`
- `direction` — `inbound` (do paciente) | `outbound` (da clínica)
- `author` — `patient` | `ai` | `human`
- `wa_message_id` — id da Meta; **único por clínica**, é a chave de idempotência
- `content_encrypted` — conteúdo cifrado em repouso (PII de saúde)
- `media_type` — `text` | `audio` | `image` | `document` | `other` (vídeo, figurinha, localização, contato: ficam no histórico, sem conteúdo)
- `occurred_at` — o carimbo da Meta. A ordem da conversa segue ele, e não o `created_at`: um reenvio horas depois não pode reordenar o histórico
- `created_at` — quando o registro entrou

O conteúdo nunca é logado em texto puro, nem em erro, nem em observabilidade (regra 3 do `CLAUDE.md` e item 1 de `lgpd-security`).

### Comportamento

#### 1. Recepção
1. A Meta chama `app/api/whatsapp/webhook`. A rota valida `X-Hub-Signature-256` e **responde 200 imediatamente** — a Meta reenvia em caso de timeout, e reenvio duplicado é pior que processamento lento.
2. `wa_message_id` já existente para aquela clínica → descarta. A Meta reenvia o mesmo evento em falha de rede, e sem isso o paciente receberia resposta duplicada e o atendimento seria contado duas vezes.
3. `phone_number_id` → agente → clínica. Agente que não esteja `active` não gera resposta; a mensagem é registrada mesmo assim, para não perder histórico.
4. Primeiro contato de um número novo cria o `Patient` (`patient-v1.md`).

#### 2. Eco da coexistência
Mensagem enviada pelo WhatsApp Business App da própria clínica chega como eco (`author = human`).

1. Registra a `Message` com `author = human`.
2. `handled_by = human`, `human_took_over_at = now()`.
3. A IA para de responder naquela conversa.
4. Não incrementa `ai_response_count` da `AttendanceSession` (`atendimento-billing-v1.md`, regra 5).
5. Não abre nem estende a janela de 24h — só mensagem do paciente faz isso.

#### 3. Retomada da IA
**Decidido:** por inatividade, 24 horas.

Passadas 24h desde `human_took_over_at` sem nova mensagem humana, a próxima mensagem do paciente volta a ser respondida pela IA (`handled_by = ai`). O prazo espelha a janela de atendimento da Meta: depois dele, a conversa já exigiria template de qualquer forma.

A recepção não precisa lembrar de "devolver" a conversa — é o que sustenta a promessa de atendimento 24/7. A clínica pode forçar a devolução antes disso pelo painel.

#### 4. Triagem de urgência
**Decidido:** responde o protocolo da clínica e escala.

1. Antes de qualquer chamada de IA, o texto é comparado com as `keywords` de `UrgencyRule` (`clinic-profile-v1.md`).
2. Se casar: envia o `protocol_message` **da própria clínica** — nunca um texto do Nextech.
3. `is_urgent = true`, `handled_by = human`.
4. A IA não responde mais nada naquela conversa até um humano assumir. Não há retomada automática por inatividade em conversa urgente.
5. A conversa vai para o topo dos alertas do dashboard.

A IA nunca tenta conduzir um caso urgente. `clinic-profile-v1.md` já estabelece que o conteúdo do protocolo é responsabilidade clínica da própria clínica, e que a regra não fica ativa sem confirmação explícita dela.

#### 5. Geração da resposta
1. Monta o system prompt a partir do agente: `persona_instructions`, `business_hours`, especialidade, procedimentos e convênios da clínica (`lib/agent-config/`).
2. Inclui as últimas N mensagens da conversa como histórico.
3. Chama o OpenRouter (`lib/ai/client.ts`), modelo por configuração, nunca hardcoded.
4. Envia a resposta pelo Cloud API, respeitando o limite de 20 mensagens/segundo da coexistência.
5. Registra a `Message` com `author = ai` e incrementa `ai_response_count`.

#### 6. Qualificação de lead
**Decidido:** por intenção de agendar.

A conversa é marcada com `qualified_at` quando o paciente demonstra intenção de marcar consulta — pergunta sobre horário, preço, convênio ou disponibilidade. A detecção é feita pela própria IA, que devolve essa marcação junto com a resposta.

É o dado que alimenta o funil do `dashboard-overview-v1.md` e o "relatório semanal de pacientes qualificados" prometido no plano Pro.

`qualified_at` é gravado uma única vez por conversa, no primeiro sinal — para o funil medir conversão, não recorrência.

#### 7. Falha da IA
**Decidido:** retry curto, depois handoff silencioso.

1. Falha na chamada do OpenRouter → 2 novas tentativas com espera crescente (1s, 4s).
2. Persistindo: `handled_by = human`, alerta no painel.
3. **Nada é enviado ao paciente.** Em clínica de saúde, silêncio é melhor que "estou com problemas técnicos" — a conversa parece humana e alguém assume.
4. A falha é registrada com metadado apenas: id da conversa, timestamp, código do erro. Nunca o conteúdo da mensagem.

## Edge cases

- **Paciente manda várias mensagens seguidas** (ex: três áudios): agrupa por uma janela curta (~10s) e responde uma vez. Sem isso, a IA responde três vezes e queima o limite de atendimento do plano.
- **Áudio**: transcreve antes de processar. A transcrição só é persistida com consentimento registrado; sem consentimento, processa em memória e descarta (`lgpd-security`, regra 3).
- **Mensagem fora da janela de 24h**: não pode ser texto livre. Se não houver template aprovado, não envia e registra a falha — nunca cai para texto livre (`whatsapp-templates-v1.md`).
- **`ACCOUNT_OFFBOARDED`**: a clínica trocou de celular ou reinstalou o app; a Meta desconecta. O agente vai para `paused` e a clínica é avisada. `ACCOUNT_RECONNECTED` reverte.
- **Paciente responde a uma sequência**: encerra o `SequenceEnrollment` como `stopped_replied` e abre `AttendanceSession` normal (`message-sequences-v1.md`).
- **Opt-out ("PARAR", "SAIR")**: detectado antes de qualquer processamento de IA. Marca o paciente como `opted_out` em **todas** as sequências, imediatamente (`lgpd-security`, regra 8).
- **Limite de plano estourado**: a IA para de responder e a clínica é alertada. O que exatamente acontece — bloquear, avisar ou cobrar excedente — continua em aberto em `atendimento-billing-v1.md`; esta spec assume "para e alerta" como comportamento provisório.
- **Webhook reenviado pela Meta**: resolvido pela unicidade de `wa_message_id`.

## Critério de aceite

- [ ] Mensagem do paciente gera resposta da IA coerente com a persona do agente. *(Parte 2: a persona, a saudação, o horário, os procedimentos e os convênios entram no prompt, com teste de ponta a ponta. A coerência da resposta só se mede com modelo e tráfego reais.)*
- [x] `wa_message_id` duplicado não gera segunda resposta nem segundo atendimento. *(Parte 1: não duplica mensagem nem sessão. Parte 2: o reenvio não agenda resposta, e duas execuções para a mesma mensagem respondem uma vez só (`reply_to_message_id` único).)*
- [x] Eco do app da clínica muda `handled_by` para `human` e silencia a IA. *(Partes 1 e 2, com teste de ponta a ponta.)*
- [x] Após 24h sem mensagem humana, a IA volta a responder. *(Parte 2: `decidirResposta`, contando do mais recente entre `human_took_over_at` e `ai_failed_at`.)*
- [ ] Conversa marcada como urgente nunca é retomada automaticamente pela IA.
- [ ] Palavra-chave de urgência dispara o `protocol_message` da clínica e escala.
- [ ] Intenção de agendar grava `qualified_at` uma única vez.
- [x] Falha do OpenRouter após 3 tentativas escala para humano sem enviar nada ao paciente. *(Parte 2: 1 s e 4 s de espera, `fail_ai_reply`, com teste.)*
- [ ] Opt-out interrompe todas as sequências do paciente, não só a que ele respondeu.
- [x] Conteúdo de mensagem nunca aparece em log — inclusive em caminho de erro. *(Recepção, parte 1: teste com a chave ausente confere que o log não tem texto, telefone nem nome. Cada parte seguinte reconfirma no seu caminho.)*
- [x] RLS isola `Conversation` e `Message` por `clinic_id`. *(Parte 1: `tests/rls/conversations.test.ts`, contra o banco real, cobre também `attendance_sessions` e `whatsapp_account_events`.)*
- [ ] Teste automatizado cobre: idempotência do webhook, eco da coexistência, retomada por inatividade, escalonamento de urgência, e isolamento entre clínicas.

## Implementação

A 3b foi dividida em cinco partes, por dependência (decisão do Jhones, 2026-09-27):
1. dados e recepção;
2. decisão e resposta da IA;
3. urgência, opt-out e qualificação;
4. tela real de Conversas;
5. preview do agente e áudio.

### Parte 1: dados e recepção (2026-09-27)

Plano: `docs/superpowers/plans/2026-09-27-motor-de-conversa-parte-1.md`.

- **Grava antes do 200.** O comportamento 1 pede 200 imediato. A gravação leva milissegundos e vem antes da resposta; o que demora, a IA, roda depois dela (parte 2, com `after()`). Com a gravação falha, a rota devolve 500 e a Meta reenvia, o que é inofensivo pela idempotência. Um 200 com a gravação falha perderia a mensagem.
- **Idempotência no banco.** `unique (clinic_id, wa_message_id)`, uma conversa por par e uma sessão aberta por conversa, dentro de uma função SQL só (`register_whatsapp_message`). Reenvio e corrida são caminho normal.
- **Sessão vencida fecha na recepção.** Se a sessão aberta está parada há mais de 20 min quando o paciente volta, a recepção a fecha como `closed_by_timeout` e abre outra.
- **Eventos de conta** em `whatsapp_account_events`, por agente do WABA. A desconexão guarda o status anterior; a reconexão devolve ao ar só quem a desconexão pausou.
- **Conteúdo cifrado** com chave própria (`MESSAGE_CONTENT_ENCRYPTION_KEY`), com o `clinic_id` como dado autenticado.
- **WABA conferido.** A mensagem só entra se o `entry.id` da Meta bater com o WABA do agente. A prova de posse do número na própria conexão fica para a parte 2 e é bloqueio de go-live (`docs/status.md`).
- **Falha por evento.** Um evento com falha definitiva (validação, dado inválido) é logado e pulado; só a transitória devolve 500. Sem isso, um evento envenenado faria a Meta reenviar o lote por dias.
- **Direito de exclusão.** `messages.content_redacted_at` e `redact_patient_messages`: o `anonymizePatient` apaga o conteúdo e mantém o metadado.
- **Contra mock.** As credenciais da Meta ainda não chegaram. Os payloads de teste seguem o formato documentado (`tests/fixtures/meta-webhook.ts`).

### Parte 2: decisão e resposta da IA (2026-09-27)

Plano: `docs/superpowers/plans/2026-09-27-motor-de-conversa-parte-2.md`.

- **Agrupamento no `after()`, "a mais recente vence".** Cada mensagem nova do paciente agenda uma resposta, que espera 10 s e só segue se ela ainda for a última do paciente. Sem fila externa.
- **Reservar, enviar, confirmar.** A resposta entra como `pending`, com `reply_to_message_id` único (a trava contra resposta dupla). `confirm_ai_reply` grava o id da Meta, conta na sessão e fecha por contagem na quinta, numa transação.
- **Falha da IA ou do envio** passa a conversa para a equipe (`ai_failed_at`), sem mandar nada ao paciente. A retomada em 24h conta a partir do mais recente entre a ação humana e a falha.
- **O que vai para o modelo:** o system prompt da clínica (regras de segurança antes da persona) e as últimas 20 mensagens. Não vão telefone nem nome do paciente. Toda chamada ao OpenRouter exige `data_collection: "deny"` e `zdr: true`.
- **Custo:** `category = SERVICE`, `within_24h_window` e `billable` gravados no envio. O serviço dentro da janela passa a ser cobrado em 1º/out/2026 (UTC).
- **Status de entrega** só avança; `failed` só vale antes da entrega.
- **Prova de posse na conexão:** `connectWhatsapp` confere na Graph API que o número pertence ao WABA antes de gravar.
- **Revalidação sob trava.** A decisão é tomada antes da geração (para não gastar o modelo à toa) e de novo na reserva, que trava paciente e conversa e recusa se, nos até ~65 s de modelo, o paciente foi anonimizado, o agente pausado ou o número trocado, a conversa virou urgente, a janela fechou, o paciente escreveu de novo ou a equipe respondeu pelo app. A retomada em 24h acontece na reserva. Achado da revisão de segurança.
- **Falha registrada:** `ai_failed_at` na conversa e log com o id da conversa e o código, nunca o conteúdo. Erro inesperado também passa a conversa para a equipe; `failed` avisado depois pela Meta também.
- **Até a parte 3, a resposta sai sem triagem de urgência.** O webhook não está assinado na Meta, então não chega a paciente real; a parte 3 é pré-requisito do go-live.

## Planos afetados
O motor é a base do produto — existe em Starter, Pro e HealthTech. O que varia por plano é o limite de atendimentos (`atendimento-billing-v1.md`) e o processamento de áudio, que a landing promete a partir do Pro.

## Instrumentação de custo (requisito de `agent-config-v1`)

Toda mensagem enviada registra, além do que o motor já precisa:

- `category` — `SERVICE` | `MARKETING` | `UTILITY` (a categoria da Meta)
- `within_24h_window` — se saiu dentro ou fora da janela de atendimento
- `billable` — derivado dos dois, pela regra vigente na data do envio

Existe porque a Meta passa a cobrar mensagem de serviço dentro da janela de
24h a partir de 1º/out/2026, e o preço dos planos Starter/Pro/HealthTech
depende de saber o custo real por atendimento. Estimar antes de ter tráfego
produziria um número que ninguém conseguiria defender.

`billable` é gravado no envio, e não calculado na leitura, justamente porque a
regra muda de data: recalcular depois exigiria saber qual regra valia em cada
mensagem do histórico.

## Em aberto
- **Agrupamento de mensagens**: a janela de ~10s é um chute inicial. Precisa de ajuste com conversa real — curta demais responde em duplicidade, longa demais parece lento.
- **Tamanho do histórico** enviado ao modelo: afeta custo por atendimento e qualidade. Medir antes de fixar.
- **Cache de prompt do Gemini via OpenRouter**: mecanismo diferente do `cache_control` da Anthropic. Confirmar a sintaxe atual antes de implementar (skill `integrations`).
- **Detecção de qualificação**: sai da mesma chamada que gera a resposta, ou de uma segunda chamada? Uma só é mais barata; duas são mais confiáveis. Decidir medindo.
- **`billable` contra o `pricing` da Meta:** o status de entrega traz `pricing.billable` e a categoria que a Meta cobrou. Conferir o que gravamos com isso quando houver tráfego real, antes de fechar o preço dos planos.
- **Retomada em conversa urgente**: hoje nunca é automática. Se na prática isso deixar conversas presas, revisitar.

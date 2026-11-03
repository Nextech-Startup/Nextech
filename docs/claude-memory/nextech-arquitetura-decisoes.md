---
name: nextech-arquitetura-decisoes
description: "Decisões estruturais do SaaS Nextech — módulos verticais, porta única de tenant, route groups, fase 3 dividida em 3a/3b"
metadata: 
  node_type: memory
  type: project
  originSessionId: e52ac1a7-7a14-4858-838e-4f1fd3e16d3a
  modified: 2026-10-12T02:15:17.530Z
---

Arquitetura decidida em 2026-09-16, documentada em `docs/superpowers/specs/2026-09-16-arquitetura-plataforma-design.md`:

- **Módulos verticais**: `lib/<dominio>/` com `schema.ts` / `queries.ts` / `mutations.ts` / teste. Não camadas horizontais.
- **`lib/auth/context.ts`** expõe `requireClinicContext()` — porta única de resolução de `clinic_id`. Nenhum módulo cria client Supabase por conta própria. `service-context.ts` é o caminho separado para webhook/cron/admin, onde não há sessão.
- **Route groups irmãos**: a landing sai de `app/page.tsx` para `app/(marketing)/`, ao lado de `(dashboard)` e `(admin)`.
- **RSC + Server Actions**; Supabase Realtime só na lista de conversas e nos alertas do dashboard.
- **Fase 3 dividida**: 3a = fundação multi-tenant + painel de cadastro; 3b = motor de conversa, **bloqueada até ter spec própria** (é o único subsistema sem desenho e aparece como dependência em 6 das 8 specs).

**Motor de conversa (3b), decidido em 2026-09-27:**
- **Recorte:** cinco partes, por dependência: (1) dados e recepção ✅; (2) decisão e resposta da IA ✅; (3) urgência, opt-out e qualificação, pré-requisito do go-live ✅; (4) tela de Conversas ✅ (2026-10-11); (5) áudio e preview. Antes da 5: a posse do WhatsApp e o MFA do painel interno.
- **O webhook grava antes do 200.** A IA roda depois, no `after()`. Com a gravação falha, responde 500 e a Meta reenvia. A idempotência fica no banco (uniques e funções SQL).
- **Um `try` por evento.** Falha definitiva (Zod, SQLSTATE 22 e 23) é pulada; falha transitória devolve 500.
- **O conteúdo é cifrado** com `MESSAGE_CONTENT_ENCRYPTION_KEY`, amarrado ao `clinic_id` (AAD). O log só leva `erroParaLog` (tipo e código).
- **A mensagem só entra se o WABA do `entry.id` bater com o do agente.** A prova de posse do número na conexão é bloqueio de go-live e está planejada na parte 2.
- **Exclusão LGPD** por `anonymize_patient`, atômica com a redação das mensagens. A gravação recusa paciente anonimizado (`NX010`).
- **Resposta da IA (parte 2 ✅):**
  - agendada no `after()` do webhook;
  - 10 s de agrupamento, e só a última mensagem do paciente responde;
  - fluxo reservar (`pending`, `reply_to_message_id` único), enviar, confirmar (conta na sessão e fecha na quinta);
  - falha da IA ou do envio passa para a equipe com `ai_failed_at`;
  - a retomada em 24h conta do mais recente entre a ação humana e a falha.
  - a decisão é tomada duas vezes: antes da geração, pela regra pura, e na reserva, com paciente, agente e conversa travados nessa ordem. A reserva é a palavra final, faz a retomada e devolve telefone e credencial para o envio. Achado da revisão de segurança.
- **OpenRouter:** toda chamada com `data_collection: "deny"`, fixo no código (sem `zdr` desde 2026-11-03, ver Qualificação). O modelo vem só da env. O modelo não recebe telefone nem nome do paciente.
- **A conexão do WhatsApp prova a posse do número** na Graph API. Credencial inventada não conecta mais, nem em staging.
- **Parte 3 (2026-09-27):**
  - opt-out e urgência são detectados **na recepção, antes do 200**, e não na resposta: a marca nunca se perde num `after()` que morreu;
  - a escalada (`escalate_urgent_conversation`) marca `is_urgent`, passa para a equipe e reserva o protocolo da clínica numa transação; vale também com a equipe atendendo; um protocolo por escalada;
  - a triagem casa por **início de palavra** ("dor" pega "dores", não "adorei");
  - **agendador:** job que só mexe no banco é função SQL com `cron.schedule` na migration (**pg_cron**, a Vercel Hobby só roda cron uma vez por dia); job que precisa da aplicação fica em `app/api/cron/*`, disparado pelo pg_cron com `pg_net` e segredo no Vault;
  - o cron fecha a sessão parada há mais de 1h20 (folga para mensagem atrasada), com `closed_at` = última + 20 min; varre `pending` há mais de 5 min, conversa antes de mensagem e `skip locked`;
  - o reenvio da Meta agenda a resposta enquanto a mensagem não tem resposta nem reserva;
  - a `confirm_ai_reply` não fecha sessão vencida (só não conta nela): quem fecha é a recepção, pelo `occurred_at`, ou o cron. Fechar pelo relógio do envio abria atendimento a mais com mensagem atrasada.
- **Qualificação (2026-09-27, decisões do Jhones):**
  - **mesma chamada** ao OpenRouter, com saída estruturada (`response_format` `json_schema` estrito, `{ resposta, intencao_de_agendar }`) e `provider.require_parameters: true` só quando há formato. O `deny` continua fixo, e o JSON é validado do nosso lado (`lerSaidaDoModelo`);
  - `qualified_at` é gravado **logo depois da geração**, antes da reserva, com `is null`. Vale mesmo que a resposta não saia, e a falha ao gravar só loga;
  - `finish_reason: "length"` é falha da IA (`resposta-truncada`): texto cortado nunca sai;
  - Sem ZDR desde 2026-11-03 (decisão do Jhones): o `google/gemini-2.5-flash` perdeu os endpoints do Vertex, os únicos com retenção zero, e só o Google AI Studio o serve. O AI Studio pago não usa o conteúdo para melhorar produtos, mas registra pedido e resposta por tempo limitado contra abuso; a política de privacidade diz isso. Voltar ao ZDR é trocar de modelo (ver `docs/infra-setup.md`).
- **Parte 4, tela de Conversas (2026-10-11):**
  - **Tempo real por Broadcast privado por clínica** (`conversas:<clinic_id>`, trigger com `realtime.send`, policy em `realtime.messages`), sem dado no aviso: a tela só faz `router.refresh()` e o servidor redesenha decifrado. O `postgres_changes` mandava ao anônimo um envelope a cada mudança de qualquer clínica (decisão do Jhones);
  - **ações do painel = RPC de linha única:** `update … where <estado esperado>` mais o evento em `conversation_events`, na mesma transação. Trava só a conversa, então não entra na ordem de trava da IA. A resposta é `ok`, `sem-mudanca` ou `nao-encontrada`;
  - **busca por POST** (server action e RPC `security invoker`): nome e telefone de paciente nunca em URL, nem em GET do PostgREST, que cai no log;
  - **server action é endpoint público:** qualquer membro logado chama sem passar pela página. A trava de papel fica na lib (`contextoDaTela` em `lib/conversations/queries.ts`, e a do suporte em `lib/admin/suporte.ts`), nunca só na página. Onde a lib decifra o que a RLS libera, o `podeAcessar` é a barreira;
  - **suporte:** a trilha é gravada antes do conteúdo, e sem gravação nada aparece.
- **Desempenho e sessão (2026-10-11, depois da lentidão do painel):**
  - **duas portas de tenant:** `requireClinicContext()` (leitura) confere o token pela assinatura (`getClaims`, ES256, JWKS em memória); `requireClinicContextForWrite()` (escrita, todo `lib/*/mutations.ts`) confirma no Auth (`getUser`). Teste de arquitetura barra escrita pela porta de leitura em qualquer arquivo. `requireAdminContext` segue com `getUser`;
  - **a RLS exige sessão viva:** `private.sessao_ativa()` (auth.sessions pelo `session_id` do JWT, `not_after`, banimento) dentro de `current_clinic_ids`, `is_clinic_owner` e `can_operate_conversations`. Logout e banimento valem na hora no app, no PostgREST e no Realtime; sem vínculo, a porta de leitura confere no Auth e manda para o login;
  - **telefone e nome de paciente nunca em URL do PostgREST** (cai no log): busca por RPC em POST (`patient_by_phone`, `search_conversations`);
  - **recorte de lista que a página já trouxe inteira é do navegador** (`history.pushState`/`replaceState`, que o Next sincroniza com o `useSearchParams`): filtros de Conversas e abas do Perfil. Ida ao servidor só para dado novo;
  - **menos idas em série:** a fila numa RPC (`conversation_queue`), a conversa pedida em paralelo com a fila. O Supabase está em us-west-2 (~300 ms por ida do Brasil).
- **Canal de demonstração (Evolution), 2026-10-11:** só demonstração, nunca produto. Escolhido pelo prefixo `evolution:` do identificador do agente; a rota só existe com as `EVOLUTION_*` do `.env` local; travas NX004 e NX005 no banco.

**Why:** o ritmo de "uma spec por sessão" ([[nextech-session-rhythm]]) exige que cada sessão toque um módulo só; e o isolamento entre clínicas precisa ser estrutural, não disciplinar, porque o custo do esquecimento é vazamento de dado de saúde.

**How to apply:** ao implementar qualquer feature, o código de domínio vai em `lib/<dominio>/` e obtém o tenant por `requireClinicContext()`. Ver [[nextech-testing-bar]] para a régua de teste de RLS que decorre disso.
- **Parte 5b, áudio (2026-11-03):**
  - o áudio vive só em memória: referência no `MensagemDoWebhook.audio` (media id da Meta ou base64 da Evolution), bytes baixados e descartados no `after()`. Nada de coluna de mídia;
  - transcrição pelo mesmo modelo (`input_audio`), em chamada separada; gravada cifrada só pela `save_message_transcript`, que confere consentimento e anonimização sob a trava do paciente (`for share`);
  - toda falha do caminho do áudio vira `{ falha }` para `responderConversa`, que decide depois do agrupamento: equipe atendendo não gera alerta;
  - grupo: texto gravado (`created_at`) até a janela de 10 s depois de um áudio cede a vez; a reserva aceita até `p_seen_up_to_message_id`. Regra por horário de gravação, nunca por "transcrição já gravada", para as execuções não se esperarem;
  - OpenRouter sem `zdr` e com `provider.only` nos provedores do Google (decisão do Jhones, 2.5 Flash sem ZDR); a política nomeia o Google, e `tests/legal` amarra os dois;
  - orçamento do áudio (50 s) e `maxDuration` (180 s) conferidos por teste a partir das constantes de tempo.

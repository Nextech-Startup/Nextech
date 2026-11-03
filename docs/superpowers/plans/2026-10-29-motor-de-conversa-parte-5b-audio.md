# Motor de conversa, parte 5b (áudio): plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:executing-plans`, tarefa por tarefa. Carregue `lgpd-security` antes de qualquer tarefa, `integrations` antes das tarefas 1 a 3 e `supabase-postgres-best-practices` antes da tarefa 4. Os passos usam checkbox (`- [ ]`).

## Status: ✅ concluído em 2026-11-03 (decisões ⚖️ confirmadas pelo Jhones)

## Desvios do plano, decididos na execução

- **Sem `audio_media_ref`:** a referência do áudio (media id da Meta, ou o anexo da Evolution) segue em memória do webhook até o `after()`. O reenvio da Meta traz o id de novo; com a transcrição já gravada, o reenvio nem baixa.
- **Evolution por `base64: true` no webhook**, e não pelo endpoint de base64: a instância não grava mensagens (LGPD), e o endpoint não acharia o áudio.
- **`transcript_encrypted` legível pela RLS, cifrado**, como o `content_encrypted`: a equipe lê o texto cifrado da própria clínica e só o servidor decifra. O plano falava em tirar a coluna do grant; a proteção é a mesma do conteúdo.
- **Orçamento de 50 s** para download e transcrição, com `AbortSignal`, e `maxDuration` das rotas de 120 para 180 s (a conta, pelas constantes, está em `lib/conversations/audio.test.ts`). A transcrição tem teto de 20 s por tentativa, para caberem duas.
- **A falha do áudio passa pela resposta**, depois do agrupamento e da decisão: com a equipe atendendo, não há alerta falso.
- **Sem ZDR e com o provedor fixo** (`only` com os provedores do Google), por decisão do Jhones ao saber que o 2.5 Flash perdeu os endpoints com retenção zero. Commit próprio, com a política de privacidade.
- **Grupo (revisão de QA, I2):** o texto gravado até 10 s depois de um áudio cede a vez, e o áudio responde pelos dois; `reserve_ai_reply` ganhou `p_seen_up_to_message_id` (migration `20261103140000`).
- **Correção da revisão de segurança:** a migration `20261103120000` recriou `redact_patient_messages`, apagada de propósito em `20260927140000`; `20261103130000` a apaga de novo.

**Decisões tomadas pela recomendação, com o Jhones fora** (memória `jhones-prefere-alternativas`). Revisar antes de executar: estão marcadas com ⚖️ abaixo.

## Objetivo

Hoje o áudio do paciente chega ao modelo como "[áudio, que ainda não pode ser ouvido]". A spec (`conversation-engine-v1.md`, edge case "Áudio" e "Triagem de áudio") pede:
- transcrever antes de processar;
- persistir a transcrição só com consentimento registrado (`lgpd-security`, regra 3); sem consentimento, processar em memória e descartar;
- triagem de urgência também no áudio;
- áudio a partir do plano Pro (a landing promete isso).

## Decisões deste plano

1. ⚖️ **Transcrição pelo próprio Gemini 2.5 Flash, via OpenRouter**, com o áudio em `input_audio` (base64 + `format`). Não entra um provedor novo de STT: o mesmo cliente, a mesma chave e o mesmo ZDR já declarado nas páginas legais. **O formato precisa de sonda real (tarefa 1)**. A doc do OpenRouter cita "OGG Vorbis" na lista geral, o WhatsApp manda Opus em OGG, e o exemplo de Gemini da doc usa WAV ([OpenRouter, áudio](https://openrouter.ai/docs/guides/overview/multimodal/audio)). Se `ogg` for recusado, a alternativa recomendada é o endpoint de STT do OpenRouter ([anúncio](https://openrouter.ai/blog/announcements/announcing-audio-apis/)), também sondado. Converter com ffmpeg na Vercel fica por último (binário pesado na função).
2. ⚖️ **Transcrever numa chamada separada da resposta**, não mandar o áudio direto no prompt da conversa. A transcrição alimenta três consumidores: a triagem de urgência, o histórico das próximas respostas (se houver consentimento) e a tela de Conversas. Mandar o áudio direto no prompt resolveria só a resposta.
3. ⚖️ **Onde roda:** no caminho assíncrono que já existe (`after()` da recepção, antes da janela de agrupamento de `responder`). A recepção continua gravando antes do 200, sem rede externa no caminho síncrono. A triagem do texto fica onde está; a do áudio roda depois da transcrição, pela mesma `urgencia.ts`.
4. ⚖️ **Limites:** até 2 min de duração (o webhook da Meta não informa a duração; vale o tamanho do arquivo) e até 5 MB. Acima disso, o áudio não é transcrito, segue o marcador de hoje, e a conversa vai para a equipe (`handled_by = human`), como numa falha da IA. Silêncio com o paciente, nunca "não consigo ouvir áudio".
5. ⚖️ **Plano:** Pro e HealthTech transcrevem. Starter mantém o marcador de hoje, e a IA pede que o paciente escreva (instrução nova no system prompt, só para Starter). O plano é lido de `clinics.plan`, no servidor.
6. **Consentimento:** com `patients.consent_given_at` preenchido, a transcrição é gravada cifrada (mesmo `cifrarConteudo` do texto, numa coluna nova `messages.transcript_encrypted`). Sem consentimento, ela vive só na execução: serve à triagem e à resposta daquela vez, e nas próximas o histórico volta a mostrar o marcador. O áudio em si **nunca** é gravado: é baixado, transcrito em memória e descartado.
7. **Direito de exclusão:** `anonymize_patient` passa a apagar `transcript_encrypted` junto com o conteúdo (migration da tarefa 4).
8. **Falha na transcrição:** 2 retentativas (as mesmas esperas da IA). Persistindo, a conversa vai para a equipe, sem nada ao paciente (comportamento 7 da spec).

## Fora desta parte

- Imagem e documento (seguem como marcador).
- Resposta da IA em áudio.
- Duração exata do áudio na tela (a Meta não manda; a Evolution manda `seconds`, e a tela de Conversas já tem o campo `audio.segundos` no tipo, preenchido só quando houver).

## Mapa de arquivos

- `lib/whatsapp/midia.ts` (novo): baixar a mídia da Meta (`GET /{media-id}` → URL → download com o token do agente) e da Evolution (endpoint de base64 da mensagem). Interface única `baixarAudio(canal, referencia) → { bytes, mime }`, com o limite de tamanho.
- `lib/whatsapp/webhook.ts` e `evolution-webhook.ts`: extrair a referência da mídia (o `audio.id` e o `mime_type` da Meta; a chave da mensagem da Evolution) e levá-la até a recepção.
- `lib/ai/transcricao.ts` (novo): `transcrever(bytes, mime) → texto`, com a retentativa e o erro tipado (`IaError`).
- `lib/conversations/audio.ts` (novo): orquestra plano → download → transcrição → consentimento → gravação ou descarte → triagem.
- `lib/conversations/resposta.ts`: o histórico usa a transcrição quando houver (gravada ou da execução).
- `lib/agent-config/prompt.ts`: `textoParaOModelo` aceita a transcrição; instrução de "peça para escrever" no Starter.
- `supabase/migrations/2026xxxx_message_transcripts.sql`: `messages.transcript_encrypted` + `audio_media_ref`, a função de gravação aceitando a referência, e `anonymize_patient` apagando a transcrição.
- `lib/conversations/tela.ts` e a tela de Conversas: mostrar a transcrição gravada, com o rótulo "Transcrição" (já existe `audio.transcrita` no tipo).

## Tarefas

### Tarefa 1: Sonda do formato (sem commit de produto) ✅ 2026-11-03

**Resultado:** o `google/gemini-2.5-flash` aceita o Opus em OGG do WhatsApp direto em `input_audio` com `format: "ogg"`, sem conversão. Um PTT de ~5 s (11 KB) virou 159 tokens de áudio e foi transcrito literalmente ("Oi, oi, teste 1, 2, 3.") em ~2,5 s, por US$ 0,0002 (~US$ 0,002 por minuto de áudio). O endpoint de STT do OpenRouter não foi preciso.

**Achado da sonda:** com `zdr: true`, toda chamada ao 2.5 Flash (texto e áudio) voltava 404: o modelo perdeu os endpoints do Vertex, os únicos com ZDR. O Jhones decidiu manter o 2.5 Flash e tirar o `zdr` (commit próprio, com a política de privacidade). Os Gemini 3.5 Flash Lite, 3.7 e 3.8 Flash têm ZDR e também transcreveram certo, para quando quiser voltar.

- [x] Gravar um áudio real de WhatsApp (o chip da demonstração, pela Evolution) e guardar o `.ogg` fora do repositório.
- [x] Script no scratchpad: mandar o `.ogg` ao `google/gemini-2.5-flash` pelo OpenRouter com `format: "ogg"` e pedir a transcrição literal.
- [x] Se recusar ou transcrever mal: repetir pelo endpoint de STT do OpenRouter. Registrar no plano qual caminho venceu, com o custo por minuto observado.
- [x] Nada de áudio real de paciente na sonda: só o da equipe.

### Tarefa 2: Download da mídia
- [x] Testes primeiro (`lib/whatsapp/midia.test.ts`): Meta em duas etapas com o Bearer do agente; Evolution; recusa acima de 5 MB sem ler o resto do corpo; erro da Meta sem o token no erro nem no log.
- [x] Implementar `baixarAudio`.
- [x] Extrair a referência nos dois webhooks, com teste dos payloads reais (fixture da Meta e da Evolution).

### Tarefa 3: Transcrição
- [x] Testes primeiro (`lib/ai/transcricao.test.ts`): corpo da requisição no formato da sonda, retentativa, texto vazio tratado como falha, log sem conteúdo.
- [x] Implementar `transcrever`.

### Tarefa 4: Banco
- [x] Migration: `messages.transcript_encrypted` (fora do grant de `authenticated`, lido pela RPC/visão da tela como o conteúdo hoje), `messages.audio_media_ref` (só `service_role`), `register_whatsapp_message` aceitando a referência, `anonymize_patient` apagando os dois.
- [x] Testes de RLS (`tests/rls/`): a sessão não lê a referência; a transcrição só sai decifrada pelo caminho da tela; anonimizar apaga a transcrição.

### Tarefa 5: Orquestração
- [x] Testes primeiro (`lib/conversations/audio.test.ts`), com download e transcrição simulados:
  - Starter não baixa nem transcreve;
  - Pro com consentimento grava cifrado; sem consentimento não grava, e a transcrição chega à resposta daquela execução;
  - áudio grande vai para a equipe sem chamar a IA;
  - falha da transcrição vai para a equipe, sem nada ao paciente;
  - transcrição com palavra-chave de urgência escala e devolve o protocolo, como o texto.
- [x] Ligar ao `after()` da recepção, antes de `responder`.

### Tarefa 6: Prompt e histórico
- [x] `textoParaOModelo` com transcrição: `[áudio transcrito] …`. Teste em `prompt.test.ts`.
- [x] Instrução do Starter. Teste.

### Tarefa 7: Tela de Conversas
- [x] Mostrar a transcrição gravada sob o balão do áudio; sem ela, o balão de hoje. Teste do mapeamento em `tela.test.ts`.
- [ ] Revisão visual no navegador, nos dois temas, em 1440 e 390 px. **Pendente com o Jhones** (a tela exige login); coberto por teste de componente.

### Tarefa 8: Revisões e fechamento
- [x] `security-reviewer` (áudio é dado de saúde: download, memória, log, retenção) e `qa-reviewer`.
- [x] Suíte inteira, status, spec (`conversation-engine-v1.md`, parte 5 ✅ e a triagem de áudio fora de "Em aberto") e páginas legais, se a transcrição mudar o que a política de privacidade descreve sobre o fornecedor de IA.

## Riscos

- **Credenciais da Meta ainda não existem:** o download da Meta é construído contra fixture, como o webhook foi. A demonstração pela Evolution exercita o fluxo de ponta a ponta.
- **Custo:** áudio no Gemini custa mais que texto por segundo. Medir na sonda e registrar no `atendimento-billing-v1.md`.
- **Qualidade com sotaque e ruído:** medir com áudios da equipe antes de abrir para clínica real.

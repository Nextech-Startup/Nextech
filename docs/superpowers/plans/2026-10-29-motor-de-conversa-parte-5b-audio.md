# Motor de conversa, parte 5b (áudio): plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:executing-plans`, tarefa por tarefa. Carregue `lgpd-security` antes de qualquer tarefa, `integrations` antes das tarefas 1 a 3 e `supabase-postgres-best-practices` antes da tarefa 4. Os passos usam checkbox (`- [ ]`).

## Status: 📝 plano escrito em 2026-10-29, não iniciado

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

### Tarefa 1: Sonda do formato (sem commit de produto)
- [ ] Gravar um áudio real de WhatsApp (o chip da demonstração, pela Evolution) e guardar o `.ogg` fora do repositório.
- [ ] Script no scratchpad: mandar o `.ogg` ao `google/gemini-2.5-flash` pelo OpenRouter com `format: "ogg"` e pedir a transcrição literal.
- [ ] Se recusar ou transcrever mal: repetir pelo endpoint de STT do OpenRouter. Registrar no plano qual caminho venceu, com o custo por minuto observado.
- [ ] Nada de áudio real de paciente na sonda: só o da equipe.

### Tarefa 2: Download da mídia
- [ ] Testes primeiro (`lib/whatsapp/midia.test.ts`): Meta em duas etapas com o Bearer do agente; Evolution; recusa acima de 5 MB sem ler o resto do corpo; erro da Meta sem o token no erro nem no log.
- [ ] Implementar `baixarAudio`.
- [ ] Extrair a referência nos dois webhooks, com teste dos payloads reais (fixture da Meta e da Evolution).

### Tarefa 3: Transcrição
- [ ] Testes primeiro (`lib/ai/transcricao.test.ts`): corpo da requisição no formato da sonda, retentativa, texto vazio tratado como falha, log sem conteúdo.
- [ ] Implementar `transcrever`.

### Tarefa 4: Banco
- [ ] Migration: `messages.transcript_encrypted` (fora do grant de `authenticated`, lido pela RPC/visão da tela como o conteúdo hoje), `messages.audio_media_ref` (só `service_role`), `register_whatsapp_message` aceitando a referência, `anonymize_patient` apagando os dois.
- [ ] Testes de RLS (`tests/rls/`): a sessão não lê a referência; a transcrição só sai decifrada pelo caminho da tela; anonimizar apaga a transcrição.

### Tarefa 5: Orquestração
- [ ] Testes primeiro (`lib/conversations/audio.test.ts`), com download e transcrição simulados:
  - Starter não baixa nem transcreve;
  - Pro com consentimento grava cifrado; sem consentimento não grava, e a transcrição chega à resposta daquela execução;
  - áudio grande vai para a equipe sem chamar a IA;
  - falha da transcrição vai para a equipe, sem nada ao paciente;
  - transcrição com palavra-chave de urgência escala e devolve o protocolo, como o texto.
- [ ] Ligar ao `after()` da recepção, antes de `responder`.

### Tarefa 6: Prompt e histórico
- [ ] `textoParaOModelo` com transcrição: `[áudio transcrito] …`. Teste em `prompt.test.ts`.
- [ ] Instrução do Starter. Teste.

### Tarefa 7: Tela de Conversas
- [ ] Mostrar a transcrição gravada sob o balão do áudio; sem ela, o balão de hoje. Teste do mapeamento em `tela.test.ts`.
- [ ] Revisão visual no navegador, nos dois temas, em 1440 e 390 px.

### Tarefa 8: Revisões e fechamento
- [ ] `security-reviewer` (áudio é dado de saúde: download, memória, log, retenção) e `qa-reviewer`.
- [ ] Suíte inteira, status, spec (`conversation-engine-v1.md`, parte 5 ✅ e a triagem de áudio fora de "Em aberto") e páginas legais, se a transcrição mudar o que a política de privacidade descreve sobre o fornecedor de IA.

## Riscos

- **Credenciais da Meta ainda não existem:** o download da Meta é construído contra fixture, como o webhook foi. A demonstração pela Evolution exercita o fluxo de ponta a ponta.
- **Custo:** áudio no Gemini custa mais que texto por segundo. Medir na sonda e registrar no `atendimento-billing-v1.md`.
- **Qualidade com sotaque e ruído:** medir com áudios da equipe antes de abrir para clínica real.

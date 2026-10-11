# Spec: Canal de demonstração pela Evolution API (v1)

## Por que isso existe
A apresentação para investidor precisa da IA conversando pelo WhatsApp de verdade: o investidor manda mensagem do próprio celular e recebe a resposta. As credenciais da Meta ainda não existem (`docs/status.md`), e o canal do produto, a Cloud API oficial, depende delas.

A Evolution API foi tirada do projeto (skills `integrations` e `architecture`) e **continua fora do produto**. Ela volta só como canal de demonstração: isolada, desligada em produção, num número que é da Nextech e nunca de uma clínica.

## Objetivo
Numa apresentação, um número de WhatsApp da Nextech responde com o motor de conversa real (resposta da IA, triagem de urgência, opt-out, qualificação e eco), e a conversa aparece ao vivo na tela de Conversas de uma clínica de apresentação.

## Decisões (Jhones, 2026-10-11)
1. **Evolution API só para a demonstração.** O canal do produto continua sendo a Cloud API oficial da Meta.
2. **Clínica de apresentação separada**, a "Clínica Apresentação Nextech":
   - comum, sem `is_demo`, para que a tela de Conversas mostre a conversa real;
   - owner próprio, `apresentacao@nextech.ia.br`. Não o `admin@`: quem é membro de duas clínicas abre uma delas ao acaso (`requireClinicContext`, dívida em `docs/status.md`);
   - um agente de verdade.

   A conta de demonstração segue intacta, com as outras telas e o trigger NX004.
3. **A Evolution roda no computador do Jhones, só durante a apresentação.**
4. **A IA só responde a números cadastrados.** Mensagem de outro número é ignorada: não é gravada, e o log não leva o telefone.
5. **Teto diário de respostas da IA** na clínica de apresentação.
6. **Urgência, opt-out e qualificação valem como no produto**, pelo motor real.
7. **O teste com a IA no painel** (o "Teste seguro") fica para a parte 5 da 3b, para todas as clínicas.

## Topologia
Tudo na mesma máquina, durante a apresentação:

```
celular do investidor ──WhatsApp──▶ chip da Nextech (Evolution, Docker local)
                                          │ webhook (cabeçalho com segredo)
                                          ▼
                         app Nextech (next start local) ──▶ Supabase (o mesmo banco)
                                          │ sendText (apikey)
                                          ▼
                                   Evolution ──WhatsApp──▶ celular do investidor
```

- A Evolution sobe pelo Docker Compose, com Postgres e Redis próprios, e escuta só em `localhost`.
- O webhook vai da Evolution para o app local; o envio vai do app para a Evolution local. Nada fica exposto na internet, e **não há túnel**. Túnel só seria preciso se o webhook fosse para a Vercel, o que não foi escolhido.
- O painel é mostrado pelo app local, que decifra com a mesma `MESSAGE_CONTENT_ENCRYPTION_KEY` que cifrou. Pela produção, a conversa só aparece se a chave da Vercel for a mesma; isso não é requisito.
- **Em produção e na staging, o canal fica desligado:** sem as variáveis `EVOLUTION_*`, a rota responde 404 e o envio pela Evolution não existe.

## Comportamento

### 1. Recepção (`app/api/whatsapp/evolution`)
1. A rota só existe com `EVOLUTION_*` configuradas; sem elas, responde 404.
2. O cabeçalho com o segredo do webhook é comparado com `comparacaoSegura()`. Faltando ou errado, responde 401 e não grava nada.
3. Só o evento de mensagem nova (`MESSAGES_UPSERT`) da instância configurada é processado. Os outros eventos e as outras instâncias respondem 200 e são ignorados.
4. A leitura do payload é uma função pura, com teste, que devolve o formato que a recepção do motor já usa:
   - telefone em E.164, vindo do `remoteJid`;
   - autor `patient`, ou `human` quando a mensagem saiu do próprio celular (`fromMe`, o eco da coexistência);
   - id da mensagem (`key.id`) como `wa_message_id`, com prefixo próprio para nunca colidir com id da Meta;
   - texto, ou o tipo da mídia.
5. Grupo, status e lista de transmissão são ignorados.
6. Número fora da lista de permitidos é ignorado, sem gravar. O log leva só o motivo, nunca o número.
7. Daqui em diante, o caminho é o mesmo do webhook da Meta: `register_whatsapp_message` grava antes do 200; opt-out e urgência são detectados na recepção; a resposta da IA é agendada no `after()`, com o agrupamento de 10 s.

### 2. Envio
- O envio da resposta da IA e do protocolo de urgência escolhe o cliente pelo canal do agente: Cloud API, como hoje, ou Evolution (`POST /message/sendText/{instância}`, com `apikey`).
- O cliente da Evolution fica em `lib/whatsapp/` (regra 6 do `CLAUDE.md`), com a mesma interface de envio do cliente da Meta: devolve o id da mensagem para o `confirm_ai_reply`.
- **Como o agente marca o canal, sem migration:** o agente da clínica de apresentação guarda a instância no identificador de conexão, com prefixo `evolution:`, e o token da instância cifrado como credencial do agente (regra 8: segredo por tenant cifrado em repouso). Só o script de preparo grava esses campos, pelo `service_role`. É o que o gatilho de publicação exige (NX001 e NX002) para o agente ficar `active`.

### 3. Teto diário
- Antes de chamar a IA, conta as respostas da IA da clínica de apresentação no dia (fuso de São Paulo), pela própria tabela `messages`, sem tabela nova.
- No teto, a IA não é chamada, e a conversa passa para a equipe sem nada enviado: é o handoff silencioso do comportamento 7 do motor.
- O valor vem de uma variável `EVOLUTION_*`, com padrão de 100 por dia.

### 4. Preparo e limpeza (scripts em `scripts/`, idempotentes como o da demonstração)
- **Preparo:** cria a clínica de apresentação e o owner, preenche o perfil com dado fictício (procedimentos, convênios, política de agendamento), cria uma regra de urgência ativa com protocolo fictício e um agente com persona, saudação e horário, conecta-o à instância e o publica. Registra o preparo na trilha (`admin_audit_log`).
- **Limpeza, ao fim de cada apresentação:** anonimiza os pacientes da clínica de apresentação (`anonymize_patient`, que redige o conteúdo das mensagens) e confere no banco que não sobrou telefone nem conteúdo. O telefone e as mensagens do investidor são dado pessoal real.

## Edge cases
- **Evolution parada ou chip desconectado:** o envio falha, e o motor segue o caminho de falha que já existe (`ai_failed_at`, conversa para a equipe, nada enviado).
- **Webhook repetido pela Evolution:** resolvido pela unicidade de `wa_message_id`, como na Meta.
- **Investidor manda áudio:** o motor ainda não transcreve (parte 5). A spec de implementação confere o que a IA faz com ele. Na apresentação, combinar mensagens de texto.
- **Resposta pelo celular do chip:** chega como `fromMe` e vira eco: a IA para naquela conversa, como na coexistência.
- **Bloqueio do número pelo WhatsApp:** risco aceito do canal não oficial. Por isso o chip é dedicado e nunca de clínica.

## Segurança e LGPD (`lgpd-security`)
- **Conteúdo:** cifrado como no produto. O log leva só metadado (`erroParaLog`), nunca conteúdo nem telefone, inclusive no caminho de número recusado.
- **Segredos de infraestrutura** (URL e `apikey` da Evolution, segredo do webhook, lista de números permitidos): só no `.env` local. Nada na Vercel.
- **Retenção:** limpeza ao fim de cada apresentação.
- **Posse do WhatsApp:** o achado alto segue aberto (`docs/status.md`). Enquanto só houver contas da Nextech, o risco fica contido; a correção continua bloqueio de go-live.

## Fora desta spec
- O teste com a IA real no painel (parte 5 da 3b).
- O canal Evolution em produção ou para clínica de verdade.
- Transcrição de áudio.

## Planos afetados
Nenhum: é um canal interno de demonstração. A clínica de apresentação usa o plano HealthTech.

## Dependências (ação do Jhones)
- Um chip dedicado com WhatsApp, conectado à Evolution por QR code.
- Docker Desktop rodando no computador da apresentação.
- Os números do investidor e do Jhones na lista de permitidos, no `.env` local.
- `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` e `MESSAGE_CONTENT_ENCRYPTION_KEY` no `.env` local (já existem).
- Passo a passo em `docs/infra-setup.md`, escrito na implementação.

## Critério de aceite
- [ ] Sem `EVOLUTION_*`, a rota responde 404 e nada é gravado.
- [ ] Segredo do webhook ausente ou errado: 401, nada gravado.
- [ ] Mensagem de número permitido grava paciente, conversa e mensagem na clínica de apresentação, e a resposta da IA sai pela Evolution (fetch interceptado) e é confirmada.
- [ ] Mensagem `fromMe` vira eco (`author = human`) e silencia a IA.
- [ ] Número fora da lista: nada gravado, e o log não tem o número.
- [ ] Grupo, status e evento que não é mensagem nova são ignorados com 200.
- [ ] O mesmo `key.id` duas vezes grava uma mensagem e gera uma resposta.
- [ ] Palavra de urgência manda o protocolo da clínica pela Evolution e passa a conversa para a equipe.
- [ ] Opt-out não gera resposta.
- [ ] Falha no envio pela Evolution passa a conversa para a equipe, sem nada enviado.
- [ ] No teto diário, a IA não é chamada.
- [ ] Log sem conteúdo nem telefone em todos os caminhos, inclusive no de erro (teste com o `console` espionado).
- [ ] Os scripts de preparo e de limpeza são idempotentes. A limpeza deixa a clínica de apresentação sem telefone nem conteúdo de paciente, conferido no banco.
- [ ] **Ensaio real antes da apresentação**, com o chip conectado: três conversas do celular do Jhones, cada uma respondida em menos de 30 s; uma urgência com o protocolo; uma resposta pelo celular do chip calando a IA; e a conversa aparecendo ao vivo na tela de Conversas.

## Como medir
O ensaio real (último critério) sem falha, e na apresentação o investidor recebendo resposta em todas as mensagens de texto.

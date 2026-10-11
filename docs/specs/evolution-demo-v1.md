# Spec: Canal de demonstração pela Evolution API (v1)

## Por que isso existe
A apresentação para investidor precisa da IA conversando pelo WhatsApp de verdade: o investidor manda mensagem do próprio celular e recebe a resposta. As credenciais da Meta ainda não existem (`docs/status.md`), e o canal do produto, a Cloud API oficial, depende delas.

A Evolution API foi tirada do projeto (skills `integrations` e `architecture`) e **continua fora do produto**. Ela volta só como canal de demonstração: isolada, desligada em produção, num número que é da Nextech e nunca de uma clínica.

## Objetivo
Numa apresentação, com um login só (`clinica@nextech.ia.br`, a conta de demonstração):
- todas as telas do sidebar abrem com o dado de exemplo, como hoje;
- um número de WhatsApp da Nextech responde com o motor de conversa real (resposta da IA, triagem de urgência, opt-out, qualificação e eco);
- a conversa do investidor aparece ao vivo na tela de Conversas da demonstração, junto das conversas de exemplo.

## Decisões (Jhones, 2026-10-11)
1. **Evolution API só para a demonstração.** O canal do produto continua sendo a Cloud API oficial da Meta.
2. **A conversa real cai na própria conta de demonstração**, para o tour pelo sidebar e a conversa ao vivo usarem o mesmo login. Isso muda a `demo-account-v1`: até aqui, a demonstração nunca recebia mensagem real (NX004).
3. **A Evolution roda no computador do Jhones, só durante a apresentação.**
4. **A IA só responde a números cadastrados.** Mensagem de outro número é ignorada: não é gravada, e o log não leva o telefone.
5. **Teto diário de respostas da IA** na clínica de demonstração.
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
- O painel é mostrado pelo app local, que decifra com a mesma `MESSAGE_CONTENT_ENCRYPTION_KEY` que cifrou. Pela produção, a conversa real só aparece se a chave da Vercel for a mesma; isso não é requisito.
- **Em produção e na staging, o canal fica desligado:** sem as variáveis `EVOLUTION_*`, a rota responde 404 e o envio pela Evolution não existe. A tela de Conversas da demonstração continua mostrando as conversas reais da clínica que existirem, o que fora das apresentações é nenhuma (ver Limpeza).

## Comportamento

### 1. Recepção (`app/api/whatsapp/evolution`)
1. A rota só existe com `EVOLUTION_*` configuradas; sem elas, responde 404.
2. O cabeçalho com o segredo do webhook é comparado com `comparacaoSegura()`. Faltando ou errado, responde 401 e não grava nada.
3. Só o evento de mensagem nova (`MESSAGES_UPSERT`) da instância configurada é processado. Os outros eventos e as outras instâncias respondem 200 e são ignorados.
4. O agente é procurado pelo identificador `evolution:<instância>`, que é único no banco (`whatsapp_phone_number_id` é UNIQUE global) e **só pode existir em agente da clínica de demonstração** (regra no banco, ver item 3 de Comportamento). Assim, um agente de outra clínica não toma o identificador pelo achado da posse, nem pelo `authenticated` nem pelo `service_role`.
5. A leitura do payload é uma função pura, com teste, que devolve o formato que a recepção do motor já usa:
   - telefone em E.164, vindo do `remoteJid`;
   - autor `patient`, ou `human` quando a mensagem saiu do próprio celular (`fromMe`, o eco da coexistência);
   - id da mensagem (`key.id`) como `wa_message_id`, com prefixo próprio para nunca colidir com id da Meta;
   - texto, ou o tipo da mídia.
6. Grupo, status e lista de transmissão são ignorados.
7. Número fora da lista de permitidos é ignorado, sem gravar. O log leva só o motivo, nunca o número.
8. Daqui em diante, o caminho é o mesmo do webhook da Meta: `register_whatsapp_message` grava antes do 200; opt-out e urgência são detectados na recepção; a resposta da IA é agendada no `after()`, com o agrupamento de 10 s.

### 2. Envio
- O envio da resposta da IA e do protocolo de urgência escolhe o cliente pelo canal do agente: Cloud API, como hoje, ou Evolution (`POST /message/sendText/{instância}`, com `apikey`).
- O cliente da Evolution fica em `lib/whatsapp/` (regra 6 do `CLAUDE.md`), com a mesma interface de envio do cliente da Meta: devolve o id da mensagem para o `confirm_ai_reply`.
- **Como o agente marca o canal, sem coluna nova:** o agente do canal guarda a instância no identificador de conexão, com prefixo `evolution:`, e o token da instância cifrado como credencial do agente (regra 8: segredo por tenant cifrado em repouso). É o que o gatilho de publicação exige (NX001 e NX002) para o agente ficar `active`.

### 3. A trava da demonstração (NX004), numa migration nova
- **Continua:** o `authenticated` não grava número nem credencial de WhatsApp em agente da clínica de demonstração, nem o publica. O `clinica@` e o `admin@` seguem sem conseguir conectar nada por lá.
- **Muda:** só o `service_role` (o script de conexão) grava, na clínica de demonstração, um identificador com prefixo `evolution:` e publica esse agente. Identificador da Meta continua recusado na demonstração, por qualquer papel.
- **Novo:** identificador `evolution:` fora da clínica de demonstração é recusado, por qualquer papel.
- A outra ponta (`clinic_block_demo_with_whatsapp`) não muda: clínica de cliente com WhatsApp continua sem poder virar demonstração.
- Migration aditiva, com `--dry-run` antes. Ela troca a função de um trigger de tabela existente, mas não muda grant.

### 4. A tela de Conversas da demonstração
- **Fila:** as conversas reais da clínica de demonstração, lidas e decifradas como na tela real (`lib/conversations`), mais as de exemplo, trazidas para hoje. Uma lista só, na ordem de sempre (urgente primeiro, depois a mais recente), com a contagem por estado somando as duas.
- **Conversa aberta:** id de conversa real (uuid) abre pela leitura real, com as ações reais (assumir, devolver, resolver a urgência). Id de exemplo (`c-urgente` e afins) abre do fixture, com o protótipo, como hoje.
- **Ao vivo:** a tela assina o canal privado da clínica de demonstração, como a tela real. A mensagem do investidor aparece sem recarregar.
- **Busca por POST também na demonstração.** A busca por `?q=` sai, porque o termo passa a poder ser nome ou telefone real (`lgpd-security`, regra 1). A action procura nas conversas reais (pela RPC `search_conversations`) e nas de exemplo, e devolve as duas juntas.
- **Fora de Conversas, nada muda:** Visão geral, Pacientes, Agentes e as outras telas continuam só com o dado de exemplo. O investidor não aparece em Pacientes, e o agente do canal não aparece em Agentes. Aceito: a conversa ao vivo é o que importa na apresentação.

### 5. Teto diário
- Antes de chamar a IA, conta as respostas da IA da clínica de demonstração no dia (fuso de São Paulo), pela própria tabela `messages`, sem tabela nova.
- No teto, a IA não é chamada, e a conversa passa para a equipe sem nada enviado: é o handoff silencioso do comportamento 7 do motor.
- O valor vem de uma variável `EVOLUTION_*`, com padrão de 100 por dia.

### 6. Conexão e limpeza (scripts em `scripts/`, idempotentes como o da demonstração)
- **Conectar, antes da apresentação:**
  - cria ou atualiza, na clínica de demonstração, o agente do canal (persona, saudação e horário fictícios), liga-o à instância e o publica;
  - garante uma regra de urgência ativa com protocolo fictício no perfil da clínica;
  - registra a conexão na trilha (`admin_audit_log`).
- **Desconectar e limpar, ao fim de cada apresentação:**
  - apaga os pacientes, as conversas e as mensagens da clínica de demonstração. O telefone e as mensagens do investidor são dado pessoal real;
  - tira o agente do ar e apaga o identificador e a credencial dele;
  - registra a limpeza na trilha e confere no banco que não sobrou paciente nem agente conectado.

  A demonstração volta ao estado de antes, e o script de preparo dela (`scripts/conta-demo`), que recusa clínica com paciente ou com agente conectado, continua valendo.

## Edge cases
- **Evolution parada ou chip desconectado:** o envio falha, e o motor segue o caminho de falha que já existe (`ai_failed_at`, conversa para a equipe, nada enviado).
- **Webhook repetido pela Evolution:** resolvido pela unicidade de `wa_message_id`, como na Meta.
- **Investidor manda áudio:** o motor ainda não transcreve (parte 5). A implementação confere o que a IA faz com ele. Na apresentação, combinar mensagens de texto.
- **Resposta pelo celular do chip:** chega como `fromMe` e vira eco: a IA para naquela conversa, como na coexistência.
- **Bloqueio do número pelo WhatsApp:** risco aceito do canal não oficial. Por isso o chip é dedicado e nunca de clínica.
- **Esqueceram a limpeza:** a conversa real continua na demonstração, que fica com dado pessoal. O script de preparo da demonstração passa a recusar até a limpeza rodar, o que avisa.

## Segurança e LGPD (`lgpd-security`)
- **Dado real na conta de demonstração:** a conversa do investidor fica cifrada como no produto, só enquanto durar a apresentação, e sai na limpeza. A senha do `clinica@` é de dono e nunca é entregue (`demo-account-v1`).
- **Log:** só metadado (`erroParaLog`), nunca conteúdo nem telefone, inclusive no caminho de número recusado.
- **Segredos de infraestrutura** (URL e `apikey` da Evolution, segredo do webhook, lista de números permitidos): só no `.env` local. Nada na Vercel.
- **Posse do WhatsApp:** o achado alto segue aberto (`docs/status.md`). A recepção procura o agente pela instância e pela clínica, e só o `service_role` conecta o canal na demonstração. A correção continua bloqueio de go-live.

## Fora desta spec
- O teste com a IA real no painel (parte 5 da 3b).
- O canal Evolution em produção ou para clínica de verdade.
- Transcrição de áudio.
- Dado real nas outras telas da demonstração (Visão geral, Pacientes, Agentes).

## Planos afetados
Nenhum: é um canal interno de demonstração. A clínica de demonstração usa o plano HealthTech.

## Specs afetadas
- `demo-account-v1.md`: a demonstração passa a receber a conversa real do canal, com a trava do NX004 restrita ao `authenticated` e a busca por POST.
- Skills `integrations` e `architecture`: registrar a Evolution como canal só de demonstração.

## Dependências (ação do Jhones)
- [x] Um celular dedicado com o chip da demonstração (confirmado em 2026-10-11). Conecta à Evolution por QR code na implementação.
- [x] Docker instalado no computador da apresentação (confirmado em 2026-10-11).
- [ ] Os números que vão conversar (o do investidor e outro celular para o ensaio, diferente do chip), na lista de permitidos do `.env` local.
- `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` e `MESSAGE_CONTENT_ENCRYPTION_KEY` no `.env` local (já existem).
- Passo a passo em `docs/infra-setup.md`, escrito na implementação.

## Critério de aceite
- [ ] Sem `EVOLUTION_*`, a rota responde 404 e nada é gravado.
- [ ] Segredo do webhook ausente ou errado: 401, nada gravado.
- [ ] Mensagem de número permitido grava paciente, conversa e mensagem na clínica de demonstração, e a resposta da IA sai pela Evolution (fetch interceptado) e é confirmada.
- [ ] Agente de outra clínica com o mesmo identificador não recebe a mensagem.
- [ ] Mensagem `fromMe` vira eco (`author = human`) e silencia a IA.
- [ ] Número fora da lista: nada gravado, e o log não tem o número.
- [ ] Grupo, status e evento que não é mensagem nova são ignorados com 200.
- [ ] O mesmo `key.id` duas vezes grava uma mensagem e gera uma resposta.
- [ ] Palavra de urgência manda o protocolo da clínica pela Evolution e passa a conversa para a equipe.
- [ ] Opt-out não gera resposta.
- [ ] Falha no envio pela Evolution passa a conversa para a equipe, sem nada enviado.
- [ ] No teto diário, a IA não é chamada.
- [ ] Log sem conteúdo nem telefone em todos os caminhos, inclusive no de erro (teste com o `console` espionado).
- [ ] **NX004, contra o banco:** o `authenticated` continua recusado ao gravar identificador (da Meta ou `evolution:`) e ao publicar agente na demonstração. O `service_role` grava `evolution:` e publica. Identificador da Meta é recusado na demonstração também pelo `service_role`, e `evolution:` é recusado em clínica que não é de demonstração, por qualquer papel.
- [ ] **Conversas da demonstração:** a fila junta a conversa real com as de exemplo, na ordem e com a contagem certas. A real abre com as ações reais, e a de exemplo com o protótipo. A mensagem nova aparece ao vivo.
- [ ] **Busca da demonstração por POST:** a página não lê `?q=`, e a busca acha a conversa real e a de exemplo.
- [ ] **Isolamento:** o membro de outra clínica não vê a conversa real da demonstração (RLS e canal privado, contra o banco real).
- [ ] Os scripts de conexão e de limpeza são idempotentes. Depois da limpeza, a clínica de demonstração fica sem paciente, conversa, mensagem nem agente conectado, conferido no banco, e o script de preparo da demonstração volta a passar.
- [ ] **Ensaio real antes da apresentação**, com o chip conectado, pelo `clinica@`:
  - três conversas do celular do Jhones, cada uma respondida em menos de 30 s;
  - uma urgência com o protocolo;
  - uma resposta pelo celular do chip calando a IA;
  - a conversa aparecendo ao vivo na tela de Conversas, entre as de exemplo;
  - o tour pelas outras telas do sidebar no mesmo login.

## Como medir
O ensaio real (último critério) sem falha. Na apresentação, o investidor recebe resposta em todas as mensagens de texto, e o tour pelo sidebar não troca de login.

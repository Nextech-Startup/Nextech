# Spec: CRM próprio, o funil comercial da clínica (v1)

## Por que existe
A IA atende, qualifica e passa para a equipe, mas o que acontece depois (agendou, compareceu, fechou o tratamento) não fica em lugar nenhum do Nextech. A clínica sem Pipedrive ou Kommo perde esse acompanhamento, e o Nextech não consegue mostrar o retorno do próprio atendimento. O site promete "Integração total no CRM" a partir do Pro, mas os adaptadores para CRM externo são a fase 6 e não resolvem a clínica que não tem CRM nenhum.

## Objetivo
Um funil comercial dentro do painel da clínica (`/dashboard/crm`, item "CRM" no menu):
- cada contato vira uma **oportunidade**, que anda por etapas fixas;
- o que o sistema já sabe move a oportunidade sozinho (conversa nova, qualificação da IA); a equipe move o resto;
- o dono vê, numa linha, quanto está em cada etapa, quanto isso vale e quanto foi ganho no período.

## Decisões (Jhones, 2026-10-11)
1. **Funil comercial da clínica**, no painel da clínica. Não é o CRM de vendas da Nextech nem uma ficha de relacionamento.
2. **Etapas fixas, iguais para toda clínica, que andam sozinhas** com os eventos do sistema; a equipe move à mão o que o sistema não vê.
3. **O cartão é uma oportunidade**, não o paciente: um paciente pode ter várias ao longo do tempo, uma aberta por vez.
4. **Planos Pro e HealthTech**, a mesma régua da integração com CRM externo prometida no site.
5. **O CRM próprio é a fonte.** Na fase 6, o adaptador de CRM externo só espelha para fora, em mão única, pela interface `CrmAdapter` (`syncLead`, `updateDealStage`). Nada de sincronização nesta v1, mas o modelo nasce pronto para ela.
6. **Nota livre na oportunidade, cifrada** como o conteúdo das mensagens.
7. **Duas partes, uma spec:** parte 1 é a tela com dado de exemplo na conta de demonstração; parte 2 é o backend e a tela real. Cada parte numa sessão.
8. **A automação das etapas mora no banco**, em *triggers* na mesma transação de quem gera o evento.
9. **Mover por arrastar e por menu:** arrastar entre colunas no desktop (`@dnd-kit`, também por teclado) e o "Mover para…" no cartão e no painel.

## Comportamento

### 1. Etapas
| Etapa | Como entra | Aberta? |
|---|---|---|
| **Novo** | Sozinha: primeira mensagem do paciente que não tem oportunidade aberta | sim |
| **Qualificado** | Sozinha: a IA viu intenção de agendar (`conversations.qualified_at` passou de nulo para preenchido). Também à mão | sim |
| **Agendado** | À mão nesta v1. Sozinha quando o motor de agendamento (fase 5) existir | sim |
| **Compareceu** | À mão. Na fase 5, pelo status da consulta | sim |
| **Ganho** | À mão. Pede procedimento e valor fechado | não (encerra) |
| **Perdido** | À mão. Pede o motivo, numa lista fixa | não (encerra) |

Motivos de perda (lista fixa, nunca texto livre): preço; sem horário que sirva; escolheu outra clínica; parou de responder; não era paciente (engano, propaganda); outro.

### 2. Regras de movimento
- **Uma oportunidade aberta por paciente**, garantido no banco (índice único parcial). Mensagem nova de quem já tem oportunidade aberta só atualiza a "última atividade".
- **Só a mensagem do paciente abre oportunidade.** Eco da equipe não abre. Conversa atendida só pela equipe fica em Novo até alguém mover (o modelo não roda nela, e `qualified_at` nunca é gravado).
- **O automático só avança, nunca recua.** A qualificação só move quem está em Novo; se a equipe já moveu para Agendado, a qualificação que chega depois não rebaixa.
- **O manual vai para qualquer etapa**, inclusive para trás. A mudança é feita sobre a etapa que a tela viu: se o cartão mudou no meio do caminho, a resposta é `sem-mudanca`, e a tela se atualiza.
- **Toda mudança de etapa vira evento:** de onde, para onde, quando e quem (um membro, ou "sistema").
- **Ganho e Perdido encerram** (`closed_at`). Se o paciente volta a escrever, abre oportunidade **nova**; a encerrada continua contando no período dela. Não há "reabrir" nesta v1.
- **Opt-out não mexe na etapa** (é sobre as sequências); o cartão mostra um selo.
- **Sem migração de dado antigo:** não há cliente; o funil conta a partir da implantação.

### 3. Modelo de dado (parte 2)
- **`opportunities`**:
  - `clinic_id` e `patient_id`, com chave estrangeira composta paciente+clínica (como `messages`), para nunca apontar para paciente de outra clínica; apagar o paciente apaga as oportunidades dele (cascata);
  - `conversation_id`: a conversa que a abriu;
  - `stage` (enum das seis etapas), `stage_changed_at`, `last_activity_at`, `opened_at`, `closed_at`;
  - `procedure_id` (procedimento do perfil da clínica; `on delete set null`), `value_cents` (inteiro, BRL, opcional), `owner_user_id` (membro da clínica, opcional), `next_action_at` (opcional);
  - `lost_reason` (enum; obrigatório quando `stage = 'perdido'`, nulo nas outras);
  - `notes_encrypted` (`-- PII`) e `notes_redacted_at`;
  - checks: Ganho e Perdido exigem `closed_at`; as abertas não têm.
- **`opportunity_events`**: `clinic_id`, `opportunity_id`, `from_stage` (nulo na abertura), `to_stage`, `actor_user_id` (nulo = sistema), `created_at`. Só inserção.
- **Automação, no banco:**
  - *trigger* depois de inserir mensagem com `author = 'patient'`: abre a oportunidade em Novo, ou atualiza `last_activity_at` da aberta. Na mesma transação da `register_whatsapp_message`, que não muda: o reenvio da Meta não insere a mensagem de novo e não duplica nada;
  - *trigger* no `qualified_at` da conversa (nulo para preenchido): avança para Qualificado só a oportunidade aberta do paciente que está em Novo;
  - os dois gravam o evento com autor "sistema".
- **Mudança manual de etapa:** RPC `move_opportunity` de linha única (`update … where stage = <a que a tela viu>` mais o evento, na mesma transação, atualizando `stage_changed_at` e `last_activity_at`), devolvendo `ok`, `sem-mudanca` ou `nao-encontrada`, no padrão das ações de Conversas. Ganho e Perdido exigem os campos da etapa. O `authenticated` não tem `update` na coluna `stage`.
- **Os outros campos** (procedimento, valor, responsável, próxima ação, nota) por server action em `lib/crm`, que cifra a nota antes de gravar. A trava de papel e de plano fica na lib: server action é endpoint público.
- **Responsável que sai da equipe:** os cartões dele ficam sem responsável.
- **Ao vivo:** aviso por Broadcast privado da clínica, sem dado no aviso; a tela faz `router.refresh()` e o servidor redesenha (o padrão de Conversas).

### 4. Acesso e plano
- RLS por `clinic_id` nas duas tabelas, leitura só para **owner e staff**. O profissional não vê, como em Conversas.
- Ninguém insere nem apaga direto; a oportunidade nasce pelos *triggers*, e o evento, pelos *triggers* e pela RPC.
- **O dado é gravado em todo plano**; só a tela e as ações exigem Pro ou HealthTech. Quem sobe de plano encontra o funil com histórico; quem cai para Starter vê a tela travada, e o dado continua.
- **No Starter**, o item aparece no menu com o selo "Pro" e abre o convite para subir de plano.

### 5. A tela
- **Menu:** "CRM", no grupo **Operação**, logo abaixo de Conversas. Rota `/dashboard/crm`.
- **O que responde primeiro** (skill `ui-ux`): quantos estão em cada etapa, quanto isso vale, e o que está parado.
- **Resumo do período:** valor ganho, conversão de Novo até Ganho e tempo médio até fechar. Período de 7, 30 ou 90 dias, na URL (`?periodo=`), como na Visão geral.
- **A faixa do funil** (o elemento que marca a tela): uma barra única dividida pelas quatro etapas abertas, com contagem e valor de cada uma e a taxa de passagem entre elas. É também o cabeçalho das colunas. Ganho e Perdido aparecem como contagem ao lado, com link para a lista das encerradas.
- **Quadro:** uma coluna por etapa aberta. O resto da tela segue o kit (`components/patterns`, tokens `surface`, `ink` e `hairline`); o verde `brand` só em Ganho.
- **Cartão:** nome do paciente, procedimento, valor, iniciais do responsável, próxima ação ou "parado há N dias" (tom de alerta depois de 3 dias sem atividade), selo **IA** quando a última mudança foi automática, e selos de opt-out e urgência.
- **Mover:** arrastar entre colunas no desktop (`@dnd-kit`, com sensor de teclado) e "Mover para…" no cartão e no painel. Ganho e Perdido abrem o pedido dos campos antes de mover. Movimento recusado (`sem-mudanca`) volta o cartão e avisa.
- **Painel lateral** (tela cheia no celular), ao abrir o cartão: a etapa com o "Mover para…"; procedimento, valor, responsável, próxima ação e nota; a linha do tempo dos eventos ("IA qualificou", "Marina moveu para Agendado"); e "Abrir conversa", que leva a `/dashboard/conversations?c=<id>`.
- **Encerradas:** lista à parte, com filtro por Ganho, Perdido e motivo, fora do quadro.
- **Filtros:** responsável (todos, meus, sem responsável) e período, na URL. **Busca por POST**, como em Conversas: o nome do paciente nunca vai para a URL.
- **Celular (390 px):** a faixa vira o seletor de etapa (uma por vez), e a coluna vira lista. Sem rolagem horizontal.
- **Definições dos números** (regra pura em `lib/crm`, a mesma nas duas partes):
  - **taxa de passagem** de uma etapa para a seguinte: das oportunidades abertas no período que chegaram a esta etapa, a parcela que chegou à seguinte (pela trilha de eventos);
  - **conversão:** das oportunidades abertas no período, a parcela que terminou em Ganho;
  - **valor ganho:** soma do `value_cents` das que foram para Ganho no período;
  - **tempo até fechar:** média, em dias, de `opened_at` a `closed_at` das que foram para Ganho no período;
  - **parado há N dias:** dias desde a `last_activity_at`, que muda com mensagem do paciente e com mudança de etapa.
- **Datas** só por `lib/formatters`; nada de `new Date()` em componente.

### 6. Conta de demonstração
- **Parte 1:** ~15 oportunidades de exemplo, em todas as etapas, com valores, responsáveis da equipe de exemplo, notas fictícias e eventos, trazidas para hoje pelo relógio da demonstração. Fora da demonstração, a rota responde `notFound()` (regra das rotas de protótipo, `tests/architecture/rotas.test.ts`), e o item fica "em breve" no menu.
- **Parte 2:** a fila junta as oportunidades reais da demonstração (as do canal de demonstração pela Evolution) às de exemplo, como a tela de Conversas faz. A limpeza do canal (`scripts/canal-demo.ts limpar`) leva as reais junto com os pacientes, pela cascata.

## Edge cases
- **Duas mensagens do mesmo paciente ao mesmo tempo:** o índice único resolve; abre uma oportunidade só.
- **A equipe move enquanto a IA qualifica:** a linha é travada; vale o "só avança" para o sistema e a etapa esperada para a equipe.
- **Paciente escreve um dia depois de Perdido:** abre oportunidade nova, em Novo.
- **Exclusão LGPD** (`anonymize_patient`): a nota é apagada (`notes_redacted_at`), e a oportunidade fica com etapa, datas e valor, para o funil histórico não mudar.
- **Procedimento apagado do perfil:** o campo fica vazio, o valor fica.
- **Membro removido da equipe:** os cartões dele ficam sem responsável.
- **Plano cai para Starter:** tela travada, dado preservado.
- **Paciente urgente:** a oportunidade não muda de etapa por causa da urgência; o cartão mostra o selo.

## Segurança e LGPD (`lgpd-security`)
- **Nota:** cifrada com `MESSAGE_CONTENT_ENCRYPTION_KEY`, amarrada ao `clinic_id` (AAD); nunca em log, em URL ou em mensagem de erro. Decifrada só no servidor, para quem tem acesso à tela.
- **Busca por POST**, e filtro na URL só com etapa, período e id do responsável.
- **Log** só com metadado (`erroParaLog`).
- **Isolamento:** teste contra o banco real para toda leitura nova, entre clínicas e por papel.
- **Espelho para CRM externo (fase 6):** a nota não sai do Nextech.

## Histórias (PO)
1. Como recepção, vejo o funil por etapa, com contagem, valor e o que está parado.
2. Como recepção, movo o cartão arrastando ou pelo menu, e Ganho e Perdido pedem o que precisam.
3. Como recepção, registro o responsável, a próxima ação e uma nota, que fica cifrada.
4. Como dono, vejo a conversão e o valor ganho no período.
5. Como sistema, abro a oportunidade na primeira mensagem do paciente e a qualifico quando a IA vê intenção de agendar.
6. Como clínica Starter, vejo o convite para subir de plano; como profissional, não vejo o CRM.

## Planos afetados
Pro e HealthTech. Starter vê o convite. O dado é gravado em todos.

## Specs afetadas
- `conversation-engine-v1.md`: os *triggers* em `messages` e em `conversations.qualified_at`; a `anonymize_patient` apaga a nota da oportunidade.
- `dashboard-overview-v1.md`: o funil da Visão geral passa a poder ler as etapas do CRM (decisão fica para a sessão da Visão geral real).
- `demo-account-v1.md`: a tela nova na demonstração.
- `evolution-demo-v1.md`: a limpeza leva as oportunidades.
- Skills `integrations` (o espelho da fase 6 parte do CRM próprio) e `architecture` (módulo `lib/crm`).
- `docs/roadmap.md`: o CRM próprio entra antes da fase 6.

## Fora desta spec
- Sincronização com CRM externo (fase 6), em qualquer sentido.
- Etapas personalizáveis, funis múltiplos, automações configuráveis.
- "Agendado" e "Compareceu" automáticos (dependem do motor de agendamento, fase 5).
- Tarefas e lembretes da equipe, além da "próxima ação".
- Selo da etapa da oportunidade dentro da tela de Conversas.
- Relatórios exportáveis.

## Critério de aceite

### Parte 1: a tela com dado de exemplo
- [ ] Na conta de demonstração, "CRM" aparece em Operação, abaixo de Conversas, para owner e staff; o profissional vê a permissão negada.
- [ ] Fora da demonstração, `/dashboard/crm` responde 404 e o item fica "em breve".
- [ ] A faixa do funil mostra, por etapa aberta, a contagem, o valor e a taxa de passagem, calculados das oportunidades de exemplo (regra pura em `lib/crm`, com teste).
- [ ] O resumo mostra valor ganho, conversão e tempo médio até fechar do período escolhido (7, 30 ou 90 dias), com o cálculo testado.
- [ ] O cartão mostra procedimento, valor, responsável, próxima ação ou "parado há N dias" (alerta depois de 3 dias), e os selos IA, opt-out e urgência.
- [ ] Arrastar e "Mover para…" movem o cartão no protótipo; Ganho pede procedimento e valor, Perdido pede o motivo da lista; as transições permitidas são regra pura testada.
- [ ] O painel lateral mostra campos, linha do tempo e "Abrir conversa".
- [ ] A busca não lê `?q=`; o termo vai por POST.
- [ ] As fixtures passam pelas travas de `tests/demo/fixtures.test.ts` (sem identificador real, datas deslocadas para hoje).
- [ ] Capturas da tela nos dois temas, em 1440 e 390 px, sem rolagem horizontal; o arrastar funciona pelo teclado.

### Parte 2: backend e tela real
- [ ] Migration aditiva, com `--dry-run`: tabelas, enums, índice único parcial, *triggers*, RPC e RLS.
- [ ] Mensagem nova do paciente sem oportunidade aberta abre uma em Novo, com evento "sistema"; com oportunidade aberta, só atualiza a última atividade; reenvio não duplica; eco não abre.
- [ ] `qualified_at` gravado move de Novo para Qualificado; em qualquer outra etapa, não move.
- [ ] `move_opportunity` move e grava o evento; com etapa esperada diferente, `sem-mudanca`; Ganho sem valor ou Perdido sem motivo são recusados; o `authenticated` não grava `stage` direto.
- [ ] Ganho e Perdido encerram; mensagem nova depois do encerramento abre oportunidade nova.
- [ ] A nota é gravada cifrada e lida decifrada; nunca aparece em log (teste com `console` espionado).
- [ ] `anonymize_patient` apaga a nota e mantém etapa, datas e valor.
- [ ] **Isolamento**, contra o banco real: membro da clínica B não lê nem move oportunidade da clínica A; profissional não lê; o canal ao vivo é privado por clínica.
- [ ] Starter vê o convite, e a server action recusa; Pro e HealthTech veem o funil.
- [ ] Na demonstração, as oportunidades reais juntam-se às de exemplo; a limpeza do canal as apaga.

## Como medir
- **Valor:** conversão de Novo até Ganho e valor ganho por mês, por clínica.
- **Uso:** parcela das clínicas Pro e HealthTech que movem ao menos um cartão por semana; parcela das oportunidades com responsável.
- **Saúde:** parcela das oportunidades abertas paradas há mais de 7 dias.

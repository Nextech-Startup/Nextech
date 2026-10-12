# Conta de demonstração (demo-account-v1)

## Por que isso existe

O Nextech está em fase de protótipo, sem clientes. Para interessar clínicas, o Jhones precisa mostrar o MVP inteiro funcionando na tela. Hoje, na conta de uma clínica, só Visão geral, Agentes e Perfil da clínica abrem, e o resto aparece como "em breve". As telas completas existem, mas só como protótipo dentro do painel interno (`/admin/design-system/telas/*`), com dado de exemplo.

## Objetivo

Criar uma conta de clínica de demonstração em que todas as telas do painel abrem com dado de exemplo, como se o produto estivesse pronto. As demais clínicas continuam como estão: dado real, e "em breve" no que ainda não existe.

## Decisões do Jhones (2026-09-27)

1. **Conta de demonstração, e não dado de exemplo para todas as contas.** A marca é por clínica (`clinics.is_demo`), e por isso não há nada a desfazer quando entrar o primeiro cliente. Dá para demonstrar em produção.
2. **Selo discreto no topo:** "Demonstração · dados fictícios", no cabeçalho do painel, em toda tela. O aviso grande de protótipo em cada página não aparece na conta de demonstração.
3. **A clínica de demonstração é a "Clínica Demonstração Nextech", que já existe** (`d09aa757-fc21-446a-8018-7586d88859e8`, criada em 2026-09-16, dono `clinica@nextech.ia.br`). Não se cria outra.
   - O `admin@nextech.ia.br`, hoje só admin da plataforma e sem clínica, também vira `owner` dela. O código já prevê quem é as duas coisas: o painel interno mostra o atalho para o painel da clínica.
   - Os dois logins abrem a demonstração. Para apresentar a terceiros, o `clinica@nextech.ia.br` é o mais limpo: não é admin da plataforma, e por isso não mostra o atalho do painel interno.

## Escopo v1

### Dado

- `clinics.is_demo boolean not null default false`, por migration aditiva.
  - Só o `service_role` muda a coluna. O `authenticated` já só tem `update (legal_name, cnpj)` em `clinics`, e a coluna nova não entra nesse grant.
  - A RLS de `clinics` não muda: o membro lê a própria clínica, inclusive a marca.
- **A clínica de demonstração é preparada por um script idempotente** (`scripts/conta-demo.ts`, rodado com o `service_role` do `.env`, com o id da clínica como argumento). Rodar duas vezes não duplica nada. O script:
  - marca `is_demo = true` e passa o plano para `healthtech`, para que nenhuma tela esconda recurso por plano (hoje ela está no `starter`);
  - vincula o `admin@nextech.ia.br` como `owner`, achando o usuário pelo e-mail. O vínculo do `clinica@nextech.ia.br` não muda;
  - preenche o Perfil da clínica com dado fictício (equipe, procedimentos, convênios, horário), só no que estiver vazio. Hoje ela não tem profissional, procedimento nem agente. É a única tela real exibida na demonstração.

### Contexto do tenant

- `requireClinicContext()` passa a devolver `isDemo: boolean`, lido do vínculo (`clinic_members` com `clinics(is_demo)`) na mesma consulta.
- `isDemo` é pergunta de interface, como os papéis: decide o que a tela mostra, e nunca o acesso a dado.

### Menu

- Na conta de demonstração, todo item do menu é navegável, e nenhum aparece "em breve". Isso inclui "Minha conta", no menu do usuário. O filtro por papel continua valendo.
- Nas outras contas, nada muda: o item "em breve" continua sem link, e a regra continua em `DASHBOARD_NAV`.
- O selo "Demonstração · dados fictícios" fica no cabeçalho do shell do painel, visível em toda tela e nos dois temas, e cabe em 390px sem rolagem horizontal.

### Telas na conta de demonstração

Cada rota usa o componente de domínio que o protótipo já usa (`components/<domínio>/`), com as mesmas fixtures e sem o `AvisoDePrototipo`. Ação que ainda não existe continua desabilitada, com o mesmo texto do protótipo.

| Menu | Rota | O que aparece |
|---|---|---|
| Visão geral | `/dashboard` | O protótipo completo (alertas, o agora do dia, indicadores, funil) |
| Conversas | `/dashboard/conversations` | Fila e thread do protótipo |
| Agenda | `/dashboard/schedule` | Dia e semana do protótipo |
| Pacientes | `/dashboard/patients` e `/dashboard/patients/[id]` | Tabela e ficha do protótipo |
| Agentes | `/dashboard/agents` e `/dashboard/agents/[id]` | Lista e detalhe com operação do protótipo |
| Sequências | `/dashboard/sequences` | Protótipo |
| Templates | `/dashboard/templates` | Protótipo |
| Perfil da clínica | `/dashboard/settings` | **A tela real**, com o perfil fictício que o script gravou |
| Equipe e acessos | `/dashboard/settings/team` | Protótipo |
| Integrações | `/dashboard/integrations` | Protótipo |
| Plano e cobrança | `/dashboard/billing` | Protótipo |
| Minha conta | `/dashboard/account` | Protótipo |

### Nas outras contas

- Visão geral, Agentes e Perfil da clínica continuam exatamente como hoje.
- As rotas novas (Conversas, Agenda, Pacientes, Sequências, Templates, Equipe, Integrações, Plano, Minha conta) respondem `notFound()` para quem não é demonstração. Quem digita a URL não vê a fixture.

### Datas da demonstração

As fixtures têm data fixa (`AGORA` = 28/09/2026, 14:32). Na demonstração, a "agenda de hoje" ficaria velha com o passar dos dias. Na conta de demonstração, toda data das fixtures é deslocada pelo número de dias entre `AGORA` e hoje, no fuso de São Paulo, e mantém a hora. A conta é feita por uma função pura, com teste, calculada no servidor a cada requisição. Assim "há 5 min", a janela de 24h e a linha da agenda continuam coerentes. O admin continua com o `AGORA` fixo, para que as capturas de tela da revisão visual sigam comparáveis.

### Fixtures

- Saem de `app/(admin)/admin/design-system/_fixtures/` para `app/_fixtures/`, uma pasta privada que não vira rota e fica fora dos route groups, compartilhada pelo admin e pelo painel.
- A trava de `tests/architecture/prototipos.test.ts` muda de "só o protótipo importa `_fixtures`" para:
  - importam `_fixtures` só as telas de protótipo do admin e as páginas de `app/(dashboard)`;
  - toda página de `app/(dashboard)` que importa `_fixtures` também lê `isDemo`;
  - componente e lib continuam sem importar nada de `app/`.

## Edge cases

- **Conta de demonstração com dado real:** a clínica de demonstração não tem agente conectado ao WhatsApp nem recebe mensagem. As telas de protótipo não mostram o dado real da clínica, nem se ele existir. Se um dia um número real for conectado a ela, o dado do paciente fica atrás da fixture: o script e o painel interno não conectam número na clínica de demonstração.
- **Usuário em duas clínicas:** hoje `requireClinicContext()` pega o primeiro vínculo. O `admin@nextech.ia.br` e o `clinica@nextech.ia.br` ficam com um só, a clínica de demonstração. Isso não muda nada para quem tem um vínculo.
- **Link do painel interno visível na demonstração:** entrando pelo `admin@nextech.ia.br`, o atalho do painel interno aparece no painel da clínica. Para apresentar a terceiros, use o `clinica@nextech.ia.br`.
- **Métricas internas:** a clínica de demonstração aparece no painel interno com o selo "Demonstração" na lista de clínicas, para ninguém a confundir com cliente.

## LGPD

- Nenhum dado de paciente real: as fixtures são inventadas (nomes, telefones e conversas fictícios).
- A clínica de demonstração não processa mensagem nem chama o modelo.
- Nada muda na RLS nem no isolamento: `is_demo` só decide o que a tela desenha.

## Planos afetados

Nenhum. É uma conta interna do Nextech, fora da cobrança. A clínica de demonstração usa `plan = 'healthtech'` para que nenhuma tela esconda recurso por plano.

## Como é medido

Não há métrica de produto. O sucesso é o Jhones conseguir abrir todas as telas numa demonstração, em produção ou em localhost, sem "em breve" e sem erro.

## Critério de aceite

- [x] A migration cria `clinics.is_demo` com `default false`. O `authenticated` não consegue alterar a coluna, e há teste de negação contra o banco real, com membro dono da clínica.
- [x] O script marca a "Clínica Demonstração Nextech" como demonstração, com plano `healthtech`, vincula o `admin@nextech.ia.br` como `owner` e preenche o perfil vazio. Rodar de novo não duplica nada nem sobrescreve o que já existe.
- [x] Os dois logins (`admin@nextech.ia.br` e `clinica@nextech.ia.br`) abrem o painel da clínica na demonstração.
- [x] `requireClinicContext()` devolve `isDemo`, e há teste com uma clínica marcada e outra não.
- [x] Na conta de demonstração, todo item do menu é navegável (sidebar, busca de comandos e "Minha conta"), e nenhum diz "em breve".
- [x] Nas outras contas, o menu não muda, e as rotas novas respondem 404. Há teste de rota para uma clínica comum.
- [x] O selo "Demonstração · dados fictícios" aparece no cabeçalho só na conta de demonstração.
- [x] O deslocamento de datas é função pura com teste: mesma hora, dia deslocado, fuso de São Paulo, e datas só-dia deslocadas também.
- [x] A trava de fixtures em `tests/architecture/` tem a regra nova e falha se uma página do painel importar fixture sem ler `isDemo`.
- [x] Olhado no navegador, nos dois temas, em 1440px e 390px, sem rolagem horizontal no celular: todas as telas da tabela na conta de demonstração, e o menu de uma conta comum.

## Em aberto

- **Datas só-dia com significado fixo** (nascimento, por exemplo): o deslocamento muda a idade em poucos dias. Aceitável na demonstração, e fica registrado.
- **Dia da semana** (implementação, 2026-09-27):
  - Deslocar N dias muda o dia da semana. O expediente da agenda gira junto (`girarDiasDaSemana`), para o "hoje" nunca aparecer como dia fechado. Numa demonstração no sábado, a segunda das fixtures cai no sábado, e a clínica aparece fechada em dois dias úteis na visão da semana.
  - O dia da semana escrito nas falas do chat ("amanhã, terça") não acompanha o deslocamento.
  - Datas escritas por extenso ("qui 1 out") saíram das fixtures, com trava em `tests/demo/fixtures.test.ts`.
- **O "agora" da demonstração** é o `AGORA` das fixtures trazido para hoje (14:32), e não o relógio real. Com isso, "há 5 min" e a janela de 24h continuam coerentes, e a Visão geral diz "Agora, 14:32" a qualquer hora.
- **"Respondem 404" nas outras contas:** a tela é "Página não encontrada", com `noindex`, e a fixture não é lida. O status HTTP é 200, porque o `loading.tsx` de `/dashboard` faz o streaming da resposta (documentação do Next). É o mesmo comportamento de `/dashboard/agents/[id]` com id de outra clínica. Um 404 HTTP exigiria barrar a rota no middleware, com consulta ao banco.
- **Perfil da clínica em rascunho:** o script preenche equipe, procedimentos, convênios e política de agendamento, como esta spec pede. A identidade regulatória (CNPJ e responsável técnico) fica vazia, porque um número inventado pode coincidir com o de uma empresa ou profissional real. Com isso, o Perfil mostra "rascunho · 4 pendências". Decisão do Jhones em aberto.
- **Plano nos protótipos:** Plano e cobrança conta a história de uma clínica no Pro, perto do limite (2 de 3 agentes). Agentes mostra 4 agentes no HealthTech. A divergência vem das fixtures dos protótipos. Decisão do Jhones em aberto.

## Segurança (implementação, 2026-09-27)

Achados da revisão de segurança, tratados na mesma entrega:

- **A clínica de demonstração não conecta WhatsApp nem publica agente**, por trigger no banco (`agents_block_demo`, `NX004`), em qualquer caminho, inclusive `service_role`. Uma clínica com agente conectado ou ativo também não vira demonstração. Sem isso, o dono da demonstração, cuja senha é usada diante de terceiros, conectaria um número pelo PostgREST, e mensagem de paciente real ficaria atrás de um painel que só mostra dado de exemplo. **Mudou em 2026-10-11:** o `service_role` passou a conectar o canal de demonstração (`evolution:`), e só ele; ver "Mudança: a conversa real do canal de demonstração".
- **O script recusa clínica de cliente**: ativa, com paciente, com agente no WhatsApp ou com alguma conta fora da equipe (`@nextech.ia.br`), inclusive a que ganharia o vínculo. Cada preparo fica na trilha de auditoria (`clinic.prepare_demo`).
- **Nenhum identificador real nas fixtures**: e-mail só em domínio `.example`, celular na faixa `90000` e nenhum número de conselho.
- **A senha do `clinica@nextech.ia.br` é de dono**, com escrita total na clínica de demonstração. Nunca é entregue a quem assiste.

## Mudança: a conversa real do canal de demonstração (2026-10-11)

Decisão do Jhones para a apresentação a investidor (`docs/specs/evolution-demo-v1.md`): a demonstração passa a receber conversa real, **só pelo canal de demonstração** (Evolution API, no computador da apresentação), para o tour pelo sidebar e a conversa ao vivo usarem o mesmo login.

- **A trava do banco muda de forma, não some** (migration `20261012120000_demo_evolution_channel`):
  - o `authenticated` segue recusado (`NX004`) ao gravar qualquer identificador e ao publicar agente na demonstração. O dono dela continua sem conectar nada;
  - só o `service_role` (o script `scripts/canal-demo.ts conectar`) grava, na demonstração, identificador `evolution:<instância>` e publica esse agente. Identificador da Meta segue recusado lá, por qualquer papel;
  - `evolution:` fora da demonstração é recusado por qualquer papel (`NX005`).
- **Tela de Conversas:** a fila junta as conversas reais da clínica com as de exemplo, na ordem de sempre e com a contagem das duas. A real abre com as ações reais (assumir, devolver, resolver a urgência) e sem a ficha; a de exemplo, com o protótipo e a ficha. O tempo real assina o canal privado da clínica. Nesta tela, as de exemplo andam até o **minuto** real (`relogioDoMinuto`), e não só em dias: assim a conversa do investidor não fica abaixo de fixtures "do futuro".
- **Busca por POST também na demonstração:** a página não lê mais `?q=` (o termo pode ser nome ou telefone real). A action `buscar` procura nas conversas reais e nas de exemplo e devolve as duas. A busca em URL ficou só no protótipo do painel interno, que é só fixture.
- **Fora de Conversas, nada muda:** o investidor não aparece em Pacientes, e o agente do canal não aparece em Agentes.
- **Limpeza ao fim de cada apresentação** (`scripts/canal-demo.ts limpar`): desliga o agente, apaga os pacientes (a cascata leva o resto) e confere no banco. Com o canal conectado ou com paciente, o preparo da demonstração recusa, o que avisa que a limpeza faltou.

## Implementação

Numa sessão nova, a partir desta spec (regra do `CLAUDE.md`: uma spec por sessão). Carregar `frontend-design` e `ui-ux` antes do selo e da revisão visual, e `supabase-postgres-best-practices` antes da migration.

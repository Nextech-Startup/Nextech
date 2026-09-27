# Conta de demonstração (demo-account-v1)

## Por que isso existe

O Nextech está em fase de protótipo, sem clientes. Para interessar clínicas, o Jhones precisa mostrar o MVP inteiro funcionando na tela. Hoje, na conta de uma clínica, só Visão geral, Agentes e Perfil da clínica abrem, e o resto aparece como "em breve". As telas completas existem, mas só como protótipo dentro do painel interno (`/admin/design-system/telas/*`), com dado de exemplo.

## Objetivo

Criar uma conta de clínica de demonstração em que todas as telas do painel abrem com dado de exemplo, como se o produto estivesse pronto. As demais clínicas continuam como estão: dado real, e "em breve" no que ainda não existe.

## Decisões do Jhones (2026-09-27)

1. **Conta de demonstração, e não dado de exemplo para todas as contas.** A marca é por clínica (`clinics.is_demo`), e por isso não há nada a desfazer quando entrar o primeiro cliente. Dá para demonstrar em produção.
2. **Selo discreto no topo:** "Demonstração · dados fictícios", no cabeçalho do painel, em toda tela. O aviso grande de protótipo em cada página não aparece na conta de demonstração.
3. **A conta que abre a demonstração é o `admin@nextech.ia.br`.** Hoje ele é só admin da plataforma, sem clínica. Passa a ser dono (`owner`) de uma clínica fictícia marcada como demonstração. O código já prevê quem é as duas coisas: o painel interno mostra o atalho para o painel da clínica.

## Escopo v1

### Dado

- `clinics.is_demo boolean not null default false`, por migration aditiva.
  - Só o `service_role` muda a coluna. O `authenticated` já só tem `update (legal_name, cnpj)` em `clinics`, e a coluna nova não entra nesse grant.
  - A RLS de `clinics` não muda: o membro lê a própria clínica, inclusive a marca.
- **A clínica de demonstração é criada por um script idempotente** (`scripts/conta-demo.ts`, rodado com o `service_role` do `.env`). Rodar duas vezes não duplica nada. O script:
  - cria a clínica "Clínica Demonstração" (nome fictício, sem CNPJ real) com `is_demo = true`;
  - vincula o `admin@nextech.ia.br` como `owner`, achando o usuário pelo e-mail;
  - preenche o Perfil da clínica com dado fictício (equipe, procedimentos, convênios, horário), que é a única tela real exibida na demonstração.

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
- **Usuário em duas clínicas:** hoje `requireClinicContext()` pega o primeiro vínculo. O `admin@nextech.ia.br` fica com um só, a clínica de demonstração. Isso não muda nada para quem tem um vínculo.
- **Link do painel interno visível na demonstração:** o `admin@nextech.ia.br` é admin da plataforma. Se o painel da clínica mostrar atalho para o painel interno, esse atalho aparece na frente de quem assiste. Uma conta dedicada (`demo@nextech.ia.br`, sem admin da plataforma) resolve, e fica em "Em aberto".
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

- [ ] A migration cria `clinics.is_demo` com `default false`. O `authenticated` não consegue alterar a coluna, e há teste de negação contra o banco real, com membro dono da clínica.
- [ ] O script cria a clínica de demonstração e o vínculo de `owner` do `admin@nextech.ia.br`, e rodar de novo não duplica nada.
- [ ] `requireClinicContext()` devolve `isDemo`, e há teste com uma clínica marcada e outra não.
- [ ] Na conta de demonstração, todo item do menu é navegável (sidebar, busca de comandos e "Minha conta"), e nenhum diz "em breve".
- [ ] Nas outras contas, o menu não muda, e as rotas novas respondem 404. Há teste de rota para uma clínica comum.
- [ ] O selo "Demonstração · dados fictícios" aparece no cabeçalho só na conta de demonstração.
- [ ] O deslocamento de datas é função pura com teste: mesma hora, dia deslocado, fuso de São Paulo, e datas só-dia deslocadas também.
- [ ] A trava de fixtures em `tests/architecture/` tem a regra nova e falha se uma página do painel importar fixture sem ler `isDemo`.
- [ ] Olhado no navegador, nos dois temas, em 1440px e 390px, sem rolagem horizontal no celular: todas as telas da tabela na conta de demonstração, e o menu de uma conta comum.

## Em aberto

- **Conta dedicada à demonstração** (`demo@nextech.ia.br`, sem ser admin da plataforma), se o atalho do painel interno atrapalhar a apresentação.
- **Datas só-dia com significado fixo** (nascimento, por exemplo): o deslocamento muda a idade em poucos dias. Aceitável na demonstração, e fica registrado.

## Implementação

Numa sessão nova, a partir desta spec (regra do `CLAUDE.md`: uma spec por sessão). Carregar `frontend-design` e `ui-ux` antes do selo e da revisão visual, e `supabase-postgres-best-practices` antes da migration.

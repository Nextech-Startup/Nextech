# Spec: Auditoria do painel interno (v1)

## Objetivo
A equipe Nextech consulta, em `/admin/audit`, a trilha real do que fez no painel interno: quem fez o quê, quando e em qual clínica, sem abrir o SQL. O item "Auditoria" do menu do admin deixa de ser "em breve".

A tela já foi desenhada como protótipo na parte 4 do redesign (`/admin/design-system/telas/auditoria`, `components/admin/tela-de-auditoria.tsx`). Esta spec leva a tela para a rota real, com o dado de `admin_audit_log`.

## Quem acessa
- Só a equipe Nextech (`platform_admins`), pela guarda que o `(admin)` já tem (`requireAdminContext`).
- Não é feature de plano de clínica: Starter, Pro e HealthTech não mudam.

## Escopo v1
A trilha mostra as quatro ações que o painel já registra:

| Ação | Quando é gravada | Frase na tela |
|---|---|---|
| `clinic.list` | a cada abertura de `/admin` | "Abriu a lista de clínicas" |
| `clinic.create` | ao criar uma clínica | "Criou a clínica" |
| `clinic.update_status` | ao ativar ou voltar para rascunho | "Ativou a clínica" / "Voltou a clínica para rascunho" |
| `member.invite` | ao convidar o responsável | "Convidou o responsável", com "Conta nova, com senha provisória." ou "Pessoa que já tinha conta." |

Fora do escopo v1:
- **Acessos de suporte** (`conversation.list` e `conversation.view`) e o recorte "Acessos de suporte": entram na fase 3b, junto com a tela de conversas de suporte.
- **Filtro por tipo:** sem as ações de suporte, "Todos" e "Clínicas" mostrariam a mesma lista. O filtro volta com a fase 3b.
- **Filtro por pessoa ou clínica, busca e exportação.**
- **Retenção e expurgo** da trilha.

## Comportamento
1. `/admin/audit` carrega os **100 registros mais recentes** de `admin_audit_log`, do mais recente para o mais antigo, e os agrupa por dia ("Hoje", "Ontem", "Sábado, 26 de setembro"), no fuso de São Paulo.
2. Cada linha mostra hora, autor, ação (frase de `descreverRegistro`), detalhe quando houver e clínica.
3. **Repetições agrupadas:** aberturas seguidas de `clinic.list` pela mesma pessoa, no mesmo dia, viram uma linha: "Abriu a lista de clínicas, 6 vezes entre 09:02 e 11:40". "Seguidas" quer dizer sem outro registro no meio. Só `clinic.list` se agrupa: ação que muda algo aparece sempre sozinha.
4. **Registros anteriores:** quando há mais que 100, um link "Ver registros anteriores" leva à próxima página, a partir do último registro mostrado (`?antes=<created_at>`). Na última página, o link não aparece.
5. **Abrir a Auditoria não gera registro.** A trilha não tem dado de paciente, e a regra 4 de `lgpd-security` só exige registro na leitura de dado de paciente. Registrar cada leitura só somaria ruído.
6. O item "Auditoria" do `ADMIN_NAV` passa de `em-breve` para `pronto`.

## Dado e LGPD
- A trilha guarda só ids e metadado, nunca nome de paciente, mensagem ou e-mail (comentário da tabela e `lib/admin/mutations.ts`).
- A tela **nunca mostra o `metadata` cru**: tudo passa por `descreverRegistro`. Uma chave nova no metadado não aparece por acidente.
- **Autor:** o nome vem de `platform_admins.name`. O e-mail da pessoa não aparece.
- **Clínica:** o nome vem de `clinics.legal_name`, o mesmo da lista de clínicas.

## Edge cases
- **Trilha vazia:** "Nenhum registro ainda."
- **Autor sem nome** em `platform_admins`, ou que já saiu da equipe: "Sem nome cadastrado". O registro nunca some (`on delete restrict` no autor).
- **Clínica apagada** (`clinic_id` vira `null`): numa ação de clínica, a coluna diz "Clínica removida". Em `clinic.list`, que não tem clínica, a coluna fica vazia.
- **Ação que a tela não conhece** (gravada por uma versão futura, ou por engano): aparece como "Ação não reconhecida" com o código da ação, e não some da trilha.
- **Grupo na virada de página:** uma sequência de `clinic.list` cortada entre duas páginas aparece como dois grupos. Aceito: a contagem de cada página continua certa.
- **Dois registros no mesmo instante:** a paginação usa `created_at`, com precisão de microssegundo no Postgres. Empate exato na virada de página é improvável e, se acontecer, só atrasa um registro para a página seguinte.
- **Falha na consulta:** o `error.tsx` do `(admin)` já cobre, sem registrar o erro no console.

## Como medir
A equipe responde "quem criou, ativou ou convidou, e quando" pela tela, sem consulta manual ao banco. Na fase 3b, é pela mesma tela que se revisa cada acesso a conversa de paciente.

## Critério de aceite

> **Entregue em 2026-09-27** (branch `staging`). 28 testes novos (781 no total): regra do agrupamento, cursor e rótulos em `lib/admin/auditoria.test.ts`, consulta paginada com client de mentira em `lib/admin/trilha.test.ts`, tela em `components/admin/auditoria.test.tsx` e menu em `lib/navigation/navigation.test.ts`. No navegador, com o dado real: 48 aberturas seguidas da lista de clínicas viraram uma linha, abrir a Auditoria não gravou nada, e o papel `clinica` foi redirecionado para `/dashboard`.

- [x] `/admin/audit` lista os registros reais de `admin_audit_log`, do mais recente para o mais antigo, agrupados por dia, com hora, autor, ação, detalhe e clínica.
- [x] Aberturas seguidas de `clinic.list` pela mesma pessoa no mesmo dia viram uma linha com a contagem e o intervalo. Uma ação de outro tipo no meio quebra o grupo. Regra pura com teste.
- [x] A página mostra no máximo 100 registros; "Ver registros anteriores" continua a partir do último mostrado e some na última página. Testado com consulta de mentira.
- [x] Abrir `/admin/audit` não grava nada em `admin_audit_log`. Testado.
- [x] Autor sem nome mostra "Sem nome cadastrado"; clínica apagada mostra "Clínica removida"; ação desconhecida mostra "Ação não reconhecida". Testado.
- [x] Nenhum valor de `metadata` aparece fora do que `descreverRegistro` escreve. Testado com uma chave estranha no metadado.
- [x] O item "Auditoria" do `ADMIN_NAV` está `pronto`, e `tests/architecture/rotas.test.ts` continua passando.
- [x] Quem não é da equipe Nextech é redirecionado de `/admin/audit` para `/dashboard` (a guarda do layout do `(admin)`), conferido no navegador com o papel `clinica`.
- [x] Conferido no navegador, nos dois temas, em 1440px e 390px, sem rolagem horizontal.

# Spec: Templates de Mensagem WhatsApp (v1)

> Revisada em 2026-11-04, antes da implementação. O Jhones saiu no meio da
> revisão e pediu a opção recomendada em cada ponto: as decisões estão na
> seção "Decisões da revisão", com a alternativa descartada, para ele
> conferir no PR.

## Por que isso existe
A API oficial da Meta não permite texto livre fora da janela de atendimento de 24h. Qualquer mensagem que o Nextech inicia sem o paciente ter mandado algo nas últimas 24h precisa ser um **template pré-aprovado pela Meta** — isso é regra da plataforma, não escolha de produto.

## Objetivo
Permitir que a clínica escreva, submeta e acompanhe a aprovação dos templates usados pelos quatro disparos fora da janela de 24h: lembrete de consulta, recall de retorno de rotina, reativação de paciente dormente e follow-up pós-atendimento. Esta spec entrega também a **porta única de envio de template** (`lib/whatsapp/`), com a trava "só template aprovado". Quem usa a porta (sequências, lembrete) é desenhado em `docs/specs/message-sequences-v1.md` e no motor de agendamento (fase 5).

## Planos
A tela existe em todos os planos. O que muda é **o uso** que o template pode ter (`USOS_DE_TEMPLATE` em `lib/billing/plan-limits.ts`, espelhado no banco), seguindo o que a landing promete:

| Uso | Starter | Pro | HealthTech | Categoria |
|---|---|---|---|---|
| Follow-up pós-atendimento | ✅ ("Agendamento + Follow-up") | ✅ | ✅ | `UTILITY` pedida, custo calculado como `MARKETING` |
| Lembrete de consulta | — | ✅ ("lembretes automáticos") | ✅ | `UTILITY` |
| Recall de retorno de rotina | — | ✅ | ✅ | `MARKETING` |
| Reativação de paciente dormente | — | ✅ | ✅ | `MARKETING` |

Quem paga a mensagem à Meta é a clínica, pela forma de pagamento da própria WABA: a tela mostra o custo de cada categoria, mas a trava é de produto, não de margem do Nextech. Com o downgrade de plano, o template de uso não incluído fica guardado e a porta de envio o recusa (`uso_fora_do_plano`).

Categoria `MARKETING` não tem desconto por volume e, a partir de outubro/2026, passa a ser cobrada mesmo dentro da janela de 24h — ver `docs/specs/agent-config-v1.md`.

## Quem faz o quê
- **Owner:** cria, edita, envia para aprovação, confere o status na Meta e exclui.
- **Staff:** só lê (a tela continua no menu dele, como no protótipo).
- A trava de papel fica na lib (padrão de `lib/conversations/queries.ts`) e no banco: a escrita passa por server action que confirma a sessão no Auth (`getUser`) e grava pelo `service_role` com o `clinic_id` da sessão.

## Modelo de dados — `whatsapp_templates`
- `id`, `clinic_id`, `agent_id` — o template pertence a um agente; a Meta o guarda na WABA do agente
- `name` — nome na Meta: minúsculo, dígito e underscore, até 512 caracteres; **único por clínica** (dois agentes da mesma clínica podem dividir a WABA, e na Meta o nome é único por WABA e idioma)
- `language` — `pt_BR`, fixo na v1
- `usage` — `lembrete` | `recall` | `reativacao` | `follow_up`
- `category` — `UTILITY` | `MARKETING`: a pedida no rascunho; depois do envio, **a que a Meta disser** (ela recategoriza sozinha)
- `body` — corpo com variáveis posicionais `{{1}}`, `{{2}}`…
- `variables` — o que cada variável é, em ordem, a partir do catálogo fechado abaixo
- `status` — `draft` | `pending_review` | `approved` | `rejected` | `paused` | `disabled`
- `meta_template_id`, `waba_id` — gravados na submissão (null em rascunho). O `waba_id` fica no template porque o agente pode ser reconectado a outra WABA
- `rejection_reason` — o `reason` da Meta (`INVALID_FORMAT`, `PROMOTIONAL`…), e `rejection_detail` — o `rejection_info.recommendation`, quando vier
- `pending_category`, `pending_category_at` — recategorização anunciada pela Meta com 24h de antecedência
- `status_changed_at` — o `entry.time` do último evento aplicado (ordena eventos fora de ordem)
- `submitted_at`, `created_at`, `updated_at`, `created_by`

RLS de leitura por `clinic_id` com a sessão viva (`private.sessao_ativa()`); escrita só pelo `service_role`. Template não é dado de paciente: o corpo é texto da clínica e os exemplos são fixos e fictícios.

### Catálogo de variáveis (v1)
| Chave | Exemplo enviado à Meta | Usos que aceitam |
|---|---|---|
| `primeiro_nome_paciente` | Mariana | todos |
| `nome_profissional` | Dra. Ana Lima | todos |
| `data_consulta` | 12/11 | lembrete, follow_up |
| `hora_consulta` | 16:00 | lembrete |

O nome da clínica não é variável: o template é da clínica, que o escreve no corpo (e `clinics.legal_name` pode ser o nome civil de um MEI — achado N2 da parte 2 da 3b).

## Comportamento
1. **Rascunho.** O owner escolhe o agente e o uso, escreve nome e corpo, e associa cada `{{n}}` a uma chave do catálogo → `draft`. A validação do corpo (`lib/whatsapp/corpo-do-template.ts`) roda no navegador e de novo no servidor.
2. **Envio para aprovação.** Exige: agente com WhatsApp conectado pela Cloud API (não Evolution), corpo sem problema, toda variável associada, uso permitido pelo plano. Submete por `POST /{waba_id}/message_templates` com o token da clínica, os exemplos do catálogo e, em `MARKETING`, o rodapé fixo "Para não receber mais, responda PARAR." → `pending_review`, com `meta_template_id`, `waba_id`, `submitted_at`. Se a Meta já devolver `APPROVED`/`REJECTED` na resposta, o status já sai certo.
3. **Status pela Meta.** O webhook (`app/api/whatsapp/webhook`, mesma assinatura) passa a tratar dois campos, localizando o template por `waba_id` (`entry.id`) + `meta_template_id`:
   - `message_template_status_update` — `event` → status:
     - `APPROVED`, `REINSTATED`, `UNARCHIVED` → `approved`
     - `PENDING`, `IN_APPEAL` → `pending_review`
     - `REJECTED` → `rejected`, com `reason` e `rejection_info`
     - `PAUSED` → `paused`
     - `FLAGGED` → o status não muda (qualidade baixa, ainda envia)
     - `DISABLED`, `ARCHIVED`, `DELETED`, `PENDING_DELETION`, `LOCKED`, `LIMIT_EXCEEDED` → `disabled`
     - a `message_template_category` do evento atualiza `category`
   - `template_category_update` — aviso (`correct_category` + `category_update_timestamp`) grava `pending_category`; a mudança feita (`previous_category` → `new_category`) grava `category` e limpa o aviso.
   - Evento com `entry.time` anterior a `status_changed_at` é ignorado (a Meta não garante ordem; o reenvio é idempotente).
   - Template desconhecido (criado no WhatsApp Manager, fora do Nextech) é ignorado, com 200.
4. **Conferir na Meta.** Na tela, o template `pending_review` tem o botão "Conferir agora" (`GET /{meta_template_id}`), que aplica o mesmo mapeamento — cobre webhook perdido ou ainda não assinado.
5. **Rejeitado ou pausado.** O owner edita o corpo e reenvia pela edição da Meta (`POST /{meta_template_id}`), mantendo o id e o nome → `pending_review`.
6. **Aprovado não se edita na v1** (a Meta limita edição de aprovado e o devolveria à análise com uma sequência usando). Para mudar: "Duplicar" cria um rascunho com o mesmo conteúdo e nome novo.
7. **Excluir.** Rascunho: só no banco. Submetido: `DELETE /{waba_id}/message_templates?hsm_id=…&name=…` e depois o banco; a tela avisa que a Meta não deixa reusar o nome por 30 dias. Quando as sequências existirem, template usado por passo não se exclui (FK `restrict` na spec de sequências).
8. **Porta de envio.** `enviarTemplate()` em `lib/whatsapp/client.ts` é o único caminho para mandar template. Antes da rede, `prepararEnvioDeTemplate()` (pura) recusa com motivo tipado:
   - `nao_aprovado` (qualquer status ≠ `approved`), `outra_waba` (o agente foi reconectado a outra conta), `canal_sem_template` (agente na Evolution), `uso_fora_do_plano`, `variavel_sem_valor` (ex.: paciente sem nome), `paciente_saiu` (`opted_out` ou anonimizado);
   - **nunca cai para texto livre.** Registrar e mostrar a falha à clínica é de quem chama (sequências, lembrete).
   - O erro da Meta segue o padrão do client: só o `code`, nunca a mensagem (que cita o número). O `131049` (limite de marketing por usuário da Meta) é definitivo, não repete.

## Edge cases
- Aprovação leva de minutos a mais de um dia: estado "Em análise" com a data do envio e o botão "Conferir agora"; nada parece travado.
- A Meta recategoriza `UTILITY` → `MARKETING` (desde abr/2025 ela não rejeita mais por categoria: muda sozinha, com aviso de 24h). A tela mostra o aviso e a categoria nova com o custo; o template continua aprovado.
- Agente desconectado ou reconectado a outra WABA: o template continua no banco, a tela marca "de outra conta do WhatsApp" e a porta recusa (`outra_waba`). Reenviar cria na WABA nova.
- Clínica de demonstração: a tela segue com a fixture (spec `demo-account-v1`). A Evolution não tem template, e a clínica de demonstração não conecta a Cloud API (NX004).
- Regra da Meta que mudar (categoria, campo novo, limite) muda só em `lib/whatsapp/` — nunca na tela nem no motor de sequências.

## Credenciais e segurança
A submissão usa a credencial da própria clínica (`whatsapp_waba_id`, `whatsapp_access_token_encrypted` do agente, `agent-config-v1`), decifrada só dentro de `lib/whatsapp/client.ts` — segredo por tenant, nunca em texto puro. O token precisa da permissão `whatsapp_business_management`; o app da Meta precisa assinar os campos `message_template_status_update` e `template_category_update` (`docs/infra-setup.md`). Log só com tipo e código do erro. Ver skill `lgpd-security`.

## Critério de aceite
- [ ] Owner cria, envia, confere o status, reenvia rejeitado, duplica aprovado e exclui; staff só lê (lib e banco).
- [ ] Webhook dos dois campos atualiza status e categoria, ignora evento antigo, template desconhecido e WABA de outra clínica; reenvio idempotente.
- [ ] Uso fora do plano não é enviado para aprovação nem passa pela porta de envio.
- [ ] `prepararEnvioDeTemplate` recusa cada motivo tipado; `enviarTemplate` nunca é chamada sem passar por ela e nunca envia texto livre.
- [ ] Teste automatizado cobre: isolamento entre clínicas dos templates (RLS e escrita), trava de papel, mapeamento de todos os `event` da Meta, payload de submissão contra mock (com rodapé no `MARKETING`, sem no `UTILITY`).
- [ ] Tela real conferida no navegador, nos dois temas, em 1440 e 390 px; a demonstração continua com a fixture.

## Decisões da revisão (2026-11-04)
Cada uma com a recomendada (escolhida) e o que ficou de fora.

1. **Formato do webhook** (era "Em aberto"): confirmado na referência da Meta (atualizada em mai/2026) — `message_template_status_update` (14 valores de `event`, `reason`, `rejection_info`, `message_template_category`) e `template_category_update` (aviso de 24h e mudança feita). *Descartado:* só polling.
2. **Custo do `MARKETING` no Starter** (era "Em aberto", vale também para `message-sequences-v1`): uso por plano conforme a landing — Starter só follow-up; Pro e HealthTech, os quatro. *Descartados:* liberar tudo em todo plano (promete o que a landing reserva ao Pro); tirar templates do Starter (quebra o "Follow-up" do Starter).
3. **Status `paused` e `disabled`**: a Meta pausa e desativa template aprovado por qualidade. *Descartado:* manter quatro status, o que deixaria um template desativado parecendo aprovado.
4. **Categoria é a da Meta**: ela recategoriza sozinha desde abr/2025 (o `allow_category_change` saiu). A fixture com "rejeitado por categoria" fica desatualizada e passa a `INVALID_FORMAT`. *Descartado:* guardar só a categoria pedida.
5. **Variáveis do catálogo fechado, com exemplos fixos**: a sequência precisa saber o que pôr em `{{1}}`, e o exemplo fixo evita a clínica digitar dado real de paciente para a Meta. *Descartados:* exemplo livre (protótipo) e parâmetro nomeado da Meta (`{{first_name}}`), que obrigaria reescrever a validação sem ganho na v1.
6. **Quantidade livre** (até 30 por clínica), não "conjunto fixo": cada passo da sequência é um template (o protótipo já tem 1º e 2º toque). *Descartado:* um template por uso.
7. **Rejeitado reenvia pela edição da Meta** (mesmo id e nome). *Descartado:* voltar a `draft` limpando o `meta_template_id` (texto anterior da spec): a Meta recusaria criar de novo o mesmo nome.
8. **Só corpo e rodapé fixo de opt-out no `MARKETING`**; cabeçalho e botões ficam para a v2 (botão de resposta rápida exige tratar `button` na recepção). O rodapé usa o opt-out que a recepção já entende ("PARAR").
9. **Owner escreve, staff lê**, como Agentes. *Descartado:* staff editando, já que o template sai com a credencial e o nome da clínica.
10. **Porta de envio nesta spec, uso nas seguintes**: `prepararEnvioDeTemplate` + `enviarTemplate`. O critério "falha registrada e visível à clínica" passa para `message-sequences-v1`, que é quem tem a falha a mostrar. *Descartado:* deixar a porta para a spec de sequências (a trava "só aprovado" ficaria sem dono).
11. **Template de fora do Nextech é ignorado** na v1. *Descartado:* importar da WABA (útil depois, com o Embedded Signup).
12. **Demonstração segue com a fixture**, e a Evolution recusa template (`canal_sem_template`).

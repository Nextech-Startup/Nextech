# Templates do WhatsApp (fase 4, primeira spec) — plano de implementação

> **Para quem executa:** use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans, tarefa por tarefa. Os passos usam caixas (`- [ ]`) para acompanhar.

**Objetivo:** a clínica escreve, envia para aprovação, acompanha e corrige os templates do WhatsApp na tela real de `/dashboard/templates`; o webhook da Meta atualiza status e categoria; e `lib/whatsapp/` ganha a porta única de envio de template, que só deixa sair template aprovado.

**Arquitetura:** tabela `whatsapp_templates` com leitura por RLS (sessão viva) e escrita só pelo `service_role`, por mutations que conferem owner pela sessão de escrita (`requireClinicContextForWrite`) e o plano (`USOS_DE_TEMPLATE`, espelhado em `private.template_usage_allowed`). As regras puras (catálogo de variáveis, nome, mapeamento dos eventos da Meta, preparo do envio, payload de submissão) ficam em `lib/whatsapp/templates/`, e a rede só em `lib/whatsapp/client.ts`. O webhook interpreta `message_template_status_update` e `template_category_update` e aplica pela RPC `apply_template_event`, que ignora evento mais antigo que o último aplicado. A tela reaproveita `components/templates/*` do protótipo; a demonstração continua com a fixture.

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase (Postgres, RLS), Vitest (`node`, `renderToStaticMarkup`), zod, Graph API da Meta (`WHATSAPP_API_VERSION`).

**Spec:** `docs/specs/whatsapp-templates-v1.md` (inteira, inclusive "Decisões da revisão"). Ler também `docs/specs/message-sequences-v1.md` (seção "Herdado de whatsapp-templates-v1") e, antes de escrever código Next, o guia em `node_modules/next/dist/docs/` sobre server actions e `after()`.

## Decisões tomadas sem o Jhones (2026-11-04)
O Jhones saiu durante a revisão e pediu a opção recomendada. As 12 decisões estão na spec, seção "Decisões da revisão", com a alternativa descartada. Resumo do que muda em relação ao texto antigo e ao protótipo:
- status ganha `paused` e `disabled`; categoria passa a ser a da Meta, com aviso de recategorização;
- variáveis de catálogo fechado com exemplos fixos (o protótipo tinha exemplo livre);
- Starter só follow-up; Pro e HealthTech os quatro usos;
- rejeitado reenvia pela edição da Meta (mesmo id); aprovado não se edita, duplica;
- rodapé fixo de opt-out no `MARKETING`; sem cabeçalho e botões;
- owner escreve, staff lê; template de fora do Nextech é ignorado; demonstração com a fixture.

## Restrições globais
- Responder e comentar em pt-BR.
- Status: `draft`, `pending_review`, `approved`, `rejected`, `paused`, `disabled`. Usos: `lembrete`, `recall`, `reativacao`, `follow_up`. Categorias: `UTILITY`, `MARKETING`. Idioma: `pt_BR`.
- Nome: `^[a-z0-9_]{1,512}$`, único por clínica. Até **30 templates por clínica** (`LIMITE_DE_TEMPLATES`).
- Catálogo de variáveis: `primeiro_nome_paciente` (Mariana), `nome_profissional` (Dra. Ana Lima), `data_consulta` (12/11; lembrete e follow_up), `hora_consulta` (16:00; só lembrete).
- Rodapé do `MARKETING`, literal: `Para não receber mais, responda PARAR.`
- Plano: Starter → `follow_up`; Pro e HealthTech → os quatro.
- **Nunca texto livre** como alternativa a template. `enviarTemplate` só é chamada depois de `prepararEnvioDeTemplate` devolver `ok`.
- Token: decifrado só dentro de `lib/whatsapp/client.ts`. Erro da Meta: só o `code`. Log só com `erroParaLog(erro)`; o erro do PostgREST não é `Error` (memória `postgrest-erro-nao-e-error`).
- `clinic_id` sempre da sessão (`requireClinicContext` / `requireClinicContextForWrite`), nunca do navegador. Trava de papel na lib (server action é POST público) e no banco.
- Datas na tela só por `lib/formatters`; o "agora" chega como prop.
- **Banco compartilhado com produção:** migration aditiva; `npx supabase db push --dry-run` primeiro, e o push **pede aprovação do Jhones** (memória `nextech-ambiente-supabase`). Migration e o código/teste que a usam no mesmo commit. Nunca `create or replace` de função apagada de propósito.
- Commits na `staging`, nunca na `main`.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/20261104130000_whatsapp_templates.sql` | Enums, tabela, índices, RLS, `private.template_usage_allowed`, RPC `apply_template_event` |
| `tests/rls/whatsapp-templates.test.ts` | Isolamento, escrita negada ao `authenticated`, limite, unicidade, RPC de evento (ordem, desconhecido, outra WABA) |
| `lib/billing/plan-limits.ts` | + `USOS_DE_TEMPLATE` |
| `lib/whatsapp/templates/tipos.ts` | Tipos do domínio (`TemplateNoBanco`, `StatusDoTemplate`, `UsoDoTemplate`, `VariavelDoCatalogo`…) |
| `lib/whatsapp/templates/catalogo.ts` | Catálogo de variáveis, exemplos, usos que aceitam, `problemasNoTemplate` |
| `lib/whatsapp/templates/eventos.ts` | `statusDoEvento`, `interpretarEventoDeTemplate` (payload → `EventoDeTemplate`) |
| `lib/whatsapp/templates/envio.ts` | `prepararEnvioDeTemplate`, `MotivoDeRecusa` |
| `lib/whatsapp/templates/submissao.ts` | `montarSubmissao` (payload da Meta) |
| `lib/whatsapp/client.ts` | + `submeterTemplate`, `editarTemplate`, `consultarTemplate`, `excluirTemplate`, `enviarTemplate` |
| `lib/whatsapp/webhook.ts` | + os dois campos de template em `interpretarWebhook` |
| `lib/whatsapp/templates/recepcao.ts` | `receberEventoDeTemplate` (chama a RPC) |
| `app/api/whatsapp/webhook/route.ts` | despacha `evento.tipo === "template"` |
| `lib/whatsapp/templates/queries.ts` | `carregarTemplates()` (sessão + papel) → tipo da tela |
| `lib/whatsapp/templates/mutations.ts` | criar, salvar, enviar, conferir, duplicar, excluir |
| `app/(dashboard)/dashboard/templates/actions.ts` | server actions |
| `app/(dashboard)/dashboard/templates/page.tsx` | real fora da demonstração; fixture dentro |
| `components/templates/*` | tipos, regras, editor e tela adaptados |
| `app/_fixtures/templates.ts` | fixture no vocabulário novo |
| `lib/navigation/dashboard-nav.ts` | Templates `status: "pronto"` |
| `docs/infra-setup.md`, `docs/status.md`, `docs/roadmap.md` | campos do webhook, permissão do token, estado |

---

### Tarefa 1: banco — tabela, RLS, plano e RPC de evento

**Arquivos:**
- Criar: `supabase/migrations/20261104130000_whatsapp_templates.sql`
- Modificar: `lib/billing/plan-limits.ts`
- Teste: `tests/rls/whatsapp-templates.test.ts`

**Interfaces:**
- Produz: tabela `public.whatsapp_templates`; `public.apply_template_event(p_waba_id text, p_meta_template_id text, p_occurred_at timestamptz, p_status public.whatsapp_template_status, p_category public.whatsapp_template_category, p_rejection_reason text, p_rejection_detail text, p_pending_category public.whatsapp_template_category, p_pending_category_at timestamptz, p_clear_pending boolean) returns text` (`'aplicado' | 'antigo' | 'desconhecido'`), só `service_role`; `USOS_DE_TEMPLATE: Record<ClinicPlan, readonly UsoDoTemplate[]>`.

- [ ] **Passo 1: escrever o teste de banco que falha.** Usar `tests/fixtures/clinica-de-conversas.ts` (`montarClinica`, `comoUsuario`, `admin`, `limparClinica`). Cenário: clínicas A (pro, papéis owner e staff) e B (starter, owner); um agente em cada, com `whatsapp_waba_id` distinto, gravado pelo `admin`.

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { admin, comoUsuario, limparClinica, montarClinica, type ClinicaDeTeste } from "../fixtures/clinica-de-conversas"

let a: ClinicaDeTeste, b: ClinicaDeTeste
let agenteA: string, agenteB: string

async function novoTemplate(c: ClinicaDeTeste, agentId: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await admin
    .from("whatsapp_templates")
    .insert({
      clinic_id: c.clinicId,
      agent_id: agentId,
      name: `tpl_${Math.random().toString(36).slice(2, 10)}`,
      usage: "follow_up",
      category: "UTILITY",
      body: "Olá, {{1}}! Como você está depois da consulta?",
      variables: ["primeiro_nome_paciente"],
      ...extra,
    })
    .select("id")
    .single()
  if (error) throw error
  return data.id as string
}

describe("whatsapp_templates", () => {
  beforeAll(async () => {
    a = await montarClinica("tpl-a", ["owner", "staff"])
    b = await montarClinica("tpl-b", ["owner"])
    await admin.from("clinics").update({ plan: "pro" }).eq("id", a.clinicId)
    // agentes criados pelo admin, com WABA própria; ver tests/rls/agents.test.ts para as colunas obrigatórias
    agenteA = await criarAgente(a, "waba-a")
    agenteB = await criarAgente(b, "waba-b")
  })
  afterAll(async () => { await limparClinica(a); await limparClinica(b) })

  it("owner e staff leem os templates da própria clínica, nunca os da outra", async () => {
    const idA = await novoTemplate(a, agenteA)
    await novoTemplate(b, agenteB)
    const staff = await comoUsuario(a.usuarios.staff)
    const { data } = await staff.from("whatsapp_templates").select("id, clinic_id")
    expect(data?.map((t) => t.id)).toEqual([idA])
  })

  it("authenticated não insere, não altera e não apaga", async () => {
    const owner = await comoUsuario(a.usuarios.owner)
    const ins = await owner.from("whatsapp_templates").insert({ clinic_id: a.clinicId, agent_id: agenteA, name: "x", usage: "follow_up", category: "UTILITY", body: "Oi {{1}}.", variables: [] })
    expect(ins.error?.code).toBe("42501")
    const id = await novoTemplate(a, agenteA)
    // Sem grant de update/delete: o PostgREST devolve 42501 antes da RLS.
    const upd = await owner.from("whatsapp_templates").update({ status: "approved" }).eq("id", id)
    expect(upd.error?.code).toBe("42501")
    const del = await owner.from("whatsapp_templates").delete().eq("id", id)
    expect(del.error?.code).toBe("42501")
  })

  it("Starter não grava uso de recall (trava de plano no banco)", async () => {
    await expect(novoTemplate(b, agenteB, { usage: "recall", category: "MARKETING" })).rejects.toMatchObject({ code: "P0001" })
  })

  it("nome é único por clínica", async () => {
    await novoTemplate(a, agenteA, { name: "duplicado_a" })
    await expect(novoTemplate(a, agenteA, { name: "duplicado_a" })).rejects.toMatchObject({ code: "23505" })
  })

  it("variáveis só do catálogo e número igual ao de {{n}} é conferido na lib; o banco recusa chave fora do catálogo", async () => {
    await expect(novoTemplate(a, agenteA, { variables: ["cpf"] })).rejects.toMatchObject({ code: "23514" })
  })

  it("apply_template_event aplica, ignora evento antigo e template desconhecido", async () => {
    const id = await novoTemplate(a, agenteA, { status: "pending_review", meta_template_id: "111", waba_id: "waba-a" })
    const t1 = new Date(Date.now() - 60_000).toISOString()
    const t0 = new Date(Date.now() - 120_000).toISOString()
    const aplicar = (when: string, status: string) =>
      admin.rpc("apply_template_event", {
        p_waba_id: "waba-a", p_meta_template_id: "111", p_occurred_at: when, p_status: status,
        p_category: "MARKETING", p_rejection_reason: null, p_rejection_detail: null,
        p_pending_category: null, p_pending_category_at: null, p_clear_pending: false,
      })
    expect((await aplicar(t1, "approved")).data).toBe("aplicado")
    expect((await aplicar(t0, "rejected")).data).toBe("antigo")
    const { data } = await admin.from("whatsapp_templates").select("status, category").eq("id", id).single()
    expect(data).toEqual({ status: "approved", category: "MARKETING" })
    const outra = await admin.rpc("apply_template_event", {
      p_waba_id: "waba-b", p_meta_template_id: "111", p_occurred_at: t1, p_status: "rejected",
      p_category: null, p_rejection_reason: null, p_rejection_detail: null,
      p_pending_category: null, p_pending_category_at: null, p_clear_pending: false,
    })
    expect(outra.data).toBe("desconhecido")
  })

  it("authenticated não executa apply_template_event", async () => {
    const owner = await comoUsuario(a.usuarios.owner)
    const r = await owner.rpc("apply_template_event", { p_waba_id: "waba-a", p_meta_template_id: "111", p_occurred_at: new Date().toISOString(), p_status: "approved", p_category: null, p_rejection_reason: null, p_rejection_detail: null, p_pending_category: null, p_pending_category_at: null, p_clear_pending: false })
    expect(r.error?.code).toBe("42501")
  })
})
```

`criarAgente(c, waba)` é um helper local que insere em `agents` pelo `admin` com `whatsapp_waba_id = waba` e as colunas obrigatórias copiadas de `tests/rls/agents.test.ts`. Conferir os nomes reais de `ClinicaDeTeste` (`clinicId`, `usuarios`) em `tests/fixtures/clinica-de-conversas.ts:66` antes de rodar e ajustar se diferirem.

- [ ] **Passo 2: rodar e ver falhar.** `npx vitest run tests/rls/whatsapp-templates.test.ts` → FAIL (`relation "whatsapp_templates" does not exist`).

- [ ] **Passo 3: escrever a migration.**

```sql
-- Templates do WhatsApp (whatsapp-templates-v1). Leitura pela RLS com a
-- sessão viva; escrita só pelo service_role, pelas mutations que conferem
-- owner e plano na lib. O plano também é conferido aqui (segunda barreira).

create type public.whatsapp_template_status as enum
  ('draft', 'pending_review', 'approved', 'rejected', 'paused', 'disabled');
create type public.whatsapp_template_usage as enum
  ('lembrete', 'recall', 'reativacao', 'follow_up');
create type public.whatsapp_template_category as enum ('UTILITY', 'MARKETING');

create table public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  name text not null check (name ~ '^[a-z0-9_]{1,512}$'),
  language text not null default 'pt_BR' check (language = 'pt_BR'),
  usage public.whatsapp_template_usage not null,
  category public.whatsapp_template_category not null,
  body text not null check (length(trim(body)) between 1 and 1024),
  variables text[] not null default '{}' check (
    variables <@ array['primeiro_nome_paciente', 'nome_profissional', 'data_consulta', 'hora_consulta']::text[]
  ),
  status public.whatsapp_template_status not null default 'draft',
  meta_template_id text,
  waba_id text,
  rejection_reason text,
  rejection_detail text,
  pending_category public.whatsapp_template_category,
  pending_category_at timestamptz,
  status_changed_at timestamptz,
  submitted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, name),
  -- rascunho nunca tem id da Meta; enviado sempre tem id e WABA
  check ((status = 'draft') = (meta_template_id is null)),
  check ((meta_template_id is null) = (waba_id is null))
);

create unique index whatsapp_templates_meta_idx
  on public.whatsapp_templates (waba_id, meta_template_id) where meta_template_id is not null;
create index whatsapp_templates_clinic_idx on public.whatsapp_templates (clinic_id, updated_at desc);
create index whatsapp_templates_agent_idx on public.whatsapp_templates (agent_id);

-- O agente precisa ser da mesma clínica.
create function private.whatsapp_template_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_plan public.clinic_plan; v_total int;
begin
  if not exists (select 1 from public.agents a where a.id = new.agent_id and a.clinic_id = new.clinic_id) then
    raise exception 'agente de outra clínica' using errcode = 'P0001';
  end if;
  if not private.template_usage_allowed(new.clinic_id, new.usage) then
    raise exception 'uso fora do plano' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' then
    select count(*) into v_total from public.whatsapp_templates t where t.clinic_id = new.clinic_id;
    if v_total >= 30 then
      raise exception 'limite de templates' using errcode = 'P0001';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
```

E, antes do trigger (a função de plano precisa existir quando o guard for criado — ordenar no arquivo):

```sql
-- Espelho de USOS_DE_TEMPLATE (lib/billing/plan-limits.ts).
create function private.template_usage_allowed(target_clinic_id uuid, target_usage public.whatsapp_template_usage)
returns boolean language sql stable security definer set search_path = '' as $$
  select case c.plan
    when 'starter' then target_usage = 'follow_up'
    else true
  end
  from public.clinics c where c.id = target_clinic_id
$$;
revoke execute on function private.template_usage_allowed(uuid, public.whatsapp_template_usage) from public, anon, authenticated;

create trigger whatsapp_templates_guard
  before insert or update of agent_id, clinic_id, usage on public.whatsapp_templates
  for each row execute function private.whatsapp_template_guard();

alter table public.whatsapp_templates enable row level security;
revoke all on public.whatsapp_templates from anon, authenticated;
grant select on public.whatsapp_templates to authenticated;

create policy whatsapp_templates_select on public.whatsapp_templates
  for select to authenticated
  using (
    clinic_id in (select private.user_clinic_ids())
    and (select private.sessao_ativa())
  );
```

Conferir o nome real da função de vínculo usada nas policies de `opportunities` (`supabase/migrations/20261103150000_crm_opportunities.sql:50-75`) e usar exatamente o mesmo predicado (owner e staff; `professional` também lê? — seguir o que a navegação faz: Templates é owner e staff, então restringir a esses dois papéis, como a policy do CRM).

```sql
create function public.apply_template_event(
  p_waba_id text, p_meta_template_id text, p_occurred_at timestamptz,
  p_status public.whatsapp_template_status, p_category public.whatsapp_template_category,
  p_rejection_reason text, p_rejection_detail text,
  p_pending_category public.whatsapp_template_category, p_pending_category_at timestamptz,
  p_clear_pending boolean
) returns text language plpgsql security definer set search_path = '' as $$
declare v public.whatsapp_templates;
begin
  select * into v from public.whatsapp_templates t
   where t.waba_id = p_waba_id and t.meta_template_id = p_meta_template_id
   for update;
  if not found then return 'desconhecido'; end if;
  if v.status_changed_at is not null and p_occurred_at < v.status_changed_at then return 'antigo'; end if;

  update public.whatsapp_templates t set
    status = coalesce(p_status, t.status),
    category = coalesce(p_category, t.category),
    rejection_reason = case when p_status = 'rejected' then p_rejection_reason
                            when p_status is not null then null else t.rejection_reason end,
    rejection_detail = case when p_status = 'rejected' then p_rejection_detail
                            when p_status is not null then null else t.rejection_detail end,
    pending_category = case when p_clear_pending then null else coalesce(p_pending_category, t.pending_category) end,
    pending_category_at = case when p_clear_pending then null else coalesce(p_pending_category_at, t.pending_category_at) end,
    status_changed_at = p_occurred_at,
    updated_at = now()
  where t.id = v.id;
  return 'aplicado';
end $$;
revoke execute on function public.apply_template_event(text, text, timestamptz, public.whatsapp_template_status, public.whatsapp_template_category, text, text, public.whatsapp_template_category, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.apply_template_event(text, text, timestamptz, public.whatsapp_template_status, public.whatsapp_template_category, text, text, public.whatsapp_template_category, timestamptz, boolean) to service_role;
```

Na `plan-limits.ts`:

```ts
import type { UsoDoTemplate } from "@/lib/whatsapp/templates/tipos"

/**
 * Usos de template por plano (whatsapp-templates-v1, decisão 2), pela
 * landing: o Starter tem "Agendamento + Follow-up"; os lembretes
 * automáticos e o resto, a partir do Pro. Espelho de
 * `private.template_usage_allowed`.
 */
export const USOS_DE_TEMPLATE: Record<ClinicPlan, readonly UsoDoTemplate[]> = {
  starter: ["follow_up"],
  pro: ["lembrete", "recall", "reativacao", "follow_up"],
  healthtech: ["lembrete", "recall", "reativacao", "follow_up"],
}
```

(`lib/whatsapp/templates/tipos.ts` nasce aqui com os tipos da Tarefa 2 — ver lá.)

- [ ] **Passo 4: dry-run e aprovação.** `npx supabase db push --dry-run` e mostrar a saída ao Jhones; só com o "ok" dele, `npx supabase db push --yes`. Sem aprovação, parar aqui e registrar no status.
- [ ] **Passo 5: rodar e ver passar.** `npx vitest run tests/rls/whatsapp-templates.test.ts` → PASS. Acrescentar um caso para staff: o select de B por staff de A volta vazio (já coberto) e `professional` não lê.
- [ ] **Passo 6: commit.** `git add supabase/migrations/20261104130000_whatsapp_templates.sql tests/rls/whatsapp-templates.test.ts lib/billing/plan-limits.ts lib/whatsapp/templates/tipos.ts && git commit -m "feat(templates): tabela, RLS, trava de plano e evento da Meta"`

---

### Tarefa 2: regras puras — tipos, catálogo, eventos, preparo do envio e submissão

**Arquivos:**
- Criar: `lib/whatsapp/templates/{tipos,catalogo,eventos,envio,submissao}.ts` e os `.test.ts` de cada um
- Modificar: `lib/whatsapp/corpo-do-template.ts` (só o comentário do cabeçalho: regra conferida em 2026-11-04)

**Interfaces:**
- Produz:

```ts
// tipos.ts
export type StatusDoTemplate = "draft" | "pending_review" | "approved" | "rejected" | "paused" | "disabled"
export type UsoDoTemplate = "lembrete" | "recall" | "reativacao" | "follow_up"
export type CategoriaDoTemplate = "UTILITY" | "MARKETING"
export type VariavelDoCatalogo = "primeiro_nome_paciente" | "nome_profissional" | "data_consulta" | "hora_consulta"
export type TemplateNoBanco = {
  id: string; clinicId: string; agentId: string; name: string; usage: UsoDoTemplate
  category: CategoriaDoTemplate; body: string; variables: VariavelDoCatalogo[]
  status: StatusDoTemplate; metaTemplateId: string | null; wabaId: string | null
  rejectionReason: string | null; rejectionDetail: string | null
  pendingCategory: CategoriaDoTemplate | null; pendingCategoryAt: string | null
  submittedAt: string | null; updatedAt: string
}
// catalogo.ts
export const LIMITE_DE_TEMPLATES = 30
export const RODAPE_DE_OPT_OUT = "Para não receber mais, responda PARAR."
export const CATALOGO: Record<VariavelDoCatalogo, { rotulo: string; exemplo: string; usos: readonly UsoDoTemplate[] }>
export type ProblemaNoTemplate = ProblemaNoCorpo | "nome_invalido" | "variavel_sem_associacao" | "variavel_fora_do_uso"
export function problemasNoTemplate(t: { name: string; usage: UsoDoTemplate; body: string; variables: readonly VariavelDoCatalogo[] }): ProblemaNoTemplate[]
// eventos.ts
export type EventoDeTemplate = {
  tipo: "template"; wabaId: string; metaTemplateId: string; ocorridoEm: string
  status: StatusDoTemplate | null; categoria: CategoriaDoTemplate | null
  motivo: string | null; detalhe: string | null
  categoriaPendente: CategoriaDoTemplate | null; categoriaPendenteEm: string | null; limparPendente: boolean
}
export function statusDoEvento(event: string): StatusDoTemplate | null
export function interpretarEventoDeTemplate(entry: unknown, field: string, value: unknown): EventoDeTemplate | null
// envio.ts
export type MotivoDeRecusa = "nao_aprovado" | "outra_waba" | "canal_sem_template" | "uso_fora_do_plano" | "variavel_sem_valor" | "paciente_saiu"
export type ValoresDasVariaveis = Partial<Record<VariavelDoCatalogo, string | null>>
export type EnvioPreparado = { ok: true; parametros: string[] } | { ok: false; motivo: MotivoDeRecusa }
export function prepararEnvioDeTemplate(p: {
  template: Pick<TemplateNoBanco, "status" | "wabaId" | "usage" | "variables">
  agente: { wabaId: string | null; phoneNumberId: string }
  plano: ClinicPlan
  paciente: { optedOut: boolean; anonimizado: boolean }
  valores: ValoresDasVariaveis
}): EnvioPreparado
// submissao.ts
export function montarSubmissao(t: Pick<TemplateNoBanco, "name" | "category" | "body" | "variables">): Record<string, unknown>
```

- [ ] **Passo 1: testes que falham.** Casos mínimos (escrever todos, com `describe` por arquivo):

```ts
// eventos.test.ts
it.each([
  ["APPROVED", "approved"], ["REINSTATED", "approved"], ["UNARCHIVED", "approved"],
  ["PENDING", "pending_review"], ["IN_APPEAL", "pending_review"],
  ["REJECTED", "rejected"], ["PAUSED", "paused"],
  ["DISABLED", "disabled"], ["ARCHIVED", "disabled"], ["DELETED", "disabled"],
  ["PENDING_DELETION", "disabled"], ["LOCKED", "disabled"], ["LIMIT_EXCEEDED", "disabled"],
  ["FLAGGED", null], ["QUALQUER_OUTRO", null],
])("%s → %s", (event, status) => expect(statusDoEvento(event)).toBe(status))

it("rejeição traz reason e recommendation", () => {
  const e = interpretarEventoDeTemplate({ id: "waba", time: 1751247548 }, "message_template_status_update", {
    event: "REJECTED", message_template_id: 1689556908129835, message_template_name: "x",
    message_template_language: "pt_BR", reason: "INVALID_FORMAT", message_template_category: "MARKETING",
    rejection_info: { reason: "texto", recommendation: "acrescente texto em volta das variáveis" },
  })
  expect(e).toMatchObject({ metaTemplateId: "1689556908129835", status: "rejected", motivo: "INVALID_FORMAT", detalhe: "acrescente texto em volta das variáveis", categoria: "MARKETING" })
})
it("FLAGGED não muda status mas atualiza a categoria", () => { /* status null, categoria lida */ })
it("aviso de recategorização grava a pendente", () => {
  const e = interpretarEventoDeTemplate({ id: "waba", time: 1746082800 }, "template_category_update", {
    message_template_id: 278077987957091, new_category: "UTILITY", correct_category: "MARKETING", category_update_timestamp: 1746169200,
  })
  expect(e).toMatchObject({ status: null, categoria: null, categoriaPendente: "MARKETING", limparPendente: false })
})
it("mudança feita grava a categoria nova e limpa a pendente", () => {
  const e = interpretarEventoDeTemplate({ id: "waba", time: 1746169200 }, "template_category_update", {
    message_template_id: 278077987957091, previous_category: "UTILITY", new_category: "MARKETING",
  })
  expect(e).toMatchObject({ categoria: "MARKETING", limparPendente: true })
})
it("sem WABA, sem id ou sem time: null", () => { /* três casos */ })
it("categoria AUTHENTICATION vira null (fora do produto)", () => { /* ... */ })

// envio.test.ts — base válida e uma mutação por motivo
const base = {
  template: { status: "approved", wabaId: "w", usage: "follow_up", variables: ["primeiro_nome_paciente"] },
  agente: { wabaId: "w", phoneNumberId: "123" },
  plano: "starter", paciente: { optedOut: false, anonimizado: false },
  valores: { primeiro_nome_paciente: "Mariana" },
} as const
it("ok devolve os parâmetros na ordem das variáveis", () => expect(prepararEnvioDeTemplate(base)).toEqual({ ok: true, parametros: ["Mariana"] }))
it.each(["draft", "pending_review", "rejected", "paused", "disabled"])("%s → nao_aprovado", (status) =>
  expect(prepararEnvioDeTemplate({ ...base, template: { ...base.template, status } })).toEqual({ ok: false, motivo: "nao_aprovado" }))
it("agente na Evolution → canal_sem_template", () => { /* phoneNumberId "evolution:x" */ })
it("WABA diferente → outra_waba", () => { /* agente.wabaId "z" */ })
it("recall no Starter → uso_fora_do_plano", () => { /* usage recall */ })
it("nome vazio ou só espaço → variavel_sem_valor", () => { /* "" e "  " e null */ })
it("opted_out ou anonimizado → paciente_saiu", () => { /* dois casos */ })
it("ordem das checagens: paciente_saiu vem antes de nao_aprovado", () => { /* para a sequência parar a matrícula, e não registrar falha de template */ })

// catalogo.test.ts
it("hora_consulta só no lembrete", () => { /* follow_up com hora → variavel_fora_do_uso */ })
it("número de variáveis do corpo diferente das associações → variavel_sem_associacao", () => {})
it("nome com maiúscula, espaço ou hífen → nome_invalido", () => {})
it("propaga os problemas do corpo (corpo-do-template)", () => {})

// submissao.test.ts
it("UTILITY: só BODY com exemplo do catálogo", () => {
  expect(montarSubmissao({ name: "followup", category: "UTILITY", body: "Oi, {{1}}! Tudo bem?", variables: ["primeiro_nome_paciente"] })).toEqual({
    name: "followup", language: "pt_BR", category: "UTILITY",
    components: [{ type: "BODY", text: "Oi, {{1}}! Tudo bem?", example: { body_text: [["Mariana"]] } }],
  })
})
it("MARKETING: acrescenta FOOTER fixo", () => { /* components[1] = { type: "FOOTER", text: RODAPE_DE_OPT_OUT } */ })
it("sem variável: BODY sem example", () => {})
```

- [ ] **Passo 2:** `npx vitest run lib/whatsapp/templates` → FAIL (módulos inexistentes).
- [ ] **Passo 3: implementar.** Pontos que não podem escapar:
  - `statusDoEvento` por tabela (`Record<string, StatusDoTemplate | null>`), não por `if`.
  - `interpretarEventoDeTemplate`: `metaTemplateId = String(value.message_template_id)` (vem número; guardar texto); `ocorridoEm = new Date(entry.time * 1000).toISOString()`; categoria aceita só `UTILITY`/`MARKETING`. Nunca ler `message_template_name` para localizar (o par WABA + id é a chave).
  - `prepararEnvioDeTemplate`, ordem: `paciente_saiu` → `canal_sem_template` (`canalDoAgente(phoneNumberId) === "evolution"`, de `lib/whatsapp/canal.ts`) → `nao_aprovado` → `outra_waba` → `uso_fora_do_plano` (`USOS_DE_TEMPLATE`) → `variavel_sem_valor` (valor `trim()` vazio). Parâmetros com `trim()`.
  - `problemasNoTemplate` usa `problemasNoCorpo` e `variaveisDoCorpo` de `lib/whatsapp/corpo-do-template.ts`: `variaveisDoCorpo(body).length !== variables.length` → `variavel_sem_associacao`.
- [ ] **Passo 4:** `npx vitest run lib/whatsapp/templates lib/whatsapp/corpo-do-template.test.ts` → PASS.
- [ ] **Passo 5: commit.** `git commit -m "feat(templates): regras puras de catálogo, eventos da Meta, preparo do envio e submissão"`

---

### Tarefa 3: client da Meta — submeter, editar, consultar, excluir e enviar

**Arquivos:**
- Modificar: `lib/whatsapp/client.ts`, `lib/whatsapp/client.test.ts`

**Interfaces:**
- Consome: `montarSubmissao`, `EventoDeTemplate`/`statusDoEvento` (Tarefa 2).
- Produz:

```ts
type Credencial = { wabaId: string; tokenCifrado: string }
export async function submeterTemplate(c: Credencial, payload: Record<string, unknown>, o?: { fetch?: typeof fetch }): Promise<{ metaTemplateId: string; status: StatusDoTemplate | null; categoria: CategoriaDoTemplate | null }>
export async function editarTemplate(c: Credencial & { metaTemplateId: string }, payload: Record<string, unknown>, o?): Promise<void>
export async function consultarTemplate(c: Credencial & { metaTemplateId: string }, o?): Promise<{ status: StatusDoTemplate | null; categoria: CategoriaDoTemplate | null; motivo: string | null }>
export async function excluirTemplate(c: Credencial & { metaTemplateId: string; name: string }, o?): Promise<void>
export async function enviarTemplate(p: { phoneNumberId: string; tokenCifrado: string; para: string; name: string; parametros: string[] }, o?): Promise<{ waMessageId: string }>
```

- [ ] **Passo 1: testes com `fetch` simulado** (padrão dos testes atuais de `enviarTexto`): URL e método de cada chamada (`POST {GRAPH}/{v}/{waba}/message_templates`; `POST {GRAPH}/{v}/{id}` com só `components` na edição — a Meta não aceita mudar nome/categoria; `GET {GRAPH}/{v}/{id}?fields=status,category,rejected_reason`; `DELETE {GRAPH}/{v}/{waba}/message_templates?hsm_id={id}&name={name}`); corpo do `enviarTemplate`:

```ts
expect(JSON.parse(init.body)).toEqual({
  messaging_product: "whatsapp", recipient_type: "individual", to: "5581999990000", type: "template",
  template: { name: "followup", language: { code: "pt_BR" },
    components: [{ type: "body", parameters: [{ type: "text", text: "Mariana" }] }] },
})
```

  sem `components` quando `parametros` é vazio; `submeterTemplate` lê `{ id, status, category }` da resposta (`status` "PENDING" → `pending_review`); erro `131049` → `MetaError` com `repetivel: false`; a mensagem do erro nunca contém o token, o número nem o corpo (asserção com `JSON.stringify(erro)`); `WHATSAPP_API_VERSION` ausente → `configuracao`.
- [ ] **Passo 2:** `npx vitest run lib/whatsapp/client.test.ts` → FAIL.
- [ ] **Passo 3: implementar** reaproveitando `chamar()` e `versao()`. A exclusão também passa por `chamar` (204/`{success:true}`). O `enviarTemplate` tem comentário dizendo que só é chamado depois de `prepararEnvioDeTemplate` — e o teste de arquitetura do passo 4 garante isso.
- [ ] **Passo 4: teste de arquitetura.** Em `tests/architecture/` (ver os existentes), um teste que varre `app/` e `lib/` e só permite `enviarTemplate(` em `lib/whatsapp/client.ts` e no futuro `lib/sequences/` — hoje, só no próprio client e nos testes. Assim a sequência não nasce chamando o client sem o preparo.
- [ ] **Passo 5:** `npx vitest run lib/whatsapp tests/architecture` → PASS. Commit: `git commit -m "feat(whatsapp): client de templates e envio de template"`

---

### Tarefa 4: webhook de status e categoria

**Arquivos:**
- Modificar: `lib/whatsapp/webhook.ts` (+ `EventoDeTemplate` na união `EventoDoWebhook`), `app/api/whatsapp/webhook/route.ts`, `tests/fixtures/meta-webhook.ts` (+ `webhookDeTemplate`)
- Criar: `lib/whatsapp/templates/recepcao.ts`, `tests/whatsapp/templates-webhook.test.ts`
- Teste: `lib/whatsapp/webhook.test.ts`

**Interfaces:**
- Consome: `interpretarEventoDeTemplate` (T2), `apply_template_event` (T1).
- Produz: `receberEventoDeTemplate(e: EventoDeTemplate): Promise<"aplicado" | "antigo" | "desconhecido">`.

- [ ] **Passo 1: testes.** Em `webhook.test.ts`: um POST com os dois campos produz `EventoDeTemplate`; campo desconhecido continua ignorado; `messages` no mesmo POST continua saindo. Em `tests/whatsapp/templates-webhook.test.ts`, contra o banco (padrão de `tests/conversations/audio-ponta-a-ponta.test.ts`): chamar o `POST` da rota com corpo assinado (`assinar`) e conferir que o template foi a `approved`; reenvio do mesmo corpo → 200 e nada muda; WABA de outra clínica com o mesmo id → `desconhecido`, 200; evento antigo → mantém.
- [ ] **Passo 2:** rodar → FAIL.
- [ ] **Passo 3: implementar.** Em `interpretarWebhook`, novo ramo: `else if ((change.field === "message_template_status_update" || change.field === "template_category_update") && wabaId)`. Em `recepcao.ts`, chamar a RPC pelo client `service_role` já usado no webhook (`lib/supabase/admin` ou o que `lib/whatsapp/conta.ts` usa — copiar o mesmo import). Na rota, o ramo `evento.tipo === "template"` grava **antes do 200**, como a conta; erro segue `falhaDefinitiva`. Log só `erroParaLog`.
- [ ] **Passo 4:** `npx vitest run lib/whatsapp tests/whatsapp` → PASS.
- [ ] **Passo 5: commit.** `git commit -m "feat(templates): webhook de status e de categoria da Meta"`

---

### Tarefa 5: leitura e escrita com trava de papel e plano

**Arquivos:**
- Criar: `lib/whatsapp/templates/queries.ts`, `lib/whatsapp/templates/mutations.ts`, `lib/whatsapp/templates/mutations.test.ts`, `app/(dashboard)/dashboard/templates/actions.ts`
- Teste: acrescentar em `tests/rls/whatsapp-templates.test.ts` os casos que passam pela lib

**Interfaces:**
- Consome: T1–T3; `requireClinicContext`, `requireClinicContextForWrite` (`lib/auth/context.ts`); o client `service_role` usado em `lib/agent-config/mutations.ts` para a conexão do WhatsApp.
- Produz:

```ts
export class TemplateMutationError extends Error { readonly codigo: CodigoDeErroDoTemplate }
export type CodigoDeErroDoTemplate =
  | "so_owner" | "uso_fora_do_plano" | "limite" | "nome_em_uso" | "invalido" | "agente_sem_whatsapp"
  | "canal_sem_template" | "estado_nao_permite" | "meta_recusou" | "meta_fora"
export async function criarTemplate(input: EntradaDoTemplate): Promise<{ id: string }>
export async function salvarTemplate(id: string, input: EntradaDoTemplate): Promise<void>          // draft, rejected, paused
export async function enviarParaAprovacao(id: string): Promise<void>                                 // draft → pending_review; rejected/paused → edição da Meta
export async function conferirNaMeta(id: string): Promise<void>                                      // pending_review
export async function duplicarTemplate(id: string): Promise<{ id: string }>                          // nome + "_v2", "_v3"… até livre
export async function excluirTemplate(id: string): Promise<void>
export async function carregarTemplates(): Promise<{ templates: TemplateDoWhatsApp[]; agentes: { id: string; nome: string }[]; usosDoPlano: UsoDoTemplate[]; podeEscrever: boolean }>
type EntradaDoTemplate = { agentId: string; name: string; usage: UsoDoTemplate; category: CategoriaDoTemplate; body: string; variables: VariavelDoCatalogo[] }
```

- [ ] **Passo 1: testes da lib** com dependências injetadas (a sessão, o client do banco e o client da Meta como parâmetros opcionais, padrão de `lib/agent-config/preview.ts`): staff → `so_owner` em toda escrita, antes de qualquer chamada à Meta; Starter + recall → `uso_fora_do_plano`; `enviarParaAprovacao` de `approved` → `estado_nao_permite`; agente sem `whatsapp_waba_id` → `agente_sem_whatsapp`; agente `evolution:` → `canal_sem_template`; a Meta responde 400 → `meta_recusou`, o status continua `draft` e nada é gravado; a Meta responde e o banco falha → o erro sobe, e o reenvio seguinte não duplica (procurar por nome na WABA: `consultar` por `name` antes de criar de novo, ou tratar o erro de nome duplicado `2388024` da Meta lendo o id existente); rejeitado reenviado chama `editarTemplate` e mantém o id; excluir submetido chama `excluirTemplate` antes de apagar a linha; `salvarTemplate` em `pending_review`/`approved`/`disabled` → `estado_nao_permite`. Em `tests/rls/whatsapp-templates.test.ts`: owner de A não consegue `salvarTemplate` com id de B (o filtro leva o `clinic_id` da sessão → "não encontrado").
- [ ] **Passo 2:** rodar → FAIL.
- [ ] **Passo 3: implementar.** Validação com zod + `problemasNoTemplate`. `TemplateMutationError` com mensagem escrita à mão (só ela chega à tela, como `AgentMutationError`). As actions seguem `agents/actions.ts`: `mensagemDeErro` que nunca repassa o `PostgrestError`, `revalidatePath("/dashboard/templates")`, e `redirect` para `?t=<id>` depois de criar/duplicar.
- [ ] **Passo 4:** `npx vitest run lib/whatsapp/templates tests/rls/whatsapp-templates.test.ts` → PASS.
- [ ] **Passo 5: commit.** `git commit -m "feat(templates): mutations, leitura e server actions com trava de papel e plano"`

---

### Tarefa 6: tela real e fixture no vocabulário novo

**Arquivos:**
- Modificar: `components/templates/{tipos,regras,status,editor-de-template,tela-de-templates}.tsx/ts`, `components/templates/{regras.test.ts,templates.test.tsx}`, `app/_fixtures/templates.ts`, `app/(dashboard)/dashboard/templates/page.tsx`, `lib/navigation/dashboard-nav.ts`, `lib/demo/rotas.ts` (se listar Templates como só-demo), testes de navegação

**Interfaces:**
- Consome: `carregarTemplates` e as actions (T5); `CATALOGO`, `RODAPE_DE_OPT_OUT`, `problemasNoTemplate` (T2).
- Produz: `TemplateDoWhatsApp` passa a ter `variaveis: VariavelDoCatalogo[]` (no lugar de `exemplos`), `categoriaPendente: { categoria, em } | null`, `motivoRejeicao` + `detalheRejeicao`, `deOutraConta: boolean`; `TelaDeTemplates` recebe `acoes` (as server actions) ou `acaoDesabilitada` (demonstração).

- [ ] **Passo 1: testes de componente** (`renderToStaticMarkup`, padrão atual): editor mostra um `<select>` por variável com as chaves do catálogo permitidas pelo uso (follow_up não oferece `hora_consulta`); a prévia mostra o exemplo do catálogo e, em `MARKETING`, o rodapé; status `paused` e `disabled` têm rótulo e tom ("Pausado pela Meta", "Desativado"); `pending_review` mostra "Em análise desde …" e o botão "Conferir agora"; `approved` mostra "Duplicar" e nenhum campo editável; aviso de recategorização mostra a categoria nova e o custo; `deOutraConta` mostra "de outra conta do WhatsApp"; staff vê tudo sem nenhum botão de escrita; usos fora do plano aparecem desabilitados com "a partir do Pro"; a demonstração continua com `acaoDesabilitada`.
- [ ] **Passo 2:** rodar → FAIL.
- [ ] **Passo 3: implementar.** Seguir a skill `ui-ux` e os tokens (`surface`, `ink`, `hairline`; nunca `[var(--x)]`). A página: `isDemo` → fixture (como hoje); senão `carregarTemplates()`, com `podeAcessar(role, ROTA)` antes. A fixture troca `exemplos` por `variaveis`, e o rejeitado "por categoria" passa a `INVALID_FORMAT` com recomendação. Navegação: `status: "pronto"` em Templates.
- [ ] **Passo 4:** `npx vitest run components/templates lib/navigation lib/demo` → PASS; `npx tsc --noEmit` limpo.
- [ ] **Passo 5: conferência no navegador** (skill `run`): numa clínica temporária Pro, criada por script e apagada no fim, com a Meta simulada não é possível — conferir a tela em rascunho, em erro de validação e, com linhas gravadas pelo `admin`, nos seis status; nos dois temas, em 1440 e 390 px, sem rolagem horizontal. Conferir também a demonstração pelo `clinica@`.
- [ ] **Passo 6: commit.** `git commit -m "feat(templates): tela real de Templates e fixture no vocabulário novo"`

---

### Tarefa 7: documentação, revisões e fechamento

**Arquivos:**
- Modificar: `docs/infra-setup.md` (seção da Meta: assinar `message_template_status_update` e `template_category_update` no app; permissão `whatsapp_business_management` no token), `docs/status.md`, `docs/roadmap.md` (fase 4: templates ✅), `docs/claude-memory/nextech-ambiente-supabase.md` (contagem de migrations: 45)

- [ ] **Passo 1:** suíte inteira `npx vitest run` e anotar a contagem; `npx tsc --noEmit`.
- [ ] **Passo 2: revisões.** `security-reviewer` (token, RLS, trava de papel e plano, webhook sem dado no log, nada de texto livre) e `qa-reviewer` (cobertura dos critérios de aceite da spec). Corrigir os bloqueantes, registrar o resto em `docs/status.md`.
- [ ] **Passo 3:** atualizar `docs/status.md` (tabela "Onde estamos", seção da fase 4 com o que a entrega decidiu e o que não foi conferido — a Meta real não existe, tudo contra mock) e as pendências do Jhones (assinar os dois campos quando houver app da Meta).
- [ ] **Passo 4: commit.** `git commit -m "docs(templates): fase 4, primeira spec concluída"`

---

## Autorrevisão (feita ao escrever)
- **Cobertura da spec:** planos → T1/T5/T6; papéis → T1 (RLS), T5; modelo e catálogo → T1/T2; comportamento 1–7 → T5/T6; webhook (3) → T2/T4; conferir (4) → T3/T5; porta de envio (8) → T2/T3; edge cases (recategorização, outra WABA, demonstração) → T2/T4/T6; credenciais e infra → T3/T7; critérios de aceite → T1, T2, T3, T4, T5, T6 (navegador).
- **Fora deste plano, por decisão:** registrar e mostrar a falha de envio à clínica (`message-sequences-v1`), importar template de fora do Nextech, cabeçalho e botões.
- **Riscos:** (1) o push da migration depende do Jhones; (2) nada é conferido contra a Meta real (sem credenciais) — o payload segue a referência de mai/2026 e fica isolado em `lib/whatsapp/`; (3) a idempotência da submissão depende do código de nome duplicado da Meta, a conferir na documentação no passo 3 da Tarefa 5.

import { requireClinicContext } from "@/lib/auth/context"
import { cifrarSegredo } from "@/lib/security/tenant-secrets"
import { ehErroDoPostgrest } from "@/lib/supabase/errors"
import {
  agentSchema,
  whatsappCredentialsSchema,
  AGENT_COLUMNS,
  type Agent,
  type AgentInput,
  type WhatsappCredentialsInput,
} from "./schema"

/**
 * Escrita nos agentes é sempre do owner.
 *
 * Publicar um agente é colocar a clínica para atender pacientes por IA —
 * não é edição de rotina de recepção. As policies de RLS exigem o mesmo;
 * esta checagem dá erro legível antes de o banco recusar.
 */
async function contextoDeEdicao() {
  const ctx = await requireClinicContext()
  if (ctx.role !== "owner") {
    throw new Error("Apenas o responsável pela clínica configura os agentes.")
  }
  return ctx
}

export class AgentMutationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AgentMutationError"
  }
}

/** Códigos do Postgres que esta camada sabe traduzir. */
const UNIQUE_VIOLATION = "23505"
const CHECK_VIOLATION = "23514"

/**
 * Códigos que os triggers desta migration emitem.
 *
 * São a INTERFACE das travas do banco com a aplicação, e estão na classe
 * `P0`, que o Postgres reserva para condições definidas pela aplicação.
 *
 * Existem para que o roteamento não dependa da prosa da mensagem: casar
 * por texto faria estes casos caírem silenciosamente na mensagem genérica
 * no dia em que alguém reescrevesse o texto de um trigger numa migration
 * futura — e nenhum teste quebraria.
 */
const PUBLICAR_SEM_NUMERO = "NX001"
const PUBLICAR_SEM_TOKEN = "NX002"
const LIMITE_DE_PLANO_ATINGIDO = "NX003"

/**
 * Mensagens das travas do banco, escritas aqui em TypeScript.
 *
 * Duplicam o texto dos triggers de propósito, em vez de ecoar
 * `error.message`. Repassar a mensagem do Postgres funciona enquanto ela
 * vem de um trigger nosso — mas `23514` é o código de QUALQUER CHECK
 * violation da tabela, inclusive de constraints futuras cujo texto
 * incluiria o valor rejeitado.
 */
const SEM_NUMERO =
  "Conecte um número de WhatsApp antes de publicar este agente."
const SEM_TOKEN =
  "Credencial do WhatsApp ausente: reconecte o número antes de publicar."
const LIMITE_DO_PLANO =
  "O plano atual não permite mais agentes. Fale com a equipe Nextech sobre um upgrade."

/**
 * Mensagem de número já conectado — deliberadamente idêntica nos dois
 * casos possíveis.
 *
 * O `whatsapp_phone_number_id` é UNIQUE GLOBAL: a colisão tanto pode ser
 * com outro agente da própria clínica quanto com o de outro tenant.
 * Distinguir os dois na mensagem transformaria o formulário num oráculo —
 * bastaria testar números até ver a resposta mudar para descobrir quais
 * já estão em uso na plataforma, e por eliminação, em quem.
 *
 * O texto por isso não afirma de quem é o número. Instrui o caso próprio
 * (desconecte do outro agente) e o caso alheio (fale com o suporte) sem
 * dizer qual dos dois aconteceu.
 */
const NUMERO_JA_CONECTADO =
  "Este número de WhatsApp já está conectado. Se ele é da sua clínica, " +
  "desconecte-o do outro agente antes de usá-lo aqui. Se você não " +
  "reconhece essa conexão, fale com o suporte."

const NOME_JA_USADO =
  "Já existe um agente com esse nome nesta clínica. Escolha outro nome."

/**
 * Ponto único por onde todo erro do banco passa antes de virar tela.
 *
 * Nenhuma mutation deste módulo repassa `error.message` ou `error.details`
 * ao chamador. O `details` de um 23505 é literalmente
 * "Key (whatsapp_phone_number_id)=(…) already exists." — deixá-lo subir
 * anularia a mensagem neutra que existe logo acima.
 *
 * O que não for reconhecido vira `AgentMutationError` genérico, e não o
 * erro original: um erro desconhecido é justamente aquele cujo conteúdo
 * ninguém auditou.
 */
function traduzirErro(erro: unknown): never {
  if (!ehErroDoPostgrest(erro)) throw erro

  const texto = erro.message ?? ""

  if (erro.code === UNIQUE_VIOLATION) {
    // Match pelo nome da constraint, que a migration fixa — não pelo
    // valor rejeitado, que nunca é lido aqui.
    if (texto.includes("agents_whatsapp_phone_number_id_key")) {
      throw new AgentMutationError(NUMERO_JA_CONECTADO)
    }
    if (texto.includes("agents_nome_unico_por_clinica")) {
      throw new AgentMutationError(NOME_JA_USADO)
    }
    throw new AgentMutationError("Esse valor já está em uso.")
  }

  // Travas dos triggers, reconhecidas pelo código que eles emitem. O texto
  // exibido é sempre a constante local — `erro.message` não é lido aqui.
  if (erro.code === PUBLICAR_SEM_NUMERO) {
    throw new AgentMutationError(SEM_NUMERO)
  }
  if (erro.code === PUBLICAR_SEM_TOKEN) {
    throw new AgentMutationError(SEM_TOKEN)
  }
  if (erro.code === LIMITE_DE_PLANO_ATINGIDO) {
    throw new AgentMutationError(LIMITE_DO_PLANO)
  }

  // CHECK violation que não veio de trigger nosso: uma das constraints da
  // tabela. A mensagem do Postgres pode citar o valor rejeitado, então não
  // é repassada.
  if (erro.code === CHECK_VIOLATION) {
    throw new AgentMutationError(
      "Esta configuração não é válida. Confira os campos e tente de novo.",
    )
  }

  throw new AgentMutationError(
    "Não foi possível salvar. Confira os dados e tente de novo.",
  )
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Cria um agente. Nasce em `draft` (comportamento 1 da spec) — o default
 * da coluna, não algo que esta função escolha.
 *
 * O limite por plano não é checado aqui: quem recusa é o trigger
 * `agents_enforce_plan_limit`. Duplicar a contagem na aplicação abriria
 * uma janela de corrida entre o SELECT e o INSERT.
 */
export async function createAgent(input: AgentInput): Promise<Agent> {
  const { supabase, clinicId } = await contextoDeEdicao()
  const parsed = agentSchema.parse(input)

  const { data, error } = await supabase
    .from("agents")
    // O clinic_id vem do contexto, nunca do input — o schema é .strict()
    // justamente para que um clinic_id forjado no formulário não chegue.
    .insert({ clinic_id: clinicId, ...parsed })
    .select(AGENT_COLUMNS)
    .single()

  if (error) traduzirErro(error)
  return data as unknown as Agent
}

export async function updateAgent(
  agentId: string,
  input: AgentInput,
): Promise<Agent> {
  const { supabase, clinicId } = await contextoDeEdicao()
  const parsed = agentSchema.parse(input)

  const { data, error } = await supabase
    .from("agents")
    .update(parsed)
    .eq("id", agentId)
    // Redundante com a RLS, e deliberado: sem isto, um id de outra clínica
    // viraria update silencioso de zero linhas em vez de erro.
    .eq("clinic_id", clinicId)
    .select(AGENT_COLUMNS)
    .single()

  if (error) traduzirErro(error)
  return data as unknown as Agent
}

/**
 * Apaga o agente.
 *
 * Diferente do clinic-profile, que desativa em vez de apagar: lá o
 * registro (convênio, profissional) aparece no histórico de quem foi
 * atendido, e apagá-lo reescreveria o passado. Um agente em `draft` que
 * nunca foi publicado não tem histórico nenhum.
 *
 * Por isso a regra: agente que já atendeu não se apaga, se pausa. A
 * marca é `first_published_at`, que o trigger carimba na primeira
 * publicação e nunca limpa.
 */
export async function deleteAgent(agentId: string): Promise<void> {
  const { supabase, clinicId } = await contextoDeEdicao()

  const { data: agente, error: erroLeitura } = await supabase
    .from("agents")
    .select("id, status, first_published_at")
    .eq("id", agentId)
    .eq("clinic_id", clinicId)
    .maybeSingle()

  if (erroLeitura) traduzirErro(erroLeitura)
  if (!agente) throw new AgentMutationError("Agente não encontrado.")

  if (agente.first_published_at) {
    throw new AgentMutationError(
      "Este agente já atendeu pacientes e não pode ser excluído. " +
        "Pause-o para que pare de responder.",
    )
  }

  const { error } = await supabase
    .from("agents")
    .delete()
    .eq("id", agentId)
    .eq("clinic_id", clinicId)

  if (error) traduzirErro(error)
}

// ---------------------------------------------------------------------------
// Credenciais do WhatsApp
// ---------------------------------------------------------------------------

/**
 * Conecta o WhatsApp ao agente.
 *
 * O token é cifrado AQUI, antes de tocar o banco (regra 8 do CLAUDE.md,
 * regra 7 de lgpd-security). O Postgres recebe um blob opaco e nunca vê o
 * valor em claro nem a chave.
 *
 * Nada nesta função loga o token, nem parte dele, nem seu tamanho. E o
 * retorno é o agente pelas colunas de leitura normais — que não incluem a
 * coluna do token, porque ela está fora do grant de SELECT.
 */
export async function connectWhatsapp(
  agentId: string,
  input: WhatsappCredentialsInput,
): Promise<Agent> {
  const { supabase, clinicId } = await contextoDeEdicao()
  const parsed = whatsappCredentialsSchema.parse(input)

  const { data, error } = await supabase
    .from("agents")
    .update({
      whatsapp_phone_number_id: parsed.whatsapp_phone_number_id,
      whatsapp_waba_id: parsed.whatsapp_waba_id,
      whatsapp_access_token_encrypted: cifrarSegredo(
        parsed.whatsapp_access_token,
      ),
    })
    .eq("id", agentId)
    .eq("clinic_id", clinicId)
    .select(AGENT_COLUMNS)
    .single()

  if (error) traduzirErro(error)
  return data as unknown as Agent
}

/**
 * Desconecta o WhatsApp: limpa os três campos de uma vez.
 *
 * Limpar o token sem limpar o número deixaria a constraint
 * `agents_credenciais_coerentes` recusar, e com razão — um número sem
 * token é uma conexão que não funciona.
 *
 * Um agente ativo é despublicado junto, porque o trigger de publish
 * recusaria um `active` sem credencial. Pausar aqui é o que torna a
 * desconexão possível sem um passo extra para o usuário.
 */
export async function disconnectWhatsapp(agentId: string): Promise<Agent> {
  const { supabase, clinicId } = await contextoDeEdicao()

  const { data, error } = await supabase
    .from("agents")
    .update({
      whatsapp_phone_number_id: null,
      whatsapp_waba_id: null,
      whatsapp_access_token_encrypted: null,
      status: "paused",
    })
    .eq("id", agentId)
    .eq("clinic_id", clinicId)
    .select(AGENT_COLUMNS)
    .single()

  if (error) traduzirErro(error)
  return data as unknown as Agent
}

// ---------------------------------------------------------------------------
// Ciclo de vida
// ---------------------------------------------------------------------------

/**
 * Publica o agente (comportamento 5 da spec).
 *
 * A validação de "tem WhatsApp conectado?" NÃO está aqui — está no
 * trigger `agents_enforce_publish`. Esta função só traduz a recusa do
 * banco para uma mensagem de tela.
 *
 * É a mesma lição da clinic-profile: se a trava precisa valer sempre, ela
 * mora no banco. O (admin) escreve com service_role e não passa por
 * validação nenhuma da aplicação da clínica.
 */
export async function publishAgent(agentId: string): Promise<Agent> {
  const { supabase, clinicId } = await contextoDeEdicao()

  const { data, error } = await supabase
    .from("agents")
    .update({ status: "active" })
    .eq("id", agentId)
    .eq("clinic_id", clinicId)
    .select(AGENT_COLUMNS)
    .single()

  // O trigger `agents_enforce_publish` é quem recusa; `traduzirErro`
  // converte a recusa na mensagem local correspondente.
  if (error) traduzirErro(error)
  return data as unknown as Agent
}

/**
 * Pausa o agente (comportamento 6): para de responder sem perder nada da
 * configuração. Não volta para `draft` de propósito — draft significa
 * "nunca foi publicado", e apagar essa distinção esconderia se o agente
 * chegou a atender alguém.
 */
export async function pauseAgent(agentId: string): Promise<Agent> {
  const { supabase, clinicId } = await contextoDeEdicao()

  const { data, error } = await supabase
    .from("agents")
    .update({ status: "paused" })
    .eq("id", agentId)
    .eq("clinic_id", clinicId)
    .select(AGENT_COLUMNS)
    .single()

  if (error) traduzirErro(error)
  return data as unknown as Agent
}

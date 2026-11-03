"use server"

import { unstable_rethrow } from "next/navigation"
import { z } from "zod"
import type { ResultadoDaBuscaDoCrm } from "@/components/crm/busca-do-crm"
import { requireClinicContext } from "@/lib/auth/context"
import { acessoAoCrm } from "@/lib/crm/acesso"
import { idsQueCasam } from "@/lib/crm/busca"
import { lerDetalhes, mensagemDosDetalhes } from "@/lib/crm/detalhes"
import { lerPedidoDeMovimento, mensagemDoMovimento } from "@/lib/crm/movimento"
import { moverOportunidade, salvarDetalhes } from "@/lib/crm/mutations"
import { buscarNoCrm } from "@/lib/crm/queries"
import { erroParaLog } from "@/lib/security/erro-para-log"
import { OPORTUNIDADES } from "@/app/_fixtures/crm"

const TERMO = z.string().trim().min(1).max(80)

/**
 * A busca do CRM por nome ou telefone. O termo chega no corpo deste POST,
 * segue no corpo do POST da RPC e não vai a URL, log nem mensagem de erro
 * (lgpd-security, regra 1). Na demonstração, procura também nas de exemplo.
 */
export async function buscar(termo: unknown): Promise<ResultadoDaBuscaDoCrm> {
  const t = TERMO.safeParse(termo)
  if (!t.success) return { ids: [], erro: "Busque por um nome ou por parte do telefone." }

  try {
    const { role, plan, isDemo } = await requireClinicContext()
    if (acessoAoCrm(role, plan) !== "liberado") return { ids: [], erro: null }
    const reais = await buscarNoCrm(t.data)
    return { ids: isDemo ? [...reais, ...idsQueCasam(OPORTUNIDADES, t.data)] : reais, erro: null }
  } catch (erro) {
    // O redirect("/login") de requireClinicContext é um erro interno do Next.
    unstable_rethrow(erro)
    console.error("Falha na busca do CRM", erroParaLog(erro))
    return { ids: [], erro: "Não foi possível buscar. Tente de novo." }
  }
}

/**
 * Mover pela tela. O pedido vem do navegador: `de` e `para` passam por
 * `ehEtapa` (lerPedidoDeMovimento) antes de qualquer coisa. Clínica, papel
 * e plano são conferidos pela sessão, na lib e no banco.
 */
export async function mover(pedido: unknown): Promise<{ erro: string | null }> {
  const p = lerPedidoDeMovimento(pedido)
  if (!p) return { erro: mensagemDoMovimento({ status: "nao-encontrada" }) }
  try {
    return { erro: mensagemDoMovimento(await moverOportunidade(p)) }
  } catch (erro) {
    unstable_rethrow(erro)
    console.error("Falha ao mover no CRM", erroParaLog(erro))
    return { erro: "Não foi possível mover. Tente de novo." }
  }
}

/** Procedimento, valor, responsável, próxima ação e nota. A nota é cifrada na lib. */
export async function salvar(form: FormData): Promise<{ erro: string | null }> {
  const lido = lerDetalhes({
    oportunidade: form.get("oportunidade"),
    procedimento: form.get("procedimento"),
    valor: form.get("valor"),
    responsavel: form.get("responsavel"),
    proxima_acao: form.get("proxima_acao"),
    nota: form.get("nota"),
  })
  if (lido.erro !== null) return { erro: lido.erro }
  try {
    return { erro: mensagemDosDetalhes(await salvarDetalhes(lido.detalhes)) }
  } catch (erro) {
    unstable_rethrow(erro)
    console.error("Falha ao salvar no CRM", erroParaLog(erro))
    return { erro: "Não foi possível salvar. Tente de novo." }
  }
}

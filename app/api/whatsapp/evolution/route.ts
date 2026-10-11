import { after } from "next/server"
import { origemDoFromMe } from "@/lib/conversations/eco"
import { tratarMensagem } from "@/lib/conversations/entrada"
import { dentroDoTeto, passarParaEquipePorTeto } from "@/lib/conversations/teto"
import { erroParaLog } from "@/lib/security/erro-para-log"
import { comparacaoSegura } from "@/lib/security/tenant-secrets"
import { lerConfigDaEvolution } from "@/lib/whatsapp/evolution-config"
import { interpretarEvolution } from "@/lib/whatsapp/evolution-webhook"
import { falhaDefinitiva } from "@/lib/whatsapp/webhook"

/**
 * Webhook do canal de demonstração pela Evolution API (evolution-demo-v1).
 * Só existe no computador da apresentação, com as variáveis `EVOLUTION_*`
 * no `.env` local; em produção e na staging, responde 404.
 *
 * Traduz o `messages.upsert` e segue o caminho da Meta (tratarMensagem):
 * grava antes do 200, e a resposta da IA vai para o `after()`. Com 500, a
 * Evolution reenvia (até 10 vezes, com espera crescente); 400, 401 e 404
 * ela não reenvia.
 *
 * Log só com metadado: nunca o payload, o conteúdo, o telefone nem o erro
 * inteiro (lgpd-security). O motivo de uma mensagem ignorada não leva o
 * número.
 */

// O mesmo pior caso da rota da Meta (agrupamento, modelo, envio), abaixo
// dos 5 min da varredura de respostas órfãs.
export const maxDuration = 120

const ROTULO = "[evolution-webhook]"

export async function POST(request: Request) {
  const cfg = lerConfigDaEvolution(process.env)
  if (!cfg) return new Response(null, { status: 404 })

  if (!comparacaoSegura(request.headers.get("x-nextech-secret") ?? "", cfg.segredo)) {
    return new Response(null, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return new Response(null, { status: 400 })
  }

  const leitura = interpretarEvolution(payload, cfg)
  if (leitura.tipo === "ignorada") {
    console.info(ROTULO, { etapa: "ignorada", motivo: leitura.motivo })
    return new Response(null, { status: 200 })
  }
  const m = leitura.mensagem

  try {
    if (m.autor === "human") {
      const origem = await origemDoFromMe(m)
      if (origem === "ja-gravada") return new Response(null, { status: 200 })
      if (origem === "resposta-pendente") {
        console.info(ROTULO, { etapa: "fromme-adiado" })
        return new Response(null, { status: 500 })
      }
    }

    await tratarMensagem(m, (etapa, tarefa) => after(() => emSegundoPlano(etapa, tarefa)), {
      podeResponder: async (r) => {
        if (await dentroDoTeto(r.clinicId, cfg.teto, new Date().toISOString())) return true
        await passarParaEquipePorTeto(r.clinicId, r.conversationId)
        console.warn(ROTULO, { etapa: "teto", conversa: r.conversationId })
        return false
      },
    })
    return new Response(null, { status: 200 })
  } catch (erro) {
    // Transitória: 500, e a Evolution reenvia. Definitiva: 200, porque se
    // repetiria em todo reenvio.
    const falha = erroParaLog(erro)
    const definitiva = falhaDefinitiva(falha)
    console.error(ROTULO, { etapa: "recepcao", definitiva, ...falha })
    return new Response(null, { status: definitiva ? 200 : 500 })
  }
}

/** Depois do 200 não há a quem devolver erro: loga o metadado e para. */
async function emSegundoPlano(etapa: "resposta" | "protocolo", tarefa: () => Promise<unknown>): Promise<void> {
  try {
    await tarefa()
  } catch (erro) {
    console.error(ROTULO, { etapa, ...erroParaLog(erro) })
  }
}

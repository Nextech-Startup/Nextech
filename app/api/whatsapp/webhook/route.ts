import { receberMensagem } from "@/lib/conversations/recepcao"
import { erroParaLog } from "@/lib/security/erro-para-log"
import { assinaturaValida, desafioDaVerificacao } from "@/lib/whatsapp/assinatura"
import { receberEventoDeConta } from "@/lib/whatsapp/conta"
import { falhaDefinitiva, interpretarWebhook } from "@/lib/whatsapp/webhook"

/**
 * Webhook da Meta (conversation-engine-v1, recepção, eco e eventos de conta).
 *
 * Grava antes de responder: a gravação leva milissegundos, e um 200 com a
 * gravação falha perderia a mensagem para sempre. Com 500, a Meta reenvia,
 * e o reenvio é inofensivo porque a gravação é idempotente. Só a falha
 * transitória vira 500: a definitiva se repetiria em todo reenvio e
 * travaria os eventos que vieram junto.
 *
 * Log só com metadado: nunca o payload, o conteúdo, o telefone nem o erro
 * inteiro (lgpd-security).
 */

const ROTULO = "[whatsapp-webhook]"

export async function GET(request: Request) {
  const desafio = desafioDaVerificacao(
    new URL(request.url).searchParams,
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "",
  )
  if (desafio === null) return new Response(null, { status: 403 })
  return new Response(desafio, { status: 200, headers: { "content-type": "text/plain" } })
}

export async function POST(request: Request) {
  const segredo = process.env.WHATSAPP_APP_SECRET
  if (!segredo) {
    console.error(ROTULO, { etapa: "configuracao" })
    return new Response(null, { status: 500 })
  }

  // Os bytes crus: a assinatura é sobre o que chegou, não sobre o texto
  // decodificado nem sobre o JSON.
  const corpo = Buffer.from(await request.arrayBuffer())
  if (!assinaturaValida(corpo, request.headers.get("x-hub-signature-256"), segredo)) {
    return new Response(null, { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(corpo.toString("utf8"))
  } catch {
    return new Response(null, { status: 400 })
  }

  const eventos = interpretarWebhook(payload)
  let transitorias = 0
  // Em sequência: duas mensagens do mesmo paciente no mesmo payload
  // disputariam a mesma conversa e a mesma sessão.
  for (const evento of eventos) {
    try {
      if (evento.tipo === "mensagem") await receberMensagem(evento)
      else await receberEventoDeConta(evento)
    } catch (erro) {
      const falha = erroParaLog(erro)
      const definitiva = falhaDefinitiva(falha)
      if (!definitiva) transitorias += 1
      console.error(ROTULO, { etapa: "recepcao", definitiva, ...falha })
    }
  }

  return new Response(null, { status: transitorias > 0 ? 500 : 200 })
}

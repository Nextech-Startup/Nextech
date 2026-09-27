import { after } from "next/server"
import { receberMensagem } from "@/lib/conversations/recepcao"
import { responderConversa } from "@/lib/conversations/resposta"
import { receberStatus } from "@/lib/conversations/status"
import { enviarProtocolo } from "@/lib/conversations/urgencia"
import { erroParaLog } from "@/lib/security/erro-para-log"
import { assinaturaValida, desafioDaVerificacao } from "@/lib/whatsapp/assinatura"
import { receberEventoDeConta } from "@/lib/whatsapp/conta"
import { falhaDefinitiva, interpretarWebhook } from "@/lib/whatsapp/webhook"

/**
 * Webhook da Meta (conversation-engine-v1, recepção, eco, eventos de conta
 * e status de entrega).
 *
 * Grava antes de responder: a gravação leva milissegundos, e um 200 com a
 * gravação falha perderia a mensagem para sempre. Com 500, a Meta reenvia,
 * e o reenvio é inofensivo porque a gravação é idempotente. Só a falha
 * transitória vira 500: a definitiva se repetiria em todo reenvio e
 * travaria os eventos que vieram junto.
 *
 * A resposta da IA roda depois do 200, no `after()`: é o que demora
 * (agrupamento de 10 s, modelo, envio), e a Meta reenviaria por timeout.
 *
 * Log só com metadado: nunca o payload, o conteúdo, o telefone nem o erro
 * inteiro (lgpd-security).
 */

// Pior caso da resposta: 10 s de agrupamento, três tentativas de 20 s no
// modelo com 5 s de espera entre elas, e o envio. A varredura do pg_cron
// (sweep_stale_ai_replies) trata como órfã a resposta pending há mais de
// 5 min: este valor precisa ficar abaixo disso (teste em
// tests/conversations/ordem-de-trava.test.ts).
export const maxDuration = 120

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
  // Conversas com falha transitória neste POST. As mensagens seguintes
  // delas esperam o reenvio da Meta: entrar agora faria a IA responder à
  // mensagem N+1 antes de a N existir.
  const adiadas = new Set<string>()

  // Em sequência: duas mensagens do mesmo paciente no mesmo payload
  // disputariam a mesma conversa e a mesma sessão.
  for (const evento of eventos) {
    const conversa = evento.tipo === "mensagem" ? `${evento.phoneNumberId}:${evento.waIdDoPaciente}` : null
    if (conversa && adiadas.has(conversa)) {
      transitorias += 1
      continue
    }

    try {
      if (evento.tipo === "mensagem") {
        const r = await receberMensagem(evento)
        // A conversa acabou de escalar: o protocolo da clínica sai já, sem
        // o agrupamento da resposta da IA.
        const protocolo = r?.protocolo
        if (r && protocolo) {
          after(() => emSegundoPlano("protocolo", () => enviarProtocolo({ ...r, protocolo })))
        }
        // Reenvio (`nova: false`) já teve a resposta agendada da primeira vez.
        // Pedido de opt-out e mensagem urgente não têm resposta da IA.
        if (r && r.autor === "patient" && r.nova && r.agenteAtivo && !r.optOut && !r.urgente) {
          after(() => emSegundoPlano("resposta", () => responderConversa(r)))
        }
      } else if (evento.tipo === "status") {
        await receberStatus(evento)
      } else {
        await receberEventoDeConta(evento)
      }
    } catch (erro) {
      const falha = erroParaLog(erro)
      const definitiva = falhaDefinitiva(falha)
      if (!definitiva) {
        transitorias += 1
        if (conversa) adiadas.add(conversa)
      }
      console.error(ROTULO, { etapa: "recepcao", definitiva, ...falha })
    }
  }

  return new Response(null, { status: transitorias > 0 ? 500 : 200 })
}

/** Depois do 200 não há a quem devolver erro: loga o metadado e para. */
async function emSegundoPlano(etapa: "resposta" | "protocolo", tarefa: () => Promise<unknown>): Promise<void> {
  try {
    await tarefa()
  } catch (erro) {
    console.error(ROTULO, { etapa, ...erroParaLog(erro) })
  }
}

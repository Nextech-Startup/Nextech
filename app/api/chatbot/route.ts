import { NextResponse } from "next/server"
import { serviceContext } from "@/lib/auth/service-context"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, whatsapp, company, specialty, meetings_count } = body

    // 1. Validação
    if (!email || !name) {
      return NextResponse.json({ error: "Nome e e-mail são obrigatórios." }, { status: 400 })
    }

    // 2. Supabase
    // Lead da landing chega sem sessão, então a escrita usa service_role,
    // que ignora a RLS de chatbot_leads. É o único caminho possível aqui.
    const { supabase } = serviceContext()

    // 3. Salvar lead
    const { error: erroSupabase } = await supabase
      .from("chatbot_leads")
      .insert([{
        name,
        email,
        whatsapp,
        company,
        specialty,
        meetings_count,
        origem: "Chatbot Site",
      }])

    if (erroSupabase) {
      // Só metadado: `message` e `details` do PostgrestError carregam o valor
      // da linha rejeitada, que aqui é PII do lead (regra 3 do CLAUDE.md).
      console.error("Falha ao salvar lead", {
        code: erroSupabase.code,
        hint: erroSupabase.hint,
      })
      throw new Error("Falha ao salvar lead no banco.")
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    // Nunca o objeto inteiro: se algo lançou com o body anexado, o payload
    // do lead iria junto para o log.
    console.error("Erro na rota do chatbot", {
      name: error instanceof Error ? error.name : "unknown",
    })
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 })
  }
}
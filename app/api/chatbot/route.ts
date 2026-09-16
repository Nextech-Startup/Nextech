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
      console.error("Erro Supabase:", erroSupabase)
      throw new Error("Falha ao salvar lead no banco.")
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Erro API Chatbot:", error)
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 })
  }
}
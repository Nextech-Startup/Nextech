import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import axios from "axios"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, whatsapp, company, specialty, meetings_count } = body

    // 1. Validação
    if (!email || !name) {
      return NextResponse.json({ error: "Nome e e-mail são obrigatórios." }, { status: 400 })
    }

    // 2. Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Variáveis de ambiente do Supabase não configuradas.")
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })

    // 3. Salvar lead
    const { data: leadSalvo, error: erroSupabase } = await supabase
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
      .select()
      .single()

    if (erroSupabase) {
      console.error("Erro Supabase:", erroSupabase)
      throw new Error("Falha ao salvar lead no banco.")
    }

    // 4. Webhook n8n (opcional)
    const n8nWebhook = process.env.N8N_WEBHOOK_CHATBOT_URL
    if (n8nWebhook) {
      axios.post(n8nWebhook, {
        ...leadSalvo,
        data_hora: new Date().toLocaleString("pt-BR"),
      }).catch((err) => console.error("Erro ao notificar n8n:", err.message))
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Erro API Chatbot:", error)
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 })
  }
}
export interface ChatbotLeadData {
  name: string
  email: string
  whatsapp: string
  company: string
  specialty: string
  meetings_count: string
}

export const chatbotService = {
  async createLead(data: ChatbotLeadData) {
    try {
      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Falha ao enviar lead")
      }

      return await response.json()
    } catch (error) {
      // Só o nome do erro: o objeto pode carregar o payload do lead.
      // Aqui roda no browser, com o dado do próprio usuário, mas o módulo é
      // compartilhável — o padrão vale em qualquer contexto (regra 3).
      console.error("Erro ao enviar lead", {
        name: error instanceof Error ? error.name : "unknown",
      })
      throw error
    }
  },
}
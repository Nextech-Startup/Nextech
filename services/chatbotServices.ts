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
      console.error("Erro no chatbotService:", error)
      throw error
    }
  },
}
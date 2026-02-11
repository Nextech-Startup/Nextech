"use client"

import { motion, useInView } from "framer-motion"
import { useRef } from "react"
import { Check, Zap } from "lucide-react"
import { LiquidMetalButton } from "@/components/ui/liquidMetalButton"

// --- Configuração WhatsApp ---
const WHATSAPP_NUMBER = "5581999112895"

const plans = [
  {
    name: "Starter",
    description: "Ideal para consultórios e clínicas iniciando na automação inteligente.",
    features: [
      "Assistente IA no WhatsApp 24/7",
      "Qualificação automática de pacientes",
      "Até 150 atendimentos/mês",
      "Agendamento + Follow-up",
      "Registro completo de conversas e pacientes",
      "Respostas sobre convênios e valores",
      "Transferência para atendente humano com resumo da conversa",
      "Suporte via e-mail (SLA 24h)",
    ],
    highlighted: false,
    whatsappMessage: "Olá Jhon! Tenho interesse no plano *Starter* da Nextech. Gostaria de saber mais detalhes sobre valores e como funciona a implementação para minha clínica.",
  },
  {
    name: "Pro",
    description: "O poder total da IA para clínicas em crescimento acelerado.",
    features: [
      "Tudo do Starter",
      "Até 500 atendimentos/mês",
      "Agendamento inteligente com reagendamento e cancelamento",
      "Integração total no CRM (Pipedrive, Kommo, RD Station, Doctoralia e outros)",
      "Processamento de áudios com IA",
      "Redução de no-show com lembretes automáticos",
      "Relatório semanal de pacientes qualificados",
      "Suporte prioritário via WhatsApp (SLA 4h)",
    ],
    highlighted: true,
    whatsappMessage: "Olá Jhon! Tenho interesse no plano *Pro* da Nextech. Quero escalar minha clínica com IA e gostaria de agendar uma demonstração para conhecer todas as funcionalidades.",
  },
  {
    name: "HealthTech",
    description: "Para redes de clínicas e hospitais que exigem performance e segurança.",
    features: [
      "Tudo do Pro",
      "Até 5.000 atendimentos/mês",
      "IA treinada com os dados da sua operação",
      "Integrações via API customizada",
      "SSO & criptografia avançada (LGPD)",
      "Gerente de conta dedicado",
      "Onboarding e treinamento da equipe",
      "SLA de resposta em até 1h (99,5% uptime)",
    ],
    highlighted: false,
    whatsappMessage: "Olá Jhon! Represento uma rede de clínicas/hospital e tenho interesse no plano *HealthTech* da Nextech. Gostaria de agendar uma reunião para discutir uma solução personalizada para nossa operação.",
  },
]

export function Planos() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  const handleContact = (message: string) => {
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
  }

  return (
    <section id="Planos" className="py-24 px-4 relative overflow-hidden">
      {/* Brilho Aurora de fundo sutil */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-200 h-100 bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-6">
            <Zap className="w-4 h-4 text-emerald-400 fill-emerald-400" />
            <span className="text-xs font-bold text-white/80 uppercase tracking-widest">Soluções Customizadas</span>
          </div>

          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight">
            Planos feitos para <br />
            <span className="block mt-2 text-zinc-500 italic">escalar sua clínica.</span>
          </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            Valores adaptados conforme o volume de pacientes e complexidade das integrações. Todos os planos incluem nossa tecnologia proprietária.
          </p>
        </motion.div>

        <div ref={ref} className="grid grid-cols-1 md:grid-cols-3 gap-14 items-stretch">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className={`relative p-8 rounded-[2.5rem] border flex flex-col transition-all duration-500 ${plan.highlighted
                ? "bg-white/10 border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-xl scale-105 z-10 hover:scale-[1.08]"
                : "bg-white/5 border-white/10 backdrop-blur-md hover:scale-[1.02]"
                }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg">
                  Recomendado
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{plan.description}</p>
              </div>

              {/* Status de Valor Centralizado */}
              <div className="mb-10">
                <div className="inline-block px-5 py-2.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-lg font-bold text-white tracking-tight">Sob consulta</span>
                </div>
              </div>

              {/* Lista de Features */}
              <ul className="space-y-4 mb-12 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm text-zinc-300">
                    <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" strokeWidth={3} />
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-auto h-16 w-full flex items-center justify-center">
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(plan.whatsappMessage)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cursor-pointer"
                >
                  <LiquidMetalButton label="Falar com Especialista" />
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
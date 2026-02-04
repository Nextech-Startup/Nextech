"use client"

import { motion, useInView } from "framer-motion"
import { useRef } from "react"
import { Check, Zap } from "lucide-react"
import { LiquidMetalButton } from "@/components/ui/liquidMetalButton"

const plans = [
  {
    name: "Starter",
    description: "Ideal para pequenas clínicas iniciando na automação.",
    features: [
      "IA no WhatsApp 24/7", 
      "Qualificação básica de leads", 
      "Até 500 conversas/mês", 
      "Suporte via e-mail", 
      "Dashboard de métricas"
    ],
    highlighted: false,
  },
  {
    name: "Pro",
    description: "O poder total da IA para clínicas em crescimento.",
    features: [
      "Tudo do Starter",
      "Conversas ilimitadas",
      "Integração Pipedrive/CRM",
      "Agendamento automático",
      "Voz (AI Receptionist)",
      "Suporte Prioritário VIP",
      "Multicanal (Insta/Site)",
    ],
    highlighted: true,
  },
  {
    name: "Enterprise",
    description: "Soluções personalizadas para grandes redes hospitalares.",
    features: [
      "Tudo do Pro",
      "IA treinada com seus dados",
      "SSO & Segurança Avançada",
      "Gerente de conta dedicado",
      "Treinamento de equipe",
      "Integrações via API custom",
      "SLA de 99.9%",
    ],
    highlighted: false,
  },
]

export function Pricing() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  const handleContact = () => {
    window.open('https://wa.me/SEUNUMERO', '_blank')
  }

  return (
    <section id="pricing" className="py-24 px-4 relative overflow-hidden">
      {/* Brilho Aurora de fundo sutil */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-200 h-100 bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
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
            <span className="text-zinc-500 italic">escalar sua clínica.</span>
          </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            Valores adaptados conforme o volume de pacientes e complexidade das integrações. Todos os planos incluem nossa tecnologia proprietária.
          </p>
        </motion.div>

        <div ref={ref} className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className={`relative p-8 rounded-[2.5rem] border flex flex-col transition-all duration-500 hover:scale-[1.02] ${
                plan.highlighted
                  ? "bg-white/10 border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-xl"
                  : "bg-white/5 border-white/10 backdrop-blur-md"
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

              {/* Botões Liquid Metal Padronizados (h-16) */}
              <div className="mt-auto h-16 w-full flex items-center justify-center">
                <LiquidMetalButton 
                  label="Falar com Especialista" 
                  onClick={handleContact}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
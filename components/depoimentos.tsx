"use client"

import { useRef } from "react"
import { motion, useInView } from "framer-motion"
import { TestimonialsColumn } from "@/components/ui/testimonials-column"

const depoimentos = [
  {
    text: "Recuperamos 35% das mensagens perdidas fora do horário e passamos a qualificar 100% dos pacientes. O resultado foi um aumento de 50% nos agendamentos já no primeiro mês.",
    name: "Dr. Ricardo Mendes",
    role: "Dono de Clínica",
  },
  {
    text: "Gastamos muito menos tempo pensando em responder pacientes agora, graças ao engajamento instantâneo que a Nextech nos oferece.",
    name: "Fernanda Oliveira",
    role: "Gerente Comercial",
  },
  {
    text: "Com a Nextech, nossa taxa de conversão aumentou em 85% e impulsionou nossa receita de fim de semana em 40%.",
    name: "Marcelo Tavares",
    role: "Diretor Geral",
  },
  {
    text: "A IA lida com as dúvidas 24/7, então nunca perdemos uma venda potencial. Nossa equipe foca em fechar negócios.",
    name: "Juliana Barros",
    role: "Diretora de Operações",
  },
  {
    text: "A satisfação dos clientes melhorou drasticamente. Eles amam as respostas instantâneas.",
    name: "Thiago Nascimento",
    role: "Gerente de Customer Experience",
  },
  {
    text: "Nossa clínica viu um aumento de 60% em pacientes qualificados. O chatbot lida com as dúvidas perfeitamente.",
    name: "Dra. Camila Rocha",
    role: "Gestora Administrativa",
  },
  {
    text: "Antes da Nextech, perdíamos pacientes no fim de semana. Hoje convertemos 3x mais fora do horário comercial.",
    name: "Dr. André Figueiredo",
    role: "Cirurgião-Dentista",
  },
  {
    text: "O agendamento automático reduziu nosso no-show em 40%. Os lembretes pelo WhatsApp fazem toda a diferença.",
    name: "Patrícia Almeida",
    role: "Coordenadora de Atendimento",
  },
  {
    text: "Implementamos em uma semana e já no primeiro mês tivemos ROI positivo. Recomendo para qualquer clínica.",
    name: "Roberto Cardoso",
    role: "CEO de Rede de Clínicas",
  },
  {
    text: "Nossa recepção vivia sobrecarregada. Com a IA, elas focam no presencial e o WhatsApp roda no automático.",
    name: "Dra. Vanessa Lima",
    role: "Proprietária de Consultório",
  },
  {
    text: "O relatório de pacientes qualificados me ajuda a entender de onde vêm os melhores pacientes. Dados que antes não tínhamos.",
    name: "Lucas Pereira",
    role: "Analista de Marketing",
  },
  {
    text: "Nossos pacientes elogiam o atendimento rápido. Muitos nem percebem que é uma IA — e isso é o melhor elogio.",
    name: "Beatriz Santana",
    role: "Gerente de Qualidade",
  },
]

export function Depoimentos() {
  // 1. Referência para a seção (o "dedo apontando")
  const sectionRef = useRef<HTMLElement>(null)

  // 2. Hook moderno para detectar quando a seção aparece
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" })

  return (
    <section
      id="Depoimentos"
      ref={sectionRef}
      className="relative pt-24 pb-24 px-4 overflow-hidden">
      {/* Grid Background */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none">
        <div
          className="h-full w-full"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-16 md:mb-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="inline-flex items-center gap-2 text-white/60 text-sm font-medium tracking-wider uppercase mb-6"
          >
            <div className="w-8 h-px bg-white/30"></div>
            Histórias de Sucesso
            <div className="w-8 h-px bg-white/30"></div>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-5xl md:text-6xl lg:text-7xl font-light text-white mb-8 tracking-tight text-balance"
          >
            Empresas que <span className="font-medium italic text-zinc-400">potencializamos</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-xl text-white/70 max-w-2xl mx-auto leading-relaxed"
          >
            Descubra como clínicas líderes estão transformando o engajamento de clientes com a inteligência da Nextech.
          </motion.p>
        </div>

        {/* Testimonials Carousel */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 1, delay: 0.6 }}
          className="relative flex justify-center items-center min-h-150 overflow-hidden"
        >
          <div
            className="flex gap-8 max-w-6xl"
            style={{
              maskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
            }}
          >
            <TestimonialsColumn testimonials={depoimentos.slice(0, 4)} duration={25} className="flex-1" />
            <TestimonialsColumn testimonials={depoimentos.slice(4, 8)} duration={20} reverse={true} className="flex-1 hidden md:block" />
            <TestimonialsColumn testimonials={depoimentos.slice(8, 12)} duration={30} className="flex-1 hidden lg:block" />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
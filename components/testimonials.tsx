"use client"

import { useRef } from "react"
import { motion, useInView } from "framer-motion"
import { TestimonialsColumn } from "@/components/ui/testimonials-column"

export function Testimonials() {
  const sectionRef = useRef(null)
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" })

  const testimonials = [
    {
      text: "Deixamos de perder 70% das mensagens fora do horário para capturar cada lead. Os agendamentos aumentaram 50% no primeiro mês.",
      name: "Mike Rodriguez",
      role: "Dono de Clínica",
    },
    {
      text: "Gastamos muito menos tempo pensando em responder leads agora, graças ao engajamento instantâneo que a Nextech nos oferece.",
      name: "Sarah Chen",
      role: "Gerente Comercial",
    },
    {
      text: "Com a Nextech, nossa taxa de conversão aumentou em 85% e impulsionou nossa receita de fim de semana em 40%.",
      name: "Michael Torres",
      role: "Diretor Geral",
    },
    {
      text: "A IA lida com as dúvidas 24/7, então nunca perdemos uma venda potencial. Nossa equipe foca em fechar negócios.",
      name: "Jennifer Walsh",
      role: "Diretora de Operações",
    },
    {
      text: "A satisfação dos clientes melhorou drasticamente. Eles amam as respostas instantâneas.",
      name: "David Kim",
      role: "Gerente de Customer Experience",
    },
    {
      text: "Nossa clínica viu um aumento de 60% em leads qualificados. O chatbot lida com as dúvidas perfeitamente.",
      name: "Lisa Thompson",
      role: "Gestora Administrativa",
    },
  ]

  return (
    <section id="testimonials" ref={sectionRef} className="relative pt-24 pb-24 px-4 overflow-hidden">
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
            Success Stories
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
            <TestimonialsColumn testimonials={testimonials.slice(0, 3)} duration={25} className="flex-1" />
            <TestimonialsColumn
              testimonials={testimonials.slice(2, 5)}
              duration={20}
              reverse={true}
              className="flex-1 hidden md:block"
            />
            <TestimonialsColumn
              testimonials={testimonials.slice(1, 4)}
              duration={30}
              className="flex-1 hidden lg:block"
            />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
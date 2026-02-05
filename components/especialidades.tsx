"use client"

import { motion, useInView } from "framer-motion"
import { useRef } from "react"
import { 
  Stethoscope, 
  Smile, 
  Sparkles, 
  Microscope, 
  Leaf, 
  Activity, 
  Brain 
} from "lucide-react"

// --- Dados das Especialidades ---
const clinicTypes = [
  {
    icon: Stethoscope,
    title: "Clínicas Médicas",
    description: "Cardiologia, Ginecologia, Pediatria e mais."
  },
  {
    icon: Smile,
    title: "Odontologia",
    description: "Dentistas, Ortodontia e Implantodontia."
  },
  {
    icon: Sparkles,
    title: "Estética & Dermato",
    description: "Harmonização, Estética e Plástica."
  },
  {
    icon: Microscope,
    title: "Laboratórios",
    description: "Análises clínicas e exames por imagem."
  },
  {
    icon: Leaf,
    title: "Nutrição",
    description: "Emagrecimento e acompanhamento metabólico."
  },
  {
    icon: Activity,
    title: "Fisioterapia",
    description: "Esportiva, Pilates e Reabilitação."
  },
  {
    icon: Brain,
    title: "Saúde Mental",
    description: "Psicologia, Psiquiatria e Bem-estar."
  }
]

export function Especialidades() {
  // 1. Referência para a seção (o "dedo apontando")
  const sectionRef = useRef<HTMLElement>(null)
  
  // 2. Hook moderno para detectar quando a seção aparece
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" })

  return (
    <section 
      id="Especialidades" 
      ref={sectionRef} 
      className="py-24 overflow-hidden bg-zinc-950/50 relative z-10"
    >
      {/* Cabeçalho Animado com base no Scroll */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="text-center mb-16 px-4"
      >
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">
          Soluções sob medida para sua área
        </h2>
        <p className="text-zinc-500 uppercase tracking-[0.2em] text-xs font-bold">
          Especialidades que a Nextech já transforma
        </p>
      </motion.div>

      {/* Carrossel Infinito (Marquee) */}
      <div className="relative flex items-center">
        {/* Máscaras laterais para suavizar o degradê (Glassmorphism) */}
        <div className="absolute left-0 top-0 bottom-0 w-24 md:w-40 bg-gradient-to-r from-zinc-950 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 md:w-40 bg-gradient-to-l from-zinc-950 to-transparent z-10 pointer-events-none" />

        {/* Container da Animação - Duplicado para loop infinito */}
        <div className="flex animate-marquee whitespace-nowrap gap-6 py-4 hover:[animation-play-state:paused] cursor-grab active:cursor-grabbing">
          {[...clinicTypes, ...clinicTypes].map((clinic, index) => (
            <div
              key={index}
              className="flex items-center gap-4 bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl min-w-[300px] md:min-w-[350px] hover:bg-white/10 hover:border-emerald-500/30 transition-all duration-500 group"
            >
              {/* Ícone com brilho sutil */}
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all duration-500">
                <clinic.icon className="text-emerald-400 w-6 h-6" />
              </div>
              
              <div className="flex flex-col">
                <span className="text-white font-bold text-lg tracking-tight">
                  {clinic.title}
                </span>
                <span className="text-zinc-500 text-sm whitespace-normal leading-snug">
                  {clinic.description}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
"use client"

import { motion, useInView } from "framer-motion"
import { useRef } from "react"
import { 
  Stethoscope, Smile, Sparkles, Microscope, 
  Leaf, Activity, Brain 
} from "lucide-react"

// Seu componente de design premium para os ícones
import { LiquidMetalFake } from "@/components/ui/LiquidMetalFake"

const clinicTypes = [
  { icon: <Stethoscope size={20} color="#ffffff" />, title: "Clínicas Médicas", description: "Cardiologia, Ginecologia, Pediatria e mais." },
  { icon: <Smile size={20} color="#ffffff" />, title: "Odontologia", description: "Dentistas, Ortodontia e Implantodontia." },
  { icon: <Sparkles size={20} color="#ffffff" />, title: "Estética & Dermato", description: "Harmonização, Estética e Plástica." },
  { icon: <Microscope size={20} color="#ffffff" />, title: "Laboratórios", description: "Análises clínicas e exames por imagem." },
  { icon: <Leaf size={20} color="#ffffff" />, title: "Nutrição", description: "Emagrecimento e acompanhamento metabólico." },
  { icon: <Activity size={20} color="#ffffff" />, title: "Fisioterapia", description: "Esportiva, Pilates e Reabilitação." },
  { icon: <Brain size={20} color="#ffffff" />, title: "Saúde Mental", description: "Psicologia, Psiquiatria e Bem-estar." }
]

export function Especialidades() {
  const sectionRef = useRef<HTMLElement>(null)
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" })

  return (
    <section 
      id="Especialidades" 
      ref={sectionRef} 
      className="py-24 overflow-hidden bg-transparent relative z-10"
    >
      {/* Cabeçalho */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="text-center mb-16 px-4"
      >
        <h2 className="font-display text-3xl md:text-5xl text-ink-1 mb-4 tracking-tight">
          Soluções sob medida para sua área
        </h2>
        <p className="text-ink-3 text-sm">
          Especialidades que a Nextech já transforma
        </p>
      </motion.div>

      {/* Carrossel com animação linear e design de card original */}
      <div className="w-full select-none cursor-grab active:cursor-grabbing">
        {/* Marquee em CSS puro.
            Era um Swiper com autoplay de delay 0 e velocidade constante —
            ou seja, um marquee linear sem interação nenhuma. O 'swiper/css'
            entrava como CSS crítico e bloqueava a renderização por 450ms
            (mais que a folha principal, que é 8x maior), e o pacote somava
            ~91KB de JS. A animação abaixo faz o mesmo sem nada disso.

            A faixa tem os itens duplicados e desloca -50%: quando a
            primeira metade sai, a segunda está exatamente na posição
            inicial, então o ciclo é imperceptível. */}
        <div className="mask-marquee overflow-hidden py-4">
          <div className="especialidades-track flex w-max gap-6">
            {[...clinicTypes, ...clinicTypes].map((clinic, index) => (
              <div
                key={index}
                /* Larguras equivalentes ao slidesPerView do Swiper
                   (1.3 / 2 / 3 / 4 por tela, com o gap descontado). */
                className="w-[calc(76vw-1.5rem)] sm:w-[calc(50vw-1.5rem)] lg:w-[calc(33.333vw-1.5rem)] min-[1440px]:w-[calc(25vw-1.5rem)] shrink-0"
                aria-hidden={index >= clinicTypes.length}
              >
                <div className="flex items-center gap-4 glass-effect p-6 rounded-card min-h-[120px] h-full">
                  <div className="shrink-0">
                    <LiquidMetalFake
                      viewMode="icon"
                      icon={clinic.icon}
                      className="pointer-events-none"
                    />
                  </div>

                  <div className="flex flex-col">
                    <span className="text-ink-1 font-bold text-lg tracking-tight">
                      {clinic.title}
                    </span>
                    <span className="text-ink-2 text-sm whitespace-normal leading-snug">
                      {clinic.description}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
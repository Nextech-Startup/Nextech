"use client"

import { motion, useInView } from "framer-motion"
import { useRef } from "react"
import { 
  Stethoscope, Smile, Sparkles, Microscope, 
  Leaf, Activity, Brain 
} from "lucide-react"

// Importações do Swiper para a animação infinita suave
import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay } from 'swiper/modules'
import 'swiper/css'

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
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">
          Soluções sob medida para sua área
        </h2>
        <p className="text-zinc-500 uppercase tracking-[0.2em] text-xs font-bold">
          Especialidades que a Nextech já transforma
        </p>
      </motion.div>

      {/* Carrossel com animação linear e design de card original */}
      <div className="w-full select-none cursor-grab active:cursor-grabbing">
        <Swiper
          modules={[Autoplay]}
          loop={true}
          speed={5000} 
          autoplay={{
            delay: 0,
            disableOnInteraction: false,
            pauseOnMouseEnter: false,
          }}
          slidesPerView={1.3}
          spaceBetween={24}
          breakpoints={{
            640: { slidesPerView: 2 },
            1024: { slidesPerView: 3 },
            1440: { slidesPerView: 4 },
          }}
          className="w-full py-4 [&>.swiper-wrapper]:ease-linear"
        >
          {/* Duplicamos os itens para garantir o preenchimento visual no loop */}
          {[...clinicTypes, ...clinicTypes].map((clinic, index) => (
            <SwiperSlide key={index} className="h-auto">
              <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl min-h-[120px] transition-all duration-500 group hover:bg-white/10">
                
                {/* Ícone LiquidMetalFake para manter o brilho metálico sutil */}
                <div className="shrink-0">
                  <LiquidMetalFake 
                    viewMode="icon" 
                    icon={clinic.icon}
                    className="pointer-events-none" 
                  />
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
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  )
}
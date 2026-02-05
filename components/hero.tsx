"use client"

import { motion, easeInOut } from "framer-motion"
import { useRef } from "react"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LiquidMetalButton } from "@/components/ui/liquidMetalButton"
import Typewriter from "typewriter-effect"

const avatars = [
  "/professional-headshot-1.png",
  "/professional-headshot-2.png",
  "/professional-headshot-3.png",
  "/professional-headshot-4.png",
  "/professional-headshot-5.png",
]

const textRevealVariants = {
  hidden: { y: "100%" },
  visible: (i: number) => ({
    y: 0,
    transition: {
      duration: 0.8,
      ease: easeInOut,
      delay: i * 0.1,
    },
  }),
}

// --- Configuração WhatsApp ---
const WHATSAPP_NUMBER = "5581999112895"
const WHATSAPP_MESSAGE =
  "Olá Jhon, tudo bem? Gostaria de agendar uma reunião para conhecer a Nextech."
const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  WHATSAPP_MESSAGE
)}`

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null)

  // Função de Scroll Suave
  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId)
    if (section) {
      const SCROLL_OFFSET = 100
      const sectionTop = section.getBoundingClientRect().top + window.pageYOffset - SCROLL_OFFSET
      window.scrollTo({
        top: sectionTop,
        behavior: "smooth",
      })
    }
  }

  return (
    <section
      id="Hero"
      ref={sectionRef}
      className="relative pt-32 md:pt-24 min-h-screen flex flex-col items-center justify-center px-4 pb-16 overflow-hidden bg-transparent">

      <div className="relative z-10 max-w-5xl mx-auto text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 mb-8"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm text-zinc-400">Assistentes de IA para clínicas e consultórios</span>
        </motion.div>

        {/* Headline */}
        <h1
          className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-6"
        >
          <span className="block overflow-hidden py-3">
            <motion.span
              className="block"
              variants={textRevealVariants}
              initial="hidden"
              animate="visible"
              custom={0}
            >
              Atendimento ágil.
            </motion.span>
          </span>
          <span className="block overflow-hidden py-3">
            <motion.span
              className="block text-zinc-500/80"
              variants={textRevealVariants}
              initial="hidden"
              animate="visible"
              custom={1}
            >
              <Typewriter
                options={{
                  strings: [
                    "Gestão inteligente.",
                    "Vendas automatizadas.",
                    "Faturamento otimizado.",
                    "Nextech AI.",
                  ],
                  autoStart: true,
                  loop: true,
                  delay: 50,
                  deleteSpeed: 30,
                  cursor: "|",
                  wrapperClassName: "text-zinc-500/80",
                  cursorClassName: "text-emerald-800 font-light",
                }}
              />
            </motion.span>
          </span>
        </h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Implementamos assistentes IA que automatizam conversas no WhatsApp e vendem 24 horas por dia.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-16"
        >
          {/* BOTÃO PRINCIPAL: Agendar Reunião (WhatsApp) */}
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            <Button
              size="lg"
              className="bg-white text-zinc-950 hover:bg-white rounded-full px-8 h-11.5 text-base font-semibold transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(96,117,133,0.5)] active:scale-95 cursor-pointer"
            >
              Agende uma reunião
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </a>

          {/* BOTÃO SECUNDÁRIO: Ver Demonstração (Scroll para Soluções) */}
          <div
            onClick={() => scrollToSection("Solucoes")}
            className="cursor-pointer"
            style={{ pointerEvents: "auto" }}
          >
            <div style={{ pointerEvents: "none" }}>
              <LiquidMetalButton label="Ver Demonstração" />
            </div>
          </div>
        </motion.div>
        {/* Social Proof */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="flex items-center -space-x-3">
            {avatars.map((avatar, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.5, x: -20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.8 + index * 0.1 }}
                className="relative"
              >
                <img
                  src={avatar || "/placeholder.svg"}
                  alt=""
                  className="w-10 h-10 rounded-full border-2 border-zinc-950 object-cover"
                />
              </motion.div>
            ))}
          </div>
          <p className="text-sm text-zinc-500">
            Impactando mais de <span className="text-zinc-300 font-medium">100 clínicas</span> em todo o país
          </p>
        </motion.div>
      </div>
    </section>
  )
}
"use client"

import { motion, easeInOut } from "framer-motion"
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

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-24 pb-16 overflow-hidden bg-transparent">

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
          className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-6"
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
                  wrapperClassName: "text-zinc-500/80", // Mantém sua cor cinza
                  cursorClassName: "text-emerald-800 ont-light", // Cursor em destaque
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
          {/* BOTÃO PRINCIPAL: Fundo Branco */}
          <Button
            size="lg"
            className="bg-white text-zinc-950 hover:bg-white rounded-full px-8 h-11.5 text-base font-semibold transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(96,117,133,0.5)] active:scale-95"
          >
            Agende uma reunião
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>

          {/* BOTÃO SECUNDÁRIO: Liquid Metal (Fundo Preto) */}
          <LiquidMetalButton
            label="Ver Demonstração"
            onClick={() => console.log("Iniciando demonstração...")}
          />
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
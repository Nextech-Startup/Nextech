"use client"

import { motion, useInView } from "framer-motion"
import { useRef } from "react"
import { ArrowRight, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LiquidMetalButton } from "@/components/ui/liquidMetalButton"

export function FinalCTA() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section className="py-32 px-4 relative overflow-hidden">
      {/* Brilho de fundo sutil para destacar o fechamento */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-75 bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 40 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-4xl mx-auto text-center relative z-10"
      >
        <h2
          className="text-4xl sm:text-5xl lg:text-7xl font-bold text-white mb-6 tracking-tight"
          style={{ fontFamily: "var(--font-cal-sans)" }}
        >
          Pronto para escalar seu <br />
          <span className="text-zinc-500 italic">atendimento?</span>
        </h2>
        <p className="text-lg sm:text-xl text-zinc-400 mb-12 max-w-2xl mx-auto leading-relaxed">
          Junte-se a dezenas de clínicas que já transformaram seus resultados com a Nextech. Comece sua auditoria gratuita hoje.
        </p>

       <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          {/* Botão Principal: Branco com Glow */}
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
          </div>
        </motion.div>
    </section>
  )
}
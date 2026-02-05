"use client"

import { motion} from "framer-motion"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden mb-20">
      {/* Brilho de fundo sutil para destacar o fechamento */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-75 bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="max-w-7xl mx-auto px-6 py-20 relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mt-20 relative p-px rounded-[2.5rem] bg-linear-to-b from-white/20 to-transparent"
      >
        <div className="bg-white/5 backdrop-blur-md rounded-[2.5rem] p-8 md:p-16 text-center border border-white/10 shadow-2xl">
          <div className="max-w-3xl mx-auto">
            <h2
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6"
          >
            Pronto para escalar seu <br />
            <span className="block mt-2 text-zinc-500 italic font-light">atendimento?</span>
            </h2>
            <p className="text-lg sm:text-xl text-zinc-400 mb-12 max-w-2xl mx-auto leading-relaxed">
              Junte-se a dezenas de clínicas que já transformaram seus resultados com a Nextech. Realize uma call gratuita conosco ainda essa semana.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              {/* Botão Principal: Branco com Glow */}
              <Button
                size="lg"
                className="bg-white text-zinc-950 hover:bg-white rounded-full px-8 h-11.5 text-base font-semibold transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(96,117,133,0.5)] active:scale-95"
              >
                Reunião Gratuita
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
      </div>
    </section>
  )
}
"use client"

import { motion} from "framer-motion"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

// --- Configuração WhatsApp (igual às demais seções) ---
const WHATSAPP_NUMBER = "5581999112895"
const WHATSAPP_MESSAGE =
  "Olá Jhon, tudo bem? Gostaria de agendar uma reunião gratuita para conhecer a Nextech."
const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  WHATSAPP_MESSAGE
)}`

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden mb-20">
      {/* Brilho de fundo sutil para destacar o fechamento */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-75 bg-accent/10 blur-[120px] rounded-pill pointer-events-none" />
      <div className="max-w-7xl mx-auto px-6 py-20 relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mt-20 relative p-px rounded-panel bg-linear-to-b from-white/20 to-transparent"
      >
        <div className="bg-[var(--glass-bg)] backdrop-blur-md rounded-panel p-8 md:p-16 text-center border border-hairline shadow-2xl">
          <div className="max-w-3xl mx-auto">
            <h2
              className="font-display text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.08] text-ink-1 mb-6 tracking-tight"
          >
            Pronto para escalar seu <br />
            <span className="block mt-2 text-ink-3 font-light">atendimento?</span>
            </h2>
            <p className="text-lg sm:text-xl text-ink-2 mb-12 max-w-2xl mx-auto leading-relaxed">
              Junte-se a dezenas de clínicas que já transformaram seus resultados com a Nextech. Realize uma call gratuita conosco ainda essa semana.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              {/* Este botão não tinha destino algum: agora abre o WhatsApp,
                  como os demais CTAs da página. */}
              <Button
                asChild
                size="lg"
                className="bg-ink-1 text-surface-0 hover:bg-ink-1/90 rounded-pill px-8 h-11.5 text-base font-semibold transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(96,117,133,0.5)] active:scale-95"
              >
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                  Reunião Gratuita
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
      </div>
    </section>
  )
}
"use client"

import { motion, easeInOut } from "framer-motion"
import { useRef } from "react"
import { ArrowRight } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { LiquidMetalButton } from "@/components/ui/liquidMetalButton"
import { useScrollTo } from "@/components/smooth-scroll"
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
  const { scrollToSection } = useScrollTo()

  return (
    <section
      id="Hero"
      ref={sectionRef}
      /* O padding-top deriva da altura real da navbar fixa (--navbar-space),
         com folga; antes um pt-20 fixo era menor que a barra em desktop e
         o badge ficava por baixo dela. min-h também desconta a barra para
         o conteúdo continuar centrado na área visível. */
      style={{
        paddingTop: "calc(var(--navbar-space) + 2.5rem)",
        minHeight: "calc(100svh - var(--navbar-offset))",
      }}
      className="relative flex flex-col items-center justify-center px-4 pb-16 overflow-hidden bg-transparent">

      <div className="relative z-10 max-w-5xl mx-auto text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-pill bg-white/[0.04] backdrop-blur-sm border border-hairline mb-8"
        >
          <span className="w-1.5 h-1.5 rounded-pill bg-accent" />
          <span className="text-sm text-ink-2">Assistentes de IA para clínicas e consultórios</span>
        </motion.div>

        {/* Headline — Cal Sans nos títulos, Manrope no corpo. */}
        <h1
          className="font-display text-[clamp(2.5rem,7vw,4.5rem)] leading-[1.05] tracking-tight text-ink-1 mb-6"
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
              className="block text-ink-3/80"
              variants={textRevealVariants}
              initial="hidden"
              animate="visible"
              custom={1}
            >
              {/* Texto estável para leitores de tela e indexação: o efeito de
                  digitação reescreve o DOM continuamente e seria reanunciado
                  a cada caractere. */}
              <span className="sr-only">Gestão inteligente.</span>
              <span aria-hidden="true">
                <Typewriter
                  options={{
                    strings: [
                      "Gestão inteligente.",
                      "Vendas 24 horas.",
                      "Resultado imediato.",
                      "Nextech AI.",
                    ],
                    autoStart: true,
                    loop: true,
                    delay: 50,
                    deleteSpeed: 30,
                    cursor: "|",
                    wrapperClassName: "text-ink-3/80",
                    cursorClassName: "text-accent-dim font-light",
                  }}
                />
              </span>
            </motion.span>
          </span>
        </h1>

        {/* Subheadline — este parágrafo é o elemento de LCP da página.
            Com opacity/y do framer ele só aparecia depois da hidratação:
            o Lighthouse mediu 5.560ms de "atraso na renderização do
            elemento" no desktop. Renderizado direto no HTML, o LCP passa
            a depender só do CSS, sem esperar JavaScript. */}
        <p className="hero-sub text-lg sm:text-xl text-ink-2 max-w-2xl mx-auto mb-10 leading-relaxed">
          Implementamos assistentes IA que automatizam conversas no WhatsApp e vendem 24 horas por dia.
        </p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-16"
        >
          {/* BOTÃO PRINCIPAL: Agendar Reunião (WhatsApp) */}
          {/* asChild faz o Button virar a própria âncora: aninhar <button>
              dentro de <a> é HTML inválido e quebra a hidratação. */}
          <Button
            asChild
            size="lg"
            className="bg-ink-1 text-surface-0 hover:bg-ink-1/90 rounded-pill px-8 h-11.5 text-base font-semibold transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(96,117,133,0.5)] active:scale-95 cursor-pointer"
          >
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              Agende uma reunião
              <ArrowRight className="ml-2 w-4 h-4" aria-hidden="true" />
            </a>
          </Button>

          {/* BOTÃO SECUNDÁRIO: Ver Demonstração (Scroll para a demo).
              O LiquidMetalButton já renderiza o próprio <button>: envolvê-lo
              em outro produziria botão aninhado (HTML inválido). */}
          <LiquidMetalButton
            label="Ver Demonstração"
            onClick={() => scrollToSection("demo-celular")}
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
                key={avatar}
                initial={{ opacity: 0, scale: 0.5, x: -20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.8 + index * 0.1 }}
                className="relative"
              >
                <Image
                  src={avatar}
                  alt=""
                  width={40}
                  height={40}
                  sizes="40px"
                  quality={85}
                  className="w-10 h-10 rounded-pill border-2 border-surface-0 object-cover"
                />
              </motion.div>
            ))}
          </div>
          <p className="text-sm text-ink-3">
            Impactando mais de <span className="text-ink-2 font-medium">100 clínicas</span> em todo o país
          </p>
        </motion.div>
      </div>
    </section>
  )
}
import dynamic from "next/dynamic"

import { SmoothScroll } from "@/components/smooth-scroll"
import { Navbar } from "@/components/navbar"
import { Hero } from "@/components/hero"
import { Background } from "@/components/background"

/*
 * Só o topo da página entra no bundle inicial.
 *
 * Tudo abaixo da dobra é carregado sob demanda: o Swiper (Especialidades),
 * o mockup de conversa (Soluções) e o widget de chat somam a maior parte do
 * JavaScript da página e nenhum deles é necessário para o primeiro paint.
 * Os placeholders reservam altura para não gerar salto de layout (CLS).
 */
const Especialidades = dynamic(() =>
  import("@/components/especialidades").then((m) => m.Especialidades)
)
const Problem = dynamic(() => import("@/components/problem").then((m) => m.Problem))
const Solutions = dynamic(() => import("@/components/solutions").then((m) => m.Solutions))
const Depoimentos = dynamic(() =>
  import("@/components/depoimentos").then((m) => m.Depoimentos)
)
const Planos = dynamic(() => import("@/components/pricing").then((m) => m.Planos))
const FinalCTA = dynamic(() => import("@/components/final-cta").then((m) => m.FinalCTA))
const Footer = dynamic(() => import("@/components/footer").then((m) => m.Footer))

// Fica fechado até o usuário abrir: nunca deve custar no carregamento inicial.
const Chatbot = dynamic(() => import("@/components/chatbot").then((m) => m.Chatbot))

export default function Home() {
  return (
    <SmoothScroll>
      <div className="relative min-h-screen bg-surface-0 overflow-x-hidden">
        {/* Camada fixa ao fundo */}
        <Background />

        {/* Camada de conteúdo que rola */}
        <div className="relative z-10">
          <Navbar />
          <Chatbot />
          <main>
            <Hero />
            <Especialidades />
            <Problem />
            <Solutions />
            <Depoimentos />
            <Planos />
            <FinalCTA />
          </main>
          <Footer />
        </div>
      </div>
    </SmoothScroll>
  )
}

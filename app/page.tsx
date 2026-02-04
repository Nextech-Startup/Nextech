import { SmoothScroll } from "@/components/smooth-scroll"
import { Navbar } from "@/components/navbar"
import { Hero } from "@/components/hero"
import { LogoMarquee } from "@/components/logo-marquee"
import { Problem } from "@/components/problem"
import { Solutions } from "@/components/solutions"
import { Testimonials } from "@/components/testimonials"
import { Pricing } from "@/components/pricing"
import { CalculatorROI } from "@/components/calculatorROI"
import { FinalCTA } from "@/components/final-cta"
import { Footer } from "@/components/footer"
import { Background } from "@/components/background"

export default function Home() {
  return (
    <SmoothScroll>
      {/* relative z-10 no conteúdo para ficar acima do Background */}
      <main className="relative min-h-screen bg-zinc-950 overflow-x-hidden">
        
        {/* Camada fixa ao fundo */}
        <Background />

        {/* Camada de conteúdo que rola */}
        <div className="relative z-10">
          <Navbar />
          <Hero />
          <LogoMarquee />
          <Problem />
          <Solutions />
          <Testimonials />
          <Pricing />
          <CalculatorROI />
          <FinalCTA />
          <Footer />
        </div>
      </main>
    </SmoothScroll>
  )
}
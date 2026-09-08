"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X } from "lucide-react"
import { LiquidMetalButton } from "@/components/ui/liquidMetalButton"
import { useScrollTo } from "@/components/smooth-scroll"
import { ThemeToggle } from "@/components/theme-toggle"
import Image from "next/image"

// 1. Definição correta dos itens com Label e ID
const navItems = [
  { id: "Hero", label: "Início" },
  { id: "Especialidades", label: "Especialidades" },
  { id: "Cenario", label: "Cenário" },
  { id: "Solucoes", label: "Soluções" },
  { id: "Depoimentos", label: "Depoimentos" },
  { id: "Planos", label: "Planos" },
]

// --- Configuração ---
const WHATSAPP_NUMBER = "5581999112895"
const WHATSAPP_MESSAGE =
  "Olá Jhon, tudo bem? Gostaria de agendar uma reunião para conhecer a Nextech."
const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  WHATSAPP_MESSAGE
)}`

export function Navbar() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { scrollToSection: scrollTo } = useScrollTo()

  const scrollToSection = (sectionId: string) => {
    setMobileMenuOpen(false)
    scrollTo(sectionId)
  }

  // Esc fecha o menu: comportamento esperado de qualquer overlay.
  useEffect(() => {
    if (!mobileMenuOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [mobileMenuOpen])

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="fixed top-6 left-1/2 -translate-x-1/2 w-[95vw] z-[100] max-w-6xl"
    >
      <nav
        aria-label="Navegação principal"
        className="relative flex items-center justify-between px-6 py-2 md:px-6 rounded-pill bg-[var(--glass-bg)] backdrop-blur-xl border border-hairline shadow-2xl"
      >
        {/* Botão real: acessível por teclado, ao contrário de uma div com onClick. */}
        <button
          type="button"
          onClick={() => scrollToSection("Hero")}
          aria-label="Nextech — voltar ao início"
          className="cursor-pointer transition-transform hover:scale-105 rounded-pill"
        >
          <Image
            src="/Logo.png"
            alt=""
            width={160}
            height={40}
            className="h-14 w-auto md:h-18"
            priority
            sizes="160px"
          />
        </button>

        {/* Desktop Nav Items */}
        <div className="hidden md:flex items-center gap-1 relative">
          {navItems.map((item, index) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className="relative px-4 py-2 text-sm font-medium text-ink-2 hover:text-ink-1 transition-colors duration-300"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <AnimatePresence>
                {hoveredIndex === index && (
                  <motion.div
                    layoutId="navbar-hover"
                    className="absolute inset-0 bg-[var(--glass-bg)] rounded-pill"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </AnimatePresence>
              <span className="relative z-10">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Botão CTA Principal Desktop */}
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          <LiquidMetalButton label="Agendar reunião" href={whatsappUrl} target="_blank" />
        </div>

        {/* Controles mobile */}
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
        {/* Mobile Menu Button */}
        <button
          type="button"
          className="md:hidden p-2 text-ink-1 hover:bg-[var(--glass-bg)] rounded-pill transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-controls="menu-mobile"
          aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
        >
          {mobileMenuOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
        </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            id="menu-mobile"
            className="absolute top-full left-0 right-0 mt-3 p-4 rounded-panel bg-surface-1/90 backdrop-blur-2xl border border-hairline shadow-2xl md:hidden"
          >
            <div className="flex flex-col gap-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  className="px-4 py-4 text-left text-lg font-medium text-ink-2 hover:text-ink-1 hover:bg-[var(--glass-bg)] rounded-card transition-all"
                  onClick={() => scrollToSection(item.id)}
                >
                  {item.label}
                </button>
              ))}
              <div className="h-px bg-hairline my-4" />
              <div className="flex justify-center">
                <LiquidMetalButton label="Agendar Reunião" href={whatsappUrl} target="_blank" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
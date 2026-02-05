"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LiquidMetalButton } from "@/components/ui/liquidMetalButton"
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

  // 2. Função de Scroll interna para ter acesso ao estado do menu mobile
  const scrollToSection = (sectionId: string) => {
    setMobileMenuOpen(false) // Fecha o menu mobile ao clicar
    const section = document.getElementById(sectionId)
    if (section) {
      const SCROLL_OFFSET = 100 // Ajuste para não cobrir o título da seção
      const sectionTop = section.getBoundingClientRect().top + window.pageYOffset - SCROLL_OFFSET

      window.scrollTo({
        top: sectionTop,
        behavior: "smooth",
      })
    }
  }

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="fixed top-6 left-1/2 -translate-x-1/2 w-[95vw] z-[100] max-w-6xl"
    >
      <nav className="relative flex items-center justify-between px-6 py-2 md:px-6 rounded-full bg-black/20 backdrop-blur-xl border border-white/10 shadow-2xl">

        {/* Logo - Caminho corrigido para a pasta public */}
        <div
          onClick={() => scrollToSection("Hero")}
          className="cursor-pointer transition-transform hover:scale-105"
        >
          <Image
            src="/Logo.png"
            alt="Nextech Logo"
            width={160}
            height={40}
            className="h-14 w-auto md:h-18 cursor-pointer"
            priority
          />
        </div>

        {/* Desktop Nav Items */}
        <div className="hidden md:flex items-center gap-1 relative">
          {navItems.map((item, index) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className="relative px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors duration-300"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <AnimatePresence>
                {hoveredIndex === index && (
                  <motion.div
                    layoutId="navbar-hover"
                    className="absolute inset-0 bg-white/10 rounded-full"
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
        <div className="hidden md:flex items-center">
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            <LiquidMetalButton label="Agendar reunião" />
          </a>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      Aqui está o código atualizado com o LiquidMetalButton no mobile também:
      tsx{/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="absolute top-full left-0 right-0 mt-3 p-4 rounded-[2rem] bg-black/80 backdrop-blur-2xl border border-white/10 shadow-2xl md:hidden"
          >
            <div className="flex flex-col gap-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  className="px-4 py-4 text-left text-lg font-medium text-zinc-300 hover:text-white hover:bg-white/5 rounded-2xl transition-all"
                  onClick={() => scrollToSection(item.id)}
                >
                  {item.label}
                </button>
              ))}
              <div className="h-px bg-white/10 my-4" />
              <div className="flex justify-center">
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <LiquidMetalButton label="Agendar Reunião" />
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
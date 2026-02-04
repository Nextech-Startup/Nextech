"use client"

import { useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LiquidMetalButton } from "@/components/ui/liquidMetalButton"

const navItems = [
  { label: "Serviços", href: "#features" },
  { label: "Sobre", href: "#about" },
  { label: "Docs", href: "#docs" },
  { label: "Blog", href: "#blog" },
]

export function Navbar() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      // Ajustado para garantir centralização perfeita e largura de cápsula
      className="fixed top-6 left-1/2 -translate-x-1/2 z-100 w-[95vw] max-w-4xl"
    >
      <nav className="relative flex items-center justify-between px-2 py-2 md:px-6 md:py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl transition-all duration-300">

        {/* Logo - Estilo Nextech */}
        <a href="/" className="flex items-center gap-2 hover:scale-105 transition-transform px-2">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
            <span className="text-zinc-950 font-bold text-sm">N</span>
          </div>
          <span className="font-bold text-white hidden sm:block tracking-tight">Nextech</span>
        </a>

        {/* Desktop Nav Items com Animação de Hover Fluida */}
        <div className="hidden md:flex items-center gap-1 relative">
          {navItems.map((item, index) => (
            <a
              key={item.label}
              href={item.href}
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
            </a>
          ))}
        </div>

        {/* Botão CTA Principal */}
        <div className="hidden md:flex items-center gap-3">
          <LiquidMetalButton
            label="Agende uma reunião"
            onClick={() => window.open('SEU_LINK_DO_CALENDLY', '_blank')}
          />
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-3 text-white hover:bg-white/10 rounded-full transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {/* Mobile Menu com Estilo Glassmorphism Combinado */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="absolute top-full left-0 right-0 mt-3 p-4 rounded-3xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-2xl md:hidden"
          >
            <div className="flex flex-col gap-2">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="px-4 py-3 text-base font-medium text-zinc-300 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <div className="h-px bg-white/10 my-2" />
              <Button className="w-full bg-white text-zinc-950 hover:bg-zinc-200 rounded-xl py-6 text-base font-bold">
                Agende uma reunião
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
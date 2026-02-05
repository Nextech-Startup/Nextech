"use client"

import { motion, useInView } from "framer-motion"
import { useRef } from "react"
import { Instagram, Linkedin, Mail } from "lucide-react"
import Image from "next/image"

export function Footer() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-50px" })

  // Função de Scroll Suave (Sincronizada com o Navbar)
  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId)
    if (section) {
      const SCROLL_OFFSET = 100
      const sectionTop = section.getBoundingClientRect().top + window.pageYOffset - SCROLL_OFFSET
      window.scrollTo({
        top: sectionTop,
        behavior: "smooth",
      })
    }
  }

  // Links de Produto sincronizados exatamente com o seu Navbar
  const produtoLinks = [
    { id: "Hero", label: "Início" },
    { id: "Especialidades", label: "Especialidades" },
    { id: "Cenario", label: "Cenário" },
    { id: "Calculador", label: "Calculadora de ROI" },
  ]

  const footerLinks = {
    Recursos: ["Documentação", "Estudos de Caso", "Blog", "Suporte 24h"],
    Empresa: ["Sobre nós", "Carreiras", "Parceiros", "Contato"],
    Legal: ["Privacidade", "Termos", "Segurança", "Cookies"],
  }

  const socialLinks = [
    { icon: Instagram, href: "https://www.instagram.com/nextech.ia/", label: "Instagram" },
    { icon: Linkedin, href: "https://www.linkedin.com/in/jhonesbonifaciodasilva/", label: "LinkedIn" },
    { icon: Mail, href: "mailto:nextech.reunioes@gmail.com", label: "Email" },
  ]

  return (
    <footer ref={ref} className="border-t border-white/5 bg-zinc-950 relative overflow-hidden">
      {/* Brilho de fundo sutil */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-125 h-50 bg-emerald-500/5 blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 py-20 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-2 md:grid-cols-6 gap-12 md:gap-8"
        >
          {/* Brand & Status */}
          <div className="col-span-2 space-y-4">
            <div
              onClick={() => scrollToSection("Hero")}
              className="cursor-pointer transition-transform hover:scale-105 inline-block"
            >
              <Image
                src="/Logo.png"
                alt="Nextech Logo"
                width={160}
                height={40}
                className="h-12 w-auto md:h-18 -ml-2"
                priority
              />
            </div>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-60">
              Líder em automação inteligente para clínicas que buscam escala e eficiência no atendimento.
            </p>
          </div>

          {/* Links de Produto (Sync com Navbar) */}
          <div className="col-span-1">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Produto</h4>
            <ul className="space-y-4">
              {produtoLinks.map((link) => (
                <li key={link.id}>
                  <button
                    onClick={() => scrollToSection(link.id)}
                    className="text-sm text-zinc-500 hover:text-emerald-400 transition-colors duration-300 cursor-pointer text-left"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Outros Links Estáticos */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title} className="col-span-1">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-6">{title}</h4>
              <ul className="space-y-4">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm text-zinc-500 hover:text-emerald-400 transition-colors duration-300">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </motion.div>

        {/* Bottom Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-8"
        >
          <div className="flex flex-col items-center md:items-start gap-2">
            <p className="text-xs text-zinc-500">
              &copy; {new Date().getFullYear()} Nextech AI. Todos os direitos reservados.
            </p>
            <p className="text-[10px] text-zinc-600 uppercase tracking-[0.2em] font-bold">
              Desenvolvido por Jhones Silva
            </p>
          </div>

          <div className="flex items-center gap-4">
            {socialLinks.map((social, i) => (
              <a
                key={i}
                href={social.href}
                target={social.icon !== Mail ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all duration-300 group"
                aria-label={social.label}
              >
                <social.icon size={18} className="transition-transform group-hover:scale-110" />
              </a>
            ))}
            </div>
        </motion.div>
      </div>
    </footer>
  )
}
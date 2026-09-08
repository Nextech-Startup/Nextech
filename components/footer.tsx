"use client"

import { motion, useInView } from "framer-motion"
import { useRef } from "react"
import { Instagram, Linkedin, Mail } from "lucide-react"
import Image from "next/image"
import { useScrollTo } from "@/components/smooth-scroll"

export function Footer() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-50px" })
  const { scrollToSection } = useScrollTo()

  // Sincronizado com o Navbar. A calculadora de ROI saiu da página,
  // então o link para ela foi removido em vez de apontar para o vazio.
  const produtoLinks = [
    { id: "Hero", label: "Início" },
    { id: "Especialidades", label: "Especialidades" },
    { id: "Cenario", label: "Cenário" },
    { id: "Solucoes", label: "Soluções" },
    { id: "Depoimentos", label: "Depoimentos" },
    { id: "Planos", label: "Planos" },
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
    <footer ref={ref} className="border-t border-hairline bg-surface-0 relative overflow-hidden">
      {/* Brilho de fundo sutil */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-125 h-50 bg-accent/5 blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 py-20 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-2 md:grid-cols-6 gap-12 md:gap-8"
        >
          {/* Brand & Status */}
          <div className="col-span-2 space-y-4">
            <button
              type="button"
              onClick={() => scrollToSection("Hero")}
              aria-label="Nextech — voltar ao início"
              className="cursor-pointer transition-transform hover:scale-105 inline-block rounded-pill"
            >
              {/* Sem priority: o rodapé nunca é o LCP e isso competiria
                  com o carregamento do topo da página. */}
              <Image
                src="/Logo.png"
                alt=""
                width={160}
                height={40}
                className="h-14 w-auto md:h-18"
                sizes="160px"
              />
            </button>
            <p className="text-ink-2 text-sm leading-relaxed max-w-60">
              Líder em automação inteligente para clínicas que buscam escala e eficiência no atendimento.
            </p>
          </div>

          {/* Links de Produto (Sync com Navbar) */}
          <div className="col-span-1">
            <h4 className="text-sm font-semibold text-ink-1 mb-6">Produto</h4>
            <ul className="space-y-4">
              {produtoLinks.map((link) => (
                <li key={link.id}>
                  <button
                    onClick={() => scrollToSection(link.id)}
                    className="text-sm text-ink-3 hover:text-accent transition-colors duration-300 cursor-pointer text-left"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Páginas ainda não publicadas: rótulos inertes em vez de href="#",
              que criaria links mortos para o usuário e para os buscadores. */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title} className="col-span-1">
              <h4 className="text-sm font-semibold text-ink-1 mb-6">{title}</h4>
              <ul className="space-y-4">
                {links.map((link) => (
                  <li key={link}>
                    <span className="text-sm text-ink-3 cursor-default" title="Em breve">
                      {link}
                    </span>
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
          className="mt-20 pt-8 border-t border-hairline flex flex-col md:flex-row items-center justify-between gap-8"
        >
          <div className="flex flex-col items-center md:items-start gap-2">
            <p className="text-xs text-ink-3">
              &copy; {new Date().getFullYear()} Nextech AI. Todos os direitos reservados.
            </p>
            <p className="text-xs text-ink-3">
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
                className="w-10 h-10 rounded-pill bg-[var(--glass-bg)] border border-hairline flex items-center justify-center text-ink-2 hover:text-ink-1 hover:bg-[var(--glass-bg)] transition-all duration-300 group"
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
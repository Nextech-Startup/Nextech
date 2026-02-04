"use client"

import { motion, useInView } from "framer-motion"
import { useRef } from "react"
import { Instagram, Linkedin, Twitter} from "lucide-react"

const footerLinks = {
  Produto: ["Funcionalidades", "Soluções", "Calculadora ROI", "Integrações"],
  Recursos: ["Documentação", "Estudos de Caso", "Blog", "Suporte 24h"],
  Empresa: ["Sobre nós", "Carreiras", "Parceiros", "Contato"],
  Legal: ["Privacidade", "Termos", "Segurança", "Cookies"],
}

export function Footer() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-50px" })

  return (
    <footer ref={ref} className="border-t border-white/5 bg-zinc-950 relative overflow-hidden">
      {/* Brilho de fundo sutil para o rodapé */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-125 h-50 bg-emerald-500/5 blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 py-20 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-2 md:grid-cols-6 gap-12 md:gap-8"
        >
          {/* Brand & Status */}
          <div className="col-span-2 space-y-6">
            <a href="#" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center transition-transform group-hover:rotate-12">
                <span className="text-zinc-950 font-bold text-sm">N</span>
              </div>
              <span className="text-2xl font-bold text-white tracking-tighter">Nextech</span>
            </a>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-60">
              Líder em automação inteligente para clínicas que buscam escala e eficiência no atendimento.
            </p>
            
            {/* System Status - Estilo Premium */}
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Sistemas Operacionais</span>
            </div>
          </div>

          {/* Links Mapeados */}
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
              &copy; {new Date().getFullYear()} Nextech AI Solutions. Todos os direitos reservados.
            </p>
            <p className="text-[10px] text-zinc-600 uppercase tracking-[0.2em] font-bold">
              Desenvolvido por Jhones Silva
            </p>
          </div>

          {/* Social Links */}
          <div className="flex items-center gap-4">
            {[
              { icon: Instagram, href: "#" },
              { icon: Linkedin, href: "#" },
              { icon: Twitter, href: "#" }
            ].map((social, i) => (
              <a 
                key={i} 
                href={social.href} 
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300"
              >
                <social.icon size={18} />
              </a>
            ))}
          </div>
        </motion.div>
      </div>
    </footer>
  )
}
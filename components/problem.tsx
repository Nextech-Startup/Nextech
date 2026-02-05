"use client"

import { motion, useInView } from "framer-motion"
import { useRef } from "react"
import {
    CheckCircle2,
    XCircle,
    Zap,
    MessageSquareOff,
    Clock,
    Moon,
    Users2,
    ArrowRight
} from "lucide-react"
import { Button } from "@/components/ui/button"

// --- Configuração WhatsApp ---
const WHATSAPP_NUMBER = "5581999112895"
const WHATSAPP_MESSAGE =
  "Olá Jhon, tudo bem? Cansei de perder reuniões, preciso da sua solução com urgência."
const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  WHATSAPP_MESSAGE
)}`

export function Problem() {
    const sectionRef = useRef<HTMLElement>(null)
    const isInView = useInView(sectionRef, { once: true, margin: "-100px" })

    return (
        <section
            id="Cenario"
            ref={sectionRef}
            className="relative py-24 px-4">
            <div className="max-w-6xl mx-auto">

                {/* Badge Centralizado */}
                <div className="flex justify-center mb-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-md border border-white/10"
                    >
                        <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                        <span className="text-sm text-zinc-400 font-medium">O Cenário</span>
                    </motion.div>
                </div>

                {/* Cabeçalho */}
                <div className="text-center mb-16">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-4xl md:text-5xl font-bold text-white mb-6"
                    >
                        Sua clínica está perdendo pacientes todos os dias
                    </motion.h2>
                    <p className="text-zinc-400 text-lg max-w-2xl mx-auto leading-relaxed">
                        O WhatsApp sobrecarregado está custando consultas e receita.
                        Você pode continuar no caos ou escolher a eficiência da Nextech.
                    </p>
                </div>

                {/* Grid de Comparação - Cards Transparentes (Estilo Navbar) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">

                    {/* CARD DO PROBLEMA */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="relative p-8 md:p-10 rounded-[2.5rem] bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-6 opacity-5">
                            <XCircle size={120} className="text-red-500" />
                        </div>

                        <div className="relative z-10">
                            <span className="text-red-500 font-bold tracking-tighter text-sm">O Problema</span>
                            <h3 className="text-3xl font-bold text-white mt-2 mb-8">A sua operação atual</h3>

                            <ul className="space-y-6">
                                <li className="flex gap-4">
                                    <MessageSquareOff className="text-red-500 shrink-0" />
                                    <div>
                                        <p className="text-white font-semibold">Mensagens perdidas no WhatsApp</p>
                                        <p className="text-zinc-400 text-sm">Pacientes sem resposta e oportunidades que desaparecem.</p>
                                    </div>
                                </li>
                                <li className="flex gap-4">
                                    <Clock className="text-red-500 shrink-0" />
                                    <div>
                                        <p className="text-white font-semibold">Tempo de resposta lento</p>
                                        <p className="text-zinc-400 text-sm">O paciente já agendou no concorrente antes de você responder.</p>
                                    </div>
                                </li>
                                <li className="flex gap-4">
                                    <Moon className="text-red-500 shrink-0" />
                                    <div>
                                        <p className="text-white font-semibold">Perda de pacientes fora do horário</p>
                                        <p className="text-zinc-400 text-sm">50% das consultas vêm à noite e sua equipe não está lá.</p>
                                    </div>
                                </li>
                                <li className="flex gap-4">
                                    <Users2 className="text-red-500 shrink-0" />
                                    <div>
                                        <p className="text-white font-semibold">Recepção sobrecarregada</p>
                                        <p className="text-zinc-400 text-sm">Horas respondendo as mesmas dúvidas em vez de focar no cuidado.</p>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </motion.div>

                    {/* CARD DA SOLUÇÃO (NEXTECH) */}
                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="relative p-8 md:p-10 rounded-[2.5rem] bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-6 opacity-10">
                            <Zap size={120} className="text-emerald-500" />
                        </div>

                        <div className="relative z-10">
                            <span className="text-emerald-400 font-bold tracking-tighter text-sm">A Evolução</span>
                            <h3 className="text-3xl font-bold text-white mt-2 mb-8">Nossa soluções</h3>

                            <ul className="space-y-6">
                                <li className="flex gap-4">
                                    <CheckCircle2 className="text-emerald-400 shrink-0" />
                                    <div>
                                        <p className="text-white font-semibold">Atendimento 24/7 Instantâneo</p>
                                        <p className="text-zinc-400 text-sm">IA responde em segundos e agenda enquanto você dorme.</p>
                                    </div>
                                </li>
                                <li className="flex gap-4">
                                    <CheckCircle2 className="text-emerald-400 shrink-0" />
                                    <div>
                                        <p className="text-white font-semibold">Qualificação Inteligente</p>
                                        <p className="text-zinc-400 text-sm">Triagem automática para agendar quem realmente tem interesse.</p>
                                    </div>
                                </li>
                                <li className="flex gap-4">
                                    <CheckCircle2 className="text-emerald-400 shrink-0" />
                                    <div>
                                        <p className="text-white font-semibold">Integração Total CRM/Pipedrive</p>
                                        <p className="text-zinc-400 text-sm">Sincronização automática com sua gestão e calendários.</p>
                                    </div>
                                </li>
                                <li className="flex gap-4">
                                    <CheckCircle2 className="text-emerald-400 shrink-0" />
                                    <div>
                                        <p className="text-white font-semibold">Presença Omnichannel</p>
                                        <p className="text-zinc-400 text-sm">Uma única inteligência no Site, WhatsApp e Instagram.</p>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </motion.div>
                </div>

                {/* SEÇÃO DE AUDITORIA - CTA FINAL (Estilo Hero) */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mt-20 relative p-px rounded-[2.5rem] bg-linear-to-b from-white/20 to-transparent"
                >
                    <div className="bg-white/5 backdrop-blur-md rounded-[2.5rem] p-8 md:p-16 text-center border border-white/10 shadow-2xl">
                        <div className="max-w-3xl mx-auto">
                            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                                Pare de perder pacientes hoje mesmo
                            </h2>
                            <p className="text-zinc-400 text-lg mb-10 leading-relaxed">
                                Receba uma call gratuita da nossa equipe agora e pare de perder tempo. Veja ainda hoje exatamente quantos leads você está deixando escapar na sua empresa.
                            </p>

                            <div className="flex justify-center">
                                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                                    <Button
                                        size="lg"
                                        className="bg-white text-zinc-950 hover:bg-white rounded-full px-10 h-13 text-base font-bold transition-all duration-300 hover:scale-105 hover:shadow-[0_0_25px_rgba(96,117,133,0.6)] active:scale-95 cursor-pointer"
                                    >
                                        Reunião Gratuita
                                        <ArrowRight className="w-5 h-5" />
                                    </Button>
                                </a>
                            </div>

                            <p className="text-[10px] text-zinc-500 mt-8 uppercase tracking-[0.2em] font-bold">
                                Análise em tempo real • 100% Gratuito
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}
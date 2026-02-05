"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    MessageCircle, Zap, CalendarCheck,
    Mail, Share2, CheckCircle2, Mic
} from "lucide-react"

// Dados das Conversas para o Mockup de Celular
const conversations = [
    {
        title: "Agendamento de Consulta e Dúvidas",
        messages: [
            { text: "Olá! Tenho interesse em marcar uma consulta. Vocês têm horário?", sender: "customer" },
            { text: "Olá! Temos horários disponíveis para esta semana. Você prefere manhã ou tarde?", sender: "ai" },
            { text: "Prefiro à tarde, por volta das 15h. Qual o valor da consulta?", sender: "customer" },
            { text: "A consulta particular é R$ 450, mas aceitamos diversos convênios. Quer que eu verifique o seu e agende para quinta às 15h?", sender: "ai" },
            { text: "Sim, perfeito! Pode agendar.", sender: "customer" },
            { text: "Agendamento confirmado! Você receberá um lembrete por SMS. Mais algo em que possa ajudar?", sender: "ai" },
        ],
    },
]

export function Solutions() {
    const [isVisible, setIsVisible] = useState(false)
    const [currentMsgIndex, setCurrentMsgIndex] = useState(0)
    const [displayedMessages, setDisplayedMessages] = useState<any[]>([])
    const sectionRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) setIsVisible(true)
        }, { threshold: 0.1 })
        if (sectionRef.current) observer.observe(sectionRef.current)
        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        if (!isVisible) return
        const messages = conversations[0].messages
        if (currentMsgIndex < messages.length) {
            const timer = setTimeout(() => {
                setDisplayedMessages(prev => [...prev, messages[currentMsgIndex]])
                setCurrentMsgIndex(prev => prev + 1)
            }, 1500)
            return () => clearTimeout(timer)
        }
    }, [currentMsgIndex, isVisible])

    return (
        <section id="Solucoes" ref={sectionRef} className="py-24 bg-transparent relative z-10">

            {/* CONTAINER BRANCO PRINCIPAL */}
            <div className="bg-white rounded-[3rem] shadow-[0_20px_80px_-20px_rgba(0,0,0,0.15)] border border-slate-200 overflow-hidden">
                <div className="max-w-7xl mx-auto px-6 py-16 md:py-24 relative">

                    {/* HEADER DA SEÇÃO */}
                    <div className="text-center max-w-3xl mx-auto mb-20">
                        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-widest mb-6">
                            <span className="w-2 h-2 rounded-full bg-blue-700 animate-pulse" />
                            Nossa solução
                        </motion.div>
                        <h2 className="text-4xl md:text-6xl font-bold text-black mb-6 tracking-tight">
                            Seu Time de IA <br /> <span className="text-blue-600">Nunca Para de Vender.</span>
                        </h2>
                    </div>

                    {/* GRID SUPERIOR: 6 CARDS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">

                        {/* 1. Atendimento via WhatsApp 24/7 */}
                        <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200 group hover:shadow-xl transition-all">
                            <div className="flex justify-between items-start mb-6">
                                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                                    <MessageCircle className="text-white" />
                                </div>
                                <span className="text-xs font-bold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">24/7 Online</span>
                            </div>
                            <h3 className="text-xl font-bold text-black mb-3">Atendimento via WhatsApp 24/7</h3>
                            <p className="text-sm text-slate-600">Chatbots inteligentes que respondem dúvidas e capturam leads no seu site e redes sociais.</p>
                        </div>

                        {/* 2. Processamento de Áudio IA */}
                        <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200 group hover:shadow-xl transition-all">
                            <div className="flex justify-between items-start mb-6">
                                <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                                    <Mic className="text-white" />
                                </div>
                                <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full">Voz & Áudio</span>
                            </div>
                            <h3 className="text-xl font-bold text-black mb-3">Assistente que Entende Áudios</h3>
                            <p className="text-sm text-slate-600">IA capaz de processar mensagens de voz dos pacientes, transcrever e responder com naturalidade.</p>
                        </div>

                        {/* 3. Agendamento Inteligente */}
                        <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200 group hover:shadow-xl transition-all">
                            <div className="flex justify-between items-start mb-6">
                                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                                    <CalendarCheck className="text-white" />
                                </div>
                                <span className="text-xs font-bold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">Automático</span>
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-black">Agendamento Inteligente</h3>
                            <p className="text-sm text-slate-600 mb-4">Checa disponibilidade e confirma horários sem intervenção humana.</p>
                            <div className="text-xs font-medium text-black flex items-center gap-2">
                                <CheckCircle2 size={14} className="text-emerald-600" /> Agendamento confirmado para dia 15, às 14h.
                            </div>
                        </div>

                        {/* 4. Automação de E-mails */}
                        <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200 group hover:shadow-xl transition-all">
                            <div className="flex justify-between items-start mb-6">
                                <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                                    <Mail className="text-white" />
                                </div>
                                <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full">Notificações</span>
                            </div>
                            <h3 className="text-xl font-bold text-black mb-3">Automação de E-mails</h3>
                            <div className="space-y-2">
                                <div className="p-2 bg-white rounded-lg border border-slate-200 text-[10px] font-bold text-black flex justify-between items-center">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-blue-600 uppercase">Para: Paciente</span>
                                        Confirmação de Agendamento
                                    </div>
                                    <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[9px]">Enviado ✓</span>
                                </div>
                                <div className="p-2 bg-white rounded-lg border border-slate-200 text-[10px] font-bold text-black flex justify-between items-center">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-indigo-600 uppercase">Para: Médico</span>
                                        Novo Paciente na Agenda
                                    </div>
                                    <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[9px]">Notificado ✓</span>
                                </div>
                            </div>
                        </div>

                        {/* 5. Qualificação de Leads */}
                        <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200 group hover:shadow-xl transition-all">
                            <div className="flex justify-between items-start mb-6">
                                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                                    <Zap className="text-white" />
                                </div>
                                <span className="text-xs font-bold text-blue-600 bg-blue-100 px-3 py-1 rounded-full animate-pulse">Atualizando CRM...</span>
                            </div>
                            <h3 className="text-xl font-bold text-black mb-3">Qualificação e CRM ao Vivo</h3>
                            <div className="space-y-2">
                                <div className="p-2 bg-white rounded-lg border border-blue-200 shadow-sm flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                        <span className="text-[10px] font-bold text-black">Novo Lead Qualificado</span>
                                    </div>
                                </div>
                                <div className="p-3 bg-white/60 rounded-xl border border-dashed border-blue-300">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[9px] font-bold text-slate-500">STATUS DO NEGÓCIO</span>
                                        <span className="text-[9px] font-bold text-blue-600">ETAPA: AGENDADO</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: "30%" }}
                                            animate={{ width: "100%" }}
                                            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                                            className="h-full bg-blue-600"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 6. Integração Multiplataforma */}
                        <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200 group hover:shadow-xl transition-all">
                            <div className="flex justify-between items-start mb-6">
                                <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                                    <Share2 className="text-white" />
                                </div>
                                <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full">6/6 Conectados</span>
                            </div>
                            <h3 className="text-xl font-bold text-black mb-2">Integração Multiplataforma</h3>
                            <p className="text-xs text-slate-500 font-medium mb-4">Todos os sistemas sincronizados</p>
                            <div className="flex flex-wrap gap-2">
                                {['CRM', 'WhatsApp', 'Agenda', 'Email', 'n8n', 'Banco de dados'].map(tool => (
                                    <span key={tool} className="px-3 py-1 bg-white rounded-full text-[10px] font-bold text-black shadow-sm border border-slate-200">
                                        {tool}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                    {/* SEÇÃO DE DEMO: CELULAR */}
                    <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
                        <div className="w-full lg:w-1/2">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold mb-6">
                                Demo do Assistente IA
                            </div>
                            <h3 className="text-3xl md:text-4xl font-bold text-black mb-6 leading-tight">
                                Veja como a IA gerencia <br /> <span className="text-slate-400">interações reais.</span>
                            </h3>
                            <div className="space-y-6 text-slate-600 leading-relaxed">
                                <p>Enquanto sua clínica está fechada, sua assistente responde dúvidas, filtra convênios e agenda consultas 24h por dia.</p>
                                <div className="p-6 bg-slate-50 rounded-2xl border-l-4 border-blue-600 italic text-black">
                                    "Saímos de 70% de mensagens perdidas para 100% de captura de leads. Nossos agendamentos subiram 50%."
                                    <span className="block mt-2 font-bold not-italic text-black text-sm">— Dr. Mike Rodriguez, Cliente Nextech</span>
                                </div>
                            </div>
                        </div>

                        {/* iPhone Mockup */}
                        <div className="w-full lg:w-1/2 flex justify-center">
                            <div className="relative w-77.5 h-160 bg-[#1a1a1a] rounded-[55px] p-2.5 shadow-2xl border border-white/10">
                                <div className="bg-white w-full h-full rounded-[46px] overflow-hidden flex flex-col relative">
                                    <div className="p-4 pt-12 bg-slate-900 text-white flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center font-bold text-sm">M</div>
                                        <div>
                                            <p className="text-xs font-bold">Michael - Agente IA</p>
                                            <p className="text-[10px] text-emerald-400">Online agora</p>
                                        </div>
                                    </div>
                                    <div className="flex-1 p-4 space-y-3 overflow-y-auto bg-slate-50">
                                        <AnimatePresence mode="popLayout">
                                            {displayedMessages.map((msg, i) => (
                                                <motion.div
                                                    key={i}
                                                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    className={`flex ${msg.sender === "customer" ? "justify-end" : "justify-start"}`}
                                                >
                                                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm ${msg.sender === "customer"
                                                        ? "bg-slate-900 text-white rounded-tr-none"
                                                        : "bg-white text-black border border-slate-100 rounded-tl-none"
                                                        }`}>
                                                        {msg.text}
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                    <div className="p-4 bg-white border-t border-slate-100 pb-10">
                                        <div className="flex items-center gap-3 bg-slate-100 rounded-full px-4 py-2">
                                            <span className="text-slate-400 text-[11px] flex-1">Michael está respondendo...</span>
                                            <Zap className="w-3 h-3 text-slate-900" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
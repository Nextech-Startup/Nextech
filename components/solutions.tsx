"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    MessageCircle, Clock, Zap, Phone, Calendar,
    Mail, Users, Share2, CheckCircle2, Bot, Sparkles
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

    // Observer para ativar animações
    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) setIsVisible(true)
        }, { threshold: 0.1 })
        if (sectionRef.current) observer.observe(sectionRef.current)
        return () => observer.disconnect()
    }, [])

    // Lógica do Chat Simulado
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
        <section id="solutions" ref={sectionRef} className="py-24 bg-transparent relative z-10">

            {/* CONTAINER BRANCO PRINCIPAL */}
            <div className="bg-white rounded-[3rem] shadow-[0_20px_80px_-20px_rgba(0,0,0,0.15)] border border-slate-200 overflow-hidden">
                <div className="max-w-7xl mx-auto px-6 py-16 md:py-24 relative">

                    {/* HEADER DA SEÇÃO */}
                    <div className="text-center max-w-3xl mx-auto mb-20">
                        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-widest mb-6">
                            <Zap size={14} className="fill-slate-600" />
                            AI Working 24/7 - Never Miss a Lead
                        </motion.div>
                        <h2 className="text-4xl md:text-6xl font-bold text-slate-900 mb-6 tracking-tight">
                            Seu Time de IA <br /> <span className="text-blue-600">Nunca Dorme.</span>
                        </h2>
                        <p className="text-lg text-slate-600 leading-relaxed">
                            Assista nossa IA gerenciando interações reais 24/7: qualificando leads e agendando consultas automaticamente enquanto você foca no crescimento da sua clínica.
                        </p>
                    </div>

                    {/* GRID SUPERIOR: WIDGETS DE FUNCIONALIDADES */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">

                        {/* Chat Support */}
                        <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200 group hover:shadow-xl transition-all">
                            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-200">
                                <MessageCircle className="text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">24/7 AI Chat Support</h3>
                            <p className="text-sm text-slate-600">Chatbots inteligentes que respondem dúvidas e capturam leads no seu site e redes sociais.</p>
                        </div>

                        {/* Phone Receptionist */}
                        <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200 group hover:shadow-xl transition-all">
                            <div className="flex justify-between items-start mb-6">
                                <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                                    <Phone className="text-white" />
                                </div>
                                <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full animate-pulse">Calls: 17</span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">AI Phone Receptionist</h3>
                            <p className="text-sm text-slate-600">Assistente de voz profissional que atende chamadas e anota recados quando você está ocupado.</p>
                        </div>

                        {/* Smart Booking */}
                        <div className="p-8 rounded-3xl bg-slate-900 text-white group hover:scale-[1.02] transition-all">
                            <Calendar className="w-12 h-12 text-emerald-400 mb-6" />
                            <h3 className="text-xl font-bold mb-3">Smart Appointment Booking</h3>
                            <p className="text-sm text-slate-400 mb-4">Sistema automatizado que checa disponibilidade e confirma horários sem intervenção humana.</p>
                            <div className="text-xs font-medium text-emerald-400 flex items-center gap-2">
                                <CheckCircle2 size={14} /> Agendamento confirmado para dia 15
                            </div>
                        </div>

                        {/* Email Automation */}
                        <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200 lg:col-span-1">
                            <Mail className="w-10 h-10 text-slate-400 mb-6" />
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Email Response Automation</h3>
                            <div className="space-y-2 text-xs font-medium text-slate-500">
                                <div className="p-2 bg-white rounded-lg border border-slate-100">Dúvida sobre serviços</div>
                                <div className="p-2 bg-white rounded-lg border border-slate-100">Solicitação de orçamento</div>
                            </div>
                        </div>

                        {/* Lead Qualification */}
                        <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200 lg:col-span-1">
                            <Users className="w-10 h-10 text-blue-600 mb-6" />
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Lead Qualification</h3>
                            <div className="space-y-3">
                                {[85, 92].map((val, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs font-bold">
                                        <span className="text-slate-400">{i === 0 ? "Sarah M." : "John D."}</span>
                                        <span className="text-blue-600">{val}% ✓</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Multi-Platform */}
                        <div className="p-8 rounded-3xl bg-blue-50 border border-blue-100 lg:col-span-1">
                            <Share2 className="w-10 h-10 text-blue-600 mb-6" />
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Multi-Platform Integration</h3>
                            <p className="text-xs text-blue-600 font-bold mb-4">4/4 Conectados</p>
                            <div className="flex gap-2">
                                {['CRM', 'WhatsApp', 'Calendar'].map(tool => (
                                    <span key={tool} className="px-2 py-1 bg-white rounded-md text-[10px] font-bold shadow-sm border border-blue-100">{tool}</span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* SEÇÃO DE DEMO: CELULAR E TEXTO LADO A LADO */}
                    <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">

                        {/* Texto da Demo */}
                        <div className="w-full lg:w-1/2">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold mb-6">
                                AI Assistant Demo
                            </div>
                            <h3 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6 leading-tight">
                                Veja como a IA gerencia <br /> <span className="text-slate-400">interações reais.</span>
                            </h3>
                            <div className="space-y-6 text-slate-600 leading-relaxed">
                                <p>Enquanto sua clínica está fechada, sua assistente responde dúvidas, filtra convênios e agenda consultas 24h por dia.</p>
                                <p>Cada conversa que você vê acontece no domingo, feriados ou enquanto sua equipe atende outros pacientes.</p>
                                <div className="p-6 bg-slate-50 rounded-2xl border-l-4 border-blue-600 italic">
                                    "Saímos de 70% de mensagens perdidas após o horário para 100% de captura de leads. Nossos agendamentos subiram 50%."
                                    <span className="block mt-2 font-bold not-italic text-slate-900 text-sm">— Dr. Mike Rodriguez, Nextech Clinic Owner</span>
                                </div>
                            </div>
                        </div>

                        {/* iPhone 17 Pro Max Mockup Interativo */}
                        <div className="w-full lg:w-1/2 flex justify-center">
                            <div className="relative group">

                                {/* Brilho de fundo (Glow) */}
                                <div className="absolute -inset-10 bg-blue-500/10 blur-[100px] rounded-full opacity-50 group-hover:opacity-100 transition-opacity duration-1000" />

                                {/* CHASSI DO IPHONE 17 PRO MAX */}
                                <div className="relative w-77.5 h-160 bg-[#1a1a1a] rounded-[55px] p-2.5 shadow-[0_0_0_2px_#333,0_25px_50px_-12px_rgba(0,0,0,0.5)] border border-white/10">

                                    {/* DYNAMIC ISLAND */}
                                    <div className="absolute top-7 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-3xl z-50 flex items-center justify-center">
                                        <div className="w-1.5 h-1.5 bg-blue-500/60 rounded-full animate-pulse mr-2" />
                                        <div className="w-8 h-1 bg-white/10 rounded-full" />
                                    </div>

                                    {/* TELA SUPER RETINA */}
                                    <div className="bg-white w-full h-full rounded-[46px] overflow-hidden flex flex-col border border-black/5 relative">

                                        {/* Header do Chat - Estilo iOS */}
                                        <div className="p-4 pt-12 bg-slate-900 text-white flex items-center gap-3 shadow-lg">
                                            <div className="w-9 h-9 rounded-full bg-linear-to-tr from-blue-600 to-indigo-400 flex items-center justify-center font-bold text-sm shadow-md">
                                                M
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold">Michael - AI Agent</p>
                                                <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> Online
                                                </p>
                                            </div>
                                        </div>

                                        {/* ÁREA DE MENSAGENS (Usando sua lógica original) */}
                                        <div className="flex-1 p-4 space-y-3 overflow-y-auto scrollbar-hide text-[13px] bg-slate-50">
                                            <AnimatePresence mode="popLayout">
                                                {displayedMessages.map((msg, i) => (
                                                    <motion.div
                                                        key={i}
                                                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        className={`flex ${msg.sender === "customer" ? "justify-end" : "justify-start"}`}
                                                    >
                                                        <div className={`max-w-[80%] p-3 rounded-2xl shadow-sm ${msg.sender === "customer"
                                                            ? "bg-slate-900 text-white rounded-tr-none"
                                                            : "bg-white text-slate-800 border border-slate-100 rounded-tl-none"
                                                            }`}>
                                                            {msg.text}
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </AnimatePresence>
                                        </div>

                                        {/* Footer com indicação de digitação */}
                                        <div className="p-4 bg-white border-t border-slate-100 pb-10">
                                            <div className="flex items-center gap-3 bg-slate-100 rounded-full px-4 py-2 border border-slate-200">
                                                <span className="text-slate-400 text-[11px] flex-1 italic">Michael está respondendo...</span>
                                                <div className="w-6 h-6 bg-slate-900 rounded-full flex items-center justify-center">
                                                    <Zap className="w-3 h-3 text-white fill-white" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Home Indicator (Barra do iPhone) */}
                                        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-28 h-1 bg-slate-300 rounded-full" />
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
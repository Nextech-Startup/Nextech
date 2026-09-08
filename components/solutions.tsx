"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    MessageCircle, Zap, CalendarCheck,
    Mail, Share2, CheckCircle2, Mic,
    MoreVertical, Phone, Video, ChevronLeft,
    Paperclip, Camera, Smile, CheckCheck
} from "lucide-react"

const conversations = [
    {
        title: "Clínica Olimphia",
        messages: [
            { text: "Boa noite! Seja muito bem-vindo(a) à Clínica Olimphia 😊 Como posso te ajudar hoje?", sender: "ai", time: "19:02" },
            { text: "Oi! Quero agendar uma consulta", sender: "customer", time: "19:02" },
            { text: "Claro! Qual seu nome? 😊", sender: "ai", time: "19:02" },
            { text: "Mariana Silva", sender: "customer", time: "19:03" },
            { text: "Prazer, Mariana! O que você precisa hoje?", sender: "ai", time: "19:03" },
            { text: "Limpeza dental", sender: "customer", time: "19:04" },
            { text: "Ótimo! Está sentindo dor ou desconforto? 🦷", sender: "ai", time: "19:04" },
            { text: "Não, é só rotina mesmo", sender: "customer", time: "19:05" },
            { text: "Perfeito! Qual dia prefere? Temos horários de segunda a sexta 😊", sender: "ai", time: "19:05" },
            { text: "Pode ser quarta-feira", sender: "customer", time: "19:06" },
            { text: "Manhã ou tarde?", sender: "ai", time: "19:06" },
            { text: "Manhã!", sender: "customer", time: "19:06" },
            { text: "Temos disponível às 9h ou 11h. Qual prefere? 😊", sender: "ai", time: "19:07" },
            { text: "9h tá ótimo!", sender: "customer", time: "19:07" },
            { text: "Qual seu e-mail para enviarmos a confirmação? 📧", sender: "ai", time: "19:07" },
            { text: "mariana.silva@email.com", sender: "customer", time: "19:08" },
            { text: "Mariana, confirma os dados?\n\n👤 Mariana Silva\n🦷 Limpeza dental\n📅 Quarta, 12/02 às 9h\n📧 mariana.silva@email.com\n\nEstá tudo certo? 😊", sender: "ai", time: "19:08" },
            { text: "Tudo certo, confirmo!", sender: "customer", time: "19:09" },
            { text: "Pronto! ✅ Agendado com sucesso!\n\n📅 Quarta, 12/02 às 9h\n🦷 Limpeza dental\n📍 Rua Mato Grosso, 790 - Centro, Goiânia/GO\n\nEnviamos a confirmação para mariana.silva@email.com 📧\n\nAté lá, Mariana! 😊", sender: "ai", time: "19:09" },
        ],
    },
]

const TypingIndicator = () => (
    <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className="flex justify-start"
    >
        <div className="bg-white px-4 py-2.5 rounded-[8px] shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] max-w-[80px]">
            <div className="flex gap-[3px] items-center h-4">
                <motion.span className="w-[6px] h-[6px] rounded-full bg-[#8696a0]"
                    animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
                <motion.span className="w-[6px] h-[6px] rounded-full bg-[#8696a0]"
                    animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }} />
                <motion.span className="w-[6px] h-[6px] rounded-full bg-[#8696a0]"
                    animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }} />
            </div>
        </div>
    </motion.div>
)

export function Solutions() {
    const [isVisible, setIsVisible] = useState(false)
    const [currentMsgIndex, setCurrentMsgIndex] = useState(0)
    const [displayedMessages, setDisplayedMessages] = useState<any[]>([])
    const [isTyping, setIsTyping] = useState(false)
    const [currentTime, setCurrentTime] = useState("19:00")
    const sectionRef = useRef<HTMLElement>(null)
    const chatBodyRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const updateTime = () => {
            const now = new Date()
            setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
        }
        updateTime()
        const timer = setInterval(updateTime, 60000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) setIsVisible(true)
        }, { threshold: 0.1 })
        if (sectionRef.current) observer.observe(sectionRef.current)
        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        if (chatBodyRef.current) {
            chatBodyRef.current.scrollTo({ top: chatBodyRef.current.scrollHeight, behavior: 'smooth' })
        }
    }, [displayedMessages, isTyping])

    useEffect(() => {
        if (!isVisible) return
        const messages = conversations[0].messages
        if (currentMsgIndex < messages.length) {
            const nextMsg = messages[currentMsgIndex]
            const isAiMessage = nextMsg.sender === "ai"
            if (isAiMessage) {
                setIsTyping(true)
                const typingDuration = Math.min(1200 + nextMsg.text.length * 10, 2500)
                const typingTimer = setTimeout(() => {
                    setIsTyping(false)
                    setDisplayedMessages(prev => [...prev, nextMsg])
                    setCurrentMsgIndex(prev => prev + 1)
                }, typingDuration)
                return () => clearTimeout(typingTimer)
            } else {
                const timer = setTimeout(() => {
                    setDisplayedMessages(prev => [...prev, nextMsg])
                    setCurrentMsgIndex(prev => prev + 1)
                }, 1500)
                return () => clearTimeout(timer)
            }
        }
    }, [currentMsgIndex, isVisible])

    const formatWhatsAppText = (text: string) => {
        const parts = text.split(/(\*[^*]+\*)/g)
        return parts.map((part, i) => {
            if (part.startsWith('*') && part.endsWith('*')) {
                return <strong key={i} className="font-semibold">{part.slice(1, -1)}</strong>
            }
            return <span key={i}>{part}</span>
        })
    }

    return (
        <>
            <style jsx global>{`
                .whatsapp-scrollbar::-webkit-scrollbar {
                    width: 3px;
                }
                .whatsapp-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .whatsapp-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(0, 0, 0, 0.15);
                    border-radius: 3px;
                }
                .whatsapp-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(0, 0, 0, 0.25);
                }
                .whatsapp-scrollbar {
                    scrollbar-width: thin;
                    scrollbar-color: rgba(0, 0, 0, 0.15) transparent;
                }
            `}</style>

            <section id="Solucoes" ref={sectionRef} className="py-24 bg-transparent relative z-10">

                {/* CONTAINER BRANCO PRINCIPAL */}
                <div className="bg-[oklch(0.97_0.004_165)] rounded-panel shadow-[0_20px_80px_-20px_rgba(0,0,0,0.12)] border border-[oklch(0.90_0.005_165)] overflow-hidden">
                    <div className="max-w-7xl mx-auto px-6 py-16 md:py-24 relative">

                        {/* HEADER DA SEÇÃO */}
                        <div className="text-center max-w-3xl mx-auto mb-20">
                            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/70 border border-[oklch(0.90_0.005_165)] text-[oklch(0.45_0.01_165)] text-xs font-bold uppercase tracking-widest mb-6">
                                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                                Nossa solução
                            </motion.div>
                            <h2 className="font-display text-4xl md:text-6xl text-black mb-6 tracking-tight">
                                Seu Time de IA <br /> <span className="text-accent-on-light">Nunca Para de Vender.</span>
                            </h2>
                        </div>

                        {/* GRID DE 6 CARDS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
                            {/* 1. Atendimento via WhatsApp 24/7 */}
                            <div className="p-8 rounded-card bg-white/70 border border-[oklch(0.90_0.005_165)] group hover:shadow-xl transition-all">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="w-12 h-12 bg-accent rounded-card flex items-center justify-center shadow-lg shadow-accent/20">
                                        <MessageCircle className="text-white" />
                                    </div>
                                    <span className="text-xs font-bold text-accent-on-light bg-accent/10 px-3 py-1 rounded-full">24/7 Online</span>
                                </div>
                                <h3 className="text-xl font-bold text-black mb-3">Atendimento via WhatsApp 24/7</h3>
                                <p className="text-sm text-[oklch(0.45_0.01_165)]">Assistentes inteligentes que respondem dúvidas e qualificam seus pacientes todos os dias, em qualquer horário.</p>
                            </div>

                            {/* 2. Processamento de Áudio IA */}
                            <div className="p-8 rounded-card bg-white/70 border border-[oklch(0.90_0.005_165)] group hover:shadow-xl transition-all">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="w-12 h-12 bg-accent rounded-card flex items-center justify-center shadow-lg shadow-accent/20">
                                        <Mic className="text-white" />
                                    </div>
                                    <span className="text-xs font-bold text-accent-on-light bg-accent/10 px-3 py-1 rounded-full">Voz & Áudio</span>
                                </div>
                                <h3 className="text-xl font-bold text-black mb-3">Assistente que Entende Áudios</h3>
                                <p className="text-sm text-[oklch(0.45_0.01_165)]">IA capaz de processar mensagens de voz dos pacientes, transcrever e responder com naturalidade.</p>
                            </div>

                            {/* 3. Agendamento Inteligente */}
                            <div className="p-8 rounded-card bg-white/70 border border-[oklch(0.90_0.005_165)] group hover:shadow-xl transition-all">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="w-12 h-12 bg-accent rounded-card flex items-center justify-center shadow-lg shadow-accent/20">
                                        <CalendarCheck className="text-white" />
                                    </div>
                                    <span className="text-xs font-bold text-accent-on-light bg-accent/10 px-3 py-1 rounded-full">Automático</span>
                                </div>
                                <h3 className="text-xl font-bold mb-3 text-black">Agendamento Inteligente</h3>
                                <p className="text-sm text-[oklch(0.45_0.01_165)] mb-4">Checa disponibilidade e confirma horários sem intervenção humana.</p>
                                <div className="text-xs font-medium text-black flex items-center gap-2">
                                    <CheckCircle2 size={14} className="text-accent-on-light" /> Agendamento confirmado para dia 15, às 14h.
                                </div>
                            </div>

                            {/* 4. Automação de E-mails */}
                            <div className="p-8 rounded-card bg-white/70 border border-[oklch(0.90_0.005_165)] group hover:shadow-xl transition-all">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="w-12 h-12 bg-accent rounded-card flex items-center justify-center shadow-lg shadow-accent/20">
                                        <Mail className="text-white" />
                                    </div>
                                    <span className="text-xs font-bold text-accent-on-light bg-accent/10 px-3 py-1 rounded-full">Notificações</span>
                                </div>
                                <h3 className="text-xl font-bold text-black mb-3">Automação de E-mails</h3>
                                <div className="space-y-2">
                                    <div className="p-2 bg-white rounded-lg border border-[oklch(0.90_0.005_165)] text-[10px] font-bold text-black flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-accent-on-light uppercase">Para: Paciente</span>
                                            Confirmação de Agendamento
                                        </div>
                                        <span className="bg-accent/10 text-accent-on-light px-2 py-0.5 rounded text-[9px]">Enviado ✓</span>
                                    </div>
                                    <div className="p-2 bg-white rounded-lg border border-[oklch(0.90_0.005_165)] text-[10px] font-bold text-black flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-accent-on-light uppercase">Para: Médico</span>
                                            Novo Paciente na Agenda
                                        </div>
                                        <span className="bg-accent/10 text-accent-on-light px-2 py-0.5 rounded text-[9px]">Notificado ✓</span>
                                    </div>
                                </div>
                            </div>

                            {/* 5. Qualificação de Pacientes */}
                            <div className="p-8 rounded-card bg-white/70 border border-[oklch(0.90_0.005_165)] group hover:shadow-xl transition-all">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="w-12 h-12 bg-accent rounded-card flex items-center justify-center shadow-lg shadow-accent/20">
                                        <Zap className="text-white" />
                                    </div>
                                    <span className="text-xs font-bold text-accent-on-light bg-accent/10 px-3 py-1 rounded-full animate-pulse">Atualizando CRM...</span>
                                </div>
                                <h3 className="text-xl font-bold text-black mb-3">Qualificação e CRM ao Vivo</h3>
                                <div className="space-y-2">
                                    <div className="p-2 bg-white rounded-lg border border-accent/25 shadow-sm flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-accent/100"></div>
                                            <span className="text-[10px] font-bold text-black">Novo Paciente Qualificado</span>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-white/60 rounded-xl border border-dashed border-accent/30">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[9px] font-bold text-[oklch(0.55_0.01_165)]">STATUS DO NEGÓCIO</span>
                                            <span className="text-[9px] font-bold text-accent-on-light">ETAPA: AGENDADO</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: "30%" }}
                                                animate={{ width: "100%" }}
                                                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                                                className="h-full bg-accent"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 6. Integração Multiplataforma */}
                            <div className="p-8 rounded-card bg-white/70 border border-[oklch(0.90_0.005_165)] group hover:shadow-xl transition-all">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="w-12 h-12 bg-accent rounded-card flex items-center justify-center shadow-lg shadow-accent/20">
                                        <Share2 className="text-white" />
                                    </div>
                                    <span className="text-xs font-bold text-accent-on-light bg-accent/10 px-3 py-1 rounded-full">6/6 Conectados</span>
                                </div>
                                <h3 className="text-xl font-bold text-black mb-2">Integração Multiplataforma</h3>
                                <p className="text-xs text-[oklch(0.55_0.01_165)] font-medium mb-4">Todos os sistemas sincronizados</p>
                                <div className="flex flex-wrap gap-2">
                                    {['CRM', 'WhatsApp', 'Agenda', 'Email', 'n8n', 'Banco de dados'].map(tool => (
                                        <span key={tool} className="px-3 py-1 bg-white rounded-full text-[10px] font-bold text-black shadow-sm border border-[oklch(0.90_0.005_165)]">
                                            {tool}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* SEÇÃO DE DEMO: CELULAR */}
                        <div id="demo-celular" className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
                            <div className="w-full lg:w-1/2">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent-on-light text-xs font-bold mb-6">
                                    Demo do Assistente IA
                                </div>
                                <h3 className="text-3xl md:text-4xl font-bold text-black mb-6 leading-tight">
                                    Veja como a IA gerencia <br /> <span className="text-[oklch(0.62_0.01_165)]">interações reais.</span>
                                </h3>
                                <div className="space-y-6 text-[oklch(0.45_0.01_165)] leading-relaxed">
                                    <p>Enquanto sua clínica está fechada, sua assistente responde dúvidas, filtra convênios e agenda consultas 24h por dia.</p>
                                    <div className="p-6 bg-slate-50 rounded-card border-l-4 border-accent italic text-black">
                                        "Saímos de 45% de mensagens perdidas, para 100% de contato com nossos pacientes. Nossos agendamentos subiram 50%."
                                        <span className="block mt-2 font-bold not-italic text-black text-sm">— Dr. Arthur Moura, Cliente Nextech</span>
                                    </div>
                                </div>
                            </div>

                            {/* ====== IPHONE MOCKUP ====== */}
                            <div className="w-full lg:w-1/2 flex justify-center">
                                <div className="relative">
                                    {/* Glow */}
                                    <div className="absolute -inset-12 bg-gradient-to-b from-emerald-400/8 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />

                                    {/* CAMADA 1: Carcaça Titanium Natural */}
                                    <div
                                        className="relative w-[320px] h-[660px] rounded-[52px]"
                                        style={{
                                            background: 'linear-gradient(165deg, #b5b0a8 0%, #9e9a93 20%, #8a8580 50%, #9e9a93 80%, #b5b0a8 100%)',
                                            boxShadow: `
                                                0 50px 100px -20px rgba(0,0,0,0.4),
                                                0 25px 50px -15px rgba(0,0,0,0.2),
                                                0 0 0 0.5px rgba(0,0,0,0.15),
                                                inset 0 1px 0 rgba(255,255,255,0.35),
                                                inset 0 -1px 0 rgba(0,0,0,0.1)
                                            `,
                                        }}
                                    >
                                        {/* Reflexo metálico */}
                                        <div className="absolute inset-0 rounded-[52px] pointer-events-none"
                                            style={{ background: '#FFA266' }}
                                        />

                                        {/* Botões laterais */}
                                        <div className="absolute -left-[2px] top-[105px] w-[3px] h-[22px] rounded-l-sm" style={{ background: 'linear-gradient(180deg, #b0aba4, #8a8580, #b0aba4)' }} />
                                        <div className="absolute -left-[2px] top-[150px] w-[3px] h-[42px] rounded-l-sm" style={{ background: 'linear-gradient(180deg, #b0aba4, #8a8580, #b0aba4)' }} />
                                        <div className="absolute -left-[2px] top-[202px] w-[3px] h-[42px] rounded-l-sm" style={{ background: 'linear-gradient(180deg, #b0aba4, #8a8580, #b0aba4)' }} />
                                        <div className="absolute -right-[2px] top-[168px] w-[3px] h-[60px] rounded-r-sm" style={{ background: 'linear-gradient(180deg, #b0aba4, #8a8580, #b0aba4)' }} />

                                        {/* CAMADA 2: Bezel preto */}
                                        <div className="absolute inset-[4px] rounded-[48px] bg-black"
                                            style={{ boxShadow: 'inset 0 0 3px rgba(0,0,0,0.8)' }}
                                        >
                                            {/* Dynamic Island */}
                                            <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-[95px] h-[28px] bg-black rounded-full z-40 flex items-center justify-center"
                                                style={{ boxShadow: '0 0 0 2px #111' }}>
                                                <div className="w-[9px] h-[9px] rounded-full ml-6"
                                                    style={{ background: 'radial-gradient(circle, #1a1a3e 30%, #0d0d1a 100%)', boxShadow: '0 0 2px rgba(50,50,100,0.3)' }}
                                                />
                                            </div>

                                            {/* CAMADA 3: Tela */}
                                            <div className="absolute inset-[5px] rounded-[43px] overflow-hidden flex flex-col bg-black">

                                                {/* iOS Status Bar */}
                                                <div className="h-[46px] px-5 flex justify-between items-end pb-[6px] bg-[#075e54] z-20 shrink-0">
                                                    <span className="text-white text-[13px] font-semibold w-12">{currentTime}</span>
                                                    <div className="flex items-center gap-[5px]">
                                                        <svg width="14" height="10" viewBox="0 0 17 11">
                                                            <rect x="0" y="8" width="3" height="3" rx="0.5" fill="white" />
                                                            <rect x="4.5" y="5.5" width="3" height="5.5" rx="0.5" fill="white" />
                                                            <rect x="9" y="3" width="3" height="8" rx="0.5" fill="white" />
                                                            <rect x="13.5" y="0" width="3" height="11" rx="0.5" fill="white" />
                                                        </svg>
                                                        <svg width="14" height="10" viewBox="0 0 16 12" fill="none">
                                                            <path d="M8 10.5a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" fill="white" />
                                                            <path d="M5 8.2a4.3 4.3 0 016 0" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
                                                            <path d="M2.2 5.4a8 8 0 0111.6 0" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
                                                        </svg>
                                                        <div className="flex items-center">
                                                            <div className="w-[20px] h-[10px] border-[1.2px] border-white/70 rounded-[2.5px] p-[1.5px]">
                                                                <div className="h-full bg-white rounded-[1px]" style={{ width: '80%' }} />
                                                            </div>
                                                            <div className="w-[1.2px] h-[4px] bg-white/70 rounded-r-sm ml-[0.5px]" />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* WhatsApp Header */}
                                                <div className="px-[6px] py-[6px] bg-[#075e54] flex items-center justify-between shrink-0 border-b border-[#065e4e]">
                                                    <div className="flex items-center gap-[6px]">
                                                        <ChevronLeft size={22} className="text-white" strokeWidth={2} />
                                                        <div className="w-[34px] h-[34px] rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                                                            <span className="font-bold text-white text-[13px]">C</span>
                                                        </div>
                                                        <div className="ml-[2px]">
                                                            <p className="text-[15px] font-medium text-white leading-tight">Clínica Olimphia</p>
                                                            <p className="text-[11px] text-emerald-200/90 leading-tight">online</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-[18px] pr-[4px]">
                                                        <Video size={18} className="text-white/90" />
                                                        <Phone size={16} className="text-white/90" />
                                                        <MoreVertical size={18} className="text-white/90" />
                                                    </div>
                                                </div>

                                                {/* Chat Body */}
                                                <div
                                                    ref={chatBodyRef}
                                                    className="flex-1 overflow-y-auto relative whatsapp-scrollbar"
                                                    style={{
                                                        backgroundColor: '#e4ddd6',
                                                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='p' width='50' height='50' patternUnits='userSpaceOnUse'%3E%3Ccircle cx='8' cy='8' r='1.2' fill='%23cbbfb1' opacity='0.5'/%3E%3Crect x='25' y='3' width='5' height='5' rx='1' fill='none' stroke='%23cbbfb1' stroke-width='0.6' opacity='0.4'/%3E%3Ccircle cx='40' cy='30' r='1.8' fill='none' stroke='%23cbbfb1' stroke-width='0.6' opacity='0.35'/%3E%3Cpath d='M10 35l4-5 4 5' fill='none' stroke='%23cbbfb1' stroke-width='0.6' opacity='0.35'/%3E%3Crect x='32' y='40' width='6' height='4' rx='1' fill='none' stroke='%23cbbfb1' stroke-width='0.6' opacity='0.3'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='200' height='200' fill='url(%23p)'/%3E%3C/svg%3E")`,
                                                    }}
                                                >
                                                    <div className="px-[10px] py-[6px] space-y-[3px]">
                                                        {/* Date chip */}
                                                        <div className="flex justify-center py-[6px]">
                                                            <div className="bg-[#d1eefa]/80 px-[10px] py-[3px] rounded-[6px] shadow-[0_1px_0.5px_rgba(0,0,0,0.06)]">
                                                                <span className="text-[11px] text-[#4a8fa0] font-medium uppercase tracking-wide">Hoje</span>
                                                            </div>
                                                        </div>

                                                        {/* Encryption notice */}
                                                        <div className="flex justify-center pb-[4px]">
                                                            <div className="bg-[#fdf4c5]/90 px-[8px] py-[4px] rounded-[6px] max-w-[250px] shadow-[0_1px_0.5px_rgba(0,0,0,0.04)]">
                                                                <p className="text-[10px] text-[#57534e] text-center leading-[13px]">
                                                                    🔒 As mensagens são protegidas com a criptografia de ponta a ponta.
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Messages */}
                                                        <AnimatePresence mode="popLayout">
                                                            {displayedMessages.map((msg, i) => {
                                                                const isCustomer = msg.sender === "customer"
                                                                return (
                                                                    <motion.div
                                                                        key={i}
                                                                        initial={{ opacity: 0, scale: 0.9, y: 12 }}
                                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                                        transition={{ duration: 0.2, ease: "easeOut" }}
                                                                        className={`flex ${isCustomer ? "justify-end" : "justify-start"} py-[1px]`}
                                                                    >
                                                                        <div className={`max-w-[82%] px-[8px] py-[5px] rounded-[8px] shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] ${
                                                                            isCustomer ? "bg-[#d9fdd3]" : "bg-white"
                                                                        }`}>
                                                                            <p className="text-[12.5px] text-[#111b21] leading-[17px] whitespace-pre-line">
                                                                                {formatWhatsAppText(msg.text)}
                                                                            </p>
                                                                            <div className="flex justify-end items-center gap-[3px] mt-[2px]">
                                                                                <span className="text-[10px] text-[#667781] leading-none">{msg.time}</span>
                                                                                {isCustomer && (
                                                                                    <CheckCheck size={14} className="text-[#53bdeb]" strokeWidth={2.5} />
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </motion.div>
                                                                )
                                                            })}
                                                            {isTyping && <TypingIndicator />}
                                                        </AnimatePresence>
                                                    </div>
                                                </div>

                                                {/* Input Bar */}
                                                <div className="px-[6px] py-[5px] bg-[#f0f2f5] flex items-end gap-[5px] shrink-0">
                                                    <div className="flex-1 bg-white rounded-full px-[10px] py-[7px] flex items-center gap-[6px] shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]">
                                                        <Smile size={20} className="text-[#54656f] shrink-0" />
                                                        <span className="text-[#54656f] text-[14px] flex-1">Mensagem</span>
                                                        <div className="flex items-center gap-[10px]">
                                                            <Paperclip size={19} className="text-[#54656f] rotate-[135deg]" />
                                                            <Camera size={19} className="text-[#54656f]" />
                                                        </div>
                                                    </div>
                                                    <div className="w-[40px] h-[40px] bg-[#00a884] rounded-full flex items-center justify-center shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.12)]">
                                                        <Mic size={20} className="text-white" />
                                                    </div>
                                                </div>

                                                {/* Home Indicator */}
                                                <div className="h-[20px] bg-[#f0f2f5] flex items-center justify-center">
                                                    <div className="w-[110px] h-[4px] bg-black/20 rounded-full" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </>
    )
}
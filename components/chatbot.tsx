'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, ChevronRight, Loader2 } from 'lucide-react';
import { chatbotService } from '@/services/chatbotServices';
import Image from "next/image";

// --- Tipos ---
type Message = {
  id: string;
  type: 'bot' | 'user';
  text?: string;
  options?: { label: string; value: string }[];
};

// --- Conteúdo Nextech ---
const content = {
  header_title: "Jhon - Nextech",
  header_subtitle: "Assistente Virtual",
  cta_bubble: "Sua clínica está perdendo pacientes? Descubra como resolver 👋",

  welcome_message_1: "Olá! Bem-vindo à Nextech 👋 Ajudamos clínicas a automatizar o atendimento no WhatsApp com IA.",
  welcome_message_2: "Quer descobrir como parar de perder pacientes fora do horário?",
  btn_start: "Quero saber mais! 🚀",

  ask_name: "Para começar, qual é o seu nome?",
  ask_email: "Prazer, {name}! Qual seu melhor e-mail para contato?",
  ask_whatsapp: "E o WhatsApp? Assim nossa equipe pode te chamar diretamente.",
  ask_company: "Qual o nome da sua clínica ou consultório?",

  ask_specialty: "Qual a especialidade da sua clínica?",
  opt_spec_1: "🦷 Odontologia / Ortodontia",
  opt_spec_2: "❤️ Cardiologia / Clínica Médica",
  opt_spec_3: "✨ Estética / Harmonização / Dermato",
  opt_spec_4: "🧠 Psicologia / Psiquiatria",
  opt_spec_5: "🏋️ Fisioterapia / Nutrição / Pilates",
  opt_spec_6: "👁️ Oftalmologia / Ortopedia",
  opt_spec_7: "👶 Pediatria / Ginecologia",
  opt_spec_8: "🔬 Laboratório / Exames por Imagem",
  opt_spec_9: "🏥 Outra especialidade",

  ask_problem: "Qual desses problemas mais te incomoda hoje?",
  opt_prob_1: "📱 Pacientes mandando mensagem e ninguém responde a tempo",
  opt_prob_2: "🌙 Perco leads à noite e no fim de semana",
  opt_prob_3: "😰 Recepção sobrecarregada respondendo as mesmas perguntas",
  opt_prob_4: "❌ Alto índice de no-show (pacientes que faltam)",
  opt_prob_5: "📉 Muitos contatos mas poucos viram consulta",

  ask_volume: "Quantos contatos de pacientes vocês recebem por mês?",
  opt_vol_1: "Até 50",
  opt_vol_2: "50 a 150",
  opt_vol_3: "150 a 500",
  opt_vol_4: "Mais de 500",

  final_message: "Perfeito, {name}! 🎉 Com base no que você me contou, a Nextech pode ajudar sua clínica a nunca mais perder um paciente. Nossa equipe vai entrar em contato pelo WhatsApp em breve para agendar uma demonstração gratuita!",

  input_placeholder: "Digite sua resposta...",
  send_button: "Enviar",
  online_status: "Online agora",
};

export const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [bubbleState, setBubbleState] = useState<'hidden' | 'typing' | 'visible'>('hidden');
  const [step, setStep] = useState<
    'welcome' | 'name' | 'email' | 'whatsapp' | 'company' | 'specialty' | 'problem' | 'volume' | 'finished'
  >('welcome');

  const [leadData, setLeadData] = useState({
    name: '',
    email: '',
    whatsapp: '',
    company: '',
    specialty: '',
    meetings_count: '',
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);

  const simulateBotTyping = useCallback((newMessages: Message[]) => {
    setIsTyping(true);
    const textLength = newMessages[0]?.text?.length || 0;
    const delay = Math.min(1500, textLength * 30 || 1000);

    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [...prev, ...newMessages]);
    }, delay);
  }, []);

  // Controle do Balão de CTA
  useEffect(() => {
    if (isOpen) {
      setBubbleState('hidden');
      return;
    }
    const typingTimer = setTimeout(() => setBubbleState('typing'), 1000);
    const messageTimer = setTimeout(() => setBubbleState('visible'), 2500);
    return () => {
      clearTimeout(typingTimer);
      clearTimeout(messageTimer);
    };
  }, [isOpen]);

  // Scroll Automático
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Inicialização
  useEffect(() => {
    if (!hasInitialized.current) {
      simulateBotTyping([
        { id: '1', type: 'bot', text: content.welcome_message_1 },
        {
          id: '2', type: 'bot', text: content.welcome_message_2,
          options: [{ label: content.btn_start, value: 'start' }],
        },
      ]);
      hasInitialized.current = true;
    }
  }, [simulateBotTyping]);

  // Submissão do Lead
  const submitLead = async (finalLeadData: typeof leadData) => {
    setIsSending(true);
    try {
      await chatbotService.createLead(finalLeadData);
    } catch (error) {
      console.error("Erro frontend:", error);
    } finally {
      setIsSending(false);
      setStep('finished');
      const firstName = finalLeadData.name.split(' ')[0];
      simulateBotTyping([{
        id: 'final', type: 'bot',
        text: content.final_message.replace('{name}', firstName),
      }]);
    }
  };

  // Clique em Opções
  const handleOptionClick = (label: string, value: string) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', text: label }]);

    if (step === 'welcome') {
      setStep('name');
      simulateBotTyping([{ id: 'ask_name', type: 'bot', text: content.ask_name }]);
    } else if (step === 'specialty') {
      setLeadData(prev => ({ ...prev, specialty: value }));
      setStep('problem');
      simulateBotTyping([{
        id: 'ask_problem', type: 'bot', text: content.ask_problem,
        options: [
          { label: content.opt_prob_1, value: 'sem_resposta' },
          { label: content.opt_prob_2, value: 'fora_horario' },
          { label: content.opt_prob_3, value: 'recepcao_sobrecarregada' },
          { label: content.opt_prob_4, value: 'no_show' },
          { label: content.opt_prob_5, value: 'baixa_conversao' },
        ],
      }]);
    } else if (step === 'problem') {
      setStep('volume');
      simulateBotTyping([{
        id: 'ask_volume', type: 'bot', text: content.ask_volume,
        options: [
          { label: content.opt_vol_1, value: '0-50' },
          { label: content.opt_vol_2, value: '50-150' },
          { label: content.opt_vol_3, value: '150-500' },
          { label: content.opt_vol_4, value: '500+' },
        ],
      }]);
    } else if (step === 'volume') {
      const finalData = { ...leadData, meetings_count: value };
      setLeadData(finalData);
      submitLead(finalData);
    }
  };

  // Envio de Texto
  const handleSend = () => {
    if (!inputValue.trim()) return;
    const text = inputValue;
    setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', text }]);
    setInputValue("");

    if (step === 'name') {
      setLeadData(prev => ({ ...prev, name: text }));
      setStep('email');
      simulateBotTyping([{ id: 'ask_email', type: 'bot', text: content.ask_email.replace('{name}', text.split(' ')[0]) }]);
    } else if (step === 'email') {
      setLeadData(prev => ({ ...prev, email: text }));
      setStep('whatsapp');
      simulateBotTyping([{ id: 'ask_whatsapp', type: 'bot', text: content.ask_whatsapp }]);
    } else if (step === 'whatsapp') {
      setLeadData(prev => ({ ...prev, whatsapp: text }));
      setStep('company');
      simulateBotTyping([{ id: 'ask_company', type: 'bot', text: content.ask_company }]);
    } else if (step === 'company') {
      setLeadData(prev => ({ ...prev, company: text }));
      setStep('specialty');
      simulateBotTyping([{
        id: 'ask_specialty', type: 'bot', text: content.ask_specialty,
        options: [
          { label: content.opt_spec_1, value: 'odontologia' },
          { label: content.opt_spec_2, value: 'cardiologia_clinica' },
          { label: content.opt_spec_3, value: 'estetica_dermato' },
          { label: content.opt_spec_4, value: 'saude_mental' },
          { label: content.opt_spec_9, value: 'outra' },
        ],
      }]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSend();
  };

  const isOptionStep = step === 'welcome' || step === 'specialty' || step === 'problem' || step === 'volume' || step === 'finished';

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-50 flex flex-col items-end font-sans">

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="mb-4 w-[90vw] sm:w-[360px] h-[60vh] sm:h-[600px] max-h-[600px] bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header com Avatar */}
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 p-4 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm overflow-hidden border border-white/30 relative">
                    <Image
                      src="/FotoPerfilBot.png"
                      alt="Jhon"
                      width={100}
                      height={100}
                      className="object-cover w-full h-full"
                    />
                  </div>
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-emerald-600 rounded-full animate-pulse"></span>
                </div>
                <div>
                  <h3 className="font-bold text-sm">{content.header_title}</h3>
                  <p className="text-[11px] opacity-90">{content.online_status}</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-900/50 chatbot-scroll">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 text-sm rounded-2xl shadow-sm leading-relaxed ${msg.type === 'user'
                    ? 'bg-emerald-600 text-white rounded-br-none'
                    : 'bg-white/5 text-zinc-200 rounded-bl-none border border-white/5'
                    }`}>
                    {msg.text && <p>{msg.text}</p>}
                    {msg.options && (
                      <div className="mt-3 flex flex-col gap-2">
                        {msg.options.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => handleOptionClick(opt.label, opt.value)}
                            className="text-left px-4 py-2.5 bg-white/5 text-emerald-400 rounded-lg hover:bg-emerald-500/10 hover:scale-[1.02] transition-all text-xs font-bold border border-emerald-500/20 flex items-center justify-between group cursor-pointer"
                          >
                            {opt.label}
                            <ChevronRight size={14} className="text-emerald-500 group-hover:translate-x-1 transition-transform" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white/5 p-3 rounded-2xl rounded-bl-none border border-white/5">
                    <div className="flex gap-1.5 px-1">
                      <motion.span className="w-1.5 h-1.5 bg-zinc-500 rounded-full" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6 }} />
                      <motion.span className="w-1.5 h-1.5 bg-zinc-500 rounded-full" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.15 }} />
                      <motion.span className="w-1.5 h-1.5 bg-zinc-500 rounded-full" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.3 }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            {!isOptionStep && (
              <div className="p-3 bg-zinc-950 border-t border-white/5 shrink-0">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={content.input_placeholder}
                    disabled={isSending}
                    autoFocus
                    className="flex-1 bg-white/5 text-white rounded-full px-4 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all border border-white/10 placeholder:text-zinc-500"
                  />
                  <button
                    onClick={handleSend}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white p-2.5 rounded-full transition-all shadow-md disabled:opacity-50 hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer"
                    disabled={!inputValue.trim() || isSending}
                  >
                    {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </div>
              </div>
            )}

            <div className="bg-zinc-950 py-1.5 text-center border-t border-white/5 shrink-0">
              <p className="text-[10px] text-zinc-600 font-medium tracking-wide">⚡ Powered by Nextech</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative group flex items-end gap-4">
        {/* Balão de CTA */}
        <AnimatePresence>
          {!isOpen && bubbleState !== 'hidden' && (
            <motion.div
              initial={{ opacity: 0, x: 10, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="mb-4 bg-zinc-900 text-zinc-200 px-5 py-3 rounded-2xl rounded-br-none shadow-xl border border-white/10 text-sm font-medium origin-bottom-right z-40 max-w-[250px]"
            >
              {bubbleState === 'typing' ? (
                <div className="flex gap-1 py-1">
                  <motion.span className="w-1.5 h-1.5 bg-zinc-500 rounded-full" animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6 }} />
                  <motion.span className="w-1.5 h-1.5 bg-zinc-500 rounded-full" animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.15 }} />
                  <motion.span className="w-1.5 h-1.5 bg-zinc-500 rounded-full" animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.3 }} />
                </div>
              ) : (
                <span>{content.cta_bubble}</span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Botão Principal */}
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative cursor-pointer"
        >
          <div className="w-16 h-16 rounded-full overflow-hidden shadow-lg border-2 border-emerald-500/30 z-50 relative bg-emerald-600 flex items-center justify-center">
            {isOpen ? (
              <X size={30} className="text-white" />
            ) : (
              <Image
                src="/FotoPerfilBot.png"
                alt="Atendente"
                width={100}
                height={100}
                className="object-cover w-full h-full"
              />
            )}
          </div>
          <span className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-zinc-950 z-[60]"></span>
          {!isOpen && <span className="absolute top-0 left-0 w-full h-full rounded-full bg-emerald-500 opacity-40 animate-ping -z-10 duration-2000"></span>}
        </motion.button>
      </div>

      <style jsx global>{`
        .chatbot-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .chatbot-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .chatbot-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};
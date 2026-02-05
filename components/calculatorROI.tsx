"use client"

import { useState, useEffect, useRef } from "react"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { TrendingUp, Users, DollarSign, Clock, ArrowRight } from "lucide-react"
import { motion, useInView } from "framer-motion"
import { Button } from "@/components/ui/button"

interface CalculatorInputs {
  monthlyVisitors: number
  currentConversionRate: number
  averageOrderValue: number
  businessType: string
}

export function CalculatorROI() {
  const [inputs, setInputs] = useState<CalculatorInputs>({
    monthlyVisitors: 10000,
    currentConversionRate: 2,
    averageOrderValue: 150,
    businessType: "healthcare", // Set healthcare as default for Nextech focus
  })

  const sectionRef = useRef(null)
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" })

  const getBusinessDefaults = () => {
    const businessDefaults = {
      ecommerce: { avgOrder: 85, maxOrder: 2000, conversion: 35, response: 80, satisfaction: 45 },
      retail: { avgOrder: 65, maxOrder: 1500, conversion: 30, response: 75, satisfaction: 40 },
      realestate: { avgOrder: 5000, maxOrder: 100000, conversion: 40, response: 85, satisfaction: 50 },
      hospitality: { avgOrder: 180, maxOrder: 5000, conversion: 25, response: 70, satisfaction: 35 },
      healthcare: { avgOrder: 450, maxOrder: 10000, conversion: 45, response: 90, satisfaction: 55 },
      finance: { avgOrder: 1200, maxOrder: 50000, conversion: 35, response: 85, satisfaction: 50 },
      automotive: { avgOrder: 25000, maxOrder: 200000, conversion: 30, response: 75, satisfaction: 40 },
      default: { avgOrder: 150, maxOrder: 5000, conversion: 35, response: 80, satisfaction: 45 },
    }
    return businessDefaults[inputs.businessType as keyof typeof businessDefaults] || businessDefaults.default
  }

  useEffect(() => {
    const defaults = getBusinessDefaults()
    setInputs((prev) => ({ ...prev, averageOrderValue: defaults.avgOrder }))
  }, [inputs.businessType])

  const businessConfig = getBusinessDefaults()
  const improvements = {
    conversion: businessConfig.conversion,
    response: businessConfig.response,
    satisfaction: businessConfig.satisfaction,
  }

  // Métricas Atuais
  const currentLeads = Math.round((inputs.monthlyVisitors * inputs.currentConversionRate) / 100)
  const currentRevenue = currentLeads * inputs.averageOrderValue

  // Métricas com Nextech
  const newConversionRate = inputs.currentConversionRate * (1 + improvements.conversion / 100)
  const newLeads = Math.round((inputs.monthlyVisitors * newConversionRate) / 100)
  const newRevenue = newLeads * inputs.averageOrderValue

  // Ganhos
  const additionalLeads = newLeads - currentLeads
  const additionalRevenue = newRevenue - currentRevenue
  const revenueIncrease = ((newRevenue - currentRevenue) / currentRevenue) * 100

  return (
    <section id="Calculador" ref={sectionRef} className="py-24 px-4 relative overflow-hidden">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-6"
          >
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-white/80 tracking-widest uppercase">Calculadora de ROI</span>
          </motion.div>

          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6"
          >
            Veja o potencial de <br />
            <span className="block mt-2 text-zinc-500 italic font-light">crescimento da sua receita</span>
          </motion.h2>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.3 }}
            className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto"
          >
            Calcule quanto de receita adicional seu negócio pode gerar com o atendimento inteligente da Nextech.
          </motion.p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-stretch">
          
          {/* Inputs */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.4 }}
          >
            <Card className="p-8 bg-white/5 border-white/10 backdrop-blur-md shadow-2xl h-full border">
              <h3 className="text-2xl font-bold text-white mb-8">Suas Métricas</h3>

              <div className="space-y-10">
                {/* Tipo de Negócio */}
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Setor de Atuação</label>
                  <Select
                    value={inputs.businessType}
                    onValueChange={(value) => setInputs((prev) => ({ ...prev, businessType: value }))}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 text-white h-12 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10 text-white">
                      <SelectItem value="healthcare">Saúde / Clínicas</SelectItem>
                      <SelectItem value="realestate">Imobiliário</SelectItem>
                      <SelectItem value="ecommerce">E-commerce</SelectItem>
                      <SelectItem value="hospitality">Hospitalidade / Hotéis</SelectItem>
                      <SelectItem value="automotive">Automotivo</SelectItem>
                      <SelectItem value="finance">Financeiro / Jurídico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Visitantes Mensais */}
                <div>
                  <div className="flex justify-between items-end mb-4">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Contatos Mensais (Leads)</label>
                    <span className="text-xl font-bold text-white">{inputs.monthlyVisitors.toLocaleString()}</span>
                  </div>
                  <Slider
                    value={[inputs.monthlyVisitors]}
                    onValueChange={([value]) => setInputs((prev) => ({ ...prev, monthlyVisitors: value }))}
                    max={100000} min={1000} step={1000}
                  />
                </div>

                {/* Taxa de Conversão */}
                <div>
                  <div className="flex justify-between items-end mb-4">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Taxa de Conversão Atual</label>
                    <span className="text-xl font-bold text-white">{inputs.currentConversionRate}%</span>
                  </div>
                  <Slider
                    value={[inputs.currentConversionRate]}
                    onValueChange={([value]) => setInputs((prev) => ({ ...prev, currentConversionRate: value }))}
                    max={15} min={0.5} step={0.1}
                  />
                </div>

                {/* Ticket Médio */}
                <div>
                  <div className="flex justify-between items-end mb-4">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Ticket Médio da Consulta/Venda</label>
                    <span className="text-xl font-bold text-white">R$ {inputs.averageOrderValue.toLocaleString()}</span>
                  </div>
                  <Slider
                    value={[inputs.averageOrderValue]}
                    onValueChange={([value]) => setInputs((prev) => ({ ...prev, averageOrderValue: value }))}
                    max={businessConfig.maxOrder} min={50} step={50}
                  />
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Results */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.5 }}
          >
            <Card className="p-8 bg-emerald-500/5 border-emerald-500/20 backdrop-blur-md shadow-2xl h-full flex flex-col border">
              <h3 className="text-2xl font-bold text-white mb-8">Seu Potencial com a Nextech</h3>

              <div className="space-y-6 flex-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Atual</div>
                    <div className="text-2xl font-bold text-white">{currentLeads}</div>
                    <div className="text-[10px] text-zinc-500 font-medium">Leads/mês</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                    <div className="text-[10px] font-bold text-emerald-500 uppercase mb-1">Com Nextech</div>
                    <div className="text-2xl font-bold text-white">{newLeads}</div>
                    <div className="text-[10px] text-emerald-500 font-medium">Leads/mês</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-zinc-400 text-sm">Leads Adicionais</span>
                    <span className="text-lg font-bold text-emerald-400">+{additionalLeads}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-zinc-400 text-sm">Aumento de Receita Mensal</span>
                    <span className="text-lg font-bold text-white">R$ {additionalRevenue.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 text-emerald-400">
                    <span className="text-sm font-bold uppercase tracking-widest">Impacto Comercial</span>
                    <span className="text-lg font-bold">+{revenueIncrease.toFixed(1)}%</span>
                  </div>
                </div>

                {/* Annual Projection */}
                <div className="mt-8 p-6 rounded-4xl bg-white text-zinc-950 shadow-xl relative overflow-hidden group">
                  <div className="relative z-10">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">Aumento de Receita Anual Projetado</p>
                    <div className="text-3xl md:text-4xl font-black tracking-tighter">
                      R$ {(additionalRevenue * 12).toLocaleString()}
                    </div>
                  </div>
                  <div className="absolute -right-2.5 -bottom-2.5 opacity-5 transition-transform group-hover:scale-110">
                    <TrendingUp size={120} strokeWidth={3} />
                  </div>
                </div>

                <div className="pt-6">
                  <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-14 rounded-2xl gap-2 shadow-lg shadow-emerald-500/20">
                    Garanta esse resultado agora
                    <ArrowRight size={18} />
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          className="text-center text-[10px] text-zinc-500 mt-12 uppercase tracking-widest font-bold"
        >
          * Resultados baseados em médias do setor e benchmarks de IA conversacional.
        </motion.p>
      </div>
    </section>
  )
}
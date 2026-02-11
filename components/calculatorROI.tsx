"use client"

import { useState, useEffect, useRef } from "react"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { TrendingUp, ArrowRight } from "lucide-react"
import { motion, useInView } from "framer-motion"
import { Button } from "@/components/ui/button"
import { LiquidMetalButton } from "@/components/ui/liquidMetalButton"

interface CalculatorInputs {
  monthlyVisitors: number
  currentConversionRate: number
  averageOrderValue: number
  businessType: string
}

const clinicTypes = [
  { value: "odontologia", label: "Odontologia" },
  { value: "cardiologia", label: "Cardiologia" },
  { value: "dermatologia", label: "Dermatologia" },
  { value: "ortopedia", label: "Ortopedia" },
  { value: "oftalmologia", label: "Oftalmologia" },
  { value: "ginecologia", label: "Ginecologia" },
  { value: "pediatria", label: "Pediatria" },
  { value: "psicologia", label: "Psicologia / Terapia" },
  { value: "estetica", label: "Estética / Harmonização" },
  { value: "veterinaria", label: "Veterinária" },
  { value: "geral", label: "Clínica Geral" },
]

export function CalculatorROI() {
  const [inputs, setInputs] = useState<CalculatorInputs>({
    monthlyVisitors: 100,
    currentConversionRate: 2,
    averageOrderValue: 300,
    businessType: "geral",
  })

  const sectionRef = useRef(null)
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" })

  const getBusinessDefaults = () => {
    const businessDefaults = {
      odontologia: { avgOrder: 350, maxOrder: 5000, conversion: 40, noShowReduction: 40 },
      cardiologia: { avgOrder: 500, maxOrder: 8000, conversion: 35, noShowReduction: 35 },
      dermatologia: { avgOrder: 400, maxOrder: 6000, conversion: 45, noShowReduction: 38 },
      ortopedia: { avgOrder: 550, maxOrder: 10000, conversion: 35, noShowReduction: 35 },
      oftalmologia: { avgOrder: 600, maxOrder: 12000, conversion: 38, noShowReduction: 32 },
      ginecologia: { avgOrder: 300, maxOrder: 4000, conversion: 42, noShowReduction: 42 },
      pediatria: { avgOrder: 250, maxOrder: 3000, conversion: 48, noShowReduction: 45 },
      psicologia: { avgOrder: 200, maxOrder: 2000, conversion: 50, noShowReduction: 50 },
      estetica: { avgOrder: 450, maxOrder: 8000, conversion: 50, noShowReduction: 38 },
      veterinaria: { avgOrder: 280, maxOrder: 4000, conversion: 45, noShowReduction: 40 },
      geral: { avgOrder: 300, maxOrder: 5000, conversion: 40, noShowReduction: 38 },
    }
    return businessDefaults[inputs.businessType as keyof typeof businessDefaults] || businessDefaults.geral
  }

  useEffect(() => {
    const defaults = getBusinessDefaults()
    setInputs((prev) => ({ ...prev, averageOrderValue: defaults.avgOrder }))
  }, [inputs.businessType])

  const businessConfig = getBusinessDefaults()

  // Métricas Atuais
  const currentLeads = inputs.monthlyVisitors
  const noShowRate = 0.30
  const currentPatientsActual = Math.round(currentLeads * (inputs.currentConversionRate / 100) * (1 - noShowRate))
  const currentRevenue = currentPatientsActual * inputs.averageOrderValue

  // Métricas com Nextech
  const newConversionRate = inputs.currentConversionRate * (1 + businessConfig.conversion / 100)
  const newNoShowRate = noShowRate * (1 - businessConfig.noShowReduction / 100)
  const newPatientsActual = Math.round(currentLeads * (newConversionRate / 100) * (1 - newNoShowRate))
  const newRevenue = newPatientsActual * inputs.averageOrderValue

  // Economia operacional
  const hoursSavedPerMonth = Math.round(currentLeads * 0.08)
  const costPerHour = 18
  const operationalSavings = hoursSavedPerMonth * costPerHour

  // Ganhos
  const additionalPatients = newPatientsActual - currentPatientsActual
  const additionalRevenue = (newRevenue - currentRevenue) + operationalSavings
  const revenueIncrease = currentRevenue > 0 ? ((newRevenue + operationalSavings - currentRevenue) / currentRevenue) * 100 : 0

  return (
    <>
      <style jsx global>{`
        [data-radix-slider-track] {
          background: rgba(255, 255, 255, 0.1) !important;
          border-radius: 9999px;
          height: 6px;
        }
        [data-radix-slider-range] {
          background: #10b981 !important;
          border-radius: 9999px;
        }
        [data-radix-slider-thumb] {
          background: white !important;
          border: none !important;
          border-radius: 9999px;
          width: 18px !important;
          height: 18px !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        [data-radix-slider-thumb]:focus-visible {
          outline: 2px solid #10b981;
          outline-offset: 2px;
        }
      `}</style>

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
              Calcule quanto de receita adicional sua clínica pode gerar com o atendimento inteligente da Nextech.
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
                  {/* Tipo de Clínica */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Tipo de Clínica</label>
                    <Select
                      value={inputs.businessType}
                      onValueChange={(value) => setInputs((prev) => ({ ...prev, businessType: value }))}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10 text-white h-12 rounded-xl cursor-pointer">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10 text-white">
                        {clinicTypes.map((clinic) => (
                          <SelectItem key={clinic.value} value={clinic.value} className="cursor-pointer">
                            {clinic.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Contatos Mensais */}
                  <div>
                    <div className="flex justify-between items-end mb-4">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Contatos Mensais (Pacientes)</label>
                      <span className="text-xl font-bold text-white">{inputs.monthlyVisitors.toLocaleString()}</span>
                    </div>
                    <Slider
                      value={[inputs.monthlyVisitors]}
                      onValueChange={([value]) => setInputs((prev) => ({ ...prev, monthlyVisitors: value }))}
                      max={5000} min={100} step={50}
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
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Ticket Médio da Consulta</label>
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
                      <div className="text-2xl font-bold text-white">{currentPatientsActual}</div>
                      <div className="text-[10px] text-zinc-500 font-medium">Pacientes atendidos/mês</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                      <div className="text-[10px] font-bold text-emerald-500 uppercase mb-1">Com Nextech</div>
                      <div className="text-2xl font-bold text-white">{newPatientsActual}</div>
                      <div className="text-[10px] text-emerald-500 font-medium">Pacientes atendidos/mês</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                      <span className="text-zinc-400 text-sm">Pacientes adicionais</span>
                      <span className="text-lg font-bold text-emerald-400">+{additionalPatients}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                      <span className="text-zinc-400 text-sm">Economia operacional</span>
                      <span className="text-lg font-bold text-white">R$ {operationalSavings.toLocaleString()}/mês</span>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                      <span className="text-zinc-400 text-sm">Receita adicional mensal</span>
                      <span className="text-lg font-bold text-white">R$ {additionalRevenue.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 text-emerald-400">
                      <span className="text-sm font-bold uppercase tracking-widest">Impacto total</span>
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

                  <div className="h-16 w-full flex items-center justify-center">
                    <a
                      href={`https://wa.me/5581999112895?text=${encodeURIComponent(
                        [
                          "Olá Jhon, realizei uma simulação de ROI através da calculadora da Nextech e gostaria de discutir os resultados projetados para minha operação.",
                          "",
                          "--------------------------------------------",
                          "Simulação da minha clínica",
                          "--------------------------------------------",
                          `Segmento: ${clinicTypes.find(c => c.value === inputs.businessType)?.label || inputs.businessType}`,
                          `Volume Mensal: ${inputs.monthlyVisitors} contatos`,
                          `Conversão Atual: ${inputs.currentConversionRate}%`,
                          `Ticket Médio: R$ ${inputs.averageOrderValue}`,
                          "",
                          "-----------------------------------------------------------------",
                          "Projeção de crescimento com a Nextech",
                          "-----------------------------------------------------------------",
                          `Pacientes Atuais: ${currentPatientsActual}/mês`,
                          `Nova Projeção: ${newPatientsActual}/mês (+${additionalPatients})`,
                          `Receita Adicional: R$ ${additionalRevenue.toLocaleString()}/mês`,
                          `Impacto Anual: R$ ${(additionalRevenue * 12).toLocaleString()}`,
                          `Aumento Percentual: +${revenueIncrease.toFixed(1)}%`,
                          "",
                          "Tenho interesse em agendar uma demonstração para validar esses números e entender a implementação."
                        ].join("\n")
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cursor-pointer"
                    >
                      <LiquidMetalButton label="Enviar Resultados" />
                    </a>
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
    </>
  )
}
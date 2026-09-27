import type { AgenteEmOperacao } from "@/components/agents/tipos"

const d = (hhmm: string, dia = "28") => `2026-09-${dia}T${hhmm}:00-03:00`

/**
 * Quatro agentes, um em cada nível de saúde. Plano HealthTech: no Pro, o
 * trigger barraria o quarto agente. "Recepção Odonto" e "Estética" são os
 * mesmos da fixture de conversas. Implantes foi desconectado pela Meta às
 * 12:31 (troca de celular), e a Meta o pausou.
 */
export const AGENTES: AgenteEmOperacao[] = [
  {
    id: "ag-odonto",
    nome: "Recepção Odonto",
    especialidade: "odontologia",
    numero: "+5581991230001",
    publicadoEm: d("09:12", "02"),
    sinais: {
      status: "active",
      conexao: "conectado",
      ultimaAtividade: d("14:29"),
      envios24h: 212,
      falhas24h: 0,
    },
    volume7d: { conversas: 184, mensagens: 1406, passadasParaHumano: 23 },
  },
  {
    id: "ag-estetica",
    nome: "Estética",
    especialidade: "estetica_dermato",
    numero: "+5581991230002",
    publicadoEm: d("16:40", "09"),
    sinais: {
      status: "active",
      conexao: "conectado",
      ultimaAtividade: d("13:58"),
      envios24h: 40,
      falhas24h: 3,
    },
    volume7d: { conversas: 61, mensagens: 438, passadasParaHumano: 9 },
  },
  {
    id: "ag-implantes",
    nome: "Implantes",
    especialidade: "odontologia",
    numero: "+5581991230003",
    publicadoEm: d("10:05", "15"),
    sinais: {
      status: "paused",
      conexao: "desconectado-pela-meta",
      ultimaAtividade: d("12:31"),
      envios24h: 18,
      falhas24h: 0,
    },
    volume7d: { conversas: 47, mensagens: 290, passadasParaHumano: 5 },
  },
  {
    id: "ag-ortodontia",
    nome: "Ortodontia",
    especialidade: "odontologia",
    numero: null,
    publicadoEm: null,
    sinais: {
      status: "draft",
      conexao: "sem-numero",
      ultimaAtividade: null,
      envios24h: 0,
      falhas24h: 0,
    },
    volume7d: { conversas: 0, mensagens: 0, passadasParaHumano: 0 },
  },
]

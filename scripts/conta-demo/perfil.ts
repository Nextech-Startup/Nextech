import {
  insuranceSchema,
  procedureSchema,
  professionalSchema,
  schedulingPolicySchema,
  type InsuranceInput,
  type ProcedureInput,
  type ProfessionalInput,
} from "@/lib/clinic-profile/schema"

/**
 * Perfil fictício da clínica de demonstração: a mesma equipe, os mesmos
 * procedimentos e os mesmos convênios das fixtures, para o Perfil da
 * clínica (a única tela real da demonstração) contar a mesma história que
 * a agenda e as conversas.
 *
 * Tudo passa pelos schemas da tela, para que ela abra o que o script grava.
 * Nenhum profissional leva conselho e registro: um número inventado poderia
 * coincidir com o de um profissional de verdade.
 */

const PROFISSIONAIS: ProfessionalInput[] = [
  { name: "Dra. Ana Lima", specialty: "Ortodontia" },
  { name: "Dr. Bruno Reis", specialty: "Implantes" },
  { name: "Dra. Carla Mota", specialty: "Estética" },
]

const PROCEDIMENTOS: ProcedureInput[] = [
  { name: "Avaliação", duration_minutes: 30, price: 0 },
  { name: "Limpeza", duration_minutes: 40, price: 180 },
  { name: "Aplicação de flúor", duration_minutes: 30, price: 90 },
  { name: "Manutenção do aparelho", specialty: "Ortodontia", duration_minutes: 40, price: 150 },
  { name: "Clareamento", specialty: "Estética", duration_minutes: 60, price: 900 },
  { name: "Implante", specialty: "Implantes", duration_minutes: 90, price: 3500 },
  { name: "Prótese", specialty: "Implantes", duration_minutes: 60, price: 1800 },
  { name: "Harmonização facial", specialty: "Estética", duration_minutes: 60, price: 1500 },
  { name: "Toxina botulínica", specialty: "Estética", duration_minutes: 60, price: 1200 },
  { name: "Limpeza de pele", specialty: "Estética", duration_minutes: 60, price: 220 },
]

const CONVENIOS: InsuranceInput[] = [
  { name: "Amil" },
  { name: "Bradesco Saúde" },
  { name: "SulAmérica" },
  { name: "Unimed" },
]

/** Linhas prontas para o insert, sem `clinic_id` (o preparo acrescenta). */
export const PERFIL_FICTICIO = {
  professionals: PROFISSIONAIS.map((p) => {
    // Vínculo com convênio é outra tabela; o perfil fictício não usa.
    const { insurance_ids: _convenios, ...linha } = professionalSchema.parse(p)
    return linha
  }),
  procedures: PROCEDIMENTOS.map((p) => {
    const { insurance_ids: _convenios, ...linha } = procedureSchema.parse(p)
    return linha
  }),
  insurances: CONVENIOS.map((c) => insuranceSchema.parse(c)),
  scheduling_policies: [
    schedulingPolicySchema.parse({
      default_slot_duration_minutes: 30,
      min_advance_hours: 2,
      min_cancellation_hours: 24,
      no_show_policy: "block_rebooking",
    }),
  ],
} as const

export type TabelaDoPerfil = keyof typeof PERFIL_FICTICIO

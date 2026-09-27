import {
  DIAS,
  ROTULO_DA_ESPECIALIDADE,
  ROTULO_DO_DIA,
  lerBusinessHours,
  type Agent,
  type BusinessHours,
  type Dia,
} from "./schema"

/** O que a publicação leva ao ar: a configuração, sem id, status nem credencial. */
export type ConfiguracaoPublicavel = Pick<
  Agent,
  | "name"
  | "specialty"
  | "persona_instructions"
  | "greeting_message"
  | "business_hours"
  | "handoff_enabled"
  | "handoff_message"
>

export type Alteracao = { campo: string; rotulo: string; antes: string; depois: string }

const texto = (v: string | null) => v?.trim() || "Vazio"

function faixa(horario: BusinessHours, dia: Dia): string {
  // `lerBusinessHours` completa os sete dias; o tipo do record não sabe disso.
  const f = horario[dia]
  return f?.open ? `${f.start} às ${f.end}` : "Fechado"
}

/**
 * O que muda no ar quando a clínica publicar de novo. Editar um agente
 * ativo só vale depois de publicar (agent-config-v1), então a tela precisa
 * dizer o que a publicação leva. Compara o que o paciente sente: espaço
 * nas pontas, vazio contra null e o horário guardado de um dia fechado
 * não contam. A ordem é a do formulário.
 */
export function alteracoesNaoPublicadas(
  publicada: ConfiguracaoPublicavel,
  atual: ConfiguracaoPublicavel,
): Alteracao[] {
  const lista: Alteracao[] = []
  const comparar = (campo: string, rotulo: string, antes: string, depois: string) => {
    if (antes !== depois) lista.push({ campo, rotulo, antes, depois })
  }

  comparar("name", "Nome", texto(publicada.name), texto(atual.name))
  comparar(
    "specialty",
    "Especialidade",
    ROTULO_DA_ESPECIALIDADE[publicada.specialty],
    ROTULO_DA_ESPECIALIDADE[atual.specialty],
  )
  comparar(
    "persona_instructions",
    "Persona",
    texto(publicada.persona_instructions),
    texto(atual.persona_instructions),
  )
  comparar("greeting_message", "Saudação", texto(publicada.greeting_message), texto(atual.greeting_message))

  const horarioAntes = lerBusinessHours(publicada.business_hours)
  const horarioDepois = lerBusinessHours(atual.business_hours)
  for (const dia of DIAS) {
    comparar(
      `business_hours.${dia}`,
      `Horário de ${ROTULO_DO_DIA[dia].toLowerCase()}`,
      faixa(horarioAntes, dia),
      faixa(horarioDepois, dia),
    )
  }

  const ligado = (v: boolean) => (v ? "Ligado" : "Desligado")
  comparar(
    "handoff_enabled",
    "Passar para humano",
    ligado(publicada.handoff_enabled),
    ligado(atual.handoff_enabled),
  )
  comparar(
    "handoff_message",
    "Mensagem de transferência",
    texto(publicada.handoff_message),
    texto(atual.handoff_message),
  )

  return lista
}

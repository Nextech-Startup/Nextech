import type { Metadata } from "next"
import { AvisoDePrototipo } from "@/components/patterns/aviso-de-prototipo"
import { TabelaDePacientes } from "@/components/patients/tabela-de-pacientes"
import { contarSegmentos, filtrarPacientes, lerSegmento } from "@/components/patients/segmentos"
import { AGORA } from "../../_fixtures/agora"
import { PACIENTES } from "../../_fixtures/pacientes"

export const metadata: Metadata = {
  title: "Protótipo: Pacientes",
  robots: { index: false, follow: false },
}

function texto(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined
}

export default async function PacientesPrototipo({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const filtro = { segmento: lerSegmento(texto(params.segmento)), busca: texto(params.q) ?? "" }

  return (
    <div className="grid gap-6">
      <AvisoDePrototipo entrega="tela de pacientes (o dado já existe desde patient-v1)" />
      <TabelaDePacientes
        pacientes={filtrarPacientes(PACIENTES, filtro, AGORA)}
        contagens={contarSegmentos(PACIENTES, AGORA)}
        filtro={filtro}
        agora={AGORA}
        caminho="/admin/design-system/telas/pacientes"
        acaoDesabilitada="Protótipo: a ação ainda não existe"
      />
    </div>
  )
}

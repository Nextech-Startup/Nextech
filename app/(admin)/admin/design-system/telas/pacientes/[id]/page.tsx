import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { AvisoDePrototipo } from "@/components/patterns/aviso-de-prototipo"
import { FichaDoPaciente } from "@/components/patients/ficha-do-paciente"
import { AGORA } from "../../../_fixtures/agora"
import { fichaDoPaciente } from "../../../_fixtures/fichas"

export const metadata: Metadata = {
  title: "Protótipo: Ficha do paciente",
  robots: { index: false, follow: false },
}

export default async function FichaPrototipo({ params }: { params: Promise<{ id: string }> }) {
  const ficha = fichaDoPaciente((await params).id)
  if (!ficha) notFound()

  return (
    <div className="grid gap-6">
      <AvisoDePrototipo entrega="tela de pacientes (o dado já existe desde patient-v1)" />
      <FichaDoPaciente
        paciente={ficha}
        agora={AGORA}
        caminhoDaLista="/admin/design-system/telas/pacientes"
        caminhoDaConversa="/admin/design-system/telas/conversas"
        acaoDesabilitada="Protótipo: a ação ainda não existe"
      />
    </div>
  )
}

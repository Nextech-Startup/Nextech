import type { Metadata } from "next"
import Link from "next/link"
import { PRAZO_DE_RESPOSTA } from "@/components/legal/empresa"
import { EmailDoEncarregado, PaginaLegal, Secao } from "@/components/legal/pagina-legal"

const DESCRICAO =
  "Como pedir a exclusão dos seus dados na Nextech: clínicas contratantes, pacientes atendidos e contatos do site."

export const metadata: Metadata = {
  title: "Exclusão de dados",
  description: DESCRICAO,
  alternates: { canonical: "/exclusao-de-dados" },
  openGraph: { title: "Exclusão de dados | Nextech", description: DESCRICAO, url: "/exclusao-de-dados" },
}

/*
 * URL de instruções de exclusão que a Meta pede no app. O caminho de
 * "Desconectar" citado abaixo é o de app/(dashboard)/dashboard/agents, que
 * apaga o número, o WABA e o token do agente.
 */
export default function ExclusaoDeDados() {
  return (
    <PaginaLegal
      titulo="Exclusão de dados"
      resumo="Como pedir que a Nextech apague os seus dados, conforme quem você é."
    >
      <Secao id="como-pedir" titulo="Como pedir">
        <p>
          Escreva para <EmailDoEncarregado /> com o assunto &ldquo;Exclusão de dados&rdquo;. Respondemos em até{" "}
          {PRAZO_DE_RESPOSTA} e confirmamos por e-mail quando a exclusão for feita.
        </p>
        <p>
          Para que ninguém apague os dados de outra pessoa, pedimos uma verificação mínima: o e-mail da conta, o
          telefone usado no contato ou outro dado que só você tenha.
        </p>
      </Secao>

      <Secao id="clinica" titulo="Clínica contratante">
        <p>
          Peça a exclusão da conta da clínica e dos dados obtidos pela Meta: o ID da conta do WhatsApp Business, o ID
          do número e o token de acesso.
        </p>
        <p>
          Sem esperar o pedido, o responsável da clínica pode desconectar o WhatsApp no painel, em{" "}
          <strong>Agentes</strong>, abrindo o agente e usando <strong>Desconectar</strong>. Isso apaga do sistema o ID
          do número, o ID da conta e o token de acesso daquele agente, e pausa o agente. A clínica também pode remover
          o app da Nextech nas configurações do seu portfólio empresarial na Meta.
        </p>
      </Secao>

      <Secao id="paciente" titulo="Paciente de uma clínica">
        <p>
          Peça à clínica que atende você: ela é a responsável pelos seus dados, e a Nextech trata esses dados em nome
          dela. Se o pedido chegar a nós, encaminhamos à clínica.
        </p>
        <p>Na exclusão, o seu cadastro é anonimizado e o conteúdo das suas conversas é removido.</p>
      </Secao>

      <Secao id="contato-do-site" titulo="Contato deixado no site">
        <p>
          Se você deixou nome, e-mail ou WhatsApp no assistente do site, peça por e-mail e o registro é apagado. Sem
          pedido, ele é apagado automaticamente depois de 12 meses.
        </p>
      </Secao>

      <p>
        Os seus outros direitos estão na <Link href="/privacidade#direitos">política de privacidade</Link>.
      </p>
    </PaginaLegal>
  )
}

import type { Metadata } from "next"
import Link from "next/link"
import { EMPRESA } from "@/components/legal/empresa"
import { EmailDoEncarregado, PaginaLegal, Secao } from "@/components/legal/pagina-legal"

const DESCRICAO =
  "Termos de uso da Nextech: as regras do serviço de assistentes de IA no WhatsApp para clínicas e do uso do site."

export const metadata: Metadata = {
  title: "Termos de uso",
  description: DESCRICAO,
  alternates: { canonical: "/termos" },
  openGraph: { title: "Termos de uso | Nextech", description: DESCRICAO, url: "/termos" },
}

// Um documento só, para o serviço e para o site (docs/specs/legal-pages-v1.md, decisão 4).
export default function TermosDeUso() {
  return (
    <PaginaLegal
      titulo="Termos de uso"
      resumo="As regras do serviço contratado pelas clínicas e do uso deste site."
    >
      <Secao id="partes-e-objeto" titulo="1. Partes e objeto">
        <p>
          Estes termos valem entre <strong>{EMPRESA.nomeEmpresarial}</strong>, CNPJ {EMPRESA.cnpj}, com o nome comercial{" "}
          {EMPRESA.nomeComercial} (&ldquo;Nextech&rdquo;), e a clínica ou o consultório que contrata o serviço
          (&ldquo;clínica&rdquo;). Também valem para quem navega neste site.
        </p>
        <p>
          O serviço é um assistente de inteligência artificial que atende os pacientes da clínica pelo WhatsApp, com um
          painel para a equipe acompanhar e assumir as conversas.
        </p>
      </Secao>

      <Secao id="conta" titulo="2. Conta e papéis">
        <p>
          A conta da clínica tem um responsável, e cada pessoa da equipe tem um papel que define o que ela pode fazer
          no painel. Cada usuário tem acesso pessoal e é responsável por guardar a própria senha. A clínica responde pelo que é feito com as
          contas da sua equipe e deve nos avisar se suspeitar de acesso indevido.
        </p>
      </Secao>

      <Secao id="planos" titulo="3. Planos e limites">
        <p>
          O serviço é oferecido nos planos Starter, Pro e HealthTech. Cada plano tem limites próprios, como o número
          de assistentes e de atendimentos, apresentados na contratação. A cobrança é feita pelo provedor de pagamento
          indicado na contratação.
        </p>
      </Secao>

      <Secao id="obrigacoes-da-clinica" titulo="4. Obrigações da clínica">
        <ul>
          <li>Ser a controladora dos dados dos seus pacientes e ter base legal para tratá-los.</li>
          <li>Informar os pacientes de que o atendimento pelo WhatsApp é feito com um assistente automatizado.</li>
          <li>Conectar só números de WhatsApp que sejam da própria clínica.</li>
          <li>Manter verdadeiras as informações do perfil da clínica, que o assistente usa para responder.</li>
          <li>Cumprir as políticas do WhatsApp Business e da Meta.</li>
        </ul>
      </Secao>

      <Secao id="limites-da-ia" titulo="5. Limites da inteligência artificial">
        <p>
          O assistente não substitui o profissional de saúde, não faz diagnóstico, não prescreve e não é canal de
          emergência. O protocolo de urgência configurado pela clínica encaminha a conversa para a equipe; ele não faz
          triagem clínica. O assistente pode errar, e a equipe da clínica pode assumir qualquer conversa a qualquer
          momento.
        </p>
      </Secao>

      <Secao id="terceiros" titulo="6. Dependência de terceiros">
        <p>
          O serviço depende do WhatsApp Business Platform, da Meta. A Meta pode limitar, suspender ou desligar um
          número por regra própria, sem participação da Nextech.
        </p>
      </Secao>

      <Secao id="disponibilidade" titulo="7. Disponibilidade">
        <p>
          Trabalhamos para manter o serviço no ar, mas não garantimos funcionamento ininterrupto nem um nível mínimo
          de disponibilidade. Manutenções e falhas de fornecedores podem interromper o atendimento.
        </p>
      </Secao>

      <Secao id="propriedade-intelectual" titulo="8. Propriedade intelectual">
        <p>
          O software, a marca e o site da Nextech são da Nextech. A clínica mantém a titularidade do seu conteúdo e
          dos dados dos seus pacientes, e nos autoriza a tratá-los só para prestar o serviço.
        </p>
      </Secao>

      <Secao id="responsabilidade" titulo="9. Limitação de responsabilidade">
        <p>
          A Nextech não responde por decisões clínicas, por informação incorreta cadastrada pela clínica, por
          suspensão de número pela Meta nem por danos indiretos. Nos limites da lei, a responsabilidade da Nextech
          fica limitada ao valor pago pela clínica nos últimos 12 meses.
        </p>
      </Secao>

      <Secao id="encerramento" titulo="10. Suspensão e encerramento">
        <p>
          A clínica pode encerrar o contrato a qualquer momento. A Nextech pode suspender ou encerrar o acesso em caso
          de uso contrário a estes termos, à lei ou às políticas do WhatsApp. Ao fim do contrato, os dados da clínica
          e dos seus pacientes são apagados ou anonimizados, salvo o que a lei obrigar a guardar.
        </p>
      </Secao>

      <Secao id="protecao-de-dados" titulo="11. Proteção de dados">
        <p>
          No tratamento dos dados dos pacientes, a Nextech é operadora e segue as instruções da clínica. Os detalhes
          estão na <Link href="/privacidade">política de privacidade</Link>. Dúvidas: <EmailDoEncarregado />.
        </p>
      </Secao>

      <Secao id="alteracoes" titulo="12. Alterações, lei e foro">
        <p>
          Estes termos podem mudar; a data da última atualização fica no topo da página. Valem as leis do Brasil, e
          fica eleito o foro da comarca de {EMPRESA.sede}.
        </p>
      </Secao>
    </PaginaLegal>
  )
}

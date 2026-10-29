import type { Metadata } from "next"
import Link from "next/link"
import { EMPRESA, PRAZO_DE_RESPOSTA } from "@/components/legal/empresa"
import { EmailDoEncarregado, PaginaLegal, Secao } from "@/components/legal/pagina-legal"

const DESCRICAO =
  "Como a Nextech trata os dados de visitantes, clínicas e pacientes: o que coletamos, para quê, com quem compartilhamos, por quanto tempo e como exercer seus direitos pela LGPD."

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: DESCRICAO,
  alternates: { canonical: "/privacidade" },
  openGraph: { title: "Política de privacidade | Nextech", description: DESCRICAO, url: "/privacidade" },
}

/*
 * Cada afirmação de fato deste texto tem fonte no código ou numa decisão
 * registrada (tabela da seção 1 de docs/specs/legal-pages-v1.md). Fornecedor
 * novo no código muda a seção "Com quem compartilhamos" no mesmo PR
 * (skill lgpd-security).
 */

/** Fornecedores em uso na data da publicação. */
const FORNECEDORES = [
  { nome: "Supabase", finalidade: "banco de dados e autenticação do painel", pais: "EUA" },
  { nome: "Vercel", finalidade: "hospedagem do site e do painel, e métricas agregadas de acesso", pais: "EUA" },
  { nome: "OpenRouter e Google", finalidade: "modelo de inteligência artificial que gera as respostas", pais: "EUA" },
  { nome: "Meta", finalidade: "WhatsApp Business Platform, por onde as mensagens chegam e saem", pais: "EUA" },
  { nome: "Zoho", finalidade: "e-mail da equipe, que recebe os pedidos de titular", pais: "exterior" },
] as const

export default function PoliticaDePrivacidade() {
  return (
    <PaginaLegal
      titulo="Política de privacidade"
      resumo="O que a Nextech faz com os dados pessoais que passam pelo site e pelo produto, escrito a partir do que o sistema realmente faz hoje."
    >
      <Secao id="quem-somos" titulo="1. Quem somos">
        <p>
          A {EMPRESA.nomeComercial} é o nome comercial de <strong>{EMPRESA.nomeEmpresarial}</strong>, inscrita no
          CNPJ {EMPRESA.cnpj}, com sede em {EMPRESA.sede}. Oferecemos assistentes de inteligência artificial no
          WhatsApp para clínicas e consultórios.
        </p>
        <p>
          O encarregado pelo tratamento de dados pessoais é {EMPRESA.encarregado}, pelo e-mail <EmailDoEncarregado />.
        </p>
      </Secao>

      <Secao id="papeis" titulo="2. Os dois papéis da Nextech">
        <ul>
          <li>
            <strong>Controladora</strong> dos dados de quem visita o site, de quem deixa contato pelo assistente do
            site e de quem usa o painel (a equipe das clínicas contratantes).
          </li>
          <li>
            <strong>Operadora</strong> dos dados dos pacientes, que tratamos em nome da clínica que os atende. A
            clínica é a controladora e decide para que esses dados são usados. Pedidos de paciente vão primeiro para a
            clínica; se chegarem à Nextech, nós os encaminhamos a ela.
          </li>
        </ul>
      </Secao>

      <Secao id="dados" titulo="3. Que dados tratamos">
        <ul>
          <li>
            <strong>Visitante do site e do painel:</strong> métricas agregadas de acesso, como páginas vistas, sem
            cookie e sem identificar a pessoa.
          </li>
          <li>
            <strong>Contato pelo assistente do site:</strong> nome, e-mail, WhatsApp, nome da clínica, especialidade e
            volume de consultas, informados pela própria pessoa.
          </li>
          <li>
            <strong>Contato comercial pelo WhatsApp ou por e-mail:</strong> o número ou o endereço e o que a pessoa
            escrever.
          </li>
          <li>
            <strong>Usuário do painel:</strong> nome, e-mail, papel na clínica e registros de acesso.
          </li>
          <li>
            <strong>Paciente da clínica:</strong> telefone, nome do perfil do WhatsApp, conteúdo das mensagens, status
            de entrega, sinal de urgência, pedido para não receber mensagens e registro de consentimento.
          </li>
        </ul>
      </Secao>

      <Secao id="finalidades" titulo="4. Finalidades e bases legais">
        <ul>
          <li>
            <strong>Contato pelo site:</strong> responder ao interesse e apresentar o serviço, como procedimento
            preliminar a um contrato (LGPD, art. 7º, V).
          </li>
          <li>
            <strong>Usuário do painel:</strong> prestar o serviço contratado pela clínica (art. 7º, V).
          </li>
          <li>
            <strong>Paciente:</strong> o dado de saúde é sensível (art. 11), e a base legal é definida pela clínica,
            que é a controladora. A Nextech trata esses dados só para executar o atendimento conforme as instruções da
            clínica.
          </li>
        </ul>
      </Secao>

      <Secao id="inteligencia-artificial" titulo="5. Inteligência artificial e decisões automatizadas">
        <p>
          O assistente da clínica lê a mensagem do paciente, decide se responde e avalia se o paciente tem interesse
          em agendar.
        </p>
        <p>
          A urgência não é decidida pelo assistente. Antes de qualquer resposta, a mensagem de texto é comparada com
          as palavras-chave de urgência que a própria clínica cadastrou e confirmou. Quando há correspondência, o
          paciente recebe o protocolo de urgência definido pela clínica, a conversa passa para a equipe com um alerta
          no painel, e o assistente não responde nela até a equipe marcar a urgência como resolvida.
        </p>
        <p>
          O conteúdo da conversa é enviado ao modelo de inteligência artificial só para gerar a resposta. Exigimos do
          provedor que não guarde esse conteúdo e não o use para treinar modelos.
        </p>
        <p>
          A equipe da clínica pode assumir qualquer conversa a qualquer momento, pelo painel ou respondendo pelo
          WhatsApp do celular. Enquanto a equipe atende, o assistente fica em silêncio; ele volta a responder quando a
          equipe devolve a conversa ou 24 horas depois da última ação da equipe. O paciente pode pedir à clínica que
          uma pessoa revise ou assuma o atendimento (art. 20).
        </p>
      </Secao>

      <Secao id="compartilhamento" titulo="6. Com quem compartilhamos">
        <p>Não vendemos dados. Compartilhamos só com os fornecedores necessários para o serviço funcionar:</p>
        <ul>
          {FORNECEDORES.map((f) => (
            <li key={f.nome}>
              <strong>{f.nome}</strong>: {f.finalidade} ({f.pais}).
            </li>
          ))}
        </ul>
        <p>Quando um fornecedor novo passar a tratar dados, esta lista muda antes de ele entrar em uso.</p>
      </Secao>

      <Secao id="transferencia-internacional" titulo="7. Transferência internacional">
        <p>
          Os dados ficam em servidores fora do Brasil, principalmente nos Estados Unidos, operados pelos fornecedores
          da seção anterior (LGPD, art. 33).
        </p>
      </Secao>

      <Secao id="retencao" titulo="8. Por quanto tempo guardamos">
        <ul>
          <li>
            <strong>Contato pelo site:</strong> até 12 meses. Depois disso, o registro é apagado automaticamente; antes,
            se a pessoa pedir.
          </li>
          <li>
            <strong>Conta do painel:</strong> enquanto durar o contrato da clínica, mais os prazos exigidos por lei.
          </li>
          <li>
            <strong>Dados de pacientes:</strong> enquanto a clínica for cliente. São apagados ou têm o conteúdo
            removido quando a clínica pede.
          </li>
        </ul>
      </Secao>

      <Secao id="direitos" titulo="9. Seus direitos">
        <p>
          Pela LGPD (art. 18), você pode confirmar se tratamos seus dados, acessá-los, corrigi-los, pedir a
          anonimização, o bloqueio ou a exclusão, pedir a portabilidade, saber com quem compartilhamos e revogar o
          consentimento.
        </p>
        <p>
          Para exercer qualquer um deles, escreva para <EmailDoEncarregado />. Respondemos em até {PRAZO_DE_RESPOSTA}{" "}
          (art. 19, II). Como pedir a exclusão, para cada tipo de titular, está em{" "}
          <Link href="/exclusao-de-dados">Exclusão de dados</Link>.
        </p>
        <p>
          Se o paciente for atendido por uma clínica que usa a Nextech, o pedido vai para a clínica, que é a
          controladora (seção 2).
        </p>
        <p>
          Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
        </p>
      </Secao>

      <Secao id="cookies" titulo="10. Cookies">
        <ul>
          <li>
            <strong>Site e painel:</strong> não usam cookie de rastreio nem de publicidade. As métricas de acesso são
            agregadas e não usam cookie.
          </li>
          <li>
            <strong>Painel:</strong> usa os cookies essenciais da sessão de login e um cookie que lembra se o menu
            lateral fica aberto ou fechado.
          </li>
          <li>
            <strong>Preferências locais:</strong> a escolha de tema claro ou escuro fica só no seu navegador e não é
            enviada para nós.
          </li>
        </ul>
        <p>Como não usamos cookie que não seja essencial, não pedimos consentimento para cookies.</p>
      </Secao>

      <Secao id="seguranca" titulo="11. Segurança">
        <ul>
          <li>O conteúdo das mensagens fica cifrado no banco, com chave própria e vinculado à clínica.</li>
          <li>As credenciais que a clínica conecta, como o acesso ao WhatsApp, ficam cifradas no banco.</li>
          <li>
            Cada clínica só enxerga os próprios dados. O isolamento é aplicado no próprio banco, e o acesso exige uma
            sessão de login ativa.
          </li>
          <li>Os registros técnicos do sistema não guardam conteúdo de mensagem nem dado de paciente.</li>
          <li>
            O acesso da equipe da Nextech às conversas de uma clínica pelo painel de suporte exige justificativa, tem
            prazo e fica registrado numa trilha de auditoria.
          </li>
          <li>Quando um paciente pede a exclusão, o conteúdo das conversas dele é removido.</li>
          <li>
            O pedido do paciente para sair das mensagens de acompanhamento é registrado na hora e vale para todas elas,
            não só para a que ele respondeu.
          </li>
        </ul>
      </Secao>

      <Secao id="alteracoes" titulo="12. Alterações">
        <p>
          Esta política muda quando o produto muda. A data da última atualização fica no topo da página.
        </p>
      </Secao>
    </PaginaLegal>
  )
}

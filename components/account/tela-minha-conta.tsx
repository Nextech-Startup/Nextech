import type { ReactNode } from "react"
import { MailCheck } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Botao, Campo, Input } from "@/components/patterns/formulario"
import { ListaDeDados } from "@/components/patterns/lista-de-dados"
import { PageHeader } from "@/components/patterns/page-header"
import { formatarData, tempoRelativo } from "@/lib/formatters/data"
import { ROTULO_DO_PAPEL } from "@/lib/navigation/landing"
import { EscolhaDeTema } from "./escolha-de-tema"
import type { MinhaConta } from "./tipos"

/** Título e descrição à esquerda em telas largas, conteúdo à direita. */
function Secao({
  id,
  titulo,
  descricao,
  children,
}: {
  id: string
  titulo: string
  descricao: string
  children: ReactNode
}) {
  return (
    <section
      aria-labelledby={id}
      className="grid gap-5 border-t border-hairline pt-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10"
    >
      <div className="grid content-start gap-1">
        <h2 id={id} className="text-[0.9375rem] font-semibold text-ink-1">
          {titulo}
        </h2>
        <p className="text-sm text-ink-2">{descricao}</p>
      </div>
      <div className="grid min-w-0 content-start gap-5">{children}</div>
    </section>
  )
}

/**
 * A conta de quem está logado: perfil, acesso, aparência e senha. Trocar
 * e-mail e senha pede confirmação por e-mail, e por isso espera o envio
 * transacional. O tema é o único controle vivo: é preferência do
 * navegador, não dado de negócio.
 */
export function TelaMinhaConta({
  conta,
  agora,
  acaoDesabilitada,
}: {
  conta: MinhaConta
  agora: string
  acaoDesabilitada?: string
}) {
  const responsavel = conta.papel === "owner"

  return (
    <div className="grid max-w-4xl gap-8">
      <PageHeader title="Minha conta" description="Seus dados de acesso e suas preferências neste painel." />

      <Secao id="perfil-titulo" titulo="Perfil" descricao="Como a equipe vê você no painel.">
        <div className="grid max-w-md gap-4">
          <Campo label="Nome">
            <Input
              name="nome"
              defaultValue={conta.nome ?? undefined}
              autoComplete="name"
              disabled={Boolean(acaoDesabilitada)}
              title={acaoDesabilitada}
            />
          </Campo>
          <div className="grid gap-1.5">
            <Campo label="E-mail">
              <Input type="email" value={conta.email} readOnly className="text-ink-2" />
            </Campo>
            <p className="text-xs leading-relaxed text-ink-3">
              Trocar o e-mail pede confirmação no endereço novo, e chega com o envio de e-mail.
            </p>
          </div>
        </div>
        <Botao type="button" disabled={Boolean(acaoDesabilitada)} title={acaoDesabilitada} className="w-fit">
          Salvar
        </Botao>
      </Secao>

      <Secao
        id="acesso-titulo"
        titulo="Acesso"
        descricao={
          responsavel
            ? "Como responsável, você define o papel de cada pessoa em Equipe."
            : "Seu papel é definido pelo responsável pela clínica."
        }
      >
        <ListaDeDados
          colunas={2}
          itens={[
            { termo: "Clínica", valor: conta.clinica },
            { termo: "Papel", valor: ROTULO_DO_PAPEL[conta.papel] },
            {
              termo: "Último acesso",
              valor: conta.ultimoAcesso ? tempoRelativo(conta.ultimoAcesso, agora) : "Primeiro acesso",
            },
          ]}
        />
      </Secao>

      <Secao id="aparencia-titulo" titulo="Aparência" descricao="Vale só para este navegador.">
        <EscolhaDeTema />
      </Secao>

      <Secao
        id="senha-titulo"
        titulo="Senha"
        descricao={
          conta.senhaAlteradaEm
            ? `Senha alterada em ${formatarData(conta.senhaAlteradaEm)}.`
            : "Senha nunca alterada."
        }
      >
        <Alert role="note" className="max-w-md border-info-border bg-info-bg text-info-fg">
          <MailCheck aria-hidden="true" />
          <AlertDescription className="text-info-fg">
            A troca de senha manda um link de confirmação para o seu e-mail. Fica disponível quando o
            envio de e-mail entrar no ar.
          </AlertDescription>
        </Alert>
        <div className="grid max-w-md gap-4">
          <Campo label="Senha atual">
            <Input type="password" name="senha-atual" autoComplete="current-password" disabled title={acaoDesabilitada} />
          </Campo>
          <Campo label="Nova senha">
            <Input type="password" name="senha-nova" autoComplete="new-password" disabled title={acaoDesabilitada} />
          </Campo>
          <Campo label="Confirme a nova senha">
            <Input type="password" name="senha-confirmacao" autoComplete="new-password" disabled title={acaoDesabilitada} />
          </Campo>
        </div>
        <Botao type="button" variante="secundario" disabled title={acaoDesabilitada} className="w-fit">
          Trocar senha
        </Botao>
      </Secao>
    </div>
  )
}

/**
 * O nome que a tela mostra de um membro da equipe. O painel ainda não tem
 * nome de membro, só o e-mail do Auth: a parte antes do @, em palavras.
 * "marina.souza@…" vira "Marina Souza", e a linha do tempo diz "Marina moveu".
 */
export function nomeDoMembro(email: string | null): string {
  const local = email?.split("@")[0] ?? ""
  const palavras = local.split(/[._+-]+/).filter(Boolean)
  if (palavras.length === 0) return "Equipe"
  return palavras.map((p) => p[0].toUpperCase() + p.slice(1)).join(" ")
}

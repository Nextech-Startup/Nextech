# Spec: Acesso e Onboarding (v1)

## Objetivo
Definir quem entra no produto, como, e com que nível de acesso — antes de desenhar qualquer tela de cadastro.

## Decidido
- **Onboarding é consultivo**: a equipe do Nextech configura o perfil da clínica junto com ela, não é signup self-service. O `(admin)` precisa de uma função de "criar clínica" que a equipe usa durante o onboarding, preenchendo (ou ajudando a preencher) o `clinic-profile-v1.md` junto com o cliente.
- **Verificação do Meta Business é assistida pela equipe Nextech** durante o onboarding. Nuance técnica: o Embedded Signup exige autorização de quem tem acesso administrativo ao Meta Business Portfolio da própria clínica — então "a equipe faz isso por ela" na prática é conduzir a conexão numa sessão junto com alguém da clínica que tenha esse acesso, não a Nextech operando sozinha sem a clínica presente.
- **Acesso por papel dentro da clínica** (`ClinicMember`):
  - `owner` — dono/gestor, acesso total, incluindo dado regulatório e consentimento
  - `staff` — recepção, vê conversas e agenda, não edita configuração regulatória
  - `professional` — profissional de saúde, vê só a própria agenda e os próprios pacientes
  - Implementado como tabela de junção sobre o Supabase Auth — não precisa de outro provedor de auth só por causa disso.

## Modelo de dados
### ClinicMember
- `id`, `clinic_id`, `user_id`, `role` (`owner` | `staff` | `professional`)
- Se `role = professional`, referencia o registro correspondente em `Professional` (`clinic-profile-v1.md`)

## Comportamento
1. Equipe Nextech cria a clínica no `(admin)` durante o onboarding e convida o primeiro `owner`.
2. `owner` convida `staff` e vincula `professional` aos profissionais já cadastrados no perfil da clínica.
3. RLS de cada tabela sensível considera não só `clinic_id`, mas também `role` quando o dado for restrito (ex: dado regulatório só editável por `owner`).

## Em aberto
- Matriz completa de permissão por role (o que cada um pode ver/editar em cada tela) ainda não foi definida campo a campo — fica pra quando desenhar cada tela específica.
- Fluxo exato de convite (provavelmente e-mail via Resend) ainda não especificado.

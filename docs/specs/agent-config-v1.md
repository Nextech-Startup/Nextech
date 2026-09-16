# Spec: Configuração de Agente (v1)

## Objetivo
Permitir que uma clínica crie e configure um ou mais agentes de IA (um por especialidade/unidade), com escopo simples o suficiente pra funcionar já na v1, e teste a conversa antes de publicar.

## Escopo v1 (mínimo viável)
Uma clínica pode ter N agentes. Cada agente tem:
- `name` — rótulo interno (ex: "Recepção — Odontologia")
- `specialty` — uma das especialidades do catálogo Nextech (Clínicas Médicas, Odontologia, Estética & Dermato, Laboratórios, Nutrição, Fisioterapia, Saúde Mental)
- `persona_instructions` — texto livre descrevendo tom e comportamento do agente
- `greeting_message` — primeira mensagem enviada ao paciente
- `business_hours` — horário de atendimento humano (usado pra saber quando oferecer handoff)
- `handoff_enabled` + `handoff_message` — se/como a IA encaminha para atendente humano
- `whatsapp_phone_number_id` — identificador do número WhatsApp (API oficial da Meta, Cloud API) vinculado a este agente (nullable até conectar)
- `whatsapp_waba_id` — id da WhatsApp Business Account da clínica na Meta (nullable até conectar)
- `whatsapp_access_token` — credencial obtida via Embedded Signup com coexistência (nullable até conectar; **segredo por tenant, criptografado em repouso** — ver skill `lgpd-security`)
- `status` — `draft` | `active` | `paused`

Fora do escopo v1 (fica pra depois): perguntas de qualificação estruturadas, base de FAQ, canais além de WhatsApp. Templates de lembrete/reengajamento **entram** na v1 — ver `docs/specs/whatsapp-templates-v1.md` para o desenho completo desse fluxo.

## Comportamento
1. Clínica cria um agente → nasce em `draft`.
2. Formulário de configuração preenche os campos acima.
3. Botão "Testar" abre um preview de chat que roda a conversa **sem persistir nada e sem exigir save prévio** — o payload atual do formulário é enviado direto pro endpoint de preview.
4. Botão "Salvar" persiste o registro do agente (continua em `draft` se nunca foi publicado).
5. Botão "Publicar" muda `status` pra `active` — só a partir daqui o agente responde tráfego real do WhatsApp (assumindo `whatsapp_phone_number_id` conectado).
6. Um agente pode ser pausado (`status = paused`) sem perder a configuração.

## Edge cases
- Publicar sem `whatsapp_phone_number_id` conectado → bloqueado, com mensagem clara do que falta.
- Duas clínicas nunca compartilham `whatsapp_phone_number_id` — validado na camada de integrações.
- Mensagem enviada fora da janela de atendimento de 24h precisa ser um template aprovado pela Meta — texto livre não funciona nesse caso.
- Coexistência: se um humano responde pelo WhatsApp Business App da própria clínica, isso chega como evento de eco no Cloud API — a IA para de responder automaticamente naquela conversa. Regra exata de quando a IA volta a responder (manual vs. inatividade) fica pra spec do motor de conversa (fase 3 do roadmap), mas o campo `handoff_enabled` desta v1 já assume que esse tipo de handoff "espontâneo" pode acontecer, não só o handoff que a própria IA decide fazer.
- Preview roda com dado fictício/sintético, nunca com histórico real de paciente, e não deve gerar custo relevante de IA (limitar turnos do preview).
- Editar um agente `active` só vale depois de publicar de novo — não em tempo real, pra não quebrar conversa em andamento. Aceito como risco documentado na v1.

## Critério de aceite
- [x] Clínica autenticada consegue criar, editar e publicar um agente.
- [x] RLS garante que uma clínica não lista/edita agente de outra.
- [ ] ~~Preview roda uma conversa simulada de pelo menos 3 turnos~~ — **adiado para a fase 3b**: depende do motor de IA, que não existe. A tela mostra o cartão "Testar conversa" como inerte em vez de esconder o que esta spec promete.
- [x] Publicar sem WhatsApp conectado é bloqueado com mensagem clara — por trigger no banco, não só pela aplicação.
- [x] Teste automatizado cobre: isolamento entre clínicas, bloqueio de publish sem instância conectada.

> **Entregue em 2026-09-16** (branch `staging`), menos o preview. 92 testes:
> 21 de criptografia, 34 de schema, 37 de RLS contra o banco real.

## Planos afetados
O painel de configuração existe em todos os planos (Starter/Pro/HealthTech) — é a base do produto, não diferencial de plano superior.

## Em aberto (decidir antes de codar)
- ~~**Assunção 1 agente = 1 número WhatsApp**~~ — **confirmada** em 2026-09-16. O `whatsapp_phone_number_id` é coluna de `agents`, com UNIQUE global. Se o caso de N agentes num número aparecer, a migração é extrair `whatsapp_connections` — contida e sem perda de dado.
- ~~**Limite de agentes por plano**~~ — **decidido**: Starter 1, Pro 3, HealthTech ilimitado, por trigger no banco. Obrigou a criar `clinics.plan`, o primeiro pedaço do modelo de billing. Os números são revisáveis antes do billing v2; a modelagem, não.
- **Mudança de cobrança da Meta em 1º/out/2026**: mensagem de serviço dentro da janela de 24h deixa de ser gratuita. Precisa entrar no cálculo de custo por atendimento antes de fechar o preço dos planos Starter/Pro/HealthTech.
- **Entidade de conversa/ownership**: coexistência exige rastrear se uma conversa está sendo respondida pela IA ou por um humano (via eco do app). Essa modelagem (provavelmente um `Conversation` por paciente+agente, com campo `handled_by: ai | human`) não é escopo desta spec — pertence à spec do motor de conversa (fase 3 do roadmap) — mas o campo `handoff_enabled` aqui definido depende dela em runtime.

## Decidido
- Conexão do WhatsApp: Cloud API direta da Meta, sem BSP — cada clínica verifica o próprio Meta Business e fornece a própria credencial no painel.
- Templates de mensagem para fora da janela de 24h entram na v1 — ver `docs/specs/whatsapp-templates-v1.md`.

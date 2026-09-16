---
name: integrations
description: Contrato comum para integrações externas do Nextech — WhatsApp (Cloud API/coexistência), CRM (Pipedrive, Kommo, RD Station, Doctoralia), Google Calendar, IA via OpenRouter e e-mail via Resend. Use ao adicionar, alterar ou depurar qualquer integração externa.
---

# Integrações — Nextech

## Contrato de CRM adapter
Toda integração de CRM vive em `lib/crm-adapters/<provider>.ts` e implementa a mesma interface, por exemplo:

```ts
interface CrmAdapter {
  syncLead(clinicId: string, lead: LeadData): Promise<void>;
  updateDealStage(clinicId: string, dealId: string, stage: string): Promise<void>;
}
```

Nenhum código de rota ou UI deve saber qual provider está por trás — sempre chama a interface, nunca o provider concreto diretamente.

## Providers conhecidos (v1)
- Pipedrive
- Kommo
- RD Station
- Doctoralia

Cada um tem seu próprio limite de taxa e formato de erro — documentar quirks específicos de cada provider dentro do próprio arquivo do adapter conforme forem descobertos, não num lugar central genérico.

## WhatsApp (API oficial da Meta — Cloud API)
- Cliente centralizado em `lib/whatsapp/client.ts`. Cada agente é identificado por um `phone_number_id` da Meta — não existe mais o conceito de "instância" (isso era específico do Evolution API, removido do projeto).
- Webhook de entrada em `app/api/whatsapp/webhook/route.ts`, fino — valida a assinatura (`X-Hub-Signature-256`), normaliza e repassa pro `lib`.
- **Janela de atendimento de 24h**: mensagem livre (não-template) só pode ser enviada em resposta a uma mensagem do paciente nas últimas 24h. Fora da janela, é obrigatório um template de mensagem pré-aprovado pela Meta — usado em lembrete de consulta e reengajamento de quem parou de responder.
- **Mudança de cobrança a partir de 1º de outubro de 2026**: mensagem de serviço dentro da janela de 24h deixa de ser gratuita — a Meta passa a cobrar por mensagem também nesse caso. Precisa entrar no custo por atendimento antes de fechar preço dos planos.
- Áudio recebido passa por transcrição antes de qualquer processamento de IA (ver `lgpd-security` sobre consentimento de retenção).
- Conexão usa **Coexistência**: o número da clínica continua funcionando no WhatsApp Business App do celular normalmente, enquanto o Nextech opera via Cloud API no mesmo número. A conexão é feita por **Embedded Signup com a opção de coexistência** — não é colar um token manualmente, o fluxo padrão de Embedded Signup desconectaria o app. O app do Nextech na Meta precisa ter permissão de Embedded Signup configurada.
- Requisitos de coexistência: WhatsApp Business App na versão 2.24.17+ no celular da clínica, número continua registrado no app, negócio verificado no Meta Business Manager.
- Throughput fixo de 20 mensagens/segundo em número de coexistência — a fila de envio em `lib/whatsapp/` respeita esse limite.
- **Detecção de humano assumindo a conversa**: mensagem enviada pelo app da clínica chega no Cloud API como evento de eco (espelhamento). É assim que o sistema sabe que um humano já respondeu e a IA deve parar de responder automaticamente naquela conversa. Mensagem enviada pelo app **não abre nem estende** a janela de 24h — só mensagem do paciente faz isso.
- Se a clínica trocar de celular ou reinstalar o app, a Meta desconecta o companion do Cloud API automaticamente (webhook `ACCOUNT_OFFBOARDED`) e pode reconectar sozinha depois (webhook `ACCOUNT_RECONNECTED`) — o sistema trata os dois eventos, nunca assume que a conexão é permanente.
- Template de mensagem (lembrete, reengajamento) segue fluxo próprio de criação, submissão e aprovação pela Meta — ver `docs/specs/whatsapp-templates-v1.md`. Nunca usar texto livre como fallback quando um template esperado não está aprovado.

## Google Calendar
- OAuth por clínica — nunca uma conta única do Nextech. Cada clínica autoriza o próprio Google Calendar.
- Token (access + refresh) é credencial por tenant — criptografado em repouso, mesma regra do token de WhatsApp (ver skill `lgpd-security`).
- Cliente centralizado em `lib/scheduling/google-calendar.ts`. Renovação de token tratada nesse arquivo, nunca ad hoc onde o calendário é consultado.

## IA / LLM (OpenRouter)
- Cliente centralizado em `lib/ai/client.ts`. Modelo (padrão: Gemini 2.5 Flash) é valor de configuração, nunca hardcoded — o OpenRouter existe justamente pra poder trocar de modelo/provedor sem reescrever a integração.
- Chave da API do OpenRouter é segredo de infraestrutura do Nextech (não por tenant) — variável de ambiente.
- Mecanismo de cache de prompt do Gemini é diferente do `cache_control` da Anthropic — confirmar a sintaxe atual na documentação do OpenRouter/Google antes de implementar, não assumir que o padrão de outra API se aplica igual.
- OpenRouter cobra uma margem sobre o preço do provedor subjacente — confirmar o percentual atual antes de fechar a conta de custo por atendimento junto com o custo do WhatsApp.

## E-mail (Resend)
- Cliente centralizado em `lib/email/client.ts`.
- Domínio de envio transacional separado do domínio de e-mail humano da empresa (Zoho) — normalmente um subdomínio dedicado (ex: `mail.nextech.ia.br`), pra isolar reputação de envio automatizado da reputação do e-mail corporativo. Ver `docs/infra-setup.md`.
- Chave da API do Resend é segredo de infraestrutura do Nextech — variável de ambiente.

## Ao adicionar um provider novo
1. Confirmar que ele cabe na interface `CrmAdapter` existente. Se não cabe, discutir se a interface precisa evoluir (não criar uma segunda interface paralela).
2. Sandbox de teste do provider, se existir, configurado separado em staging.
3. Teste automatizado do adapter usando mock da API do provider — nunca bater na API real do provider durante CI.

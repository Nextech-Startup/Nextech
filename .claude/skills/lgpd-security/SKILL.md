---
name: lgpd-security
description: Regras de segurança e LGPD para dado de saúde no Nextech — mensagens de paciente, áudio, transcrição, consentimento. Use sempre que a tarefa tocar em dado de paciente, mensagem de WhatsApp, áudio ou qualquer PII.
---

# LGPD & Segurança — Nextech

Dado de paciente é dado sensível de saúde. O rigor prometido no plano HealthTech (criptografia avançada, SSO, LGPD) é o piso do produto desde o Starter — não um upgrade de plano superior.

## Regras
1. Nunca logar conteúdo de mensagem, transcrição de áudio ou campo de paciente em texto puro — nem em `console.log`, nem em ferramenta de observabilidade. Logar apenas metadados (id, timestamp, status).
2. Dado de paciente em repouso é criptografado. Campos sensíveis (nome completo, telefone, conteúdo clínico mencionado em conversa) marcados explicitamente na migration SQL com comentário `-- PII` na linha da coluna.
3. Transcrição de áudio só é persistida se houver consentimento registrado do paciente na conversa. Sem consentimento, processa em memória e descarta.
4. Toda leitura de dado de paciente fora do fluxo normal (suporte, debug) gera registro de auditoria: quem acessou, quando, qual registro.
5. Política de retenção: dado de conversa tem prazo de retenção configurável por clínica; passado o prazo, é anonimizado ou apagado — nunca mantido indefinidamente "só por garantia".
6. Segredos de infraestrutura (chave de API do OpenRouter, do Resend, credenciais internas) só em variável de ambiente, nunca hardcoded nem commitado, mesmo em branch de teste.
7. Credencial de terceiro que pertence a uma clínica específica (token de acesso do WhatsApp da própria clínica, tokens OAuth do Google Calendar, futura chave de CRM) é diferente de segredo de infraestrutura — não é variável de ambiente, é dado armazenado por tenant. Esse tipo de credencial é criptografado em repouso no banco (nunca em texto puro, nem no Supabase), acessado só pela camada de integrações, e nunca exposto em log, resposta de API ou tela de configuração depois de salvo (mostrar só um indicador de "conectado", não o valor).
8. Opt-out de sequência de mensagem (recall, reativação, follow-up — categoria `MARKETING`) é um pedido do paciente sobre o próprio dado (contato) e vale imediatamente e em todas as sequências, não só na que ele respondeu. Paciente marcado como opted-out nunca é reinscrito automaticamente — só reversível por ação explícita da clínica, nunca reativado sozinho pelo sistema.

## Ao revisar código
Rejeitar qualquer PR que:
- imprima ou logue conteúdo de mensagem/paciente sem mascarar;
- adicione tabela com dado de paciente sem RLS por `clinic_id`;
- adicione integração externa sem revisar quais dados saem da nossa infraestrutura.

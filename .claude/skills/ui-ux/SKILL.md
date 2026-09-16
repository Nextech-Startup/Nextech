---
name: ui-ux
description: Sistema visual do Nextech — tema, tom, padrões de componente (chat, cards de status). Use ao criar ou alterar qualquer tela do painel.
---

# UI/UX — Nextech

## Tema
- Mesmo repositório da landing page — reaproveitar direto o `tailwind.config` / `globals.css` / tokens de cor já existentes no código. Não recriar paleta do zero.
- Modo escuro como padrão (`#09090b` de fundo), consistente com a landing page.
- Tom visual: profissional, direto, sem excesso de ornamento — o público é dono/gestor de clínica, não é usuário técnico.

## Padrões de componente
- Conversas exibidas como bolhas de chat estilo WhatsApp (remetente à direita, paciente à esquerda).
- Eventos automatizados (agendamento confirmado, notificação enviada, CRM atualizado) exibidos como cards de status curtos com ícone de confirmação — não como texto corrido.
- Painel "ao vivo": mudança de estado (novo lead, qualificado, agendado) deve refletir em tempo real, não exigir refresh manual.

## Acessibilidade e clareza
- Todo dashboard precisa comunicar em uma linha o que o dono da clínica mais quer saber: quantos atendimentos, quantos agendados, quantos perdidos. Não esconder isso atrás de cliques.
- Textos em português claro, sem jargão técnico — quem usa é recepção/gestão de clínica.

## Editor de agente
- Tela de configuração de agente sempre mostra formulário e preview de chat lado a lado (ou em abas no mobile) — a clínica precisa ver o efeito da mudança antes de publicar.
- Preview roda com dado fictício, nunca com conversa real de paciente.
- Estado do agente (`draft` / `active` / `paused`) sempre visível como badge no topo da tela — a clínica não pode se confundir sobre se o agente está no ar.

## Ao criar uma tela nova
Perguntar: essa informação ajuda o dono da clínica a agir agora, ou é só dado bonito? Se for só dado bonito, repensar antes de construir.

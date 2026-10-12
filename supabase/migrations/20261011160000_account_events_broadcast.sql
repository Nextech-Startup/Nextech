-- Motor de conversa, parte 4: o aviso de desconexão também chega ao vivo.
--
-- A desconexão da Meta (ACCOUNT_OFFBOARDED) grava em
-- whatsapp_account_events, e não em conversations: sem número, nenhuma
-- mensagem chega para disparar o aviso do canal, e a clínica só veria a
-- faixa ao recarregar a página. Achado da revisão de QA (2026-10-11).
--
-- O mesmo aviso sem dado, pelo mesmo canal privado da clínica: a tela relê
-- e a faixa aparece (ou some, na reconexão). A função já desiste em 200 ms
-- de trava e engole o erro do realtime.send (20261011150000).

create trigger whatsapp_account_events_broadcast
  after insert on public.whatsapp_account_events
  for each row
  execute function private.broadcast_conversation_change();

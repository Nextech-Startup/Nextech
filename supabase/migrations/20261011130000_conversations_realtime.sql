-- Motor de conversa, parte 4: a tela de Conversas em tempo real.
--
-- A conversa entra na publicação do Realtime. O navegador só escuta: cada
-- mudança faz a página pedir um refresh, e o servidor redesenha a tela já
-- com o conteúdo decifrado.
--
-- Por que conversations, e não messages: toda mensagem nova (do paciente,
-- eco do celular ou resposta da IA) também atualiza a conversa
-- (last_message_at), e o payload dela só tem estado: ids, quem atende,
-- urgência e datas. Nenhum conteúdo, nem cifrado, passa pelo Realtime.
--
-- O isolamento é a RLS de select de conversations, que o Realtime aplica a
-- cada assinante (tests/rls/conversas-realtime.test.ts assina sem filtro e
-- prova que a outra clínica não chega).

alter publication supabase_realtime add table public.conversations;

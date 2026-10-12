-- Motor de conversa, parte 4: o tempo real da tela de Conversas passa do
-- postgres_changes para o Broadcast privado (decisão do Jhones, 2026-10-11).
--
-- Por quê: com conversations na publicação (20261011130000), o Realtime
-- mandava a QUALQUER assinante anônimo um envelope vazio com "Error 401" a
-- cada mudança de conversa de qualquer clínica. Sem id nem dado, mas com a
-- hora da atividade da plataforma. Outra clínica logada não recebia nada,
-- porque a RLS filtrava em silêncio; o anônimo recebia o envelope porque
-- não tem select na tabela.
--
-- Agora:
-- - a conversa sai da publicação;
-- - um trigger manda um aviso sem dado ao tópico conversas:<clinic_id>, por
--   realtime.send, com private = true. O realtime.send engole o próprio
--   erro (vira WARNING): o aviso nunca derruba a gravação da mensagem;
-- - só membro da clínica entra no canal privado desse tópico, pela policy
--   em realtime.messages. Quem está de fora não entra, e não recebe nem o
--   envelope. A autorização é feita na entrada do canal, e não a cada
--   mudança para cada assinante.
--
-- O navegador continua só escutando: o aviso faz a página pedir um
-- refresh, e o servidor redesenha a tela já decifrada.

alter publication supabase_realtime drop table public.conversations;

-- ─────────────────────────────────────────────────────────────
-- O aviso: "alguma conversa desta clínica mudou", sem dado
-- ─────────────────────────────────────────────────────────────
create function private.broadcast_conversation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send('{}'::jsonb, 'conversa', 'conversas:' || new.clinic_id::text, true);
  return null;
end;
$$;

revoke execute on function private.broadcast_conversation_change() from public, anon, authenticated;

-- Toda mensagem nova (do paciente, eco do celular, resposta da IA) e toda
-- ação do painel passam por um insert ou update da conversa.
create trigger conversations_broadcast_change
  after insert or update on public.conversations
  for each row
  execute function private.broadcast_conversation_change();

-- ─────────────────────────────────────────────────────────────
-- Quem entra no canal privado: membro da clínica do tópico
-- ─────────────────────────────────────────────────────────────
-- Compara o tópico como texto, sem cast para uuid: um tópico malformado
-- não vira erro, só não casa.
create policy "membro recebe o aviso das conversas da própria clínica"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) in (
      select 'conversas:' || c::text from private.current_clinic_ids() as c
    )
  );

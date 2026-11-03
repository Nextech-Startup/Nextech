-- Páginas legais (docs/specs/legal-pages-v1.md, seção 7): o lead do chatbot
-- da landing é guardado por até 12 meses, como a política de privacidade
-- promete. Job só de banco, então fica no pg_cron (padrão do CLAUDE.md).
--
-- A tabela só tem created_at, e é dele que os 12 meses contam. Linha com
-- created_at nulo (a coluna tem default, mas aceita nulo) conta como antiga:
-- sem data, não há como provar que está no prazo, e guardá-la para sempre
-- quebraria a promessa.

create function public.delete_expired_chatbot_leads()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total integer;
begin
  delete from public.chatbot_leads l
   where l.created_at is null
      or l.created_at < now() - interval '12 months';

  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

comment on function public.delete_expired_chatbot_leads() is
  'Apaga o lead do chatbot da landing com created_at de mais de 12 meses, '
  'ou nulo (política de privacidade, seção 8). Roda pelo pg_cron.';

-- Mesmo padrão da manutenção do motor: o postgres (dono) roda o cron; o
-- service_role, os testes. O Supabase concede EXECUTE a anon e authenticated
-- por padrão em função nova do schema public.
revoke execute on function public.delete_expired_chatbot_leads() from public, anon, authenticated;
grant execute on function public.delete_expired_chatbot_leads() to service_role;

-- Uma vez por dia, às 4h UTC (1h em Brasília). Por nome: reaplicar atualiza
-- o job, não duplica.
select cron.schedule(
  'nextech-apagar-leads-vencidos',
  '0 4 * * *',
  $$select public.delete_expired_chatbot_leads()$$
);

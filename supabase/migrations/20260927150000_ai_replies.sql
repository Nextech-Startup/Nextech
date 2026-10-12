-- Motor de conversa, parte 2: resposta da IA, custo e entrega.
--
-- Referências:
--   docs/specs/conversation-engine-v1.md (comportamentos 3, 5 e 7; instrumentação de custo)
--   docs/specs/atendimento-billing-v1.md (contagem de respostas, fechamento por contagem)
--   docs/superpowers/plans/2026-09-27-motor-de-conversa-parte-2.md (tarefa 6)
--
-- A resposta da IA é gravada antes do envio (`pending`), com uma trava de
-- uma resposta por mensagem do paciente, e confirmada depois dele. Enviar e
-- só então gravar perderia o histórico e a contagem se a gravação falhasse
-- depois de o paciente já ter recebido a mensagem.
--
-- Quem chama estas funções é o webhook, com service_role. A equipe da
-- clínica continua só lendo `messages` e `conversations`.
--
-- Banco compartilhado com a landing: aditivo. As colunas novas são nulas e
-- sem default, e os checks valem para as linhas existentes, nenhuma da IA.

create type public.message_delivery_status as enum ('pending', 'sent', 'delivered', 'read', 'failed');
create type public.message_category as enum ('SERVICE', 'MARKETING', 'UTILITY');

alter table public.messages
  add column delivery_status public.message_delivery_status,
  add column delivery_updated_at timestamptz,
  -- Só o código da Meta ou do nosso client ("131047", "http-503"), nunca a
  -- mensagem do erro, que cita o número do paciente.
  add column delivery_error_code text
    check (delivery_error_code is null or length(delivery_error_code) between 1 and 40),
  -- Instrumentação de custo (conversation-engine-v1): gravada no envio,
  -- porque a regra de cobrança da Meta muda de data.
  add column category public.message_category,
  add column within_24h_window boolean,
  add column billable boolean,
  add column reply_to_message_id uuid;

comment on column public.messages.reply_to_message_id is
  'Mensagem do paciente que esta resposta da IA responde. Única: é a trava '
  'contra duas respostas para a mesma mensagem.';
comment on column public.messages.billable is
  'Se a Meta cobra esta mensagem, pela regra vigente na data do envio '
  '(lib/conversations/custo.ts). Não recalcular na leitura.';

alter table public.messages
  add constraint messages_id_clinic_id_key unique (id, clinic_id),
  -- A resposta aponta para mensagem da mesma clínica, por construção.
  add constraint messages_resposta_a
    foreign key (reply_to_message_id, clinic_id)
    references public.messages(id, clinic_id) on delete cascade,
  add constraint messages_resposta_da_ia_instrumentada check (
    author <> 'ai' or (
      delivery_status is not null
      and category is not null
      and within_24h_window is not null
      and billable is not null
      and reply_to_message_id is not null
    )
  ),
  add constraint messages_erro_so_na_falha
    check (delivery_error_code is null or delivery_status = 'failed');

-- Uma resposta por mensagem do paciente. Serve também de índice da FK.
create unique index messages_uma_resposta_por_mensagem
  on public.messages (reply_to_message_id)
  where reply_to_message_id is not null;

alter table public.conversations
  add column ai_failed_at timestamptz;

comment on column public.conversations.ai_failed_at is
  'Última falha da IA ou do envio, que passou a conversa para a equipe. É o '
  'marco do alerta no painel e, com human_took_over_at, da retomada em 24h.';

-- ─────────────────────────────────────────────────────────────
-- Reserva da resposta
-- ─────────────────────────────────────────────────────────────
-- Devolve nulo quando a mensagem do paciente já tem resposta: outra
-- execução chegou antes, e esta desiste sem enviar nada.
create function public.reserve_ai_reply(
  p_clinic_id uuid,
  p_conversation_id uuid,
  p_reply_to_message_id uuid,
  p_content_encrypted text,
  p_occurred_at timestamptz,
  p_within_window boolean,
  p_billable boolean
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.messages m
    where m.id = p_reply_to_message_id
      and m.clinic_id = p_clinic_id
      and m.conversation_id = p_conversation_id
      and m.author = 'patient'
  ) then
    raise exception 'A resposta da IA responde a uma mensagem do paciente da mesma conversa.'
      using errcode = '22023';
  end if;

  insert into public.messages as m (
    clinic_id, conversation_id, direction, author, content_encrypted, media_type,
    occurred_at, delivery_status, delivery_updated_at,
    category, within_24h_window, billable, reply_to_message_id
  )
  values (
    p_clinic_id, p_conversation_id, 'outbound', 'ai', p_content_encrypted, 'text',
    p_occurred_at, 'pending', p_occurred_at,
    'SERVICE', p_within_window, p_billable, p_reply_to_message_id
  )
  on conflict (reply_to_message_id) where reply_to_message_id is not null do nothing
  returning m.id into v_id;

  return v_id;
end;
$$;

comment on function public.reserve_ai_reply(uuid, uuid, uuid, text, timestamptz, boolean, boolean) is
  'Grava a resposta da IA como pending antes do envio. Nulo: a mensagem do '
  'paciente já tinha resposta. Só o webhook (service_role) chama.';

-- ─────────────────────────────────────────────────────────────
-- Confirmação do envio, com a contagem de atendimento
-- ─────────────────────────────────────────────────────────────
-- Uma transação para a mensagem, a sessão e a conversa. Idempotente: uma
-- resposta já confirmada não conta de novo (devolve zero linhas). Sem
-- sessão aberta, só a mensagem e a conversa mudam: resposta da IA não abre
-- sessão (atendimento-billing-v1, regra 1).
create function public.confirm_ai_reply(
  p_clinic_id uuid,
  p_message_id uuid,
  p_wa_message_id text,
  p_sent_at timestamptz
)
returns table (ai_response_count integer, session_closed boolean)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_conversa uuid;
  v_sessao uuid;
  v_contagem integer;
begin
  if p_wa_message_id is null or length(trim(p_wa_message_id)) = 0 then
    raise exception 'A confirmação precisa do id da Meta.' using errcode = '22023';
  end if;

  update public.messages m
     set wa_message_id = p_wa_message_id,
         delivery_status = 'sent',
         delivery_updated_at = p_sent_at,
         -- A ordem da conversa segue o envio, e não a reserva.
         occurred_at = p_sent_at
   where m.id = p_message_id
     and m.clinic_id = p_clinic_id
     and m.author = 'ai'
     and m.delivery_status = 'pending'
  returning m.conversation_id into v_conversa;

  if v_conversa is null then
    return;
  end if;

  update public.conversations c
     set last_message_at = greatest(c.last_message_at, p_sent_at)
   where c.id = v_conversa and c.clinic_id = p_clinic_id;

  select s.id into v_sessao
  from public.attendance_sessions s
  where s.conversation_id = v_conversa and s.status = 'open'
  for update;

  if v_sessao is null then
    return query select null::integer, false;
    return;
  end if;

  -- A quinta resposta fecha a sessão e conta um atendimento (regra 2).
  update public.attendance_sessions s
     set ai_response_count = s.ai_response_count + 1,
         last_message_at = greatest(s.last_message_at, p_sent_at),
         status = case
           when s.ai_response_count + 1 >= 5 then 'closed_by_count'::public.attendance_session_status
           else s.status
         end,
         closed_at = case when s.ai_response_count + 1 >= 5 then p_sent_at else s.closed_at end
   where s.id = v_sessao
  returning s.ai_response_count into v_contagem;

  return query select v_contagem, v_contagem >= 5;
end;
$$;

comment on function public.confirm_ai_reply(uuid, uuid, text, timestamptz) is
  'Confirma o envio da resposta da IA: id da Meta, sent, contagem da sessão '
  '(fecha por contagem na quinta) e last_message_at da conversa. Idempotente. '
  'Só o webhook (service_role) chama.';

-- ─────────────────────────────────────────────────────────────
-- Falha da resposta
-- ─────────────────────────────────────────────────────────────
-- A conversa passa para a equipe, sem mandar nada ao paciente
-- (conversation-engine-v1, comportamento 7). Com a reserva, a mensagem
-- fica failed com o código; sem ela (a IA falhou antes de gerar), só a
-- conversa muda.
create function public.fail_ai_reply(
  p_clinic_id uuid,
  p_conversation_id uuid,
  p_message_id uuid,
  p_error_code text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_message_id is not null then
    update public.messages m
       set delivery_status = 'failed',
           delivery_error_code = p_error_code,
           delivery_updated_at = now()
     where m.id = p_message_id
       and m.clinic_id = p_clinic_id
       and m.conversation_id = p_conversation_id
       and m.author = 'ai'
       and m.delivery_status = 'pending';
  end if;

  update public.conversations c
     set handled_by = 'human',
         ai_failed_at = now()
   where c.id = p_conversation_id and c.clinic_id = p_clinic_id;
end;
$$;

comment on function public.fail_ai_reply(uuid, uuid, uuid, text) is
  'Falha da IA ou do envio: marca a reserva como failed e passa a conversa '
  'para a equipe, com ai_failed_at. Só o webhook (service_role) chama.';

-- O Supabase concede EXECUTE a anon e authenticated por padrão em função
-- nova do schema public. Estas só podem ser chamadas pelo webhook.
revoke execute on function public.reserve_ai_reply(uuid, uuid, uuid, text, timestamptz, boolean, boolean)
  from public, anon, authenticated;
revoke execute on function public.confirm_ai_reply(uuid, uuid, text, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.fail_ai_reply(uuid, uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.reserve_ai_reply(uuid, uuid, uuid, text, timestamptz, boolean, boolean)
  to service_role;
grant execute on function public.confirm_ai_reply(uuid, uuid, text, timestamptz)
  to service_role;
grant execute on function public.fail_ai_reply(uuid, uuid, uuid, text)
  to service_role;

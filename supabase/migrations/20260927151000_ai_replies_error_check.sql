-- Motor de conversa, parte 2: correção do check do código de erro de entrega.
--
-- Em 20260927150000_ai_replies.sql, `delivery_error_code is null or
-- delivery_status = 'failed'` dava NULL, e não falso, quando o
-- delivery_status era nulo (toda mensagem do paciente e todo eco). CHECK
-- com NULL passa, e a regra não valia justamente onde mais importa. O teste
-- `tests/rls/ai-replies.test.ts` ("código de erro só com a entrega em
-- falha") pegou. `is not distinct from` nunca dá NULL.

alter table public.messages
  drop constraint messages_erro_so_na_falha;

alter table public.messages
  add constraint messages_erro_so_na_falha
    check (delivery_error_code is null or delivery_status is not distinct from 'failed');

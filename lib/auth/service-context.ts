import { createServiceClient } from "@/lib/supabase/server"

/**
 * Contexto SEM sessão de usuário, para os três casos em que não existe
 * uma: webhook da Meta (a mensagem chega de fora), jobs do Vercel Cron e
 * rotinas administrativas do (admin).
 *
 * O client devolvido usa `service_role` e IGNORA RLS. Consequência: o
 * `clinic_id` precisa ser resolvido a partir do próprio dado da requisição
 * (ex: `phone_number_id` -> agente -> clínica) e passado explicitamente em
 * toda query. O banco não vai proteger nada aqui.
 *
 * Este módulo existe separado de `context.ts` de propósito: importar
 * `service-context` em código que tem sessão de usuário é erro de
 * arquitetura, e a importação deixa isso visível em review.
 */
export function serviceContext() {
  return { supabase: createServiceClient() }
}

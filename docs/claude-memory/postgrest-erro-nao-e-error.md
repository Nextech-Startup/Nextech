---
name: postgrest-erro-nao-e-error
description: "No supabase-js sem throwOnError, o erro é objeto plano — filtrar por `name === \"PostgrestError\"` nunca funciona e vaza o valor rejeitado"
metadata: 
  node_type: memory
  type: project
  originSessionId: f2da0d64-cc3f-4605-a7f0-50764330c2d1
  modified: 2026-09-16T22:52:35.741Z
---

No caminho `const { data, error } = await supabase...` (todo o Nextech), o
`error` do supabase-js **não é `instanceof Error` e tem `name === undefined`**.
A classe `PostgrestError`, que define `name`, só é instanciada com
`.throwOnError()`.

Verificado contra o banco real em 2026-09-16: um 23505 chega como
`{ code, message, details, hint }`, com
`details: "Key (whatsapp_phone_number_id)=(9789598776114) already exists."`

**Why:** três `mensagemDeErro()` do projeto barravam o erro com
`erro instanceof Error && erro.name !== "PostgrestError"` — guard que nunca
dispara. O `details` carrega o valor rejeitado: número de WhatsApp de outra
clínica em `agents`, nome de profissional em `clinic-profile` (PII). A proteção
que existia era acidental (objeto plano não ser `instanceof Error`), não a
desenhada.

**How to apply:** use `ehErroDoPostgrest()` de `lib/supabase/errors.ts`, que
reconhece pelo formato (`code` + `details` + `hint`). Nunca repassar
`error.message` nem `error.details` para a tela — mensagem de trava do banco se
escreve como constante em TS, duplicando o texto do trigger. Achado pelo
subagente `security-reviewer`, não por teste: ver [[nextech-testing-bar]].

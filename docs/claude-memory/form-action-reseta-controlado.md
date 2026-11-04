---
name: form-action-reseta-controlado
description: React 19 reseta o <form action={fn}> depois da action; select/input controlado volta ao valor inicial no DOM sem o estado saber
metadata:
  type: feedback
---

Com `<form action={acao}>` (useActionState), o React 19 chama `form.reset()` ao fim de cada action. Campo **controlado** (`value` + `onChange`) volta no DOM ao valor inicial, mas o estado do React não muda e não re-sincroniza: a próxima submissão manda o valor velho. Achado em 2026-11-04 na tela de Templates: depois de "Salvar rascunho", o `<select name="variables">` voltou a "Escolha…" e o envio seguinte saiu sem a variável.

**Why:** os testes de componente usam `renderToStaticMarkup` (sem jsdom) e não pegam; só apareceu no Playwright, na segunda submissão.

**How to apply:** formulário com campo controlado que submete mais de uma vez sem trocar de tela usa `onSubmit` com `e.preventDefault()`, `new FormData(e.currentTarget, submitter)` e `startTransition(() => acao(fd))` (ver `components/templates/editor-de-template.tsx`, `submeter`). Conferir no navegador submetendo duas vezes. Ver [[nextech-arquitetura-decisoes]].

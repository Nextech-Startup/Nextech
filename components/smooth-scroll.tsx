"use client"

import type React from "react"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import Lenis from "lenis"

/** Folga entre a navbar e o topo da seção de destino. */
const SCROLL_GAP = 16

/**
 * Offset da navbar fixa, para a seção não ficar escondida atrás dela.
 *
 * Mede a barra renderizada em vez de repetir um número mágico: assim o
 * valor acompanha a altura real em cada breakpoint (o logo muda de tamanho
 * a partir de md) sem precisar ser mantido em dois lugares.
 */
function getScrollOffset(): number {
  const header = document.querySelector("header")
  if (!header) return -112
  // `top` do CSS e altura de layout, e não o getBoundingClientRect: durante a
  // entrada animada da navbar (translateY de -100px), o retângulo ainda está
  // fora da tela, e quem chega por `/#Secao` rola nesse instante.
  const top = parseFloat(getComputedStyle(header).top) || 0
  return -(header.offsetHeight + top + SCROLL_GAP)
}

type ScrollApi = {
  /** Rola até a seção com o id informado, respeitando a navbar fixa. */
  scrollToSection: (sectionId: string) => void
}

const ScrollContext = createContext<ScrollApi | null>(null)

/**
 * Ponto único de navegação da página.
 *
 * Antes cada componente chamava `window.scrollTo({ behavior: "smooth" })`,
 * que disputa a rolagem com o Lenis e produz um movimento truncado.
 * Aqui o Lenis é sempre o dono do scroll — e quando ele não está ativo
 * (reduced motion) o fallback nativo assume.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null)
  const [api] = useState<ScrollApi>(() => ({
    scrollToSection: (sectionId: string) => {
      const target = document.getElementById(sectionId)
      if (!target) return

      const offset = getScrollOffset()

      if (lenisRef.current) {
        // O salto de âncora usa duração própria: com o lerp da roda ele
        // levaria vários segundos para percorrer a página inteira.
        // easeOutExpo — arranca rápido e assenta sem solavanco.
        lenisRef.current.scrollTo(target, {
          offset,
          duration: 0.9,
          easing: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
        })
        return
      }

      // Sem Lenis (reduced motion): rolagem nativa instantânea.
      const top = target.getBoundingClientRect().top + window.scrollY + offset
      window.scrollTo({ top, behavior: "auto" })
    },
  }))

  useEffect(() => {
    // Com reduced motion, o scroll suave por JS é justamente o que incomoda.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const lenis = new Lenis({
      // lerp em vez de duration: com duration cada evento de roda dispara
      // uma animação de 1.2s, e o scroll "escorrega" atrás do gesto. O lerp
      // persegue o alvo a cada frame, então acompanha a mão de imediato e
      // ainda assim assenta suave. 0.12 ≈ 120ms para alcançar o destino.
      lerp: 0.12,
      smoothWheel: true,
      // Multiplica o delta da roda: sem isto o passo fica curto e obriga
      // a girar demais para percorrer a página.
      wheelMultiplier: 1.1,
      // O toque no celular já é suave por natureza; interceptá-lo só
      // adiciona latência e briga com o overscroll do sistema.
      syncTouch: false,
      touchMultiplier: 1.6,
    })
    lenisRef.current = lenis

    let rafId = 0
    const raf = (time: number) => {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }
    rafId = requestAnimationFrame(raf)

    return () => {
      // O rAF precisa ser cancelado: sem isto o loop sobrevive ao unmount.
      cancelAnimationFrame(rafId)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  // Quem chega de outra página por `/#Secao` (o rodapé das páginas legais)
  // cai no salto nativo do navegador, que esconde o título atrás da navbar
  // fixa. Depois do Lenis montado, refaz o salto com o offset certo.
  useEffect(() => {
    let id: string
    try {
      id = decodeURIComponent(window.location.hash.slice(1))
    } catch {
      // Hash malformado (`/#%`): não há seção para achar, e a home não pode cair.
      return
    }
    if (!id) return
    // O navegador repete o salto nativo até a página terminar de carregar:
    // rolar antes do `load` seria desfeito por ele (medido no celular).
    const rolar = () => api.scrollToSection(id)
    if (document.readyState === "complete") {
      rolar()
      return
    }
    window.addEventListener("load", rolar, { once: true })
    return () => window.removeEventListener("load", rolar)
  }, [api])

  return <ScrollContext.Provider value={api}>{children}</ScrollContext.Provider>
}

/** Acessa a navegação por seções de qualquer componente da página. */
export function useScrollTo(): ScrollApi {
  const ctx = useContext(ScrollContext)
  if (!ctx) {
    throw new Error("useScrollTo precisa estar dentro de <SmoothScroll>")
  }
  return ctx
}

/**
 * Como `useScrollTo`, mas devolve `null` fora de `<SmoothScroll>`: para o
 * componente que aparece na home e em outras páginas (o rodapé) trocar a
 * rolagem por um link para `/#Secao`.
 */
export function useOptionalScrollTo(): ScrollApi | null {
  return useContext(ScrollContext)
}

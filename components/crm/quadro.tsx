"use client"

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core"
import { GripVertical } from "lucide-react"
import { Vazio } from "@/components/patterns/vazio"
import { nomeDoPaciente } from "@/lib/crm/cartao"
import { ETAPAS_ABERTAS, ROTULO_DA_ETAPA, ehEtapaAberta, type Etapa, type EtapaAberta, type Oportunidade } from "@/lib/crm/tipos"
import { cn } from "@/lib/utils"
import { CartaoDaOportunidade } from "./cartao-da-oportunidade"
import { MoverPara } from "./mover-para"

const COLUNA = "coluna:"

/** O que o leitor de tela ouve ao arrastar pelo teclado, em português. */
function anuncios(ops: readonly Oportunidade[]): Announcements {
  const nome = (id: string | number) => {
    const o = ops.find((x) => x.id === id)
    return o ? nomeDoPaciente(o) : "Oportunidade"
  }
  const etapa = (id: string | number | undefined) => {
    const e = String(id ?? "").replace(COLUNA, "")
    return ehEtapaAberta(e) ? ROTULO_DA_ETAPA[e] : "fora do quadro"
  }
  return {
    onDragStart: ({ active }) => `${nome(active.id)} pega. Use as setas para escolher a coluna, espaço para soltar, Esc para cancelar.`,
    onDragOver: ({ active, over }) => `${nome(active.id)} sobre ${etapa(over?.id)}.`,
    onDragEnd: ({ active, over }) => (over ? `${nome(active.id)} solta em ${etapa(over.id)}.` : `${nome(active.id)} solta fora do quadro.`),
    onDragCancel: ({ active }) => `Movimento de ${nome(active.id)} cancelado.`,
  }
}

type Coordinates = { x: number; y: number }
type RetanguloDeColuna = { left: number; top: number; width: number; height: number }

/**
 * O pulo do teclado: ← e → levam o cartão para o centro da coluna vizinha
 * (o padrão do dnd-kit andaria 25 px por tecla e nunca trocaria de coluna).
 * Pura, para testar sem navegador. Colunas escondidas (largura 0, como no
 * celular) e outros droppables ficam de fora.
 */
export function pularDeColuna(
  evento: { code: string },
  args: {
    currentCoordinates: Coordinates
    context: { droppableRects: ReadonlyMap<string | number, RetanguloDeColuna>; collisionRect: { width: number; height: number } | null }
  },
): Coordinates | undefined {
  if (evento.code !== "ArrowLeft" && evento.code !== "ArrowRight") return undefined
  const { currentCoordinates: atual, context } = args
  const largura = context.collisionRect?.width ?? 0
  const altura = context.collisionRect?.height ?? 0
  const colunas = [...context.droppableRects]
    .filter(([id, r]) => String(id).startsWith(COLUNA) && r.width > 0)
    .map(([, r]) => r)
    .sort((a, b) => a.left - b.left)
  if (colunas.length === 0) return undefined
  const centro = atual.x + largura / 2
  const distancia = (r: RetanguloDeColuna) => Math.abs(centro - (r.left + r.width / 2))
  const indice = colunas.reduce((melhor, r, i) => (distancia(r) < distancia(colunas[melhor]) ? i : melhor), 0)
  const alvo = colunas[indice + (evento.code === "ArrowRight" ? 1 : -1)]
  if (!alvo) return undefined
  // Mantém a altura, mas dentro da coluna de destino, para a colisão acertar nela.
  const y = Math.min(Math.max(atual.y, alvo.top), Math.max(alvo.top, alvo.top + alvo.height - altura))
  return { x: alvo.left + alvo.width / 2 - largura / 2, y }
}

const INSTRUCOES =
  "Para mover um cartão, foque a alça e aperte espaço. Use as setas para trocar de coluna e espaço de novo para soltar. Esc cancela."

function Arrastavel({ op, children }: { op: Oportunidade; children: (alca: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({ id: op.id })
  const alca = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Arrastar ${nomeDoPaciente(op)}`}
      className="hidden cursor-grab rounded-control p-0.5 text-ink-3 hover:text-ink-1 md:block"
    >
      <GripVertical className="size-4" aria-hidden="true" />
    </button>
  )
  return (
    <li
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn("list-none", isDragging && "relative z-10 rounded-card shadow-lg")}
    >
      {children(alca)}
    </li>
  )
}

function Coluna({ etapa, visivelNoCelular, children, vazia }: { etapa: EtapaAberta; visivelNoCelular: boolean; children: React.ReactNode; vazia: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${COLUNA}${etapa}` })
  return (
    <section
      ref={setNodeRef}
      aria-label={ROTULO_DA_ETAPA[etapa]}
      className={cn(
        "min-h-40 flex-col gap-2 rounded-card border border-transparent p-1",
        visivelNoCelular ? "flex" : "hidden md:flex",
        isOver && "border-dashed border-hairline bg-surface-1/60",
      )}
    >
      <h2 className="sr-only">{ROTULO_DA_ETAPA[etapa]}</h2>
      {vazia ? <Vazio>Nenhuma oportunidade aqui.</Vazio> : <ul className="grid gap-2">{children}</ul>}
    </section>
  )
}

/**
 * As quatro colunas abertas (spec crm-v1, "Quadro" e "Mover"). Arrastar no
 * desktop, pelo mouse ou pelo teclado (KeyboardSensor); no celular, uma
 * coluna por vez e o "Mover para…" do cartão.
 */
export function Quadro({
  ops,
  agora,
  etapaNoCelular,
  aoAbrir,
  aoMover,
}: {
  ops: readonly Oportunidade[]
  agora: string
  etapaNoCelular: EtapaAberta
  aoAbrir: (id: string) => void
  aoMover: (op: Oportunidade, para: Etapa) => void
}) {
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: pularDeColuna }))

  function soltar({ active, over }: DragEndEvent) {
    if (!over) return
    const para = String(over.id).replace(COLUNA, "")
    const op = ops.find((o) => o.id === active.id)
    if (!op || !ehEtapaAberta(para) || para === op.etapa) return
    aoMover(op, para)
  }

  return (
    <DndContext
      id="crm-quadro"
      sensors={sensores}
      onDragEnd={soltar}
      accessibility={{ announcements: anuncios(ops), screenReaderInstructions: { draggable: INSTRUCOES } }}
    >
      <div className="grid gap-3 md:grid-cols-4">
        {ETAPAS_ABERTAS.map((etapa) => {
          const nela = ops.filter((o) => o.etapa === etapa)
          return (
            <Coluna key={etapa} etapa={etapa} visivelNoCelular={etapa === etapaNoCelular} vazia={nela.length === 0}>
              {nela.map((op) => (
                <Arrastavel key={op.id} op={op}>
                  {(alca) => (
                    <div className="grid gap-1">
                      <CartaoDaOportunidade op={op} agora={agora} aoAbrir={aoAbrir} alca={alca} />
                      <MoverPara op={op} aoMover={aoMover} />
                    </div>
                  )}
                </Arrastavel>
              ))}
            </Coluna>
          )
        })}
      </div>
    </DndContext>
  )
}

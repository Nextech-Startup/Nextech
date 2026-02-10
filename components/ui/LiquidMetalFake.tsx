"use client"

import type React from "react"
import { useState } from "react"
import { Sparkles } from "lucide-react"

interface LiquidMetalFakeProps {
  label?: string
  viewMode?: "text" | "icon"
  icon?: React.ReactNode
  className?: string
}

export function LiquidMetalFake({
  label = "Agende uma reunião",
  viewMode = "text",
  icon,
  className = ""
}: LiquidMetalFakeProps) {
  const [isHovered, setIsHovered] = useState(false)

  // Mantemos as mesmas dimensões do seu original para não quebrar o layout
  const dimensions = viewMode === "icon" 
    ? { width: 46, height: 46 } 
    : { width: 180, height: 46 }

  return (
    <div 
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ perspective: "1000px" }}
    >
      <div
        style={{
          position: "relative",
          width: `${dimensions.width}px`,
          height: `${dimensions.height}px`,
          transformStyle: "preserve-3d",
          transition: "transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)",
          transform: isHovered ? "scale(1.05) translateZ(10px)" : "scale(1) translateZ(0px)"
        }}
      >
        {/* Camada de Conteúdo (Texto/Ícone) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            zIndex: 30,
            pointerEvents: "none",
            transform: "translateZ(20px)"
          }}
        >
          {viewMode === "icon" ? (
            icon || <Sparkles size={16} className="text-white drop-shadow-md" />
          ) : (
            <>
              {icon && <span className="flex items-center drop-shadow-md">{icon}</span>}
              <span style={{ 
                fontSize: "14px", 
                color: "#ffffff", 
                fontWeight: 600, 
                textShadow: "0px 1px 3px rgba(0, 0, 0, 0.8)" 
              }}>
                {label}
              </span>
            </>
          )}
        </div>

        {/* Layer de Fundo (Simulação do Metal com Gradiente Animado) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "100px",
            background: "linear-gradient(180deg, #202020 0%, #000000 100%)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            boxShadow: isHovered 
              ? "0 10px 20px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.2)" 
              : "0 4px 8px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.1)",
            overflow: "hidden",
            zIndex: 10,
            transition: "all 0.4s ease"
          }}
        >
          {/* O "Brilho Líquido" (Simulado com uma mancha de gradiente que se move) */}
          <div
            style={{
              position: "absolute",
              top: "-50%",
              left: "-50%",
              width: "200%",
              height: "200%",
              background: "radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 70%)",
              transform: isHovered ? "translate(25%, 25%)" : "translate(0%, 0%)",
              transition: "transform 1.5s ease-out",
              opacity: isHovered ? 1 : 0.4,
              pointerEvents: "none"
            }}
          />
          
          {/* Reflexo Linear Superior (Aquela borda branca fininha de metal) */}
          <div style={{
            position: "absolute",
            top: 0,
            left: "10%",
            right: "10%",
            height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
            zIndex: 15
          }} />
        </div>
      </div>
    </div>
  )
}
"use client"
import React from "react"
import { motion } from "framer-motion"

interface Testimonial {
  text: string
  name: string
  role: string
}

export const TestimonialsColumn = (props: {
  className?: string
  testimonials: Testimonial[]
  duration?: number
  reverse?: boolean // Adicionamos essa propriedade
}) => {
  return (
    <div className={`relative overflow-hidden h-175 ${props.className}`}>
      <motion.div
        initial={{ translateY: props.reverse ? "-50%" : "0%" }}
        animate={{
          translateY: props.reverse ? "0%" : "-50%",
        }}
        transition={{
          duration: props.duration || 10,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
        className="flex flex-col gap-6 pb-6"
      >
        {[
          ...new Array(2).fill(0).map((_, index) => (
            <React.Fragment key={index}>
              {props.testimonials.map(({ text, name, role }, i) => (
                <div
                  className="p-10 rounded-card border border-hairline bg-[var(--glass-bg)] backdrop-blur-sm max-w-xs w-full shadow-[0_4px_20px_rgba(0,0,0,0.10)]"
                  key={i}
                >
                  <div className="text-ink-2 text-sm leading-relaxed">{text}</div>
                  <div className="mt-5">
                    <div className="font-medium tracking-tight leading-5 text-ink-1">{name}</div>
                    <div className="leading-5 tracking-tight text-ink-3">{role}</div>
                  </div>
                </div>
              ))}
            </React.Fragment>
          )),
        ]}
      </motion.div>
    </div>
  )
}
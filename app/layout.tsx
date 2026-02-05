import type React from "react"
import type { Metadata } from "next"
import { Manrope } from "next/font/google"
import localFont from "next/font/local"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
})

const calSans = localFont({
  src: "./fonts/CalSans-Regular.woff2",
  variable: "--font-cal-sans",
  display: "swap",
})

const instrumentSans = localFont({
  src: "./fonts/InstrumentSans-Variable.woff2",
  variable: "--font-instrument-sans",
  display: "swap",
})

export const metadata: Metadata = {
  title: 'Nextech | Assistentes IA para Clínicas e Consultórios',
  description: 'Assistentes de WhatsApp com IA que automatizam conversas de clinicas, recuperam consultas perdidas e oferecem atendimento 24/7. Desenvolvido para clinicas medicas, odontologicas e esteticas.',
  icons: {
    icon: [
      {
        url: '/Favicon.png',
      },
    ],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${manrope.variable} ${calSans.variable} ${instrumentSans.variable} font-sans antialiased`}>
        <div className="noise-overlay" aria-hidden="true" />
        {children}
        <Analytics />
      </body>
    </html>
  )
}

import type React from "react"
import type { Metadata, Viewport } from "next"
import { Manrope } from "next/font/google"
import localFont from "next/font/local"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
  // Ajusta a métrica da fonte de fallback e elimina o salto de layout
  // (CLS) no momento em que a fonte real termina de carregar.
  adjustFontFallback: true,
  preload: true,
})

const calSans = localFont({
  src: "./fonts/CalSans-Regular.woff2",
  variable: "--font-cal-sans",
  display: "swap",
  preload: true,
  fallback: ["system-ui", "sans-serif"],
})

const instrumentSans = localFont({
  src: "./fonts/InstrumentSans-Variable.woff2",
  variable: "--font-instrument-sans",
  display: "swap",
  // Usada apenas em textos secundários: não bloqueia o carregamento inicial.
  preload: false,
  fallback: ["system-ui", "sans-serif"],
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nextech.ai"
const DESCRIPTION =
  "Assistentes de WhatsApp com IA que automatizam conversas de clínicas, recuperam consultas perdidas e oferecem atendimento 24/7. Desenvolvido para todas as clínicas e consultórios do Brasil."

export const metadata: Metadata = {
  // Base necessária para o Next resolver as URLs absolutas de OG/Twitter.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Nextech | Assistentes IA para Clínicas e Consultórios",
    template: "%s | Nextech",
  },
  description: DESCRIPTION,
  applicationName: "Nextech",
  keywords: [
    "assistente de IA para clínicas",
    "chatbot WhatsApp clínica",
    "agendamento automático de consultas",
    "automação de atendimento médico",
  ],
  authors: [{ name: "Nextech" }],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: SITE_URL,
    siteName: "Nextech",
    title: "Nextech | Assistentes IA para Clínicas e Consultórios",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Nextech | Assistentes IA para Clínicas e Consultórios",
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [{ url: "/Favicon.png" }],
    apple: [{ url: "/Favicon.png" }],
  },
}

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Descreve o negócio para os buscadores: habilita rich results
  // e alimenta o painel de conhecimento do Google.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Nextech",
    url: SITE_URL,
    logo: `${SITE_URL}/Logo.png`,
    description: DESCRIPTION,
    areaServed: { "@type": "Country", name: "Brasil" },
    sameAs: [
      "https://www.instagram.com/nextech.ia/",
      "https://www.linkedin.com/in/jhonesbonifaciodasilva/",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "sales",
      telephone: "+5581999112895",
      availableLanguage: ["Portuguese"],
    },
  }

  return (
    // Sem className="dark" fixo: o next-themes escreve a classe antes da
    // primeira pintura, evitando o flash de tema errado no carregamento.
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${manrope.variable} ${calSans.variable} ${instrumentSans.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <a
            href="#Hero"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:rounded-pill focus:bg-ink-1 focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-surface-0"
          >
            Pular para o conteúdo
          </a>
          <div className="noise-overlay" aria-hidden="true" />
          {children}
        </ThemeProvider>
        <Analytics />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  )
}

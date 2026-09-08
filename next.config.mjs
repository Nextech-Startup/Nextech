/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // AVIF primeiro: ~50% menor que WebP nas fotos de perfil e no logo.
    formats: ["image/avif", "image/webp"],
    // Os avatares do hero são servidos a 40px (80px em 2x); o logo a ~160px.
    imageSizes: [40, 64, 80, 96, 128, 160, 256, 384],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    // Assets locais e versionados: cache longo é seguro.
    minimumCacheTTL: 31536000,
  },
  // Falha o build em erro de tipo: a checagem já passa limpa.
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    // Converte os barrel imports em imports diretos (lucide-react tem ~1500 ícones).
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
}

export default nextConfig

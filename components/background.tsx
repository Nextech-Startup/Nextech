"use client";

import dynamic from 'next/dynamic';

// O dynamic com ssr: false garante que o componente 
// só seja carregado quando o navegador estiver pronto.
const Aurora = dynamic(() => import('@/components/aurora'), { 
  ssr: false,
  // Opcional: exibe um fundo preto enquanto o componente carrega
  loading: () => <div className="fixed inset-0 bg-zinc-950" />
});

export function Background() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {/* Aqui aplicamos as cores e configurações que você escolheu no React Bits */}
      <Aurora
        colorStops={["#607585", "#607585", "#607585"]}
        amplitude={1.3}
        blend={0.6}
        speed={0.5}
      />
      
      {/* Dica: Overlay de ruído para um visual mais orgânico (opcional) */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] brightness-100 contrast-150 pointer-events-none" />
    </div>
  );
}
"use client";

import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';

// ssr: false — o Aurora depende de WebGL e só existe no navegador.
const Aurora = dynamic(() => import('@/components/aurora'), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-surface-0" />
});

// No escuro o azul-acinzentado original; no claro um verde bem mais claro,
// que combina com o acento sem escurecer a página.
const STOPS_DARK = ["#607585", "#607585", "#607585"];
const STOPS_LIGHT = ["#a8c9bd", "#bcd6cc", "#a8c9bd"];

export function Background() {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === "light";

  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
      // A intensidade vem do token de tema: no claro o degradê recua para
      // não competir com o texto.
      style={{ opacity: "var(--aurora-opacity)" }}
    >
      <Aurora
        colorStops={isLight ? STOPS_LIGHT : STOPS_DARK}
        amplitude={1.3}
        blend={0.6}
        speed={0.5}
      />
    </div>
  );
}

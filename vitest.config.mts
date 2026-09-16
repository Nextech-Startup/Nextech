import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    // Vitest 5 resolve os paths do tsconfig nativamente (o "@/*" daqui),
    // sem precisar do plugin vite-tsconfig-paths.
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    // Teste de RLS toca banco real: sem paralelismo entre arquivos,
    // para que um não embaralhe o estado do outro.
    fileParallelism: false,
    testTimeout: 30_000,
  },
})

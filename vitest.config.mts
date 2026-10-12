import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    // Vitest 5 resolve os paths do tsconfig nativamente (o "@/*" daqui),
    // sem precisar do plugin vite-tsconfig-paths.
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    // O framework do Synkra AIOS fica local, fora do git (.gitignore), e traz
    // testes próprios em .js que não são do produto.
    exclude: [...configDefaults.exclude, ".aios-core/**", ".aios/**"],
    // Teste de RLS toca banco real: sem paralelismo entre arquivos,
    // para que um não embaralhe o estado do outro.
    fileParallelism: false,
    testTimeout: 30_000,
  },
})

import { config } from "dotenv"

// Os testes rodam fora do Next, que normalmente carregaria o .env sozinho.
config({ path: ".env" })

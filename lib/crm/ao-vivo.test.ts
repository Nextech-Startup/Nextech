import { describe, expect, it } from "vitest"
import { EVENTO_DO_CRM, topicoDoCrm } from "./ao-vivo"

describe("canal do CRM", () => {
  // Os mesmos valores do trigger e da policy (20261103150000) e de tests/rls/crm-realtime.test.ts.
  it("tópico crm:<clinic_id> e evento oportunidade", () => {
    expect(topicoDoCrm("abc")).toBe("crm:abc")
    expect(EVENTO_DO_CRM).toBe("oportunidade")
  })
})

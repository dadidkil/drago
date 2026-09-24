import { describe, expect, it } from "vitest";
import { rateLimit } from "./rate-limit";

describe("rateLimit (memory fallback)", () => {
  it("allows up to the limit, then blocks with retry-after", async () => {
    delete process.env.REDIS_URL;
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 3; i++) expect((await rateLimit(key, 3, 60)).ok).toBe(true);
    const blocked = await rateLimit(key, 3, 60);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });
});

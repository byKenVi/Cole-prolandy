import { describe, it, expect } from "vitest";
import { generateAcceptToken } from "./tokens";

describe("generateAcceptToken", () => {
  it("produces a long, URL-safe token (not a guessable cuid)", () => {
    const token = generateAcceptToken();
    // 32 random bytes → ~43 base64url chars. Comfortably long.
    expect(token.length).toBeGreaterThanOrEqual(40);
    // base64url alphabet only: A-Z a-z 0-9 - _ (no +, /, or = padding).
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("is unique/random across many draws", () => {
    const n = 1000;
    const set = new Set<string>();
    for (let i = 0; i < n; i++) set.add(generateAcceptToken());
    expect(set.size).toBe(n);
  });
});

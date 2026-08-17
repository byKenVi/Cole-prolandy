import { describe, expect, it } from "vitest";
import { assertSafeDownloadUrl } from "./url-safety";

describe("attachment URL safety", () => {
  it("rejects non-https URLs", async () => {
    await expect(assertSafeDownloadUrl("http://example.com/file.jpg")).rejects.toThrow(/HTTPS/);
  });

  it("rejects localhost URLs", async () => {
    await expect(assertSafeDownloadUrl("https://localhost/file.jpg")).rejects.toThrow(
      "Localhost attachment URLs are not allowed.",
    );
  });

  it("accepts public https URLs", async () => {
    const url = await assertSafeDownloadUrl("https://example.com/file.jpg");
    expect(url.hostname).toBe("example.com");
  });
});

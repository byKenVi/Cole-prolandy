import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = process.env;

beforeEach(() => {
  process.env = {
    ...originalEnv,
    LANDYS_ENV: "development",
    PRIVATE_OBJECT_DIR: "/test-bucket/private",
  };
  vi.restoreAllMocks();
});

afterEach(() => {
  process.env = originalEnv;
  vi.unstubAllGlobals();
});

describe("Replit App Storage", () => {
  it("uses an environment-specific namespace and uploads through a signed URL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ signed_url: "https://storage.example/upload" }),
      })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const { putAppObject } = await import("./replit-object-storage");

    await putAppObject({
      key: "contractor-logos/c1/logo.png",
      bytes: Buffer.from("logo"),
      contentType: "image/png",
    });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      bucket_name: "test-bucket",
      object_name: "private/development/contractor-logos/c1/logo.png",
      method: "PUT",
    });
    expect(fetchMock.mock.calls[1][0]).toBe("https://storage.example/upload");
  });

  it("creates stable app URLs without exposing storage credentials", async () => {
    const { contractorLogoKey, contractorLogoUrl } = await import("./replit-object-storage");
    const key = "contractor-logos/c1/logo.png";
    expect(contractorLogoUrl(key)).toBe("/storage/contractor-logos/c1/logo.png");
    expect(contractorLogoKey("/storage/contractor-logos/c1/logo.png")).toBe(key);
    expect(contractorLogoKey("https://old.example/logo.png")).toBeNull();
  });
});
export const INTEGRATION_CODE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function integrationCodeFromName(name: string): string {
  const code = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  if (!code || !INTEGRATION_CODE_RE.test(code)) {
    throw new Error("Could not derive a stable integration code from this name.");
  }
  return code;
}

export async function availableIntegrationCode(
  baseName: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const base = integrationCodeFromName(baseName);
  if (!(await exists(base))) return base;

  for (let suffix = 2; suffix <= 999; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!(await exists(candidate))) return candidate;
  }

  throw new Error("Could not allocate a unique integration code.");
}

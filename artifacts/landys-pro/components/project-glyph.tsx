import Image from "next/image";

/**
 * The 3D icon of a kind of land work. Callers pass the "/icons/<key>.png"
 * path produced by lib/project-icons (or the bare key, as the icon picker
 * does). Unknown keys fall back to the neutral 3D fallback icon.
 */
export function iconPath(srcOrKey: string | null | undefined): string {
  if (!srcOrKey) return "/icons/fallback.png";
  return srcOrKey.startsWith("/") ? srcOrKey : `/icons/${srcOrKey}.png`;
}

export function ProjectGlyph({ src, size = 24 }: { src: string | null | undefined; size?: number }) {
  return (
    <Image
      src={iconPath(src)}
      alt=""
      aria-hidden
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: "contain", flex: "none" }}
    />
  );
}

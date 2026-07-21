import Image from "next/image";

/**
 * The shared 3D trash icon used by every admin "Delete" affordance
 * (contractors, leads, categories, detail pages). Centralised here so the
 * treatment (asset + size handling) stays uniform everywhere.
 */
export function TrashIcon({ size = 18 }: { size?: number }) {
  return (
    <Image
      src="/admin-icons/trash.png"
      alt=""
      aria-hidden
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        display: "inline-block",
        verticalAlign: "middle",
        flex: "none",
      }}
    />
  );
}

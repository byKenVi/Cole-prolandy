import { Trash2 } from "lucide-react";

/**
 * The shared trash icon used by every admin "Delete" affordance (contractors,
 * requests, categories, detail pages), so the treatment stays uniform.
 */
export function TrashIcon({ size = 18 }: { size?: number }) {
  return (
    <Trash2
      size={size}
      strokeWidth={1.9}
      aria-hidden
      style={{ display: "inline-block", verticalAlign: "middle", flex: "none" }}
    />
  );
}

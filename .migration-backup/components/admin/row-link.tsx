import Link from "next/link";

/**
 * Stretched-link overlay: makes an entire list row clickable while keeping
 * real buttons inside the row usable (they sit at a higher z-index). The row
 * container must be `relative`; interactive controls must be `relative z-10`.
 */
export function RowLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} aria-label={label} className="absolute inset-0 z-0">
      <span className="sr-only">{label}</span>
    </Link>
  );
}

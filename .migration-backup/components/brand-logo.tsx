import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Landys brand wordmark (the script logo). The source PNG has a white
 * background, so `mix-blend-multiply` drops the white against both white
 * surfaces and the cream page background, leaving only the dark script.
 * Size it by passing a height utility in `className` (defaults to h-8).
 */
export function BrandLogo({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/landys-logo.png"
      alt="Landys"
      width={155}
      height={81}
      priority={priority}
      className={cn("h-8 w-auto select-none mix-blend-multiply", className)}
    />
  );
}

import Image from "next/image";
import { iconSrcFor } from "@/lib/project-icons";
import { cn } from "@/lib/utils";

/**
 * Rounded tile holding a project category's 3D icon. Always shows a 3D PNG.
 */
export function ProjectIcon({
  icon,
  category,
  project,
  size = "md",
  className,
}: {
  icon?: string | null;
  category?: string | null;
  project?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const src = iconSrcFor({ icon, category, project });
  const box =
    size === "lg" ? "h-16 w-16 rounded-2xl" : size === "sm" ? "h-10 w-10 rounded-lg" : "h-12 w-12 rounded-xl";
  const img = size === "lg" ? "h-11 w-11" : size === "sm" ? "h-7 w-7" : "h-8 w-8";
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center border border-border/60 bg-bg",
        box,
        className,
      )}
    >
      <Image
        src={src}
        alt=""
        aria-hidden
        width={96}
        height={96}
        className={cn("select-none object-contain", img)}
      />
    </div>
  );
}

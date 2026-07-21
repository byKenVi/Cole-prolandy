import * as React from "react";
import { cn } from "@/lib/utils";

/** Labels always visible (no placeholder-only fields) — DESIGN.md §4. */
const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("mb-1 block text-sm font-medium text-text", className)}
      {...props}
    />
  ),
);
Label.displayName = "Label";

export { Label };

import * as React from "react"
import * as TogglePrimitive from "@radix-ui/react-toggle"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-3xl text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none aria-invalid:ring-destructive/20 aria-invalid:border-destructive select-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground data-[state=off]:hover:bg-primary/90 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground",
        gaming: "bg-transparent border border-transparent text-overlay-text-primary data-[state=off]:hover:border-overlay-accent-primary data-[state=off]:hover:bg-transparent data-[state=on]:border-overlay-accent-primary data-[state=on]:bg-overlay-bg-hover data-[state=on]:text-overlay-bg-solid",
        outline: "border bg-background data-[state=off]:hover:bg-accent data-[state=off]:hover:text-accent-foreground data-[state=on]:bg-accent data-[state=on]:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground data-[state=off]:hover:bg-secondary/80 data-[state=on]:bg-secondary data-[state=on]:text-secondary-foreground",
        ghost: "data-[state=off]:hover:bg-accent data-[state=off]:hover:text-accent-foreground data-[state=on]:bg-accent data-[state=on]:text-accent-foreground",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "gaming",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export { Toggle, toggleVariants }

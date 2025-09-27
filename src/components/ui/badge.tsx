import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-overlay-border-accent focus-visible:ring-overlay-accent-primary/50 focus-visible:ring-[3px] aria-invalid:ring-overlay-destructive/20 aria-invalid:border-overlay-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-overlay-primary text-overlay-primary-foreground [a&]:hover:bg-overlay-primary/90",
        secondary:
          "border-transparent bg-overlay-secondary text-overlay-secondary-foreground [a&]:hover:bg-overlay-secondary/90",
        destructive:
          "border-transparent bg-overlay-destructive text-white [a&]:hover:bg-overlay-destructive/90 focus-visible:ring-overlay-destructive/20",
        outline:
          "border-overlay-border-primary text-overlay-foreground [a&]:hover:bg-overlay-bg-hover [a&]:hover:text-overlay-text-primary",
        accent:
          "border-transparent bg-overlay-accent-primary text-overlay-primary-foreground [a&]:hover:bg-overlay-accent-primary/90",
        muted:
          "border-transparent bg-overlay-muted text-overlay-muted-foreground [a&]:hover:bg-overlay-muted/90",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge }

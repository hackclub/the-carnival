"use client"

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator"

import { cn } from "@/lib/utils"

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: SeparatorPrimitive.Props) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        "shrink-0 rounded-full bg-[var(--carnival-border)]/25 data-horizontal:h-[3px] data-horizontal:w-full data-vertical:w-[3px] data-vertical:self-stretch",
        className
      )}
      {...props}
    />
  )
}

export { Separator }

"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const Sheet = SheetPrimitive.Root
const SheetTrigger = SheetPrimitive.Trigger
const SheetClose = SheetPrimitive.Close
const SheetPortal = SheetPrimitive.Portal

interface SheetContentProps
  extends Omit<React.ComponentProps<typeof SheetPrimitive.Content>, 'side'>,
    Omit<VariantProps<typeof sheetVariants>, 'side'> {
  side?: "top" | "right" | "bottom" | "left"
  size?: "sm" | "md" | "lg" | "xl" | "full"
  showCloseButton?: boolean
}

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-open:animate-in data-closed:animate-out data-open:duration-500 data-closed:duration-300",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-open:slide-in-from-top data-closed:slide-out-to-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-open:slide-in-from-bottom data-closed:slide-out-to-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-open:slide-in-from-left data-closed:slide-out-to-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-full border-l data-open:slide-in-from-right data-closed:slide-out-to-right sm:max-w-sm",
      },
      size: {
        sm: "sm:max-w-sm",
        md: "sm:max-w-[50vw]",
        lg: "sm:max-w-[70vw]",
        xl: "sm:max-w-[90vw]",
        full: "sm:max-w-[100vw]",
      },
    },
    defaultVariants: {
      side: "right",
      size: "md",
    },
  }
)

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-black/80 data-open:animate-in data-closed:animate-out data-open:fade-in-0 data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

function SheetContent({
  side = "right",
  size = "md",
  className,
  children,
  showCloseButton = true,
  ...props
}: SheetContentProps) {
  // Get class based on side prop
  const getSideClass = (sideValue: "top" | "right" | "bottom" | "left") => {
    const sideConfig: Record<string, string> = {
      top: "inset-x-0 top-0 border-b data-open:slide-in-from-top data-closed:slide-out-to-top",
      bottom: "inset-x-0 bottom-0 border-t data-open:slide-in-from-bottom data-closed:slide-out-to-bottom",
      left: "inset-y-0 left-0 h-full w-full border-r data-open:slide-in-from-left data-closed:slide-out-to-left sm:max-w-sm",
      right: "inset-y-0 right-0 h-full w-full border-l data-open:slide-in-from-right data-closed:slide-out-to-right",
    }
    return sideConfig[sideValue]
  }

  const sideClass = getSideClass(side)

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        className={cn(
          "fixed z-50 gap-4 bg-background p-0 shadow-lg transition ease-in-out data-open:animate-in data-closed:animate-out data-open:duration-500 data-closed:duration-300",
          sideClass,
          size === "md" && (side === "right" || side === "left") ? "w-full sm:w-[80vw] lg:w-[50vw]" :
          size === "sm" ? "sm:max-w-sm" :
          size === "lg" ? "sm:max-w-[70vw]" :
          size === "xl" ? "sm:max-w-[90vw]" :
          size === "full" ? "sm:max-w-[100vw]" :
          "sm:max-w-[50vw]",
          className
        )}
        {...props}
      >
        <SheetPrimitive.Title className="sr-only">Panel</SheetPrimitive.Title>
        <SheetPrimitive.Description className="sr-only">Panel content</SheetPrimitive.Description>
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-open:bg-secondary"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-sm",
      className
    )}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
  React.ComponentRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ComponentRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}

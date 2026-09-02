import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import {
  Info,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/cn"

const defaultIcons: Record<string, LucideIcon> = {
  default: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  gold: AlertTriangle,
  destructive: AlertCircle,
  error: AlertCircle,
}

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm font-sans transition-colors",
  {
    variants: {
      variant: {
        default: "border-line bg-card text-card-foreground",
        destructive:
          "border-danger/30 bg-danger/10 text-danger-light *:data-[slot=alert-description]:text-danger-light/90 [&>svg]:text-danger-light",
        error:
          "border-danger/30 bg-danger/10 text-danger-light *:data-[slot=alert-description]:text-danger-light/90 [&>svg]:text-danger-light",
        success:
          "border-emerald/30 bg-emerald/10 text-emerald-light *:data-[slot=alert-description]:text-emerald-light/90 [&>svg]:text-emerald-light",
        info:
          "border-sky/30 bg-sky/10 text-sky-light *:data-[slot=alert-description]:text-sky-light/90 [&>svg]:text-sky-light",
        warning:
          "border-gold/30 bg-gold/10 text-gold-light *:data-[slot=alert-description]:text-gold-light/90 [&>svg]:text-gold-light",
        gold:
          "border-gold/30 bg-gold/10 text-gold-light *:data-[slot=alert-description]:text-gold-light/90 [&>svg]:text-gold-light",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export type AlertProps = Omit<React.ComponentProps<"div">, "title"> &
  VariantProps<typeof alertVariants> & {
    icon?: React.ReactNode
    hideIcon?: boolean
    title?: React.ReactNode
  }

function hasComposableChildren(children: React.ReactNode): boolean {
  let found = false
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child)) {
      const childType = child.type as { displayName?: string } | undefined
      if (
        childType === AlertTitle ||
        childType === AlertDescription ||
        childType?.displayName === "AlertTitle" ||
        childType?.displayName === "AlertDescription" ||
        (child.props as Record<string, unknown>)?.[
          "data-slot"
        ] === "alert-title" ||
        (child.props as Record<string, unknown>)?.[
          "data-slot"
        ] === "alert-description"
      ) {
        found = true
      }
    }
  })
  return found
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
  {
    className,
    variant = "default",
    icon,
    hideIcon = false,
    title,
    children,
    ...props
  },
  ref
) {
  const isComposable = !title && !icon && hasComposableChildren(children)

  if (isComposable) {
    return (
      <div
        ref={ref}
        data-slot="alert"
        role="alert"
        className={cn(
          alertVariants({ variant }),
          "grid grid-cols-[0_1fr] items-start gap-y-0.5 has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }

  const variantKey = (variant as string) || "default"
  const DefaultIcon: LucideIcon = defaultIcons[variantKey] ?? Info
  const resolvedIcon =
    icon !== undefined
      ? icon
      : !hideIcon && (title || variantKey !== "default")
      ? <DefaultIcon className="size-5" />
      : null

  return (
    <div
      ref={ref}
      data-slot="alert"
      role="alert"
      className={cn(
        alertVariants({ variant }),
        "flex items-start gap-3",
        className
      )}
      {...props}
    >
      {!hideIcon && resolvedIcon && (
        <div className="shrink-0 mt-0.5 text-current">
          {React.isValidElement(resolvedIcon) ? (
            resolvedIcon
          ) : typeof resolvedIcon === "function" ? (
            React.createElement(
              resolvedIcon as React.ComponentType<{ className?: string }>,
              { className: "size-5" }
            )
          ) : null}
        </div>
      )}
      <div className="flex-1 min-w-0 space-y-1">
        {title && (
          <AlertTitle className="col-start-auto text-current font-semibold text-sm leading-tight tracking-tight">
            {title}
          </AlertTitle>
        )}
        {children && (
          <div
            data-slot="alert-description"
            className="text-xs text-inherit leading-relaxed opacity-95"
          >
            {children}
          </div>
        )}
      </div>
    </div>
  )
})
Alert.displayName = "Alert"

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight",
        className
      )}
      {...props}
    />
  )
}
AlertTitle.displayName = "AlertTitle"

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "col-start-2 text-sm text-muted-foreground [&_p]:leading-relaxed",
        className
      )}
      {...props}
    />
  )
}
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }

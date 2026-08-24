import React from 'react';
import { Info, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

const alertVariants = {
  variant: {
    default: 'border-line bg-surface/60 text-fg',
    info: 'border-sky/30 bg-sky/10 text-sky-light',
    success: 'border-emerald/30 bg-emerald/10 text-emerald-light',
    warning: 'border-gold/30 bg-gold/10 text-gold-light',
    gold: 'border-gold/30 bg-gold/10 text-gold-light',
    destructive: 'border-danger/30 bg-danger/10 text-danger-light',
    error: 'border-danger/30 bg-danger/10 text-danger-light'
  },
  icon: {
    default: Info,
    info: Info,
    success: CheckCircle2,
    warning: AlertTriangle,
    gold: AlertTriangle,
    destructive: AlertCircle,
    error: AlertCircle
  }
};

export const Alert = React.forwardRef(function Alert(
  {
    className,
    variant = 'default',
    icon: CustomIcon,
    hideIcon = false,
    title,
    children,
    ...props
  },
  ref
) {
  const variantClass = alertVariants.variant[variant] || alertVariants.variant.default;
  const DefaultIcon = alertVariants.icon[variant] || alertVariants.icon.default;
  const IconComponent = CustomIcon !== undefined ? CustomIcon : DefaultIcon;

  return (
    <div
      ref={ref}
      role="alert"
      className={cn(
        'relative w-full rounded-sm border p-4 flex items-start gap-3 text-sm font-sans',
        variantClass,
        className
      )}
      {...props}
    >
      {!hideIcon && IconComponent && (
        <div className="shrink-0 mt-0.5">
          {typeof IconComponent === 'function' || typeof IconComponent === 'object' ? (
            React.isValidElement(IconComponent) ? (
              IconComponent
            ) : (
              <IconComponent className="h-5 w-5" />
            )
          ) : null}
        </div>
      )}
      <div className="flex-1 space-y-1">
        {title && (
          <h5 className="font-heading font-semibold text-sm leading-none tracking-tight">
            {title}
          </h5>
        )}
        <div className="text-xs text-fg leading-relaxed">{children}</div>
      </div>
    </div>
  );
});
Alert.displayName = 'Alert';

export default Alert;

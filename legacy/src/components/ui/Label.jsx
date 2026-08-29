import React from 'react';
import { cn } from '../../utils/cn';

export const Label = React.forwardRef(function Label(
  { className, required = false, children, ...props },
  ref
) {
  return (
    <label
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1 text-[0.8rem] font-semibold text-fg-soft select-none',
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="text-danger font-bold text-xs">*</span>}
    </label>
  );
});

Label.displayName = 'Label';

export default Label;

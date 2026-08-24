import React, { createContext, useContext, useState } from 'react';
import { cn } from '../../utils/cn';

const TabsContext = createContext(null);

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  className,
  children,
  ...props
}) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const activeValue = value !== undefined ? value : internalValue;

  const handleValueChange = (val) => {
    if (value === undefined) setInternalValue(val);
    if (typeof onValueChange === 'function') onValueChange(val);
  };

  return (
    <TabsContext.Provider value={{ activeValue, onValueChange: handleValueChange }}>
      <div className={cn('w-full', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export const TabsList = React.forwardRef(function TabsList(
  { className, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        'inline-flex h-11 items-center justify-start rounded-sm bg-surface p-1 text-fg-soft border border-line gap-1',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
TabsList.displayName = 'TabsList';

export const TabsTrigger = React.forwardRef(function TabsTrigger(
  { className, value, children, icon, disabled = false, ...props },
  ref
) {
  const context = useContext(TabsContext);
  const isActive = context?.activeValue === value;

  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      onClick={() => context?.onValueChange(value)}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm px-3.5 py-1.5 text-xs font-semibold ring-offset-canvas transition-all duration-150 cursor-pointer select-none outline-none',
        'focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-1',
        'disabled:pointer-events-none disabled:opacity-50',
        isActive
          ? 'bg-field text-gold shadow-sm border border-gold/30 font-bold'
          : 'text-fg-soft hover:bg-white/[0.04] hover:text-fg border border-transparent',
        className
      )}
      {...props}
    >
      {icon && <span className="shrink-0 flex items-center">{icon}</span>}
      {children}
    </button>
  );
});
TabsTrigger.displayName = 'TabsTrigger';

export const TabsContent = React.forwardRef(function TabsContent(
  { className, value, children, ...props },
  ref
) {
  const context = useContext(TabsContext);
  if (context?.activeValue !== value) return null;

  return (
    <div
      ref={ref}
      className={cn(
        'mt-4 ring-offset-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 animate-modal-fade',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
TabsContent.displayName = 'TabsContent';

export default Tabs;

import React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '../../utils/cn';

// Popover shadcn/ui di atas @radix-ui/react-popover.
// Warna diambil dari token PT TAN yang dipetakan di src/index.css
// (--popover, --border), bukan dari palet bawaan shadcn.

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverContent = React.forwardRef(function PopoverContent(
  { className, align = 'start', sideOffset = 6, ...props },
  ref
) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          // z-index harus di atas .sidebar (100) dan .modal-overlay (1000) di index.css.
          'z-[1100] overflow-hidden rounded-sm border border-border bg-popover text-popover-foreground shadow-popover outline-none',
          'data-[state=open]:animate-popover-in',
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
});

export { Popover, PopoverTrigger, PopoverAnchor, PopoverContent };

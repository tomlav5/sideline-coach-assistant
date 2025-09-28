import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-[100] bg-black/80 overscroll-contain data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  // Improved body scroll lock with counter to handle multiple dialogs
  React.useEffect(() => {
    // Get or initialize counter
    const currentCount = parseInt(document.body.getAttribute('data-dialog-count') || '0', 10);
    const newCount = currentCount + 1;
    
    // Only lock on first dialog
    if (newCount === 1) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.setAttribute('data-original-overflow', originalStyle);
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = 'var(--scrollbar-width, 0px)';
    }
    
    document.body.setAttribute('data-dialog-count', newCount.toString());
    
    return () => {
      const currentCount = parseInt(document.body.getAttribute('data-dialog-count') || '1', 10);
      const newCount = Math.max(0, currentCount - 1);
      document.body.setAttribute('data-dialog-count', newCount.toString());
      
      // Only unlock when no dialogs are open
      if (newCount === 0) {
        const originalStyle = document.body.getAttribute('data-original-overflow') || 'auto';
        document.body.style.overflow = originalStyle;
        document.body.style.paddingRight = '';
        document.body.removeAttribute('data-original-overflow');
        document.body.removeAttribute('data-dialog-count');
      }
    };
  }, []);

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-4 right-4 top-4 bottom-4 z-[110] flex flex-col max-w-lg mx-auto max-h-[calc(100dvh-2rem)] min-h-0 border bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:left-[50%] sm:right-auto sm:top-[50%] sm:bottom-auto sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg overflow-hidden",
          className
        )}
        {...props}
      >
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="p-6 pb-24">
            {children}
          </div>
        </div>
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground z-10">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
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
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}

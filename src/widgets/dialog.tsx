import * as Modal from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utilities/style-utils";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Read out with the title, for a panel whose purpose is not its name. */
  description?: string;
  children: ReactNode;
  className?: string;
  /**
   * Where the caret goes when the panel opens.
   *
   * Radix hands focus to the first control inside, which here is always the
   * close button. A panel that exists to be typed into wants the field
   * instead, and only the caller knows which field that is.
   */
  onOpenAutoFocus?: (event: Event) => void;
};

/**
 * A panel of settings, opened from a button on the map.
 *
 * Dark rather than pale, unlike the button that opens it. The controls inside
 * came out of the sheet and are written for its ground — sand type, hairline
 * sand borders, blaze for the answer — and this is the same kind of surface the
 * sheet is: somewhere to make a decision, rather than somewhere to look at the
 * map through. The pale treatment belongs to the controls that sit *on* the map.
 *
 * Centred at every width. A phone gets the same panel as a desktop, near the
 * full width and never taller than the viewport, because these are short lists
 * and a second presentation would be a second thing to keep working.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  onOpenAutoFocus,
}: DialogProps) {
  return (
    <Modal.Root open={open} onOpenChange={onOpenChange}>
      <Modal.Portal>
        <Modal.Overlay className="dialog-veil bg-forest-deep/50 fixed inset-0 z-40 backdrop-blur-[2px]" />
        <Modal.Content
          onOpenAutoFocus={onOpenAutoFocus}
          // Radix warns when a dialog has no description. Most of these are a
          // named list of settings and the title says everything; opting out is
          // the honest answer rather than writing a sentence to silence it.
          {...(description ? {} : { "aria-describedby": undefined })}
          className={cn(
            "dialog-panel border-forest-lift/60 bg-forest text-sand fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border shadow-[0_16px_48px_rgba(18,48,31,0.45)]",
            className,
          )}
        >
          <div className="flex items-start gap-3 px-5 pt-4 pb-3">
            <div className="min-w-0 flex-1">
              <Modal.Title className="text-sand text-sm tracking-[0.14em] uppercase">
                {title}
              </Modal.Title>
              {description && (
                <Modal.Description className="text-sand/70 mt-1 text-xs leading-snug">
                  {description}
                </Modal.Description>
              )}
            </div>
            <Modal.Close
              aria-label="Close"
              className="text-sand/70 hover:text-sand focus-visible:ring-blaze -mt-1 -mr-1 grid h-11 w-11 shrink-0 place-items-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
            >
              <X size={16} weight="bold" aria-hidden />
            </Modal.Close>
          </div>

          {/* Scrolls rather than growing, so a long list cannot push the panel
              off a short viewport. */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
            {children}
          </div>
        </Modal.Content>
      </Modal.Portal>
    </Modal.Root>
  );
}

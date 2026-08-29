import * as Alert from "@radix-ui/react-alert-dialog";
import type { ReactNode } from "react";
import { Button } from "@/widgets/button";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What is about to happen, and whether it can be taken back. */
  children: ReactNode;
  /** The word on the button that goes through with it. */
  confirm: string;
  onConfirm: () => void;
};

/**
 * A question that has to be answered before something is thrown away.
 *
 * An alert dialog rather than the ordinary kind, which is a real distinction
 * and not a styling one: it takes focus to the cancel, it will not close by
 * clicking away from it, and it announces itself rather than waiting to be
 * found. Clicking beside a panel is how someone dismisses a thing they opened
 * by accident, and that gesture must not be the one that deletes a ride.
 *
 * Only for what costs more to rebuild than to reconsider: forgetting a saved
 * ride, which lives in this browser and nowhere else, or starting over, which
 * takes back an afternoon of picks in one click even though Undo can return
 * them.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  children,
  confirm,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Alert.Root open={open} onOpenChange={onOpenChange}>
      <Alert.Portal>
        <Alert.Overlay className="dialog-veil bg-forest-deep/50 fixed inset-0 z-40 backdrop-blur-[2px]" />
        <Alert.Content className="dialog-panel border-sand/20 bg-forest text-sand fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-xs -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-5 shadow-[0_16px_48px_rgba(18,48,31,0.45)]">
          <Alert.Title className="text-sand text-sm tracking-[0.14em] uppercase">
            {title}
          </Alert.Title>
          <Alert.Description className="text-sand/80 mt-2 text-[0.8125rem] leading-relaxed">
            {children}
          </Alert.Description>
          {/* The way out comes first, in reading order and in the tab order, so
              the easy button is the safe one. */}
          <div className="mt-4 flex justify-end gap-2">
            <Alert.Cancel asChild>
              <Button variant="outline" className="px-3 text-xs">
                Cancel
              </Button>
            </Alert.Cancel>
            <Alert.Action asChild>
              <Button
                variant="danger"
                className="px-3 text-xs"
                onClick={onConfirm}
              >
                {confirm}
              </Button>
            </Alert.Action>
          </div>
        </Alert.Content>
      </Alert.Portal>
    </Alert.Root>
  );
}

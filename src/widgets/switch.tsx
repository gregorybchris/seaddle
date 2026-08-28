import { cn } from "@/lib/utilities/style-utils";

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** What the setting actually does, for anyone the label does not reach. */
  hint?: string;
};

/**
 * A setting that is either on or off, and its own row.
 *
 * The whole row is the button rather than just the track. A track is nine
 * millimetres of target on a phone, and the words beside it are the part
 * anyone is actually aiming at — so they are inside the control instead of
 * labelling it from outside.
 *
 * `role="switch"` rather than a checkbox: both are read as on and off, but a
 * switch takes effect where it is pressed, and a checkbox implies a form
 * somewhere that has yet to be submitted. Nothing here has a save button.
 */
export function Switch({ checked, onChange, label, hint }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="focus-visible:ring-blaze group flex min-h-11 w-full items-center gap-3 rounded-md text-left focus-visible:ring-2 focus-visible:outline-none"
    >
      <span className="min-w-0 flex-1">
        <span className="text-sand block text-sm">{label}</span>
        {hint && (
          <span className="text-sand/60 mt-0.5 block text-[0.6875rem] leading-snug">
            {hint}
          </span>
        )}
      </span>
      {/* Amber when it is on, because that is the color this site answers in.
          The knob takes the panel's own dark against it rather than staying
          pale: on the amber a sand knob reads as a smudge, and the contrast
          swapping is itself part of what says the switch has moved. */}
      <span
        aria-hidden
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200 ease-[var(--ease-settle)] motion-reduce:transition-none",
          checked
            ? "border-blaze-deep bg-blaze"
            : "border-sand/25 bg-forest-deep/50 group-hover:border-sand/40",
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition-transform duration-200 ease-[var(--ease-settle)] motion-reduce:transition-none",
            checked
              ? "bg-forest-deep translate-x-[1.5rem]"
              : "bg-sand/70 translate-x-[0.125rem]",
          )}
        />
      </span>
    </button>
  );
}

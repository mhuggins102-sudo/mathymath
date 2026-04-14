"use client";

interface KeypadProps {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onSubmit: () => void;
  disabled?: boolean;
  submitDisabled?: boolean;
}

const ROW_1 = ["1", "2", "3", "4", "5"];
const ROW_2 = ["6", "7", "8", "9", "0"];

export function Keypad({
  onDigit,
  onBackspace,
  onSubmit,
  disabled,
  submitDisabled,
}: KeypadProps) {
  const btn =
    "h-12 select-none rounded-md bg-surface-2 text-foreground font-semibold active:scale-95 active:bg-surface transition disabled:opacity-40 disabled:active:scale-100";
  return (
    <div className="w-full max-w-md mx-auto select-none" aria-label="Number keypad">
      <div className="grid grid-cols-5 gap-2 mb-2">
        {ROW_1.map((d) => (
          <button
            key={d}
            type="button"
            className={`${btn} text-xl digit-${d}`}
            onClick={() => onDigit(d)}
            disabled={disabled}
          >
            {d}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-2 mb-2">
        {ROW_2.map((d) => (
          <button
            key={d}
            type="button"
            className={`${btn} text-xl digit-${d}`}
            onClick={() => onDigit(d)}
            disabled={disabled}
          >
            {d}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-2">
        <button
          type="button"
          className={`${btn} col-span-2 text-base`}
          onClick={onBackspace}
          disabled={disabled}
          aria-label="Backspace"
        >
          ⌫
        </button>
        <button
          type="button"
          className={`${btn} col-span-3 bg-accent/70 text-background`}
          onClick={onSubmit}
          disabled={disabled || submitDisabled}
        >
          Enter
        </button>
      </div>
    </div>
  );
}

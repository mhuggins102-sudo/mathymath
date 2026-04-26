"use client";

import { useEffect } from "react";

/**
 * Wires the physical keyboard to the on-screen keypad on desktop.
 * Mobile already has the on-screen keypad as the only input surface, so
 * this hook is purely additive — it doesn't replace any existing
 * touch interaction.
 *
 * Bindings:
 *   - 0-9       → appendDigit
 *   - Backspace → backspace (delete the last typed digit / lock digit)
 *   - Delete    → backspace (alias; matches user expectation on Windows)
 *   - Enter     → submit (only fires when not in lock-entry mode and
 *                  input is otherwise submittable; the hook just calls
 *                  submit and lets the existing guard short-circuit)
 *
 * Skipped when the active element is an input/textarea/contenteditable
 * so that any future search box / settings field doesn't capture digit
 * input. Also skipped on modifier-key combos so power-user shortcuts
 * (Cmd-R, Cmd-L, etc.) still work normally.
 */
export interface KeyboardInputBindings {
  appendDigit: (d: string) => void;
  backspace: () => void;
  submit: () => void;
  /** When true, no key events are handled — used to disable input
   *  during modal popups, terminal game state, etc. */
  disabled?: boolean;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

export function useKeyboardInput(bindings: KeyboardInputBindings): void {
  const { appendDigit, backspace, submit, disabled } = bindings;

  useEffect(() => {
    if (disabled) return;
    if (typeof window === "undefined") return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        appendDigit(e.key);
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        backspace();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [appendDigit, backspace, submit, disabled]);
}

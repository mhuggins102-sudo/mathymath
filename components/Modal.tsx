"use client";

import { useEffect, useRef } from "react";

/**
 * Shared modal wrapper. Responsibilities:
 *   - Esc closes
 *   - Focus moves inside on open; first focusable element gets focus
 *   - Tab / Shift+Tab cycles within the modal (focus trap)
 *   - On close, focus returns to the element that triggered the modal
 *   - role="dialog" + aria-modal="true" + labelledby hook for screen readers
 *   - Optional backdrop-click close (default on for overlay style only)
 *
 * Two visual variants:
 *   - variant="full" — full-screen, solid background. HelpModal / Settings /
 *     home-screen LifetimeStats use this.
 *   - variant="overlay" — centered card on a translucent backdrop. Daily
 *     result popup and in-game stats popup use this; backdrop click closes.
 */
export type ModalVariant = "full" | "overlay";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Accessible label; passes to aria-labelledby. If omitted, `ariaLabel`
   *  is used instead. */
  titleId?: string;
  ariaLabel?: string;
  variant?: ModalVariant;
  children: React.ReactNode;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function Modal({
  open,
  onClose,
  titleId,
  ariaLabel,
  variant = "full",
  children,
}: ModalProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Remember the element that had focus when the modal opened so we can
  // restore focus to it on close (standard accessible modal behavior).
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = (document.activeElement as HTMLElement | null) ?? null;

    // Focus the first focusable element inside on the next frame (wait for
    // children to mount / update).
    const raf = requestAnimationFrame(() => {
      const root = rootRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        root.focus();
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      // Restore focus on close. Guard against the element having been
      // removed from the DOM.
      const prev = returnFocusRef.current;
      if (prev && document.contains(prev)) prev.focus();
    };
  }, [open]);

  // Esc + Tab/Shift-Tab trap. Installed only while open.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = rootRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusables.length === 0) {
        // Nothing to focus inside — pin focus to the dialog itself.
        e.preventDefault();
        root.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  if (variant === "overlay") {
    return (
      <div
        // Anchor overlay popups to a consistent top distance instead
        // of vertically centering. Without this, taller modals (Help)
        // pushed near the top while shorter ones (Settings, Stats)
        // floated mid-screen, making the menu cluster feel
        // inconsistent. `items-start` + `pt-[5vh]` gives every modal
        // the same starting offset, matching the position the Help
        // modal naturally took at `items-center` since its 90vh height
        // already filled the available space.
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center px-4 pt-[5vh] pb-4 text-left"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={titleId ? undefined : ariaLabel}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          ref={rootRef}
          tabIndex={-1}
          className="w-full max-w-md max-h-[90vh] overflow-y-auto outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 bg-background overflow-y-auto text-left outline-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-label={titleId ? undefined : ariaLabel}
    >
      {children}
    </div>
  );
}

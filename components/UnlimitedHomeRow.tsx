"use client";

import Link from "next/link";
import { useState } from "react";
import { GearIcon } from "./GearIcon";
import { SettingsDrawer } from "./SettingsDrawer";

/**
 * Home-screen row pairing the Unlimited link with a gear button that
 * opens the Unlimited settings menu. Mirrors the calendar icon next
 * to the Today's Puzzle link so the home column has two parallel
 * primary actions, each with a small adjacent action.
 */
export function UnlimitedHomeRow() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex items-stretch gap-2">
        <Link
          href="/unlimited"
          className="flex-1 bg-surface-2 text-foreground font-semibold py-4 rounded-xl border border-border active:scale-[0.99] transition text-center"
        >
          Unlimited
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Unlimited settings"
          title="Unlimited settings"
          className="bg-surface-2 text-foreground rounded-xl border border-border active:scale-[0.99] transition flex items-center justify-center w-14"
        >
          <GearIcon className="w-6 h-6" />
        </button>
      </div>
      <SettingsDrawer
        open={open}
        onClose={() => setOpen(false)}
        context="home"
      />
    </>
  );
}

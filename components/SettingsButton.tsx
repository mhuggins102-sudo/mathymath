"use client";

import { useState } from "react";
import { SettingsDrawer } from "./SettingsDrawer";

export function SettingsButton({
  className = "text-muted text-sm hover:text-foreground",
  label = "Settings",
}: {
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
      >
        {label}
      </button>
      <SettingsDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

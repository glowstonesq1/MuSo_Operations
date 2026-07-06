"use client";

import { useState } from "react";

/** "Copy as WhatsApp message" — copies pre-formatted plain text to clipboard. */
export function CopyButton({ text, label = "Copy as WhatsApp message" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn-outline"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? "Copied!" : label}
    </button>
  );
}

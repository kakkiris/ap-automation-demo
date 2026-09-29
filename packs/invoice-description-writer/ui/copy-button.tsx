"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type CopyState = "idle" | "copied" | "failed";

/**
 * Puts the text on the clipboard and says so on the button for about two seconds.
 * The label is the accessible name at rest; while confirming it reads "Copied" or "Copy failed".
 */
export function CopyButton({
  text,
  label,
  variant = "outline",
  size = "sm",
}: {
  text: string;
  label: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "xs";
}) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  async function copy() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    timer.current = window.setTimeout(() => setState("idle"), 2000);
  }

  return (
    <Button variant={variant} size={size} onClick={copy}>
      {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : label}
    </Button>
  );
}

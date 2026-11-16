"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = resolvedTheme !== undefined;
  const isDark = resolvedTheme === "dark";

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <span className="min-w-24 text-right text-sm font-medium text-slate-600 dark:text-slate-300" aria-live="polite">
        {!mounted
          ? "Theme"
          : theme === "system"
            ? `System (${isDark ? "dark" : "light"})`
            : isDark
              ? "Dark"
              : "Light"}
      </span>
      <button
        type="button"
        role="switch"
        aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
        aria-checked={mounted && isDark}
        disabled={!mounted}
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6a45] disabled:cursor-wait ${
          isDark ? "bg-[#1d6a45]" : "bg-slate-300"
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-flex size-5 items-center justify-center rounded-full bg-white text-[#1d6a45] shadow transition-transform ${
            isDark ? "translate-x-6" : "translate-x-1"
          }`}
        >
          {isDark ? <Moon size={13} /> : <Sun size={13} />}
        </span>
      </button>
      {mounted && theme !== "system" && (
        <button
          type="button"
          onClick={() => setTheme("system")}
          className="rounded-lg px-2 py-1 text-sm font-semibold text-[#1d6a45] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6a45] dark:text-[#dfeee4]"
        >
          Use system
        </button>
      )}
    </div>
  );
}

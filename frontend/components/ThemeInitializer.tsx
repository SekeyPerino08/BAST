"use client";

import { useEffect } from "react";

export function ThemeInitializer() {
  useEffect(() => {
    const savedTheme = window.localStorage.getItem("campushub-theme");
    const useDarkTheme = savedTheme === "dark"
      || (savedTheme === null && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle(
      "dark",
      useDarkTheme,
    );
    window.dispatchEvent(new Event("campushub-theme-change"));
  }, []);

  return null;
}

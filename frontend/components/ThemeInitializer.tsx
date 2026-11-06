"use client";

import { useEffect } from "react";

export function ThemeInitializer() {
  useEffect(() => {
    document.documentElement.classList.toggle(
      "dark",
      window.localStorage.getItem("campushub-theme") === "dark",
    );
    window.dispatchEvent(new Event("campushub-theme-change"));
  }, []);

  return null;
}

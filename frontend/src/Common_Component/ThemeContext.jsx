import { createContext, useCallback, useContext, useLayoutEffect, useState } from "react";

const THEME_STORAGE_KEY = "rs_sangha_theme";
const ThemeContext = createContext(null);

function normalizeTheme(value) {
  return value === "dark" ? "dark" : "light";
}

function readSavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "dark" || saved === "light") return saved;
    const legacy = JSON.parse(localStorage.getItem("rs-sangha-settings") || "{}");
    return normalizeTheme(legacy.theme);
  } catch {
    return "light";
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
}

export function initializeTheme() {
  applyTheme(readSavedTheme());
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readSavedTheme);

  useLayoutEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Keep the current session themed when storage is unavailable.
    }
  }, [theme]);

  const setTheme = useCallback((nextTheme) => {
    setThemeState(normalizeTheme(nextTheme));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider.");
  return value;
}

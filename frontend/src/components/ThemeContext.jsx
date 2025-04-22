import React, { createContext, useState, useEffect, useMemo } from "react";

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const isDebug = process.env.NODE_ENV === "development";

  // State: Is the dark mode feature enabled/allowed? (Controls visibility/functionality)
  const [darkModeEnabled, setDarkModeEnabled] = useState(() => {
    try {
      const storedValue = localStorage.getItem("darkModeEnabled");
      return storedValue !== null ? JSON.parse(storedValue) : true; // Default: Feature is ON
    } catch (e) {
      console.error("[ThemeProvider] Failed to parse darkModeEnabled from localStorage", e);
      return true;
    }
  });

  // State: What is the currently active theme? ('dark' or 'light')
  const [theme, setTheme] = useState(() => {
    try {
        const storedTheme = localStorage.getItem("theme");
        // Get initial enabled state to decide initial theme
        const initialDarkModeEnabled = localStorage.getItem("darkModeEnabled") !== null
            ? JSON.parse(localStorage.getItem("darkModeEnabled"))
            : true;
        // If feature starts disabled, force light theme
        if (!initialDarkModeEnabled) {
            if (isDebug) console.log("[ThemeProvider Init] Feature disabled, forcing light theme.");
            return 'light';
        }
        // If feature enabled, use stored theme or default to 'light' (or 'dark')
        const defaultTheme = 'light';
        if (isDebug) console.log(`[ThemeProvider Init] Using stored theme "${storedTheme}" or default "${defaultTheme}".`);
        return storedTheme || defaultTheme;
    } catch(e) {
        console.error("[ThemeProvider] Failed to initialize theme", e);
        return 'light';
    }
  });

  // Other states
  const [selfDestructEnabled, setSelfDestructEnabled] = useState(() => { /* ... init logic ... */ try { const v = localStorage.getItem("selfDestructEnabled"); return v !== null ? JSON.parse(v) : false; } catch(e){return false;} });
  const [destructTime, setDestructTime] = useState(() => localStorage.getItem("destructTime") || "300sec");
  const [customTime, setCustomTime] = useState(() => localStorage.getItem("customTime") || "300");

  // Effect to apply theme to body and persist all settings
  useEffect(() => {
    const currentTheme = theme;
    if (isDebug) {
        console.log(`[ThemeProvider Persist Effect] Running. Theme=${currentTheme}, Feature Enabled=${darkModeEnabled}`);
    }
    document.body.setAttribute("data-theme", currentTheme);
    try {
      localStorage.setItem("theme", currentTheme);
      localStorage.setItem("darkModeEnabled", JSON.stringify(darkModeEnabled));
      localStorage.setItem("selfDestructEnabled", JSON.stringify(selfDestructEnabled));
      localStorage.setItem("destructTime", destructTime);
      localStorage.setItem("customTime", customTime);
    } catch (e) {
      console.error("[ThemeProvider Persist Effect] Error saving settings", e);
    }
  }, [theme, darkModeEnabled, selfDestructEnabled, destructTime, customTime, isDebug]);

  // Memoize context value - PROVIDE ALL NEEDED VALUES AND SETTERS
  const contextValue = useMemo(
    () => {
        if (isDebug) {
            console.log("[ThemeProvider useMemo] Recalculating context value. Theme:", theme, "Feature Enabled:", darkModeEnabled);
        }
        return {
            theme, // Current active theme ('dark' or 'light')
            setTheme, // Setter to change the active theme (used by Navbar toggle)
            darkModeEnabled, // Is the feature enabled? (boolean)
            setDarkModeEnabled, // Setter to enable/disable the feature (used by Settings)
            // Other values...
            selfDestructEnabled,
            setSelfDestructEnabled,
            destructTime,
            setDestructTime,
            customTime,
            setCustomTime,
        };
    },
    [isDebug, theme, darkModeEnabled, selfDestructEnabled, destructTime, customTime]
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
};
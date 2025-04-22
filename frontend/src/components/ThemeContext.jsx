import React, { createContext, useState, useEffect, useMemo } from "react";

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // Determine if in debug mode (optional, based on your setup)
  const isDebug = process.env.NODE_ENV !== "production";

  // Initialize darkModeEnabled from localStorage or default to true
  const [darkModeEnabled, setDarkModeEnabled] = useState(() => {
    try {
      const storedValue = localStorage.getItem("darkModeEnabled");
      // Default to true (dark mode) if nothing stored or parse fails
      return storedValue !== null ? JSON.parse(storedValue) : true;
    } catch (e) {
      console.error("[ThemeProvider] Failed to parse darkModeEnabled from localStorage", e);
      return true; // Default true on error
    }
  });

  // Initialize selfDestructEnabled from localStorage or default to false
  const [selfDestructEnabled, setSelfDestructEnabled] = useState(() => {
    try {
      const storedValue = localStorage.getItem("selfDestructEnabled");
      return storedValue !== null ? JSON.parse(storedValue) : false; // Default false
    } catch (e) {
      console.error("[ThemeProvider] Failed to parse selfDestructEnabled from localStorage", e);
      return false; // Default false on error
    }
  });

  // Initialize destructTime from localStorage or default to "300sec"
  const [destructTime, setDestructTime] = useState(() => {
    try {
      const storedValue = localStorage.getItem("destructTime");
      return storedValue || "300sec"; // Default 5 mins
    } catch (e) {
      console.error("[ThemeProvider] Failed to read destructTime from localStorage", e);
      return "300sec";
    }
  });

  // Initialize customTime from localStorage or default to "300"
  const [customTime, setCustomTime] = useState(() => {
    try {
      const storedValue = localStorage.getItem("customTime");
      return storedValue || "300"; // Default 300 seconds
    } catch (e) {
      console.error("[ThemeProvider] Failed to read customTime from localStorage", e);
      return "300";
    }
  });

  // Optional Debug effect for destructTime changes
  useEffect(() => {
    if (isDebug) {
      console.log(`[ThemeProvider Debug] destructTime changed to: ${destructTime}`);
    }
  }, [destructTime, isDebug]);

  // Effect to apply theme and persist settings
  useEffect(() => {
    // --- Derive theme based on darkModeEnabled ---
    const currentTheme = darkModeEnabled ? "dark" : "light";
    if (isDebug) {
        console.log(`[ThemeProvider Persist Effect] Running. darkModeEnabled=${darkModeEnabled}, Derived theme=${currentTheme}`);
    }

    // --- Apply theme to body ---
    document.body.setAttribute("data-theme", currentTheme);

    // --- Persist all settings to localStorage ---
    try {
      // --- SAVE THE DERIVED THEME STRING ---
      localStorage.setItem("theme", currentTheme); // Save the calculated theme
      // --- Save other settings ---
      localStorage.setItem("darkModeEnabled", JSON.stringify(darkModeEnabled));
      localStorage.setItem("selfDestructEnabled", JSON.stringify(selfDestructEnabled));
      localStorage.setItem("destructTime", destructTime);
      localStorage.setItem("customTime", customTime);

      if (isDebug) {
        console.log("[ThemeProvider Persist Effect] Settings saved to localStorage", {
          theme: currentTheme, // Log saved theme
          darkModeEnabled,
          selfDestructEnabled,
          destructTime,
          customTime,
        });
      }
    } catch (e) {
      console.error("[ThemeProvider Persist Effect] Error saving settings to localStorage", e);
    }

  // This effect depends on the core state values that need persisting
  }, [darkModeEnabled, selfDestructEnabled, destructTime, customTime, isDebug]);

  // Memoize context value to prevent unnecessary re-renders of consumers
  // if the provided value object reference hasn't changed.
  const contextValue = useMemo(
    () => {
        // Derive theme again for the context value
        const theme = darkModeEnabled ? "dark" : "light";
        if (isDebug) {
            console.log("[ThemeProvider useMemo] Recalculating context value. Theme:", theme);
        }
        return {
            theme: theme, // Provide the derived theme string
            darkModeEnabled, // Provide the boolean state
            setDarkModeEnabled, // Provide the setter for the boolean state
            selfDestructEnabled,
            setSelfDestructEnabled,
            destructTime,
            setDestructTime,
            customTime,
            setCustomTime,
        };
    },
    // Dependencies for useMemo: Re-calculate only when these change
    [isDebug, darkModeEnabled, selfDestructEnabled, destructTime, customTime]
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
};
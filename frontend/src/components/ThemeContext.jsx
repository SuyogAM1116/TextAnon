import React, { createContext, useState, useEffect, useMemo } from "react";

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const isDebug = process.env.NODE_ENV === "development";

  // Initialize darkModeEnabled from localStorage or default to true
  const [darkModeEnabled, setDarkModeEnabled] = useState(() => {
    try {
      const storedValue = localStorage.getItem("darkModeEnabled");
      return storedValue !== null ? JSON.parse(storedValue) : true;
    } catch (e) {
      console.error("[ThemeProvider] Failed to parse darkModeEnabled from localStorage", e);
      return true;
    }
  });

  // Initialize theme from localStorage or default to "dark"
  const [theme, setTheme] = useState(() => {
    try {
      const storedValue = localStorage.getItem("theme");
      return storedValue || "dark";
    } catch (e) {
      console.error("[ThemeProvider] Failed to read theme from localStorage", e);
      return "dark";
    }
  });

  // Self-destruct settings (unchanged)
  const [selfDestructEnabled, setSelfDestructEnabled] = useState(() => {
    try {
      const storedValue = localStorage.getItem("selfDestructEnabled");
      return storedValue !== null ? JSON.parse(storedValue) : false;
    } catch (e) {
      console.error("[ThemeProvider] Failed to parse selfDestructEnabled from localStorage", e);
      return false;
    }
  });

  const [destructTime, setDestructTime] = useState(() => {
    try {
      const storedValue = localStorage.getItem("destructTime");
      return storedValue || "300sec";
    } catch (e) {
      console.error("[ThemeProvider] Failed to read destructTime from localStorage", e);
      return "300sec";
    }
  });

  const [customTime, setCustomTime] = useState(() => {
    try {
      const storedValue = localStorage.getItem("customTime");
      return storedValue || "300";
    } catch (e) {
      console.error("[ThemeProvider] Failed to read customTime from localStorage", e);
      return "300";
    }
  });

  // Effect to apply theme and persist settings
  useEffect(() => {
    // If dark mode is disabled, force theme to "light"
    const currentTheme = darkModeEnabled ? theme : "light";
    document.body.setAttribute("data-theme", currentTheme);
    try {
      localStorage.setItem("theme", currentTheme);
      localStorage.setItem("darkModeEnabled", JSON.stringify(darkModeEnabled));
      localStorage.setItem("selfDestructEnabled", JSON.stringify(selfDestructEnabled));
      localStorage.setItem("destructTime", destructTime);
      localStorage.setItem("customTime", customTime);
      if (isDebug) {
        console.log("[ThemeProvider] Settings saved to localStorage", {
          theme: currentTheme,
          darkModeEnabled,
          selfDestructEnabled,
          destructTime,
          customTime,
        });
      }
    } catch (e) {
      console.error("[ThemeProvider] Error saving settings to localStorage", e);
    }
  }, [darkModeEnabled, theme, selfDestructEnabled, destructTime, customTime]);

  // Memoize context value
  const contextValue = useMemo(() => {
    const currentTheme = darkModeEnabled ? theme : "light";
    return {
      theme: currentTheme,
      darkModeEnabled,
      setDarkModeEnabled,
      selfDestructEnabled,
      setSelfDestructEnabled,
      destructTime,
      setDestructTime,
      customTime,
      setCustomTime,
      setTheme: (newTheme) => {
        if (darkModeEnabled) {
          setTheme(newTheme);
        }
      },
    };
  }, [darkModeEnabled, theme, selfDestructEnabled, destructTime, customTime]);

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
};
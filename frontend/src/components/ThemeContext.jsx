import React, { createContext, useState, useEffect } from "react";

// Create the ThemeContext
export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // Get initial theme from localStorage or default to "dark"
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");
  const [darkModeEnabled, setDarkModeEnabled] = useState(
    JSON.parse(localStorage.getItem("darkModeEnabled")) ?? true
  );
  const [selfDestructEnabled, setSelfDestructEnabled] = useState(
    JSON.parse(localStorage.getItem("selfDestructEnabled")) ?? false
  );
  const [destructTime, setDestructTime] = useState(localStorage.getItem("destructTime") || "5min");
  const [customTime, setCustomTime] = useState(localStorage.getItem("customTime") || "");

  // Effect to apply theme changes and persist settings
  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    localStorage.setItem("darkModeEnabled", JSON.stringify(darkModeEnabled));
    localStorage.setItem("selfDestructEnabled", JSON.stringify(selfDestructEnabled));
    localStorage.setItem("destructTime", destructTime);
    localStorage.setItem("customTime", customTime);
  }, [theme, darkModeEnabled, selfDestructEnabled, destructTime, customTime]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        darkModeEnabled,
        setDarkModeEnabled,
        selfDestructEnabled,
        setSelfDestructEnabled,
        destructTime,
        setDestructTime,
        customTime,
        setCustomTime
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
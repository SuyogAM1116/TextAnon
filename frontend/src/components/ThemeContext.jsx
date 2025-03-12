import React, { createContext, useState, useEffect } from "react";

// Create the ThemeContext
export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // Get initial theme from localStorage or default to "dark"
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");
  const [darkModeEnabled, setDarkModeEnabled] = useState(
    JSON.parse(localStorage.getItem("darkModeEnabled")) ?? true
  );

  // Effect to apply theme changes
  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    localStorage.setItem("darkModeEnabled", JSON.stringify(darkModeEnabled));
  }, [theme, darkModeEnabled]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, darkModeEnabled, setDarkModeEnabled }}>
      {children}
    </ThemeContext.Provider>
  );
};

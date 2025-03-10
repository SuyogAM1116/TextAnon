import React, { useState, useEffect } from "react";
import { FaSun, FaMoon } from "react-icons/fa";

const ThemeToggle = ({ onThemeChange }) => {
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    onThemeChange(theme);
  }, [theme, onThemeChange]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "dark" ? "light" : "dark"));
  };

  return (
    <div className="d-flex align-items-center gap-2">
      <button
        onClick={toggleTheme}
        className="btn btn-outline-light d-flex align-items-center gap-2"
        style={{ borderRadius: "20px", padding: "6px 15px", fontSize: "16px" }}
      >
        {theme === "dark" ? <FaMoon size={20} /> : <FaSun size={20} className="text-warning" />}
        {theme === "dark" ? "Dark Mode" : "Light Mode"}
      </button>
    </div>
  );
};

export default ThemeToggle;

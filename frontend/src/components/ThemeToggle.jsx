import React, { useState, useEffect } from "react";
import { FaSun, FaMoon } from "react-icons/fa";

const ThemeToggle = ({ onThemeChange }) => {
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("theme") === "dark"
  );

  useEffect(() => {
    document.body.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem("theme", darkMode ? "dark" : "light");
    onThemeChange(darkMode ? "dark" : "light");
  }, [darkMode, onThemeChange]);

  const toggleTheme = () => {
    setDarkMode((prevMode) => !prevMode);
  };

  return (
    <div className="d-flex align-items-center me-4">
      <button
        onClick={toggleTheme}
        className="btn btn-outline-light d-flex align-items-center gap-2"
        style={{
          borderRadius: "20px",
          padding: "6px 15px",
          fontSize: "16px",
          backgroundColor: darkMode ? "#343a40" : "#f8f9fa",
          color: darkMode ? "#ffc107" : "#343a40",
          border: darkMode ? "1px solid #ffc107" : "3px solid #343a40",
        }}
      >
        {darkMode ? <FaSun size={20} className="text-warning" /> : <FaMoon size={20} />}
        {darkMode ? "Light Mode" : "Dark Mode"}
      </button>
    </div>
  );
};

export default ThemeToggle;

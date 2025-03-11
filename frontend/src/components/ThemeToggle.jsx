import React, { useContext } from "react";
import { FaSun, FaMoon } from "react-icons/fa";
import { ThemeContext } from "../components/ThemeContext"; // Import ThemeContext

const ThemeToggle = () => {
  const { theme, setTheme } = useContext(ThemeContext); // Get theme & setTheme from context

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
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
          backgroundColor: theme === "dark" ? "#343a40" : "#f8f9fa",
          color: theme === "dark" ? "#ffc107" : "#343a40",
          border: theme === "dark" ? "1px solid #ffc107" : "3px solid #343a40",
        }}
      >
        {theme === "dark" ? <FaSun size={20} className="text-warning" /> : <FaMoon size={20} />}
        {theme === "dark" ? "Light Mode" : "Dark Mode"}
      </button>
    </div>
  );
};

export default ThemeToggle;

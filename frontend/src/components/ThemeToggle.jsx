import React, { useContext } from "react";
import { FaSun, FaMoon } from "react-icons/fa";
// Ensure path is correct
import { ThemeContext } from "../components/ThemeContext";

const ThemeToggle = () => {
  // Get theme (current visual theme), setTheme (to toggle visual theme),
  // and darkModeEnabled (to check if feature is allowed)
  const { theme, setTheme, darkModeEnabled } = useContext(ThemeContext);

  // Handler to toggle the active theme
  const toggleTheme = () => {
    // This button should only be clickable if darkModeEnabled is true,
    // but the rendering logic below already handles that.
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    console.log(`[ThemeToggle] Toggled theme to: ${newTheme}`);
  };

  // --- Conditionally render based on the feature flag ---
  // If dark mode feature is disabled in Settings, render nothing.
  if (!darkModeEnabled) {
    console.log("[ThemeToggle] Not rendering because darkModeEnabled feature is false.");
    return null;
  }

  // --- Render the button only if the dark mode feature is enabled ---
  return (
    <div className="d-flex align-items-center me-4">
      <button
        onClick={toggleTheme} // Calls the function to switch theme
        className="btn btn-outline-light d-flex align-items-center gap-2"
        style={{
          borderRadius: "20px",
          padding: "6px 15px",
          fontSize: "16px",
          backgroundColor: theme === "dark" ? "#343a40" : "#f8f9fa",
          color: theme === "dark" ? "#ffc107" : "#343a40",
          border: theme === "dark" ? "1px solid #ffc107" : "3px solid #343a40",
          cursor: "pointer", // Ensure cursor indicates clickable
        }}
        title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`} // Accessibility title
      >
        {/* Icon and Text based on the current theme */}
        {theme === "dark" ? <FaSun size={20} className="text-warning" /> : <FaMoon size={20} />}
        {theme === "dark" ? "Light Mode" : "Dark Mode"}
      </button>
    </div>
  );
};

export default ThemeToggle;
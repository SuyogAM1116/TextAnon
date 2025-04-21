import React, { useState, useContext } from "react";
import { ThemeContext } from "../components/ThemeContext";
import { Link } from "react-router-dom";
import { Button } from "react-bootstrap";
import { FaMoon, FaSun, FaClock, FaFont, FaVideo, FaMicrophoneSlash, FaCamera, FaArrowLeft } from "react-icons/fa";

const Settings = () => {
  const { theme, setTheme, darkModeEnabled, setDarkModeEnabled, selfDestructEnabled, setSelfDestructEnabled, destructTime, setDestructTime, customTime, setCustomTime } = useContext(ThemeContext);

  return (
    <div
      style={{
        backgroundColor: theme === "dark" ? "#121212" : "#f8f9fa",
        color: theme === "dark" ? "#ffffff" : "#333333",
        minHeight: "100vh",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <h2>Settings</h2>

      <div style={sectionStyle(theme)}>
        <h3>General</h3>
        <label style={optionStyle}>
          Dark Mode / Light Mode:
          <Button
            variant={darkModeEnabled ? "danger" : "success"}
            onClick={() => {
              setDarkModeEnabled(!darkModeEnabled);
              if (!darkModeEnabled) setTheme("dark");
            }}
          >
            {darkModeEnabled ? "Disable" : "Enable"}
          </Button>
        </label>
      </div>

      <div style={sectionStyle(theme)}>
        <h3>Message and Chat</h3>

        <label style={optionStyle}>
          <FaClock className="me-2" /> Self-Destructing Messages:
          <input
            type="checkbox"
            checked={selfDestructEnabled}
            onChange={() => setSelfDestructEnabled(!selfDestructEnabled)}
          />
        </label>

        {selfDestructEnabled && (
          <label style={optionStyle}>
            Self-Destruction Time:
            <select
              value={destructTime}
              onChange={(e) => setDestructTime(e.target.value)}
              style={selectStyle(theme)}
            >
              <option value="2min">2 min</option>
              <option value="5min">5 min</option>
              <option value="10min">10 min</option>
              <option value="custom">Custom</option>
            </select>
          </label>
        )}

        {selfDestructEnabled && destructTime === "custom" && (
          <label style={optionStyle}>
            Enter Custom Time (in minutes):
            <input
              type="number"
              min="1"
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
              style={inputStyle(theme)}
            />
          </label>
        )}

        <label style={optionStyle}>
          <FaFont className="me-2" /> Chat Font Size:
          <select style={selectStyle(theme)}>
            <option>Small</option>
            <option>Medium</option>
            <option>Large</option>
          </select>
        </label>
      </div>

      <div style={sectionStyle(theme)}>
        <h3>Video Call</h3>
        <label style={optionStyle}>
          <FaVideo className="me-5" /> Video Quality:
          <select style={selectStyle(theme)}>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </label>
        <label style={optionStyle}>
          <FaCamera className="me-1" /> Disable Camera:
          <input type="checkbox" />
        </label>
        <label style={optionStyle}>
          <FaMicrophoneSlash className="me-4" /> Auto-Mute on Join:
          <input type="checkbox" />
        </label>
      </div>

      <Link to="/">
        <Button
          variant={theme === "dark" ? "success" : "outline-success"}
          size="lg"
          className="fw-bold"
        >
          <FaArrowLeft className="me-2" />
          Back to Home
        </Button>
      </Link>
    </div>
  );
};

/* Styles */
const sectionStyle = (theme) => ({
  backgroundColor: theme === "dark" ? "#333" : "#ddd",
  padding: "15px",
  marginBottom: "15px",
  width: "80%",
  borderRadius: "8px",
});

const optionStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "10px",
  fontSize: "16px",
  width: "100%",
};

const selectStyle = (theme) => ({
  padding: "5px",
  backgroundColor: theme === "dark" ? "#444" : "#fff",
  color: theme === "dark" ? "#fff" : "#333",
  border: "none",
  borderRadius: "4px",
});

const inputStyle = (theme) => ({
  padding: "5px",
  backgroundColor: theme === "dark" ? "#444" : "#fff",
  color: theme === "dark" ? "#fff" : "#333",
  border: "none",
  borderRadius: "4px",
  marginLeft: "10px",
  width: "60px",
});

export default Settings;
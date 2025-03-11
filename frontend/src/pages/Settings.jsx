import React, { useState } from "react";

const Settings = () => {
  const [selfDestruct, setSelfDestruct] = useState(false);
  const [destructTime, setDestructTime] = useState("5min");
  const [customTime, setCustomTime] = useState("");

  return (
    <div
      style={{
        backgroundColor: "#222",
        color: "#fff",
        minHeight: "100vh",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <h2>Settings</h2>

      {/* General Settings */}
      <div style={sectionStyle}>
        <h3>General</h3>
        <label style={optionStyle}>
          Dark Mode:
          <input type="checkbox" />
        </label>
      </div>

      {/* Message & Chat Settings */}
      <div style={sectionStyle}>
        <h3>Message and Chat</h3>

        {/* Self-Destructing Messages */}
        <label style={optionStyle}>
          Self-Destructing Messages:
          <input
            type="checkbox"
            checked={selfDestruct}
            onChange={() => setSelfDestruct(!selfDestruct)}
          />
        </label>

        {/* Self-Destruction Time (Appears Only if Self-Destructing is Enabled) */}
        {selfDestruct && (
          <label style={optionStyle}>
            Self-Destruction Time:
            <select
              value={destructTime}
              onChange={(e) => setDestructTime(e.target.value)}
              style={selectStyle}
            >
              <option value="2min">2 min</option>
              <option value="5min">5 min</option>
              <option value="10min">10 min</option>
              <option value="custom">Custom</option>
            </select>
          </label>
        )}

        {/* Custom Time Input (Appears Only When "Custom" is Selected) */}
        {selfDestruct && destructTime === "custom" && (
          <label style={optionStyle}>
            Enter Custom Time (in minutes):
            <input
              type="number"
              min="1"
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
              style={inputStyle}
            />
          </label>
        )}

        <label style={optionStyle}>
          Chat Font Size:
          <select style={selectStyle}>
            <option>Small</option>
            <option>Medium</option>
            <option>Large</option>
          </select>
        </label>
      </div>

      {/* Video Call Settings */}
      <div style={sectionStyle}>
        <h3>Video Call</h3>
        <label style={optionStyle}>
          Video Quality:
          <select style={selectStyle}>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </label>
        <label style={optionStyle}>
          Disable Camera:
          <input type="checkbox" />
        </label>
        <label style={optionStyle}>
          Auto-Mute on Join:
          <input type="checkbox" />
        </label>
      </div>

      <button style={backButtonStyle} onClick={() => window.history.back()}>
        Back to Home
      </button>
    </div>
  );
};

/* Styles */
const sectionStyle = {
  backgroundColor: "#333",
  padding: "15px",
  marginBottom: "15px",
  width: "80%",
  borderRadius: "8px",
};

const optionStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "10px",
  fontSize: "16px",
};

const selectStyle = {
  padding: "5px",
  backgroundColor: "#444",
  color: "#fff",
  border: "none",
  borderRadius: "4px",
};

const inputStyle = {
  padding: "5px",
  backgroundColor: "#444",
  color: "#fff",
  border: "none",
  borderRadius: "4px",
  marginLeft: "10px",
  width: "60px",
};

const backButtonStyle = {
  marginTop: "20px",
  padding: "10px",
  backgroundColor: "#007bff",
  color: "#fff",
  border: "none",
  borderRadius: "5px",
  cursor: "pointer",
};


export default Settings;

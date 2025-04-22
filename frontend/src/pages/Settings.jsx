import React, { useContext, useState } from "react";
// Import necessary components from react-bootstrap
import { Button, Form, Row, Col } from "react-bootstrap";
// Assuming ThemeContext is correctly exported from this path
import { ThemeContext } from "../components/ThemeContext";
import { Link } from "react-router-dom";
import { FaClock, FaFont, FaVideo, FaMicrophoneSlash, FaCamera, FaArrowLeft } from "react-icons/fa";

// This component uses the ThemeContext provided by ThemeProvider
const Settings = () => {
  // --- CONTEXT UPDATE ---
  // Get the necessary states and setters based on the corrected ThemeProvider
  // We need 'theme' for styling, 'darkModeAllowed' and its setter for the feature toggle,
  // and 'setTheme' to force light mode when the feature is disabled.
  const {
    theme,
    darkModeAllowed, // The setting we control here (boolean)
    setDarkModeAllowed, // The setter for the allowance
    setTheme, // Need this to force light theme when disabling
    // Other settings remain the same
    selfDestructEnabled,
    setSelfDestructEnabled,
    destructTime,
    setDestructTime,
    customTime,
    setCustomTime,
  } = useContext(ThemeContext);
  // --- END CONTEXT UPDATE ---

  // State for custom time validation (remains the same)
  const [customTimeError, setCustomTimeError] = useState("");

  // --- Handler for the Dark Mode Feature Enable/Disable Button ---
  // This function toggles whether the dark mode feature is permitted
  const handleDarkModeEnableToggle = () => {
    const isNowEnabled = !darkModeAllowed; // Calculate the new state
    setDarkModeAllowed(isNowEnabled); // Update the enable/disable state in context
    console.log(`[Settings] Toggled darkModeEnabled (feature allowed) to: ${isNowEnabled}`);

    // If the feature is being DISABLED, force the actual theme to light
    if (!isNowEnabled) {
      setTheme('light');
      console.log("[Settings] Dark mode feature disabled, forcing theme to light.");
    }
    // If enabling, don't force theme, let the navbar toggle or default handle it
  };
  // --- End new handler ---

  // --- Other handlers remain the same ---
  const handleSelfDestructToggle = (e) => {
    setSelfDestructEnabled(e.target.checked);
    console.log(`[Settings] Set selfDestructEnabled=${e.target.checked}`);
  };

  const handleDestructTimeChange = (e) => {
    setDestructTime(e.target.value);
    console.log(`[Settings] Set destructTime=${e.target.value}`);
  };

  const handleCustomTimeChange = (value) => {
    setCustomTime(value);
    console.log(`[Settings] Set customTime=${value}`);
    if (value === "") {
      setCustomTimeError("");
      return;
    }
    const numValue = Number(value);
    if (isNaN(numValue) || numValue < 10 || numValue > 3600) {
      setCustomTimeError("Enter a number between 10 and 3600 seconds");
    } else {
      setCustomTimeError("");
    }
  };
  // --- End Other Handlers ---

  return (
    // --- Main div structure and styling remain the same ---
    <div
      style={{
        backgroundColor: theme === "dark" ? "#121212" : "#f8f9fa",
        color: theme === "dark" ? "#ffffff" : "#333333",
        minHeight: "100vh",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        transition: "background-color 0.3s ease, color 0.3s ease",
      }}
    >
      <h2 className="mb-4">Settings</h2>

      {/* General Section - Structure remains the same */}
      <div style={sectionStyle(theme)} className="mb-3">
        <h3 style={headerStyle}>General</h3>
        <Form.Group as={Row} className="mb-0 align-items-center" controlId="darkModeEnableToggle"> {/* ID Updated */}
          <Form.Label column sm="8">
             {/* --- UPDATED LABEL --- */}
            Dark Mode Feature: {/* Label reflects what the button controls */}
          </Form.Label>
          <Col sm="4" className="text-end">
            {/* --- UPDATED BUTTON LOGIC --- */}
            <Button
              // Variant reflects if the FEATURE is currently enabled
              variant={darkModeAllowed ? "outline-danger" : "outline-success"} // Danger to disable feature, Success to enable feature
              onClick={handleDarkModeEnableToggle} // Calls the correct handler
              size="sm"
            >
              {/* Text reflects if the FEATURE is currently enabled */}
              {darkModeAllowed ? "Disable Feature" : "Enable Feature"}
            </Button>
            {/* --- End Update --- */}
          </Col>
        </Form.Group>
      </div>

      {/* Message and Chat Section (Structure remains the same) */}
      <div style={sectionStyle(theme)} className="mb-3">
        <h3 style={headerStyle}>Message & Chat</h3>
        <Form.Group as={Row} className="mb-2 align-items-center" controlId="selfDestructToggle">
          <Form.Label column sm="8">
            <FaClock className="me-2" /> Self-Destructing Messages
          </Form.Label>
          <Col sm="4" className="text-end">
            <Form.Check
              type="switch"
              id="self-destruct-switch"
              checked={selfDestructEnabled}
              onChange={handleSelfDestructToggle}
            />
          </Col>
        </Form.Group>
        {selfDestructEnabled && (
          <>
            <Form.Group as={Row} className="mb-2 align-items-center" controlId="destructTimeSelect">
              <Form.Label column sm="6">
                Destruction Time:
              </Form.Label>
              <Col sm="6">
                <Form.Select
                  value={destructTime}
                  onChange={handleDestructTimeChange}
                  style={selectStyle(theme)}
                  size="sm"
                >
                  <option value="30sec">30 seconds</option>
                  <option value="60sec">1 minute</option>
                  <option value="120sec">2 minutes</option>
                  <option value="300sec">5 minutes</option>
                  <option value="600sec">10 minutes</option>
                  <option value="custom">Custom</option>
                </Form.Select>
              </Col>
            </Form.Group>
            {destructTime === "custom" && (
              <Form.Group as={Row} className="mb-2 align-items-center" controlId="customTimeInput">
                <Form.Label column sm="8">
                  Custom Time (in seconds):
                </Form.Label>
                <Col sm="4">
                  <Form.Control
                    type="number"
                    min="10"
                    step="1"
                    value={customTime}
                    onChange={(e) => handleCustomTimeChange(e.target.value)}
                    style={inputStyle(theme)}
                    size="sm"
                    placeholder="e.g., 45"
                    aria-invalid={!!customTimeError}
                  />
                  {customTimeError && (
                    <Form.Text className="text-danger" style={{ fontSize: "0.75rem" }}>
                      {customTimeError}
                    </Form.Text>
                  )}
                </Col>
              </Form.Group>
            )}
          </>
        )}
        <Form.Group as={Row} className="mb-0 align-items-center" controlId="fontSizeSelect">
          <Form.Label column sm="6">
            <FaFont className="me-2" /> Chat Font Size:
          </Form.Label>
          <Col sm="6">
            <Form.Select style={selectStyle(theme)} size="sm" disabled>
              <option>Medium</option>
            </Form.Select>
          </Col>
        </Form.Group>
      </div>

      {/* Video Call Section (Structure remains the same) */}
      <div style={sectionStyle(theme)} className="mb-3">
         <h3 style={headerStyle}>Video Call (Example)</h3>
         <Form.Group as={Row} className="mb-2 align-items-center" controlId="videoQualitySelect"><Form.Label column sm="6"><FaVideo className="me-2" /> Video Quality:</Form.Label><Col sm="6"><Form.Select style={selectStyle(theme)} size="sm" disabled><option>Medium</option></Form.Select></Col></Form.Group>
         <Form.Group as={Row} className="mb-2 align-items-center" controlId="disableCameraCheck"><Form.Label column sm="8"><FaCamera className="me-2" /> Disable Camera on Join:</Form.Label><Col sm="4" className="text-end"><Form.Check type="switch" disabled /></Col></Form.Group>
         <Form.Group as={Row} className="mb-0 align-items-center" controlId="autoMuteCheck"><Form.Label column sm="8"><FaMicrophoneSlash className="me-2" /> Auto-Mute on Join:</Form.Label><Col sm="4" className="text-end"><Form.Check type="switch" disabled /></Col></Form.Group>
      </div>

      {/* Back Button (Structure remains the same) */}
      <Link to="/" style={{ textDecoration: 'none' }}>
        <Button
          variant={theme === "dark" ? "outline-light" : "outline-primary"}
          size="lg"
          className="fw-bold mt-3"
        >
          <FaArrowLeft className="me-2" />
          Back to Home
        </Button>
      </Link>
    </div>
  );
};

// --- Styles (Copied from your provided code) ---
const sectionStyle = (theme) => ({
  backgroundColor: theme === "dark" ? "#2a2a2a" : "#f0f0f0",
  border: theme === 'dark' ? '1px solid #444' : '1px solid #ddd',
  padding: "15px 20px",
  marginBottom: "20px",
  width: "90%",
  maxWidth: "600px",
  borderRadius: "8px",
  boxShadow: theme === 'dark' ? '0 2px 5px rgba(0,0,0,0.3)' : '0 2px 5px rgba(0,0,0,0.1)',
});

const headerStyle = {
  marginBottom: '15px',
  fontSize: '1.1rem',
  borderBottom: '1px solid rgba(128, 128, 128, 0.3)',
  paddingBottom: '8px',
};

const selectStyle = (theme) => ({
  padding: "0.375rem 0.75rem",
  backgroundColor: theme === "dark" ? "#333" : "#fff",
  color: theme === "dark" ? "#fff" : "#333",
  border: theme === 'dark' ? '1px solid #555' : '1px solid #ccc',
  borderRadius: "4px",
  fontSize: '0.9rem',
});

const inputStyle = (theme) => ({
  padding: "0.375rem 0.75rem",
  backgroundColor: theme === "dark" ? "#333" : "#fff",
  color: theme === "dark" ? "#fff" : "#333",
  border: theme === 'dark' ? '1px solid #555' : '1px solid #ccc',
  borderRadius: "4px",
  fontSize: '0.9rem',
});

export default Settings;
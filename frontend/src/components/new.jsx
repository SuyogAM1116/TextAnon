import React, { useContext, useState } from "react";
import { Button, Form, Row, Col } from "react-bootstrap";
import { ThemeContext } from "../components/ThemeContext";
import { Link } from "react-router-dom";
import { FaClock, FaFont, FaVideo, FaMicrophoneSlash, FaCamera, FaArrowLeft } from "react-icons/fa";

const Settings = () => {
  const {
    theme,
    darkModeEnabled,
    setDarkModeEnabled,
    selfDestructEnabled,
    setSelfDestructEnabled,
    destructTime,
    setDestructTime,
    customTime,
    setCustomTime,
  } = useContext(ThemeContext);

  const [customTimeError, setCustomTimeError] = useState("");

  const handleDarkModeToggle = () => {
    setDarkModeEnabled(!darkModeEnabled);
  };

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

  return (
    <div className="container mt-5">
      <Row className="mb-4">
        <Col>
          <Link to="/" className="text-decoration-none">
            <FaArrowLeft /> Back to Home
          </Link>
        </Col>
      </Row>
      <h2>Settings</h2>
      <Form>
        <Form.Group as={Row} className="mb-3">
          <Form.Label column sm={2}>
            Dark Mode Feature
          </Form.Label>
          <Col sm={10}>
            <Button onClick={handleDarkModeToggle}>
              {darkModeEnabled ? "Disable Dark Mode" : "Enable Dark Mode"}
            </Button>
          </Col>
        </Form.Group>
{/* Message and Chat Section */}
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

      {/* Video Call Section */}
      <div style={sectionStyle(theme)} className="mb-3">
        <h3 style={headerStyle}>Video Call (Example)</h3>
        <Form.Group as={Row} className="mb-2 align-items-center" controlId="videoQualitySelect">
          <Form.Label column sm="6">
            <FaVideo className="me-2" /> Video Quality:
          </Form.Label>
          <Col sm="6">
            <Form.Select style={selectStyle(theme)} size="sm" disabled>
              <option>Medium</option>
            </Form.Select>
          </Col>
        </Form.Group>
        <Form.Group as={Row} className="mb-2 align-items-center" controlId="disableCameraCheck">
          <Form.Label column sm="8">
            <FaCamera className="me-2" /> Disable Camera on Join:
          </Form.Label>
          <Col sm="4" className="text-end">
            <Form.Check type="switch" disabled />
          </Col>
        </Form.Group>
        <Form.Group as={Row} className="mb-0 align-items-center" controlId="autoMuteCheck">
          <Form.Label column sm="8">
            <FaMicrophoneSlash className="me-2" /> Auto-Mute on Join:
          </Form.Label>
          <Col sm="4" className="text-end">
            <Form.Check type="switch" disabled />
          </Col>
        </Form.Group>
      </div>

      {/* Back Button */}
      <Link to="/" style={{ textDecoration: 'none' }}>
        <Button
          variant={theme === "dark" ? "outline-light" : "outline-primary"}
          size="lg"
          className="fw-bold mt-3"
        >
          <FaArrowLeft className="me-2" />
          Back to Home
        </Button>
      </Link>      </Form>
    </div>
  );
};

// --- Styles ---
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
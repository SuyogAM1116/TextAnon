import React, { useContext } from "react";
import { Row, Col, Form, Button } from "react-bootstrap";
import { ThemeContext } from "../components/ThemeContext"; // Import ThemeContext

const NameSelection = ({ name, setName, startChat }) => {
  const { theme } = useContext(ThemeContext); // Get theme from context

  return (
    <Row className="justify-content-center">
      <Col
        md={6}
        className="text-center p-4 rounded"
        style={{
          backgroundColor: theme === "dark" ? "#121212" : "#ffffff", // Dark: blackish, Light: white
          color: theme === "dark" ? "#ffffff" : "#333333", // Text color
          border: theme === "dark"
            ? "0.5px solid rgba(255, 255, 255, 0.2)"
            : "0.5px solid rgba(0, 0, 0, 0.2)", // Subtle border
          boxShadow: theme === "dark"
            ? "0px 4px 10px rgba(255, 255, 255, 0.1)"
            : "0px 4px 10px rgba(0, 0, 0, 0.1)", // Slight elevation
          transition: "background-color 0.3s ease, color 0.3s ease", // Smooth transition
        }}
      >
        <h2 className="mb-3">Anonymous Chat</h2>
        <Form.Control
          type="text"
          placeholder="Choose a name"
          className="mb-3 text-center"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            backgroundColor: theme === "dark" ? "#ffffff" : "#ffffff",
            color: theme === "dark" ? "#333333" : "#333333",
            border: theme === "dark" ? "1px solid #444" : "1px solid #ccc",
            transition: "background-color 0.3s ease, color 0.3s ease",
          }}
        />
        <Button
          variant="success"
          onClick={startChat}
          className="fw-bold"
          style={{
            padding: "10px 20px",
            border: "2px solid #198754", // Green Border
            color: "#fff",
          }}
        >
          Start Chat
        </Button>
      </Col>
    </Row>
  );
};

export default NameSelection;

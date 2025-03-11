import React, { useContext } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaShieldAlt, FaUserSecret, FaClock } from "react-icons/fa";
import { ThemeContext } from "../components/ThemeContext"; // Import ThemeContext

const Features = () => {
  const { theme } = useContext(ThemeContext); // Get theme from context

  const featureCardStyle = {
    backgroundColor: theme === "dark" ? "rgba(83, 82, 91, 0.7)" : "#ffffff", // Dark/Light Background
    borderRadius: "15px", // Rounded corners
    padding: "30px", // Increased padding for better spacing
    height: "250px", // Increased height for better content fitting
    boxShadow: theme === "dark" 
      ? "0 4px 10px rgba(255, 255, 255, 0.1)" 
      : "0 4px 10px rgba(0, 0, 0, 0.1)", // Adjusted shadow for themes
    transition: "transform 0.3s ease, box-shadow 0.3s ease",
    border: theme === "dark" ? "1px solid rgba(255, 255, 255, 0.2)" : "1px solid #ddd", // Dark/Light Border
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    color: theme === "dark" ? "#ffffff" : "#333333", // Dark/Light Text Color
  };

  return (
    <div
      style={{
        padding: "80px 0",
        backgroundColor: theme === "dark" ? "#121212" : "#f8f9fa", // Dark/Light Background
      }}
    >
      <Container>
        <h2
          className="fw-bold mb-5 text-center"
          style={{ color: theme === "dark" ? "#ffffff" : "#333333" }}
        >
          Why Choose TextAnon?
        </h2>
        <Row className="justify-content-center">
          {/* Secure Encryption Feature */}
          <Col md={4} className="d-flex justify-content-center">
            <div
              className="feature-card"
              style={featureCardStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-8px)";
                e.currentTarget.style.boxShadow =
                  theme === "dark"
                    ? "0 12px 24px rgba(255, 255, 255, 0.2)"
                    : "0 12px 24px rgba(0, 0, 0, 0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  theme === "dark"
                    ? "0 4px 10px rgba(255, 255, 255, 0.1)"
                    : "0 4px 10px rgba(0, 0, 0, 0.1)";
              }}
            >
              <FaShieldAlt size={60} className="text-primary" />
              <h4 className="mt-3">Secure Encryption</h4>
              <p style={{ fontSize: "15px", marginTop: "10px" }}>
                All messages and calls are end-to-end encrypted for maximum privacy.
              </p>
            </div>
          </Col>

          {/* No Sign-Up Feature */}
          <Col md={4} className="d-flex justify-content-center">
            <div
              className="feature-card"
              style={featureCardStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-8px)";
                e.currentTarget.style.boxShadow =
                  theme === "dark"
                    ? "0 12px 24px rgba(255, 255, 255, 0.2)"
                    : "0 12px 24px rgba(0, 0, 0, 0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  theme === "dark"
                    ? "0 4px 10px rgba(255, 255, 255, 0.1)"
                    : "0 4px 10px rgba(0, 0, 0, 0.1)";
              }}
            >
              <FaUserSecret size={60} className="text-success" />
              <h4 className="mt-3">No Sign-Up</h4>
              <p style={{ fontSize: "15px", marginTop: "10px" }}>
                Enjoy anonymous conversations without creating an account.
              </p>
            </div>
          </Col>

          {/* Self-Destructing Messages Feature */}
          <Col md={4} className="d-flex justify-content-center">
            <div
              className="feature-card"
              style={featureCardStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-8px)";
                e.currentTarget.style.boxShadow =
                  theme === "dark"
                    ? "0 12px 24px rgba(255, 255, 255, 0.2)"
                    : "0 12px 24px rgba(0, 0, 0, 0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  theme === "dark"
                    ? "0 4px 10px rgba(255, 255, 255, 0.1)"
                    : "0 4px 10px rgba(0, 0, 0, 0.1)";
              }}
            >
              <FaClock size={60} className="text-danger" />
              <h4 className="mt-3">Self-Destructing Messages</h4>
              <p style={{ fontSize: "15px", marginTop: "10px" }}>
                Messages disappear after a set time to ensure complete anonymity.
              </p>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default Features;

import React from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaShieldAlt, FaUserSecret, FaClock } from "react-icons/fa";

const Features = () => {
  const featureCardStyle = {
    backgroundColor: "rgba(83, 82, 91, 0.592)", // Retaining original background
    borderRadius: "15px", // Rounded corners
    padding: "30px", // Increased padding for better spacing
    height: "250px", // Increased height for better content fitting
    boxShadow: "0 4px 10px rgba(0, 0, 0, 0.1)", // Subtle shadow
    transition: "transform 0.3s ease, box-shadow 0.3s ease",
    border: "1px solid #ddd", // Visible border
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    color: "white",
  };

  return (
    <div style={{ padding: "80px 0", backgroundColor: "rgba(83, 82, 91, 0.592)" }}>
      <Container>
        <h2 className="fw-bold mb-5 text-center text-white">Why Choose TextAnon?</h2>
        <Row className="justify-content-center">
          <Col md={4} className="d-flex justify-content-center">
            <div
              className="feature-card"
              style={featureCardStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-8px)";
                e.currentTarget.style.boxShadow = "0 12px 24px rgba(0, 0, 0, 0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 10px rgba(0, 0, 0, 0.1)";
              }}
            >
              <FaShieldAlt size={60} className="text-primary" />
              <h4 className="mt-3">Secure Encryption</h4>
              <p style={{ fontSize: "15px", marginTop: "10px" }}>
                All messages and calls are end-to-end encrypted for maximum privacy.
              </p>
            </div>
          </Col>

          <Col md={4} className="d-flex justify-content-center">
            <div
              className="feature-card"
              style={featureCardStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-8px)";
                e.currentTarget.style.boxShadow = "0 12px 24px rgba(0, 0, 0, 0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 10px rgba(0, 0, 0, 0.1)";
              }}
            >
              <FaUserSecret size={60} className="text-success" />
              <h4 className="mt-3">No Sign-Up</h4>
              <p style={{ fontSize: "15px", marginTop: "10px" }}>
                Enjoy anonymous conversations without creating an account.
              </p>
            </div>
          </Col>

          <Col md={4} className="d-flex justify-content-center">
            <div
              className="feature-card"
              style={featureCardStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-8px)";
                e.currentTarget.style.boxShadow = "0 12px 24px rgba(0, 0, 0, 0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 10px rgba(0, 0, 0, 0.1)";
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

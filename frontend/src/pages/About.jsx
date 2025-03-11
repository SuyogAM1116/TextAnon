import React, { useContext } from "react";
import { Container, Row, Col, Card, Button } from "react-bootstrap";
import { FaUsers, FaShieldAlt, FaRocket, FaCheckCircle, FaArrowLeft, FaBell } from "react-icons/fa";
import { Link } from "react-router-dom";
import { ThemeContext } from "../components/ThemeContext"; // Correct import

const About = () => {
  const { theme } = useContext(ThemeContext); // Get theme state

  return (
    <div
      className="about-section py-5 d-flex flex-column align-items-center"
      style={{
        borderBottom: theme === "dark" ? "0.5px solid rgba(255, 255, 255, 0.2)" : "0.5px solid rgba(0, 0, 0, 0.2)",
        paddingBottom: "60px",
        textAlign: "center",
        backgroundColor: theme === "dark" ? "#121212" : "#f8f9fa", // Dark/Light Background
        color: theme === "dark" ? "#ffffff" : "#333333", // Dark/Light Text Color
      }}
    >
      <Container>
        <h1 className="fw-bold" style={{ fontSize: "3rem" }}>
          <FaUsers className="me-2" /> About <span className="text-primary">Text</span>
          <span className="text-success">Anon</span>
        </h1>
        <p className="fs-5 fst-italic" style={{ color: theme === "dark" ? "#cccccc" : "#555555" }}>
          A place where you can chat freely, anonymously, and securely with strangers worldwide.
        </p>

        <Row className="justify-content-center mt-4">
          {/* Mission - Single Column */}
          <Col md={12} className="mb-4">
            <Card
              style={{
                backgroundColor: theme === "dark" ? "#1e1e1e" : "#ffffff",
                borderLeft: `5px solid ${theme === "dark" ? "#28a745" : "#198754"}`,
                color: theme === "dark" ? "#f1f1f1" : "#212529",
                boxShadow: theme === "dark"
                  ? "0 4px 10px rgba(255, 255, 255, 0.1)"
                  : "0 4px 10px rgba(0, 0, 0, 0.1)",
              }}
              className="p-3"
            >
              <h3 className="fw-bold">
                <FaRocket className="me-2" /> Our Mission
              </h3>
              <p>
                We believe in <strong>free and open communication</strong> without sacrificing privacy. Our goal is to provide a <strong>secure, anonymous</strong> platform where users can connect without fear of data tracking.
              </p>
            </Card>
          </Col>

          {/* Why Choose Us - Single Column */}
          <Col md={12} className="mb-4">
            <Card
              style={{
                backgroundColor: theme === "dark" ? "#1e1e1e" : "#ffffff",
                borderLeft: `5px solid ${theme === "dark" ? "#ffc107" : "#fd7e14"}`,
                color: theme === "dark" ? "#f1f1f1" : "#212529",
              }}
              className="p-3"
            >
              <h3 className="fw-bold">
                <FaShieldAlt className="me-2" /> Why Choose Us?
              </h3>
              <p>
                Unlike other chat platforms, <strong>we don’t collect data, require sign-ups, or store chat logs</strong>. Whether you're looking for casual conversations or deep discussions, your <strong>privacy is always protected</strong>.
              </p>
            </Card>
          </Col>

          {/* Key Features - Single Column */}
          <Col md={12} className="mb-4">
            <Card
              style={{
                backgroundColor: theme === "dark" ? "#1e1e1e" : "#ffffff",
                borderLeft: `5px solid ${theme === "dark" ? "#17a2b8" : "#0d6efd"}`,
                color: theme === "dark" ? "#f1f1f1" : "#212529",
              }}
              className="p-3"
            >
              <h3 className="fw-bold">
                <FaCheckCircle className="me-2" /> Key Features
              </h3>
              <ul className="list-unstyled">
                <li>
                  <FaCheckCircle className="text-success me-2" />
                  <strong>End-to-End Encryption</strong> – No one can read your messages.
                </li>
                <li>
                  <FaCheckCircle className="text-success me-2" />
                  <strong>No Sign-Ups</strong> – Start chatting instantly.
                </li>
                <li>
                  <FaCheckCircle className="text-success me-2" />
                  <strong>Self-Destructing Messages</strong> – No chat logs saved.
                </li>
                <li>
                  <FaCheckCircle className="text-success me-2" />
                  <strong>Anonymous Video Calls</strong> – Fully encrypted.
                </li>
                <li>
                  <FaCheckCircle className="text-success me-2" />
                  <strong>Report & Block Feature</strong> – Stay safe from bad actors.
                </li>
              </ul>
            </Card>
          </Col>

          {/* Vision - Single Column */}
          <Col md={12} className="mb-4">
            <Card
              style={{
                backgroundColor: theme === "dark" ? "#1e1e1e" : "#ffffff",
                borderLeft: `5px solid ${theme === "dark" ? "#6610f2" : "#6f42c1"}`,
                color: theme === "dark" ? "#f1f1f1" : "#212529",
              }}
              className="p-3"
            >
              <h3 className="fw-bold">
                <FaUsers className="me-2" /> Our Vision
              </h3>
              <p>
                We envision a world where <strong>privacy is a right, not a luxury</strong>. In a time when big corporations track everything, TextAnon stands as a <strong>safe space for open conversations</strong>.
              </p>
            </Card>
          </Col>
        </Row>

        {/* Notification */}
        <p className="fs-5 mt-4" style={{ color: theme === "dark" ? "#bbbbbb" : "#555555" }}>
          <FaBell className="text-warning me-2" />
          Join TextAnon today and experience true anonymity!
        </p>

        {/* Back to Home Button */}
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
      </Container>
    </div>
  );
};

export default About;

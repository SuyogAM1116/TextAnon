import React, { useContext } from "react";
import { Container, Row, Col, Button } from "react-bootstrap";
import Lottie from "lottie-react";
import animationData from "../assets/video-marketing.json";
import { Link } from "react-router-dom";
import { ThemeContext } from "../components/ThemeContext"; 

const Hero = () => {
  const { theme } = useContext(ThemeContext); 

  return (
    <div
      className="hero-section py-5 d-flex flex-column align-items-center"
      style={{
        borderBottom: theme === "dark" ? "0.5px solid rgba(255, 255, 255, 0.2)" : "0.5px solid rgba(0, 0, 0, 0.2)",
        paddingBottom: "60px",
        textAlign: "center",
        backgroundColor: theme === "dark" ? "#121212" : "#f8f9fa",
        color: theme === "dark" ? "#ffffff" : "#333333", 
      }}
    >
      <Container>
        
        <h1 className="fw-bold" style={{ fontSize: "3.5rem" }}>
          <span className="text-primary">Text</span>
          <span className="text-success">Anon</span>
        </h1>
        <p className="fs-5 fst-italic" style={{ color: theme === "dark" ? "#cccccc" : "#555555" }}>
          Privacy-first chat & video calls—no login required!
        </p>

        <Row className="align-items-center mt-4">
          <Col md={6} className="d-flex justify-content-center">
            <Lottie
              animationData={animationData}
              style={{
                width: "100%",
                maxWidth: "400px",
                filter: theme === "dark"
                  ? "drop-shadow(0px 0px 10px rgba(255, 255, 255, 0.3))"
                  : "drop-shadow(0px 0px 10px rgba(0, 0, 0, 0.3))",
              }}
            />
          </Col>

          <Col md={6} className="text-center">
            <div style={{ width: "90%", maxWidth: "420px", margin: "0 auto" }}>
              <p className="fw-bold fs-5 mb-3">Get started instantly—choose how you want to connect!</p>
              <div className="d-grid gap-3">
                <Link to="/chat">
                  <Button
                    variant="success" 
                    size="lg"
                    className="fw-bold"
                    style={{
                      width: "100%",
                      padding: "14px",
                      border: "2px solid #198754", 
                      color: "#fff",
                    }}
                  >
                    Start Chat
                  </Button>
                </Link>
                <Link to="/video">
                  <Button
                    variant="primary" 
                    size="lg"
                    className="fw-bold"
                    style={{
                      width: "100%",
                      padding: "14px",
                      border: "2px solid #0d6efd", 
                      color: "#fff",
                    }}
                  >
                    Start Video Call
                  </Button>
                </Link>
              </div>
            </div>
          </Col>
        </Row>

        <p className="mt-4" style={{ color: theme === "dark" ? "#bbbbbb" : "#555555" }}>
          End-to-end encryption | No data stored
        </p>
      </Container>
    </div>
  );
};

export default Hero;

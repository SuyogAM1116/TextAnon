import React from "react";
import { Container, Row, Col, Button } from "react-bootstrap";
import Lottie from "lottie-react";
import animationData from "../assets/video-marketing.json"; // Import animation file

const Hero = () => {
  return (
    <div
      className="hero-section text-white py-5 d-flex flex-column align-items-center"
      style={{
        borderBottom: "0.5px solid rgba(255, 255, 255, 0.2)", // More visible separator
        paddingBottom: "60px",
        textAlign: "center",
      }}
    >
      <Container>
        {/* Top Section: Title & Subtitle */}
        <h1 className="fw-bold" style={{ fontSize: "3.5rem" }}> {/* Bigger & Bold */}
          <span className="text-primary">Text</span>
          <span className="text-success">Anon</span>
        </h1>
        <p className="text-light fs-5 fst-italic">Privacy-first chat & video calls—no login required!</p> {/* New tagline */}

        {/* Middle Section: Animation & Buttons */}
        <Row className="align-items-center mt-4">
          {/* Left Side: Animation */}
          <Col md={6} className="d-flex justify-content-center">
            <Lottie
              animationData={animationData}
              style={{
                width: "100%",
                maxWidth: "400px",
                filter: "drop-shadow(0px 0px 10px rgba(255, 255, 255, 0.3))", // Glowing effect
              }}
            />
          </Col>

          {/* Right Side: Buttons & Aligned Text */}
          <Col md={6} className="text-center">
            <div style={{ width: "90%", maxWidth: "420px", margin: "0 auto" }}> {/* Alignment wrapper */}
              <p className="fw-bold fs-5 mb-3">Get started instantly—choose how you want to connect!</p> {/* Aligned text */}
              <div className="d-grid gap-3"> {/* Stack buttons vertically */}
                <Button
                  variant="success"
                  size="lg"
                  className="fw-bold"
                  style={{ width: "100%", padding: "14px" }} // Full width inside wrapper
                >
                  Start Chat
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  className="fw-bold"
                  style={{ width: "100%", padding: "14px" }} // Full width inside wrapper
                >
                  Start Video Call
                </Button>
              </div>
            </div>
          </Col>
        </Row>

        {/* Bottom Line: End-to-End Encryption Message */}
        <p className="text-light mt-4">End-to-end encryption | No data stored</p>
      </Container>
    </div>
  );
};

export default Hero;

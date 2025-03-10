import React from "react";
import { Container, Button } from "react-bootstrap";

const Hero = () => {
  return (
    <div className="hero-section text-center text-white py-5">
      <Container>
        <h1 className="fw-bold">
          <span className="text-primary">Text</span>
          <span className="text-success">Anon</span>
        </h1>
        <p className="text-light">Secure & private conversations without sign-up</p>
        <div className="d-grid gap-3">
          <Button variant="success" size="lg" className="fw-bold">
            Start Chat
          </Button>
          <Button variant="primary" size="lg" className="fw-bold">
            Start Video Call
          </Button>
        </div>
        <p className="text-light mt-3">End-to-end encryption | No data stored</p>
      </Container>
    </div>
  );
};

export default Hero;

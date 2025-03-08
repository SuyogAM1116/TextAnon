import React from "react";
import { Container, Button } from "react-bootstrap";
import { FaCog, FaLock, FaInfoCircle } from "react-icons/fa";

const Home = () => {
  return (
    <Container className="text-center mt-5 p-4 bg-dark text-white rounded">
      {/* Logo and Title */}
      <div className="mb-3">
        <h1 className="fw-bold">
          <span className="text-primary">Text</span>
          <span className="text-success">Anon</span>
        </h1>
        <p className="text-success">
          Secure & private conversations without sign-up
        </p>
      </div>

      {/* Buttons */}
      <div className="d-grid gap-3">
        <Button variant="success" size="lg" className="fw-bold">
          Start Chat
        </Button>
        <Button variant="primary" size="lg" className="fw-bold">
          Start Video Call
        </Button>
      </div>

      {/* Security Info */}
      <p className="text-success mt-3">End-to-end encryption | No data stored</p>

      {/* Footer Icons */}
      <div className="mt-3">
        <FaCog className="text-white mx-2" size={25} />
        <FaLock className="text-white mx-2" size={25} />
        <FaInfoCircle className="text-white mx-2" size={25} />
      </div>
    </Container>
  );
};

export default Home;

import React from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaShieldAlt, FaUserSecret, FaClock } from "react-icons/fa";

const Features = () => {
  return (
    <div className="features-section text-white py-5">
      <Container>
        <h2 className="fw-bold mb-4 text-center">Why Choose TextAnon?</h2>
        <Row className="text-center">
          <Col md={4} className="p-3">
            <FaShieldAlt size={50} className="text-primary" />
            <h4 className="mt-3">Secure Encryption</h4>
            <p>All messages and calls are end-to-end encrypted for maximum privacy.</p>
          </Col>
          <Col md={4} className="p-3">
            <FaUserSecret size={50} className="text-success" />
            <h4 className="mt-3">No Sign-Up</h4>
            <p>Enjoy anonymous conversations without creating an account.</p>
          </Col>
          <Col md={4} className="p-3">
            <FaClock size={50} className="text-danger" />
            <h4 className="mt-3">Self-Destructing Messages</h4>
            <p>Messages disappear after a set time to ensure complete anonymity.</p>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default Features;

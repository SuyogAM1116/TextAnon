import React from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaFacebook, FaXTwitter, FaInstagram } from "react-icons/fa6";

const Footer = () => {
  return (
    <Container fluid className="footer bg-dark text-white py-4">
      <Row className="text-center text-md-start">
        {/* Brand Info */}
        <Col xs={12} md={3} className="mb-3">
          <h5 className="fw-bold">TextAnon</h5>
          <p>Secure & private anonymous communication.</p>
        </Col>

        {/* Quick Links */}
        <Col xs={6} md={3} className="mb-3">
          <h6 className="fw-bold">Explore More</h6>
          <ul className="list-unstyled">
            <li><a href="/about" className="text-white text-decoration-none">About Us</a></li>
            <li><a href="#contact" className="text-white text-decoration-none">Contact</a></li>
          </ul>
        </Col>

        {/* Resources */}
        <Col xs={6} md={3} className="mb-3">
          <h6 className="fw-bold">Resources</h6>
          <ul className="list-unstyled">
            <li><a href="#faq" className="text-white text-decoration-none">FAQ</a></li>
            <li><a href="#blog" className="text-white text-decoration-none">Blog</a></li>
            <li><a href="#privacy" className="text-white text-decoration-none">Privacy Policy</a></li>
            <li><a href="#terms" className="text-white text-decoration-none">Terms of Service</a></li>
          </ul>
        </Col>

        {/* Social Media */}
        <Col xs={12} md={3} className="mb-3">
          <h6 className="fw-bold">Follow Us</h6>
          <a href="https://facebook.com" className="text-white me-3 text-decoration-none">
            <FaFacebook size={18} /> Facebook
          </a>
          <br />
          <a href="https://twitter.com" className="text-white me-3 text-decoration-none">
            <FaXTwitter size={18} /> X (Twitter)
          </a>
          <br />
          <a href="https://instagram.com" className="text-white text-decoration-none">
            <FaInstagram size={18} /> Instagram
          </a>
        </Col>
      </Row>

      {/* Copyright */}
      <Row className="text-center mt-3">
        <Col>
          <p className="mb-0">© 2025 TextAnon. All Rights Reserved.</p>
        </Col>
      </Row>
    </Container>
  );
};

export default Footer;

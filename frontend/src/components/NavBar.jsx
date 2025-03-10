import React from "react";
import { Navbar, Container, Nav } from "react-bootstrap";
import { FaLock, FaInfoCircle, FaCog } from "react-icons/fa";

const NavBar = () => {
  return (
    <Navbar bg="dark" variant="dark" expand="lg" sticky="top" className="shadow">
      <Container>
        <img src="/logo.png" alt="TextAnon Logo" width={75} height={75} />
        <Navbar.Brand href="#" className="fw-bold fs-2"> {/* Increased font size */}
          <span className="text-primary">Text</span>
          <span className="text-success">Anon</span>
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto">
            <Nav.Link href="#security">
              <FaLock className="text-white" size={30} />
            </Nav.Link>
            <Nav.Link href="#about">
              <FaInfoCircle className="text-white" size={30} />
            </Nav.Link>
            <Nav.Link href="#settings">
              <FaCog className="text-white" size={30} />
            </Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default NavBar;

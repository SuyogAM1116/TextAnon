import React, { useState, useEffect } from "react";
import { Navbar, Container, Nav } from "react-bootstrap";
import { FaLock, FaInfoCircle, FaCog } from "react-icons/fa";

const NavBar = () => {
  // Load theme from local storage (if available)
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });

  // Toggle dark mode & update local storage
  const toggleTheme = () => {
    const newTheme = !darkMode;
    setDarkMode(newTheme);
    localStorage.setItem("theme", newTheme ? "dark" : "light");

    // Apply theme to body
    document.body.setAttribute("data-theme", newTheme ? "dark" : "light");
  };

  // Apply theme on first render
  useEffect(() => {
    document.body.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  return (
    <Navbar
      bg={darkMode ? "dark" : "light"}
      variant={darkMode ? "dark" : "light"}
      expand="lg"
      sticky="top"
      className="shadow"
    >
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

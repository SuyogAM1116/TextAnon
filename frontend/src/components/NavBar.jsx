import React, { useState, useEffect } from "react";
import { Navbar, Container, Nav } from "react-bootstrap";
import { FaLock, FaInfoCircle, FaCog, FaMoon, FaSun } from "react-icons/fa";

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
        {/* Logo changes based on theme */}
        <img
          src={darkMode ? "/logo.png" : "/logolight.jpg"}
          alt="TextAnon Logo"
          width={75}
          height={75}
        />

        {/* Brand Name */}
        <Navbar.Brand href="#" className="fw-bold fs-2">
          <span className="text-primary">Text</span>
          <span className="text-success">Anon</span>
        </Navbar.Brand>

        {/* Navbar Toggle for Mobile */}
        <Navbar.Toggle aria-controls="basic-navbar-nav" />

        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto align-items-center d-flex">
            {/* Theme Toggle Button & Text */}
            <div className="d-flex align-items-center me-4"> {/* Added space to right */}
              <Nav.Link onClick={toggleTheme} style={{ cursor: "pointer" }} className="d-flex align-items-center">
                {darkMode ? (
                  <FaSun className="text-warning" size={30} /> // Sun for Light Mode
                ) : (
                  <FaMoon className="text-dark" size={30} /> // Moon for Dark Mode
                )}
                <span className="ms-2 fw-bold">{darkMode ? "Dark Mode" : "Light Mode"}</span>
              </Nav.Link>
            </div>

            {/* Other Navbar Icons */}
            <Nav.Link href="#security" className="ms-3">
              <FaLock className={darkMode ? "text-white" : "text-dark"} size={30} />
            </Nav.Link>
            <Nav.Link href="#about" className="ms-3">
              <FaInfoCircle className={darkMode ? "text-white" : "text-dark"} size={30} />
            </Nav.Link>
            <Nav.Link href="#settings" className="ms-3">
              <FaCog className={darkMode ? "text-white" : "text-dark"} size={30} />
            </Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default NavBar;

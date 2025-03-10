import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate
import { Navbar, Container, Nav } from "react-bootstrap";
import { FaLock, FaInfoCircle, FaCog } from "react-icons/fa";
import ThemeToggle from "./ThemeToggle"; // Import ThemeToggle Component

const NavBar = () => {
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");
  const navigate = useNavigate(); // Initialize navigation

  return (
    <Navbar
      bg={theme === "dark" ? "dark" : "light"}
      variant={theme === "dark" ? "dark" : "light"}
      expand="lg"
      sticky="top"
      className="shadow"
    >
      <Container>
        {/* Logo (Clickable to Navigate to Home) */}
        <img
          src={theme === "dark" ? "/logo.png" : "/logolight.jpg"}
          alt="TextAnon Logo"
          width={75}
          height={75}
          style={{ cursor: "pointer" }}
          onClick={() => navigate("/")} // Navigate to Home
        />

        {/* Brand Name (Clickable to Navigate to Home) */}
        <Navbar.Brand
          onClick={() => navigate("/")}
          className="fw-bold fs-2"
          style={{ cursor: "pointer" }}
        >
          <span className="text-primary">Text</span>
          <span className="text-success">Anon</span>
        </Navbar.Brand>

        {/* Navbar Toggle for Mobile */}
        <Navbar.Toggle aria-controls="basic-navbar-nav" />

        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto align-items-center d-flex">
            {/* Other Navbar Icons */}
            <Nav.Link href="#security" className="ms-3">
              <FaLock className={theme === "dark" ? "text-white" : "text-dark"} size={30} />
            </Nav.Link>
            <Nav.Link href="#about" className="ms-3">
              <FaInfoCircle className={theme === "dark" ? "text-white" : "text-dark"} size={30} />
            </Nav.Link>
            <Nav.Link href="#settings" className="ms-3">
              <FaCog className={theme === "dark" ? "text-white" : "text-dark"} size={30} />
            </Nav.Link>

            {/* Theme Toggle Component (Placed at Right End) */}
            <div className="ms-5">
              <ThemeToggle onThemeChange={setTheme} />
            </div>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default NavBar;

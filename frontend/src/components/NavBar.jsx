import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar, Container, Nav, Button } from "react-bootstrap";
import { FaLock, FaInfoCircle, FaCog } from "react-icons/fa";
import ThemeToggle from "./ThemeToggle";
import { ThemeContext } from "../components/ThemeContext"; // Import ThemeContext

const NavBar = () => {
  const { theme, darkModeEnabled } = useContext(ThemeContext);
  const navigate = useNavigate();

  const openSettingsInNewTab = () => {
    window.open("/settings", "_blank");
  };

  return (
    <Navbar
      bg={theme === "dark" ? "dark" : "light"}
      variant={theme === "dark" ? "dark" : "light"}
      expand="lg"
      sticky="top"
      className="shadow"
    >
      <Container>
        <img
          src={theme === "dark" ? "/logo.png" : "/logolight.jpg"}
          alt="TextAnon Logo"
          width={75}
          height={75}
          style={{ cursor: "pointer" }}
          onClick={() => navigate("/")}
        />

        <Navbar.Brand
          onClick={() => navigate("/")}
          className="fw-bold fs-2"
          style={{ cursor: "pointer" }}
        >
          <span className="text-primary">Text</span>
          <span className="text-success">Anon</span>
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="basic-navbar-nav" />

        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto align-items-center d-flex">
            <Nav.Link onClick={() => navigate("/privacy")} className="ms-3" style={{ cursor: "pointer" }}>
              <FaLock className={theme === "dark" ? "text-white" : "text-dark"} size={30} />
            </Nav.Link>

            <Nav.Link onClick={() => navigate("/about")} className="ms-3" style={{ cursor: "pointer" }}>
              <FaInfoCircle className={theme === "dark" ? "text-white" : "text-dark"} size={30} />
            </Nav.Link>

            <Nav.Link onClick={openSettingsInNewTab} className="ms-3" style={{ cursor: "pointer" }}>
              <FaCog className={theme === "dark" ? "text-white" : "text-dark"} size={30} />
            </Nav.Link>

            {darkModeEnabled && (
              <div className="ms-5">
                <ThemeToggle />
              </div>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default NavBar;
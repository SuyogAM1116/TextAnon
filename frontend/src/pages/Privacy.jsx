import React, { useContext } from "react";
import { Link } from "react-router-dom";
import { Button } from "react-bootstrap";
import { FaLock, FaArrowLeft, FaShieldAlt, FaUserSecret, FaEyeSlash, FaBomb, FaBan, FaVideo } from "react-icons/fa";
import { ThemeContext } from "../components/ThemeContext"; 

const Privacy = () => {
  const { theme } = useContext(ThemeContext); 

 
  const styles = {
    page: {
      width: "100%",
      minHeight: "100vh", 
      backgroundColor: theme === "dark" ? "#121212" : "#f8f9fa", 
      color: theme === "dark" ? "#f1f1f1" : "#333", 
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      textAlign: "center",
      flexDirection: "column",
      paddingTop: "10px", 
      paddingBottom: "60px",
    },
    container: {
      width: "90%",
      maxWidth: "800px",
      padding: "20px",
    },
    title: {
      fontSize: "2.5em",
      fontWeight: "bold",
      marginBottom: "10px",
    },
    subtitle: {
      fontSize: "1.2em",
      marginBottom: "20px",
      color: theme === "dark" ? "#cccccc" : "#555555",
    },
    box: {
      backgroundColor: theme === "dark" ? "#1e1e1e" : "#ffffff",
      padding: "15px",
      margin: "15px auto",
      borderRadius: "8px",
      borderLeft: `5px solid ${theme === "dark" ? "#007bff" : "#0d6efd"}`, 
      textAlign: "left",
      color: theme === "dark" ? "#f1f1f1" : "#212529",
      boxShadow: theme === "dark"
        ? "0 4px 10px rgba(255, 255, 255, 0.1)"
        : "0 4px 10px rgba(0, 0, 0, 0.1)",
    },
    boxTitle: {
      fontSize: "1.5em",
    },
    boxText: {
      fontSize: "1.1em",
      color: theme === "dark" ? "#d3d3d3" : "#555",
    },
    footer: {
      fontSize: "1em",
      color: theme === "dark" ? "#bbbbbb" : "#666",
      marginTop: "20px",
    },
    backHome: {
      display: "inline-block",
      marginTop: "20px",
      color: theme === "dark" ? "#28a745" : "#007bff",
      fontSize: "1.2em",
      textDecoration: "none",
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>
          <FaLock className="me-2" /> Privacy & Security
        </h1>
        <p style={styles.subtitle}>
          Your privacy is our top priority. Here’s how we protect you:
        </p>

        <div style={styles.box}>
          <h3 style={styles.boxTitle}>
            <FaShieldAlt className="me-2" /> End-to-End Encryption
          </h3>
          <p style={styles.boxText}>
            All messages and video calls are encrypted, ensuring that only you and the recipient can access them.
          </p>
        </div>

        <div style={styles.box}>
          <h3 style={styles.boxTitle}>
            <FaUserSecret className="me-2" /> No Data Collection
          </h3>
          <p style={styles.boxText}>
            We do not store chat logs, call records, or personal data. Conversations disappear once you close the chat.
          </p>
        </div>

        <div style={styles.box}>
          <h3 style={styles.boxTitle}>
            <FaEyeSlash className="me-2" /> No Sign-Up Required
          </h3>
          <p style={styles.boxText}>
            Unlike other messaging apps, we don’t ask for emails or phone numbers. Start chatting instantly!
          </p>
        </div>

        <div style={styles.box}>
          <h3 style={styles.boxTitle}>
            <FaBomb className="me-2" /> Self-Destructing Messages
          </h3>
          <p style={styles.boxText}>
            Messages automatically delete after a set time, preventing anyone from accessing old conversations.
          </p>
        </div>

        <div style={styles.box}>
          <h3 style={styles.boxTitle}>
            <FaBan className="me-2" /> Report & Block Feature
          </h3>
          <p style={styles.boxText}>
            You can report and block users instantly to ensure a safer experience.
          </p>
        </div>

        <div style={styles.box}>
          <h3 style={styles.boxTitle}>
            <FaVideo className="me-2" /> Anonymous Video Calls
          </h3>
          <p style={styles.boxText}>
            Your video calls are peer-to-peer, meaning they don’t go through any central server, ensuring maximum privacy.
          </p>
        </div>

        <p style={styles.footer}>
          <FaShieldAlt className="text-warning me-2" />
          Your safety matters! Use strong passwords and never share sensitive info online.
        </p>

        <Link to="/">
          <Button
            variant={theme === "dark" ? "success" : "outline-success"}
            size="lg"
            className="fw-bold"
          >
            <FaArrowLeft className="me-2" />
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default Privacy;

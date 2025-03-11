import React from "react";
import { Link } from "react-router-dom";
import { FaLock, FaArrowLeft } from "react-icons/fa";

const Privacy = () => {
  // Inline styles for scoped styling
  const styles = {
    page: {
      width: "100%",
      minHeight: "100vh", // Full viewport height
      backgroundColor: "#121212", // Dark background
      color: "#f1f1f1", // Light text
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      textAlign: "center",
      flexDirection: "column",
      paddingTop: "10px", // Prevent overlap with Navbar
      paddingBottom: "60px", // Prevent overlap with Footer
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
    },
    box: {
      backgroundColor: "#1e1e1e",
      padding: "15px",
      margin: "15px auto",
      borderRadius: "8px",
      borderLeft: "5px solid #007bff", // Blue left border
      textAlign: "left",
    },
    boxTitle: {
      color: "#fff",
      fontSize: "1.5em",
    },
    boxText: {
      fontSize: "1.1em",
      color: "#d3d3d3",
    },
    footer: {
      fontSize: "1em",
      color: "#ccc",
      marginTop: "20px",
    },
    backHome: {
      display: "inline-block",
      marginTop: "20px",
      color: "#007bff",
      fontSize: "1.2em",
      textDecoration: "none",
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>
          <FaLock /> Privacy & Security
        </h1>
        <p style={styles.subtitle}>
          Your privacy is our top priority. Here’s how we protect you:
        </p>

        <div style={styles.box}>
          <h3 style={styles.boxTitle}>🔒 End-to-End Encryption</h3>
          <p style={styles.boxText}>
            All messages and video calls are encrypted, ensuring that only you and the recipient can access them.
          </p>
        </div>

        <div style={styles.box}>
          <h3 style={styles.boxTitle}>📜 No Data Collection</h3>
          <p style={styles.boxText}>
            We do not store chat logs, call records, or personal data. Conversations disappear once you close the chat.
          </p>
        </div>

        <div style={styles.box}>
          <h3 style={styles.boxTitle}>🚫 No Sign-Up Required</h3>
          <p style={styles.boxText}>
            Unlike other messaging apps, we don’t ask for emails or phone numbers. Start chatting instantly!
          </p>
        </div>

        <div style={styles.box}>
          <h3 style={styles.boxTitle}>💣 Self-Destructing Messages</h3>
          <p style={styles.boxText}>
            Messages automatically delete after a set time, preventing anyone from accessing old conversations.
          </p>
        </div>

        <div style={styles.box}>
          <h3 style={styles.boxTitle}>🔴 Report & Block Feature</h3>
          <p style={styles.boxText}>
            You can report and block users instantly to ensure a safer experience.
          </p>
        </div>

        <div style={styles.box}>
          <h3 style={styles.boxTitle}>🟢 Anonymous Video Calls</h3>
          <p style={styles.boxText}>
            Your video calls are peer-to-peer, meaning they don’t go through any central server, ensuring maximum privacy.
          </p>
        </div>

        <p style={styles.footer}>
          🔔 Your safety matters! Use strong passwords and never share sensitive info online.
        </p>

        <Link to="/" style={styles.backHome}>
          <FaArrowLeft /> Back to Home
        </Link>
      </div>
    </div>
  );
};

export default Privacy;

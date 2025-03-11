import React from "react";
import { Link } from "react-router-dom";
import { FaUsers, FaShieldAlt, FaRocket, FaCheckCircle, FaArrowLeft } from "react-icons/fa";

const About = () => {
  const styles = {
    page: {
      width: "100%",
      minHeight: "100vh",
      backgroundColor: "#121212",
      color: "#f1f1f1",
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
    },
    box: {
      backgroundColor: "#1e1e1e",
      padding: "15px",
      margin: "15px auto",
      borderRadius: "8px",
      borderLeft: "5px solid #28a745",
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
      color: "#28a745",
      fontSize: "1.2em",
      textDecoration: "none",
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>
          <FaUsers /> About TextAnon
        </h1>
        <p style={styles.subtitle}>
          A place where you can chat freely, anonymously, and securely with strangers worldwide.
        </p>

        <div style={styles.box}>
          <h3 style={styles.boxTitle}>🚀 Our Mission</h3>
          <p style={styles.boxText}>
            At TextAnon, we believe in **free and open communication** without sacrificing privacy. Our goal is to provide a **secure, anonymous** platform where users can connect **without fear of data tracking or surveillance**.
          </p>
        </div>

        <div style={styles.box}>
          <h3 style={styles.boxTitle}>🔒 Why Choose TextAnon?</h3>
          <p style={styles.boxText}>
            Unlike other chat platforms, **we don’t collect data, require sign-ups, or store chat logs**. Whether you're looking for casual conversations or deep discussions, **your privacy is always protected**.
          </p>
        </div>

        <div style={styles.box}>
          <h3 style={styles.boxTitle}>🛡️ Key Features</h3>
          <p style={styles.boxText}>
            <FaShieldAlt /> **End-to-End Encryption** – No one, not even us, can read your messages.  
            <br />
            <FaCheckCircle /> **No Sign-Ups** – Just click and start chatting, no email or phone required.  
            <br />
            <FaCheckCircle /> **Self-Destructing Messages** – Once the chat is closed, everything is gone.  
            <br />
            <FaCheckCircle /> **Anonymous Video Calls** – Secure, peer-to-peer encrypted video chats.  
            <br />
            <FaCheckCircle /> **Report & Block Feature** – Stay safe by reporting inappropriate users.  
          </p>
        </div>

        <div style={styles.box}>
          <h3 style={styles.boxTitle}>🌎 Our Vision</h3>
          <p style={styles.boxText}>
            We envision a world where **privacy is a right, not a luxury**. In a time when big corporations track everything, TextAnon stands as a **safe space for open conversations without surveillance**.
          </p>
        </div>

        <p style={styles.footer}>
          🔔 Join TextAnon today and experience a truly private, anonymous chat.
        </p>

        <Link to="/" style={styles.backHome}>
          <FaArrowLeft /> Back to Home
        </Link>
      </div>
    </div>
  );
};

export default About;

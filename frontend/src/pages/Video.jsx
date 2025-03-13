import React, { useState, useRef, useContext } from "react";
import { ThemeContext } from "../components/ThemeContext"; // Import ThemeContext

const Video = () => {
  const { theme } = useContext(ThemeContext);
  const [username, setUsername] = useState("");
  const [nameConfirmed, setNameConfirmed] = useState(false);
  const [callStarted, setCallStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);

  const userVideoRef = useRef(null);
  const strangerVideoRef = useRef(null);
  const streamRef = useRef(null);

  // Start Video Call
  const startVideoCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      streamRef.current = stream;
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = stream;
      }

      // Simulate stranger video (for testing)
      setTimeout(() => {
        if (strangerVideoRef.current) {
          strangerVideoRef.current.srcObject = stream;
        }
      }, 2000);

      setCallStarted(true);
    } catch (error) {
      console.error("Error accessing camera/microphone:", error);
    }
  };

  // Toggle Mute
  const toggleMute = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => (track.enabled = muted));
    }
    setMuted(!muted);
  };

  // Toggle Video
  const toggleVideo = () => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((track) => (track.enabled = !videoEnabled));
    }
    setVideoEnabled(!videoEnabled);
  };

  // End Call
  const endCall = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    setCallStarted(false);
    setNameConfirmed(false);
    setUsername("");
  };

  return (
    <div
      style={{
        backgroundColor: theme === "dark" ? "#121212" : "#f8f9fa",
        color: theme === "dark" ? "#ffffff" : "#333333",
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        padding: "20px",
        position: "relative",
      }}
    >
      {/* Name Selection */}
      {!nameConfirmed ? (
        <div
          style={{
            backgroundColor: theme === "dark" ? "#1e1e1e" : "#ffffff",
            padding: "25px",
            borderRadius: "10px",
            textAlign: "center",
            width: "400px",
            boxShadow: theme === "dark"
              ? "0px 4px 10px rgba(255, 255, 255, 0.2)"
              : "0px 4px 10px rgba(0, 0, 0, 0.2)",
          }}
        >
          <h2 style={{ color: theme === "dark" ? "#ffffff" : "#222222" }}>
            Anonymous Video Call
          </h2>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose a name"
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "5px",
              border: "1px solid #ccc",
              fontSize: "16px",
              textAlign: "center",
              outline: "none",
              backgroundColor: theme === "dark" ? "#333" : "#fff",
              color: theme === "dark" ? "#ffffff" : "#222",
            }}
          />
          <button
            onClick={() => setNameConfirmed(username.trim() !== "")}
            style={startButtonStyle}
          >
            Start Video
          </button>
        </div>
      ) : !callStarted ? (
        <div style={{ textAlign: "center" }}>
          <h2>Anonymous Video Call</h2>
          <button onClick={startVideoCall} style={startButtonStyle}>Start Video Call</button>
        </div>
      ) : (
        <div style={{ textAlign: "center" }}>
          <h2>Anonymous Video Call</h2>
          <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginBottom: "10px" }}>
            <video ref={userVideoRef} autoPlay muted playsInline style={videoStyle} />
            <video ref={strangerVideoRef} autoPlay playsInline style={videoStyle} />
          </div>
          {/* Control Buttons */}
          <div style={{ display: "flex", justifyContent: "center", gap: "15px" }}>
            <button onClick={toggleMute} style={emojiButtonStyle}>
              <span className="material-icons">{muted ? "mic_off" : "mic"}</span>
            </button>

            <button onClick={toggleVideo} style={emojiButtonStyle}>
              <span className="material-icons">{videoEnabled ? "videocam" : "videocam_off"}</span>
            </button>

            <button onClick={endCall} style={endButtonStyle}>
              <span className="material-icons">call_end</span>
            </button>
          </div>
          {/* Skip to Next Button */}
          <div style={{ marginTop: "10px" }}>
            <button onClick={endCall} style={skipButtonStyle}>Skip to Next</button>
          </div>
        </div>
      )}

      {/* Message Image in Bottom Right */}
      <div
        style={{
          position: "absolute",
          bottom: "20px",
          right: "20px",
          width: "50px", // Adjust size of the image
          height: "50px",
          cursor: "pointer",
        }}
      >
        <img
          src="/msg.png" // Replace with the correct path to your image
          alt="Message"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    </div>
  );
};

/* Styles */
const videoStyle = {
  width: "600px", // Increased size
  height: "400px",
  backgroundColor: "#000",
  borderRadius: "10px",
};

const emojiButtonStyle = {
  width: "80px",  // Bigger button size
  height: "80px",
  fontSize: "40px", // Bigger emoji size
  backgroundColor: "#007bff",
  color: "#fff",
  border: "none",
  borderRadius: "50%",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const endButtonStyle = {
  ...emojiButtonStyle,
  backgroundColor: "red",
};

const skipButtonStyle = {
  padding: "12px 24px",
  backgroundColor: "#6c757d",
  color: "#fff",
  border: "none",
  borderRadius: "5px",
  cursor: "pointer",
  fontSize: "18px",
  marginTop: "10px",
};

const startButtonStyle = {
  width: "100%",
  padding: "12px",
  backgroundColor: "#198754",
  color: "#fff",
  border: "none",
  borderRadius: "5px",
  cursor: "pointer",
  fontSize: "16px",
  marginTop: "10px",
};

const nextButtonStyle = {
  padding: "10px",
  backgroundColor: "#6c757d",
  color: "#fff",
  border: "none",
  borderRadius: "5px",
  cursor: "pointer",
  marginLeft: "10px",
};

export default Video;

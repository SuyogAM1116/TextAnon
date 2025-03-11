import React, { useState, useRef, useEffect } from "react";

const Video = () => {
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
      streamRef.current.getAudioTracks().forEach(track => (track.enabled = muted));
    }
    setMuted(!muted);
  };

  // Toggle Video
  const toggleVideo = () => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(track => (track.enabled = !videoEnabled));
    }
    setVideoEnabled(!videoEnabled);
  };

  // End Call
  const endCall = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setCallStarted(false);
    setNameConfirmed(false);
    setUsername("");
  };

  return (
    <div style={styles.container}>
      {/* Name Selection */}
      {!nameConfirmed ? (
        <div style={styles.nameSelection}>
          <h2 style={styles.heading}>Anonymous Video Call</h2>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose a name"
            style={styles.input}
          />
          <button
            onClick={() => setNameConfirmed(username.trim() !== "")}
            style={styles.startButton}
          >
            Start Video
          </button>
        </div>
      ) : !callStarted ? (
        <div style={styles.callScreen}>
          <h2>Anonymous Video Call</h2>
          <button onClick={startVideoCall} style={styles.startButton}>
            Start Video Call
          </button>
          <button onClick={endCall} style={styles.nextButton}>
            Next
          </button>
        </div>
      ) : (
        <div style={styles.videoCallBox}>
          <h2>Anonymous Video Call</h2>
          <div style={styles.videoContainer}>
            <video ref={userVideoRef} autoPlay muted playsInline style={styles.video} />
            <video ref={strangerVideoRef} autoPlay playsInline style={styles.video} />
          </div>
          <div style={styles.controls}>
            <button onClick={toggleMute} style={styles.controlButton}>
              {muted ? "Unmute" : "Mute"}
            </button>
            <button onClick={toggleVideo} style={styles.controlButton}>
              {videoEnabled ? "Disable Video" : "Enable Video"}
            </button>
            <button onClick={endCall} style={styles.endButton}>End</button>
            <button onClick={endCall} style={styles.nextButton}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
};

/* Styles */
const styles = {
  container: {
    backgroundColor: "#222",
    color: "#fff",
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "column",
  },
  nameSelection: {
    backgroundColor: "#1e1e1e",
    padding: "25px",
    borderRadius: "10px",
    textAlign: "center",
    width: "400px",
    boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.2)",
  },
  heading: {
    color: "#fff",
    fontSize: "24px",
    marginBottom: "15px",
  },
  input: {
    width: "100%",
    padding: "12px",
    borderRadius: "5px",
    border: "none",
    fontSize: "16px",
    textAlign: "center",
    outline: "none",
  },
  startButton: {
    width: "100%",
    padding: "12px",
    backgroundColor: "#198754",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "16px",
    marginTop: "10px",
  },
  callScreen: {
    textAlign: "center",
  },
  videoCallBox: {
    textAlign: "center",
  },
  videoContainer: {
    display: "flex",
    justifyContent: "center",
    gap: "10px",
    marginBottom: "10px",
  },
  video: {
    width: "300px",
    height: "200px",
    backgroundColor: "#000",
    borderRadius: "10px",
  },
  controls: {
    display: "flex",
    justifyContent: "center",
    gap: "10px",
  },
  controlButton: {
    padding: "10px",
    backgroundColor: "#007bff",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
  },
  endButton: {
    padding: "10px",
    backgroundColor: "red",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
  },
  nextButton: {
    padding: "10px",
    backgroundColor: "#6c757d",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
  },
};

export default Video;

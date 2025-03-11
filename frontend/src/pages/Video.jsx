import React, { useState, useRef, useEffect } from "react";

const Video = () => {
  const [username, setUsername] = useState("");
  const [callStarted, setCallStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);

  const userVideoRef = useRef(null);
  const strangerVideoRef = useRef(null);
  const peerConnection = useRef(null);
  const streamRef = useRef(null);

  // Function to start the video call
  const startVideoCall = async () => {
    if (!username.trim()) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      streamRef.current = stream;
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = stream;
      }

      // Placeholder: This is where WebRTC signaling and connection logic will be added
      // For now, simulate the stranger's video by mirroring the user's video
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
    setUsername("");
  };

  return (
    <div style={styles.container}>
      {/* If call hasn't started, show name input */}
      {!callStarted ? (
        <div style={styles.nameEntryBox}>
          <h2>Anonymous Video Call</h2>
          <label>Enter your name: </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose a name"
            style={styles.input}
          />
          <button onClick={startVideoCall} style={styles.startButton}>
            Start Video Call
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
  nameEntryBox: {
    backgroundColor: "#333",
    padding: "20px",
    borderRadius: "10px",
    textAlign: "center",
  },
  input: {
    padding: "10px",
    margin: "10px 0",
    borderRadius: "5px",
    border: "none",
  },
  startButton: {
    padding: "10px 20px",
    backgroundColor: "#777",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
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
};

export default Video;

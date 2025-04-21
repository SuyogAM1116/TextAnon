import React, { useEffect, useRef, useState, useContext } from "react";
import { ThemeContext } from "../components/ThemeContext";
import Peer from "simple-peer";

const Video = () => {
  const { theme } = useContext(ThemeContext);
  const [username, setUsername] = useState("");
  const [nameConfirmed, setNameConfirmed] = useState(false);
  const [stream, setStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [callerSignal, setCallerSignal] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [callStarted, setCallStarted] = useState(false);
  const [peerConnected, setPeerConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [mediaStatus, setMediaStatus] = useState("Waiting to start media");
  const [wsConnected, setWsConnected] = useState(false);

  const socketRef = useRef(null);
  const userVideoRef = useRef(null);
  const partnerVideoRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectInterval = 3000; // 3 seconds

  // Initialize and manage WebSocket connection
  const connectWebSocket = () => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.error(`${new Date().toLocaleTimeString()} - Max WebSocket reconnection attempts reached`);
      setMediaStatus("Failed to connect to signaling server. Please refresh.");
      return;
    }

    socketRef.current = new WebSocket("wss://textanon.onrender.com");
    console.log(`${new Date().toLocaleTimeString()} - WebSocket connecting to wss://textanon.onrender.com`);

    socketRef.current.onopen = () => {
      console.log(`${new Date().toLocaleTimeString()} - WebSocket connected`);
      setWsConnected(true);
      setMediaStatus("Connected to signaling server");
      reconnectAttempts.current = 0;
    };

    socketRef.current.onerror = (error) => {
      console.error(`${new Date().toLocaleTimeString()} - WebSocket error:`, error);
      setMediaStatus(`Signaling server error: ${error.message || "Unknown error"}`);
      setWsConnected(false);
    };

    socketRef.current.onclose = (event) => {
      console.log(`${new Date().toLocaleTimeString()} - WebSocket disconnected:`, event.reason);
      setWsConnected(false);
      setMediaStatus(`Disconnected from signaling server: ${event.reason || "Connection closed"}`);
      reconnectAttempts.current += 1;
      setTimeout(connectWebSocket, reconnectInterval);
    };

    socketRef.current.onmessage = (event) => {
      try {
        const parsedMessage = JSON.parse(event.data);

        if (parsedMessage.type === "userID") {
          console.log(`${new Date().toLocaleTimeString()} - Received userID:`, parsedMessage.userID);
        } else if (parsedMessage.type === "hey") {
          console.log(`${new Date().toLocaleTimeString()} - Incoming call from:`, parsedMessage.callerID);
          setReceivingCall(true);
          setCallerSignal(parsedMessage.signal);
        } else if (parsedMessage.type === "ice-candidate") {
          if (peerRef.current && parsedMessage.candidate) {
            console.log(`${new Date().toLocaleTimeString()} - Adding ICE candidate:`, parsedMessage.candidate);
            peerRef.current.addIceCandidate(new RTCIceCandidate(parsedMessage.candidate)).catch((err) =>
              console.error(`${new Date().toLocaleTimeString()} - ICE candidate error:`, err)
            );
          }
        } else if (parsedMessage.type === "callAccepted") {
          console.log(`${new Date().toLocaleTimeString()} - Call accepted, signaling answer:`, parsedMessage.signal);
          if (peerRef.current) {
            peerRef.current.signal(parsedMessage.signal);
          }
        } else if (parsedMessage.type === "systemMessage") {
          setMediaStatus(parsedMessage.text);
        } else if (parsedMessage.type === "partnerConnected") {
          console.log(`${new Date().toLocaleTimeString()} - Partner connected:`, parsedMessage.partnerID);
          setMediaStatus("Connected to a partner");
        }
      } catch (error) {
        console.error(`${new Date().toLocaleTimeString()} - WebSocket message error:`, error);
      }
    };
  };

  // Initialize WebSocket on component mount
  useEffect(() => {
    console.log(`${new Date().toLocaleTimeString()} - useEffect: Component mounted`);
    connectWebSocket();

    return () => {
      console.log(`${new Date().toLocaleTimeString()} - useEffect cleanup: Component unmounting`);
      cleanup();
    };
  }, []);

  // Cleanup function for streams, peer, and socket
  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
      console.log(`${new Date().toLocaleTimeString()} - Cleanup: Local stream stopped`);
    }
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
      console.log(`${new Date().toLocaleTimeString()} - Cleanup: Peer destroyed`);
    }
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.close();
      console.log(`${new Date().toLocaleTimeString()} - Cleanup: WebSocket closed`);
    }
    resetCallState();
  };

  // Reset call-related state
  const resetCallState = () => {
    setCallStarted(false);
    setReceivingCall(false);
    setCallerSignal(null);
    setCallAccepted(false);
    setPeerConnected(false);
    setMediaStatus("Ready to start call");
  };

  // Handle username confirmation and send register message
  const handleNameConfirm = () => {
    if (username.trim() !== "") {
      setNameConfirmed(true);
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: "register",
          name: username,
          encryptionKey: `key-${username}-${Date.now()}`
        }));
        console.log(`${new Date().toLocaleTimeString()} - Sent register message for:`, username);
      } else {
        setMediaStatus("Cannot register: Signaling server not connected.");
      }
    }
  };

  // Start video call and get media stream
  const startVideoCall = async () => {
    if (!wsConnected) {
      setMediaStatus("Cannot start call: Signaling server not connected.");
      return;
    }

    console.log(`${new Date().toLocaleTimeString()} - startVideoCall: Initiating call`);
    setCallStarted(true);
    setMediaStatus("Getting media devices...");

    try {
      const currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(currentStream);
      streamRef.current = currentStream;
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = currentStream;
      }
      setMediaStatus("Media devices ready, connecting...");
      initiatePeerConnection(currentStream);
    } catch (error) {
      console.error(`${new Date().toLocaleTimeString()} - getUserMedia error:`, error);
      setMediaStatus(`Error accessing media: ${error.message}`);
      setCallStarted(false);
    }
  };

  // Initialize peer connection for caller
  const initiatePeerConnection = (currentStream) => {
    const peer = new Peer({
      initiator: true,
      trickle: true,
      stream: currentStream,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      },
    });
    peerRef.current = peer;

    peer.on("signal", (signal) => {
      console.log(`${new Date().toLocaleTimeString()} - Initiator signaling:`, signal);
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "callUser", signal }));
      } else {
        console.error(`${new Date().toLocaleTimeString()} - Cannot send signal: WebSocket not open`);
        setMediaStatus("Failed to send call signal: Signaling server disconnected.");
        cleanup();
      }
    });

    peer.on("icecandidate", (event) => {
      if (event.candidate) {
        console.log(`${new Date().toLocaleTimeString()} - Initiator ICE candidate:`, event.candidate);
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: "ice-candidate", candidate: event.candidate }));
        } else {
          console.warn(`${new Date().toLocaleTimeString()} - Cannot send ICE candidate: WebSocket not open`);
        }
      }
    });

    peer.on("stream", (remoteStream) => {
      console.log(`${new Date().toLocaleTimeString()} - Initiator received remote stream`);
      if (partnerVideoRef.current) {
        partnerVideoRef.current.srcObject = remoteStream;
      }
      setPeerConnected(true);
      setMediaStatus("Connected to peer");
    });

    peer.on("connect", () => {
      console.log(`${new Date().toLocaleTimeString()} - Initiator peer connected`);
    });

    peer.on("error", (err) => {
      console.error(`${new Date().toLocaleTimeString()} - Initiator peer error:`, err);
      setMediaStatus(`Peer error: ${err.message || "Unknown error"}`);
      cleanup();
    });

    peer.on("close", () => {
      console.log(`${new Date().toLocaleTimeString()} - Initiator peer closed`);
      cleanup();
    });
  };

  // Handle incoming call (answerer)
  useEffect(() => {
    if (receivingCall && !callAccepted && callerSignal) {
      if (!wsConnected) {
        setMediaStatus("Cannot answer call: Signaling server not connected.");
        return;
      }

      console.log(`${new Date().toLocaleTimeString()} - Answering incoming call`);

      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((currentStream) => {
          setStream(currentStream);
          streamRef.current = currentStream;
          if (userVideoRef.current) {
            userVideoRef.current.srcObject = currentStream;
          }

          const peer = new Peer({
            initiator: false,
            trickle: true,
            stream: currentStream,
            config: {
              iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" },
              ],
            },
          });
          peerRef.current = peer;

          peer.on("signal", (signal) => {
            console.log(`${new Date().toLocaleTimeString()} - Answerer signaling:`, signal);
            if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
              socketRef.current.send(JSON.stringify({ type: "acceptCall", signal }));
            } else {
              console.error(`${new Date().toLocaleTimeString()} - Cannot send answer signal: WebSocket not open`);
              setMediaStatus("Failed to send call answer: Signaling server disconnected.");
              cleanup();
            }
          });

          peer.on("icecandidate", (event) => {
            if (event.candidate) {
              console.log(`${new Date().toLocaleTimeString()} - Answerer ICE candidate:`, event.candidate);
              if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                socketRef.current.send(JSON.stringify({ type: "ice-candidate", candidate: event.candidate }));
              } else {
                console.warn(`${new Date().toLocaleTimeString()} - Cannot send ICE candidate: WebSocket not open`);
              }
            }
          });

          peer.on("stream", (remoteStream) => {
            console.log(`${new Date().toLocaleTimeString()} - Answerer received remote stream`);
            if (partnerVideoRef.current) {
              partnerVideoRef.current.srcObject = remoteStream;
            }
            setPeerConnected(true);
            setMediaStatus("Connected to peer");
          });

          peer.on("connect", () => {
            console.log(`${new Date().toLocaleTimeString()} - Answerer peer connected`);
          });

          peer.on("error", (err) => {
            console.error(`${new Date().toLocaleTimeString()} - Answerer peer error:`, err);
            setMediaStatus(`Peer error: ${err.message || "Unknown error"}`);
            cleanup();
          });

          peer.on("close", () => {
            console.log(`${new Date().toLocaleTimeString()} - Answerer peer closed`);
            cleanup();
          });

          peer.signal(callerSignal);
          setCallAccepted(true);
          setCallStarted(true);
        })
        .catch((error) => {
          console.error(`${new Date().toLocaleTimeString()} - Answerer getUserMedia error:`, error);
          setMediaStatus(`Error accessing media: ${error.message}`);
          cleanup();
        });
    }
  }, [receivingCall, callerSignal, wsConnected]);

  // End call and cleanup
  const endCall = () => {
    console.log(`${new Date().toLocaleTimeString()} - endCall: Ending call`);
    cleanup();
  };

  // Skip to next call
  const handleSkip = () => {
    console.log(`${new Date().toLocaleTimeString()} - handleSkip: Skipping to next call`);
    cleanup();
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "skip" }));
    }
    setTimeout(() => {
      startVideoCall();
    }, 1000);
  };

  // Send emoji (placeholder)
  const sendEmoji = (emoji) => {
    alert(`Sent emoji: ${emoji}`);
  };

  // Toggle audio mute
  const toggleMute = () => {
    if (streamRef.current && streamRef.current.getAudioTracks()) {
      streamRef.current.getAudioTracks().forEach((track) => (track.enabled = !muted));
      setMuted(!muted);
      console.log(`${new Date().toLocaleTimeString()} - toggleMute: Audio ${!muted ? "muted" : "unmuted"}`);
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (streamRef.current && streamRef.current.getVideoTracks()) {
      streamRef.current.getVideoTracks().forEach((track) => (track.enabled = !videoEnabled));
      setVideoEnabled(!videoEnabled);
      console.log(`${new Date().toLocaleTimeString()} - toggleVideo: Video ${!videoEnabled ? "disabled" : "enabled"}`);
    }
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
      {!nameConfirmed ? (
        <div
          style={{
            backgroundColor: theme === "dark" ? "#1e1e1e" : "#ffffff",
            padding: "25px",
            borderRadius: "10px",
            textAlign: "center",
            width: "400px",
            boxShadow: theme === "dark" ? "0px 4px 10px rgba(255, 255, 255, 0.2)" : "0px 4px 10px rgba(0, 0, 0, 0.2)",
          }}
        >
          <h2 style={{ color: theme === "dark" ? "#ffffff" : "#222222" }}>Anonymous Video Call</h2>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose a name"
            style={inputStyle(theme)}
          />
          <button onClick={handleNameConfirm} style={startButtonStyle}>
            Start Video
          </button>
        </div>
      ) : !callStarted ? (
        <div style={{ textAlign: "center" }}>
          <h2>Anonymous Video Call</h2>
          <p>Status: {mediaStatus}</p>
          <button onClick={startVideoCall} style={startButtonStyle} disabled={!wsConnected}>
            Start Video Call
          </button>
        </div>
      ) : (
        <div style={{ textAlign: "center" }}>
          <h2>Anonymous Video Call</h2>
          <p>Status: {mediaStatus}</p>
          <div style={videoContainerStyle}>
            <div>
              <p>You</p>
              <video ref={userVideoRef} autoPlay muted playsInline style={videoStyle} />
            </div>
            <div>
              <p>Stranger</p>
              <video ref={partnerVideoRef} autoPlay playsInline style={videoStyle} placeholder="Waiting for Stranger Video" />
            </div>
          </div>
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
          <div style={{ marginTop: "10px" }}>
            <button onClick={handleSkip} style={skipButtonStyle} disabled={!wsConnected}>
              Skip to Next
            </button>
          </div>
        </div>
      )}
      <div
        style={{
          position: "absolute",
          bottom: "20px",
          right: "20px",
          width: "50px",
          height: "50px",
          cursor: "pointer",
        }}
      >
        <img src="/msg.png" alt="Message" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    </div>
  );
};

// Styles (unchanged)
const videoStyle = {
  width: "600px",
  height: "400px",
  backgroundColor: "#000",
  borderRadius: "10px",
};

const videoContainerStyle = {
  display: "flex",
  gap: "20px",
  marginTop: "20px",
  justifyContent: "center",
};

const emojiButtonStyle = {
  width: "80px",
  height: "80px",
  fontSize: "40px",
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

const inputStyle = (theme) => ({
  width: "100%",
  padding: "12px",
  borderRadius: "5px",
  border: "1px solid #ccc",
  fontSize: "16px",
  textAlign: "center",
  outline: "none",
  backgroundColor: theme === "dark" ? "#333" : "#fff",
  color: theme === "dark" ? "#ffffff" : "#222",
});

export default Video;
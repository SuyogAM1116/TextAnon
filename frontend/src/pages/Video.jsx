import React, { useEffect, useRef, useState, useContext, useCallback } from "react";
import { ThemeContext } from "../components/ThemeContext";
import Peer from "simple-peer"; // Assuming simple-peer is installed

// Constants for WebSocket message types (makes code cleaner)
const MSG_TYPES = {
  REGISTER: "register",
  WAITING: "waiting", // Server could send this
  MATCHED: "matched", // Server sends this when a partner is found
  SIGNAL: "signal", // For WebRTC signaling (offer, answer, ICE)
  CHAT: "chat",
  LEAVE: "leave", // Client sends this when leaving/skipping
  PARTNER_LEFT: "partnerLeft", // Server sends this
  SYSTEM_MESSAGE: "systemMessage",
  ERROR: "error", // Server might send error messages
  // Deprecated in this version, handled by SIGNAL:
  // HEY: "hey",
  // CALL_USER: "callUser",
  // ACCEPT_CALL: "acceptCall",
  // ICE_CANDIDATE: "ice-candidate",
};

const WS_URL = "wss://textanon.onrender.com"; // Use your actual WebSocket server URL

const Video = () => {
  const { theme } = useContext(ThemeContext);

  // User State
  const [username, setUsername] = useState("");
  const [nameConfirmed, setNameConfirmed] = useState(false);

  // Connection State
  const [wsConnected, setWsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false); // For WebSocket connection attempts
  const [showRetry, setShowRetry] = useState(false);
  const [mediaStatus, setMediaStatus] = useState("Enter a name to start");

  // Call State
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [peer, setPeer] = useState(null); // Holds the simple-peer instance
  const [isCallActive, setIsCallActive] = useState(false); // Tracks if a call is ongoing (peer exists)
  const [isMatched, setIsMatched] = useState(false); // Tracks if server confirmed a match
  const [iceConnectionState, setIceConnectionState] = useState("new");

  // Media Controls State
  const [muted, setMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);

  // Chat State
  const [chatMessages, setChatMessages] = useState([]);

  // Refs
  const socketRef = useRef(null);
  const userVideoRef = useRef(null);
  const partnerVideoRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectInterval = 2000; // Start with 2 seconds
  const isEstablishingPeer = useRef(false); // Prevent race conditions during peer setup

  // --- WebSocket Connection ---

  const connectWebSocket = useCallback(() => {
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      console.log(`${new Date().toLocaleTimeString()} - WebSocket already open or connecting.`);
      return;
    }

    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.error(`${new Date().toLocaleTimeString()} - Max WebSocket reconnection attempts reached.`);
      setMediaStatus("Failed to connect to server. Please try refreshing the page.");
      setWsConnected(false);
      setIsConnecting(false);
      setShowRetry(true); // Keep retry visible
      return;
    }

    setIsConnecting(true);
    setShowRetry(false);
    setMediaStatus("Connecting to server...");
    console.log(`${new Date().toLocaleTimeString()} - Attempting WebSocket connection (${reconnectAttempts.current + 1}/${maxReconnectAttempts}) to ${WS_URL}`);

    socketRef.current = new WebSocket(WS_URL);

    socketRef.current.onopen = () => {
      console.log(`${new Date().toLocaleTimeString()} - WebSocket connected.`);
      setWsConnected(true);
      setIsConnecting(false);
      setShowRetry(false);
      reconnectAttempts.current = 0;
      // Re-register if name was already confirmed
      if (nameConfirmed && username) {
        sendWebSocketMessage({ type: MSG_TYPES.REGISTER, name: username });
        setMediaStatus("Connected. Ready to find partner.");
      } else {
         setMediaStatus("Connected. Enter name.");
      }
    };

    socketRef.current.onerror = (error) => {
      console.error(`${new Date().toLocaleTimeString()} - WebSocket error:`, error);
      // Don't immediately set status here, onclose will handle retry/failure state
    };

    socketRef.current.onclose = (event) => {
      console.warn(`${new Date().toLocaleTimeString()} - WebSocket disconnected: Code=${event.code}, Reason='${event.reason}'`);
      setWsConnected(false);
      setIsConnecting(false);
      // If the call was active, clean it up
      if (isCallActive || isMatched) {
         handleCleanup(false); // Don't close WebSocket again, it's already closed
         setMediaStatus("Connection lost. Attempting to reconnect...");
      } else {
         setMediaStatus("Disconnected from server. Retrying...");
      }

      // Exponential backoff for retries
      reconnectAttempts.current += 1;
      const delay = baseReconnectInterval * Math.pow(2, reconnectAttempts.current -1);
      console.log(`${new Date().toLocaleTimeString()} - Scheduling WebSocket reconnect attempt ${reconnectAttempts.current} in ${delay}ms`);
      setTimeout(connectWebSocket, delay);
    };

    socketRef.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log(`${new Date().toLocaleTimeString()} - WebSocket message received:`, message.type, message);
        handleWebSocketMessage(message);
      } catch (error) {
        console.error(`${new Date().toLocaleTimeString()} - WebSocket message parse error:`, error, "Raw data:", event.data);
      }
    };
  }, [nameConfirmed, username, isCallActive, isMatched]); // Add dependencies

  // --- WebSocket Message Handling ---

  const sendWebSocketMessage = (message) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
      console.log(`${new Date().toLocaleTimeString()} - WebSocket message sent:`, message.type);
    } else {
      console.error(`${new Date().toLocaleTimeString()} - Cannot send WebSocket message: Connection not open. State: ${socketRef.current?.readyState}`, message);
      setMediaStatus("Error: Cannot communicate with server. Trying to reconnect...");
      // Optional: Trigger reconnect if needed
      // if (!isConnecting) {
      //    reconnectAttempts.current = 0; // Reset attempts for manual trigger/error case
      //    connectWebSocket();
      // }
    }
  };

  const handleWebSocketMessage = (message) => {
    switch (message.type) {
      case MSG_TYPES.WAITING:
        setMediaStatus("Waiting for a partner...");
        setIsMatched(false);
        break;
      case MSG_TYPES.MATCHED:
        console.log(`${new Date().toLocaleTimeString()} - Matched with a partner! Initiating call.`);
        setMediaStatus("Partner found! Starting video call...");
        setIsMatched(true);
        // The user who receives 'matched' first might become the initiator
        // Or the server could designate one. Let's assume the client decides based on timing.
        // Start the call process IF we have media stream already.
        // If not, startCall will handle getting media first.
        if (localStream && !peer && !isEstablishingPeer.current) {
            startPeerConnection(true); // Start as initiator
        } else if (!localStream && !isEstablishingPeer.current) {
            // Need to get media first, then we will initiate in the callback
             console.log(`${new Date().toLocaleTimeString()} - Matched, but need media first.`);
             // Trigger media acquisition which will then initiate
             startCall();
        }
        break;
      case MSG_TYPES.SIGNAL:
        if (message.signalData) {
          if (peer) {
            console.log(`${new Date().toLocaleTimeString()} - Received signal, passing to existing peer.`);
            // This handles offer, answer, and ICE candidates
            peer.signal(message.signalData);
          } else if (isMatched && localStream && !isEstablishingPeer.current) {
            // Received an OFFER signal before our peer was created (we are the receiver)
            console.log(`${new Date().toLocaleTimeString()} - Received signal (likely offer), creating non-initiator peer.`);
            startPeerConnection(false, message.signalData); // Start as non-initiator and signal the offer
          } else {
            // This could happen if signals arrive out of order or state is inconsistent
             console.warn(`${new Date().toLocaleTimeString()} - Received signal but peer not ready or not matched. Ignoring. Peer: ${!!peer}, isMatched: ${isMatched}, localStream: ${!!localStream}, isEstablishing: ${isEstablishingPeer.current}`);
             // Potentially buffer the signal if needed, but simple-peer often handles slight timing issues
          }
        } else {
           console.warn(`${new Date().toLocaleTimeString()} - Received SIGNAL message with no signalData.`);
        }
        break;
      case MSG_TYPES.CHAT:
        if (message.senderName && message.text) {
          console.log(`${new Date().toLocaleTimeString()} - Received chat from ${message.senderName}:`, message.text);
          setChatMessages((prev) => [
            ...prev,
            { sender: "Stranger", text: message.text }, // Always show partner as 'Stranger'
          ]);
        }
        break;
      case MSG_TYPES.PARTNER_LEFT:
        console.log(`${new Date().toLocaleTimeString()} - Partner disconnected.`);
        setMediaStatus("Partner disconnected. Find a new partner?");
        handleCleanup(true); // Clean up the call but keep WebSocket open
        setIsMatched(false); // Reset matched state
        // Optionally, automatically start searching again after a short delay
        // setTimeout(() => findNewPartner(), 2000);
        break;
      case MSG_TYPES.SYSTEM_MESSAGE:
        setMediaStatus(message.text);
        break;
       case MSG_TYPES.ERROR:
         console.error(`${new Date().toLocaleTimeString()} - Server error message: ${message.text}`);
         setMediaStatus(`Server error: ${message.text}`);
         // Decide if cleanup is needed based on the error
         break;
      default:
        console.warn(`${new Date().toLocaleTimeString()} - Received unknown WebSocket message type:`, message.type);
    }
  };

  // --- WebRTC Peer Connection ---

  const startPeerConnection = useCallback((initiator, receivedSignal = null) => {
    if (peer || isEstablishingPeer.current || !localStream || !isMatched) {
      console.warn(`${new Date().toLocaleTimeString()} - startPeerConnection called unnecessarily or too early. Peer: ${!!peer}, Establishing: ${isEstablishingPeer.current}, Stream: ${!!localStream}, Matched: ${isMatched}`);
      return;
    }

    console.log(`${new Date().toLocaleTimeString()} - Creating Peer. Initiator: ${initiator}`);
    isEstablishingPeer.current = true;
    setMediaStatus(initiator ? "Initiating connection..." : "Answering connection...");
    setIceConnectionState("new");

    const newPeer = new Peer({
      initiator: initiator,
      trickle: true, // Enable trickle ICE
      stream: localStream,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
           { urls: "stun:stun1.l.google.com:19302" },
          // Add TURN servers if needed, especially for restrictive networks
           {
             urls: "turn:openrelay.metered.ca:80", // Example Public TURN
             username: "openrelayproject",
             credential: "openrelayproject",
           },
           {
             urls: "turn:openrelay.metered.ca:443",
             username: "openrelayproject",
             credential: "openrelayproject",
           },
        ],
      },
    });

    newPeer.on("signal", (signalData) => {
      console.log(`${new Date().toLocaleTimeString()} - Peer generated signal (offer/answer/ICE). Sending via WebSocket.`);
      sendWebSocketMessage({ type: MSG_TYPES.SIGNAL, signalData: signalData });
    });

    newPeer.on("connect", () => {
      console.log(`${new Date().toLocaleTimeString()} - Peer connection established (data channel).`);
      setMediaStatus("Connected!");
      setIsCallActive(true);
      isEstablishingPeer.current = false;
       // You could send a confirmation message or enable chat here if desired
    });

    newPeer.on("stream", (remoteStream) => {
      console.log(`${new Date().toLocaleTimeString()} - Received remote stream.`);
      setRemoteStream(remoteStream);
       // Video element ref might not be ready immediately after state update, handle in useEffect
       setIsCallActive(true); // Consider call active once stream is received
       isEstablishingPeer.current = false;
       setMediaStatus("Connected!"); // Update status
    });

     newPeer.on("iceconnectionstatechange", () => {
        const currentState = newPeer.iceConnectionState;
        console.log(`${new Date().toLocaleTimeString()} - ICE connection state changed:`, currentState);
        setIceConnectionState(currentState);
        if (currentState === "failed" || currentState === "disconnected" || currentState === "closed") {
            console.error(`${new Date().toLocaleTimeString()} - ICE connection failed or closed. State: ${currentState}`);
            setMediaStatus(`Connection issue (${currentState}). Reconnecting might be needed.`);
             // Consider attempting a peer restart or notifying the user
             handleCleanup(true); // Clean up the failed peer connection
             setIsMatched(false); // No longer matched if peer failed
             setMediaStatus("Connection lost. Find a new partner?");
        } else if (currentState === "connected" || currentState === "completed") {
             setMediaStatus("Connected!");
        }
    });

    newPeer.on("error", (err) => {
      console.error(`${new Date().toLocaleTimeString()} - Peer error:`, err);
      setMediaStatus(`Error: ${err.message || "Call failed"}`);
      handleCleanup(true); // Clean up on peer error
      setIsMatched(false);
    });

    newPeer.on("close", () => {
      console.log(`${new Date().toLocaleTimeString()} - Peer connection closed.`);
       // This might be triggered by partner leaving or local cleanup
       // Ensure cleanup logic doesn't run twice if initiated locally
       if (isCallActive) {
          handleCleanup(true); // Ensure cleanup if not already done
          setIsMatched(false);
          setMediaStatus("Call ended.");
       }
    });

    setPeer(newPeer);

    // If we are the receiver and received an offer signal before creating the peer
    if (!initiator && receivedSignal) {
        console.log(`${new Date().toLocaleTimeString()} - Signaling received offer to newly created peer.`);
        newPeer.signal(receivedSignal);
    }

  }, [localStream, peer, isMatched, sendWebSocketMessage]); // Dependencies


  // --- Media Stream Handling ---

  const startCall = useCallback(async () => {
      if (!nameConfirmed) {
          setMediaStatus("Please confirm your name first.");
          return;
      }
      if (!wsConnected) {
          setMediaStatus("Not connected to server. Retrying...");
          // Attempt to reconnect if needed
           if (!isConnecting) {
               reconnectAttempts.current = 0;
               connectWebSocket();
           }
          return;
      }
       if (localStream) {
           console.log(`${new Date().toLocaleTimeString()} - Media stream already exists.`);
           // If already matched, start peer connection
           if (isMatched && !peer && !isEstablishingPeer.current) {
               console.log(`${new Date().toLocaleTimeString()} - Already matched, starting peer connection now.`);
               startPeerConnection(true); // Assume initiator if starting call manually after match
           } else if (!isMatched) {
               setMediaStatus("Finding partner...");
               // Tell server we are ready (if needed by backend logic)
               // sendWebSocketMessage({ type: "ready" });
           }
           return;
       }

      console.log(`${new Date().toLocaleTimeString()} - Requesting media devices (video/audio)...`);
      setMediaStatus("Accessing camera/microphone...");

      try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          console.log(`${new Date().toLocaleTimeString()} - Media stream obtained successfully.`);
          setLocalStream(stream);
          setVideoEnabled(true); // Ensure video is enabled by default
          setMuted(false); // Ensure audio is enabled by default

          // If we were already matched by the time media is obtained, start peer connection
          if (isMatched && !peer && !isEstablishingPeer.current) {
              console.log(`${new Date().toLocaleTimeString()} - Media obtained after match, starting peer connection.`);
              startPeerConnection(true); // Assume initiator
          } else if (!isMatched) {
              setMediaStatus("Media ready. Finding partner...");
              // Notify server we are ready if required by backend logic
              // sendWebSocketMessage({ type: "ready" });
          }

      } catch (error) {
          console.error(`${new Date().toLocaleTimeString()} - getUserMedia error:`, error);
          if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
              setMediaStatus("Permission denied for camera/microphone. Please enable access.");
          } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
              setMediaStatus("No camera/microphone found.");
          } else {
              setMediaStatus(`Error accessing media: ${error.message}`);
          }
          setLocalStream(null); // Ensure stream is null on error
      }
  }, [nameConfirmed, wsConnected, localStream, isMatched, peer, connectWebSocket, startPeerConnection, isConnecting]);

  // Effect to attach stream to video element when localStream state changes
  useEffect(() => {
    if (localStream && userVideoRef.current) {
      console.log(`${new Date().toLocaleTimeString()} - Attaching local stream to video element.`);
      userVideoRef.current.srcObject = localStream;
       userVideoRef.current.play().catch(err => console.error(`${new Date().toLocaleTimeString()} - Local video play failed:`, err));
    }
    // Cleanup function to stop tracks when the stream is removed/replaced
    return () => {
      if (localStream) {
        // This cleanup logic might be better placed in handleCleanup
        // localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [localStream]);

   // Effect to attach stream to video element when remoteStream state changes
  useEffect(() => {
    if (remoteStream && partnerVideoRef.current) {
      console.log(`${new Date().toLocaleTimeString()} - Attaching remote stream to partner video element.`);
      partnerVideoRef.current.srcObject = remoteStream;
       partnerVideoRef.current.play().catch(err => console.error(`${new Date().toLocaleTimeString()} - Remote video play failed:`, err));
    }
  }, [remoteStream]);

  // --- Cleanup Logic ---

  const handleCleanup = useCallback((keepWebSocket = false) => {
    console.log(`${new Date().toLocaleTimeString()} - Cleaning up resources. Keep WebSocket: ${keepWebSocket}`);

    // 1. Stop local media tracks
    if (localStream) {
      console.log(`${new Date().toLocaleTimeString()} - Stopping local stream tracks.`);
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
     if (userVideoRef.current) userVideoRef.current.srcObject = null;


    // 2. Destroy Peer Connection
    if (peer) {
      console.log(`${new Date().toLocaleTimeString()} - Destroying peer connection.`);
       // Remove listeners before destroying to prevent potential late firing events
       peer.removeAllListeners();
      peer.destroy();
      setPeer(null);
    }
     if (partnerVideoRef.current) partnerVideoRef.current.srcObject = null;
     setRemoteStream(null); // Clear remote stream state

    // 3. Reset State
    setIsCallActive(false);
    isEstablishingPeer.current = false;
    // Keep isMatched false unless explicitly set true by server later
    // setIsMatched(false); // Resetting this might cause issues if cleanup happens during matching
    setIceConnectionState("new");
    setChatMessages([]); // Clear chat on cleanup/new call
    // Don't reset mediaStatus here, let the calling function decide the next status

    // 4. Close WebSocket (if not keeping it)
    if (!keepWebSocket && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      console.log(`${new Date().toLocaleTimeString()} - Closing WebSocket connection.`);
      socketRef.current.close();
      setWsConnected(false);
    }
  }, [localStream, peer]); // Dependencies for cleanup


  // --- UI Event Handlers ---

  const handleNameConfirm = () => {
    const trimmedName = username.trim();
    if (trimmedName) {
      setUsername(trimmedName); // Store trimmed name
      setNameConfirmed(true);
      setMediaStatus("Connecting to server...");
      // Ensure WebSocket connection is initiated after name confirmation
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
         reconnectAttempts.current = 0; // Reset attempts for fresh connect
         connectWebSocket(); // Connect WS
         // Registration message will be sent in onopen handler
      } else {
          // If WS already connected, send registration now
          sendWebSocketMessage({ type: MSG_TYPES.REGISTER, name: trimmedName });
          setMediaStatus("Connected. Ready to find partner.");
      }
    } else {
      setMediaStatus("Please enter a valid name.");
    }
  };

  const handleEndCall = () => {
    console.log(`${new Date().toLocaleTimeString()} - User clicked End Call.`);
    sendWebSocketMessage({ type: MSG_TYPES.LEAVE }); // Notify partner (server relays)
    handleCleanup(true); // Clean up local resources, keep WebSocket
    setIsMatched(false); // No longer matched after ending call
    setMediaStatus("Call ended. Find a new partner?");
  };

  const handleSkip = () => {
    console.log(`${new Date().toLocaleTimeString()} - User clicked Skip.`);
    setMediaStatus("Finding next partner...");
    sendWebSocketMessage({ type: MSG_TYPES.LEAVE }); // Notify partner
    handleCleanup(true); // Clean up current call
    setIsMatched(false); // Reset matched state
    // Re-request media if it was stopped, or just wait for server 'matched' signal
     // If the backend automatically re-pairs after 'leave', we might not need to do anything else here.
     // If not, we might need to send a "ready" or "find" message.
     // Let's assume the server handles re-pairing or we trigger 'startCall' again from UI.
     // For simplicity, let's re-initiate the call process to get media and wait for match
     startCall();
  };

  const toggleMute = () => {
    if (localStream) {
      const enabled = !muted;
      localStream.getAudioTracks().forEach((track) => (track.enabled = enabled));
      setMuted(!enabled); // State should be opposite of track.enabled for display
      console.log(`${new Date().toLocaleTimeString()} - Audio ${enabled ? "unmuted" : "muted"}`);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const enabled = !videoEnabled;
      localStream.getVideoTracks().forEach((track) => (track.enabled = enabled));
      setVideoEnabled(enabled);
      console.log(`${new Date().toLocaleTimeString()} - Video ${enabled ? "enabled" : "disabled"}`);
    }
  };

  const sendChatMessage = (text) => {
    const trimmedText = text.trim();
    if (trimmedText && isCallActive && peer) { // Only send if call is active
      sendWebSocketMessage({ type: MSG_TYPES.CHAT, text: trimmedText });
      setChatMessages((prev) => [
        ...prev,
        { sender: "You", text: trimmedText }, // Show message locally immediately
      ]);
      console.log(`${new Date().toLocaleTimeString()} - Sent chat message:`, trimmedText);
    } else if (!isCallActive) {
        console.warn(`${new Date().toLocaleTimeString()} - Cannot send chat: Call not active.`);
    }
  };

  const handleRetryConnect = () => {
     console.log(`${new Date().toLocaleTimeString()} - Manual WebSocket reconnect attempt.`);
     setShowRetry(false);
     reconnectAttempts.current = 0; // Reset counter for manual retry
     connectWebSocket();
  };

  // --- Effects ---

  // Initial WebSocket connection attempt on mount (if name isn't needed first)
  // We now connect only after name confirmation, so this isn't needed on mount.
  // useEffect(() => {
  //   connectWebSocket();
  //   // Cleanup function for component unmount
  //   return () => {
  //     handleCleanup(false); // Full cleanup including WebSocket on unmount
  //   };
  // }, [connectWebSocket, handleCleanup]); // Add dependencies

  // Cleanup on component unmount
   useEffect(() => {
       return () => {
           console.log(`${new Date().toLocaleTimeString()} - Video component unmounting. Cleaning up.`);
           handleCleanup(false); // Ensure full cleanup
       };
   }, [handleCleanup]); // Ensure handleCleanup is stable or memoized


  // --- Render Logic ---

  const renderContent = () => {
    if (!nameConfirmed) {
      return (
        <div style={nameConfirmContainerStyle(theme)}>
          <h2 style={{ color: theme === "dark" ? "#ffffff" : "#222222" }}>Anonymous Video Call</h2>
          <p style={{color: theme === 'dark' ? '#ccc' : '#555', marginBottom: '15px'}}>Choose a temporary name to start.</p>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your temporary name"
            style={inputStyle(theme)}
            maxLength={20}
            onKeyDown={(e) => e.key === 'Enter' && handleNameConfirm()}
          />
          <button onClick={handleNameConfirm} style={startButtonStyle} disabled={!username.trim()}>
            Confirm Name & Connect
          </button>
           <p style={{ color: theme === 'dark' ? '#ccc' : '#555', marginTop: '15px' }}>Status: {mediaStatus}</p>
           {showRetry && !isConnecting && (
             <button onClick={handleRetryConnect} style={skipButtonStyle} disabled={isConnecting}>
                Retry Connection
             </button>
           )}
        </div>
      );
    }

    if (!localStream && !isCallActive) {
      // Name confirmed, but media not yet started or call not active
      return (
        <div style={{ textAlign: "center" }}>
          <h2>Welcome, {username}!</h2>
           <p style={{ color: theme === 'dark' ? '#ccc' : '#555', marginTop: '15px' }}>Status: {mediaStatus}</p>
           {/* Button to start the process (get media, find partner) */}
           <button onClick={startCall} style={startButtonStyle} disabled={isConnecting || !!localStream || !wsConnected}>
                {isConnecting ? "Connecting..." : "Start Video Chat"}
            </button>
            {showRetry && !isConnecting && (
             <button onClick={handleRetryConnect} style={skipButtonStyle} disabled={isConnecting}>
                Retry Connection
             </button>
           )}
           {!wsConnected && !isConnecting && <p style={{color: 'red', marginTop: '10px'}}>Server disconnected.</p>}
        </div>
      );
    }

    // Call is active or attempting to connect
    return (
      <div style={callAreaStyle}>
        {/* Top Status Area */}
        <div style={{ marginBottom: '10px', textAlign: 'center' }}>
            <p style={{ color: theme === 'dark' ? '#ccc' : '#555', margin: '5px 0' }}>Status: {mediaStatus}</p>
            <p style={{ color: theme === 'dark' ? '#aaa' : '#777', margin: '5px 0', fontSize: '0.9em' }}>ICE State: {iceConnectionState}</p>
        </div>

        {/* Video Area */}
        <div style={videoContainerStyle}>
          {/* Partner Video */}
          <div style={videoWrapperStyle}>
            <p style={nameTagStyle(theme)}>Stranger</p>
            <video ref={partnerVideoRef} playsInline autoPlay style={videoStyle(theme)}>
                {/* Placeholder could be shown here if needed */}
            </video>
            {!remoteStream && <div style={videoPlaceholderStyle(theme)}>Waiting for partner's video...</div>}
          </div>
           {/* User Video */}
          <div style={videoWrapperStyle}>
            <p style={nameTagStyle(theme)}>You ({username})</p>
            <video ref={userVideoRef} playsInline autoPlay muted style={videoStyle(theme)} />
             {!videoEnabled && <div style={videoPlaceholderStyle(theme)}>Video Off</div>}
          </div>
        </div>

         {/* Controls Area */}
        <div style={controlsContainerStyle}>
          <button onClick={toggleMute} style={controlButtonStyle(theme)} title={muted ? "Unmute" : "Mute"}>
            <span className="material-icons">{muted ? "mic_off" : "mic"}</span>
          </button>
          <button onClick={toggleVideo} style={controlButtonStyle(theme)} title={videoEnabled ? "Turn Video Off" : "Turn Video On"}>
            <span className="material-icons">{videoEnabled ? "videocam" : "videocam_off"}</span>
          </button>
          <button onClick={handleEndCall} style={{...controlButtonStyle(theme), backgroundColor: "#dc3545" }} title="End Call">
            <span className="material-icons">call_end</span>
          </button>
          <button onClick={handleSkip} style={{ ...controlButtonStyle(theme), backgroundColor: "#6c757d" }} title="Skip to Next Partner" disabled={!wsConnected || isEstablishingPeer.current}>
            <span className="material-icons">skip_next</span>
          </button>
        </div>

        {/* Chat Area */}
        <div style={chatAreaStyle(theme)}>
          <h3>Chat</h3>
          <div style={chatMessagesStyle(theme)}>
            {chatMessages.length === 0 && <p style={{textAlign:'center', color: theme === 'dark' ? '#888' : '#777'}}>Chat messages will appear here.</p>}
            {chatMessages.map((msg, index) => (
              <p key={index} style={{ margin: '5px 0', color: msg.sender === 'You' ? (theme === 'dark' ? '#a0e9ff' : '#007bff') : (theme === 'dark' ? '#e0e0e0' : '#333') }}>
                <strong>{msg.sender}:</strong> {msg.text}
              </p>
            ))}
          </div>
          <input
            type="text"
            placeholder={isCallActive ? "Type a message..." : "Connect to chat"}
            disabled={!isCallActive || !peer}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.target.value.trim()) {
                sendChatMessage(e.target.value);
                e.target.value = "";
              }
            }}
            style={inputStyle(theme)}
            maxLength={250}
          />
        </div>
      </div>
    );
  };

  return (
    <div style={pageContainerStyle(theme)}>
        {renderContent()}
        {/* Optional: Add the message icon back if it serves another purpose */}
        {/* <div style={messageIconStyle}> ... </div> */}
    </div>
  );
};

// --- Styles --- (Minor adjustments for clarity and theme)

const pageContainerStyle = (theme) => ({
  backgroundColor: theme === "dark" ? "#121212" : "#f8f9fa",
  color: theme === "dark" ? "#ffffff" : "#333333",
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "20px",
  boxSizing: 'border-box',
});

const nameConfirmContainerStyle = (theme) => ({
  backgroundColor: theme === "dark" ? "#1e1e1e" : "#ffffff",
  padding: "30px",
  borderRadius: "10px",
  textAlign: "center",
  width: "90%",
  maxWidth: "450px",
  boxShadow: theme === "dark" ? "0px 4px 15px rgba(255, 255, 255, 0.1)" : "0px 4px 15px rgba(0, 0, 0, 0.1)",
});

const callAreaStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    maxWidth: '1200px', // Adjust max width as needed
};

const videoContainerStyle = {
  display: "flex",
  flexWrap: 'wrap', // Allow wrapping on smaller screens
  gap: "20px",
  marginBottom: "20px",
  justifyContent: "center",
  width: '100%'
};

const videoWrapperStyle = {
  position: 'relative', // For placeholder positioning
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const videoStyle = (theme) => ({
  width: "100%", // Make videos responsive within their container
  maxWidth: "500px", // Max width per video
  height: "auto", // Maintain aspect ratio
  aspectRatio: '4 / 3', // Common webcam aspect ratio
  backgroundColor: theme === 'dark' ? "#000" : '#ddd',
  borderRadius: "8px",
  objectFit: 'cover', // Cover the area, might crop slightly
  border: `1px solid ${theme === 'dark' ? '#444' : '#ccc'}`,
});

const videoPlaceholderStyle = (theme) => ({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: '#fff',
    fontSize: '1.2em',
    borderRadius: '8px', // Match video style
    zIndex: 1, // Above the video element (which might be black)
});

const nameTagStyle = (theme) => ({
    color: theme === 'dark' ? '#eee' : '#444',
    marginBottom: '5px',
    fontWeight: 'bold',
});

const controlsContainerStyle = {
  display: "flex",
  justifyContent: "center",
  gap: "15px",
  marginBottom: "20px",
  flexWrap: 'wrap',
};

const controlButtonStyle = (theme) => ({
  width: "60px", // Slightly smaller buttons
  height: "60px",
  fontSize: "28px", // Adjust icon size
  backgroundColor: theme === 'dark' ? '#444' : "#007bff",
  color: "#fff",
  border: "none",
  borderRadius: "50%",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: 'background-color 0.2s ease',
  '&:hover': {
    backgroundColor: theme === 'dark' ? '#555' : '#0056b3',
  }
});


const chatAreaStyle = (theme) => ({
    marginTop: "20px",
    width: "90%",
    maxWidth: "700px",
    backgroundColor: theme === 'dark' ? '#2a2a2a' : '#f1f1f1',
    padding: '15px',
    borderRadius: '8px',
    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
});

const chatMessagesStyle = (theme) => ({
    height: "150px", // Fixed height for chat box
    overflowY: "auto",
    border: `1px solid ${theme === 'dark' ? '#444' : '#ccc'}`,
    padding: "10px",
    marginBottom: '10px',
    borderRadius: '4px',
    backgroundColor: theme === 'dark' ? '#1e1e1e' : '#fff',
});


const skipButtonStyle = { // Re-using for retry button
  padding: "10px 20px",
  backgroundColor: "#6c757d",
  color: "#fff",
  border: "none",
  borderRadius: "5px",
  cursor: "pointer",
  fontSize: "16px",
  marginTop: "15px",
  transition: 'background-color 0.2s ease',
  '&:hover': {
      backgroundColor: "#5a6268",
  },
  '&:disabled': {
      backgroundColor: "#999",
      cursor: 'not-allowed',
  }
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
  marginTop: "15px",
   transition: 'background-color 0.2s ease',
  '&:hover': {
      backgroundColor: "#157347",
  },
   '&:disabled': {
      backgroundColor: "#999",
      cursor: 'not-allowed',
  }
};

const inputStyle = (theme) => ({
  boxSizing: 'border-box', // Include padding and border in the element's total width and height
  width: "100%",
  padding: "12px",
  borderRadius: "5px",
  border: `1px solid ${theme === 'dark' ? '#555' : '#ccc'}`,
  fontSize: "16px",
  outline: "none",
  backgroundColor: theme === "dark" ? "#333" : "#fff",
  color: theme === "dark" ? "#ffffff" : "#222",
  marginBottom: '10px', // Add some margin below inputs
});

// Message Icon Style (if needed)
// const messageIconStyle = {
//   position: "absolute",
//   bottom: "20px",
//   right: "20px",
//   width: "50px",
//   height: "50px",
//   cursor: "pointer",
//   // Add image styling here
// };

export default Video;
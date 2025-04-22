import React, { useEffect, useRef, useState, useContext, useCallback } from "react";
import { ThemeContext } from "../components/ThemeContext"; // Assuming path
import Peer from "simple-peer";

// Constants for WebSocket message types
const MSG_TYPES = {
  REGISTER: "register",
  USER_ID: "userID",
  WAITING: "waiting",
  MATCHED: "matched", // Crucial message from backend
  SIGNAL: "signal",
  CHAT: "chat",
  LEAVE: "leave",
  PARTNER_LEFT: "partnerLeft",
  SYSTEM_MESSAGE: "systemMessage",
  ERROR: "error",
};

const WS_URL = "wss://textanon.onrender.com"; // Use your actual WebSocket server URL

const Video = () => {
  const { theme } = useContext(ThemeContext) || { theme: 'dark' }; // Default theme

  // State
  const [username, setUsername] = useState("");
  const [nameConfirmed, setNameConfirmed] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showRetry, setShowRetry] = useState(false);
  const [mediaStatus, setMediaStatus] = useState("Enter a name to start");
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [peer, setPeer] = useState(null); // The simple-peer instance state
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMatched, setIsMatched] = useState(false);
  const [iceConnectionState, setIceConnectionState] = useState("new");
  const [muted, setMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [chatMessages, setChatMessages] = useState([]);

  // Refs
  const socketRef = useRef(null);
  const userVideoRef = useRef(null); // Ref for local video DOM element
  const partnerVideoRef = useRef(null); // Ref for remote video DOM element
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectInterval = 2000;
  const isEstablishingPeer = useRef(false);
  const localUserIdRef = useRef(null);

  // Refs for state values needed in useCallback cleanup function
  // These refs help stabilize the useCallback dependencies
  const localStreamRef = useRef(localStream);
  const peerStateRef = useRef(peer); // Ref specifically for the peer state instance
  const isCallActiveRef = useRef(isCallActive);
  const isMatchedRef = useRef(isMatched);
  const isEstablishingPeerRef = useRef(isEstablishingPeer.current);

  // Update refs whenever their corresponding state changes
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    peerStateRef.current = peer;
  }, [peer]);

   useEffect(() => {
    isCallActiveRef.current = isCallActive;
  }, [isCallActive]);

   useEffect(() => {
    isMatchedRef.current = isMatched;
  }, [isMatched]);

   useEffect(() => {
    isEstablishingPeerRef.current = isEstablishingPeer.current;
  }, [isEstablishingPeer.current]); // Note: This updates when the *ref's current property* changes


  // --- Cleanup Logic ---
  // useCallback with stable dependencies using refs internally
  const handleCleanup = useCallback((keepWebSocket = false) => {
    // Use .current to get the latest values from refs inside the function body
    const currentPeerState = peerStateRef.current; // Get peer from its state ref
    const currentLocalStream = localStreamRef.current;

    console.log(`${new Date().toLocaleTimeString()} - Cleaning up resources. Keep WebSocket: ${keepWebSocket}, Peer Exists (Ref): ${!!currentPeerState}, Stream Exists (Ref): ${!!currentLocalStream}`);

    // 1. Destroy Peer Connection first
    if (currentPeerState) {
        console.log(`${new Date().toLocaleTimeString()} - Destroying peer connection.`);
        currentPeerState.destroy(); // Call destroy on the actual peer instance
        // We should also update the state and the ref after destroying
        setPeer(null);
        peerStateRef.current = null;
    }
     // Also reset the establishing flag ref AND the original ref used elsewhere
     isEstablishingPeer.current = false;
     isEstablishingPeerRef.current = false;


    // 2. Stop local media tracks
    if (currentLocalStream) {
        console.log(`${new Date().toLocaleTimeString()} - Stopping local stream tracks.`);
        currentLocalStream.getTracks().forEach((track) => track.stop());
        setLocalStream(null); // Update state
        localStreamRef.current = null; // Update ref
    }

    // 3. Clear video elements (using stable DOM refs)
    if (userVideoRef.current) userVideoRef.current.srcObject = null;
    if (partnerVideoRef.current) partnerVideoRef.current.srcObject = null;
    setRemoteStream(null); // Clear remote stream state

    // 4. Reset State Flags
    setIsCallActive(false);
    isCallActiveRef.current = false; // Update ref too
    // Generally avoid resetting isMatched here, let server dictate matching status
    // setIsMatched(false);
    // isMatchedRef.current = false;
    setIceConnectionState("new");
    setChatMessages([]); // Clear chat

    // 5. Close WebSocket (if requested)
    if (!keepWebSocket && socketRef.current) {
        if (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING) {
            console.log(`${new Date().toLocaleTimeString()} - Closing WebSocket connection.`);
            socketRef.current.onclose = null; // Prevent handler loops
            socketRef.current.onerror = null;
            socketRef.current.onmessage = null;
            socketRef.current.onopen = null;
            socketRef.current.close(1000, "Client cleanup");
        }
        socketRef.current = null; // Nullify the WebSocket ref
        setWsConnected(false); // Update connection state
    }
    console.log(`${new Date().toLocaleTimeString()} - Cleanup finished.`);

    // useCallback dependencies are now only state setters (which are stable)
    // and other stable refs/functions if any were needed.
    // We removed localStream and peer state dependencies.
  }, [/* No state dependencies here, only stable setters if needed */]);


  // --- WebSocket Connection ---
  const connectWebSocket = useCallback(() => {
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
        console.log(`${new Date().toLocaleTimeString()} - WebSocket already open or connecting.`);
        return;
    }
    // Prevent parallel connection attempts
    if (isConnecting) {
        console.log(`${new Date().toLocaleTimeString()} - WebSocket connection attempt already in progress.`);
        return;
    }

    if (reconnectAttempts.current >= maxReconnectAttempts) {
        console.error(`${new Date().toLocaleTimeString()} - Max WebSocket reconnection attempts reached.`);
        setMediaStatus("Failed to connect to server. Please try refreshing the page.");
        setWsConnected(false);
        setIsConnecting(false);
        setShowRetry(true);
        return;
    }

    setIsConnecting(true); // Set connecting flag
    setShowRetry(false);
    setMediaStatus("Connecting to server...");
    console.log(`${new Date().toLocaleTimeString()} - Attempting WebSocket connection (${reconnectAttempts.current + 1}/${maxReconnectAttempts}) to ${WS_URL}`);

    // Ensure previous socket handlers are cleared if socketRef wasn't null
    if (socketRef.current) {
        socketRef.current.onclose = null;
        socketRef.current.onerror = null;
        socketRef.current.onmessage = null;
        socketRef.current.onopen = null;
    }

    socketRef.current = new WebSocket(WS_URL);

    socketRef.current.onopen = () => {
        console.log(`${new Date().toLocaleTimeString()} - WebSocket connected.`);
        setWsConnected(true);
        setIsConnecting(false);
        setShowRetry(false);
        reconnectAttempts.current = 0; // Reset counter on successful connection
        if (nameConfirmed && username) {
            sendWebSocketMessage({ type: MSG_TYPES.REGISTER, name: username });
            setMediaStatus("Connected. Ready to find partner.");
        } else if (!nameConfirmed) {
            setMediaStatus("Connected. Enter name.");
        }
    };

    socketRef.current.onerror = (error) => {
        console.error(`${new Date().toLocaleTimeString()} - WebSocket error:`, error);
        // Don't set connecting false here, onclose will handle it
        setMediaStatus("Server connection error.");
    };

    socketRef.current.onclose = (event) => {
        console.warn(`${new Date().toLocaleTimeString()} - WebSocket disconnected: Code=${event.code}, Reason='${event.reason}'`);
        const wasConnected = wsConnected; // Capture previous state
        setWsConnected(false);
        setIsConnecting(false); // No longer attempting connection

        // If the call was active or trying to match, indicate connection loss
        // Use refs here to check state at the time of closure
        if (isCallActiveRef.current || isMatchedRef.current || isEstablishingPeerRef.current) {
           handleCleanup(false); // Full cleanup if connection lost mid-call/setup
           setIsMatched(false); // Reset match status
           isMatchedRef.current = false;
        }

        // Schedule reconnect only if not a deliberate closure (e.g., code 1000)
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
            setMediaStatus("Connection lost. Attempting to reconnect...");
            reconnectAttempts.current += 1;
            const delay = baseReconnectInterval * Math.pow(2, reconnectAttempts.current - 1);
            console.log(`${new Date().toLocaleTimeString()} - Scheduling WebSocket reconnect attempt ${reconnectAttempts.current} in ${delay}ms`);
            setTimeout(connectWebSocket, delay);
        } else if (event.code !== 1000) {
            console.error(`${new Date().toLocaleTimeString()} - Max reconnect attempts reached after disconnect.`);
            setMediaStatus("Failed to connect to server. Please refresh.");
            setShowRetry(true);
        } else {
            console.log(`${new Date().toLocaleTimeString()} - WebSocket closed normally.`);
            // If closed normally maybe reset to initial state if not already cleaned up
             if (!nameConfirmed) setMediaStatus("Enter a name to start");
             else setMediaStatus("Disconnected."); // Or appropriate state
        }
    };

    socketRef.current.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            console.log(`${new Date().toLocaleTimeString()} - WebSocket message received: Type='${message.type}'`, message);
            handleWebSocketMessage(message);
        } catch (error) {
            console.error(`${new Date().toLocaleTimeString()} - WebSocket message parse error:`, error, "Raw data:", event.data);
        }
    };
    // Added dependencies
  }, [nameConfirmed, username, wsConnected, isConnecting, handleCleanup]); // handleCleanup is now stable


  // --- WebSocket Message Handling ---
  const sendWebSocketMessage = (message) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify(message));
        console.log(`${new Date().toLocaleTimeString()} - WebSocket message sent:`, message.type);
    } else {
        console.error(`${new Date().toLocaleTimeString()} - Cannot send WebSocket message: Connection not open. State: ${socketRef.current?.readyState}`, message);
        setMediaStatus("Error: Cannot communicate with server.");
        // Optionally trigger reconnect if appropriate
        // if (!isConnecting && reconnectAttempts.current < maxReconnectAttempts) {
        //    connectWebSocket();
        // }
    }
  };

  const handleWebSocketMessage = (message) => {
     // Use stable refs inside if needed to check current state without causing re-renders
    switch (message.type) {
        case MSG_TYPES.USER_ID:
            console.log(`${new Date().toLocaleTimeString()} - Received User ID from server:`, message.userID);
            localUserIdRef.current = message.userID;
            break;
        case MSG_TYPES.WAITING:
            setMediaStatus("Waiting for a partner...");
            setIsMatched(false);
            isMatchedRef.current = false;
            break;
        case MSG_TYPES.MATCHED:
            console.log(`${new Date().toLocaleTimeString()} - Matched with a partner!`);
            setIsMatched(true);
            isMatchedRef.current = true;
            setMediaStatus("Partner found! Setting up video call...");
            // Use refs to check current state reliably
            if (localStreamRef.current && !peerStateRef.current && !isEstablishingPeer.current) {
                console.log(`${new Date().toLocaleTimeString()} - Matched: Starting Peer Connection (Initiator: ${message.shouldInitiate ?? true})`);
                startPeerConnection(message.shouldInitiate ?? true);
            } else if (!localStreamRef.current) {
                console.log(`${new Date().toLocaleTimeString()} - Matched, but waiting for media stream.`);
                // The startCall function (likely already invoked by user) will handle this
                setMediaStatus("Partner found! Waiting for media permissions...");
            } else {
                console.warn(`${new Date().toLocaleTimeString()} - Matched signal received but state unexpected. Stream(ref): ${!!localStreamRef.current}, Peer(ref): ${!!peerStateRef.current}, Establishing: ${isEstablishingPeer.current}`);
            }
            break;
        case MSG_TYPES.SIGNAL:
            if (message.signalData) {
                const currentPeer = peerStateRef.current; // Use ref
                if (currentPeer) {
                    console.log(`${new Date().toLocaleTimeString()} - Received signal, passing to existing peer.`);
                    currentPeer.signal(message.signalData);
                } else if (isMatchedRef.current && localStreamRef.current && !isEstablishingPeer.current) {
                    console.log(`${new Date().toLocaleTimeString()} - Received signal (likely offer), creating non-initiator peer.`);
                    startPeerConnection(false, message.signalData);
                } else {
                    console.warn(`${new Date().toLocaleTimeString()} - Received signal but peer/stream/match state not ready. Ignoring. Peer(ref): ${!!currentPeer}, Matched(ref): ${isMatchedRef.current}, Stream(ref): ${!!localStreamRef.current}, Establishing: ${isEstablishingPeer.current}`);
                }
            } else {
                console.warn(`${new Date().toLocaleTimeString()} - Received SIGNAL message with no signalData.`);
            }
            break;
        case MSG_TYPES.CHAT:
            if (message.text) {
                console.log(`${new Date().toLocaleTimeString()} - Received chat:`, message.text);
                setChatMessages((prev) => [
                    ...prev,
                    { sender: "Stranger", text: message.text },
                ]);
            }
            break;
        case MSG_TYPES.PARTNER_LEFT:
            console.log(`${new Date().toLocaleTimeString()} - Partner disconnected.`);
            // Check if we were actually in a call or setup phase before cleaning up
            if (isCallActiveRef.current || isMatchedRef.current || isEstablishingPeerRef.current) {
                handleCleanup(true); // Clean up call, keep WebSocket
                setIsMatched(false); // Reset matched state
                isMatchedRef.current = false;
                setMediaStatus("Partner disconnected. Find a new partner?");
            } else {
                 console.log(`${new Date().toLocaleTimeString()} - PartnerLeft received but no active call/match state.`);
                 // Maybe just ensure match state is false
                 setIsMatched(false);
                 isMatchedRef.current = false;
            }
            break;
        case MSG_TYPES.SYSTEM_MESSAGE:
            setMediaStatus(message.text);
            break;
        case MSG_TYPES.ERROR:
            console.error(`${new Date().toLocaleTimeString()} - Server error message: ${message.text}`);
            setMediaStatus(`Server error: ${message.text}`);
            // Potentially cleanup or show retry based on error severity
            break;
        default:
            console.warn(`${new Date().toLocaleTimeString()} - Received unknown WebSocket message type:`, message.type);
    }
  };


  // --- WebRTC Peer Connection ---
  const startPeerConnection = useCallback((initiator, receivedSignal = null) => {
    // Use refs for checks
    if (peerStateRef.current || isEstablishingPeer.current || !localStreamRef.current || !isMatchedRef.current) {
        console.warn(`${new Date().toLocaleTimeString()} - startPeerConnection called unnecessarily or too early. Peer(ref): ${!!peerStateRef.current}, Establishing: ${isEstablishingPeer.current}, Stream(ref): ${!!localStreamRef.current}, Matched(ref): ${isMatchedRef.current}`);
        return;
    }

    console.log(`${new Date().toLocaleTimeString()} - Creating Peer. Initiator: ${initiator}`);
    isEstablishingPeer.current = true; // Set flag using original ref
    isEstablishingPeerRef.current = true; // Update state ref too
    setMediaStatus(initiator ? "Initiating connection..." : "Answering connection...");
    setIceConnectionState("new");
    setRemoteStream(null); // Clear old remote stream

    const newPeer = new Peer({
        initiator: initiator,
        trickle: true,
        stream: localStreamRef.current, // Pass the actual stream from ref
        config: { /* ICE servers */
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" },
                { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
                { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
            ],
        },
    });

    // Assign instance to state AND ref
    setPeer(newPeer);
    peerStateRef.current = newPeer;

    newPeer.on("signal", (signalData) => {
        console.log(`${new Date().toLocaleTimeString()} - Peer generated signal. Sending via WebSocket.`);
        sendWebSocketMessage({ type: MSG_TYPES.SIGNAL, signalData: signalData });
    });

    newPeer.on("connect", () => {
        console.log(`${new Date().toLocaleTimeString()} - Peer connection established (data channel).`);
        setIsCallActive(true);
        isCallActiveRef.current = true;
        isEstablishingPeer.current = false;
        isEstablishingPeerRef.current = false;
        // Don't set status here, wait for stream or rely on ICE state
    });

    newPeer.on("stream", (remoteStream) => {
        console.log(`${new Date().toLocaleTimeString()} - Received remote stream.`);
        setRemoteStream(remoteStream);
        setIsCallActive(true); // Redundant? connect event handles this
        isCallActiveRef.current = true;
        isEstablishingPeer.current = false; // Should be false now
        isEstablishingPeerRef.current = false;
        setMediaStatus("Connected!");
    });

    newPeer.on("iceconnectionstatechange", () => {
        const currentState = newPeer?.iceConnectionState; // Use optional chaining
        console.log(`${new Date().toLocaleTimeString()} - ICE connection state changed:`, currentState);
        setIceConnectionState(currentState ?? 'closed');

        if (currentState === "failed" || currentState === "disconnected" || currentState === "closed") {
            console.error(`${new Date().toLocaleTimeString()} - ICE connection issue. State: ${currentState}`);
             // Use refs to check if a call was active/being established to avoid multiple cleanups
             if (isCallActiveRef.current || isEstablishingPeerRef.current) {
                 setMediaStatus(`Connection issue (${currentState}). Partner may have left.`);
                 handleCleanup(true); // Clean up, keep WS
                 setIsMatched(false);
                 isMatchedRef.current = false;
                 setMediaStatus("Connection lost. Find a new partner?");
             }
        } else if (currentState === "connected" || currentState === "completed") {
             if(remoteStream) setMediaStatus("Connected!"); // Check state here, not ref
             else setMediaStatus("Peer connected, waiting for video...");
             isEstablishingPeer.current = false; // Update refs too
             isEstablishingPeerRef.current = false;
        } else if (currentState === 'checking') {
             setMediaStatus("Connecting to peer...");
        }
    });

    newPeer.on("error", (err) => {
        console.error(`${new Date().toLocaleTimeString()} - Peer error:`, err?.code, err);
        if (isCallActiveRef.current || isEstablishingPeerRef.current) {
            setMediaStatus(`Call error: ${err?.code || "Unknown"}. Please Skip.`);
            handleCleanup(true);
            setIsMatched(false);
            isMatchedRef.current = false;
        }
    });

    newPeer.on("close", () => {
        console.log(`${new Date().toLocaleTimeString()} - Peer connection closed.`);
        if (isCallActiveRef.current || isEstablishingPeerRef.current) {
            handleCleanup(true);
            setIsMatched(false);
            isMatchedRef.current = false;
            setMediaStatus("Call ended.");
        }
    });

    // Signal if we are receiver and got offer payload
    if (!initiator && receivedSignal) {
        console.log(`${new Date().toLocaleTimeString()} - Signaling received offer to newly created peer.`);
        newPeer.signal(receivedSignal);
    }
    // Dependencies are stable functions or primitives
  }, [sendWebSocketMessage, handleCleanup, remoteStream]);


  // --- Media Stream Handling ---
  const startCall = useCallback(async () => {
    console.log(`${new Date().toLocaleTimeString()} - startCall triggered. NameConfirmed: ${nameConfirmed}, WSConnected: ${wsConnected}, LocalStream(ref): ${!!localStreamRef.current}`);

    if (!nameConfirmed) {
        setMediaStatus("Please confirm your name first.");
        return;
    }
    if (!wsConnected) {
        setMediaStatus("Connecting to server...");
        if (!isConnecting) connectWebSocket(); // Attempt connect if not already trying
        return;
    }
    // Check using ref
    if (localStreamRef.current) {
        console.log(`${new Date().toLocaleTimeString()} - Media stream already available.`);
        // Check match/peer state using refs
        if (isMatchedRef.current && !peerStateRef.current && !isEstablishingPeer.current) {
            console.log(`${new Date().toLocaleTimeString()} - Already matched, starting peer connection now.`);
            startPeerConnection(true); // Assume initiator
        } else if (!isMatchedRef.current && !peerStateRef.current) {
            setMediaStatus("Ready. Waiting for server to find partner...");
        }
        return;
    }

    console.log(`${new Date().toLocaleTimeString()} - Requesting media devices (video/audio)...`);
    setMediaStatus("Accessing camera/microphone...");

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        console.log(`${new Date().toLocaleTimeString()} - Media stream obtained successfully. Setting state/ref.`);
        // Set state AND ref
        setLocalStream(stream);
        localStreamRef.current = stream; // Essential: update ref immediately
        setVideoEnabled(true);
        setMuted(false);

        // Check match status AFTER stream is set (using ref)
        if (isMatchedRef.current && !peerStateRef.current && !isEstablishingPeer.current) {
            console.log(`${new Date().toLocaleTimeString()} - Media obtained AND already matched, starting peer connection.`);
            startPeerConnection(true); // Assume initiator
        } else if (!isMatchedRef.current) {
            setMediaStatus("Media ready. Waiting for partner...");
        } else {
            console.log(`${new Date().toLocaleTimeString()} - Media obtained, match(ref): ${isMatchedRef.current}, peer(ref): ${!!peerStateRef.current}, establishing: ${isEstablishingPeer.current}`);
        }

    } catch (error) {
        console.error(`${new Date().toLocaleTimeString()} - getUserMedia error:`, error?.name, error?.message);
        if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
            setMediaStatus("Permission denied for camera/microphone. Please enable access.");
        } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
            setMediaStatus("No camera/microphone found.");
        } else {
            setMediaStatus(`Error accessing media: ${error.message}`);
        }
        setLocalStream(null); // Reset state
        localStreamRef.current = null; // Reset ref
        // Consider cleanup if media fails
        handleCleanup(true); // Keep WS
        setIsMatched(false);
        isMatchedRef.current = false;
    }
    // Add dependencies that are stable or primitive
  }, [nameConfirmed, wsConnected, isConnecting, connectWebSocket, startPeerConnection, handleCleanup]);


  // --- Effects ---

  // Effect to attach local stream to video element
  useEffect(() => {
    if (localStream && userVideoRef.current) {
        console.log(`${new Date().toLocaleTimeString()} - Attaching local stream to video element.`);
        userVideoRef.current.srcObject = localStream;
        userVideoRef.current.play().catch(err => console.error(`${new Date().toLocaleTimeString()} - Local video play failed:`, err));
    }
    // No cleanup needed here, handleCleanup stops tracks
  }, [localStream]); // Runs when localStream state changes

  // Effect to attach remote stream to video element
  useEffect(() => {
    if (remoteStream && partnerVideoRef.current) {
        console.log(`${new Date().toLocaleTimeString()} - Attaching remote stream to partner video element.`);
        partnerVideoRef.current.srcObject = remoteStream;
        partnerVideoRef.current.play().catch(err => console.error(`${new Date().toLocaleTimeString()} - Remote video play failed:`, err));
    } else if (!remoteStream && partnerVideoRef.current) {
        // Clear video element if remote stream is removed
        partnerVideoRef.current.srcObject = null;
    }
     // No cleanup needed here, handleCleanup clears srcObject
  }, [remoteStream]); // Runs when remoteStream state changes

  // Effect for component mount/unmount - NOW STABLE
  useEffect(() => {
    console.log(`${new Date().toLocaleTimeString()} - Video component MOUNTED.`);
    // Optional: Initial connection attempt if needed based on logic
    // if (!nameConfirmed) { ... } else { connectWebSocket(); }

    // Return function runs ONLY on UNMOUNT because handleCleanup is stable
    return () => {
        console.warn(`${new Date().toLocaleTimeString()} - !!! Video component UNMOUNTING - Running cleanup !!!`);
        handleCleanup(false); // Full cleanup on unmount
    };
    // handleCleanup is stable due to useCallback with refs
  }, [handleCleanup]);


  // --- UI Event Handlers ---
  const handleNameConfirm = () => {
    const trimmedName = username.trim();
    if (trimmedName) {
        setUsername(trimmedName);
        setNameConfirmed(true);
        setMediaStatus("Connecting to server...");
        // Ensure connection attempt after confirming name
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
           reconnectAttempts.current = 0;
           connectWebSocket(); // Will register on open
        } else {
            // If already connected, register now
            sendWebSocketMessage({ type: MSG_TYPES.REGISTER, name: trimmedName });
            setMediaStatus("Connected. Ready to find partner.");
        }
    } else {
        setMediaStatus("Please enter a valid name.");
    }
  };

  const handleEndCall = () => {
    console.log(`${new Date().toLocaleTimeString()} - User clicked End Call.`);
    sendWebSocketMessage({ type: MSG_TYPES.LEAVE });
    handleCleanup(true); // Clean up local resources, keep WebSocket
    setIsMatched(false);
    isMatchedRef.current = false;
    setMediaStatus("Call ended. Find a new partner?");
  };

  const handleSkip = () => {
    console.log(`${new Date().toLocaleTimeString()} - User clicked Skip.`);
    // Check if we are actually in a call or matched before cleaning up
    if (isCallActiveRef.current || isMatchedRef.current || isEstablishingPeerRef.current) {
        setMediaStatus("Finding next partner...");
        sendWebSocketMessage({ type: MSG_TYPES.LEAVE });
        handleCleanup(true); // Clean up current call
        setIsMatched(false);
        isMatchedRef.current = false;
    } else {
        // If not in a call, just ensure we are trying to find one
         setMediaStatus("Looking for a partner...");
    }

    // Try to start the call process again (gets media if needed, waits for match)
    startCall();
  };

  const toggleMute = () => {
    // Use ref for stream access if needed, but state works fine here
    if (localStream) {
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0) {
             const newState = !muted; // Calculate next state
             audioTracks.forEach((track) => (track.enabled = !newState)); // Enable track if newState is false (unmuted)
             setMuted(newState); // Update state AFTER changing track
             console.log(`${new Date().toLocaleTimeString()} - Audio ${newState ? "muted" : "unmuted"}`);
        }
    }
  };


  const toggleVideo = () => {
    if (localStream) {
         const videoTracks = localStream.getVideoTracks();
         if (videoTracks.length > 0) {
            const newState = !videoEnabled; // Calculate next state
            videoTracks.forEach((track) => (track.enabled = newState)); // Track enabled matches videoEnabled state
            setVideoEnabled(newState);
            console.log(`${new Date().toLocaleTimeString()} - Video ${newState ? "enabled" : "disabled"}`);
         }
    }
  };

  const sendChatMessage = (text) => {
    const trimmedText = text.trim();
    // Check call active state using ref
    if (trimmedText && isCallActiveRef.current && peerStateRef.current) {
        sendWebSocketMessage({ type: MSG_TYPES.CHAT, text: trimmedText });
        setChatMessages((prev) => [
            ...prev,
            { sender: "You", text: trimmedText },
        ]);
        console.log(`${new Date().toLocaleTimeString()} - Sent chat message:`, trimmedText);
    } else {
        console.warn(`${new Date().toLocaleTimeString()} - Cannot send chat: Call not active or peer missing.`);
    }
  };

  const handleRetryConnect = () => {
     console.log(`${new Date().toLocaleTimeString()} - Manual WebSocket reconnect attempt.`);
     setShowRetry(false);
     reconnectAttempts.current = 0; // Reset counter
     connectWebSocket();
  };


  // --- Render Logic ---
  const renderContent = () => {
      if (!nameConfirmed) {
          // Name Input Screen
          return (
              <div style={nameConfirmContainerStyle(theme)}>
                  <h2 style={{ color: theme === "dark" ? "#ffffff" : "#222222" }}>Anonymous Video Call</h2>
                  <p style={{ color: theme === 'dark' ? '#ccc' : '#555', marginBottom: '15px' }}>Choose a temporary name to start.</p>
                  <input
                      type="text" value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your temporary name"
                      style={inputStyle(theme)} maxLength={20}
                      onKeyDown={(e) => e.key === 'Enter' && handleNameConfirm()}
                  />
                  <button onClick={handleNameConfirm} style={startButtonStyle} disabled={!username.trim() || isConnecting}>
                      {isConnecting ? "Connecting..." : "Confirm Name & Connect"}
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

      // After Name Confirmed - Waiting or Active Call
      // Use state directly for rendering decisions
      if (!isCallActive || !remoteStream) {
          // Waiting Screen (Media obtained or not, waiting for match or connection)
          let buttonText = "Start Video Chat";
          let showStartButton = !localStream && !isConnecting; // Show if no stream and not connecting WS
          let startButtonDisabled = !wsConnected; // Basic disable if WS disconnected

          if (localStream && !isMatched) {
              buttonText = "Waiting for Partner...";
              showStartButton = false; // Hide button once stream is ready, show status instead
          } else if (localStream && isMatched && isEstablishingPeer.current) {
              buttonText = "Connecting...";
              showStartButton = false;
          } else if (isConnecting) {
              buttonText = "Connecting Server...";
              showStartButton = true; // Show button but disabled
              startButtonDisabled = true;
          }

          return (
              <div style={{ textAlign: "center", width: '100%' }}>
                  <h2>Welcome, {username}!</h2>
                  <p style={{ color: theme === 'dark' ? '#ccc' : '#555', marginTop: '15px' }}>Status: {mediaStatus}</p>
                  {showStartButton && (
                      <button onClick={startCall} style={startButtonStyle} disabled={startButtonDisabled}>
                          {buttonText}
                      </button>
                  )}
                  {showRetry && !isConnecting && (
                      <button onClick={handleRetryConnect} style={skipButtonStyle} disabled={isConnecting}>
                          Retry Connection
                      </button>
                  )}
                  {!wsConnected && !isConnecting && !showRetry && <p style={{ color: 'red', marginTop: '10px' }}>Server disconnected.</p>}

                  {/* Show video previews while waiting */}
                   {(localStream || isCallActive || remoteStream) && ( // Show previews once local stream ready or call is active
                       <div style={videoContainerStyle}>
                            {/* User Video Preview */}
                           <div style={videoWrapperStyle}>
                               <p style={nameTagStyle(theme)}>You ({username})</p>
                               <video ref={userVideoRef} playsInline autoPlay muted style={videoStyle(theme)} />
                               {localStream && !videoEnabled && <div style={videoPlaceholderStyle(theme)}>Video Off</div>}
                               {!localStream && <div style={videoStyle(theme)}><div style={videoPlaceholderStyle(theme)}>Enable Camera</div></div>}
                           </div>
                           {/* Partner Video Placeholder */}
                           <div style={videoWrapperStyle}>
                               <p style={nameTagStyle(theme)}>Stranger</p>
                               <video ref={partnerVideoRef} playsInline autoPlay style={videoStyle(theme)} />
                                {/* Use placeholder div on top of video if srcObject isn't set */}
                                <div style={videoPlaceholderStyle(theme)}>
                                    {mediaStatus.includes("Waiting") || mediaStatus.includes("Finding") ? "Waiting for partner..." :
                                     mediaStatus.includes("Connecting") ? "Connecting..." :
                                     "Video Area"}
                                </div>
                           </div>
                       </div>
                   )}
                  {/* Add controls placeholder if needed while waiting? Maybe not. */}
                  {/* Add Chat placeholder? */}
                    <div style={chatAreaStyle(theme)}>
                        <h3>Chat</h3>
                         <div style={chatMessagesStyle(theme)}>
                            <p style={{textAlign:'center', color: theme === 'dark' ? '#888' : '#777'}}>Connect with a partner to chat.</p>
                         </div>
                         <input type="text" placeholder="Connect to chat" disabled={true} style={inputStyle(theme)} />
                    </div>

              </div>
          );
      }

      // --- Active Call Screen ---
      return (
          <div style={callAreaStyle}>
              {/* Status Area */}
              <div style={{ marginBottom: '10px', textAlign: 'center' }}>
                  <p style={{ color: theme === 'dark' ? '#ccc' : '#555', margin: '5px 0' }}>Status: {mediaStatus}</p>
                  <p style={{ color: theme === 'dark' ? '#aaa' : '#777', margin: '5px 0', fontSize: '0.9em' }}>ICE State: {iceConnectionState}</p>
              </div>

              {/* Video Area */}
              <div style={videoContainerStyle}>
                  {/* Partner Video */}
                  <div style={videoWrapperStyle}>
                      <p style={nameTagStyle(theme)}>Stranger</p>
                      <video ref={partnerVideoRef} playsInline autoPlay style={videoStyle(theme)} />
                      {/* Placeholder might briefly show if stream lags after state update */}
                      {!remoteStream && <div style={videoPlaceholderStyle(theme)}>Loading video...</div>}
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
                  <button onClick={handleEndCall} style={{ ...controlButtonStyle(theme), backgroundColor: "#dc3545" }} title="End Call">
                      <span className="material-icons">call_end</span>
                  </button>
                  <button onClick={handleSkip} style={{ ...controlButtonStyle(theme), backgroundColor: "#6c757d" }} title="Skip to Next Partner" disabled={!wsConnected || isEstablishingPeer.current}>
                      <span className="material-icons">skip_next</span>
                  </button>
              </div>

              {/* Chat Area */}
              <div style={chatAreaStyle(theme)}>
                  <h3>Chat</h3>
                  <div style={chatMessagesStyle(theme)} ref={el => { /* Optional: auto-scroll logic here */ }}>
                      {chatMessages.length === 0 && <p style={{ textAlign: 'center', color: theme === 'dark' ? '#888' : '#777' }}>Chat messages will appear here.</p>}
                      {chatMessages.map((msg, index) => (
                          <p key={index} style={{ margin: '5px 0', color: msg.sender === 'You' ? (theme === 'dark' ? '#a0e9ff' : '#007bff') : (theme === 'dark' ? '#e0e0e0' : '#333') }}>
                              <strong>{msg.sender}:</strong> {msg.text}
                          </p>
                      ))}
                  </div>
                  <input
                      type="text"
                      placeholder={isCallActive ? "Type a message..." : "Connecting chat..."}
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


  // --- Component Return ---
  return (
      <div style={pageContainerStyle(theme)}>
          {renderContent()}
      </div>
  );
};


// --- Styles --- (Keep the styles defined in the previous good response)
// Example (ensure all styles are included):
const pageContainerStyle = (theme) => ({
  backgroundColor: theme === "dark" ? "#121212" : "#f8f9fa",
  color: theme === "dark" ? "#ffffff" : "#333333",
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center", // Center content vertically too
  padding: "20px",
  boxSizing: 'border-box',
  width: '100%' // Ensure it takes full width
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
    padding: '10px 0' // Add some padding top/bottom
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
  flex: '1 1 300px', // Flex properties for responsiveness
  minWidth: '280px', // Minimum width before wrapping aggressively
  maxWidth: '550px', // Max width per video element
};

const videoStyle = (theme) => ({
  width: "100%", // Make videos responsive within their container
  height: "auto", // Maintain aspect ratio
  aspectRatio: '4 / 3', // Common webcam aspect ratio
  backgroundColor: theme === 'dark' ? "#000" : '#ddd',
  borderRadius: "8px",
  objectFit: 'cover', // Cover the area, might crop slightly
  border: `1px solid ${theme === 'dark' ? '#444' : '#ccc'}`,
  display: 'block' // Prevents potential small gap below video
});

const videoPlaceholderStyle = (theme) => ({
    position: 'absolute',
    top: 0, // Align with top border of video frame
    left: 0, // Align with left border
    right: 0, // Align with right border
    bottom: 0, // Align with bottom border
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: '#fff',
    fontSize: '1.1em', // Slightly smaller text
    borderRadius: '8px', // Match video style
    zIndex: 1, // Above the video element
    padding: '10px', // Add padding inside placeholder
    textAlign: 'center',
});

const nameTagStyle = (theme) => ({
    color: theme === 'dark' ? '#eee' : '#444',
    marginBottom: '5px',
    fontWeight: 'bold',
    width: '100%', // Take full width for centering text
    textAlign: 'center' // Center the name tag
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
  },
   '&:disabled': { // Style for disabled state
      backgroundColor: "#999",
      cursor: 'not-allowed',
      opacity: 0.6,
  }
});


const chatAreaStyle = (theme) => ({
    marginTop: "20px",
    width: "90%",
    maxWidth: "700px", // Max width for chat area
    backgroundColor: theme === 'dark' ? '#2a2a2a' : '#f1f1f1',
    padding: '15px',
    borderRadius: '8px',
    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
});

const chatMessagesStyle = (theme) => ({
    height: "150px", // Fixed height for chat box
    overflowY: "auto", // Enable scrolling
    border: `1px solid ${theme === 'dark' ? '#444' : '#ccc'}`,
    padding: "10px",
    marginBottom: '10px',
    borderRadius: '4px',
    backgroundColor: theme === 'dark' ? '#1e1e1e' : '#fff',
    fontSize: '0.95em', // Slightly smaller chat text
    lineHeight: '1.4',
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
  transition: 'background-color 0.2s ease, opacity 0.2s ease', // Add opacity transition
  '&:hover': {
      backgroundColor: "#5a6268",
  },
  '&:disabled': {
      backgroundColor: "#999",
      cursor: 'not-allowed',
      opacity: 0.6,
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
  transition: 'background-color 0.2s ease, opacity 0.2s ease',
  '&:hover': {
      backgroundColor: "#157347",
  },
   '&:disabled': {
      backgroundColor: "#999",
      cursor: 'not-allowed',
      opacity: 0.6,
  }
};

const inputStyle = (theme) => ({
  boxSizing: 'border-box', // Include padding and border
  width: "100%",
  padding: "12px",
  borderRadius: "5px",
  border: `1px solid ${theme === 'dark' ? '#555' : '#ccc'}`,
  fontSize: "16px",
  outline: "none",
  backgroundColor: theme === "dark" ? "#333" : "#fff",
  color: theme === "dark" ? "#ffffff" : "#222",
  marginBottom: '10px',
   '&:disabled': { // Style for disabled input
      backgroundColor: theme === 'dark' ? '#444' : '#e9ecef',
      cursor: 'not-allowed',
      opacity: 0.7,
  }
});


export default Video;
import React, { useState, useEffect, useRef, useContext } from "react";
import { Container, Row, Col, Button, Form, InputGroup, Spinner, Alert } from "react-bootstrap"; // Added Alert
import { FaPaperPlane, FaVideo } from "react-icons/fa";
import { ThemeContext } from "../components/ThemeContext";
import CryptoJS from 'crypto-js';

// --- Helper Function for Timestamp Logging (Keep existing) ---
const logTimestamp = (label, ts) => {
    // ... (keep existing function)
};

const Chat = () => {
    const { theme, selfDestructEnabled, destructTime, customTime } = useContext(ThemeContext);
    // console.log(`[Chat Render] Context: Enabled=${selfDestructEnabled}, Time=${destructTime}, Custom=${customTime}`); // Less verbose logging

    const [name, setName] = useState("");
    const [sessionID] = useState(() => Math.random().toString(36).substring(2));
    const [chatStarted, setChatStarted] = useState(false);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [userMap, setUserMap] = useState({});
    const [status, setStatus] = useState("Connecting you with a partner...");
    const [isConnecting, setIsConnecting] = useState(false);
    const [moderationNotice, setModerationNotice] = useState(""); // <-- State for moderation feedback
    const userIDRef = useRef(null);
    const chatContainerRef = useRef(null);
    const socketRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const encryptionKeyRef = useRef(null);
    const intervalIdRef = useRef(null);
    const moderationNoticeTimerRef = useRef(null); // <-- Ref for moderation notice timeout

    // --- Debug Effect for destructTime Changes (Keep existing) ---
    useEffect(() => {
       // ... (keep existing effect)
    }, [destructTime, selfDestructEnabled, chatStarted, customTime]);

    // --- Effects (WebSocket, Scroll) ---
    useEffect(() => {
        console.log("[Effect Main] Running. chatStarted:", chatStarted);
        if (chatStarted && !encryptionKeyRef.current) {
            encryptionKeyRef.current = CryptoJS.lib.WordArray.random(32).toString();
            console.log("Generated Initial Encryption Key:", encryptionKeyRef.current.substring(0, 10) + "...");
        }
        if (chatStarted) connectWebSocket();

        return () => {
            console.log("[Effect Main] Cleanup: Disconnecting WS & clearing timers");
            disconnectWebSocket(); // Includes clearing reconnect timer
            if (intervalIdRef.current) {
                clearInterval(intervalIdRef.current);
                intervalIdRef.current = null;
            }
            if (moderationNoticeTimerRef.current) { // <-- Clear moderation timer on unmount
                clearTimeout(moderationNoticeTimerRef.current);
                moderationNoticeTimerRef.current = null;
            }
        };
    }, [chatStarted]); // Only depends on chatStarted

    // --- Scroll Effect (Keep existing) ---
    useEffect(() => {
       // ... (keep existing effect)
    }, [messages]);

    // --- WebSocket Functions (Minor adjustments) ---
    const connectWebSocket = () => {
        if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
             console.log(`WebSocket already ${socketRef.current.readyState === WebSocket.OPEN ? 'connected' : 'connecting'}, skipping.`);
             return;
        }

        // Ensure key exists before connecting if chat has started
        if (chatStarted && !encryptionKeyRef.current) {
            console.error("Cannot connect WebSocket: Encryption key missing.");
            setStatus("Error: Missing encryption key.");
            return;
        }

        setStatus("Connecting to chat server...");
        setIsConnecting(true);
        setModerationNotice(''); // Clear old notices on new connection attempt

        // Use environment variable or default for URL
        const WS_URL = process.env.REACT_APP_WS_URL || "wss://textanon.onrender.com";
        socketRef.current = new WebSocket(WS_URL);
        console.log("WebSocket connecting to:", WS_URL);


        socketRef.current.onopen = () => {
            console.log("WebSocket onopen: Connected.");
            setIsConnecting(false);
            setStatus("Registering with server...");
            // Send registration immediately on open
            if (name && encryptionKeyRef.current) {
                socketRef.current.send(JSON.stringify({
                    type: "register",
                    name,
                    sessionID, // You might not need sessionID on server if userID is primary identifier
                    encryptionKey: encryptionKeyRef.current
                }));
                console.log("Sent registration message.");
                // Status will be updated by server messages (userID, systemMessage etc.)
            } else {
                console.error("Cannot register: Name or Key missing after connection.");
                setStatus("Error: Registration failed.");
                // Consider closing the connection if registration fails critically
                 // socketRef.current.close(1000, "Registration failed");
            }
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current); // Clear reconnect timer on successful open
        };

        socketRef.current.onmessage = async (event) => {
            try {
                const messageText = event.data instanceof Blob
                    ? await event.data.text()
                    : event.data;
                // console.log("Raw WS Message:", messageText); // Debugging raw messages
                const received = JSON.parse(messageText);
                handleMessage(received); // Process the parsed message
            } catch (err) {
                console.error("Error parsing WebSocket message:", err, "Raw data:", event.data);
                setStatus("Error processing message."); // Inform user
            }
        };

        socketRef.current.onerror = (err) => {
            // The 'error' event often doesn't give much detail, 'close' event is more informative usually
            console.error("WebSocket onerror:", err);
            setIsConnecting(false);
            setStatus("WebSocket connection error. Trying to reconnect...");
            // Don't immediately reconnect here, 'onclose' will handle it
        };

        socketRef.current.onclose = (event) => {
            console.log(`WebSocket onclose: Code=${event.code}, Reason=${event.reason}, Clean=${event.wasClean}`);
            setIsConnecting(false);
            socketRef.current = null; // Nullify the ref
            if (event.code !== 1000 && chatStarted) { // Only auto-reconnect if chat was intended to be active
                setStatus("Disconnected. Reconnecting...");
                reconnectWebSocket();
            } else {
                setStatus("Disconnected from chat server.");
                // Could potentially reset chat state here if needed
                // setChatStarted(false); // Example: Force back to name screen on clean disconnect
            }
        };
    };
    const reconnectWebSocket = () => {
        if (!chatStarted) return; // Don't reconnect if user navigated away
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
            console.log("Attempting WebSocket reconnection...");
            connectWebSocket();
        }, 3000 + Math.random() * 2000); // Add jitter
     };
    const disconnectWebSocket = () => {
         if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
         reconnectTimeoutRef.current = null;
         if (socketRef.current) {
            // Prevent further 'onclose' triggered actions if we are manually closing
            socketRef.current.onclose = () => { console.log("WS closed manually."); };
            if(socketRef.current.readyState === WebSocket.OPEN) {
                 socketRef.current.close(1000, "User disconnected");
                 console.log("Sent WS close signal.");
            }
            socketRef.current = null;
         }
         setIsConnecting(false);
         // Don't necessarily change status here, as it might be handled by calling function (e.g., goBackToHome)
     };

    // --- Message Handling ---
    const handleMessage = (received) => {
        console.log("Handling Message:", received.type, received); // Log message type
        switch (received.type) {
            case "userID": handleUserIDMessage(received); break;
            case "chat": handleChatMessage(received); break;
            // case "chatHistory": handleChatHistoryMessage(received); break; // Keep if server sends history
            case "systemMessage": handleSystemMessage(received); break;
            case "chatEnded": handleChatEndedMessage(received); break;
            // case "encryptionKey": handleEncryptionKeyMessage(received); break; // Keep if server sends keys
            case "partnerConnected": handlePartnerConnectedMessage(received); break; // Handle specific connection event
            case "moderation_blocked": handleModerationBlocked(received); break; // <-- Handle moderation feedback
            // Add cases for your WebRTC signaling if needed ('hey', 'callAccepted', 'ice-candidate')
            default: console.warn("Unknown msg type:", received.type, received);
        }
    };
    const handleUserIDMessage = (received) => {
        userIDRef.current = received.userID;
        console.log("Received UserID:", received.userID);
        // Don't change status here, wait for registration confirmation or pairing message
    };
    const handleChatMessage = (received) => {
        if (!encryptionKeyRef.current) { console.error("ChatMsg: No key to decrypt"); return; }
        if (received.senderID === userIDRef.current) { console.warn("Ignoring self-sent message received back."); return; } // Should not happen with server relay

        // Update status only if not already showing connected state
        // (Server 'systemMessage' should ideally handle this)
        // if (!status.startsWith("You are now connected")) setStatus(`Connected with ${received.senderName || 'Partner'}`);

        setUserMap((prev) => ({ ...prev, [received.senderID]: received.senderName })); // Store partner name

        let decryptedText;
        try {
            const bytes = CryptoJS.AES.decrypt(received.text, encryptionKeyRef.current);
            decryptedText = bytes.toString(CryptoJS.enc.Utf8);
            if (!decryptedText && received.text) { // If original text wasn't empty but decryption is, flag it
                decryptedText = "<Decryption Failed: Empty Result>";
                console.warn("Decryption resulted in empty string for message:", received);
            } else if (!decryptedText) {
                 decryptedText = "<Empty Message Received>"; // Should not happen if server validates
            }
        } catch (e) {
            decryptedText = "<Decryption Error>";
            console.error("Decrypt Err:", e, "Raw text:", received.text);
        }

        const serverTimestamp = received.timestamp;
        // logTimestamp("handleChatMessage - Received server timestamp", serverTimestamp); // Less verbose
        const newMessageData = {
            senderID: received.senderID,
            senderName: received.senderName || userMap[received.senderID] || "Partner", // Use stored name if available
            text: decryptedText,
            timestamp: serverTimestamp || Date.now() // Fallback to client time if timestamp missing
        };
        // logTimestamp(`handleChatMessage - Storing message "${newMessageData.text.substring(0,10)}..."`, newMessageData.timestamp); // Less verbose
        setMessages((prev) => [...prev, newMessageData]);
    };
    // const handleChatHistoryMessage = (received) => { ... }; // Keep if using history
    const handleSystemMessage = (received) => {
        setStatus(received.text);
        console.log("Sys Msg:", received.text);
        // Add system messages to chat log if desired
        // setMessages((prev) => [...prev, { type: 'system', text: received.text, timestamp: Date.now() }]);
    };
    const handleChatEndedMessage = () => {
        console.log("Partner disconnected or skipped.");
        setMessages((prevMessages) => [...prevMessages, { type: 'system', text: "Partner has left. Finding new partner...", timestamp: Date.now() }]); // Add system message
        setUserMap({});
        setStatus("Partner disconnected. Finding partner...");
        // Server should handle putting user back in queue
        // encryptionKeyRef.current = null; // Key should persist unless explicitly changed
        // console.log("Key cleared (disconnect)."); // Don't clear key on partner disconnect
    };
    // const handleEncryptionKeyMessage = (received) => { ... }; // Keep if using key exchange
    const handlePartnerConnectedMessage = (received) => {
        // Potentially use this if server sends partner details explicitly
        console.log("Partner connected:", received);
        // Status should be set by the accompanying 'systemMessage' from server
        if(received.partnerName) {
             setUserMap(prev => ({...prev, [received.partnerID]: received.partnerName}));
        }
    };

    // --- NEW: Handle Moderation Feedback ---
    const handleModerationBlocked = (received) => {
        console.warn('Message blocked by server:', received.reason);
        setModerationNotice(received.reason || 'Your message was blocked.');
        // Clear the notice after a few seconds
        if (moderationNoticeTimerRef.current) {
            clearTimeout(moderationNoticeTimerRef.current);
        }
        moderationNoticeTimerRef.current = setTimeout(() => {
            setModerationNotice('');
            moderationNoticeTimerRef.current = null;
        }, 6000); // Increased time
    };


    // --- Actions ---
    const startChat = () => {
        if (name.trim()) {
            setChatStarted(true);
            // Connection will be initiated by the useEffect hook based on chatStarted
        } else {
            setStatus("Please enter a nickname to start.");
        }
    };
    const sendMessage = () => {
        if (!newMessage.trim() || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN || !encryptionKeyRef.current || !userIDRef.current) {
            console.warn("Cannot send message. Check connection, input, key, or userID.");
            if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) setStatus("Not connected to server.");
            else if (!encryptionKeyRef.current) setStatus("Encryption key missing.");
            else if (!userIDRef.current) setStatus("User ID not assigned.");
            return;
        }

        setModerationNotice(''); // Clear previous moderation notice on new attempt

        let encryptedText;
        try {
            encryptedText = CryptoJS.AES.encrypt(newMessage, encryptionKeyRef.current).toString();
        } catch (e) {
            console.error("Encryption Err:", e);
            setStatus("Error encrypting message.");
            setModerationNotice("Error encrypting message."); // Show feedback
            return;
        }

        const timestamp = Date.now();
        const messageData = {
            type: "chat",
            // senderID/senderName are added by server based on connection, but can include for context
            // senderID: userIDRef.current,
            // senderName: name,
            text: encryptedText,
            timestamp: timestamp // Include timestamp
        };

        socketRef.current.send(JSON.stringify(messageData));
        console.log(`Sent encrypted message (ts: ${timestamp})`);

        // Add message locally IMMEDIATELY for responsiveness
        // Note: Server might block it later, but this provides instant feedback
        const localMessageData = {
            senderID: userIDRef.current,
            senderName: name, // Show own name immediately
            text: newMessage, // Show plain text locally
            timestamp: timestamp,
            isLocal: true // Optional flag for styling potentially unconfirmed messages
        };
        logTimestamp(`sendMessage - Storing local message "${localMessageData.text.substring(0,10)}..."`, localMessageData.timestamp);
        setMessages((prev) => [...prev, localMessageData]);
        setNewMessage(""); // Clear input field
    };
    const startVideoCall = () => alert("Video call feature is currently disabled."); // Keep disabled for now
    const skipToNextUser = () => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            console.log("Sending skip request...");
            socketRef.current.send(JSON.stringify({ type: "skip" }));
            // Don't clear messages immediately, wait for 'chatEnded' or system message from server
            // setMessages([]);
            setUserMap({});
            setStatus("Skipping partner...");
            // encryptionKeyRef.current = null; // Don't clear key on skip
            // console.log("Key cleared (skip).");
        } else {
            console.warn("Skip failed: WebSocket not open.");
            setStatus("Cannot skip: Not connected.");
            reconnectWebSocket(); // Attempt reconnect if connection lost
        }
    };
    const handleKeyPress = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }};
    const goBackToHome = () => {
        console.log("[Go Back] Leaving chat.");
        setChatStarted(false); // This will trigger useEffect cleanup
        // Reset state fully
        setName("");
        setMessages([]);
        setUserMap({});
        setStatus("Enter a nickname to start chat."); // Reset status
        userIDRef.current = null;
        encryptionKeyRef.current = null; // Clear key when leaving entirely
        setModerationNotice(''); // Clear any notices
        // disconnectWebSocket() is called by useEffect cleanup
    };
    const handleNameSelectionKeyPress = (e) => { if (e.key === "Enter") { e.preventDefault(); startChat(); }};

    // --- Mount/Unmount Log (Keep existing) ---
    useEffect(() => {
       // ... (keep existing effect)
    }, []);

    // --- SELF-DESTRUCT UseEffect (Keep existing) ---
    useEffect(() => {
       // ... (keep existing effect)
    }, [selfDestructEnabled, destructTime, customTime, chatStarted]);

    // --- cleanupOldMessages Function (Keep existing) ---
    const cleanupOldMessages = (currentMessages, currentDestructTime, currentCustomTime) => {
        // ... (keep existing function)
    };

    // --- JSX Structure ---
    return (
        <div className={`chat-page d-flex align-items-center justify-content-center theme-${theme}`} style={{ width: "100vw", minHeight: "100vh", backgroundColor: theme === "dark" ? "#121212" : "#f8f9fa", color: theme === "dark" ? "#ffffff" : "#333333", position: "relative", overflow: "hidden", transition: "background-color 0.3s ease, color 0.3s ease" }}>
            <Container>
                {!chatStarted ? (
                    // --- Name Entry Screen (Keep existing structure) ---
                    <Row className="justify-content-center">
                        <Col md={6} lg={4}>
                            <div style={{ maxWidth: '400px', margin: '20px auto', padding: '20px', background: theme === 'dark' ? '#1e1e1e' : '#fff', borderRadius: '8px', boxShadow: theme === 'dark' ? '0 4px 8px rgba(255,255,255,0.1)' : '0 4px 8px rgba(0,0,0,0.1)' }}>
                                <h3 className="text-center mb-4">Enter Chat</h3>
                                <Form>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Nickname:</Form.Label>
                                        <Form.Control type="text" placeholder="Your nickname" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={handleNameSelectionKeyPress} autoFocus maxLength={20}/>
                                    </Form.Group>
                                    <div className="d-grid">
                                        <Button variant="primary" onClick={startChat} disabled={!name.trim()}>Start Chat</Button>
                                    </div>
                                    {/* Simplified status display */}
                                    {status && !status.toLowerCase().includes("connected") && !status.toLowerCase().includes("finding") && status !== "Registering with server..." && (
                                        <p className={`text-center mt-2 small ${status.toLowerCase().includes('enter') || status.toLowerCase().includes('error') ? 'text-danger' : 'text-muted'}`}>{status}</p>
                                    )}
                                </Form>
                            </div>
                        </Col>
                    </Row>
                ) : (
                    // --- Chat Screen ---
                    <Row className="justify-content-center">
                        <Col md={8} lg={7} className="p-3 rounded d-flex flex-column chat-window" style={{ backgroundColor: theme === "dark" ? "#1e1e1e" : "#ffffff", color: theme === "dark" ? "#ffffff" : "#333333", border: theme === "dark" ? "1px solid #333" : "1px solid #ddd", boxShadow: theme === "dark" ? "0px 4px 15px rgba(0, 0, 0, 0.2)" : "0px 4px 15px rgba(0, 0, 0, 0.1)", transition: "background-color 0.3s ease, color 0.3s ease, border 0.3s ease", display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', minHeight: '450px', maxHeight: '85vh' }}>
                            {/* Header */}
                            <div className="chat-header text-center pb-2" style={{ borderBottom: theme === 'dark' ? '1px solid #333' : '1px solid #ddd' }}>
                                <h2 style={{ fontSize: '1.4rem', marginBottom: '0.1rem' }}>Anonymous Chat</h2>
                                <p className="mb-0" style={{ fontSize: '0.85rem' }}>Nickname: <span style={{ fontWeight: 'bold' }}>{name}</span></p>
                                <div className="mt-1">
                                    <small style={{ fontStyle: "italic", fontSize: '0.8rem', opacity: 0.9 }}>{status}</small>
                                    {isConnecting && <Spinner animation="border" size="sm" className="ms-2" variant={theme === 'dark' ? 'light' : 'dark'}/>}
                                </div>
                            </div>

                            {/* Message Area */}
                            <div ref={chatContainerRef} className="chat-box p-3 mt-2 flex-grow-1" style={{ overflowY: "auto", display: "flex", flexDirection: "column", backgroundColor: theme === "dark" ? "#2a2a2a" : "#f1f1f1", marginBottom: '10px', border: theme === 'dark' ? '1px solid #444' : '1px solid #eee', borderRadius: '4px' }}>
                                {messages.map((msg, index) => {
                                     if (msg.type === 'system') { // Render system messages differently
                                        return (
                                            <div key={`sys-${index}`} className="system-message text-center align-self-center" style={{ width: "fit-content", maxWidth: "90%", backgroundColor: theme === "dark" ? "#444" : "#e9ecef", color: theme === "dark" ? "#ccc" : "#555", padding: "5px 10px", borderRadius: "8px", margin: "8px auto", fontSize: "0.8rem", fontStyle: "italic" }}>
                                                {msg.text}
                                                 {/* <span style={{fontSize: '0.7rem', opacity: 0.6, display: 'block', textAlign: 'right', marginTop: '4px'}}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> */}
                                            </div>
                                        );
                                    }
                                    // Regular chat messages
                                    const isOwnMessage = msg.senderID === userIDRef.current;
                                    return (
                                        <div key={index} style={{ width: "fit-content", maxWidth: "75%", alignSelf: isOwnMessage ? "flex-end" : "flex-start", backgroundColor: isOwnMessage ? (theme === 'dark' ? '#0b533f' : '#d1e7dd') : (theme === 'dark' ? '#0a4a8f' : '#cfe2ff'), color: theme === 'dark' ? '#e0e0e0' : '#000', padding: "8px 12px", borderRadius: isOwnMessage ? "15px 15px 5px 15px" : "15px 15px 15px 5px", marginBottom: "8px", fontSize: "0.95rem", wordBreak: 'break-word', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: theme === 'dark' ? '1px solid #444' : '1px solid #ccc' }}>
                                            {!isOwnMessage && ( // Show sender name only for partner messages
                                                <strong style={{ display: 'block', marginBottom: '3px', fontSize: '0.7rem', opacity: 0.8, color: theme === 'dark' ? '#aaa' : '#555' }}>
                                                    {msg.senderName || "Partner"} {/* Use senderName from message */}
                                                </strong>
                                            )}
                                            {msg.text.startsWith('<Decryption') ? (<span style={{fontStyle: 'italic', opacity: 0.7}}>{msg.text}</span>) : (msg.text)}
                                            <span style={{fontSize: '0.7rem', opacity: 0.6, display: 'block', textAlign: 'right', marginTop: '4px'}}>
                                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                             {/* --- Moderation Notice Display --- */}
                            {moderationNotice && (
                                <Alert variant="danger" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', marginBottom: '10px' }}>
                                    {moderationNotice}
                                </Alert>
                            )}


                            {/* Input Area */}
                            <InputGroup className="mt-auto">
                                <Form.Control
                                    as="textarea"
                                    rows={1}
                                    style={{ resize: 'none', overflowY: 'auto', maxHeight: '100px', fontSize: '0.95rem' }}
                                    placeholder={isConnecting ? "Connecting..." : (status.includes("Finding") || status.includes("Waiting") || status.includes("disconnected") ? "Waiting for partner..." : "Type message...")}
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyDown={handleKeyPress}
                                    disabled={isConnecting || status.includes("Finding") || status.includes("Waiting") || status.includes("disconnected")} // Simplified disabled logic
                                />
                                <Button variant="primary" onClick={sendMessage} disabled={isConnecting || !newMessage.trim() || status.includes("Finding") || status.includes("Waiting") || status.includes("disconnected")}>
                                    <FaPaperPlane />
                                </Button>
                                {/* Video call button can remain disabled */}
                                <Button variant="success" className="ms-2" onClick={startVideoCall} disabled={true}>
                                    <FaVideo />
                                </Button>
                            </InputGroup>
                            <div className="d-flex justify-content-between mt-2">
                                <Button variant="warning" size="sm" onClick={skipToNextUser} disabled={isConnecting || status.includes("Finding") || status.includes("Waiting") || status.includes("disconnected")}>Skip Partner</Button>
                                <Button variant="secondary" size="sm" onClick={goBackToHome}>Leave Chat</Button>
                            </div>
                        </Col>
                    </Row>
                )}
            </Container>
        </div>
    );
};

export default Chat;
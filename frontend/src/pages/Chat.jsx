import React, { useState, useEffect, useRef, useContext } from "react";
import { Container, Row, Col, Button, Form, InputGroup, Spinner } from "react-bootstrap";
import { FaPaperPlane, FaVideo } from "react-icons/fa";
import { ThemeContext } from "../components/ThemeContext";
import CryptoJS from 'crypto-js';

// --- Helper Function for Timestamp Logging ---
const logTimestamp = (label, ts) => {
    if (ts && typeof ts === 'number') {
        // console.log(`[Timestamp Log] ${label}: ${ts} (${new Date(ts).toISOString()})`);
    } else {
        console.warn(`[Timestamp Log] ${label}: Invalid or missing timestamp (${ts})`);
    }
};

// --- Client-Side Censoring Logic ---
const badWordsClient = [ // Keep this reasonably in sync with the server list
    "damn", "hell", "shit", "fuck", "fuk", "bitch", "asshole", "cunt",
    "dick", "pussy", "slut", "whore", "nigger", "nigga", "ass" // Added 'ass'
];
const badWordClientRegex = new RegExp(`\\b(${badWordsClient.join('|')})\\b`, 'gi');

function censorClientMessage(text) {
    if (!text || typeof text !== 'string') return text;
    // Reset lastIndex for global regex
    badWordClientRegex.lastIndex = 0;
    return text.replace(badWordClientRegex, (match) => '*'.repeat(match.length));
}
// --- End Censoring Logic ---

const Chat = () => {
    const { theme, selfDestructEnabled, destructTime, customTime } = useContext(ThemeContext);
    // console.log(`[Chat Render] Context: Enabled=${selfDestructEnabled}, Time=${destructTime}, Custom=${customTime}`);

    const [name, setName] = useState("");
    const [sessionID] = useState(() => Math.random().toString(36).substring(2));
    const [chatStarted, setChatStarted] = useState(false);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [userMap, setUserMap] = useState({}); // Maps userID to username
    const [status, setStatus] = useState("Connecting you with a partner...");
    const [isConnecting, setIsConnecting] = useState(false);
    // Mute state removed as per requirement
    const [pendingMessages, setPendingMessages] = useState([]); // Queue for messages awaiting key
    const userIDRef = useRef(null);
    const chatContainerRef = useRef(null);
    const socketRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const encryptionKeyRef = useRef(null); // Stores the 64-char hex key
    const intervalIdRef = useRef(null); // For self-destruct interval

    // --- Debug Effect for destructTime Changes ---
    useEffect(() => {
        // console.log(`[Chat Context Debug] destructTime changed to: ${destructTime}`);
        if (selfDestructEnabled && chatStarted) {
            // console.log(`[Chat Context Debug] Running immediate cleanup due to destructTime change: ${destructTime}`);
            setMessages(currentMessages => cleanupOldMessages(currentMessages, destructTime, customTime));
        }
    }, [destructTime, selfDestructEnabled, chatStarted, customTime]);

    // --- Effects (WebSocket, Scroll) ---
    useEffect(() => {
        // console.log("[Effect Main] Running. chatStarted:", chatStarted);
        if (chatStarted) {
            connectWebSocket();
        }
        // Cleanup function
        return () => {
            // console.log("[Effect Main] Cleanup: Disconnecting WS & clearing interval ref:", intervalIdRef.current);
            disconnectWebSocket();
            if (intervalIdRef.current) {
                clearInterval(intervalIdRef.current);
                intervalIdRef.current = null;
                // console.log("[Effect Main Cleanup] Cleared self-destruct interval.");
            }
        };
    }, [chatStarted]); // Re-run only if chatStarted changes

    useEffect(() => {
        // Auto-scroll to bottom
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
        }
    }, [messages]); // Re-run when messages change

    // --- WebSocket Functions ---
    const connectWebSocket = () => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            console.log("WebSocket already connected.");
            return;
        }
        if (isConnecting) {
            console.log("WebSocket connection attempt already in progress.");
            return;
        }

        setStatus("Connecting to chat server...");
        setIsConnecting(true);
        // Use wss://textanon.onrender.com for production, or ws://localhost:8080 for local testing
        const wsUrl = process.env.NODE_ENV === 'production'
            ? "wss://textanon.onrender.com"
            : "ws://localhost:8080";
        console.log(`WebSocket connecting to: ${wsUrl}`);
        socketRef.current = new WebSocket(wsUrl);

        socketRef.current.onopen = () => {
            console.log("WebSocket onopen: Connected to WebSocket Server");
            setIsConnecting(false);
            setStatus("Registering with server...");
            socketRef.current.send(JSON.stringify({
                type: "register",
                name,
                sessionID,
            }));
            clearTimeout(reconnectTimeoutRef.current);
        };

        socketRef.current.onmessage = async (event) => {
            try {
                const received = event.data instanceof Blob
                    ? JSON.parse(await event.data.text())
                    : JSON.parse(event.data);
                handleMessage(received);
            } catch (err) {
                console.error("Error parsing WebSocket message:", err, "Data:", event.data);
                setStatus("Error processing message.");
            }
        };

        socketRef.current.onerror = (err) => {
            console.error("WebSocket onerror: WebSocket error:", err);
            setIsConnecting(false);
        };

        socketRef.current.onclose = (event) => {
            console.log(`WebSocket onclose: WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);
            setIsConnecting(false);
            const wasConnected = !!userIDRef.current; // Check if we were actually connected before closing
            socketRef.current = null;
            if (event.code !== 1000 && chatStarted && wasConnected) { // Only auto-reconnect if closed unexpectedly after connection established
                setStatus("Disconnected. Attempting to reconnect...");
                reconnectWebSocket();
            } else if (chatStarted && !wasConnected) { // If closed before fully connecting (e.g., server unavailable)
                setStatus("Connection failed. Please try again later or check nickname.");
                // Optionally reset chatStarted to show nickname screen again after a delay
                // setTimeout(() => setChatStarted(false), 5000);
            }
             else {
                setStatus("Disconnected from chat server.");
            }
        };
    };

    const reconnectWebSocket = () => {
        if (!chatStarted) return;
        console.log("Attempting WebSocket reconnection in 3 seconds...");
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
            if (chatStarted && (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED)) {
                connectWebSocket();
            }
        }, 3000);
    };

    const disconnectWebSocket = () => {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
        if (socketRef.current) {
            console.log("Disconnecting WebSocket explicitly.");
            socketRef.current.close(1000, "User disconnected");
            socketRef.current = null;
        }
        setIsConnecting(false);
    };

    // --- Message Handling ---
    const handleMessage = (received) => {
        // console.log("Received WS message:", received);
        switch (received.type) {
            case "userID": handleUserIDMessage(received); break;
            case "chat": handleChatMessage(received); break;
            case "systemMessage": handleSystemMessage(received); break;
            case "chatEnded": handleChatEndedMessage(received); break;
            case "encryptionKey": handleEncryptionKeyMessage(received); break;
            case "partnerConnected": handlePartnerConnectedMessage(received); break;
            // Removed moderationWarning and mute handlers as mute is removed
            default: console.warn("Unknown msg type:", received.type, received);
        }
    };

    const handleUserIDMessage = (received) => {
        userIDRef.current = received.userID;
        console.log("Assigned UserID:", received.userID);
        setStatus("Waiting for partner...");
    };

    const handlePartnerConnectedMessage = (received) => {
        console.log("Partner connected:", received.partnerID, "Name:", received.partnerName);
        if (received.partnerName && received.partnerID) {
             setUserMap(prev => ({ ...prev, [received.partnerID]: received.partnerName }));
        }
        // Status update will likely come with the encryption key or system message
        // setStatus(`Connected with ${received.partnerName || 'Partner'}! Say hi.`);
    };

    const handleChatMessage = (received) => {
        if (!encryptionKeyRef.current) {
            console.warn("ChatMsg: No encryption key yet, queuing message from", received.senderID);
            setPendingMessages((prev) => [...prev, received]);
            return;
        }
        if (!received.senderID || !received.text) {
            console.warn("ChatMsg: Received incomplete message", received);
            return;
        }

        // Update user map if partner name changes or wasn't known
        if (received.senderID !== userIDRef.current && received.senderName && (!userMap[received.senderID] || userMap[received.senderID] !== received.senderName)) {
            setUserMap((prev) => ({ ...prev, [received.senderID]: received.senderName }));
        }
         // Update status if receiving first message from partner
        const partnerName = userMap[received.senderID] || received.senderName || 'Partner';
        if (received.senderID !== userIDRef.current && (status.includes("Waiting") || status.includes("Connected! Say hi."))) {
             setStatus(`Chatting with ${partnerName}`);
        }


        let decryptedText;
        try {
            if (typeof received.text !== 'string' || received.text.length === 0) {
                throw new Error("Invalid ciphertext: empty or not a string");
            }

            let encryptedBytes = CryptoJS.enc.Base64.parse(received.text);
            if (encryptedBytes.sigBytes < 32) {
                throw new Error(`Ciphertext too short: got ${encryptedBytes.sigBytes} bytes, expected at least 32`);
            }

            const iv = encryptedBytes.clone();
            iv.sigBytes = 16;
            iv.clamp();

            const ciphertext = encryptedBytes.clone();
            ciphertext.words.splice(0, 4);
            ciphertext.sigBytes -= 16;

            if (ciphertext.sigBytes === 0) {
                throw new Error("No ciphertext data after IV");
            }
            if (!/^[0-9a-fA-F]{64}$/.test(encryptionKeyRef.current)) {
                throw new Error(`Invalid key format on client`);
            }

            const keyWordArray = CryptoJS.enc.Hex.parse(encryptionKeyRef.current);
            const decrypted = CryptoJS.AES.decrypt(
                { ciphertext: ciphertext },
                keyWordArray,
                { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
            );
            decryptedText = decrypted.toString(CryptoJS.enc.Utf8);

            if (!decryptedText && ciphertext.sigBytes > 0) {
                // Attempt to decode as latin1 as a fallback if utf8 fails (less likely needed with proper server padding)
                try {
                    decryptedText = decrypted.toString(CryptoJS.enc.Latin1);
                    if (decryptedText) console.warn("Decrypted as Latin1 after Utf8 failed.");
                    else throw new Error("Decryption produced empty result (possible padding or key mismatch)");
                } catch (latinError) {
                     throw new Error("Decryption produced empty result (possible padding or key mismatch)");
                }
            }
            // console.log(`Decrypt Success: Decrypted="${decryptedText.substring(0, 30)}..."`);

        } catch (e) {
            decryptedText = `<Decryption Failed: ${e.message}>`;
            console.error(`Client Decrypt Error: ${e.message}, Ciphertext="${received.text.substring(0, 20)}..."`, "Key:", encryptionKeyRef.current?.substring(0,8)+"...");
        }

        const serverTimestamp = received.timestamp;
        const messageId = received.id || `${received.senderID}-${serverTimestamp || Date.now()}`;
        const newMessageData = {
            id: messageId,
            senderID: received.senderID,
            senderName: partnerName, // Use resolved name
            text: decryptedText, // This is the decrypted text received from partner
            timestamp: serverTimestamp || Date.now()
        };
        logTimestamp(`handleChatMessage - Storing received message "${newMessageData.text.substring(0,10)}..."`, newMessageData.timestamp);

        setMessages((prev) => {
            if (prev.some(msg => msg.id === newMessageData.id)) {
                return prev; // Avoid duplicates
            }
            const cleaned = selfDestructEnabled ? cleanupOldMessages(prev, destructTime, customTime) : prev;
            return [...cleaned, newMessageData];
        });
    };

    const handleSystemMessage = (received) => {
        const systemMsgId = `system-${Date.now()}`;
        console.log("System Msg:", received.text);
        // Avoid overwriting specific statuses like 'Chatting with X' with generic messages
        if (received.text.includes("connected") || received.text.includes("Finding") || received.text.includes("Waiting") || received.text.includes("Disconnected") || received.text.includes("Error")) {
             setStatus(received.text);
        }
        setMessages((prev) => [...prev, {
            id: systemMsgId,
            senderID: "system",
            senderName: "System",
            text: received.text,
            timestamp: Date.now()
        }]);
    };

    const handleChatEndedMessage = () => {
        console.log("Chat ended (partner disconnected or skipped).");
        const currentPartnerId = Object.keys(userMap).find(id => id !== userIDRef.current && id !== 'system');
        const statusMsg = `Partner (${userMap[currentPartnerId] || 'Partner'}) disconnected. Finding new partner...`;
        setStatus(statusMsg);
        // Add a system message confirming disconnect
        setMessages((prev) => [...prev, {
            id: `system-ended-${Date.now()}`,
            senderID: "system",
            senderName: "System",
            text: `Partner (${userMap[currentPartnerId] || 'Partner'}) has left the chat.`,
            timestamp: Date.now()
        }]);

        setUserMap(prev => { // Keep own user mapping if needed, clear others
            const newMap = {};
            if (userIDRef.current && prev[userIDRef.current]) {
                newMap[userIDRef.current] = prev[userIDRef.current];
            }
            return newMap;
        });
        encryptionKeyRef.current = null;
        setPendingMessages([]);
        console.log("Encryption key cleared due to chat end.");
    };

    const handleEncryptionKeyMessage = (received) => {
        if (received.key && typeof received.key === 'string' && /^[0-9a-fA-F]{64}$/.test(received.key)) {
            encryptionKeyRef.current = received.key;
            console.log("Received and set shared encryption key:", received.key.substring(0, 8) + "...");

            // Update status now that connection is secure
            const partnerId = Object.keys(userMap).find(id => id !== userIDRef.current && id !== 'system');
            const partnerName = userMap[partnerId] || 'Partner';
            setStatus(`Chatting with ${partnerName}`);


            if (pendingMessages.length > 0) {
                console.log(`Processing ${pendingMessages.length} pending messages now key is received.`);
                const messagesToProcess = [...pendingMessages];
                setPendingMessages([]);
                messagesToProcess.forEach(msg => handleChatMessage(msg)); // Re-process with key
            }
        } else {
            console.error("Received invalid or empty encryption key message:", received);
            setStatus("Error: Could not establish secure connection (Invalid Key).");
            // Maybe disconnect or skip?
            skipToNextUser(); // Attempt to get a new partner/key
        }
    };

    // --- Actions ---
    const startChat = () => {
        if (name.trim()) {
            setChatStarted(true);
        } else {
            setStatus("Please enter a nickname to start.");
        }
    };

    const sendMessage = () => {
        const messageToSend = newMessage.trim(); // Use trimmed version
        if (!messageToSend) return; // Don't send empty messages

        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
            setStatus("Error: Not connected to server.");
            reconnectWebSocket();
            return;
        }
        if (!encryptionKeyRef.current) {
            setStatus("Error: Secure connection not ready.");
            return;
        }
        // Mute check removed
        if (!userIDRef.current) {
             setStatus("Error: User ID not assigned.");
             return;
        }

        let encryptedBase64;
        try {
            if (!/^[0-9a-fA-F]{64}$/.test(encryptionKeyRef.current)) {
                throw new Error(`Invalid key format for encryption`);
            }
            const keyWordArray = CryptoJS.enc.Hex.parse(encryptionKeyRef.current);
            const iv = CryptoJS.lib.WordArray.random(16);
            const encryptedData = CryptoJS.AES.encrypt(
                messageToSend, // Encrypt the original trimmed message
                keyWordArray,
                { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
            );

            if (!encryptedData.ciphertext || encryptedData.ciphertext.sigBytes === 0) {
                throw new Error("Encryption produced empty ciphertext");
            }
            const combined = iv.concat(encryptedData.ciphertext);
            encryptedBase64 = CryptoJS.enc.Base64.stringify(combined);

            if (!encryptedBase64) {
                 throw new Error("Base64 encoding failed");
            }
            const byteLength = CryptoJS.enc.Base64.parse(encryptedBase64).sigBytes;
            if (byteLength < 32) {
                 throw new Error(`Encrypted output too short: got ${byteLength} bytes`);
            }
            // console.log(`Encrypt Success: OutputB64="${encryptedBase64.substring(0, 20)}...", OriginalText="${messageToSend.substring(0, 10)}..."`);

        } catch (e) {
            console.error(`Client Encrypt Error: ${e.message}`);
            setStatus("Encryption error. Message not sent.");
            return;
        }

        const timestamp = Date.now();
        const messageID = `${userIDRef.current}-${timestamp}`; // Unique ID

        // CENSOR the message text *before* adding it to the local state
        const censoredLocalText = censorClientMessage(messageToSend);

        // Prepare message for WebSocket (send encrypted original text)
        const messageDataWs = {
            type: "chat",
            senderID: userIDRef.current,
            senderName: name,
            text: encryptedBase64, // Send encrypted *original*
            timestamp: timestamp,
            id: messageID
        };
        socketRef.current.send(JSON.stringify(messageDataWs));

        // Prepare message for local display (use censored text)
        const localMessageData = {
            id: messageID,
            senderID: userIDRef.current,
            senderName: name,
            text: censoredLocalText, // Show censored version locally
            timestamp: timestamp
        };
        logTimestamp(`sendMessage - Storing local (censored) message "${localMessageData.text.substring(0,10)}..."`, localMessageData.timestamp);

        setMessages((prev) => {
            const cleaned = selfDestructEnabled ? cleanupOldMessages(prev, destructTime, customTime) : prev;
            return [...cleaned, localMessageData];
        });
        setNewMessage(""); // Clear input
    };

    const startVideoCall = () => alert("Video call functionality is not implemented.");

    const skipToNextUser = () => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            console.log("Sending skip request...");
            setStatus("Skipping... Finding new partner...");
            socketRef.current.send(JSON.stringify({ type: "skip" }));
            // Don't clear messages immediately, maybe add a system message?
             setMessages((prev) => [...prev, {
                id: `system-skip-${Date.now()}`,
                senderID: "system",
                senderName: "System",
                text: "You skipped the chat. Looking for someone new...",
                timestamp: Date.now()
            }]);

            setUserMap(prev => { // Clear partner from map
                 const newMap = {};
                 if (userIDRef.current && prev[userIDRef.current]) {
                     newMap[userIDRef.current] = prev[userIDRef.current];
                 }
                 return newMap;
             });
            encryptionKeyRef.current = null;
            setPendingMessages([]);
            // Mute state removed
            console.log("Encryption key cleared due to skip request.");
        } else {
            console.warn("Skip: WebSocket not open or not available.");
            setStatus("Cannot skip partner. Not connected.");
            reconnectWebSocket();
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const goBackToHome = () => {
        console.log("[Go Back] Leaving chat and disconnecting.");
        setChatStarted(false); // Triggers useEffect cleanup
        setName("");
        setMessages([]);
        setUserMap({});
        setStatus("Disconnected.");
        userIDRef.current = null;
        encryptionKeyRef.current = null;
        setPendingMessages([]);
        // Mute state removed
    };

    const handleNameSelectionKeyPress = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            startChat();
        }
    };

    // --- Mount/Unmount Log ---
    useEffect(() => {
        console.log('%c[Lifecycle] CHAT COMPONENT MOUNTED', 'background: #222; color: #bada55');
        return () => {
            console.log('%c[Lifecycle] CHAT COMPONENT UNMOUNTED', 'background: #222; color: #ff69b4');
            if (intervalIdRef.current) {
                clearInterval(intervalIdRef.current);
                intervalIdRef.current = null;
            }
            disconnectWebSocket();
        };
    }, []);

    // --- SELF-DESTRUCT UseEffect ---
    useEffect(() => {
        if (intervalIdRef.current) {
            clearInterval(intervalIdRef.current);
            intervalIdRef.current = null;
        }

        if (selfDestructEnabled && chatStarted) {
            setMessages(currentMessages => cleanupOldMessages(currentMessages, destructTime, customTime));

            let intervalMs = 10000;
             if (destructTime === "custom") {
                 const customSeconds = parseInt(customTime, 10);
                 if (!isNaN(customSeconds) && customSeconds < 60) {
                     intervalMs = Math.max(2000, customSeconds * 1000 / 3);
                 }
            } else if (destructTime === "30sec") intervalMs = 5000;
            else if (destructTime === "60sec") intervalMs = 10000;

            intervalIdRef.current = setInterval(() => {
                setMessages(currentMessages => cleanupOldMessages(currentMessages, destructTime, customTime));
            }, intervalMs);
            // console.log(`[Self-Destruct Effect] Set interval: ${intervalIdRef.current} (every ${intervalMs}ms)`);
        }

        return () => {
            if (intervalIdRef.current) {
                // console.log(`[Self-Destruct Effect Cleanup] Clearing interval: ${intervalIdRef.current}`);
                clearInterval(intervalIdRef.current);
                intervalIdRef.current = null;
            }
        };
    }, [selfDestructEnabled, destructTime, customTime, chatStarted]);

    // --- cleanupOldMessages Function ---
    const cleanupOldMessages = (currentMessages, currentDestructTime, currentCustomTime) => {
        if (!selfDestructEnabled || currentMessages.length === 0) {
            return currentMessages;
        }
        let destructionTimeMs;
        const defaultTimeMs = 300 * 1000;
        if (currentDestructTime === "custom") {
            const customSeconds = parseInt(currentCustomTime, 10);
            destructionTimeMs = (!isNaN(customSeconds) && customSeconds >= 10 && customSeconds <= 3600)
                ? customSeconds * 1000
                : defaultTimeMs;
        } else {
            const timeMap = {"30sec": 30*1000, "60sec": 60*1000, "120sec": 120*1000, "300sec": 300*1000, "600sec": 600*1000};
            destructionTimeMs = timeMap[currentDestructTime] || defaultTimeMs;
        }
        const now = Date.now();
        const filteredMessages = currentMessages.filter(msg => {
            if (!msg.timestamp || typeof msg.timestamp !== 'number' || msg.timestamp > now + 60000) { // Increased future skew tolerance
                 console.warn("[Self-Destruct Filter] Invalid or large future timestamp, keeping for now:", msg);
                return true; // Keep message if timestamp is invalid
            }
            return (now - msg.timestamp) < destructionTimeMs;
        });
        if (filteredMessages.length !== currentMessages.length) {
             console.log(`[Self-Destruct Cleanup] Removed ${currentMessages.length - filteredMessages.length} messages.`);
            return filteredMessages;
        }
        return currentMessages;
    };


    // --- JSX Structure (Restored Original) ---
    return (
        <div className="chat-page d-flex align-items-center justify-content-center" style={{ width: "100vw", minHeight: "100vh", backgroundColor: theme === "dark" ? "#121212" : "#f8f9fa", color: theme === "dark" ? "#ffffff" : "#333333", position: "relative", overflow: "hidden", transition: "background-color 0.3s ease, color 0.3s ease" }}>
            <Container>
                {!chatStarted ? (
                    // --- Nickname Selection Screen ---
                    <Row className="justify-content-center">
                        <Col md={6} lg={4}>
                            <div style={{ maxWidth: '400px', margin: '20px auto', padding: '20px', background: theme === 'dark' ? '#1e1e1e' : '#fff', borderRadius: '8px', boxShadow: theme === 'dark' ? '0 4px 8px rgba(255,255,255,0.1)' : '0 4px 8px rgba(0,0,0,0.1)' }}>
                                <h3 className="text-center mb-4">Enter Chat</h3>
                                <Form onSubmit={(e) => { e.preventDefault(); startChat(); }}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Nickname:</Form.Label>
                                        <Form.Control
                                            type="text"
                                            placeholder="Your nickname"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            onKeyDown={handleNameSelectionKeyPress}
                                            autoFocus
                                            maxLength={20}
                                         />
                                    </Form.Group>
                                    <div className="d-grid">
                                        <Button variant="primary" type="submit" disabled={!name.trim()}>Start Chat</Button>
                                    </div>
                                    {/* Show specific status messages */}
                                    {status && (status.startsWith('Please') || status.includes("failed") || status.includes("Disconnected")) && (
                                        <p className={`text-center mt-2 small ${status.startsWith('Please') || status.includes("failed") ? 'text-danger' : 'text-muted'}`}>{status}</p>
                                    )}
                                </Form>
                            </div>
                        </Col>
                    </Row>
                ) : (
                    // --- Main Chat Interface (Restored Original Layout) ---
                    <Row className="justify-content-center">
                        <Col md={8} lg={6} className="p-3 rounded d-flex flex-column" style={{ backgroundColor: theme === "dark" ? "#1e1e1e" : "#ffffff", color: theme === "dark" ? "#ffffff" : "#333333", border: theme === "dark" ? "1px solid #333" : "1px solid #ddd", boxShadow: theme === "dark" ? "0px 4px 15px rgba(0, 0, 0, 0.2)" : "0px 4px 15px rgba(0, 0, 0, 0.1)", transition: "background-color 0.3s ease, color 0.3s ease, border 0.3s ease", display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', minHeight: '450px', maxHeight: '85vh' }}>
                            {/* Header */}
                            <h2 className="text-center" style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Anonymous Chat</h2>
                            <p className="text-center mb-1" style={{fontSize: '0.9rem'}}>Nickname: <span style={{ fontWeight: 'bold' }}>{name}</span></p>

                            {/* Status Bar */}
                            <div className="text-center my-1">
                                <small style={{ fontStyle: "italic", fontSize: '0.85rem', opacity: 0.9 }}>{status}</small>
                                {isConnecting && <Spinner animation="border" size="sm" className="ms-2" variant={theme === 'dark' ? 'light' : 'primary'} />}
                            </div>

                            {/* Message Display Area */}
                            <div ref={chatContainerRef} className="chat-box p-3 rounded mt-2 flex-grow-1" style={{ overflowY: "auto", display: "flex", flexDirection: "column", backgroundColor: theme === "dark" ? "#2a2a2a" : "#f1f1f1", marginBottom: '10px', border: theme === 'dark' ? '1px solid #444' : '1px solid #eee' }}>
                                {messages.map((msg) => ( // Removed index key, using message ID
                                    <div key={msg.id} style={{ width: "fit-content", maxWidth: "80%", alignSelf: msg.senderID === userIDRef.current ? "flex-end" : (msg.senderID === 'system' ? 'center' : 'flex-start'), backgroundColor: msg.senderID === "system" ? (theme === 'dark' ? '#444' : '#eee') : msg.senderID === userIDRef.current ? (theme === 'dark' ? '#0b533f' : '#d1e7dd') : (theme === 'dark' ? '#0a4a8f' : '#cfe2ff'), color: msg.senderID === 'system' ? (theme==='dark'? '#ccc' : '#555') : (theme === 'dark' ? '#e0e0e0' : '#000'), padding: msg.senderID === "system" ? "6px 12px" : "8px 12px", borderRadius: msg.senderID === "system" ? "10px" : (msg.senderID === userIDRef.current ? "15px 5px 15px 15px" : "5px 15px 15px 15px"), marginBottom: "8px", fontSize: msg.senderID === 'system' ? '0.85rem' : '1rem', fontStyle: msg.senderID === 'system' ? 'italic' : 'normal', wordBreak: 'break-word', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: msg.senderID === 'system' ? 'none' : (theme === 'dark' ? '1px solid #444' : '1px solid #ccc'), textAlign: msg.senderID === 'system' ? 'center' : 'left', margin: msg.senderID === 'system' ? '5px auto' : '' }}>
                                        {/* Partner Name */}
                                        {msg.senderID !== userIDRef.current && msg.senderID !== "system" && (
                                            <strong style={{ display: 'block', marginBottom: '3px', fontSize: '0.75rem', opacity: 0.8, color: theme === 'dark' ? '#aaa' : '#555' }}>
                                                {/* Use userMap or fallback */}
                                                {userMap[msg.senderID] || msg.senderName || "Partner"}
                                            </strong>
                                        )}
                                        {/* Message Text */}
                                        {msg.text.startsWith('<Decryption') ? (
                                            <span style={{fontStyle: 'italic', opacity: 0.7, color: 'red'}}>{msg.text}</span>
                                        ) : (
                                            // Render normal text (consider link detection or markdown later if needed)
                                            msg.text
                                        )}
                                        {/* Timestamp */}
                                         {msg.senderID !== "system" && msg.timestamp && ( // Only show for non-system messages with valid timestamp
                                            <span style={{fontSize: '0.7rem', opacity: 0.6, display: 'block', textAlign: 'right', marginTop: '4px'}}>
                                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                         )}
                                    </div>
                                ))}
                                {/* Placeholder when no messages */}
                                {messages.length === 0 && !status.includes("Connecting") && (
                                     <div className="text-center text-muted mt-auto mb-auto">
                                         {status.includes("Waiting") ? "Waiting for partner..." : "No messages yet."}
                                     </div>
                                )}
                            </div>

                             {/* Input Area & Actions (Restored Original Layout) */}
                            <InputGroup className="mt-auto">
                                <Form.Control
                                    as="textarea"
                                    rows={1}
                                    style={{ resize: 'none', overflowY: 'auto', maxHeight: '100px' }}
                                    placeholder={
                                        isConnecting ? "Connecting..."
                                        // Mute placeholder removed
                                        : (!userIDRef.current || !encryptionKeyRef.current || status.includes("Finding") || status.includes("Waiting") || status.includes("Skipping")) ? "Waiting for secure connection..."
                                        : "Type message..."
                                    }
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyDown={handleKeyPress}
                                    disabled={isConnecting || !userIDRef.current || !encryptionKeyRef.current || status.includes("Finding") || status.includes("Waiting") || status.includes("Skipping") }
                                    aria-label="Message Input"
                                />
                                <Button
                                    variant="primary"
                                    onClick={sendMessage}
                                    disabled={isConnecting || !newMessage.trim() || !userIDRef.current || !encryptionKeyRef.current || status.includes("Finding") || status.includes("Waiting") || status.includes("Skipping")}
                                    aria-label="Send Message"
                                >
                                    <FaPaperPlane />
                                </Button>
                                {/* Disabled Video Button */}
                                <Button variant="success" className="ms-2" onClick={startVideoCall} disabled={true}>
                                    <FaVideo />
                                </Button>
                            </InputGroup>
                            <div className="d-flex justify-content-between mt-2">
                                <Button variant="warning" size="sm" onClick={skipToNextUser} disabled={isConnecting || !userIDRef.current || status.includes("Finding") || status.includes("Waiting") || status.includes("Skipping")}>
                                    Skip Partner
                                </Button>
                                <Button variant="secondary" size="sm" onClick={goBackToHome}>
                                    Leave Chat
                                </Button>
                            </div>
                        </Col>
                    </Row>
                )}
            </Container>
        </div>
    );
};

export default Chat;
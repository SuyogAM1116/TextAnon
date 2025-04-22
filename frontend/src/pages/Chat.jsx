import React, { useState, useEffect, useRef, useContext } from "react";
import { Container, Row, Col, Button, Form, InputGroup, Spinner } from "react-bootstrap";
import { FaPaperPlane, FaVideo } from "react-icons/fa";
import { ThemeContext } from "../components/ThemeContext";
import CryptoJS from 'crypto-js';

// --- Helper Function for Timestamp Logging ---
const logTimestamp = (label, ts) => {
    if (ts && typeof ts === 'number') {
        console.log(`[Timestamp Log] ${label}: ${ts} (${new Date(ts).toISOString()})`);
    } else {
        console.warn(`[Timestamp Log] ${label}: Invalid or missing timestamp (${ts})`);
    }
};

const Chat = () => {
    const { theme, selfDestructEnabled, destructTime, customTime } = useContext(ThemeContext);
    console.log(`[Chat Render] Context: Enabled=${selfDestructEnabled}, Time=${destructTime}, Custom=${customTime}`);

    const [name, setName] = useState("");
    const [sessionID] = useState(() => Math.random().toString(36).substring(2));
    const [chatStarted, setChatStarted] = useState(false);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [userMap, setUserMap] = useState({});
    const [status, setStatus] = useState("Connecting you with a partner...");
    const [isConnecting, setIsConnecting] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [pendingMessages, setPendingMessages] = useState([]); // Queue for messages awaiting key
    const userIDRef = useRef(null);
    const chatContainerRef = useRef(null);
    const socketRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const encryptionKeyRef = useRef(null);
    const intervalIdRef = useRef(null);

    // --- Debug Effect for destructTime Changes ---
    useEffect(() => {
        console.log(`[Chat Context Debug] destructTime changed to: ${destructTime}`);
        if (selfDestructEnabled && chatStarted) {
            console.log(`[Chat Context Debug] Running immediate cleanup due to destructTime change: ${destructTime}`);
            setMessages(currentMessages => cleanupOldMessages(currentMessages, destructTime, customTime));
        }
    }, [destructTime, selfDestructEnabled, chatStarted, customTime]);

    // --- Effects (WebSocket, Scroll) ---
    useEffect(() => {
        console.log("[Effect Main] Running. chatStarted:", chatStarted);
        if (chatStarted && !encryptionKeyRef.current) {
            // Generate 32-byte key as hex string
            const keyBytes = CryptoJS.lib.WordArray.random(32);
            encryptionKeyRef.current = keyBytes.toString(CryptoJS.enc.Hex);
            console.log("Generated Initial Encryption Key:", encryptionKeyRef.current.substring(0, 8) + "...");
        }
        if (chatStarted) connectWebSocket();
        return () => {
            console.log("[Effect Main] Cleanup: Disconnecting WS & clearing interval ref:", intervalIdRef.current);
            disconnectWebSocket();
            if (intervalIdRef.current) {
                clearInterval(intervalIdRef.current);
                intervalIdRef.current = null;
                console.log("[Effect Main Cleanup] Cleared self-destruct interval.");
            }
        };
    }, [chatStarted]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
        }
    }, [messages]);

    // --- WebSocket Functions ---
    const connectWebSocket = () => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            console.log("WebSocket already connected, skipping reconnection.");
            return;
        }

        setStatus("Connecting to chat server...");
        setIsConnecting(true);
        // Use wss://textanon.onrender.com for production, or ws://localhost:8080 for local testing
        socketRef.current = new WebSocket("wss://textanon.onrender.com");
        // socketRef.current = new WebSocket("ws://localhost:8080"); // Uncomment for local testing
        console.log("WebSocket connecting to: wss://textanon.onrender.com");

        socketRef.current.onopen = () => {
            console.log("WebSocket onopen: Connected to WebSocket Server");
            setIsConnecting(false);
            setStatus("Registering with server...");
            socketRef.current.send(JSON.stringify({
                type: "register",
                name,
                sessionID,
                encryptionKey: encryptionKeyRef.current
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
                console.error("Error parsing WebSocket message:", err);
                setStatus("Error processing message.");
            }
        };

        socketRef.current.onerror = (err) => {
            console.error("WebSocket onerror: WebSocket error:", err);
            setIsConnecting(false);
            setStatus("WebSocket connection error.");
            reconnectWebSocket();
        };

        socketRef.current.onclose = (event) => {
            console.log("WebSocket onclose: WebSocket closed", event);
            setIsConnecting(false);
            if (event.code !== 1000) {
                setStatus("Disconnected from chat server. Reconnecting...");
                reconnectWebSocket();
            } else {
                setStatus("Disconnected from chat server.");
            }
        };
    };

    const reconnectWebSocket = () => {
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
    };

    const disconnectWebSocket = () => {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
        if (socketRef.current) {
            if (socketRef.current.readyState === WebSocket.OPEN) socketRef.current.close(1000, "Disconnect");
            socketRef.current = null;
        }
        setIsConnecting(false);
    };

    // --- Message Handling ---
    const handleMessage = (received) => {
        switch (received.type) {
            case "userID": handleUserIDMessage(received); break;
            case "chat": handleChatMessage(received); break;
            case "chatHistory": handleChatHistoryMessage(received); break;
            case "systemMessage": handleSystemMessage(received); break;
            case "chatEnded": handleChatEndedMessage(received); break;
            case "encryptionKey": handleEncryptionKeyMessage(received); break;
            case "moderationWarning": handleModerationWarning(received); break;
            case "mute": handleMuteMessage(received); break;
            default: console.warn("Unknown msg type:", received.type, received);
        }
    };

    const handleUserIDMessage = (received) => {
        userIDRef.current = received.userID;
        console.log("UserID:", received.userID);
        setStatus("Finding partner...");
    };

    const handleChatMessage = (received) => {
        if (!encryptionKeyRef.current) {
            console.warn("ChatMsg: No key, queuing message");
            setPendingMessages((prev) => [...prev, received]);
            return;
        }
        if (received.senderID !== userIDRef.current && !status.startsWith("You are now connected")) {
            setStatus(`Connected with ${received.senderName || 'Partner'}`);
        }
        setUserMap((prev) => ({ ...prev, [received.senderID]: received.senderName }));
        let decryptedText;
        try {
            if (!received.text || typeof received.text !== 'string') {
                throw new Error("Invalid ciphertext: empty or not a string");
            }
            // Log raw input for debugging
            console.log(`Decrypting Input: Ciphertext="${received.text.substring(0, 20)}...", Length=${received.text.length}`);
            // Decode base64
            let encryptedBytes;
            try {
                encryptedBytes = CryptoJS.enc.Base64.parse(received.text);
            } catch (e) {
                throw new Error(`Invalid base64 encoding: ${e.message}`);
            }
            console.log(`Decrypting Decoded: ByteLength=${encryptedBytes.sigBytes}`);
            if (encryptedBytes.sigBytes < 16) {
                throw new Error(`Ciphertext too short: got ${encryptedBytes.sigBytes} bytes, expected at least 16`);
            }
            // Extract IV (first 16 bytes) and ciphertext
            const iv = encryptedBytes.clone();
            iv.sigBytes = 16;
            iv.clamp();
            const ciphertext = encryptedBytes.clone();
            ciphertext.words = ciphertext.words.slice(4); // Skip first 16 bytes (4 words)
            ciphertext.sigBytes -= 16;
            if (ciphertext.sigBytes === 0) {
                throw new Error("No ciphertext after IV");
            }
            // Validate key
            if (!/^[0-9a-fA-F]{64}$/.test(encryptionKeyRef.current)) {
                throw new Error(`Invalid key format: ${encryptionKeyRef.current}`);
            }
            console.log(
                `Decrypting: Key=${encryptionKeyRef.current.substring(0, 8)}..., ` +
                `IV=${iv.toString(CryptoJS.enc.Hex).substring(0, 8)}..., ` +
                `CiphertextLength=${ciphertext.sigBytes}`
            );
            // Decrypt
            const decrypted = CryptoJS.AES.decrypt(
                { ciphertext: ciphertext },
                CryptoJS.enc.Hex.parse(encryptionKeyRef.current),
                { iv: iv }
            );
            decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
            if (!decryptedText) {
                throw new Error("Decryption produced empty result");
            }
            console.log(`Decrypting Success: Decrypted="${decryptedText.substring(0, 10)}..."`);
        } catch (e) {
            decryptedText = `<Decryption Failed: ${e.message}>`;
            console.error(`Decrypt Error: ${e.message}, Ciphertext="${received.text.substring(0, 20)}..."`);
        }
        const serverTimestamp = received.timestamp;
        logTimestamp("handleChatMessage - Received server timestamp", serverTimestamp);
        const newMessageData = {
            senderID: received.senderID,
            senderName: received.senderName,
            text: decryptedText,
            timestamp: serverTimestamp || Date.now()
        };
        logTimestamp(`handleChatMessage - Storing message "${newMessageData.text.substring(0,10)}..."`, newMessageData.timestamp);
        setMessages((prev) => [...prev, newMessageData]);
    };

    const handleChatHistoryMessage = (received) => {
        if (!encryptionKeyRef.current) {
            console.error("History: No key");
            setStatus("History Error: No Key");
            setMessages([]);
            return;
        }
        console.log("Processing history...");
        const decrypted = received.messages.map(msg => {
            let dt;
            try {
                if (!msg.text || typeof msg.text !== 'string') {
                    throw new Error("Invalid ciphertext in history");
                }
                // Log raw input for debugging
                console.log(`History Decrypting Input: Ciphertext="${msg.text.substring(0, 20)}...", Length=${msg.text.length}`);
                // Decode base64
                let encryptedBytes;
                try {
                    encryptedBytes = CryptoJS.enc.Base64.parse(msg.text);
                } catch (e) {
                    throw new Error(`Invalid base64 encoding in history: ${e.message}`);
                }
                console.log(`History Decrypting Decoded: ByteLength=${encryptedBytes.sigBytes}`);
                if (encryptedBytes.sigBytes < 16) {
                    throw new Error(`History ciphertext too short: got ${encryptedBytes.sigBytes} bytes`);
                }
                // Extract IV and ciphertext
                const iv = encryptedBytes.clone();
                iv.sigBytes = 16;
                iv.clamp();
                const ciphertext = encryptedBytes.clone();
                ciphertext.words = ciphertext.words.slice(4);
                ciphertext.sigBytes -= 16;
                if (ciphertext.sigBytes === 0) {
                    throw new Error("No ciphertext after IV in history");
                }
                // Validate key
                if (!/^[0-9a-fA-F]{64}$/.test(encryptionKeyRef.current)) {
                    throw new Error(`Invalid key format in history: ${encryptionKeyRef.current}`);
                }
                console.log(
                    `History Decrypting: Key=${encryptionKeyRef.current.substring(0, 8)}..., ` +
                    `IV=${iv.toString(CryptoJS.enc.Hex).substring(0, 8)}..., ` +
                    `CiphertextLength=${ciphertext.sigBytes}`
                );
                // Decrypt
                const decrypted = CryptoJS.AES.decrypt(
                    { ciphertext: ciphertext },
                    CryptoJS.enc.Hex.parse(encryptionKeyRef.current),
                    { iv: iv }
                );
                dt = decrypted.toString(CryptoJS.enc.Utf8);
                if (!dt) {
                    throw new Error("History decryption produced empty result");
                }
                console.log(`History Decrypting Success: Decrypted="${dt.substring(0, 10)}..."`);
            } catch (e) {
                dt = `<Hist Decrypt Failed: ${e.message}>`;
                console.error(`History Decrypt Error: ${e.message}, Ciphertext="${msg.text.substring(0, 20)}..."`);
            }
            const ts = msg.timestamp || Date.now();
            logTimestamp(`History Msg "${dt.substring(0,10)}..."`, ts);
            return { ...msg, text: dt, timestamp: ts };
        });
        setMessages(decrypted);
        setUserMap(prev => {
            const um = {...prev};
            decrypted.forEach(m => { if (m.senderID && m.senderName) um[m.senderID] = m.senderName; });
            return um;
        });
        if (decrypted.length > 0) {
            const pMsg = decrypted.slice().reverse().find(m => m.senderID !== userIDRef.current);
            setStatus(pMsg ? `Connected with ${pMsg.senderName || 'Partner'}` : "Connected, waiting...");
        } else {
            setStatus("Connected, waiting...");
        }
        console.log("History processed.");
    };

    const handleSystemMessage = (received) => {
        setStatus(received.text);
        console.log("Sys Msg:", received.text);
        setMessages((prev) => [...prev, {
            senderID: "system",
            senderName: "System",
            text: received.text,
            timestamp: Date.now()
        }]);
    };

    const handleChatEndedMessage = () => {
        console.log("Partner disconnected.");
        setMessages([]);
        setUserMap({});
        setStatus("Partner disconnected. Finding partner...");
        encryptionKeyRef.current = null;
        setPendingMessages([]);
        setIsMuted(false);
        console.log("Key cleared (disconnect).");
    };

    const handleEncryptionKeyMessage = (received) => {
        if (received.key && typeof received.key === 'string' && /^[0-9a-fA-F]{64}$/.test(received.key)) {
            encryptionKeyRef.current = received.key;
            console.log("Received/Set Key:", received.key.substring(0, 8) + "...");
            // Process pending messages
            if (pendingMessages.length > 0) {
                console.log(`Processing ${pendingMessages.length} pending messages`);
                pendingMessages.forEach(msg => handleChatMessage(msg));
                setPendingMessages([]);
            }
        } else {
            console.warn("Received invalid or empty key msg:", received);
        }
    };

    const handleModerationWarning = (received) => {
        setStatus(received.text);
        console.log("Moderation Warning:", received.text);
        setMessages((prev) => [...prev, {
            senderID: "system",
            senderName: "System",
            text: received.text,
            timestamp: Date.now()
        }]);
    };

    const handleMuteMessage = (received) => {
        setIsMuted(true);
        setStatus(received.text);
        console.log("Mute:", received.text);
        setMessages((prev) => [...prev, {
            senderID: "system",
            senderName: "System",
            text: received.text,
            timestamp: Date.now()
        }]);
        setTimeout(() => {
            setIsMuted(false);
            setStatus("You can now send messages again.");
            setMessages((prev) => [...prev, {
                senderID: "system",
                senderName: "System",
                text: "You can now send messages again.",
                timestamp: Date.now()
            }]);
        }, received.duration || 300000); // Default 5 minutes
    };

    // --- Actions ---
    const startChat = () => {
        if (name.trim()) setChatStarted(true);
        else setStatus("Enter nickname.");
    };

    const sendMessage = () => {
        if (!newMessage.trim() || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN || !encryptionKeyRef.current || !userIDRef.current || isMuted) {
            if (isMuted) setStatus("You are muted and cannot send messages.");
            return;
        }
        let encrypted;
        try {
            // Validate key
            if (!/^[0-9a-fA-F]{64}$/.test(encryptionKeyRef.current)) {
                throw new Error(`Invalid key format: ${encryptionKeyRef.current}`);
            }
            // Validate message
            if (!newMessage || newMessage.trim() === "") {
                throw new Error("Message is empty");
            }
            // Generate random IV
            const iv = CryptoJS.lib.WordArray.random(16);
            // Encrypt with raw key
            const encryptedData = CryptoJS.AES.encrypt(
                newMessage,
                CryptoJS.enc.Hex.parse(encryptionKeyRef.current),
                { iv: iv }
            );
            // Validate ciphertext
            if (!encryptedData.ciphertext || encryptedData.ciphertext.sigBytes === 0) {
                throw new Error("Encryption produced empty ciphertext");
            }
            // Combine IV and ciphertext
            const combined = iv.concat(encryptedData.ciphertext);
            encrypted = CryptoJS.enc.Base64.stringify(combined);
            // Validate output length (IV: 16 bytes, Ciphertext: at least 16 bytes due to AES block size)
            const byteLength = CryptoJS.enc.Base64.parse(encrypted).sigBytes;
            if (byteLength < 32) {
                throw new Error(`Encrypted output too short: got ${byteLength} bytes, expected at least 32`);
            }
            console.log(
                `Encrypting Success: Key=${encryptionKeyRef.current.substring(0, 8)}..., ` +
                `IV=${iv.toString(CryptoJS.enc.Hex).substring(0, 8)}..., ` +
                `CiphertextLength=${encryptedData.ciphertext.sigBytes}, ` +
                `OutputLength=${byteLength}, ` +
                `Output="${encrypted.substring(0, 20)}...", ` +
                `Text="${newMessage.substring(0, 10)}..."`
            );
        } catch (e) {
            console.error(`Encrypt Error: ${e.message}`);
            setStatus("Encryption error. Please try again.");
            return;
        }
        const timestamp = Date.now();
        const messageData = {
            type: "chat",
            senderID: userIDRef.current,
            senderName: name,
            text: encrypted,
            timestamp: timestamp
        };
        socketRef.current.send(JSON.stringify(messageData));
        const localMessageData = {
            senderID: userIDRef.current,
            senderName: name,
            text: newMessage,
            timestamp: timestamp
        };
        logTimestamp(`sendMessage - Storing local message "${localMessageData.text.substring(0,10)}..."`, localMessageData.timestamp);
        setMessages((prev) => [...prev, localMessageData]);
        setNewMessage("");
    };

    const startVideoCall = () => alert("Video call not implemented.");

    const skipToNextUser = () => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: "skip" }));
            setMessages([]);
            setUserMap({});
            setStatus("Finding partner...");
            encryptionKeyRef.current = null;
            setPendingMessages([]);
            setIsMuted(false);
            console.log("Key cleared (skip).");
        } else {
            console.warn("Skip: WS not open.");
            setStatus("Cannot skip.");
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
        console.log("[Go Back] Leaving chat.");
        setChatStarted(false);
        setName("");
        setMessages([]);
        setUserMap({});
        setStatus("Disconnected.");
        userIDRef.current = null;
        encryptionKeyRef.current = null;
        setPendingMessages([]);
        setIsMuted(false);
        console.log("Key cleared (Go Back).");
    };

    const handleNameSelectionKeyPress = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            startChat();
        }
    };

    // --- Mount/Unmount Log ---
    useEffect(() => {
        console.log('%cCHAT COMPONENT MOUNTED', 'background: #222; color: #bada55');
        return () => {
            console.log('%cCHAT COMPONENT UNMOUNTED', 'background: #222; color: #ff69b4');
            if (intervalIdRef.current) {
                console.log('[Unmount Cleanup] Clearing interval ID:', intervalIdRef.current);
                clearInterval(intervalIdRef.current);
                intervalIdRef.current = null;
            }
        };
    }, []);

    // --- SELF-DESTRUCT UseEffect ---
    useEffect(() => {
        console.log(`[Self-Destruct Effect] Running: Enabled=${selfDestructEnabled}, Time=${destructTime}, Custom=${customTime}, ChatStarted=${chatStarted}`);
        
        // Clear existing interval
        if (intervalIdRef.current) {
            console.log(`[Self-Destruct Effect] Clearing existing interval: ${intervalIdRef.current}`);
            clearInterval(intervalIdRef.current);
            intervalIdRef.current = null;
        }

        // Run immediate cleanup if enabled and chat is started
        if (selfDestructEnabled && chatStarted) {
            console.log(`[Self-Destruct Effect] Running immediate cleanup with Time=${destructTime}`);
            setMessages(currentMessages => cleanupOldMessages(currentMessages, destructTime, customTime));
        }

        // Set interval for periodic cleanup
        if (selfDestructEnabled && chatStarted) {
            const intervalMs = destructTime === "30sec" ? 2000 : (destructTime === "60sec" ? 5000 : 10000);
            intervalIdRef.current = setInterval(() => {
                console.log(`[Self-Destruct Timer] Cleaning up messages with Time=${destructTime}`);
                setMessages(currentMessages => cleanupOldMessages(currentMessages, destructTime, customTime));
            }, intervalMs);
            console.log(`[Self-Destruct Effect] Set interval: ${intervalIdRef.current} (every ${intervalMs}ms)`);
        }

        return () => {
            if (intervalIdRef.current) {
                console.log(`[Self-Destruct Effect Cleanup] Clearing interval: ${intervalIdRef.current}`);
                clearInterval(intervalIdRef.current);
                intervalIdRef.current = null;
            }
        };
    }, [selfDestructEnabled, destructTime, customTime, chatStarted]);

    // --- cleanupOldMessages Function ---
    const cleanupOldMessages = (currentMessages, currentDestructTime, currentCustomTime) => {
        console.log(`[Self-Destruct Cleanup] Processing ${currentMessages.length} messages. Time=${currentDestructTime}, Custom=${currentCustomTime}`);
        let destructionTimeMs;
        const defaultTimeMs = 300 * 1000; // 5 minutes
        const maxTimeSkew = 10 * 60 * 1000; // 10 minutes

        // Determine destruction time
        if (currentDestructTime === "custom") {
            const customSeconds = parseInt(currentCustomTime, 10);
            if (isNaN(customSeconds) || customSeconds < 10 || customSeconds > 3600) {
                console.warn(`[Self-Destruct Cleanup] Invalid custom time "${currentCustomTime}", using default.`);
                destructionTimeMs = defaultTimeMs;
            } else {
                destructionTimeMs = customSeconds * 1000;
            }
        } else {
            switch (currentDestructTime) {
                case "30sec": destructionTimeMs = 30 * 1000; break;
                case "60sec": destructionTimeMs = 60 * 1000; break;
                case "120sec": destructionTimeMs = 120 * 1000; break;
                case "300sec": destructionTimeMs = 300 * 1000; break;
                case "600sec": destructionTimeMs = 600 * 1000; break;
                default:
                    console.warn(`[Self-Destruct Cleanup] Unknown time setting "${currentDestructTime}", using default.`);
                    destructionTimeMs = defaultTimeMs;
            }
        }

        const now = Date.now();
        console.log(`[Self-Destruct Cleanup] Now=${now}, ThresholdMs=${destructionTimeMs}`);

        if (currentMessages.length === 0) {
            console.log("[Self-Destruct Cleanup] No messages to check.");
            return currentMessages;
        }

        let removedCount = 0;
        const newMessages = currentMessages.filter(msg => {
            if (!msg.timestamp || typeof msg.timestamp !== 'number') {
                console.warn("[Self-Destruct Filter] Invalid timestamp, removing:", msg);
                return false;
            }
            if (Math.abs(now - msg.timestamp) > maxTimeSkew) {
                console.warn("[Self-Destruct Filter] Out-of-range timestamp, removing:", msg);
                return false;
            }
            const age = now - msg.timestamp;
            const keep = age < destructionTimeMs;
            console.log(`[Self-Destruct Filter] Msg: "${msg.text.substring(0,10)}..." | TS: ${msg.timestamp} | Age: ${age}ms | Keep: ${keep}`);
            if (!keep) removedCount++;
            return keep;
        });

        console.log(`[Self-Destruct Cleanup] Kept ${newMessages.length} of ${currentMessages.length}. Removed: ${removedCount}`);
        return newMessages;
    };

    // --- JSX Structure ---
    return (
        <div className="chat-page d-flex align-items-center justify-content-center" style={{ width: "100vw", minHeight: "100vh", backgroundColor: theme === "dark" ? "#121212" : "#f8f9fa", color: theme === "dark" ? "#ffffff" : "#333333", position: "relative", overflow: "hidden", transition: "background-color 0.3s ease, color 0.3s ease" }}>
            <Container>
                {!chatStarted ? (
                    <Row className="justify-content-center">
                        <Col md={6} lg={4}>
                            <div style={{ maxWidth: '400px', margin: '20px auto', padding: '20px', background: theme === 'dark' ? '#1e1e1e' : '#fff', borderRadius: '8px', boxShadow: theme === 'dark' ? '0 4px 8px rgba(255,255,255,0.1)' : '0 4px 8px rgba(0,0,0,0.1)' }}>
                                <h3 className="text-center mb-4">Enter Chat</h3>
                                <Form>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Nickname:</Form.Label>
                                        <Form.Control type="text" placeholder="Your nickname" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={handleNameSelectionKeyPress} autoFocus />
                                    </Form.Group>
                                    <div className="d-grid">
                                        <Button variant="primary" onClick={startChat} disabled={!name.trim()}>Start Chat</Button>
                                    </div>
                                    {status && status !== "Connecting..." && status !== "Disconnected." && !status.startsWith("Finding") && !status.startsWith("Connected") && (
                                        <p className={`text-center mt-2 small ${status.startsWith('Enter') ? 'text-danger' : 'text-muted'}`}>{status}</p>
                                    )}
                                </Form>
                            </div>
                        </Col>
                    </Row>
                ) : (
                    <Row className="justify-content-center">
                        <Col md={8} lg={6} className="p-3 rounded d-flex flex-column" style={{ backgroundColor: theme === "dark" ? "#1e1e1e" : "#ffffff", color: theme === "dark" ? "#ffffff" : "#333333", border: theme === "dark" ? "1px solid #333" : "1px solid #ddd", boxShadow: theme === "dark" ? "0px 4px 15px rgba(0, 0, 0, 0.2)" : "0px 4px 15px rgba(0, 0, 0, 0.1)", transition: "background-color 0.3s ease, color 0.3s ease, border 0.3s ease", display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', minHeight: '450px', maxHeight: '85vh' }}>
                            <h2 className="text-center" style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Anonymous Chat</h2>
                            <p className="text-center mb-1" style={{fontSize: '0.9rem'}}>Nickname: <span style={{ fontWeight: 'bold' }}>{name}</span></p>
                            <div className="text-center my-1">
                                <small style={{ fontStyle: "italic", fontSize: '0.85rem', opacity: 0.9 }}>{status}</small>
                                {isConnecting && <Spinner animation="border" size="sm" className="ms-2" />}
                            </div>
                            <div ref={chatContainerRef} className="chat-box p-3 rounded mt-2 flex-grow-1" style={{ overflowY: "auto", display: "flex", flexDirection: "column", backgroundColor: theme === "dark" ? "#2a2a2a" : "#f1f1f1", marginBottom: '10px', border: theme === 'dark' ? '1px solid #444' : '1px solid #eee' }}>
                                {messages.map((msg, index) => (
                                    <div key={index} style={{ width: "fit-content", maxWidth: "80%", alignSelf: msg.senderID === userIDRef.current || msg.senderID === "system" ? "flex-end" : "flex-start", backgroundColor: msg.senderID === "system" ? (theme === 'dark' ? '#444' : '#eee') : msg.senderID === userIDRef.current ? (theme === 'dark' ? '#0b533f' : '#d1e7dd') : (theme === 'dark' ? '#0a4a8f' : '#cfe2ff'), color: theme === 'dark' ? '#e0e0e0' : '#000', padding: "8px 12px", borderRadius: msg.senderID === userIDRef.current || msg.senderID === "system" ? "15px 15px 5px 15px" : "15px 15px 15px 5px", marginBottom: "8px", fontSize: "1rem", wordBreak: 'break-word', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: theme === 'dark' ? '1px solid #444' : '1px solid #ccc' }}>
                                        {msg.senderID !== userIDRef.current && msg.senderID !== "system" && (
                                            <strong style={{ display: 'block', marginBottom: '3px', fontSize: '0.75rem', opacity: 0.8, color: theme === 'dark' ? '#aaa' : '#555' }}>
                                                {msg.senderName || userMap[msg.senderID] || "Partner"}
                                            </strong>
                                        )}
                                        {msg.text.startsWith('<Decryption') ? (
                                            <span style={{fontStyle: 'italic', opacity: 0.7}}>{msg.text}</span>
                                        ) : (
                                            msg.text
                                        )}
                                        <span style={{fontSize: '0.7rem', opacity: 0.6, display: 'block', textAlign: 'right', marginTop: '4px'}}>
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                ))}
                                {status.startsWith("Partner disconnected") && (
                                    <div className="system-message text-center align-self-center" style={{ width: "fit-content", maxWidth: "90%", backgroundColor: theme === "dark" ? "#444" : "#eee", color: theme === "dark" ? "#ccc" : "#555", padding: "6px 12px", borderRadius: "8px", margin: "10px auto", fontSize: "13px", fontStyle: "italic" }}>
                                        {status}
                                    </div>
                                )}
                            </div>
                            <InputGroup className="mt-auto">
                                <Form.Control
                                    as="textarea"
                                    rows={1}
                                    style={{ resize: 'none', overflowY: 'auto', maxHeight: '100px' }}
                                    placeholder={isConnecting ? "Connecting..." : isMuted ? "You are muted..." : (!userIDRef.current || !encryptionKeyRef.current || status.includes("Finding") ? "Waiting..." : "Type message...")}
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyDown={handleKeyPress}
                                    disabled={isConnecting || !userIDRef.current || !encryptionKeyRef.current || status.includes("Finding") || isMuted}
                                />
                                <Button variant="primary" onClick={sendMessage} disabled={isConnecting || !newMessage.trim() || !userIDRef.current || !encryptionKeyRef.current || status.includes("Finding") || isMuted}>
                                    <FaPaperPlane />
                                </Button>
                                <Button variant="success" className="ms-2" onClick={startVideoCall} disabled={true}>
                                    <FaVideo />
                                </Button>
                            </InputGroup>
                            <div className="d-flex justify-content-between mt-2">
                                <Button variant="warning" size="sm" onClick={skipToNextUser} disabled={isConnecting || !userIDRef.current || status.includes("Finding")}>
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
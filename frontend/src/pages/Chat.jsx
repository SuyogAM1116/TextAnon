import React, { useState, useEffect, useRef, useContext } from "react";
import { Container, Row, Col, Button, Form, InputGroup, Spinner } from "react-bootstrap";
import { FaPaperPlane, FaVideo } from "react-icons/fa";
import { ThemeContext } from "../components/ThemeContext";
import CryptoJS from 'crypto-js';

const Chat = () => {
    const { theme, selfDestructEnabled, destructTime, customTime } = useContext(ThemeContext);
    const [name, setName] = useState("");
    const [sessionID] = useState(() => Math.random().toString(36).substring(2));
    const [chatStarted, setChatStarted] = useState(false);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [userMap, setUserMap] = useState({});
    const [status, setStatus] = useState("Connecting you with a partner...");
    const [isConnecting, setIsConnecting] = useState(false);
    const userIDRef = useRef(null);
    const chatContainerRef = useRef(null);
    const socketRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const encryptionKeyRef = useRef(null);

    useEffect(() => {
        if (!encryptionKeyRef.current) {
            encryptionKeyRef.current = CryptoJS.lib.WordArray.random(32).toString();
            console.log("Generated Initial Encryption Key (User 1):", encryptionKeyRef.current.substring(0, 10) + "...");
        } else {
            console.log("Encryption Key already set (User 2 received key):", encryptionKeyRef.current.substring(0, 10) + "...");
        }

        if (chatStarted) {
            connectWebSocket();
        }
        return () => disconnectWebSocket();
    }, [chatStarted]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({
                top: chatContainerRef.current.scrollHeight,
                behavior: "smooth",
            });
        }
    }, [messages]);

    const connectWebSocket = () => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            console.log("WebSocket already connected, skipping reconnection.");
            return;
        }

        setStatus("Connecting to chat server...");
        setIsConnecting(true);
        socketRef.current = new WebSocket("ws://localhost:8080");
        console.log("WebSocket connecting to: ws://localhost:8080");

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
        reconnectTimeoutRef.current = setTimeout(() => {
            console.log("Attempting to reconnect WebSocket...");
            connectWebSocket();
        }, 3000);
    };

    const disconnectWebSocket = () => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.close(1000, "User initiated disconnect");
            console.log("WebSocket disconnected programmatically.");
        }
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        setIsConnecting(false);
    };

    const handleMessage = (received) => {
        switch (received.type) {
            case "userID":
                handleUserIDMessage(received);
                break;
            case "chat":
                handleChatMessage(received);
                break;
            case "chatHistory":
                handleChatHistoryMessage(received);
                break;
            case "systemMessage":
                handleSystemMessage(received);
                break;
            case "chatEnded":
                handleChatEndedMessage(received);
                break;
            case "encryptionKey":
                handleEncryptionKeyMessage(received);
                break;
            default:
                console.warn("Unknown message type:", received.type);
        }
    };

    const handleUserIDMessage = (received) => {
        userIDRef.current = received.userID;
        console.log("Received userID from server:", received.userID);
        setStatus("Finding a partner...");
    };

    const handleChatMessage = (received) => {
        if (received.senderID !== userIDRef.current) {
            setStatus(`You are now connected with ${received.senderName}`);
        }

        setUserMap((prev) => ({
            ...prev,
            [received.senderID]: received.senderName,
        }));

        console.log("Received encrypted message:", received.text);
        console.log("Attempting decryption with key:", encryptionKeyRef.current.substring(0, 10) + "...");

        let decryptedText;
        try {
            const bytes = CryptoJS.AES.decrypt(received.text, encryptionKeyRef.current);
            decryptedText = bytes.toString(CryptoJS.enc.Utf8);
            if (!decryptedText) {
                decryptedText = "<Message decryption failed>";
                console.warn("Decryption failed for message:", received.text);
            } else {
                console.log("Successfully decrypted message:", decryptedText);
            }
        } catch (e) {
            console.error("Decryption error:", e);
            decryptedText = "<Message decryption error>";
        }

        setMessages((prev) => {
            const updatedMessages = [...prev, {
                senderID: received.senderID,
                senderName: received.senderName,
                text: decryptedText,
                timestamp: Date.now() // Add timestamp
            }];
            return updatedMessages;
        });
    };

    const handleChatHistoryMessage = (received) => {
        const decryptedMessages = received.messages.map(msg => {
            let decryptedText;
            try {
                const bytes = CryptoJS.AES.decrypt(msg.text, encryptionKeyRef.current);
                decryptedText = bytes.toString(CryptoJS.enc.Utf8);
                if (!decryptedText) decryptedText = "<Message decryption failed>";
            } catch (e) {
                console.error("Decryption error:", e);
                decryptedText = "<Message decryption error>";
            }
            return { ...msg, text: decryptedText };
        });
        setMessages(decryptedMessages);
        setUserMap((prev) => {
            const updatedMap = { ...prev };
            decryptedMessages.forEach((msg) => {
                updatedMap[msg.senderID] = msg.senderName;
            });
            return updatedMap;
        });
        if (decryptedMessages.length > 0) {
            const partnerMessage = decryptedMessages
                .slice()
                .reverse()
                .find((msg) => msg.senderID !== userIDRef.current);
            setStatus(
                partnerMessage
                    ? `You are now connected with ${partnerMessage.senderName}`
                    : "Connected, waiting for partner..."
            );
        } else {
            setStatus("Connected, waiting for partner...");
        }
    };

    const handleSystemMessage = (received) => {
        setStatus(received.text);
        console.log("System Message received:", received.text);
    };

    const handleChatEndedMessage = () => {
        setMessages([]);
        setUserMap({});
        setStatus("Partner disconnected. Finding a new partner...");
    };

    const handleEncryptionKeyMessage = (received) => {
        encryptionKeyRef.current = received.key;
        console.log("Received Encryption Key from Partner (User 2):", encryptionKeyRef.current.substring(0, 10) + "...");
    };


    const startChat = () => {
        if (name.trim()) {
            setChatStarted(true);
        } else {
            setStatus("Please enter a valid name.");
        }
    };

    const sendMessage = () => {
        if (!newMessage.trim()) return;
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
            console.warn("sendMessage: WebSocket not open, message not sent.");
            setStatus("Cannot send message: Not connected.");
            return;
        }

        console.log("Encryption Key used for sending:", encryptionKeyRef.current.substring(0, 10) + "...");
        console.log("Plain text message to encrypt:", newMessage);

        const encryptedMessageText = CryptoJS.AES.encrypt(newMessage, encryptionKeyRef.current).toString();

        console.log("Encrypted message sent:", encryptedMessageText);

        const messageData = {
            type: "chat",
            senderID: userIDRef.current,
            senderName: name,
            text: encryptedMessageText,
            timestamp: Date.now() // Add timestamp
        };

        socketRef.current.send(JSON.stringify(messageData));
        setMessages((prev) => [...prev, { ...messageData, text: newMessage }]);
        setNewMessage("");
    };


    const startVideoCall = () => {
        console.warn("startVideoCall: Video call functionality is not fully implemented yet.");
        alert("Video call feature is not yet fully implemented in this chat component. Please use the separate Video Call section for now.");
    };

    const skipToNextUser = () => {
        console.log("skipToNextUser: Initiating skip to next user.");
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: "skip" }));
            setMessages([]);
            setUserMap({});
            setStatus("Finding a new partner...");
        } else {
            console.warn("skipToNextUser: WebSocket not open, cannot skip.");
            setStatus("Reconnecting to find a new partner...");
            connectWebSocket();
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            sendMessage();
        }
    };

    const goBackToHome = () => {
        console.log("goBackToHome: Going back to home, resetting chat state.");
        setName("");
        setMessages([]);
        setUserMap({});
        setChatStarted(false);
        setStatus("Disconnected from chat.");
        disconnectWebSocket();
    };

    const handleNameSelectionKeyPress = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            startChat();
        }
    };

    // Re-run cleanupOldMessages whenever selfDestructEnabled, destructTime, or customTime changes
    useEffect(() => {
        cleanupOldMessages();
    }, [selfDestructEnabled, destructTime, customTime]);

    const cleanupOldMessages = () => {
        let destructionTimeMs;
        if (destructTime === "custom") {
            destructionTimeMs = parseInt(customTime, 10) * 60000;
        } else {
            switch (destructTime) {
                case "2min":
                    destructionTimeMs = 2 * 60000;
                    break;
                case "5min":
                    destructionTimeMs = 5 * 60000;
                    break;
                case "10min":
                    destructionTimeMs = 10 * 60000;
                    break;
                default:
                    destructionTimeMs = 5 * 60000; // Default to 5 minutes
            }
        }

        const now = Date.now();
        const newMessages = messages.filter(msg => now - msg.timestamp < destructionTimeMs);
        setMessages(newMessages);
    };

    return (
        <div
            className="chat-page d-flex align-items-center justify-content-center"
            style={{
                width: "100vw",
                minHeight: "100vh",
                backgroundColor: theme === "dark" ? "#121212" : "#f8f9fa",
                color: theme === "dark" ? "#ffffff" : "#333333",
                position: "relative",
                overflow: "hidden",
                transition: "background-color 0.3s ease, color 0.3s ease",
            }}
        >
            <Container>
                {!chatStarted ? (
                    <Row className="justify-content-center">
                        <Col md={6} lg={4}>
                            <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                                <Form>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Enter your nickname:</Form.Label>
                                        <Form.Control
                                            type="text"
                                            placeholder="Your nickname"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            onKeyDown={handleNameSelectionKeyPress}
                                        />
                                    </Form.Group>
                                    <div className="d-grid">
                                        <Button variant="primary" onClick={startChat}>
                                            Start Chat
                                        </Button>
                                    </div>
                                </Form>
                            </div>
                        </Col>
                    </Row>
                ) : (
                    <Row className="justify-content-center">
                        <Col
                            md={6}
                            className="p-3 rounded d-flex flex-column"
                            style={{
                                backgroundColor: theme === "dark" ? "#1e1e1e" : "#ffffff",
                                color: theme === "dark" ? "#ffffff" : "#333333",
                                border: theme === "dark"
                                    ? "0.5px solid rgba(255, 255, 255, 0.2)"
                                    : "0.5px solid rgba(0, 0, 0, 0.2)",
                                boxShadow: theme === "dark"
                                    ? "0px 4px 10px rgba(255, 255, 255, 0.1)"
                                    : "0px 4px 10px rgba(0, 0, 0, 0.1)",
                                transition: "background-color 0.3s ease, color 0.3s ease",
                                display: 'flex',
                                flexDirection: 'column',
                                height: 'auto',
                                minHeight: '500px'
                            }}
                        >
                            <h2 className="text-center">Anonymous Chat</h2>

                            <div className="text-center my-2">
                                <small style={{ fontStyle: "italic" }}>{status}</small>
                                {isConnecting && <Spinner animation="border" size="sm" className="ms-2" />}
                            </div>

                            <div
                                ref={chatContainerRef}
                                className="chat-box p-3 rounded mt-2"
                                style={{
                                    height: "400px",
                                    overflowY: "auto",
                                    display: "flex",
                                    flexDirection: "column",
                                    backgroundColor: theme === "dark" ? "#2c2c2c" : "#f0f0f0",
                                    flexGrow: 1,
                                    marginBottom: '10px'
                                }}
                            >
                                {messages.map((msg, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            width: "fit-content",
                                            maxWidth: "80%",
                                            alignSelf: msg.senderID === userIDRef.current ? "flex-end" : "flex-start",
                                            backgroundColor: msg.senderID === userIDRef.current ? "#198754" : "#0d6efd",
                                            color: "#fff",
                                            padding: "10px",
                                            borderRadius: "12px",
                                            marginBottom: "8px",
                                            fontSize: "14px",
                                        }}
                                    >
                                        <strong>
                                            {msg.senderID === userIDRef.current
                                                ? `${name} (you)`
                                                : msg.senderName || userMap[msg.senderID] || "Unknown"}:
                                        </strong>{" "}
                                        {msg.text}
                                    </div>
                                ))}
                                {status.startsWith("Partner disconnected") && (
                                    <div
                                        className="system-message text-center"
                                        style={{
                                            width: "100%",
                                            backgroundColor: theme === "dark" ? "#444" : "#eee",
                                            color: theme === "dark" ? "#eee" : "#444",
                                            padding: "8px",
                                            borderRadius: "8px",
                                            marginBottom: "8px",
                                            fontSize: "14px",
                                            fontStyle: "italic",
                                        }}
                                    >
                                        {status}
                                    </div>
                                )}
                            </div>

                            <InputGroup className="mt-0">
                                <Form.Control
                                    type="text"
                                    placeholder="Type a message..."
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyDown={handleKeyPress}
                                    disabled={isConnecting}
                                />
                                <Button variant="primary" onClick={sendMessage} disabled={isConnecting}>
                                    <FaPaperPlane />
                                </Button>
                                <Button variant="success" className="ms-2" onClick={startVideoCall} disabled={isConnecting}>
                                    <FaVideo />
                                </Button>
                            </InputGroup>
                            <div className="d-grid gap-2 mt-2">
                                <Button variant="warning" onClick={skipToNextUser} disabled={isConnecting}>
                                    Skip to Next
                                </Button>
                                <Button variant="secondary" onClick={goBackToHome} disabled={isConnecting}>
                                    Change Nickname
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
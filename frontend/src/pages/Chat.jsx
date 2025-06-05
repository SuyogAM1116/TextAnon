import React, { useState, useEffect, useRef, useContext } from "react";
import { Container, Row, Col, Button, Form, InputGroup, Spinner, Alert } from "react-bootstrap";
import { FaPaperPlane, FaVideo, FaSignOutAlt, FaRedo } from "react-icons/fa";
import { ThemeContext } from "../components/ThemeContext";
import CryptoJS from 'crypto-js';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

const systemMessageCounter = { current: 0 };
const generateSystemMessageId = () => {
    systemMessageCounter.current += 1;
    return `sys-${Date.now()}-${systemMessageCounter.current}`;
};

const badWordsClient = ["damn", "hell", "shit", "fuck", "fuk", "bitch", "asshole", "cunt", "dick", "pussy", "slut", "whore", "nigger", "nigga", "ass"];
const badWordClientRegex = new RegExp(`\\b(${badWordsClient.join('|')})\\b`, 'gi');

function censorClientMessageText(text) {
    if (!text || typeof text !== 'string') return text;
    badWordClientRegex.lastIndex = 0;
    return text.replace(badWordClientRegex, (match) => '*'.repeat(match.length));
}

const Chat = () => {
    const navigate = useNavigate();
    const { theme, selfDestructEnabled, destructTime, customTime } = useContext(ThemeContext);

    const [nameForEntry, setNameForEntry] = useState(localStorage.getItem('chatUsername') || "");
    const [registeredName, setRegisteredName] = useState('');
    const [chatStarted, setChatStarted] = useState(false);

    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [userMap, setUserMap] = useState({});
    const [status, setStatus] = useState("Enter nickname to start.");
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState('');
    
    const [socket, setSocket] = useState(null);
    const [currentUserID, setCurrentUserID] = useState(null);
    const [currentEncryptionKey, setCurrentEncryptionKey] = useState(null);
    const [pendingMessages, setPendingMessages] = useState([]);

    const chatContainerRef = useRef(null);
    const nameInputRef = useRef(null);
    const messageInputRef = useRef(null);
    const intervalIdRef = useRef(null);

    useEffect(() => {
        if (!chatStarted) {
            if (socket) { socket.disconnect(); setSocket(null); }
            setStatus("Enter nickname to start."); return;
        }
        setIsConnecting(true); setStatus("Connecting to chat server...");
        const backendUrl = 'ws://localhost:8080';
        const newSocket = io(backendUrl, { reconnectionAttempts: 3, transports: ['websocket'] });
        setSocket(newSocket);
        return () => {
            if (newSocket) newSocket.disconnect();
            if (intervalIdRef.current) clearInterval(intervalIdRef.current);
        };
    }, [chatStarted]);

    useEffect(() => { if (!chatStarted && nameInputRef.current) nameInputRef.current.focus(); }, [chatStarted]);
    
    useEffect(() => {
        const partnerId = Object.keys(userMap).find(id => id !== currentUserID && id !== 'system');
        if (chatStarted && currentUserID && currentEncryptionKey && partnerId && messageInputRef.current) {
            messageInputRef.current.focus();
        }
    }, [chatStarted, currentUserID, currentEncryptionKey, userMap]);

    useEffect(() => {
        if (!socket) return;
        const onConnect = () => {
            setIsConnecting(false); setStatus("Registering...");
            if (registeredName) socket.emit('register', { name: registeredName });
        };
        const onDisconnect = (reason) => {
            setIsConnecting(false);
            setStatus(chatStarted ? `Disconnected: ${reason}. Try refreshing.` : "Disconnected.");
            setCurrentEncryptionKey(null);
            const selfName = userMap[currentUserID] || registeredName;
            setUserMap(currentUserID ? { [currentUserID]: selfName } : {});
        };
        const onConnectError = (err) => { setIsConnecting(false); setStatus(`Connection failed: ${err.message}`); setError(`Connection error. Server might be down.`);};
        const onUserID = (data) => {
            setCurrentUserID(data.userID);
            setUserMap(prev => ({ ...prev, [data.userID]: registeredName }));
            setStatus('Registered. Waiting for partner...');
            setError(''); // Clear previous errors on successful registration
        };
        const onSystemMessage = (message) => {
            const newMsg = { type: 'system', senderID: 'system', senderName: 'System', text: message.text, id: generateSystemMessageId(), timestamp: Date.now() };
            setMessages(prev => cleanupOldMessages([...prev, newMsg], selfDestructEnabled, destructTime, customTime));
            setStatus(message.text); 
            if (message.text && 
                (message.text.toLowerCase().includes("finding a new match") || 
                 message.text.toLowerCase().includes("partner skipped") || 
                 message.text.toLowerCase().includes("partner has disconnected"))) {
                const selfName = userMap[currentUserID] || registeredName;
                setUserMap(currentUserID ? { [currentUserID]: selfName } : {});
                setCurrentEncryptionKey(null); setPendingMessages([]);
            }
        };
        const onPartnerConnected = (data) => {
            const selfName = userMap[currentUserID] || registeredName;
            setUserMap({
                ...(currentUserID && selfName ? { [currentUserID]: selfName } : {}),
                [data.partnerID]: data.partnerName 
            });
            setStatus(`Chatting with ${data.partnerName}`);
            setMessages(prev => cleanupOldMessages([...prev, { type: 'system', text: `You are now chatting with ${data.partnerName}.`, id: generateSystemMessageId(), timestamp: Date.now() }], selfDestructEnabled, destructTime, customTime));
        };
        const onEncryptionKey = (data) => {
            if (data.key && /^[0-9a-fA-F]{64}$/.test(data.key)) {
                setCurrentEncryptionKey(data.key);
                const partnerId = Object.keys(userMap).find(id => id !== currentUserID && id !== 'system');
                const currentPartnerName = userMap[partnerId] || "Partner";
                setStatus(`Chatting with ${currentPartnerName}`);
                setMessages(prev => cleanupOldMessages([...prev, { type: 'system', text: 'Secure connection established.', id: generateSystemMessageId(), timestamp: Date.now() }], selfDestructEnabled, destructTime, customTime));
                if (pendingMessages.length > 0) {
                    const toProcess = [...pendingMessages]; setPendingMessages([]);
                    toProcess.forEach(msg => onChatMessageFromServer(msg));
                }
            } else { setStatus("Error: Secure connection failed (Bad Key). Skipping..."); if(socket) socket.emit('skip');}
        };
        const onChatMessageFromServer = (received) => {
            if (!currentEncryptionKey) { setPendingMessages(prev => [...prev, received]); return; }
            const decryptedText = decryptMessageClientSide(received.text, currentEncryptionKey);
            const messageId = received.id || `${received.senderID}-${received.timestamp || Date.now()}`;
            const newMsgData = { id: messageId, senderID: received.senderID, senderName: userMap[received.senderID] || received.senderName || "Partner", text: decryptedText, timestamp: received.timestamp || Date.now(), type: 'partner' };
            if (received.senderName && (!userMap[received.senderID] || userMap[received.senderID] !== received.senderName)) {
                setUserMap(prev => ({ ...prev, [received.senderID]: received.senderName }));
            }
            setMessages(prev => cleanupOldMessages([...prev, newMsgData], selfDestructEnabled, destructTime, customTime));
        };
        const onChatEnded = () => {
            const currentPartnerId = Object.keys(userMap).find(id => id !== currentUserID && id !== 'system');
            const partnerNameDisplay = userMap[currentPartnerId] || "Partner";
            setMessages(prev => cleanupOldMessages([...prev, { type: 'system', text: `Chat with ${partnerNameDisplay} ended. Finding new partner...`, id: generateSystemMessageId(), timestamp: Date.now() }], selfDestructEnabled, destructTime, customTime));
            const selfName = userMap[currentUserID] || registeredName;
            setUserMap(currentUserID ? { [currentUserID]: selfName } : {});
            setCurrentEncryptionKey(null); setPendingMessages([]);
            setStatus('Waiting for a new partner...');
        };

        socket.on('connect', onConnect); socket.on('disconnect', onDisconnect);
        socket.on('connect_error', onConnectError); socket.on('userID', onUserID);
        socket.on('systemMessage', onSystemMessage); socket.on('partnerConnected', onPartnerConnected);
        socket.on('encryptionKey', onEncryptionKey); socket.on('chat', onChatMessageFromServer);
        socket.on('chatEnded', onChatEnded);
        return () => { 
            socket.off('connect'); socket.off('disconnect'); socket.off('connect_error');
            socket.off('userID'); socket.off('systemMessage'); socket.off('partnerConnected');
            socket.off('encryptionKey'); socket.off('chat'); socket.off('chatEnded');
        };
    }, [socket, registeredName, currentEncryptionKey, selfDestructEnabled, destructTime, customTime, currentUserID, userMap, pendingMessages]);

    const encryptMessageClientSide = (text, keyHex) => { /* ... No change ... */ 
        if (!keyHex) { console.error("Encrypt: No key"); return null; }
        try {
            const key = CryptoJS.enc.Hex.parse(keyHex); const iv = CryptoJS.lib.WordArray.random(16);
            const encrypted = CryptoJS.AES.encrypt(text, key, { iv: iv, padding: CryptoJS.pad.Pkcs7, mode: CryptoJS.mode.CBC });
            return iv.concat(encrypted.ciphertext).toString(CryptoJS.enc.Base64);
        } catch (e) { console.error("Encrypt Error:", e); return null; }
    };
    const decryptMessageClientSide = (encryptedBase64, keyHex) => { /* ... No change ... */
        if (!keyHex) { console.error("Decrypt: No key"); return "<Decrypt Error: No Key>";}
        try {
            const key = CryptoJS.enc.Hex.parse(keyHex);
            const encryptedDataWithIv = CryptoJS.enc.Base64.parse(encryptedBase64);
            if (encryptedDataWithIv.sigBytes < 16) return "<Decrypt Error: Data too short>";
            const iv = CryptoJS.lib.WordArray.create(encryptedDataWithIv.words.slice(0, 4), 16);
            const ciphertext = CryptoJS.lib.WordArray.create(encryptedDataWithIv.words.slice(4), encryptedDataWithIv.sigBytes - 16);
            if (ciphertext.sigBytes <= 0) return "<Decrypt Error: No Ciphertext>";
            const decrypted = CryptoJS.AES.decrypt({ ciphertext: ciphertext }, key, { iv: iv, padding: CryptoJS.pad.Pkcs7, mode: CryptoJS.mode.CBC });
            const text = decrypted.toString(CryptoJS.enc.Utf8);
            if(!text && encryptedBase64) return "<Decrypt Error: Empty Result>";
            return text;
        } catch (e) { return `<Decrypt Err: ${e.message.slice(0,20)}>`; }
    };

    const handleStartChatSubmit = (e) => {
        e.preventDefault();
        if (nameForEntry.trim()) {
            setRegisteredName(nameForEntry); setChatStarted(true);
            localStorage.setItem('chatUsername', nameForEntry);
            setError(''); // Clear previous errors
        } else { setStatus("Nickname cannot be empty."); }
    };

    const sendMessageUI = () => {
        const messageToSend = newMessage.trim();
        if (!messageToSend) { setError("Message cannot be empty."); return; }
        const partnerId = Object.keys(userMap).find(id => id !== currentUserID && id !== 'system');
        if (!socket || !currentUserID || !currentEncryptionKey || !partnerId) {
            setError("Cannot send. Not fully connected or no partner."); return;
        }
        const censoredLocalText = censorClientMessageText(messageToSend);
        const encryptedBase64 = encryptMessageClientSide(censoredLocalText, currentEncryptionKey);
        if (encryptedBase64) {
            const timestamp = Date.now(); const messageID = `${currentUserID}-${timestamp}`;
            const messageDataWs = { text: encryptedBase64, timestamp: timestamp, id: messageID };
            socket.emit('chat', messageDataWs);
            const localMessageData = {
                id: messageID, senderID: currentUserID, senderName: registeredName,
                text: censoredLocalText, timestamp: timestamp, type: 'user'
            };
            setMessages(prev => cleanupOldMessages([...prev, localMessageData], selfDestructEnabled, destructTime, customTime));
            setNewMessage(""); setError("");
        } else { setError("Error: Failed to encrypt message."); }
    };

    const handleKeyPress = (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessageUI(); }
    };
    
    const skipToNextUser = () => {
        if (socket) { setStatus("Skipping..."); socket.emit('skip'); }
    };

    const goBackToHome = () => {
        setChatStarted(false); setNameForEntry(localStorage.getItem('chatUsername') || "");
        setRegisteredName(''); setMessages([]); setUserMap({});
        setStatus("Enter nickname to start new chat."); setCurrentUserID(null);
        setCurrentEncryptionKey(null); setPendingMessages([]); setError('');
        navigate('/');
    };
    
    const startVideoCall = () => {
        const partnerId = Object.keys(userMap).find(id => id !== currentUserID && id !== 'system');
        const partnerNameFromMap = userMap[partnerId];
        if (partnerId && currentUserID && currentEncryptionKey) {
            navigate('/video', { state: { userID: currentUserID, partnerID: partnerId, partnerName: partnerNameFromMap || "Partner", encryptionKey: currentEncryptionKey } });
        } else { setStatus("Cannot start video call: No partner or secure connection."); setError("No partner available for video call.");}
    };

    const cleanupOldMessages = (currentMessages, currentSelfDestructEnabled, currentDestructTime, currentCustomTime) => {
        if (!currentSelfDestructEnabled || currentMessages.length === 0) return currentMessages;
        let destructionTimeMs;
        const defaultTimeMs = 300 * 1000;
        if (currentDestructTime === "custom") {
            const customSeconds = parseInt(currentCustomTime, 10);
            destructionTimeMs = (!isNaN(customSeconds) && customSeconds >= 10 && customSeconds <= 3600) ? customSeconds * 1000 : defaultTimeMs;
        } else {
            const timeMap = {"30sec": 30*1000, "60sec": 60*1000, "120sec": 120*1000, "300sec": 300*1000, "600sec": 600*1000};
            destructionTimeMs = timeMap[currentDestructTime] || defaultTimeMs;
        }
        const now = Date.now();
        return currentMessages.filter(msg => {
            if (msg.type === 'system') return true;
            if (!msg.timestamp || typeof msg.timestamp !== 'number' || msg.timestamp > now + 60000) return true;
            return (now - msg.timestamp) < destructionTimeMs;
        });
    };

    useEffect(() => {
        let intervalId = null;
        if (selfDestructEnabled && chatStarted && currentUserID) {
            const runCleanup = () => setMessages(prev => cleanupOldMessages(prev, selfDestructEnabled, destructTime, customTime));
            runCleanup();
            let intervalMs = 10000;
            if (destructTime === "custom") { /* ... */ } else if (destructTime === "30sec") intervalMs = 5000;
            intervalId = setInterval(runCleanup, intervalMs);
            intervalIdRef.current = intervalId;
        }
        return () => { if (intervalId) clearInterval(intervalId); };
    }, [selfDestructEnabled, destructTime, customTime, chatStarted, currentUserID]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
        }
    }, [messages]);

    // --- JSX Structure (from your reference code, with inline styles for bubbles) ---
    // Added className for theme targeting at the top level of the returned JSX for Chat.jsx
    return (
        <div className={`chat-page d-flex align-items-center justify-content-center ${theme === "dark" ? "theme-dark" : "theme-light"}`} style={{ width: "100vw", minHeight: "100vh", backgroundColor: theme === "dark" ? "#121212" : "#f0f2f5", color: theme === "dark" ? "#ffffff" : "#212529", transition: "background-color 0.3s ease, color 0.3s ease", position: "relative", overflow: "hidden" }}>
            <Container style={{paddingTop: '20px', paddingBottom: '20px', maxWidth: '850px'}}> {/* Made container slightly wider */}
                {!chatStarted || !currentUserID ? (
                    <Row className="justify-content-center">
                        <Col md={6} lg={5}>
                            {/* Added nickname-card class for specific dark theme styling from App.css */}
                            <div className={`nickname-card`} style={{ padding: '30px 25px', background: theme === 'dark' ? '#1e1e1e' : '#fff', borderRadius: '12px', boxShadow: theme === 'dark' ? '0 6px 20px rgba(255,255,255,0.08)' : '0 6px 20px rgba(0,0,0,0.1)' }}>
                                <h3 className="text-center mb-4">Enter Chat Nickname</h3>
                                <Form onSubmit={handleStartChatSubmit}>
                                    <Form.Group className="mb-3">
                                        <Form.Control
                                            ref={nameInputRef}
                                            type="text"
                                            placeholder="Your nickname"
                                            value={nameForEntry}
                                            onChange={(e) => {setNameForEntry(e.target.value); localStorage.setItem('chatUsername', e.target.value);}}
                                            onKeyDown={(e) => {if (e.key === 'Enter' && nameForEntry.trim()) handleStartChatSubmit(e);}}
                                            maxLength={20}
                                            autoFocus
                                            className={theme === 'dark' ? 'form-control-dark' : ''}
                                        />
                                    </Form.Group>
                                    <div className="d-grid">
                                        <Button variant="primary" type="submit" disabled={!nameForEntry.trim() || isConnecting || (socket && !socket.connected) }>
                                            {(isConnecting && status.includes("Connecting")) || status.includes("Registering...") ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-1" /> : null}
                                            Start Chat
                                        </Button>
                                    </div>
                                </Form>
                                {status && (status.startsWith('Please enter') || status.includes("failed") || status.includes("Disconnected") || status.includes("Connecting to chat server") || status.includes("Registering...")) && (
                                    // Using a div for status messages that might contain a spinner
                                    <div className={`text-center mt-3 small ${status.includes("failed") ? 'text-danger' : (theme === 'dark' ? 'text-light-emphasis' : 'text-muted')}`}>
                                        {(isConnecting && status.includes("Connecting")) && (!socket || !socket.connected) ? <Spinner animation="border" size="sm" className="me-1"/> : null}
                                        {status.includes("Registering...") && !isConnecting ? <Spinner animation="border" size="sm" className="me-1"/> : null}
                                        {status}
                                    </div>
                                )}
                                {error && <Alert variant="danger" className="mt-2 py-1 px-2 small">{error}</Alert> }
                            </div>
                        </Col>
                    </Row>
                ) : (
                    <Row className="justify-content-center">
                        {/* Adjusted Col size to make chat window slightly bigger as requested */}
                        <Col md={11} lg={9} xl={8} className={`p-0 rounded d-flex flex-column chat-box-container ${theme === "dark" ? "dark" : ""}`} 
                             style={{ 
                                 height: 'calc(100vh - 80px)', // Made slightly taller
                                 minHeight: '500px',          // Increased min height
                                 maxHeight: '85vh',          // Kept max height relative
                                 boxShadow: theme === 'dark' ? '0 8px 30px rgba(0,0,0,0.4)' : '0 8px 30px rgba(0,0,0,0.15)', // Enhanced shadow
                                 border: theme === "dark" ? "1px solid #383838" : "1px solid #dee2e6",
                                 // Background color will be handled by App.css .chat-box-container classes for theme
                             }}>
                            <div className={`p-3 border-bottom d-flex justify-content-between align-items-center chat-box-header ${theme === 'dark' ? 'border-secondary' : ''}`}>
                                <div>
                                    <h2 className="mb-0" style={{ fontSize: '1.1rem' }}> {/* Changed from h5 */}
                                        {registeredName} (You)
                                        {Object.keys(userMap).find(id => id !== currentUserID && id !== 'system') && 
                                         <span className="mx-1">-</span> /* Added separator */
                                        }
                                        {Object.keys(userMap).find(id => id !== currentUserID && id !== 'system') && 
                                         <span style={{fontWeight: 'normal'}}>Chatting with: {userMap[Object.keys(userMap).find(id => id !== currentUserID && id !== 'system')] || "Partner"}</span>
                                        }
                                    </h2>
                                    <small className="text-muted" style={{fontSize: '0.8rem', display: 'block', marginTop: '2px'}}> {/* Made status block for alignment */}
                                        {status}
                                    </small>
                                </div>
                                <div> {/* Buttons */}
                                     <Button title="Video Call" variant="outline-success" size="sm" onClick={startVideoCall} disabled={!currentUserID || !Object.keys(userMap).find(id => id !== currentUserID && id !== 'system') || !currentEncryptionKey} className="me-2"><FaVideo /></Button>
                                     <Button title="Skip Partner" variant="outline-warning" size="sm" onClick={skipToNextUser} disabled={isConnecting || !currentUserID || !Object.keys(userMap).find(id => id !== currentUserID && id !== 'system') || status.includes("Finding") || status.includes("Waiting") || status.includes("Skipping")} className="me-2"><FaRedo /></Button>
                                     <Button title="Leave Chat" variant="outline-danger" size="sm" onClick={goBackToHome}><FaSignOutAlt /></Button>
                                </div>
                            </div>
                            
                            {error && <Alert variant="danger" className="m-2 mb-0 py-1 px-2 small">{error}</Alert>}

                            <div ref={chatContainerRef} className={`chat-box-messages p-3 flex-grow-1 ${theme === "dark" ? "dark" : ""}`} style={{ overflowY: "auto" }}>
                                {messages.map((msg) => {
                                    const isUser = msg.senderID === currentUserID;
                                    const isSystem = msg.type === 'system' || msg.senderID === 'system';
                                    const senderDisplayName = isUser ? registeredName : (userMap[msg.senderID] || msg.senderName || (isSystem ? "System" : "Partner"));

                                    // Define base style for all bubbles
                                    let bubbleStyle = {
                                        padding: '0.5rem 0.85rem', wordBreak: 'break-word',
                                        boxShadow: '0 1px 1px rgba(0,0,0,0.08)', maxWidth: '80%',
                                        lineHeight: '1.4', fontSize: '0.95rem', marginBottom: "8px",
                                        textAlign: 'left', display: 'inline-block' // Make bubbles inline-block for better wrapping
                                    };

                                    if (isSystem) {
                                        bubbleStyle = {
                                            ...bubbleStyle, fontStyle: 'italic', fontSize: '0.8em',
                                            textAlign: 'center', width: 'auto', maxWidth: '90%',
                                            marginLeft: 'auto', marginRight: 'auto', padding: "6px 12px",
                                            borderRadius: "10px",
                                            backgroundColor: theme === 'dark' ? '#3a3f44' : '#f1f3f5', // Adjusted system bubble colors
                                            color: theme === 'dark' ? '#ced4da' : '#495057',
                                            border: 'none', boxShadow: 'none',
                                        };
                                    } else if (isUser) {
                                        bubbleStyle = { ...bubbleStyle,
                                            backgroundColor: '#198754', color: 'white',
                                            borderRadius: "15px 5px 15px 15px",
                                        };
                                    } else { // Partner message
                                        bubbleStyle = { ...bubbleStyle,
                                            backgroundColor: '#0d6efd', color: 'white',
                                            borderRadius: "5px 15px 15px 15px",
                                        };
                                    }

                                    return (
                                        <div key={msg.id} className={`d-flex mb-2 ${isUser ? 'justify-content-end' : (isSystem ? 'justify-content-center' : 'justify-content-start')}`}>
                                            <div style={bubbleStyle}> 
                                                {!isUser && !isSystem && senderDisplayName && (
                                                    <strong style={{ display: 'block', marginBottom: '2px', fontSize: '0.75rem', opacity: 0.8, color: theme === 'dark' ? (bubbleStyle.color === 'white' ? 'rgba(255,255,255,0.8)' : '#bbb') : (bubbleStyle.color === 'white' ? 'rgba(255,255,255,0.8)' :'#444') }}>
                                                        {senderDisplayName}
                                                    </strong>
                                                )}
                                                {msg.text} 
                                                {!isSystem && msg.timestamp && (
                                                    <span style={{fontSize: '0.65rem', opacity: 0.7, display: 'block', textAlign: 'right', marginTop: '3px', color: bubbleStyle.color === 'white' ? 'rgba(255,255,255,0.7)' : 'inherit' }}>
                                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {messages.length === 0 && !status.includes("Connecting") && !isConnecting && (
                                    <div className={`text-center ${theme === 'dark' ? 'text-light-emphasis' : 'text-muted'} mt-auto mb-auto p-3`}>
                                        {status.includes("Waiting for partner") ? "Waiting for partner..." : "No messages yet. Say hi!"}
                                    </div>
                                )}
                            </div>

                            <InputGroup className={`p-2 border-top chat-box-input-group ${theme === 'dark' ? 'border-secondary' : ''}`}>
                                <Form.Control
                                    ref={messageInputRef}
                                    as="textarea" rows={1}
                                    style={{ resize: 'none', overflowY: 'auto', maxHeight: '100px' }}
                                    placeholder={!chatStarted || !currentUserID ? "Enter name first" : (!Object.keys(userMap).find(id => id !== currentUserID && id !== 'system') || !currentEncryptionKey ? "Waiting for secure connection..." : "Type message...")}
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyDown={handleKeyPress}
                                    disabled={!chatStarted || !currentUserID || !Object.keys(userMap).find(id => id !== currentUserID && id !== 'system') || !currentEncryptionKey || status.includes("Finding") || status.includes("Waiting") || status.includes("Skipping") || isConnecting}
                                    className={theme === 'dark' ? 'form-control-dark' : ''}
                                />
                                <Button
                                    variant="primary" onClick={sendMessageUI}
                                    disabled={!chatStarted || !currentUserID || !Object.keys(userMap).find(id => id !== currentUserID && id !== 'system') || !currentEncryptionKey || !newMessage.trim() || status.includes("Finding") || status.includes("Waiting") || status.includes("Skipping") || isConnecting}
                                >
                                    <FaPaperPlane />
                                </Button>
                            </InputGroup>
                        </Col>
                    </Row>
                )}
            </Container>
        </div>
    );
};

export default Chat;
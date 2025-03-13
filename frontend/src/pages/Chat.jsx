import React, { useState, useEffect, useRef, useContext } from "react";
import { Container, Row, Col, Button, Form, InputGroup } from "react-bootstrap";
import { FaPaperPlane, FaVideo } from "react-icons/fa";
import NameSelection from "../components/NameSelection";
import { ThemeContext } from "../components/ThemeContext";

const Chat = () => {
  const { theme } = useContext(ThemeContext);
  const [name, setName] = useState("");
  const [chatStarted, setChatStarted] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const userIDRef = useRef(null);
  const chatContainerRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (chatStarted) {
      socketRef.current = new WebSocket("ws://localhost:8080");

      socketRef.current.onopen = () => {
        console.log("✅ Connected to WebSocket Server");
        socketRef.current.send(JSON.stringify({ type: "register", name }));
      };

      socketRef.current.onmessage = async (event) => {
        try {
          let receivedMessage = event.data instanceof Blob 
            ? JSON.parse(await event.data.text()) 
            : JSON.parse(event.data);

          console.log("📩 Message from Server:", receivedMessage);

          if (receivedMessage.type === "userID") {
            userIDRef.current = receivedMessage.userID;
            console.log("✅ UserID Received & Stored:", userIDRef.current);
          } else if (receivedMessage.type === "chat") {
            setMessages((prevMessages) => [
              ...prevMessages,
              {
                senderID: receivedMessage.senderID,
                senderName: receivedMessage.senderName,
                text: receivedMessage.text,
              },
            ]);
          } else if (["offer", "answer", "candidate"].includes(receivedMessage.type)) {
            // Handle WebRTC messages (to be integrated with video call functionality)
            console.log("📡 WebRTC Signaling Message Received:", receivedMessage);
          }
        } catch (error) {
          console.error("❌ Error parsing message:", error);
        }
      };

      socketRef.current.onerror = (error) => console.error("WebSocket Error:", error);
      socketRef.current.onclose = () => console.log("❌ WebSocket disconnected");

      return () => socketRef.current?.close();
    }
  }, [chatStarted]);

  useEffect(() => {
    chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const startChat = () => {
    if (name.trim()) {
      setChatStarted(true);
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;

    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.error("❌ Cannot send message - WebSocket not open.");
      return;
    }

    if (!userIDRef.current) {
      console.error("⏳ Waiting for userID from server. Retrying in 500ms...");
      setTimeout(sendMessage, 500);
      return;
    }

    const messageData = {
      type: "chat",
      senderID: userIDRef.current,
      senderName: name,
      text: newMessage,
    };

    console.log("📤 Sending Message:", messageData);

    try {
      socketRef.current.send(JSON.stringify(messageData));
      setMessages((prevMessages) => [...prevMessages, messageData]);
      setNewMessage("");
    } catch (error) {
      console.error("❌ Error sending message:", error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div
      className="chat-page d-flex align-items-center justify-content-center"
      style={{
        height: "100vh",
        width: "100vw",
        backgroundColor: theme === "dark" ? "#121212" : "#f8f9fa",
        color: theme === "dark" ? "#ffffff" : "#333333",
        position: "relative",
        overflow: "hidden",
        transition: "background-color 0.3s ease, color 0.3s ease",
      }}
    >
      <Container>
        {!chatStarted ? (
          <NameSelection name={name} setName={setName} startChat={startChat} />
        ) : (
          <Row className="justify-content-center">
            <Col
              md={6}
              className="p-3 rounded"
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
              }}
            >
              <h2 className="text-center">Anonymous Chat</h2>

              <div
                ref={chatContainerRef}
                className="chat-box p-3 rounded mt-3"
                style={{
                  height: "400px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  backgroundColor: theme === "dark" ? "#2c2c2c" : "#f0f0f0",
                  transition: "background-color 0.3s ease",
                }}
              >
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className="p-2 rounded mb-2"
                    style={{
                      width: "fit-content",
                      maxWidth: "80%",
                      alignSelf: msg.senderID === userIDRef.current ? "flex-end" : "flex-start",
                      backgroundColor: msg.senderID === userIDRef.current ? "#198754" : "#0d6efd",
                      color: "#ffffff",
                      padding: "10px",
                      borderRadius: "12px",
                      fontSize: "14px",
                    }}
                  >
                    <strong>{msg.senderID === userIDRef.current ? "You" : msg.senderName}:</strong> {msg.text}
                  </div>
                ))}
              </div>

              <InputGroup className="mt-3">
                <Form.Control
                  type="text"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                />
                <Button variant="primary" onClick={sendMessage}>
                  <FaPaperPlane />
                </Button>
                <Button variant="success" className="ms-2">
                  <FaVideo />
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

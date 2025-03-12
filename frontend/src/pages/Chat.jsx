import React, { useState, useEffect, useRef, useContext } from "react";
import { Container, Row, Col, Button, Form, InputGroup } from "react-bootstrap";
import { FaPaperPlane } from "react-icons/fa";
import NameSelection from "../components/NameSelection";
import { ThemeContext } from "../components/ThemeContext";

const Chat = () => {
  const { theme } = useContext(ThemeContext);
  const [name, setName] = useState("");
  const [chatStarted, setChatStarted] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const chatContainerRef = useRef(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (chatStarted) {
      const ws = new WebSocket("ws://localhost:8080");
      setSocket(ws);

      ws.onopen = () => console.log("✅ Connected to WebSocket Server");

      ws.onmessage = (event) => {
        try {
          let receivedMessage = JSON.parse(event.data);
          
          setMessages((prevMessages) => [
            ...prevMessages,
            { sender: receivedMessage.sender || "Stranger", text: receivedMessage.text },
          ]);
        } catch (error) {
          console.error("❌ Error parsing message, treating as plain text:", error);

          setMessages((prevMessages) => [
            ...prevMessages,
            { sender: "Stranger", text: event.data },
          ]);
        }
      };

      ws.onclose = () => console.log("❌ WebSocket disconnected");

      return () => {
        ws.close();
      };
    }
  }, [chatStarted]);

  const startChat = () => {
    if (name.trim() !== "") {
      setChatStarted(true);
    }
  };

  const sendMessage = () => {
    if (newMessage.trim() !== "" && socket) {
      const messageData = { sender: `${name} (you)`, text: newMessage };
      socket.send(JSON.stringify(messageData)); // Always send JSON
      setMessages([...messages, messageData]);
      setNewMessage("");
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
      }}
    >
      <Container>
        {!chatStarted ? (
          <NameSelection name={name} setName={setName} startChat={startChat} />
        ) : (
          <Row className="justify-content-center">
            <Col md={6} className="p-3 rounded" style={{ backgroundColor: theme === "dark" ? "#1e1e1e" : "#ffffff" }}>
              <h2 className="text-center">Anonymous Chat</h2>

              {/* Chat Box */}
              <div
                ref={chatContainerRef}
                className="chat-box p-3 rounded mt-3"
                style={{ height: "400px", overflowY: "auto", display: "flex", flexDirection: "column" }}
              >
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className="p-2 rounded mb-2"
                    style={{
                      alignSelf: msg.sender.includes("(you)") ? "flex-end" : "flex-start",
                      backgroundColor: msg.sender.includes("(you)") ? "#198754" : "#0d6efd",
                      color: "#ffffff",
                      padding: "10px",
                      borderRadius: "12px",
                      fontSize: "14px",
                    }}
                  >
                    <strong>{msg.sender}:</strong> {msg.text}
                  </div>
                ))}
              </div>

              {/* Input field with send button */}
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
              </InputGroup>
            </Col>
          </Row>
        )}
      </Container>
    </div>
  );
};

export default Chat;

import React, { useState, useEffect, useRef, useContext } from "react";
import { Container, Row, Col, Button, Form, InputGroup } from "react-bootstrap";
import { FaPaperPlane, FaVideo } from "react-icons/fa";
import NameSelection from "../components/NameSelection";
import { ThemeContext } from "../components/ThemeContext";

const Chat = () => {
  const { theme } = useContext(ThemeContext);
  const [name, setName] = useState(() => sessionStorage.getItem("nickname") || "");
  const [chatStarted, setChatStarted] = useState(() => !!sessionStorage.getItem("nickname"));
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [userMap, setUserMap] = useState({});
  const [status, setStatus] = useState("Connecting you with a partner...");
  const userIDRef = useRef(null);
  const chatContainerRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (chatStarted) {
      connectWebSocket();
    }
    return () => disconnectWebSocket();
  }, [chatStarted]);

  useEffect(() => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const connectWebSocket = () => {
    setStatus("Connecting you with a partner...");
    socketRef.current = new WebSocket("ws://localhost:8080");

    socketRef.current.onopen = () => {
      console.log("Connected to WebSocket Server");
      socketRef.current.send(JSON.stringify({ type: "register", name }));
    };

    socketRef.current.onmessage = async (event) => {
      try {
        const received = event.data instanceof Blob
          ? JSON.parse(await event.data.text())
          : JSON.parse(event.data);

        if (received.type === "userID") {
          userIDRef.current = received.userID;
        } else if (received.type === "chat") {
          if (received.senderID !== userIDRef.current) {
            setStatus(`You are now connected with ${received.senderName}`);
          }

          setUserMap((prev) => ({
            ...prev,
            [received.senderID]: received.senderName,
          }));

          setMessages((prev) => [
            ...prev,
            {
              senderID: received.senderID,
              senderName: received.senderName,
              text: received.text,
            },
          ]);
        }
      } catch (err) {
        console.error("Error parsing message:", err);
      }
    };

    socketRef.current.onerror = (err) => console.error("WebSocket error:", err);

    socketRef.current.onclose = () => {
      console.log("WebSocket closed");
    };
  };

  const disconnectWebSocket = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
  };

  const startChat = () => {
    if (name.trim()) {
      sessionStorage.setItem("nickname", name);
      setChatStarted(true);
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    const messageData = {
      type: "chat",
      senderID: userIDRef.current,
      senderName: name,
      text: newMessage,
    };

    socketRef.current.send(JSON.stringify(messageData));
    setMessages((prev) => [...prev, messageData]);
    setNewMessage("");
  };

  const startVideoCall = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "start_video_call" }));
    }
  };

  const skipToNextUser = () => {
    disconnectWebSocket();
    setMessages([]);
    setUserMap({});
    connectWebSocket();
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };

  const goBackToHome = () => {
    sessionStorage.removeItem("nickname");
    setName("");
    setMessages([]);
    setChatStarted(false);
    disconnectWebSocket();
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
            <Col md={6} className="p-3 rounded" style={{
              backgroundColor: theme === "dark" ? "#1e1e1e" : "#ffffff",
              color: theme === "dark" ? "#ffffff" : "#333333",
              border: theme === "dark"
                ? "0.5px solid rgba(255, 255, 255, 0.2)"
                : "0.5px solid rgba(0, 0, 0, 0.2)",
              boxShadow: theme === "dark"
                ? "0px 4px 10px rgba(255, 255, 255, 0.1)"
                : "0px 4px 10px rgba(0, 0, 0, 0.1)",
              transition: "background-color 0.3s ease, color 0.3s ease",
            }}>
              <h2 className="text-center">Anonymous Chat</h2>

              <div className="text-center my-2">
                <small style={{ fontStyle: "italic" }}>{status}</small>
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
                        : userMap[msg.senderID] || "Unknown"}:
                    </strong>{" "}
                    {msg.text}
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
                <Button variant="success" className="ms-2" onClick={startVideoCall}>
                  <FaVideo />
                </Button>
                <Button variant="warning" className="ms-2" onClick={skipToNextUser}>
                  Skip to Next
                </Button>
                <Button variant="secondary" className="ms-2" onClick={goBackToHome}>
                  Home
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

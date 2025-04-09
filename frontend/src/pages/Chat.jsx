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
    // **Important:** Use 'ws://localhost:8080' for local testing with your server.
    // For deployed version, replace with your backend WebSocket URL (e.g., 'wss://your-deployed-backend.com')
    socketRef.current = new WebSocket("wss://textanon.onrender.com");
    console.log("WebSocket connecting to: ws://localhost:8080"); // Log WebSocket connection URL

    socketRef.current.onopen = () => {
      console.log("WebSocket onopen: Connected to WebSocket Server");
      socketRef.current.send(JSON.stringify({ type: "register", name }));
    };

    socketRef.current.onmessage = async (event) => {
      console.log("WebSocket onmessage event received:", event.data); // Log raw message data
      try {
        const received = event.data instanceof Blob
          ? JSON.parse(await event.data.text())
          : JSON.parse(event.data);

        if (received.type === "userID") {
          userIDRef.current = received.userID;
          console.log("Received userID from server:", received.userID, "userIDRef.current set to:", userIDRef.current); // Log userID and ref update
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
        } else if (received.type === "systemMessage") { // Handling system messages (like partner left, etc.)
          setStatus(received.text); // Update status with system message
          console.log("System Message received:", received.text);
        }
        // Add more message type handling here if needed

      } catch (err) {
        console.error("Error parsing WebSocket message:", err);
      }
    };

    socketRef.current.onerror = (err) => {
      console.error("WebSocket onerror: WebSocket error:", err);
      setStatus("Error connecting to chat server."); // Update status on error
    };

    socketRef.current.onclose = () => {
      console.log("WebSocket onclose: WebSocket closed");
      setStatus("Disconnected from chat server."); // Update status on disconnect
    };
  };

  const disconnectWebSocket = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
      console.log("WebSocket disconnected programmatically.");
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
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.warn("sendMessage: WebSocket not open, message not sent.");
      return; // Don't send if socket is not open
    }

    const messageData = {
      type: "chat",
      senderID: userIDRef.current,
      senderName: name,
      text: newMessage,
    };

    console.log("sendMessage: Sending chat message:", messageData); // Log before sending
    socketRef.current.send(JSON.stringify(messageData));
    setMessages((prev) => [...prev, messageData]);
    setNewMessage("");
  };

  const startVideoCall = () => {
    // **Important:**  The 'start_video_call' message is NOT currently handled on the server.
    // To enable video calls, you need to:
    // 1. Implement server-side logic to handle 'start_video_call' and initiate video call signaling.
    // 2. Integrate with your Video.jsx component or video call logic here.
    // For now, this button will not trigger a video call in the current setup.
    console.warn("startVideoCall: Video call functionality is not fully implemented yet.");
    // socketRef.current.send(JSON.stringify({ type: "start_video_call" })); // <-- Currently not handled on server
    alert("Video call feature is not yet fully implemented in this chat component. Please use the separate Video Call section for now."); // User feedback
  };

  const skipToNextUser = () => {
    console.log("skipToNextUser: Initiating skip to next user.");
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
    console.log("goBackToHome: Going back to home, resetting chat state.");
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
                <Button variant="success" className="ms-2" onClick={startVideoCall}> {/* Video Call Button - Not fully functional yet */}
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
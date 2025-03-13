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
  const chatContainerRef = useRef(null);
  const videoButtonRef = useRef(null);
  const footerRef = useRef(null);
  const [buttonBottom, setButtonBottom] = useState("20px");
  const socketRef = useRef(null);

  useEffect(() => {
    if (chatStarted) {
      socketRef.current = new WebSocket("ws://localhost:8080");

      socketRef.current.onopen = () => console.log("✅ Connected to WebSocket Server");

      socketRef.current.onmessage = async (event) => {
        try {
          let receivedMessage;
          
          if (event.data instanceof Blob) {
            const textData = await event.data.text();
            receivedMessage = JSON.parse(textData);
          } else {
            receivedMessage = JSON.parse(event.data);
          }

          setMessages((prevMessages) => [
            ...prevMessages,
            { sender: receivedMessage.sender || "Stranger", text: receivedMessage.text },
          ]);
        } catch (error) {
          console.error("❌ Error parsing message, treating as plain text:", error);
          
          const textMessage = event.data instanceof Blob ? await event.data.text() : event.data;
          setMessages((prevMessages) => [
            ...prevMessages,
            { sender: "Stranger", text: textMessage },
          ]);
        }
      };

      socketRef.current.onclose = () => console.log("❌ WebSocket disconnected");

      return () => {
        if (socketRef.current) {
          socketRef.current.close();
        }
      };
    }
  }, [chatStarted]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const handleScroll = () => {
      if (!footerRef.current || !videoButtonRef.current) return;
      const footerTop = footerRef.current.getBoundingClientRect().top;
      const windowHeight = window.innerHeight;

      setButtonBottom(footerTop < windowHeight - 50 ? `${windowHeight - footerTop + 20}px` : "20px");
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const startChat = () => {
    if (name.trim() !== "") {
      setChatStarted(true);
    }
  };

  const sendMessage = () => {
    if (newMessage.trim() !== "" && socketRef.current) {
      const messageData = { sender: `${name} (you)`, text: newMessage };
      socketRef.current.send(JSON.stringify(messageData));
      setMessages((prevMessages) => [...prevMessages, messageData]);
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
                      alignSelf: msg.sender.includes("(you)")
                        ? "flex-end"
                        : "flex-start",
                      backgroundColor: msg.sender.includes("(you)")
                        ? "#198754"
                        : "#0d6efd",
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

              <Button variant="success" className="mt-3 w-100">
                Skip to next
              </Button>
            </Col>
          </Row>
        )}
      </Container>

      {chatStarted && (
        <Button
          ref={videoButtonRef}
          variant="success"
          className="video-call-button"
          style={{
            position: "fixed",
            bottom: buttonBottom,
            right: "20px",
            zIndex: 1000,
            borderRadius: "50%",
            width: "50px",
            height: "50px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <FaVideo size={20} />
        </Button>
      )}

      <div ref={footerRef} style={{ position: "absolute", bottom: 0, width: "100%", height: "1px" }} />
    </div>
  );
};

export default Chat;

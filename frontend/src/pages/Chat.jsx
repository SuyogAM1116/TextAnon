import React, { useState, useEffect, useRef } from "react";
import { Container, Row, Col, Button, Form, InputGroup } from "react-bootstrap";
import { FaVideo, FaPaperPlane } from "react-icons/fa";

const Chat = () => {
  const [name, setName] = useState("");
  const [chatStarted, setChatStarted] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const chatContainerRef = useRef(null);
  const videoButtonRef = useRef(null);
  const [showVideoButton, setShowVideoButton] = useState(true);

  // Set initial chat when user picks a name
  const startChat = () => {
    if (name.trim() !== "") {
      setMessages([
        { sender: "Stranger", text: "Hi there, how are you?" },
        { sender: `${name} (you)`, text: "Good, how about you?" },
        { sender: "Stranger", text: "Fine." },
      ]);
      setChatStarted(true);
    }
  };

  // Handles sending a message
  const sendMessage = () => {
    if (newMessage.trim() !== "") {
      setMessages([...messages, { sender: `${name} (you)`, text: newMessage }]);
      setNewMessage(""); // Clear input after sending
    }
  };

  // Allows sending message with Enter key
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };

  // Detect scrolling to hide the video button when near the footer
  useEffect(() => {
    const handleScroll = () => {
      if (!videoButtonRef.current) return;
      const videoButtonRect = videoButtonRef.current.getBoundingClientRect();
      setShowVideoButton(videoButtonRect.top < window.innerHeight - 100);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className="chat-page d-flex align-items-center justify-content-center"
      style={{
        height: "100vh",
        width: "100vw",
        backgroundColor: "#1e1e1e",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Container className="text-white">
        {!chatStarted ? (
          <Row className="justify-content-center">
            <Col md={6} className="text-center p-4 bg-dark rounded">
              <h2 className="mb-3">Anonymous Chat</h2>
              <Form.Control
                type="text"
                placeholder="Choose a name"
                className="mb-3 text-center"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Button variant="success" onClick={startChat}>
                Start Chat
              </Button>
            </Col>
          </Row>
        ) : (
          <Row className="justify-content-center">
            <Col md={6} className="p-3 bg-dark rounded">
              <h2 className="text-center">Anonymous Chat</h2>

              {/* Chat Box */}
              <div
                ref={chatContainerRef}
                className="chat-box p-3 bg-secondary rounded mt-3"
                style={{
                  height: "400px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded mb-2 ${
                      msg.sender.includes("(you)")
                        ? "bg-success text-light ms-auto"
                        : "bg-dark text-light"
                    }`}
                    style={{
                      width: "fit-content",
                      maxWidth: "80%",
                      alignSelf: msg.sender.includes("(you)")
                        ? "flex-end"
                        : "flex-start",
                    }}
                  >
                    {msg.sender}: {msg.text}
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

              {/* Next Button */}
              <Button variant="success" className="mt-3 w-100">
                Next
              </Button>
            </Col>
          </Row>
        )}
      </Container>
    </div>
  );
};

export default Chat;

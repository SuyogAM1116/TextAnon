import React, { useState } from "react";
import { Container, Row, Col, Button, Form } from "react-bootstrap";
import { FaVideo } from "react-icons/fa";

const Chat = () => {
  const [name, setName] = useState("");
  const [chatStarted, setChatStarted] = useState(false);

  return (
    <div className="chat-page d-flex align-items-center justify-content-center" style={{ height: "100vh", width: "100vw", backgroundColor: "#1e1e1e" }}>
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
              <Button variant="success" onClick={() => setChatStarted(true)}>
                Start Chat
              </Button>
            </Col>
          </Row>
        ) : (
          <Row className="justify-content-center">
            <Col md={6} className="p-3 bg-dark rounded">
              <h2 className="text-center">Anonymous Chat</h2>
              <div className="chat-box p-3 bg-secondary rounded mt-3" style={{ height: "400px", overflowY: "auto" }}>
                <div className="text-light bg-dark p-2 rounded mb-2" style={{ width: "fit-content", maxWidth: "80%" }}>
                  Stranger: Hi there, how are you?
                </div>
                <div className="text-light bg-success p-2 rounded mb-2 ms-auto" style={{ width: "fit-content", maxWidth: "80%" }}>
                  {name || "You"} (you): I'm good, how about you?
                </div>
                <div className="text-light bg-dark p-2 rounded mb-2" style={{ width: "fit-content", maxWidth: "80%" }}>
                  Stranger: Fine.
                </div>
              </div>
              <Form.Control type="text" placeholder="Type a message..." className="mt-3" />
            </Col>
          </Row>
        )}
      </Container>

      {/* Video Chat Button */}
      <Button variant="light" className="position-fixed bottom-0 start-0 m-3">
        <FaVideo size={24} />
      </Button>
    </div>
  );
};

export default Chat;

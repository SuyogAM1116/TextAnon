require("dotenv").config();
const WebSocket = require("ws");

const PORT = process.env.PORT || 8080;
const server = new WebSocket.Server({ port: PORT });

console.log(`🚀 WebSocket Server started on ws://localhost:${PORT}`);

server.on("connection", (socket) => {
    console.log("✅ New client connected");

    socket.on("message", (message) => {
        const receivedMessage = message.toString(); // Convert buffer to string
        console.log(`📩 Received: ${receivedMessage}`);

        let textMessage;

        try {
            // Try to parse as JSON
            textMessage = JSON.parse(receivedMessage);
        } catch (error) {
            // If parsing fails, assume it's plain text
            textMessage = { sender: "Stranger", text: receivedMessage };
        }

        // Broadcast the message as JSON
        server.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(textMessage));
            }
        });
    });

    socket.on("close", () => console.log("❌ Client disconnected"));
});

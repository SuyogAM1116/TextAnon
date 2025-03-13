require("dotenv").config();
const WebSocket = require("ws");

const PORT = process.env.PORT || 8080;
const server = new WebSocket.Server({ port: PORT });

console.log(`🚀 WebSocket Server started on ws://localhost:${PORT}`);

let waitingUser = null; // Store a waiting user
const pairs = new Map(); // Store user pairs

server.on("connection", (socket) => {
    console.log("✅ New client connected");

    if (waitingUser) {
        // Pair with the waiting user
        const partner = waitingUser;
        pairs.set(socket, partner);
        pairs.set(partner, socket);
        waitingUser = null;

        // Notify both users
        const message = JSON.stringify({ sender: "System", text: "You are now connected to a chat partner!" });
        socket.send(message);
        partner.send(message);
    } else {
        // No waiting user, store this user
        waitingUser = socket;
        socket.send(JSON.stringify({ sender: "System", text: "Waiting for a chat partner..." }));
    }

    // Handling incoming messages
    socket.on("message", (message) => {
        try {
            const textMessage = message.toString("utf-8");
            const parsedMessage = JSON.parse(textMessage);

            const partner = pairs.get(socket);
            if (partner && partner.readyState === WebSocket.OPEN) {
                partner.send(JSON.stringify(parsedMessage));
            }
        } catch (error) {
            console.error("❌ Error parsing message:", error);
        }
    });

    // Handling user disconnection
    socket.on("close", () => {
        console.log("❌ Client disconnected");

        const partner = pairs.get(socket);
        pairs.delete(socket);

        if (partner && partner.readyState === WebSocket.OPEN) {
            partner.send(JSON.stringify({ sender: "System", text: "Your chat partner has left. Finding a new match..." }));

            // If there's no waiting user, make them wait; otherwise, pair them instantly
            if (!waitingUser) {
                waitingUser = partner;
                partner.send(JSON.stringify({ sender: "System", text: "Waiting for a new chat partner..." }));
            } else {
                // Pair with the next waiting user
                const newPartner = waitingUser;
                pairs.set(partner, newPartner);
                pairs.set(newPartner, partner);
                waitingUser = null;

                const message = JSON.stringify({ sender: "System", text: "You are now connected to a new chat partner!" });
                partner.send(message);
                newPartner.send(message);
            }
        } else {
            waitingUser = null; // Ensure no orphaned waiting users
        }

        if (partner) pairs.delete(partner);
    });

    // Handling errors
    socket.on("error", (error) => {
        console.error("⚠️ WebSocket Error:", error.message);
    });
});

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
        const partner = pairs.get(socket);
        if (partner && partner.readyState === WebSocket.OPEN) {
            try {
                // Convert Buffer to string if needed
                const textMessage = message.toString("utf-8"); 
                const parsedMessage = JSON.parse(textMessage);
    
                // Send as a string, ensuring no binary data is sent
                partner.send(JSON.stringify(parsedMessage));
            } catch (error) {
                console.error("❌ Error parsing message:", error);
            }
        }
    });

    // Handling user disconnection
    socket.on("close", () => {
        console.log("❌ Client disconnected");

        const partner = pairs.get(socket);
        
        if (partner && partner.readyState === WebSocket.OPEN) {
            partner.send(JSON.stringify({ sender: "System", text: "Your chat partner has left. You will be reconnected soon." }));
            waitingUser = partner; // Reassign the remaining user to the queue
        } else {
            waitingUser = null; // No one is left waiting
        }

        pairs.delete(socket);
        if (partner) pairs.delete(partner); // Ensure both are removed properly
    });

    // Handling errors
    socket.on("error", (error) => {
        console.error("⚠️ WebSocket Error:", error.message);
    });
});

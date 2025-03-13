require("dotenv").config();
const WebSocket = require("ws");

const PORT = process.env.PORT || 8080;
const server = new WebSocket.Server({ port: PORT });

console.log(`🚀 WebSocket Server started on ws://localhost:${PORT}`);

let waitingUser = null; // Store a waiting user
const pairs = new Map(); // Store user pairs
const clients = new Map(); // Store clients with unique user IDs

server.on("connection", (socket) => {
    const userID = Date.now().toString(); // Generate a unique user ID
    clients.set(socket, userID);

    console.log(`✅ User ${userID} connected`);

    // ✅ Send userID to client
    socket.send(
        JSON.stringify({
            type: "userID",
            userID: userID,
        })
    );

    // Handle new user connection
    if (waitingUser) {
        // Pair the waiting user with the new user
        const partner = waitingUser;
        pairs.set(socket, partner);
        pairs.set(partner, socket);
        waitingUser = null;

        // Notify both users
        const message = JSON.stringify({
            sender: "System",
            text: "You are now connected to a chat partner!",
        });
        socket.send(message);
        partner.send(message);
    } else {
        // No waiting user, set the current user as waiting
        waitingUser = socket;
        socket.send(
            JSON.stringify({
                sender: "System",
                text: "Waiting for a chat partner...",
            })
        );
    }

    // Handle incoming messages
    socket.on("message", (message) => {
        try {
            const textMessage = message.toString("utf-8");
            const parsedMessage = JSON.parse(textMessage);
            const partner = pairs.get(socket);

            if (parsedMessage.type === "chat") {
                // Forward chat messages to the connected user
                if (partner && partner.readyState === WebSocket.OPEN) {
                    partner.send(
                        JSON.stringify({
                            senderID: userID,
                            senderName: `User ${userID}`,
                            text: parsedMessage.text,
                            type: "chat",
                        })
                    );
                }
            } else if (["offer", "answer", "candidate"].includes(parsedMessage.type)) {
                // Handle WebRTC signaling messages (video call)
                if (partner && partner.readyState === WebSocket.OPEN) {
                    partner.send(JSON.stringify(parsedMessage));
                }
            }
        } catch (error) {
            console.error("❌ Error parsing message:", error);
        }
    });

    // Handle user disconnection
    socket.on("close", () => {
        console.log(`❌ User ${userID} disconnected`);
        clients.delete(socket);

        const partner = pairs.get(socket);
        pairs.delete(socket);

        if (partner && partner.readyState === WebSocket.OPEN) {
            partner.send(
                JSON.stringify({
                    sender: "System",
                    text: "Your chat partner has left. Finding a new match...",
                })
            );

            // If no waiting user, make the partner wait; otherwise, pair them instantly
            if (!waitingUser) {
                waitingUser = partner;
                partner.send(
                    JSON.stringify({
                        sender: "System",
                        text: "Waiting for a new chat partner...",
                    })
                );
            } else {
                // Pair with the next waiting user
                const newPartner = waitingUser;
                pairs.set(partner, newPartner);
                pairs.set(newPartner, partner);
                waitingUser = null;

                const message = JSON.stringify({
                    sender: "System",
                    text: "You are now connected to a new chat partner!",
                });
                partner.send(message);
                newPartner.send(message);
            }
        } else {
            waitingUser = null; // Ensure no orphaned waiting users
        }

        if (partner) pairs.delete(partner);
    });

    // Handle errors
    socket.on("error", (error) => {
        console.error("⚠️ WebSocket Error:", error.message);
    });
});

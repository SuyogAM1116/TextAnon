require("dotenv").config();
const WebSocket = require("ws");

const PORT = process.env.PORT || 8080;
const server = new WebSocket.Server({ port: PORT });

console.log(`🚀 WebSocket Server started on ws://localhost:${PORT}`);

let waitingUser = null;
const pairs = new Map();
const clients = new Map();
const usernames = new Map(); // Store userID -> username mapping

server.on("connection", (socket) => {
    const userID = Date.now().toString();
    clients.set(socket, userID);
    usernames.set(userID, `User ${userID}`); // Default name

    console.log(`✅ User ${userID} connected`);

    socket.send(JSON.stringify({ type: "userID", userID }));

    // Pair users for chat
    if (waitingUser) {
        const partner = waitingUser;
        pairs.set(socket, partner);
        pairs.set(partner, socket);
        waitingUser = null;

        // Notify both users
        const message = JSON.stringify({ sender: "System", text: "You are now connected to a chat partner!" });
        socket.send(message);
        partner.send(message);
    } else {
        waitingUser = socket;
        socket.send(JSON.stringify({ sender: "System", text: "Waiting for a chat partner..." }));
    }

    // Handle incoming messages
    socket.on("message", (message) => {
        try {
            const parsedMessage = JSON.parse(message);
            const partner = pairs.get(socket);

            if (parsedMessage.type === "register") {
                // ✅ Store user's chosen name
                usernames.set(userID, parsedMessage.name);
            } 
            else if (parsedMessage.type === "chat") {
                if (partner && partner.readyState === WebSocket.OPEN) {
                    partner.send(
                        JSON.stringify({
                            senderID: userID,
                            senderName: usernames.get(userID), // ✅ Send stored name
                            text: parsedMessage.text,
                            type: "chat",
                        })
                    );
                }
            } 
            else if (["offer", "answer", "candidate"].includes(parsedMessage.type)) {
                if (partner && partner.readyState === WebSocket.OPEN) {
                    partner.send(JSON.stringify(parsedMessage));
                }
            }
        } catch (error) {
            console.error("❌ Error parsing message:", error);
        }
    });

    // Handle disconnection
    socket.on("close", () => {
        console.log(`❌ User ${userID} disconnected`);
        clients.delete(socket);
        usernames.delete(userID);
        
        const partner = pairs.get(socket);
        pairs.delete(socket);

        if (partner && partner.readyState === WebSocket.OPEN) {
            partner.send(JSON.stringify({ sender: "System", text: "Your chat partner has left. Finding a new match..." }));

            if (!waitingUser) {
                waitingUser = partner;
                partner.send(JSON.stringify({ sender: "System", text: "Waiting for a new chat partner..." }));
            } else {
                const newPartner = waitingUser;
                pairs.set(partner, newPartner);
                pairs.set(newPartner, partner);
                waitingUser = null;

                const message = JSON.stringify({ sender: "System", text: "You are now connected to a new chat partner!" });
                partner.send(message);
                newPartner.send(message);
            }
        } else {
            waitingUser = null;
        }

        if (partner) pairs.delete(partner);
    });

    // Handle errors
    socket.on("error", (error) => {
        console.error("⚠️ WebSocket Error:", error.message);
    });
});

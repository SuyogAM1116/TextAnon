require("dotenv").config();
const WebSocket = require("ws");

const PORT = process.env.PORT || 8080;
const server = new WebSocket.Server({ port: PORT });

console.log(`🚀 WebSocket Server started on ws://localhost:${PORT}`);

let waitingUser = null;
const pairs = new Map();
const clients = new Map();
const usernames = new Map();

server.on("connection", (socket) => {
    const userID = Date.now().toString();
    clients.set(socket, userID);
    usernames.set(userID, `User ${userID}`);

    console.log(`✅ User ${userID} connected`);

    socket.send(JSON.stringify({ type: "userID", userID }));

    if (waitingUser) {
        const partner = waitingUser;
        pairs.set(socket, partner);
        pairs.set(partner, socket);
        waitingUser = null;

        const message = JSON.stringify({ type: "systemMessage", sender: "System", text: "You are now connected to a partner!" });
        socket.send(message);
        partner.send(message);

        socket.send(JSON.stringify({ type: "partnerConnected", partnerID: clients.get(partner) }));
        partner.send(JSON.stringify({ type: "partnerConnected", partnerID: userID }));

    } else {
        waitingUser = socket;
        socket.send(JSON.stringify({ type: "systemMessage", sender: "System", text: "Waiting for a partner..." }));
    }

    socket.on("message", (message) => {
        try {
            const parsedMessage = JSON.parse(message);
            const partner = pairs.get(socket);

            if (parsedMessage.type === "register") {
                usernames.set(userID, parsedMessage.name);
            } else if (parsedMessage.type === "chat") {
                if (partner && partner.readyState === WebSocket.OPEN) {
                    partner.send(
                        JSON.stringify({
                            senderID: userID,
                            senderName: usernames.get(userID),
                            text: parsedMessage.text,
                            type: "chat",
                        })
                    );
                }
            } else if (parsedMessage.type === "callUser") {
                if (partner && partner.readyState === WebSocket.OPEN) {
                    partner.send(JSON.stringify({
                        type: "hey",
                        signal: parsedMessage.signal,
                        callerID: userID
                    }));
                }
            } else if (parsedMessage.type === "acceptCall") {
                if (partner && partner.readyState === WebSocket.OPEN) {
                    partner.send(JSON.stringify({
                        type: "callAccepted",
                        signal: parsedMessage.signal
                    }));
                }
            } else if (parsedMessage.type === "ice-candidate") {
                if (partner && partner.readyState === WebSocket.OPEN) {
                    partner.send(JSON.stringify({
                        type: "ice-candidate",
                        candidate: parsedMessage.candidate
                    }));
                }
            }
        } catch (error) {
            console.error("❌ Error parsing message:", error);
            socket.send(JSON.stringify({ type: "systemMessage", sender: "System", text: "An error occurred. Please try again." }));
        }
    });

    socket.on("close", () => {
        console.log(`❌ User ${userID} disconnected`);
        clients.delete(socket);
        usernames.delete(userID);

        const partner = pairs.get(socket);
        pairs.delete(socket);

        if (partner && partner.readyState === WebSocket.OPEN) {
            partner.send(JSON.stringify({ type: "systemMessage", sender: "System", text: "Your partner has left. Finding a new match..." }));

            if (!waitingUser) {
                waitingUser = partner;
                partner.send(JSON.stringify({ type: "systemMessage", sender: "System", text: "Waiting for a new partner..." }));
            } else {
                const newPartner = waitingUser;
                pairs.set(partner, newPartner);
                pairs.set(newPartner, partner);
                waitingUser = null;

                const message = JSON.stringify({ type: "systemMessage", sender: "System", text: "You are now connected to a new partner!" });
                partner.send(message);
                newPartner.send(message);

                partner.send(JSON.stringify({ type: "partnerConnected", partnerID: clients.get(newPartner) }));
                newPartner.send(JSON.stringify({ type: "partnerConnected", partnerID: clients.get(partner) }));
            }
        } else {
            waitingUser = null;
        }

        if (partner) pairs.delete(partner);
    });

    socket.on("error", (error) => {
        console.error("⚠️ WebSocket Error:", error.message);
    });
})
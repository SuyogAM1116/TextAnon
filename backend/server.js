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

    // Pair users for chat and video (reusing same pairing logic)
    if (waitingUser) {
        const partner = waitingUser;
        pairs.set(socket, partner);
        pairs.set(partner, socket);
        waitingUser = null;

        // Notify both users about connection (for chat and potentially video)
        const message = JSON.stringify({ type: "systemMessage", sender: "System", text: "You are now connected to a partner!" });
        socket.send(message);
        partner.send(message);

        // Inform clients they are paired for video call initiation (optional, client can just try to call)
        socket.send(JSON.stringify({ type: "partnerConnected", partnerID: clients.get(partner) }));
        partner.send(JSON.stringify({ type: "partnerConnected", partnerID: userID }));

    } else {
        waitingUser = socket;
        socket.send(JSON.stringify({ type: "systemMessage", sender: "System", text: "Waiting for a partner..." }));
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
            // ✅ WebRTC Signaling: Handling offer, answer, ice-candidate, callUser, acceptCall messages
            else if (parsedMessage.type === "callUser") {
                if (partner && partner.readyState === WebSocket.OPEN) {
                    // 'callUser' is initiated by caller to callee
                    partner.send(JSON.stringify({
                        type: "hey", // Using "hey" as in your client-side code, can be renamed to "incomingCall"
                        signal: parsedMessage.signal, // Relay the signal data
                        callerID: userID // Optionally send caller's ID if needed
                    }));
                }
            }
            else if (parsedMessage.type === "acceptCall") {
                if (partner && partner.readyState === WebSocket.OPEN) {
                    // 'acceptCall' is answer from callee back to caller
                    partner.send(JSON.stringify({
                        type: "callAccepted",
                        signal: parsedMessage.signal // Relay the answer signal
                    }));
                }
            }
            else if (parsedMessage.type === "ice-candidate") { // Standard WebRTC candidate type
                if (partner && partner.readyState === WebSocket.OPEN) {
                    // Relay ICE candidates for NAT traversal
                    partner.send(JSON.stringify({
                        type: "ice-candidate",
                        candidate: parsedMessage.candidate
                    }));
                }
            }
        } catch (error) {
            console.error("❌ Error parsing message:", error);

            // Send error message back to client
            socket.send(JSON.stringify({ type: "systemMessage", sender: "System", text: "An error occurred. Please try again." }));
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
            partner.send(JSON.stringify({ type: "systemMessage", sender: "System", text: "Your partner has left. Finding a new match..." }));

            // If waitingUser is available, pair the disconnected partner with them
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

                // Inform new partners they are paired for video call (optional)
                partner.send(JSON.stringify({ type: "partnerConnected", partnerID: clients.get(newPartner) }));
                newPartner.send(JSON.stringify({ type: "partnerConnected", partnerID: clients.get(partner) }));
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
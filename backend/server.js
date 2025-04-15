require("dotenv").config();
const WebSocket = require("ws");
const http = require('http');
const express = require('express');

const PORT = process.env.PORT || 8080;

const app = express();
const httpServer = http.createServer(app);
const server = new WebSocket.Server({ server: httpServer });

console.log(`🚀 WebSocket Server started on ws://localhost:${PORT}`);

let waitingQueue = [];
const pairs = new Map();
const clients = new Map();
const usernames = new Map();
const encryptionKeys = new Map(); // Map to store encryption keys per user

function logState(event) {
    console.log(`--- Server State Log - ${event} ---`);
    console.log(`Waiting Queue Length: ${waitingQueue.length}`);
    console.log("Waiting Queue:", waitingQueue.map(socket => clients.get(socket)).join(', '));
    console.log("Pairs:", Array.from(pairs.entries()).map(([socket1, socket2]) => `(${clients.get(socket1)} <-> ${clients.get(socket2)})`).join(', '));
    console.log("Clients:", Array.from(clients.entries()).map(([socket, userID]) => `${userID}`).join(', '));
    console.log("Usernames:", Array.from(usernames.entries()).map(([userID, username]) => `${userID}: ${username}`).join(', '));
    console.log("Encryption Keys (First 8 chars):", Array.from(encryptionKeys.entries()).map(([userID, key]) => `${userID}: ${key ? key.substring(0, 8) + '...' : 'No Key'}`).join(', ')); // Log first few chars of key
    console.log("--- End State Log ---");
}

server.on("connection", (socket) => {
    const userID = Date.now().toString();
    clients.set(socket, userID);
    usernames.set(userID, `User ${userID}`);

    console.log(`✅ User ${userID} connected - ID: ${userID}`);
    socket.send(JSON.stringify({ type: "userID", userID }));

    waitingQueue.push(socket);
    pairUsers();
    logState("Connection");

    socket.on("message", (message) => {
        try {
            const parsedMessage = JSON.parse(message);
            const senderUserID = clients.get(socket);
            const partnerSocket = getPartnerSocket(socket);
            const partnerUserID = partnerSocket ? clients.get(partnerSocket) : null;

            if (parsedMessage.type === "register") {
                usernames.set(userID, parsedMessage.name);
                encryptionKeys.set(userID, parsedMessage.encryptionKey); // Store encryption key
                console.log(`👤 User ${userID} registered name: ${parsedMessage.name} and encryption key (start): ${parsedMessage.encryptionKey.substring(0, 8)}...`);
            } else if (parsedMessage.type === "chat") {
                if (partnerSocket && partnerSocket.readyState === WebSocket.OPEN && pairs.get(partnerSocket) === socket) {
                    console.log(`✉️ Encrypted message from User ${senderUserID} to Partner ${partnerUserID}`); // Log as encrypted
                    partnerSocket.send(
                        JSON.stringify({
                            senderID: userID,
                            senderName: usernames.get(userID),
                            text: parsedMessage.text, // Forward the encrypted text
                            type: "chat",
                        })
                    );
                } else {
                    console.warn(`⚠️ Partner for User ${senderUserID} not found, not open, or not paired correctly.`);
                }
            } else if (parsedMessage.type === "skip") {
                handleSkip(socket);
            } else if (parsedMessage.type === "callUser") {
                if (partnerSocket && partnerSocket.readyState === WebSocket.OPEN) {
                    partnerSocket.send(JSON.stringify({
                        type: "hey",
                        signal: parsedMessage.signal,
                        callerID: userID
                    }));
                }
            } else if (parsedMessage.type === "acceptCall") {
                if (partnerSocket && partnerSocket.readyState === WebSocket.OPEN) {
                    partnerSocket.send(JSON.stringify({
                        type: "callAccepted",
                        signal: parsedMessage.signal
                    }));
                }
            } else if (parsedMessage.type === "ice-candidate") {
                if (partnerSocket && partnerSocket.readyState === WebSocket.OPEN) {
                    partnerSocket.send(JSON.stringify({
                        type: "ice-candidate",
                        candidate: parsedMessage.candidate
                    }));
                }
            }
        } catch (error) {
            console.error("❌ Error parsing message from User:", clients.get(socket), error);
            socket.send(JSON.stringify({ type: "systemMessage", sender: "System", text: "An error occurred. Please try again." }));
        }
    });

    socket.on("close", () => {
        const userID = clients.get(socket);
        console.log(`❌ User ${userID} disconnected`);
        clients.delete(socket);
        usernames.delete(userID);
        encryptionKeys.delete(userID); // Delete encryption key on disconnect
        removeFromQueue(socket);
        handleDisconnection(socket);
        logState("Disconnection");
    });

    socket.on("error", (error) => {
        console.error("⚠️ WebSocket Error for User:", clients.get(socket), error.message);
    });
});

function pairUsers() {
    logState("pairUsers - Entry");
    while (waitingQueue.length >= 2) {
        const socket1 = waitingQueue.shift();
        const socket2 = waitingQueue.shift();

        if (!socket1 || !socket2) {
            console.warn("⚠️ pairUsers: Skipped pairing due to null socket(s).");
            continue;
        }

        if (pairs.has(socket1) || pairs.has(socket2)) {
            console.warn(`⚠️ pairUsers: Skipped pairing for ${clients.get(socket1)} and ${clients.get(socket2)} as one or both are already paired.`);
            continue;
        }

        if (socket1.readyState !== WebSocket.OPEN || socket2.readyState !== WebSocket.OPEN) {
            console.warn(`⚠️ pairUsers: Skipped pairing ${clients.get(socket1)} and ${clients.get(socket2)} because one or both sockets are not OPEN.`);
            if (socket1.readyState === WebSocket.OPEN) waitingQueue.push(socket1);
            if (socket2.readyState === WebSocket.OPEN) waitingQueue.push(socket2);
            continue;
        }

        pairs.set(socket1, socket2);
        pairs.set(socket2, socket1);

        const userID1 = clients.get(socket1);
        const userID2 = clients.get(socket2);

        // Key Sharing - User 1's key to User 2 (Simplified, not ideal security)
        const key1 = encryptionKeys.get(userID1);
        socket2.send(JSON.stringify({ type: "encryptionKey", key: key1 })); // Send User 1's key to User 2

        // Log key sharing
        console.log(`👥 Paired users: User ${userID1} and User ${userID2}. User ${userID2} received encryption key from User ${userID1} (start): ${key1.substring(0, 8)}...`);


        const message = JSON.stringify({ type: "systemMessage", sender: "System", text: "You are now connected to a partner! Messages are end-to-end encrypted." });
        socket1.send(message);
        socket2.send(message);

        socket1.send(JSON.stringify({ type: "partnerConnected", partnerID: clients.get(socket2) }));
        socket2.send(JSON.stringify({ type: "partnerConnected", partnerID: clients.get(socket1) }));
    }
    logState("pairUsers - Exit");
}

function removeFromQueue(socketToRemove) {
    waitingQueue = waitingQueue.filter(socket => socket !== socketToRemove);
}

function handleDisconnection(disconnectedSocket) {
    logState("handleDisconnection - Entry");
    const disconnectedUserID = clients.get(disconnectedSocket);
    const partnerSocket = pairs.get(disconnectedSocket);

    pairs.delete(disconnectedSocket);
    if (partnerSocket) {
        pairs.delete(partnerSocket);
    }

    if (partnerSocket && partnerSocket.readyState === WebSocket.OPEN) {
        const partnerUserID = clients.get(partnerSocket);
        console.log(`📢 Notifying partner User ${partnerUserID} about disconnection of User ${disconnectedUserID}`);
        partnerSocket.send(JSON.stringify({ type: "systemMessage", sender: "System", text: "Your partner has left. Finding a new match..." }));
        partnerSocket.send(JSON.stringify({ type: "chatEnded" }));
        waitingQueue.push(partnerSocket);
        pairUsers();
    }

    removeFromQueue(disconnectedSocket);
    logState("handleDisconnection - Exit");
}

function handleSkip(socket) {
    logState("handleSkip - Entry");
    const userID = clients.get(socket);
    const partnerSocket = pairs.get(socket);

    pairs.delete(socket);
    if (partnerSocket) {
        pairs.delete(partnerSocket);
        if (partnerSocket.readyState === WebSocket.OPEN) {
            const partnerUserID = clients.get(partnerSocket);
            console.log(`📢 Notifying partner User ${partnerUserID} about skip by User ${userID}`);
            partnerSocket.send(JSON.stringify({ type: "systemMessage", sender: "System", text: "Your partner has skipped. Finding a new match..." }));
            partnerSocket.send(JSON.stringify({ type: "chatEnded" }));
            waitingQueue.push(partnerSocket);
        }
    }

    waitingQueue.push(socket);
    pairUsers();
    logState("handleSkip - Exit");
}

function getPartnerSocket(socket) {
    return pairs.get(socket) || null;
}

httpServer.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
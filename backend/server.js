// backend/server.js (Updated to use signalingHandler)
require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

// Import your lib modules
// These are not directly used in server.js anymore if their consumers (messageHandler, etc.) import them directly.
// const { decryptMessage, encryptMessage } = require('./lib/encryption');
// const { censorMessage } = require('./lib/moderation');
const clientManager = require('./lib/clientManager');
const messageHandler = require('./lib/messageHandler');
const signalingHandler = require('./lib/signalingHandler'); // <-- Your new signaling handler

const PORT = process.env.PORT || 8080;

const app = express();
app.get('/health', (req, res) => res.status(200).send('OK'));
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: "*", // For development. Restrict for production.
        methods: ["GET", "POST"]
    }
});

// Simplified logState function
function logState(event) {
    console.log(`--- Server Event Triggered [${event}] ---`);
    // To get detailed state, clientManager could expose a getStats() function
}

console.log(`🚀 Socket.IO Server starting on port ${PORT}`);

io.on("connection", (socket) => {
    const userID = socket.id;
    console.log(`🔌 New client connected: ${userID}, from ${socket.handshake.address}`);

    clientManager.initializeClient(socket);
    logState(`Client Connected: ${userID}`);

    socket.on("register", (data) => {
        clientManager.handleRegistration(socket, data, io, logState);
    });

    socket.on("chat", (data) => {
        messageHandler.handleChatMessage(
            socket,
            data,
            clientManager.getClientData,
            clientManager.getPartnerID,
            logState
        );
    });

    socket.on("skip", () => {
        clientManager.handleSkip(socket, io, logState);
    });

    // Delegate WebRTC Signaling to signalingHandler
    socket.on("callUser", (data) => { // Expected: { signalData }
        signalingHandler.handleCallUser(
            socket,
            data,
            clientManager.getClientData,
            clientManager.getPartnerID
        );
    });

    socket.on("acceptCall", (data) => { // Expected: { signalData }
        signalingHandler.handleAcceptCall(
            socket,
            data,
            clientManager.getClientData,
            clientManager.getPartnerID
        );
    });

    socket.on("ice-candidate", (data) => { // Expected: { candidate }
        signalingHandler.handleIceCandidate(
            socket,
            data,
            clientManager.getClientData,
            clientManager.getPartnerID
        );
    });

    socket.on("disconnect", (reason) => {
        console.log(`🔌 Client disconnected: ${userID}. Reason: ${reason}`);
        clientManager.handleDisconnect(socket, io, logState);
    });

    socket.on("error", (error) => {
        console.error(`⚠️ Socket Error for User ${userID}:`, error.message);
        clientManager.handleDisconnect(socket, io, logState); // Ensure cleanup on error
    });
});

httpServer.listen(PORT, () => {
    console.log(`✅ HTTP and Socket.IO Server listening on port ${PORT}`);
});
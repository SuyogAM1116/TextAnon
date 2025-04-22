// server.js
require("dotenv").config();
const WebSocket = require("ws");
const http = require("http");
const express = require("express");

const PORT = process.env.PORT || 8080;

const app = express();
// Optional: Add basic middleware if needed later (CORS, body-parser, etc.)
// app.use(cors()); // Example if you serve HTTP content too

const httpServer = http.createServer(app);
const wss = new WebSocket.Server({ server: httpServer }); // Renamed to wss for clarity

// Define Message Types (mirroring frontend)
const MSG_TYPES = {
  // Client -> Server
  REGISTER: "register",
  SIGNAL: "signal",
  CHAT: "chat",
  LEAVE: "leave", // Client sends 'leave' when skipping or ending

  // Server -> Client
  USER_ID: "userID",
  MATCHED: "matched", // Server sends this to start peer connection
  PARTNER_LEFT: "partnerLeft", // Server sends this on disconnect/leave
  SYSTEM_MESSAGE: "systemMessage", // Optional system messages
  ERROR: "error", // Optional error messages
};


const clients = new Map(); // Map of userID -> { socket, username }
const waitingQueue = new Set(); // Set of userIDs waiting for a partner
const pairs = new Map(); // Map of userID -> partnerUserID

// --- Logging ---
// Log memory usage periodically
setInterval(() => {
  const memoryUsage = process.memoryUsage();
  console.log(
    `🧠 Memory Usage: RSS=${(memoryUsage.rss / 1024 / 1024).toFixed(2)}MB, ` +
    `HeapTotal=${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB, ` +
    `HeapUsed=${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`
  );
}, 60000); // Log every 60 seconds

console.log(`🚀 WebSocket Server starting on ws://0.0.0.0:${PORT}`);

function logState(event = "Event") {
  console.log(`\n--- Server State Log @ ${new Date().toLocaleTimeString()} (${event}) ---`);
  console.log(`Clients Connected: ${clients.size}`);
  console.log(`Waiting Queue (${waitingQueue.size}): ${Array.from(waitingQueue).join(", ")}`);
  const pairedUsers = Array.from(pairs.entries())
                      .map(([id1, id2]) => {
                          // Only list pairs once (e.g., A<->B, not B<->A too)
                          if (id1 < id2) {
                             const name1 = clients.get(id1)?.username || id1.slice(-4);
                             const name2 = clients.get(id2)?.username || id2.slice(-4);
                             return `(${name1}↔${name2})`;
                          }
                          return null;
                      })
                      .filter(p => p !== null)
                      .join(" ");
  console.log(`Active Pairs (${pairs.size / 2}): ${pairedUsers || "None"}`);
  console.log(`--- End State Log ---\n`);
}

// --- Helper Functions ---

function safeSend(socket, message) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
        return true;
    } else {
        console.warn(`⚠️ Attempted to send to closed or invalid socket.`);
        return false;
    }
}

function getPartnerInfo(userID) {
    const partnerID = pairs.get(userID);
    if (!partnerID) return null;
    const partnerClient = clients.get(partnerID);
    if (!partnerClient) {
        // Data inconsistency, partner doesn't exist in clients map? Clean up.
        console.error(`❌ Data inconsistency: Partner ${partnerID} not found for user ${userID}. Cleaning pair.`);
        pairs.delete(userID);
        // Don't delete partner's pair entry yet, handleDisconnection will do it if needed.
        return null;
    }
    return { id: partnerID, socket: partnerClient.socket };
}

// --- Core Logic ---

function pairUsers() {
  logState("pairUsers - Attempting");
  while (waitingQueue.size >= 2) {
    const [userID1, userID2] = Array.from(waitingQueue).slice(0, 2);

    const client1 = clients.get(userID1);
    const client2 = clients.get(userID2);

    // Basic checks
    if (!client1 || !client2 || !client1.socket || !client2.socket || client1.socket.readyState !== WebSocket.OPEN || client2.socket.readyState !== WebSocket.OPEN) {
        console.warn(`⚠️ pairUsers: Invalid client/socket state for ${userID1} or ${userID2}. Removing from queue.`);
        if (!client1 || client1.socket?.readyState !== WebSocket.OPEN) waitingQueue.delete(userID1);
        if (!client2 || client2.socket?.readyState !== WebSocket.OPEN) waitingQueue.delete(userID2);
        continue; // Try next pair if any
    }

    // Prevent self-pairing (shouldn't happen with Set, but safety check)
    if (userID1 === userID2) {
         console.warn(`⚠️ pairUsers: Attempted self-pairing for ${userID1}. Removing.`);
         waitingQueue.delete(userID1);
         continue;
    }

    // Remove from queue and create pair
    waitingQueue.delete(userID1);
    waitingQueue.delete(userID2);
    pairs.set(userID1, userID2);
    pairs.set(userID2, userID1);

    console.log(`\n✅ Paired: ${client1.username} (${userID1.slice(-4)}) <-> ${client2.username} (${userID2.slice(-4)})`);

    // Notify clients they are matched - CRITICAL FOR FRONTEND
    // Designate an initiator (e.g., the one with the lexicographically smaller ID)
    const user1Initiator = userID1 < userID2;

    safeSend(client1.socket, { type: MSG_TYPES.MATCHED, initiator: user1Initiator });
    safeSend(client2.socket, { type: MSG_TYPES.MATCHED, initiator: !user1Initiator });

    console.log(`🤝 Sent MATCHED to ${client1.username} (Initiator: ${user1Initiator}) and ${client2.username} (Initiator: ${!user1Initiator})`);

    // Optional: Send a system message about connection
    safeSend(client1.socket, { type: MSG_TYPES.SYSTEM_MESSAGE, text: `You are connected with ${client2.username}.`});
    safeSend(client2.socket, { type: MSG_TYPES.SYSTEM_MESSAGE, text: `You are connected with ${client1.username}.`});

  } // End while loop

  if (waitingQueue.size === 1) {
     const waitingUser = clients.get(Array.from(waitingQueue)[0]);
     if(waitingUser) {
        console.log(`⏳ User ${waitingUser.username} is waiting in queue.`);
        safeSend(waitingUser.socket, { type: MSG_TYPES.SYSTEM_MESSAGE, text: "Waiting for a partner..." });
     }
  }
  logState("pairUsers - Finished");
}

// Handles user leaving (skip) or disconnecting
function handleLeaveOrDisconnect(userID, reason = "disconnect") {
  logState(`handleLeaveOrDisconnect - ${reason} - User ${userID.slice(-4)}`);
  const client = clients.get(userID);
  if (!client) {
      console.warn(`⚠️ ${reason}: User ${userID} not found in clients map.`);
      return; // Already processed or never existed
  }

  const partnerInfo = getPartnerInfo(userID);

  // If paired, notify partner and clean up pair
  if (partnerInfo) {
    const partnerID = partnerInfo.id;
    const partnerSocket = partnerInfo.socket;

    console.log(`🔌 Unpairing ${userID.slice(-4)} and partner ${partnerID.slice(-4)} due to ${reason}.`);
    pairs.delete(userID);
    pairs.delete(partnerID); // Remove both ends of the pair

    if (safeSend(partnerSocket, { type: MSG_TYPES.PARTNER_LEFT })) {
       console.log(`📬 Sent PARTNER_LEFT to partner ${partnerID.slice(-4)}`);
       // Add the remaining partner back to the queue if their socket is still open
       if (partnerSocket.readyState === WebSocket.OPEN) {
           console.log(`📥 Adding remaining partner ${partnerID.slice(-4)} back to waiting queue.`);
           waitingQueue.add(partnerID);
       } else {
            console.log(`💨 Remaining partner ${partnerID.slice(-4)} socket not open, not adding to queue.`);
       }
    } else {
         console.log(`💨 Partner ${partnerID.slice(-4)} socket not open, couldn't send PARTNER_LEFT.`);
         // Ensure partner is removed from clients if their socket is closed (will be handled by their own 'close' event)
    }
  }

  // Remove user from waiting queue if they were there
  waitingQueue.delete(userID);

  // Remove user from the main clients map ONLY if it's a disconnect
  if (reason === "disconnect") {
      console.log(`🗑️ Removing disconnected user ${userID.slice(-4)} from clients map.`);
      clients.delete(userID);
      // No need to close socket, it's already closed/errored
  } else if (reason === "leave") {
      // If it was a 'leave' (skip), add the user back to the queue if their socket is open
      if (client.socket.readyState === WebSocket.OPEN) {
          console.log(`📥 User ${userID.slice(-4)} skipped, adding back to waiting queue.`);
          waitingQueue.add(userID);
      } else {
           console.log(`💨 User ${userID.slice(-4)} skipped but socket closed, not adding to queue.`);
           // Ensure they are fully removed if socket closed unexpectedly after leave msg
           clients.delete(userID);
      }
  }

  // Attempt to pair remaining users
  pairUsers();
  logState(`handleLeaveOrDisconnect - Finished - User ${userID.slice(-4)}`);
}


// --- WebSocket Server Event Handlers ---

wss.on("connection", (socket) => {
  // Generate unique ID
  const userID = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n🔗 Client connected: ${userID}`);

  // Store basic client info (socket only for now)
  clients.set(userID, { socket, username: `Anon_${userID.slice(-4)}` }); // Default username

  // Send the user their ID
  safeSend(socket, { type: MSG_TYPES.USER_ID, userID });

  logState("Connection");

  socket.on("message", (message) => {
    let parsedMessage;
    try {
      parsedMessage = JSON.parse(message.toString());
       console.log(`\n📩 Received from ${userID.slice(-4)} (${clients.get(userID)?.username}): Type=${parsedMessage.type}`);
    } catch (error) {
      console.error(`❌ Invalid JSON received from ${userID}:`, message.toString(), error);
      safeSend(socket, { type: MSG_TYPES.ERROR, text: "Invalid message format."});
      return;
    }

    const senderClient = clients.get(userID);
    if (!senderClient) {
        console.error(`❌ Message received from unknown user ID ${userID}`);
        return; // Should not happen
    }

    switch (parsedMessage.type) {
      case MSG_TYPES.REGISTER:
        const name = parsedMessage.name?.trim().substring(0, 20) || `Anon_${userID.slice(-4)}`; // Sanitize/limit name
        senderClient.username = name;
        console.log(`👤 User ${userID.slice(-4)} registered as: ${name}`);
        // Add to waiting queue ONLY if not already paired
        if (!pairs.has(userID)) {
            console.log(`📥 Adding ${name} (${userID.slice(-4)}) to waiting queue.`);
            waitingQueue.add(userID);
            pairUsers(); // Attempt pairing now
        } else {
             console.log(`👤 ${name} (${userID.slice(-4)}) re-registered but already paired.`);
             // Maybe update partner about name change? Optional.
        }
        break;

      case MSG_TYPES.SIGNAL: // Relay WebRTC signals (offer, answer, ICE candidates)
        const signalPartnerInfo = getPartnerInfo(userID);
        if (signalPartnerInfo && parsedMessage.signalData) {
           console.log(`📡 Relaying SIGNAL from ${userID.slice(-4)} to partner ${signalPartnerInfo.id.slice(-4)}`);
            safeSend(signalPartnerInfo.socket, {
                type: MSG_TYPES.SIGNAL,
                signalData: parsedMessage.signalData, // Forward the payload directly
            });
        } else if (!parsedMessage.signalData){
             console.warn(`⚠️ Received SIGNAL from ${userID.slice(-4)} but no signalData payload.`);
        } else {
             console.warn(`⚠️ Cannot relay SIGNAL from ${userID.slice(-4)}: No partner found or partner socket invalid.`);
             // Optionally notify sender?
             // safeSend(socket, { type: MSG_TYPES.ERROR, text: "Partner not available to receive signal."});
        }
        break;

      case MSG_TYPES.CHAT:
        const chatPartnerInfo = getPartnerInfo(userID);
        if (chatPartnerInfo && parsedMessage.text) {
            const chatText = parsedMessage.text.substring(0, 500); // Limit message length
             console.log(`💬 Relaying CHAT from ${userID.slice(-4)} ("${chatText.substring(0,20)}...") to partner ${chatPartnerInfo.id.slice(-4)}`);
            safeSend(chatPartnerInfo.socket, {
                type: MSG_TYPES.CHAT,
                text: chatText, // Only forward the text
                // Frontend will display based on receiving the message
            });
        } else if (!parsedMessage.text) {
             console.warn(`⚠️ Received CHAT from ${userID.slice(-4)} with no text.`);
        } else {
             console.warn(`⚠️ Cannot relay CHAT from ${userID.slice(-4)}: No partner found or partner socket invalid.`);
             safeSend(socket, { type: MSG_TYPES.SYSTEM_MESSAGE, text: "Your message could not be sent. No partner connected."});
        }
        break;

      case MSG_TYPES.LEAVE: // User clicked Skip or End Call
        handleLeaveOrDisconnect(userID, "leave");
        break;

      // --- Deprecated / Removed Types ---
      // case "callUser":
      // case "acceptCall":
      // case "ice-candidate":
      // case "skip": // Replaced by LEAVE
      //   console.warn(`⚠️ Received deprecated message type "${parsedMessage.type}" from ${userID}`);
      //   break;

      default:
        console.warn(`⚠️ Received unknown message type "${parsedMessage.type}" from ${userID}`);
        safeSend(socket, { type: MSG_TYPES.ERROR, text: `Unknown message type: ${parsedMessage.type}`});
    }
  });

  socket.on("close", (code, reason) => {
    console.log(`\n❌ Client disconnected: ${userID.slice(-4)} (Code: ${code}, Reason: ${reason || 'N/A'})`);
    handleLeaveOrDisconnect(userID, "disconnect");
  });

  socket.on("error", (error) => {
    console.error(`\n❌ WebSocket Error for User ${userID.slice(-4)}:`, error.message);
    // The 'close' event will usually follow an error, triggering cleanup.
    // Explicit cleanup here might be redundant but safe depending on error type.
    handleLeaveOrDisconnect(userID, "disconnect");
  });
});

// Basic HTTP endpoint (optional)
app.get("/", (req, res) => {
  res.send(`WebSocket server running. Connect at ws://${req.headers.host}`);
});

// Start the server
httpServer.listen(PORT, () => {
  console.log(`✅ HTTP Server listening on http://0.0.0.0:${PORT}`);
});
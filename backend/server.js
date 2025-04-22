require("dotenv").config();
const WebSocket = require("ws");
const http = require("http");
const express = require("express");
const CryptoJS = require("crypto-js"); // <-- Import crypto-js

const PORT = process.env.PORT || 8080;

const app = express();
const httpServer = http.createServer(app);
const server = new WebSocket.Server({ server: httpServer });

const clients = new Map(); // Map of userID to { socket, username, encryptionKey }
const waitingQueue = new Set(); // Set of userIDs
const pairs = new Map(); // Map of userID to partner userID

// --- Basic Moderation Setup ---
const forbiddenWords = new Set([
  "badword", // Add your forbidden words here (lowercase)
  "inappropriate",
  "offensive",
  "slur",
  "spamlink.com", // Example
  // Add more words as needed
]);

// Function to check message content
function isMessageInappropriate(text) {
  if (!text) return false; // Handle empty messages if necessary
  const lowerCaseText = text.toLowerCase();
  return [...forbiddenWords].some((word) => lowerCaseText.includes(word));
}
// --- End Moderation Setup ---

// Log memory usage periodically (Keep existing function)
setInterval(() => {
  const memoryUsage = process.memoryUsage();
  console.log(
    `🧠 Memory Usage: RSS=${(memoryUsage.rss / 1024 / 1024).toFixed(2)}MB, ` +
    `HeapTotal=${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB, ` +
    `HeapUsed=${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`
  );
}, 30000);

console.log(`🚀 WebSocket Server started on ws://0.0.0.0:${PORT}`);

// Keep existing logState, pairUsers, removeFromQueue, handleDisconnection, handleSkip, getPartnerSocket functions
// (No changes needed in those specific helper functions for basic moderation)
// ... (paste your existing logState, pairUsers, removeFromQueue, handleDisconnection, handleSkip, getPartnerSocket functions here) ...

// --- Paste your existing helper functions here ---
function logState(event) {
  console.log(`--- Server State Log - ${event} ---`);
  console.log(`Waiting Queue Length: ${waitingQueue.size}`);
  console.log(`Waiting Queue: ${Array.from(waitingQueue).join(", ")}`);
  console.log(
    `Pairs: ${Array.from(pairs.entries())
      .map(([userID1, userID2]) => `(${clients.get(userID1)?.username || userID1} <-> ${clients.get(userID2)?.username || userID2})`)
      .join(", ")}`
  );
  console.log(`Clients: ${Array.from(clients.keys()).join(", ")}`);
  console.log(
    `Usernames: ${Array.from(clients.entries())
      .map(([userID, { username }]) => `${userID}: ${username}`)
      .join(", ")}`
  );
  console.log(
    `Encryption Keys (First 8 chars): ${Array.from(clients.entries())
      .map(([userID, { encryptionKey }]) => `${userID}: ${encryptionKey ? encryptionKey.substring(0, 8) + "..." : "No Key"}`)
      .join(", ")}`
  );
  console.log(`--- End State Log ---`);
}

function pairUsers() {
  logState("pairUsers - Entry");
  if (waitingQueue.size < 2) {
    console.log(`⏳ pairUsers: Not enough users in queue (${waitingQueue.size})`);
    return;
  }

  const [userID1, userID2] = Array.from(waitingQueue).slice(0, 2);
  const client1 = clients.get(userID1);
  const client2 = clients.get(userID2);

  if (
    !client1?.socket ||
    !client2?.socket ||
    client1.socket.readyState !== WebSocket.OPEN ||
    client2.socket.readyState !== WebSocket.OPEN ||
    client1.socket === client2.socket
  ) {
    console.warn(`⚠️ pairUsers: Skipped pairing due to invalid or closed socket(s) for ${userID1} or ${userID2}`);
    if (!client1?.socket || client1.socket.readyState !== WebSocket.OPEN) waitingQueue.delete(userID1);
    if (!client2?.socket || client2.socket.readyState !== WebSocket.OPEN) waitingQueue.delete(userID2);
    if (client1?.socket === client2?.socket) { // Clean up if same socket somehow got added twice
         waitingQueue.delete(userID1);
         waitingQueue.delete(userID2);
         clients.delete(userID1); // Assume one is redundant
    }
    return;
  }


  if (pairs.has(userID1) || pairs.has(userID2)) {
    console.warn(`⚠️ pairUsers: Skipped pairing for ${userID1} and ${userID2} as one or both are already paired`);
    // Remove from queue if already paired to prevent retrying
    if (pairs.has(userID1)) waitingQueue.delete(userID1);
    if (pairs.has(userID2)) waitingQueue.delete(userID2);
    return;
  }

  waitingQueue.delete(userID1);
  waitingQueue.delete(userID2);
  pairs.set(userID1, userID2);
  pairs.set(userID2, userID1);

  console.log(`👥 Paired users: ${client1.username} (${userID1}) and ${client2.username} (${userID2})`);
  client1.socket.send(
    JSON.stringify({
      type: "systemMessage",
      sender: "System",
      text: `You are now connected to ${client2.username}! Messages are encrypted (server moderation applied).`, // Updated message
    })
  );
  client2.socket.send(
    JSON.stringify({
      type: "systemMessage",
      sender: "System",
      text: `You are now connected to ${client1.username}! Messages are encrypted (server moderation applied).`, // Updated message
    })
  );

  // // OPTIONAL: Send partner name/ID if needed by client
  // client1.socket.send(JSON.stringify({ type: "partnerConnected", partnerID: userID2, partnerName: client2.username }));
  // client2.socket.send(JSON.stringify({ type: "partnerConnected", partnerID: userID1, partnerName: client1.username }));

  // --- Key exchange is crucial for server-side decryption/re-encryption ---
  // Ensure both clients have keys stored on the server after registration
  // The client already sends its key during 'register'. No need to send keys between clients here
  // if they are only needed for server-side moderation decryption/re-encryption.

  logState("pairUsers - Exit");
}

function removeFromQueue(userID) {
  const existed = waitingQueue.delete(userID);
  if (existed) console.log(`🚶 User ${userID} removed from waiting queue.`);
}

function handleDisconnection(userID) {
  logState("handleDisconnection - Entry for " + userID);
  const client = clients.get(userID);
  if (!client) {
     console.log(`handleDisconnection: Client ${userID} not found.`);
     return;
  }

  const partnerID = pairs.get(userID);
  if (partnerID) {
    console.log(`💔 User ${userID} was paired with ${partnerID}. Unpairing...`);
    const partner = clients.get(partnerID);
    if (partner?.socket?.readyState === WebSocket.OPEN) {
      console.log(`📢 Notifying partner User ${partnerID} about disconnection of User ${userID}`);
      partner.socket.send(
        JSON.stringify({
          type: "systemMessage",
          sender: "System",
          text: "Your partner has left. Finding a new match...",
        })
      );
      partner.socket.send(JSON.stringify({ type: "chatEnded" })); // Tell client partner left
      // Put the remaining partner back in the queue
       if (!waitingQueue.has(partnerID)) { // Avoid adding duplicates
            console.log(`🚶 Adding partner ${partnerID} back to waiting queue.`);
            waitingQueue.add(partnerID);
            pairUsers(); // Attempt to re-pair immediately
       }
    } else {
        console.log(`Partner ${partnerID} socket not open or partner not found.`)
        // If partner also disconnected or doesn't exist, ensure they are removed from queue too
        removeFromQueue(partnerID);
    }
    pairs.delete(userID);
    pairs.delete(partnerID);
  } else {
      console.log(`User ${userID} was not paired.`);
  }

  removeFromQueue(userID); // Ensure user is removed from queue if they were waiting
  clients.delete(userID);
  console.log(`🗑️ Cleaned up client data for disconnected User ${userID}. Total clients: ${clients.size}`);

  pairUsers(); // Check if new pairs can be formed
  logState("handleDisconnection - Exit for " + userID);
}

function handleSkip(userID) {
  logState("handleSkip - Entry for " + userID);
  const client = clients.get(userID);
  if (!client) {
      console.log(`handleSkip: Client ${userID} not found.`);
      return; // User already disconnected or doesn't exist
  }

  const partnerID = pairs.get(userID);
  if (partnerID) {
      console.log(`⏭️ User ${userID} is skipping partner ${partnerID}.`);
      const partner = clients.get(partnerID);
      if (partner?.socket?.readyState === WebSocket.OPEN) {
          console.log(`📢 Notifying partner User ${partnerID} about skip by User ${userID}`);
          partner.socket.send(
              JSON.stringify({
                  type: "systemMessage",
                  sender: "System",
                  text: "Your partner has skipped. Finding a new match...",
              })
          );
          partner.socket.send(JSON.stringify({ type: "chatEnded" })); // Treat skip like a disconnect for the partner
          // Add the skipped partner back to the queue
          if (!waitingQueue.has(partnerID)) { // Avoid duplicates
            console.log(`🚶 Adding skipped partner ${partnerID} back to waiting queue.`);
            waitingQueue.add(partnerID);
          }
      } else {
          console.log(`Skipped partner ${partnerID} socket not open or partner not found.`);
          // Ensure they are removed from queue if they weren't open
          removeFromQueue(partnerID);
      }
      pairs.delete(userID);
      pairs.delete(partnerID);
  } else {
      console.log(`User ${userID} tried to skip but was not paired.`);
      // If user was waiting, just ensure they stay waiting or re-add if necessary?
      // Usually, a skip implies being paired, so this case might indicate a state inconsistency.
  }

  // Add the skipping user back to the queue if their socket is still open
  if (client.socket.readyState === WebSocket.OPEN) {
      if (!waitingQueue.has(userID)) { // Avoid duplicates
        console.log(`🚶 Adding skipping user ${userID} back to waiting queue.`);
        waitingQueue.add(userID);
      }
  } else {
      // If the skipper's socket is closed, handle as disconnect instead
      console.log(`User ${userID} socket closed during skip attempt. Handling as disconnect.`);
      handleDisconnection(userID); // Let disconnect logic handle cleanup
      return; // Exit handleSkip early
  }

  pairUsers(); // Attempt to form new pairs
  logState("handleSkip - Exit for " + userID);
}

function getPartnerSocket(userID) {
  const partnerID = pairs.get(userID);
  if (!partnerID) return null;
  const partnerClient = clients.get(partnerID);
  return partnerClient?.socket;
}

// --- End Helper Functions ---


server.on("connection", (socket) => {
  // Assign a unique ID upon connection. Could use a library like 'uuid' for more robustness.
  const userID = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  clients.set(userID, { socket, username: `User...${userID.slice(-4)}`, encryptionKey: null }); // Initialize with null key
  console.log(`✅ User connected - Assigned Temp ID: ${userID}`);

  // Send the assigned userID back to the client immediately
  socket.send(JSON.stringify({ type: "userID", userID }));
  logState(`Connection: ${userID}`);

  socket.on("message", (message) => {
    let parsedMessage;
    try {
      // Ensure message is parsed correctly, handle potential binary data if needed
      parsedMessage = JSON.parse(message.toString());
    } catch (error) {
      console.error(`❌ Error parsing message from User ${userID}: ${message.toString()}`, error);
      // Optionally send an error back to the client
      if (socket.readyState === WebSocket.OPEN) {
           socket.send(JSON.stringify({ type: "systemMessage", text: "Error processing your message." }));
      }
      return; // Stop processing this message
    }

    const senderClient = clients.get(userID); // Get sender's data using the established userID
    if (!senderClient) {
        console.error(`⚠️ Received message from unknown or disconnected userID: ${userID}. Ignoring.`);
        return;
    }

    // Log received message type for debugging
    console.log(`📬 [${userID} (${senderClient.username})] Received type: ${parsedMessage.type}`);

    try { // Wrap main logic in try-catch for better error handling per message
      switch (parsedMessage.type) {
        case "register":
          const newUsername = parsedMessage.name || `User...${userID.slice(-4)}`;
          const providedKey = parsedMessage.encryptionKey;
          clients.set(userID, {
            ...senderClient, // Keep existing socket
            username: newUsername,
            encryptionKey: providedKey, // Store the key
          });
          console.log(
            `👤 User ${userID} registered name: ${newUsername} and encryption key ${providedKey ? `(start: ${providedKey.substring(0, 8)}...)` : "(No Key Provided!)"}`
          );
          if (!providedKey) {
              console.warn(`⚠️ User ${userID} registered without providing an encryption key! Moderation/Messaging might fail.`);
              // Optionally disconnect or prompt user? For now, we log.
          }

          // Add to waiting queue only if not already paired and key is present
          if (!pairs.has(userID) && providedKey) {
            if (!waitingQueue.has(userID)) { // Prevent adding duplicates
                 console.log(`📥 Adding User ${userID} (${newUsername}) to waiting queue`);
                 waitingQueue.add(userID);
                 pairUsers();
            } else {
                 console.log(`User ${userID} already in waiting queue.`);
            }
          } else if (pairs.has(userID)) {
             console.log(`User ${userID} registered but is already paired.`);
          } else if (!providedKey) {
             console.log(`User ${userID} registered without key, not adding to queue yet.`);
             // Maybe send a message back asking for the key?
             socket.send(JSON.stringify({ type: "systemMessage", text: "Registration received, but encryption key missing. Chat disabled." }));
          }
          logState(`Register: ${userID}`);
          break;

        case "chat":
          const partnerID = pairs.get(userID);
          const partnerClient = partnerID ? clients.get(partnerID) : null;

          if (!senderClient.encryptionKey) {
              console.warn(`⚠️ User ${userID} tried to send chat without a registered encryption key.`);
              socket.send(JSON.stringify({ type: "systemMessage", text: "Cannot send message: Encryption key missing." }));
              break; // Don't proceed
          }
          if (!partnerClient || partnerClient.socket.readyState !== WebSocket.OPEN) {
            console.warn(`⚠️ User ${userID} tried to send chat, but partner ${partnerID || 'N/A'} not found or not connected.`);
            // Optional: Notify sender their partner is gone
             socket.send(JSON.stringify({ type: "systemMessage", text: "Your partner is not connected." }));
            break;
          }
           if (!partnerClient.encryptionKey) {
               console.warn(`⚠️ Partner ${partnerID} is missing their encryption key. Cannot re-encrypt message for them.`);
               socket.send(JSON.stringify({ type: "systemMessage", text: "Cannot send message: Partner key missing." }));
               break;
           }


          // --- MODERATION LOGIC ---
          let decryptedText;
          try {
            const bytes = CryptoJS.AES.decrypt(parsedMessage.text, senderClient.encryptionKey);
            decryptedText = bytes.toString(CryptoJS.enc.Utf8);
            if (!decryptedText) {
              // Decryption might yield empty string for various reasons (wrong key, corrupted data)
              throw new Error("Decryption resulted in empty text");
            }
            console.log(`💬 [${userID} -> ${partnerID}] Decrypted: "${decryptedText.substring(0, 30)}..."`);
          } catch (e) {
            console.error(`❌ Decryption failed for message from ${userID}:`, e.message);
            // Notify sender? Block message? For now, log and block.
            socket.send(JSON.stringify({ type: "systemMessage", text: "Error processing your message (decryption failed)." }));
            break; // Stop processing this message
          }

          if (isMessageInappropriate(decryptedText)) {
            console.warn(`🚫 Moderation Blocked message from ${userID} (${senderClient.username}) to ${partnerID}: "${decryptedText}"`);
            // Send notification ONLY to the sender
            socket.send(JSON.stringify({
              type: "moderation_blocked", // Specific type for client handling
              reason: "Your message was blocked due to inappropriate content.",
              originalText: decryptedText, // Optionally send back for user context (consider privacy)
            }));
          } else {
            // Message is clean, re-encrypt for partner and send
            try {
                const encryptedForPartner = CryptoJS.AES.encrypt(decryptedText, partnerClient.encryptionKey).toString();

                console.log(`✅ Relaying moderated message from ${userID} to ${partnerID}`);
                partnerClient.socket.send(
                    JSON.stringify({
                    senderID: userID,
                    senderName: senderClient.username,
                    text: encryptedForPartner, // Send re-encrypted text
                    type: "chat",
                    timestamp: parsedMessage.timestamp || Date.now(), // Pass along timestamp
                    })
                );
            } catch (encError) {
                console.error(`❌ Re-encryption failed for message to ${partnerID}:`, encError.message);
                socket.send(JSON.stringify({ type: "systemMessage", text: "Error sending message (encryption failed)." }));
            }
          }
          // --- END MODERATION LOGIC ---
          break;

        case "skip":
          handleSkip(userID);
          break;

        // Keep your existing WebRTC signaling handlers
        case "callUser":
        case "acceptCall":
        case "ice-candidate":
          const webrtcPartnerID = pairs.get(userID);
          const webrtcPartnerClient = webrtcPartnerID ? clients.get(webrtcPartnerID) : null;
          if (webrtcPartnerClient?.socket?.readyState === WebSocket.OPEN) {
             console.log(`📡 Relaying WebRTC message type '${parsedMessage.type}' from ${userID} to ${webrtcPartnerID}`);
              // Forward the message, ensuring necessary fields like signal/candidate/callerID are present
              const forwardMessage = { ...parsedMessage };
              if (parsedMessage.type === 'callUser') forwardMessage.callerID = userID; // Ensure callerID is set
              if (parsedMessage.type === 'ice-candidate') forwardMessage.senderID = userID; // Identify sender for candidate if needed

              webrtcPartnerClient.socket.send(JSON.stringify(forwardMessage));
          } else {
             console.warn(`⚠️ WebRTC message type '${parsedMessage.type}' from ${userID} - Partner ${webrtcPartnerID || 'N/A'} not available.`);
              // Notify sender if appropriate (e.g., for callUser)
              if (parsedMessage.type === 'callUser') {
                   socket.send(JSON.stringify({ type: "systemMessage", text: "Cannot initiate call: Partner not connected." }));
              }
          }
          break;

        default:
          console.warn(`❓ Unknown message type received from ${userID}: ${parsedMessage.type}`);
          // Optional: Send an 'unknown command' message back
           socket.send(JSON.stringify({ type: "systemMessage", text: `Unknown command type: ${parsedMessage.type}` }));
      }
    } catch(messageProcessingError) {
         console.error(`❌ Unexpected error processing message type ${parsedMessage?.type} from ${userID}:`, messageProcessingError);
         if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: "systemMessage", text: "An internal server error occurred." }));
         }
    }
  });

  socket.on("close", (code, reason) => {
    console.log(`❌ User ${userID} disconnected - Code: ${code}, Reason: ${reason?.toString()}`);
    handleDisconnection(userID); // Use the existing robust disconnect handler
  });

  socket.on("error", (error) => {
    console.error(`⚠️ WebSocket Error for User ${userID}:`, error.message);
    // Error often precedes close, handleDisconnection will be called by the 'close' event
    // However, if the connection persists after error, we might need cleanup here too.
    // Let's ensure disconnection is triggered.
    handleDisconnection(userID);
  });
});

httpServer.listen(PORT, () => {
  console.log(`✅ HTTP Server listening on port ${PORT}, WebSocket server is attached.`);
});
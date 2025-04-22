require("dotenv").config();
const WebSocket = require("ws");
const http = require("http");
const express = require("express");
const crypto = require("crypto");

const PORT = process.env.PORT || 8080;

const app = express();
const httpServer = http.createServer(app);
const server = new WebSocket.Server({ server: httpServer });

const clients = new Map(); // Map of userID to { socket, username, encryptionKey, isMuted, muteUntil }
const waitingQueue = new Set(); // Set of userIDs
const pairs = new Map(); // Map of userID to partner userID

// Custom list of bad words (customize as needed)
const badWords = [
  "damn",
  "hell",
  "shit",
  "fuck",
  "bitch",
  "asshole"
];

// Log memory usage periodically
setInterval(() => {
  const memoryUsage = process.memoryUsage();
  console.log(
    `🧠 Memory Usage: RSS=${(memoryUsage.rss / 1024 / 1024).toFixed(2)}MB, ` +
    `HeapTotal=${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB, ` +
    `HeapUsed=${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`
  );
}, 30000); // Log every 30 seconds

console.log(`🚀 WebSocket Server started on ws://0.0.0.0:${PORT}`);

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
  console.log(
    `Muted Users: ${Array.from(clients.entries())
      .filter(([_, { isMuted }]) => isMuted)
      .map(([userID, { username }]) => `${userID}: ${username}`)
      .join(", ")}`
  );
  console.log(`--- End State Log ---`);
}

function decryptMessage(encryptedText, key) {
  try {
    // Validate inputs
    if (!key || typeof key !== "string" || !/^[0-9a-fA-F]{64}$/.test(key)) {
      throw new Error(`Invalid key: must be 64-character hex string, got ${key}`);
    }
    if (!encryptedText || typeof encryptedText !== "string") {
      throw new Error("Invalid encrypted text: must be non-empty string");
    }

    // Log raw input for debugging
    console.log(`Decrypting Input: EncryptedText="${encryptedText.substring(0, 20)}...", Length=${encryptedText.length}`);

    // Decode base64
    let encryptedBuffer;
    try {
      encryptedBuffer = Buffer.from(encryptedText, "base64");
    } catch (e) {
      throw new Error(`Invalid base64 encoding: ${e.message}`);
    }
    console.log(`Decrypting Decoded: BufferLength=${encryptedBuffer.length}`);
    if (encryptedBuffer.length < 16) {
      throw new Error(`Encrypted text too short: got ${encryptedBuffer.length} bytes, expected at least 16`);
    }

    // Extract IV (first 16 bytes) and ciphertext
    const iv = encryptedBuffer.slice(0, 16);
    const ciphertext = encryptedBuffer.slice(16);
    if (ciphertext.length === 0) {
      throw new Error("No ciphertext after IV");
    }

    // Decrypt
    const keyBuffer = Buffer.from(key, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", keyBuffer, iv);
    let decrypted = decipher.update(ciphertext, "binary", "utf8");
    decrypted += decipher.final("utf8");

    console.log(`Decrypting Success: IV=${iv.toString("hex").substring(0, 8)}..., CiphertextLength=${ciphertext.length}, Decrypted="${decrypted.substring(0, 10)}..."`);
    return decrypted;
  } catch (e) {
    console.error(`Decryption Error: ${e.message}, EncryptedText="${encryptedText.substring(0, 20)}..."`);
    return null;
  }
}

function censorMessage(text) {
  let censoredText = text;
  let hasBadWords = false;
  badWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    if (regex.test(censoredText)) {
      hasBadWords = true;
    }
    censoredText = censoredText.replace(regex, "*".repeat(word.length));
  });
  const isEmpty = !censoredText || censoredText.trim() === "";
  console.log(`Censoring: Input="${text.substring(0, 10)}...", Output="${censoredText.substring(0, 10)}...", HasBadWords=${hasBadWords}, IsEmpty=${isEmpty}`);
  return { censoredText, hasBadWords, isEmpty };
}

function encryptMessage(text, key) {
  try {
    // Validate inputs
    if (!key || typeof key !== "string" || !/^[0-9a-fA-F]{64}$/.test(key)) {
      throw new Error(`Invalid key: must be 64-character hex string, got ${key}`);
    }
    if (!text || typeof text !== "string" || text.trim() === "") {
      throw new Error(`Invalid text: must be non-empty string, got "${text}"`);
    }

    // Log input for debugging
    console.log(`Encrypting Input: Text="${text.substring(0, 10)}...", Key=${key.substring(0, 8)}...`);

    // Generate random IV
    const iv = crypto.randomBytes(16);
    const keyBuffer = Buffer.from(key, "hex");
    const cipher = crypto.createCipheriv("aes-256-cbc", keyBuffer, iv);
    let encrypted = cipher.update(text, "utf8", "binary");
    encrypted += cipher.final("binary");
    encrypted = Buffer.from(encrypted, "binary");

    // Validate ciphertext
    if (encrypted.length === 0) {
      throw new Error("Encryption produced empty ciphertext");
    }

    // Combine IV and ciphertext
    const output = Buffer.concat([iv, encrypted]);
    const base64Output = output.toString("base64");

    console.log(`Encrypting Success: IV=${iv.toString("hex").substring(0, 8)}..., CiphertextLength=${encrypted.length}, OutputLength=${base64Output.length}, Output="${base64Output.substring(0, 20)}..."`);
    return base64Output;
  } catch (e) {
    console.error(`Encryption Error: ${e.message}, Text="${text ? text.substring(0, 10) : ""}..."`);
    return null;
  }
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
    waitingQueue.delete(userID1);
    waitingQueue.delete(userID2);
    return;
  }

  if (pairs.has(userID1) || pairs.has(userID2)) {
    console.warn(`⚠️ pairUsers: Skipped pairing for ${userID1} and ${userID2} as one or both are already paired`);
    waitingQueue.delete(userID1);
    waitingQueue.delete(userID2);
    return;
  }

  waitingQueue.delete(userID1);
  waitingQueue.delete(userID2);
  pairs.set(userID1, userID2);
  pairs.set(userID2, userID1);

  console.log(`👥 Paired users: ${client1.username} and ${client2.username}`);
  client1.socket.send(
    JSON.stringify({
      type: "systemMessage",
      sender: "System",
      text: "You are now connected to a partner! Messages are end-to-end encrypted.",
    })
  );
  client2.socket.send(
    JSON.stringify({
      type: "systemMessage",
      sender: "System",
      text: "You are now connected to a partner! Messages are end-to-end encrypted.",
    })
  );

  client1.socket.send(JSON.stringify({ type: "partnerConnected", partnerID: userID2 }));
  client2.socket.send(JSON.stringify({ type: "partnerConnected", partnerID: userID1 }));

  // Use a shared encryption key for both users
  const sharedKey = client1.encryptionKey && /^[0-9a-fA-F]{64}$/.test(client1.encryptionKey)
    ? client1.encryptionKey
    : crypto.randomBytes(32).toString("hex");
  if (sharedKey) {
    client1.socket.send(JSON.stringify({ type: "encryptionKey", key: sharedKey }));
    client2.socket.send(JSON.stringify({ type: "encryptionKey", key: sharedKey }));
    console.log(
      `🔑 Shared encryption key for ${userID1} and ${userID2}: ${sharedKey.substring(0, 8)}...`
    );
    // Update clients with shared key
    clients.set(userID1, { ...client1, encryptionKey: sharedKey });
    clients.set(userID2, { ...client2, encryptionKey: sharedKey });
  } else {
    console.warn(`⚠️ No valid encryption key available for pairing ${userID1} and ${userID2}`);
  }

  logState("pairUsers - Exit");
}

function removeFromQueue(userID) {
  waitingQueue.delete(userID);
}

function handleDisconnection(userID) {
  logState("handleDisconnection - Entry");
  const client = clients.get(userID);
  if (!client) return;

  const partnerID = pairs.get(userID);
  if (partnerID) {
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
      partner.socket.send(JSON.stringify({ type: "chatEnded" }));
      waitingQueue.add(partnerID);
    }
    pairs.delete(userID);
    pairs.delete(partnerID);
  }

  removeFromQueue(userID);
  clients.delete(userID);

  pairUsers();
  logState("handleDisconnection - Exit");
}

function handleSkip(userID) {
  logState("handleSkip - Entry");
  const client = clients.get(userID);
  if (!client) return;

  const partnerID = pairs.get(userID);
  if (partnerID) {
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
      partner.socket.send(JSON.stringify({ type: "chatEnded" }));
      waitingQueue.add(partnerID);
    }
    pairs.delete(userID);
    pairs.delete(partnerID);
  }

  if (client.socket.readyState === WebSocket.OPEN) {
    waitingQueue.add(userID);
  }
  pairUsers();
  logState("handleSkip - Exit");
}

function getPartnerSocket(userID) {
  const partnerID = pairs.get(userID);
  return partnerID ? clients.get(partnerID)?.socket : null;
}

function muteUser(userID, duration = 300000) {
  const client = clients.get(userID);
  if (client) {
    client.isMuted = true;
    client.muteUntil = Date.now() + duration;
    client.socket.send(
      JSON.stringify({
        type: "mute",
        text: `You have been muted for ${duration / 60000} minutes due to inappropriate content.`,
        duration
      })
    );
    console.log(`🔇 User ${userID} muted for ${duration / 60000} minutes`);
    setTimeout(() => {
      if (clients.has(userID)) {
        clients.get(userID).isMuted = false;
        clients.get(userID).muteUntil = null;
        console.log(`🔊 User ${userID} unmuted`);
      }
    }, duration);
  }
}

server.on("connection", (socket) => {
  const userID = Date.now().toString();
  clients.set(userID, { socket, username: `User ${userID}`, encryptionKey: null, isMuted: false, muteUntil: null });
  console.log(`✅ User ${userID} connected - ID: ${userID}`);
  socket.send(JSON.stringify({ type: "userID", userID }));
  logState("Connection");

  socket.on("message", (message) => {
    try {
      const parsedMessage = JSON.parse(message.toString());
      const senderUserID = userID;
      const partnerSocket = getPartnerSocket(userID);
      const partnerUserID = partnerSocket ? clients.get(pairs.get(userID))?.username : null;

      if (parsedMessage.type === "register") {
        const encryptionKey = parsedMessage.encryptionKey && /^[0-9a-fA-F]{64}$/.test(parsedMessage.encryptionKey)
          ? parsedMessage.encryptionKey
          : crypto.randomBytes(32).toString("hex");
        clients.set(userID, {
          socket,
          username: parsedMessage.name || `User ${userID}`,
          encryptionKey,
          isMuted: false,
          muteUntil: null
        });
        console.log(
          `👤 User ${userID} registered name: ${parsedMessage.name}, encryption key: ${encryptionKey.substring(0, 8)}...`
        );
        if (socket.readyState === WebSocket.OPEN && !pairs.has(userID)) {
          console.log(`📥 Adding User ${userID} to waiting queue`);
          waitingQueue.add(userID);
          pairUsers();
        }
      } else if (parsedMessage.type === "chat") {
        const client = clients.get(userID);
        if (client.isMuted && client.muteUntil > Date.now()) {
          socket.send(
            JSON.stringify({
              type: "moderationWarning",
              text: "You are muted and cannot send messages."
            })
          );
          return;
        }
        // Decrypt message for moderation
        const decryptedText = decryptMessage(parsedMessage.text, client.encryptionKey);
        if (!decryptedText) {
          socket.send(
            JSON.stringify({
              type: "systemMessage",
              text: "Message decryption failed on server."
            })
          );
          return;
        }
        // Censor bad words
        const { censoredText, hasBadWords, isEmpty } = censorMessage(decryptedText);
        if (hasBadWords) {
          socket.send(
            JSON.stringify({
              type: "moderationWarning",
              text: "Inappropriate message detected. Please avoid offensive language."
            })
          );
          muteUser(userID); // Mute user for 5 minutes
          return;
        }
        // Validate censored text
        if (isEmpty) {
          socket.send(
            JSON.stringify({
              type: "systemMessage",
              text: "Message is empty or invalid after censorship."
            })
          );
          return;
        }
        // Re-encrypt censored text for sending
        const encryptedCensoredText = encryptMessage(censoredText, client.encryptionKey);
        if (!encryptedCensoredText) {
          socket.send(
            JSON.stringify({
              type: "systemMessage",
              text: "Message encryption failed on server."
            })
          );
          return;
        }
        if (partnerSocket?.readyState === WebSocket.OPEN && pairs.get(pairs.get(userID)) === userID) {
          console.log(`✉️ Encrypted message from User ${senderUserID} to Partner ${partnerUserID}`);
          partnerSocket.send(
            JSON.stringify({
              senderID: userID,
              senderName: clients.get(userID).username,
              text: encryptedCensoredText,
              type: "chat",
              timestamp: parsedMessage.timestamp
            })
          );
        } else {
          console.warn(`⚠️ Partner for User ${senderUserID} not found, not open, or not paired correctly`);
        }
      } else if (parsedMessage.type === "skip") {
        handleSkip(userID);
      } else if (parsedMessage.type === "callUser") {
        if (partnerSocket?.readyState === WebSocket.OPEN) {
          console.log(`📞 User ${senderUserID} is initiating a video call to Partner ${partnerUserID} with signal:`, parsedMessage.signal);
          partnerSocket.send(
            JSON.stringify({
              type: "hey",
              signal: parsedMessage.signal,
              callerID: userID,
            })
          );
        } else {
          console.warn(`⚠️ No valid partner for User ${senderUserID} to initiate video call`);
          socket.send(
            JSON.stringify({
              type: "systemMessage",
              sender: "System",
              text: "No partner available to start the video call.",
            })
          );
        }
      } else if (parsedMessage.type === "acceptCall") {
        if (partnerSocket?.readyState === WebSocket.OPEN) {
          console.log(`✅ User ${senderUserID} accepted video call from Partner ${partnerUserID} with signal:`, parsedMessage.signal);
          partnerSocket.send(
            JSON.stringify({
              type: "callAccepted",
              signal: parsedMessage.signal,
            })
          );
        } else {
          console.warn(`⚠️ No valid partner for User ${senderUserID} to accept video call`);
          socket.send(
            JSON.stringify({
              type: "systemMessage",
              sender: "System",
              text: "No partner available to accept the video call.",
            })
          );
        }
      } else if (parsedMessage.type === "ice-candidate") {
        if (partnerSocket?.readyState === WebSocket.OPEN) {
          console.log(`🧊 User ${senderUserID} sending ICE candidate to Partner ${partnerUserID}:`, parsedMessage.candidate);
          partnerSocket.send(
            JSON.stringify({
              type: "ice-candidate",
              candidate: parsedMessage.candidate,
            })
          );
        } else {
          console.warn(`⚠️ No valid partner for User ${senderUserID} to send ICE candidate`);
        }
      }
    } catch (error) {
      console.error(`❌ Error processing message from User ${userID}:`, error.message);
      socket.send(
        JSON.stringify({
          type: "systemMessage",
          sender: "System",
          text: "An error occurred. Please try again.",
        })
      );
    }
  });

  socket.on("close", () => {
    console.log(`❌ User ${userID} disconnected`);
    handleDisconnection(userID);
  });

  socket.on("error", (error) => {
    console.error(`⚠️ WebSocket Error for User ${userID}:`, error.message);
    handleDisconnection(userID);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
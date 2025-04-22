require("dotenv").config();
const WebSocket = require("ws");
const http = require("http");
const express = require("express");

const PORT = process.env.PORT || 8080;

const app = express();
const httpServer = http.createServer(app);
const server = new WebSocket.Server({ server: httpServer });

const clients = new Map(); // Map of userID to { socket, username, encryptionKey }
const waitingQueue = new Set(); // Set of userIDs
const pairs = new Map(); // Map of userID to partner userID

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

  // Send encryption key from user1 to user2
  const key1 = client1.encryptionKey;
  if (key1) {
    client2.socket.send(JSON.stringify({ type: "encryptionKey", key: key1 }));
    console.log(
      `🔑 User ${userID2} received encryption key from User ${userID1} (start): ${key1.substring(0, 8)}...`
    );
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

server.on("connection", (socket) => {
  const userID = Date.now().toString();
  clients.set(userID, { socket, username: `User ${userID}`, encryptionKey: null });
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
        clients.set(userID, {
          socket,
          username: parsedMessage.name || `User ${userID}`,
          encryptionKey: parsedMessage.encryptionKey || "default-key",
        });
        console.log(
          `👤 User ${userID} registered name: ${parsedMessage.name} and encryption key (start): ${
            parsedMessage.encryptionKey ? parsedMessage.encryptionKey.substring(0, 8) + "..." : "No Key"
          }`
        );
        if (socket.readyState === WebSocket.OPEN && !pairs.has(userID)) {
          console.log(`📥 Adding User ${userID} to waiting queue`);
          waitingQueue.add(userID);
          pairUsers();
        }
      } else if (parsedMessage.type === "chat") {
        if (partnerSocket?.readyState === WebSocket.OPEN && pairs.get(pairs.get(userID)) === userID) {
          console.log(`✉️ Encrypted message from User ${senderUserID} to Partner ${partnerUserID}`);
          partnerSocket.send(
            JSON.stringify({
              senderID: userID,
              senderName: clients.get(userID).username,
              text: parsedMessage.text,
              type: "chat",
            })
          );
        } else {
          console.warn(`⚠️ Partner for User ${senderUserID} not found, not open, or not paired correctly`);
        }
      } else if (parsedMessage.type === "skip") {
        handleSkip(userID);
      } else if (parsedMessage.type === "callUser") {
        if (partnerSocket?.readyState === WebSocket.OPEN) {
          console.log(`📞 User ${senderUserID} is initiating a video call to Partner ${partnerUserID}`);
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
          console.log(`✅ User ${senderUserID} accepted video call from Partner ${partnerUserID}`);
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
          console.log(`🧊 User ${senderUserID} sending ICE candidate to Partner ${partnerUserID}`);
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
      console.error(`❌ Error processing message from User ${userID}:`, error);
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
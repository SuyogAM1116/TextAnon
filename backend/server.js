require("dotenv").config();
const WebSocket = require("ws");
const http = require("http");
const express = require("express");
const crypto = require("crypto"); // Use Node.js built-in crypto

const PORT = process.env.PORT || 8080;

const app = express();
app.get('/health', (req, res) => res.status(200).send('OK'));
const httpServer = http.createServer(app);
const wss = new WebSocket.Server({ server: httpServer });

// Updated clients map - removed mute fields
const clients = new Map(); // Map: userID -> { socket, username, encryptionKey (hex string) }
const waitingQueue = new Set(); // Set: userIDs waiting for a partner
const pairs = new Map(); // Map: userID -> partnerUserID

// Expanded list of bad words (customize as needed) - Ensure client list is similar
const badWords = [
    "damn", "hell", "shit", "fuck", "fuk", "bitch", "asshole", "cunt",
    "dick", "pussy", "slut", "whore", "nigger", "nigga", "ass"
];
const badWordRegex = new RegExp(`\\b(${badWords.join('|')})\\b`, 'gi'); // Build regex once

// Log memory usage periodically
setInterval(() => {
    const memoryUsage = process.memoryUsage();
    console.log(
        `[Memory Usage] RSS=${(memoryUsage.rss / 1024 / 1024).toFixed(2)}MB, ` +
        `HeapTotal=${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB, ` +
        `HeapUsed=${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`
    );
}, 60000); // Log every 60 seconds

console.log(`🚀 WebSocket Server starting on port ${PORT}`);

function logState(event) {
    console.log(`--- Server State [${event}] ---`);
    console.log(`Clients Connected: ${clients.size}`);
    console.log(`Waiting Queue (${waitingQueue.size}): ${Array.from(waitingQueue).join(", ") || 'Empty'}`);
    const pairList = Array.from(pairs.entries())
        .map(([userID1, userID2]) => {
            if (userID1 < userID2) {
                return `(${clients.get(userID1)?.username || userID1} <-> ${clients.get(userID2)?.username || userID2})`;
            }
            return null;
        })
        .filter(p => p !== null)
        .join(", ") || 'None';
    console.log(`Active Pairs (${Array.from(pairs.keys()).length / 2}): ${pairList}`);
    // Muted user logging removed
    console.log(`--- End State ---`);
}


// --- Encryption/Decryption Functions (Unchanged) ---

function decryptMessage(encryptedBase64, keyHex) {
    try {
        if (!keyHex || typeof keyHex !== 'string' || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
            throw new Error(`Invalid decryption key format`);
        }
        if (!encryptedBase64 || typeof encryptedBase64 !== 'string') {
            throw new Error("Invalid encrypted text: must be non-empty base64 string");
        }
        const encryptedBuffer = Buffer.from(encryptedBase64, "base64");
        if (encryptedBuffer.length < 32) {
            throw new Error(`Encrypted data too short: ${encryptedBuffer.length} bytes, expected at least 32`);
        }
        const iv = encryptedBuffer.slice(0, 16);
        const ciphertext = encryptedBuffer.slice(16);
        if (ciphertext.length === 0) {
            throw new Error("No ciphertext data after IV extraction");
        }
        const keyBuffer = Buffer.from(keyHex, "hex");
        const decipher = crypto.createDecipheriv("aes-256-cbc", keyBuffer, iv);
        let decrypted = decipher.update(ciphertext);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        const decryptedUtf8 = decrypted.toString("utf8");
        // console.log(`Decrypt Success: DecryptedText="${decryptedUtf8.substring(0, 30)}..."`);
        return decryptedUtf8;
    } catch (e) {
        console.error(`Decryption Error: ${e.message}. Input: "${encryptedBase64.substring(0, 20)}...", Key: ${keyHex?.substring(0,8)}...`);
        return null;
    }
}

function encryptMessage(text, keyHex) {
    try {
        if (!keyHex || typeof keyHex !== 'string' || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
            throw new Error(`Invalid encryption key format`);
        }
        if (typeof text !== 'string') { // Allow empty string now
             text = ''; // Default to empty if not string
             console.warn("Encrypting non-string input as empty string.");
        }
        // console.log(`Encrypting Input Text: "${text.substring(0, 30)}...", Key: ${keyHex.substring(0,8)}...`);
        const iv = crypto.randomBytes(16);
        const keyBuffer = Buffer.from(keyHex, "hex");
        const cipher = crypto.createCipheriv("aes-256-cbc", keyBuffer, iv);
        let encrypted = cipher.update(text, "utf8");
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        const outputBuffer = Buffer.concat([iv, encrypted]);
        const base64Output = outputBuffer.toString("base64");
        // console.log(`Encrypt Success: OutputB64="${base64Output.substring(0, 20)}..."`);
        return base64Output;
    } catch (e) {
        console.error(`Encryption Error: ${e.message}. Text: "${text ? text.substring(0, 30) : ''}...", Key: ${keyHex?.substring(0,8)}...`);
        return null;
    }
}


// --- Moderation Function (Unchanged logic, but no mute consequence) ---

function censorMessage(text) {
    if (!text || typeof text !== 'string') {
        return { censoredText: text, hasBadWords: false, isEmpty: !text };
    }
    let hasBadWords = false;
    badWordRegex.lastIndex = 0; // Reset regex state

    const censoredText = text.replace(badWordRegex, (match) => {
        hasBadWords = true;
        return '*'.repeat(match.length);
    });

    const isEmpty = !censoredText || censoredText.trim() === "";
    // if (hasBadWords) {
    //     console.log(`Censoring: Input="${text.substring(0, 20)}...", Output="${censoredText.substring(0, 20)}...", HasBadWords=${hasBadWords}, IsEmpty=${isEmpty}`);
    // }
    return { censoredText, hasBadWords, isEmpty };
}

// --- Mute Function Removed ---
// function muteUser(...) { ... }


// --- Pairing and Connection Logic (Unchanged, but client data simplified) ---

function pairUsers() {
    while (waitingQueue.size >= 2) {
        const userIDs = Array.from(waitingQueue);
        const userID1 = userIDs[0];
        const userID2 = userIDs[1];

        const client1 = clients.get(userID1);
        const client2 = clients.get(userID2);

        if (!client1 || client1.socket.readyState !== WebSocket.OPEN || pairs.has(userID1)) {
            console.warn(`⚠️ Removing invalid user ${userID1} from queue.`);
            waitingQueue.delete(userID1);
            continue;
        }
        if (!client2 || client2.socket.readyState !== WebSocket.OPEN || pairs.has(userID2)) {
            console.warn(`⚠️ Removing invalid user ${userID2} from queue.`);
            waitingQueue.delete(userID2);
            continue;
        }

        waitingQueue.delete(userID1);
        waitingQueue.delete(userID2);
        pairs.set(userID1, userID2);
        pairs.set(userID2, userID1);

        const sharedKey = crypto.randomBytes(32).toString("hex");
        client1.encryptionKey = sharedKey;
        client2.encryptionKey = sharedKey;

        console.log(`✅ Paired users: ${client1.username} (${userID1}) <-> ${client2.username} (${userID2})`);
        console.log(`🔑 Assigned shared key: ${sharedKey.substring(0, 8)}... for pair ${userID1}/${userID2}`);

        // Notify clients
        const connectMsg1 = { type: "systemMessage", text: `You are now connected with ${client2.username}! Messages are end-to-end encrypted.` };
        const partnerConnectMsg1 = { type: "partnerConnected", partnerID: userID2, partnerName: client2.username };
        const keyMsg1 = { type: "encryptionKey", key: sharedKey };
        safeSend(client1.socket, connectMsg1);
        safeSend(client1.socket, partnerConnectMsg1);
        safeSend(client1.socket, keyMsg1);

        const connectMsg2 = { type: "systemMessage", text: `You are now connected with ${client1.username}! Messages are end-to-end encrypted.` };
        const partnerConnectMsg2 = { type: "partnerConnected", partnerID: userID1, partnerName: client1.username };
        const keyMsg2 = { type: "encryptionKey", key: sharedKey };
        safeSend(client2.socket, connectMsg2);
        safeSend(client2.socket, partnerConnectMsg2);
        safeSend(client2.socket, keyMsg2);

        logState("Pairing Success");
    }
}

function handleDisconnection(userID) {
    const client = clients.get(userID);
    if (!client) return;

    console.log(`❌ User ${client.username || userID} disconnected.`);
    const partnerID = pairs.get(userID);

    if (partnerID) {
        const partner = clients.get(partnerID);
        if (partner && partner.socket.readyState === WebSocket.OPEN) {
            console.log(`📢 Notifying partner ${partner.username || partnerID} about disconnection.`);
            safeSend(partner.socket, { type: "systemMessage", text: "Your partner has disconnected. Finding a new match..." });
            safeSend(partner.socket, { type: "chatEnded" });
            partner.encryptionKey = null; // Reset partner's key
            if (!waitingQueue.has(partnerID)) {
                waitingQueue.add(partnerID);
                console.log(`📥 Adding partner ${partner.username || partnerID} back to queue.`);
            }
        }
        pairs.delete(userID);
        pairs.delete(partnerID);
    }

    waitingQueue.delete(userID);
    clients.delete(userID);

    logState("Disconnection");
    pairUsers(); // Try to pair remaining users
}

function handleSkip(userID) {
    const client = clients.get(userID);
    if (!client) return;

    console.log(`⏩ User ${client.username || userID} requested skip.`);
    const partnerID = pairs.get(userID);

    if (partnerID) {
        const partner = clients.get(partnerID);
        if (partner && partner.socket.readyState === WebSocket.OPEN) {
            console.log(`📢 Notifying partner ${partner.username || partnerID} about skip.`);
            safeSend(partner.socket, { type: "systemMessage", text: "Your partner skipped. Finding a new match..." });
            safeSend(partner.socket, { type: "chatEnded" });
            partner.encryptionKey = null; // Reset partner's key
            if (!waitingQueue.has(partnerID)) {
                waitingQueue.add(partnerID);
                console.log(`📥 Adding skipped partner ${partner.username || partnerID} back to queue.`);
            }
        }
        pairs.delete(userID);
        pairs.delete(partnerID);
    } else {
        waitingQueue.delete(userID); // Remove from queue if they were waiting
    }

    // Reset skipper's key and put back in queue if connected
    client.encryptionKey = null;
    // Mute reset removed
    if (client.socket.readyState === WebSocket.OPEN) {
        if (!waitingQueue.has(userID)) {
            waitingQueue.add(userID);
            console.log(`📥 Adding skipper ${client.username || userID} back to queue.`);
            safeSend(client.socket, { type: "systemMessage", text: "Finding a new partner..." });
        }
    } else {
         // If socket closed during skip, ensure cleanup
         handleDisconnection(userID);
    }

    logState("Skip Request");
    pairUsers(); // Try to pair users
}

// Utility to safely send JSON (Unchanged)
function safeSend(socket, data) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        try {
            socket.send(JSON.stringify(data));
            return true;
        } catch (error) {
            console.error("Error sending JSON:", error);
            return false;
        }
    }
    return false;
}

// --- WebSocket Server Event Handling ---
wss.on("connection", (socket, req) => {
    const tempID = crypto.randomBytes(8).toString('hex');
    let userID = tempID;
    console.log(`🔌 New connection attempt from ${req.socket.remoteAddress}, TempID: ${tempID}`);

    // Store socket temporarily - Client data simplified (no mute fields)
    clients.set(userID, { socket, username: `User-${tempID}`, encryptionKey: null });

    socket.on("message", (messageBuffer) => {
        let parsedMessage;
        try {
            parsedMessage = JSON.parse(messageBuffer.toString());
            const clientData = clients.get(userID);

            if (!clientData && parsedMessage.type !== 'register') { // Allow register message even if clientData somehow missing initially
                 console.warn(`⚠️ Message received from unknown user ${userID}. Type: ${parsedMessage?.type}`);
                 return;
            }

            switch (parsedMessage.type) {
                case "register":
                    const assignedUserID = userID; // Use the ID assigned on connection
                    const username = parsedMessage.name ? parsedMessage.name.trim().substring(0, 20) : `User-${assignedUserID}`;

                    // Update client data - ensure socket is the current one
                    clients.set(assignedUserID, {
                         ...(clients.get(assignedUserID) || {}), // Keep existing fields if any, mainly for the key if re-registering while paired?
                         socket: socket, // Ensure current socket is stored
                         username: username,
                         // encryptionKey should be null until paired
                    });

                    console.log(`👤 User ${username} (${assignedUserID}) registered.`);
                    safeSend(socket, { type: "userID", userID: assignedUserID });

                    if (!pairs.has(assignedUserID)) {
                        if (!waitingQueue.has(assignedUserID)) {
                            waitingQueue.add(assignedUserID);
                            console.log(`📥 Added ${username} (${assignedUserID}) to waiting queue.`);
                            safeSend(socket, { type: "systemMessage", text: "Waiting for a partner..." });
                        }
                        pairUsers();
                    } else {
                         console.log(`👤 User ${username} (${assignedUserID}) re-registered while paired.`);
                         // Resend partner info and key if they re-register after connection drop/reconnect
                         const partnerID = pairs.get(assignedUserID);
                         const partnerData = clients.get(partnerID);
                         const currentKey = clientData.encryptionKey || clients.get(assignedUserID)?.encryptionKey; // Use existing key

                         if (partnerData && currentKey) {
                             console.log(`👥 Resending pairing info to reconnected user ${username}`);
                             safeSend(socket, { type: "partnerConnected", partnerID: partnerID, partnerName: partnerData.username });
                             safeSend(socket, { type: "encryptionKey", key: currentKey });
                         } else {
                             // If partner is gone or key missing, treat as skip/disconnect
                             console.warn(`⚠️ Re-registered user ${username} has no partner/key, forcing skip.`);
                             handleSkip(assignedUserID);
                         }
                    }
                    logState("User Registered");
                    break;

                case "chat":
                    // Mute check removed
                    const senderData = clients.get(userID); // Get current sender data
                     if (!senderData) { // Check again inside handler
                        console.warn(`⚠️ Chat message from unknown user ${userID}.`);
                        return;
                    }
                    const partnerID = pairs.get(userID);
                    const partnerData = partnerID ? clients.get(partnerID) : null;

                    if (!partnerData || partnerData.socket.readyState !== WebSocket.OPEN) {
                        console.warn(`⚠️ User ${senderData.username} tried to chat without active partner.`);
                        safeSend(socket, { type: "systemMessage", text: "You are not connected to a partner." });
                         if (!waitingQueue.has(userID) && !pairs.has(userID)) waitingQueue.add(userID);
                         pairUsers();
                        return;
                    }
                    if (!senderData.encryptionKey) {
                         console.error(`❌ CRITICAL: User ${senderData.username} has no encryption key but is paired! Forcing skip.`);
                         safeSend(socket, { type: "systemMessage", text: "Error: Secure connection lost. Reconnecting..." });
                         handleSkip(userID);
                         return;
                    }

                    const decryptedText = decryptMessage(parsedMessage.text, senderData.encryptionKey);
                    if (decryptedText === null) {
                        console.warn(`⚠️ Failed decrypt message from ${senderData.username}.`);
                        safeSend(socket, { type: "systemMessage", text: "Error processing message." });
                        return;
                    }

                    // Censor the decrypted text
                    const { censoredText, hasBadWords, isEmpty } = censorMessage(decryptedText);

                    if (isEmpty) {
                        console.log(`🗑️ Message from ${senderData.username} empty/invalid after censor.`);
                        safeSend(socket, { type: "systemMessage", text: "Message empty or could not be sent." });
                        // No mute penalty anymore
                        return;
                    }
                     if (hasBadWords) {
                        console.log(`🚫 Bad words detected from ${senderData.username}. Message censored.`);
                        // Optional: Send a *non-muting* warning?
                        // safeSend(socket, { type: "systemMessage", text: "Your message was censored due to inappropriate language." });
                    }


                    // Re-encrypt the censored text
                    const encryptedCensoredText = encryptMessage(censoredText, senderData.encryptionKey);
                    if (encryptedCensoredText === null) {
                         console.error(`❌ CRITICAL: Failed re-encrypt message for ${senderData.username}.`);
                         safeSend(socket, { type: "systemMessage", text: "Error sending message." });
                         return;
                    }

                    // Send the censored, re-encrypted message to the partner
                    const messageToSend = {
                        type: "chat",
                        senderID: userID,
                        senderName: senderData.username,
                        text: encryptedCensoredText, // Use censored encrypted text
                        timestamp: parsedMessage.timestamp || Date.now(),
                        id: parsedMessage.id
                    };
                    if (!safeSend(partnerData.socket, messageToSend)) {
                        console.warn(`⚠️ Failed send message to partner ${partnerData.username}.`);
                        safeSend(socket, { type: "systemMessage", text: "Could not deliver message."});
                    } else {
                         // console.log(`✉️ Relayed ${hasBadWords ? 'censored ' : ''}message from ${senderData.username} to ${partnerData.username}`);
                    }
                    break;

                case "skip":
                    handleSkip(userID);
                    break;

                // Video call signaling unchanged (still placeholder)
                case "callUser":
                case "acceptCall":
                case "ice-candidate":
                    const signalPartnerID = pairs.get(userID);
                    const signalPartnerData = signalPartnerID ? clients.get(signalPartnerID) : null;
                    if (signalPartnerData && signalPartnerData.socket.readyState === WebSocket.OPEN) {
                        // console.log(`📞 Relaying ${parsedMessage.type} from ${userID} to ${signalPartnerID}`);
                        safeSend(signalPartnerData.socket, { ...parsedMessage, senderID: userID });
                    } else {
                        console.warn(`⚠️ Cannot relay ${parsedMessage.type}: Partner ${signalPartnerID} unavailable.`);
                        safeSend(socket, { type: "systemMessage", text: "Partner not available for video signal." });
                    }
                    break;

                default:
                    console.warn(`❓ Unknown message type from ${userID}: ${parsedMessage.type}`);
                    safeSend(socket, {type: "systemMessage", text: `Unknown message type: ${parsedMessage.type}`});
            }

        } catch (error) {
            console.error(`❌ Error processing message from User ${userID}:`, error);
            if (socket.readyState === WebSocket.OPEN && parsedMessage) { // Avoid sending error on JSON parse fail
               safeSend(socket, { type: "systemMessage", text: "Error processing request." });
            }
        }
    });

    socket.on("close", (code, reason) => {
        console.log(`🔌 Connection closed for User ${clients.get(userID)?.username || userID}. Code: ${code}, Reason: ${reason?.toString()}`);
        handleDisconnection(userID);
    });

    socket.on("error", (error) => {
        console.error(`⚠️ WebSocket Error for User ${clients.get(userID)?.username || userID}:`, error.message);
        handleDisconnection(userID); // Trigger cleanup on error too
    });
});

httpServer.listen(PORT, () => {
    console.log(`✅ HTTP Server listening on port ${PORT}`);
});
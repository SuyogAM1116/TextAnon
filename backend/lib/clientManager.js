// backend/lib/clientManager.js
const crypto = require('crypto');

const clients = new Map(); // Map: userID -> { socket: socketObject, username, encryptionKey }
const waitingQueue = new Set(); // Set: userIDs waiting for a partner
const pairs = new Map(); // Map: userID -> partnerUserID

// Function to log the current state (can be called from server.js if clientManager is passed or if stats are exposed)
// For now, internal logging within functions will be used.
function logCurrentStateDetailed(eventName = "Detailed State") { // Optional detailed logger
    console.log(`\n--- [ClientManager DETAILED STATE @ ${eventName}] ---`);
    const clientDetails = Array.from(clients.entries()).map(([id, data]) => ({id, username: data.username, pairedWith: pairs.get(id) || 'None'}));
    console.log(`Clients (${clients.size}):`, JSON.stringify(clientDetails, null, 2));
    const waitingUserDetails = Array.from(waitingQueue).map(uid => ({id: uid, username: clients.get(uid)?.username || 'N/A'}));
    console.log(`Waiting Queue (${waitingQueue.size}):`, JSON.stringify(waitingUserDetails, null, 2));
    const pairDetails = [];
    const seenPairs = new Set();
    pairs.forEach((partnerId, userId) => {
        const pairKey = [userId, partnerId].sort().join('-');
        if (!seenPairs.has(pairKey)) {
            pairDetails.push({ 
                user1: {id: userId, name: clients.get(userId)?.username || 'N/A'}, 
                user2: {id: partnerId, name: clients.get(partnerId)?.username || 'N/A'} 
            });
            seenPairs.add(pairKey);
        }
    });
    console.log(`Pairs (${pairDetails.length}):`, JSON.stringify(pairDetails, null, 2));
    console.log(`--- End Detailed State ---\n`);
}


function initializeClient(socket) {
    const userID = socket.id;
    clients.set(userID, {
        socket: socket,
        username: `User-${userID.substring(0, 6)}`, // Default username
        encryptionKey: null
    });
    // Corrected Log:
    console.log(`[ClientManager] Client initialized: User-${userID.substring(0, 6)} (${userID})`);
    // logCurrentStateDetailed(`After InitializeClient for ${userID}`); // Optional: for very detailed debugging
}

function handleRegistration(socket, registrationData, io, logStateFunc) { // logStateFunc is server's main logger
    const userID = socket.id;
    const clientData = clients.get(userID);

    if (!clientData) {
        console.warn(`[ClientManager] Registration attempt for unknown socket ID: ${userID}`);
        return;
    }

    const username = registrationData.name ? registrationData.name.trim().substring(0, 20) : clientData.username;
    clientData.username = username;
    // Corrected Log:
    console.log(`[ClientManager] User '${username}' (${userID}) registered.`);
    socket.emit("userID", { userID: userID });

    if (pairs.has(userID)) {
        console.log(`[ClientManager] User '${username}' (${userID}) re-registered while already paired with '${clients.get(pairs.get(userID))?.username || pairs.get(userID)}'. Resending info.`);
        const partnerID = pairs.get(userID);
        const partnerData = clients.get(partnerID);
        if (partnerData && clientData.encryptionKey) {
            socket.emit("partnerConnected", { partnerID: partnerID, partnerName: partnerData.username });
            socket.emit("encryptionKey", { key: clientData.encryptionKey });
        }
    } else if (!waitingQueue.has(userID)) {
        waitingQueue.add(userID);
        console.log(`[ClientManager] Added '${username}' (${userID}) to waiting queue.`);
        socket.emit("systemMessage", { text: "Waiting for a partner..." });
    } else {
        console.log(`[ClientManager] User '${username}' (${userID}) was already in waiting queue.`);
    }
    
    // logCurrentStateDetailed(`Before pairUsers in Register for ${username}`);
    pairUsers(io, logStateFunc); // Attempt to pair
    if (logStateFunc) logStateFunc(`User Registered: ${username} (${userID})`); // Call main server logState
}

function pairUsers(io, logStateFunc) {
    // console.log(`[ClientManager] Attempting to pair. Waiting Queue (${waitingQueue.size}): ${Array.from(waitingQueue).map(uid => clients.get(uid)?.username || uid)}`);
    
    let pairedThisRound = false;
    while (waitingQueue.size >= 2) {
        const userIDs = Array.from(waitingQueue);
        const userID1 = userIDs[0];
        const userID2 = userIDs[1];

        const client1 = clients.get(userID1);
        const client2 = clients.get(userID2);

        // Robust checks before pairing
        if (!client1 || !client1.socket || client1.socket.disconnected || pairs.has(userID1)) {
            console.warn(`[ClientManager] Pre-pair check: User1 ${client1?.username || userID1} invalid or already paired. Removing from queue.`);
            waitingQueue.delete(userID1); continue;
        }
        if (!client2 || !client2.socket || client2.socket.disconnected || pairs.has(userID2)) {
            console.warn(`[ClientManager] Pre-pair check: User2 ${client2?.username || userID2} invalid or already paired. Removing from queue.`);
            waitingQueue.delete(userID2); continue; 
        }

        console.log(`[ClientManager] Pairing '${client1.username}' (${userID1}) with '${client2.username}' (${userID2})`);
        waitingQueue.delete(userID1);
        waitingQueue.delete(userID2);
        pairs.set(userID1, userID2);
        pairs.set(userID2, userID1);

        const sharedKey = crypto.randomBytes(32).toString("hex");
        client1.encryptionKey = sharedKey;
        client2.encryptionKey = sharedKey;

        console.log(`[ClientManager] Paired users: '${client1.username}' (${userID1}) <-> '${client2.username}' (${userID2})`);

        client1.socket.emit("partnerConnected", { partnerID: userID2, partnerName: client2.username });
        client1.socket.emit("encryptionKey", { key: sharedKey });
        client1.socket.emit("systemMessage", { text: `You are now connected with ${client2.username}!` });

        client2.socket.emit("partnerConnected", { partnerID: userID1, partnerName: client1.username });
        client2.socket.emit("encryptionKey", { key: sharedKey });
        client2.socket.emit("systemMessage", { text: `You are now connected with ${client1.username}!` });
        
        pairedThisRound = true;
        if (logStateFunc) logStateFunc(`Pairing Success: ${client1.username} & ${client2.username}`);
    }
    // if (pairedThisRound) logCurrentStateDetailed("After a pairing round in pairUsers");
}

function handleGenericLeave(socket, io, logStateFunc, leaveType) {
    const userID = socket.id;
    const client = clients.get(userID);

    if (!client) {
        console.warn(`[ClientManager ${leaveType}] Event for unknown or already removed user: ${userID}`);
        return;
    }
    console.log(`[ClientManager ${leaveType}] User '${client.username}' (${userID}) initiated ${leaveType}.`);
    // logCurrentStateDetailed(`Start of ${leaveType} for ${client.username}`);

    const partnerID = pairs.get(userID);

    if (partnerID) {
        const partner = clients.get(partnerID);
        console.log(`[CM ${leaveType}] '${client.username}' was paired with '${partner?.username || partnerID}'. Notifying partner.`);
        if (partner && partner.socket && !partner.socket.disconnected) {
            const message = leaveType === "skip" ? "Your partner skipped. Finding a new match..." : "Your partner has disconnected. Finding a new match...";
            partner.socket.emit("systemMessage", { text: message });
            partner.socket.emit("chatEnded"); 
            partner.encryptionKey = null;

            // Re-queue partner only if they are still valid and not already paired/waiting
            if (clients.has(partnerID) && !pairs.has(partnerID) && !waitingQueue.has(partnerID)) {
                waitingQueue.add(partnerID);
                console.log(`[CM ${leaveType}] Added partner '${partner.username}' back to waiting queue.`);
            } else {
                console.log(`[CM ${leaveType}] Partner '${partner.username}' not re-queued (already handled or invalid).`);
            }
        }
        pairs.delete(partnerID); // Remove partner's specific pair entry
    }
    
    // Cleanup current user
    pairs.delete(userID); 
    waitingQueue.delete(userID); 
    client.encryptionKey = null;

    if (leaveType === "disconnect") {
        clients.delete(userID); 
        console.log(`[CM Disconnect] '${client.username}' fully removed from clients map.`);
    } else if (leaveType === "skip" && client.socket && !client.socket.disconnected) {
        if(!pairs.has(userID) && !waitingQueue.has(userID)){ // Only add back if truly free
            waitingQueue.add(userID);
            console.log(`[CM Skip] Adding skipper '${client.username}' back to queue.`);
            socket.emit("systemMessage", { text: "Finding a new partner..." });
        }
    }
    
    // logCurrentStateDetailed(`End of ${leaveType} for ${client.username}, before pairUsers`);
    if (logStateFunc) logStateFunc(`${leaveType} by server for ${client.username}`);
    pairUsers(io, logStateFunc);
}

function handleSkip(socket, io, logStateFunc) {
    handleGenericLeave(socket, io, logStateFunc, "skip");
}

function handleDisconnect(socket, io, logStateFunc) {
    handleGenericLeave(socket, io, logStateFunc, "disconnect");
}

function getClientData(userID) {
    return clients.get(userID);
}

function getPartnerID(userID) {
    return pairs.get(userID);
}

module.exports = {
    initializeClient,
    handleRegistration,
    handleSkip,
    handleDisconnect,
    getClientData,
    getPartnerID,
};
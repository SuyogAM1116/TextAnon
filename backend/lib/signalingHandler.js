// backend/lib/signalingHandler.js

// This module doesn't need encryption or moderation, but it needs clientManager functions.

function handleCallUser(socket, data, getClientDataFunc, getPartnerIDFunc) {
    const userID = socket.id;
    const partnerID = getPartnerIDFunc(userID);
    const partnerClientData = partnerID ? getClientDataFunc(partnerID) : null;

    if (partnerClientData && partnerClientData.socket && !partnerClientData.socket.disconnected) {
        console.log(`[SignalingHandler] Relaying 'call-user' (offer) from ${userID} to ${partnerID}`);
        partnerClientData.socket.emit("call-user", { signal: data.signalData, from: userID });
    } else {
        socket.emit("systemMessage", { text: "Partner not available for video call." });
        console.warn(`[SignalingHandler] callUser: Partner ${partnerID} for ${userID} not found or disconnected.`);
    }
}

function handleAcceptCall(socket, data, getClientDataFunc, getPartnerIDFunc) {
    const userID = socket.id;
    const partnerID = getPartnerIDFunc(userID); // User accepting is userID, partner is the original caller.
    const partnerClientData = partnerID ? getClientDataFunc(partnerID) : null;

    if (partnerClientData && partnerClientData.socket && !partnerClientData.socket.disconnected) {
        console.log(`[SignalingHandler] Relaying 'call-accepted' (answer) from ${userID} to ${partnerID}`);
        partnerClientData.socket.emit("call-accepted", { signal: data.signalData, from: userID });
    } else {
        socket.emit("systemMessage", { text: "Partner not available to accept call." });
        console.warn(`[SignalingHandler] acceptCall: Partner ${partnerID} for ${userID} not found or disconnected.`);
    }
}

function handleIceCandidate(socket, data, getClientDataFunc, getPartnerIDFunc) {
    const userID = socket.id;
    const partnerID = getPartnerIDFunc(userID);
    const partnerClientData = partnerID ? getClientDataFunc(partnerID) : null;

    if (partnerClientData && partnerClientData.socket && !partnerClientData.socket.disconnected) {
        // console.log(`[SignalingHandler] Relaying 'ice-candidate' from ${userID} to ${partnerID}`);
        partnerClientData.socket.emit("ice-candidate", { candidate: data.candidate, from: userID });
    } else {
        // console.warn(`[SignalingHandler] ice-candidate: Partner ${partnerID} for ${userID} not found or disconnected. Candidate not relayed.`);
        // Usually, you might not send a system message for ICE, as many candidates are sent.
    }
}

module.exports = {
    handleCallUser,
    handleAcceptCall,
    handleIceCandidate
};
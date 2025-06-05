// backend/lib/messageHandler.js
const { decryptMessage, encryptMessage } = require('./encryption');
const { censorMessage } = require('./moderation');

function handleChatMessage(socket, data, getClientDataFunc, getPartnerIDFunc, logStateFunc) {
    const userID = socket.id;
    const senderData = getClientDataFunc(userID);

    if (!senderData) {
        console.warn(`[MessageHandler] Chat message from unknown user: ${userID}`);
        return;
    }

    const partnerID = getPartnerIDFunc(userID);
    const partnerClientData = partnerID ? getClientDataFunc(partnerID) : null;

    if (!partnerClientData || !partnerClientData.socket || partnerClientData.socket.disconnected) {
        socket.emit("systemMessage", { text: "You are not connected to a partner. Please wait..." });
        // Potentially trigger a re-queue via clientManager if the server.js doesn't handle it based on this return
        // For now, messageHandler will just report that partner is not available.
        // The server.js's chat handler might call clientManager.handleSkip if this occurs.
        console.warn(`[MessageHandler] User ${userID} tried to chat but partner ${partnerID} is unavailable.`);
        return; // Indicate failure or specific status if needed
    }

    if (!senderData.encryptionKey) {
        socket.emit("systemMessage", { text: "Error: Secure connection lost. Please wait..." });
        console.error(`[MessageHandler] User ${userID} has no encryption key but is paired with ${partnerID}.`);
        // This is a critical state. Server.js might call clientManager.handleSkip.
        return; // Indicate failure
    }

    const decryptedText = decryptMessage(data.text, senderData.encryptionKey);
    if (decryptedText === null) {
        socket.emit("systemMessage", { text: "Error processing your message (d)." });
        return;
    }

    const { censoredText, hasBadWords, isEmpty } = censorMessage(decryptedText);

    if (isEmpty) {
        socket.emit("systemMessage", { text: "Your message was empty or could not be sent." });
        return;
    }
    if (hasBadWords) {
        socket.emit("systemMessage", { text: "Your message was censored due to inappropriate language." });
    }

    const encryptedCensoredText = encryptMessage(censoredText, senderData.encryptionKey);
    if (encryptedCensoredText === null) {
        socket.emit("systemMessage", { text: "Error sending your message (e)." });
        return;
    }

    const messageToSend = {
        senderID: userID,
        senderName: senderData.username,
        text: encryptedCensoredText,
        timestamp: data.timestamp || Date.now(),
        id: data.id // Forward the client-generated message ID if present
    };

    partnerClientData.socket.emit("chat", messageToSend);
    if (logStateFunc) logStateFunc(`Chat Message Relayed from ${userID} to ${partnerID}`);
}

module.exports = {
    handleChatMessage
};
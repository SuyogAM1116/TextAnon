const crypto = require("crypto");

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

module.exports = {
    decryptMessage,
    encryptMessage
};
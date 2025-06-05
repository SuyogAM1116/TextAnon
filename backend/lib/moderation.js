// Expanded list of bad words (customize as needed) - Ensure client list is similar
const badWords = [
    "damn", "hell", "shit", "fuck", "fuk", "bitch", "asshole", "cunt",
    "dick", "pussy", "slut", "whore", "nigger", "nigga", "ass"
];

const badWordRegex = new RegExp(`\\b(${badWords.join('|')})\\b`, 'gi'); // Build regex once

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

module.exports = {
    censorMessage
};
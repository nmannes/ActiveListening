const { getUpdates } = require('./telegram');

async function main() {
    console.log("Fetching updates from Telegram...");
    try {
        const updates = await getUpdates();
        
        if (!updates.ok) {
            console.error("Error from Telegram API:", updates.description);
            return;
        }

        if (updates.result.length === 0) {
            console.log("No updates found. Have you sent a message to the bot yet?");
            console.log("Please search for your bot, tap 'Start', and send a message.");
            return;
        }

        console.log("\nRecent messages received:");
        updates.result.forEach(update => {
            if (update.message) {
                const chat = update.message.chat;
                const from = update.message.from;
                const text = update.message.text;
                
                console.log("---");
                console.log(`From: ${from.first_name} ${from.last_name || ""} (@${from.username || "N/A"})`);
                console.log(`Chat ID: ${chat.id}`);
                console.log(`Message: ${text}`);
            }
        });

        const lastChatId = updates.result[updates.result.length - 1].message.chat.id;
        console.log("\n========================================");
        console.log(`YOUR CHAT ID: ${lastChatId}`);
        console.log("========================================\n");
        console.log("Save this ID and add it to your .env file as TELEGRAM_MY_ID.");

    } catch (error) {
        console.error("Failed to fetch updates:", error.message);
    }
}

main();

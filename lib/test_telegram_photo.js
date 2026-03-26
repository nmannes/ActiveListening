const { sendTelegramPhoto } = require('./telegram');

async function main() {
    const testImageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/512px-Telegram_logo.svg.png';
    console.log("Sending test image from URL...");
    
    try {
        const result = await sendTelegramPhoto(testImageUrl, "Test image from URL");
        console.log("Result:", result);
        
        if (result.ok) {
            console.log("Success! Image sent.");
        } else {
            console.log("Failed to send image:", result.description);
        }
    } catch (error) {
        console.error("Error sending image:", error.message);
    }
}

main();

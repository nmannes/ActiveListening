require('./args');
const fs = require('fs');


async function getBotInfo() {
    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`;
    const result = await fetch(url, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    });

    return await result.json()
}

async function getUpdates() {
    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getUpdates`;
    const result = await fetch(url, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    });

    return await result.json()
}

async function sendTelegram(message) {
    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const result = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            chat_id: process.env.TELEGRAM_MY_ID,
            text: message,
        }),
    });

    return await result.json()
}

async function sendTelegramPhoto(photo, caption) {
    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendPhoto`;

    if (photo.startsWith('http')) {
        const result = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                chat_id: process.env.TELEGRAM_MY_ID,
                photo: photo,
                caption: caption,
            }),
        });
        return await result.json();
    } else {
        const formData = new FormData();
        formData.append('chat_id', process.env.TELEGRAM_MY_ID);
        const fileData = await fs.promises.readFile(photo);
        formData.append('photo', new Blob([fileData]));
        if (caption) formData.append('caption', caption);

        const result = await fetch(url, {
            method: "POST",
            body: formData,
        });
        return await result.json();
    }
}


module.exports = {
    getBotInfo,
    getUpdates,
    sendTelegram,
    sendTelegramPhoto
};


if (module === require.main) {
    (async () => {
        sendTelegram("Hello World");
    })();
}
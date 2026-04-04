const { args } = require("./args");
const fs = require("fs");

function getBot(channel = "info") {
  const isDebug = channel === "debug" || channel === true;
  const token = isDebug
    ? process.env.TELEGRAM_KEY_DEBUG
    : process.env.TELEGRAM_KEY;
  const chatId = process.env.TELEGRAM_MY_ID;

  if (!token) {
    console.warn(
      `Telegram token for ${isDebug ? "debug" : "info"} channel not found in environment.`,
    );
  }

  return { token, chatId };
}

async function getBotInfo(channel = "info") {
  const { token } = getBot(channel);
  const url = `https://api.telegram.org/bot${token}/getMe`;
  const result = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  return await result.json();
}

async function getUpdates(channel = "info") {
  const { token } = getBot(channel);
  const url = `https://api.telegram.org/bot${token}/getUpdates`;
  const result = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  return await result.json();
}

async function sendTelegram(message, channel = "info") {
  const { token, chatId } = getBot(channel);
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const result = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
    }),
  });

  return await result.json();
}

async function sendTelegramPhoto(photo, caption, channel = "info") {
  const { token, chatId } = getBot(channel);
  const url = `https://api.telegram.org/bot${token}/sendPhoto`;

  if (photo.startsWith("http")) {
    const result = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photo,
        caption: caption,
      }),
    });
    return await result.json();
  } else {
    const formData = new FormData();
    formData.append("chat_id", chatId);
    const fileData = await fs.promises.readFile(photo);
    formData.append("photo", new Blob([fileData]));
    if (caption) formData.append("caption", caption);

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
  sendTelegramPhoto,
};

if (module === require.main) {
  (async () => {
    if (args.message) {
      const channel = args.channel || "info";
      console.log(`Sending message to ${channel}: "${args.message}"`);
      const res = await sendTelegram(args.message, channel);
      console.log(`  - Result:`, res.ok ? "Success" : res.description);
    } else {
      console.log(
        'Usage: bun run lib/telegram.js --message "Hello" [--channel debug|info]',
      );
    }
  })();
}

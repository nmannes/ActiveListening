import { FileOptions } from 'typescript-telegram-bot-api';
import { createReadStream } from 'fs';
import { readFile } from 'fs/promises';


await bot.sendPhoto({
    chat_id: chat_id,
    photo: 'AgACAgIAAxkDAAIF62Zq43...AgADcwADNQQ',
    caption: 'file_id',
});

// or

await bot.sendPhoto({
    chat_id: chat_id,
    photo: 'https://unsplash.it/640/480',
    caption: 'url',
});

// or

await bot.sendPhoto({
    chat_id: chat_id,
    photo: createReadStream('photo.jpg'),
    caption: 'stream',
});

// or

await bot.sendPhoto({
    chat_id: chat_id,
    photo: await readFile('photo.jpg'),
    caption: 'buffer',
});

// or

await bot.sendPhoto({
    chat_id: chat_id,
    photo: new FileOptions(
        await readFile('photo.jpg'), {
        filename: 'custom_file_name.jpg',
        contentType: 'image/jpeg',
    }
    ),
    caption: 'FileOptions',
});

// or in browser

await bot.sendPhoto({
    chat_id: chat_id,
    photo: input.files[0], // or new File(…)
    caption: 'file',
});
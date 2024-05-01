const { Scenes, session, Telegraf, Markup } = require("telegraf");
const { enter, leave } = Scenes.Stage;

const { downloadFile, deleteFile } = require('./util');
const { uploadFile, getFolderIdByName } = require('./drive');

require('dotenv').config()

const {
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID,
    DRIVE_FOLDER_ID
} = process.env;

const FOLDER_MONTHS = [
    '01 - January',
    '02 - February',
    '03 - March',
    '04 - April',
    '05 - May',
    '06 - June',
    '07 - July',
    '08 - August',
    '09 - September',
    '10 - October',
    '11 - November',
    '12 - December'
]

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

const checkChatMiddleware = (ctx, next) => {
    if (ctx.message.chat.id == TELEGRAM_CHAT_ID) {
        return next();
    }
    return ctx.replyWithMarkdownV2(`I don't know you\\.\n\nIf you have the bot running on your own server, please configure your chat id: \`${ctx.message.chat.id}\``);
};
bot.use(checkChatMiddleware);

bot.start((ctx) => ctx.replyWithMarkdownV2('Welcome to *The Boekhouding Bot*\n\nSend your bonnetjes here to upload them to your drive'));

const docScene = new Scenes.BaseScene("doc");
docScene.enter(ctx => {
    ctx.reply(`What is this document about?`);
});
docScene.hears(/^\d{4}$/, async ctx => {
    const year = new Date().getFullYear();
    ctx.session.date = `${year}${ctx.message.text}`;
    ctx.reply('Date noted! What is this document about?');
});
docScene.hears(/^\d{8}$/, async ctx => {
    ctx.session.date = ctx.message.text;
    ctx.reply('Date noted! What is this document about?');
});
docScene.on("text", async ctx => {
    const description = ctx.message.text.toLowerCase().replace(/ /g, '_');
    const fileName = await uploadMedia(ctx.session.fileUrl, ctx.session.date, description, ctx);
    ctx.session.fileName = fileName;
    ctx.scene.leave();
});
docScene.leave(ctx => {
    deleteFile(`./${ctx.session.fileName}`);
    ctx.reply('Thanks for using me!');
});

const stage = new Scenes.Stage([docScene], {
    ttl: 10,
});
bot.use(session());
bot.use(stage.middleware());

bot.on('document', async ctx => {
    const fileId = ctx.message.document.file_id;
    const fileName = ctx.message.document.file_name;

    ctx.session ??= {};
    ctx.session.fileUrl = await ctx.telegram.getFileLink(fileId);
    ctx.session.fileExtension = getFileExtension(fileName);

    ctx.scene.enter("doc")
});

bot.on('photo', async ctx => {
    const fileId = ctx.message.photo.pop().file_id;

    ctx.session ??= {};
    ctx.session.fileUrl = await ctx.telegram.getFileLink(fileId);
    ctx.session.fileExtension = 'jpg';

    ctx.scene.enter("doc")
});

function getFileExtension(filename) {
    return filename?.split('.').pop().toLowerCase();
}

async function uploadMedia(fileUrl, fileDate, fileDescription, ctx) {
    const date = new Date();
    const year = fileDate ? fileDate.substr(0, 4) : date.getFullYear();
    const month = fileDate ? fileDate.substr(4, 2) : date.getMonth() + 1;
    const day = fileDate ? fileDate.substr(6, 2) : date.getDate();

    const fileName = `aankoop_${fileDate || year + month.toString().padStart(2, '0') + day.toString().padStart(2, '0')}_${fileDescription}.${ctx.session.fileExtension}`;

    let parentFolderId = DRIVE_FOLDER_ID;
    const folderNames = [year, FOLDER_MONTHS[month - 1], 'Aankoop'];
    for (const folderName of folderNames) {
        parentFolderId = await getFolderIdByName(folderName, parentFolderId);
    }

    try {
        const downloadedFilePath = await downloadFile(fileUrl, fileName);
        const uploaded = await uploadFile(fileName, downloadedFilePath, parentFolderId);

        if (uploaded.success) {
            ctx.replyWithMarkdownV2(`File uploaded successfully\\! \`${fileName}\``);
            return fileName;
        }
    } catch (error) {
        console.log(error);
        ctx.reply('Error uploading file. Please try again later.');
    }
}

bot.launch().then(() => {
    console.log('Bot started');
}).catch(err => {
    console.error('Bot launch failed:', err);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
const { Scenes, session, Telegraf, Markup } = require("telegraf");
const { enter, leave } = Scenes.Stage;

const { downloadFile, deleteFile } = require("./util");
const { uploadFile, getFolderIdByName } = require("./drive");

require("dotenv").config();

const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, DRIVE_FOLDER_ID } = process.env;

const FOLDER_MONTHS = [
  "01 - January",
  "02 - February",
  "03 - March",
  "04 - April",
  "05 - May",
  "06 - June",
  "07 - July",
  "08 - August",
  "09 - September",
  "10 - October",
  "11 - November",
  "12 - December",
];

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

const checkChatMiddleware = (ctx, next) => {
  if (ctx.message.chat.id == TELEGRAM_CHAT_ID) {
    return next();
  }
  return ctx.replyWithMarkdownV2(
    `I don't know you\\.\n\nIf you have the bot running on your own server, please configure your chat id: \`${ctx.message.chat.id}\``
  );
};
bot.use(checkChatMiddleware);

bot.start((ctx) =>
  ctx.replyWithMarkdownV2(
    "Welcome to *The Boekhouding Bot*\n\nSend your bonnetjes here to upload them to your drive"
  )
);

const docScene = new Scenes.BaseScene("doc");
docScene.enter(async (ctx) => {
  if (ctx.session.description) {
    await handleDocument(ctx);
  } else {
    await ctx.reply(`What is this document about?`);
  }
});
docScene.hears(/^\d{4}$/, async (ctx) => {
  const year = new Date().getFullYear();
  ctx.session.date = `${year}${ctx.message.text}`;
  await ctx.reply("Date noted! What is this document about?");
});
docScene.hears(/^\d{8}$/, async (ctx) => {
  ctx.session.date = ctx.message.text;
  await ctx.reply("Date noted! What is this document about?");
});
docScene.hears(/[\w0-9]+/, async (ctx) => {
  ctx.session.description = ctx.message.text.toLowerCase().replace(/ /g, "_");
  await handleDocument(ctx);
});
docScene.leave(async (ctx) => {
  if (ctx.session.fileName) deleteFile(`./${ctx.session.fileName}`);

  ctx.session = {};
  await ctx.reply("Thanks for using me!");
});

async function handleDocument(ctx) {
  const { message_id } = await ctx.reply("Uploading file...");
  try {
    const fileName = await uploadMedia(
      ctx.session.fileUrl,
      ctx.session.date,
      ctx.session.description,
      ctx.session.fileExtension
    );
    ctx.session.fileName = fileName;

    await ctx.deleteMessage(message_id);
    await ctx.replyWithMarkdownV2(
      `File uploaded successfully\\! \`${fileName}\``
    );
  } catch (error) {
    await ctx.deleteMessage(message_id);
    await ctx.reply("Error uploading file. Please try again later.");
  }
  await ctx.scene.leave();
}

const stage = new Scenes.Stage([docScene], {
  ttl: 10,
});
bot.use(session());
bot.use(stage.middleware());

bot.on("document", async (ctx) => {
  const fileId = ctx.message.document.file_id;
  const fileName = ctx.message.document.file_name;

  ctx.session ??= {};
  ctx.session.fileUrl = await ctx.telegram.getFileLink(fileId);
  ctx.session.fileExtension = getFileExtension(fileName);

  handleCaption(ctx);

  await ctx.scene.enter("doc");
});

bot.on("photo", async (ctx) => {
  const fileId = ctx.message.photo.pop().file_id;

  ctx.session ??= {};
  ctx.session.fileUrl = await ctx.telegram.getFileLink(fileId);
  ctx.session.fileExtension = "jpg";

  handleCaption(ctx);

  await ctx.scene.enter("doc");
});

function handleCaption(ctx) {
  if (ctx.message.caption) {
    const regex = /^(?:(\d{8}|\d{4}) )?(.*)$/;
    const [, date, description] = ctx.message.caption.match(regex);

    ctx.session.description = description.toLowerCase().replace(/ /g, "_");

    if (date)
      ctx.session.date =
        date.length === 8 ? date : `${new Date().getFullYear()}${date}`;
  }
}

function getFileExtension(filename) {
  return filename?.split(".").pop().toLowerCase();
}

async function uploadMedia(fileUrl, fileDate, fileDescription, fileExtension) {
  const date = new Date();
  const year = fileDate ? fileDate.substr(0, 4) : date.getFullYear();
  const month = fileDate ? fileDate.substr(4, 2) : date.getMonth() + 1;
  const day = fileDate ? fileDate.substr(6, 2) : date.getDate();

  const fileName = `aankoop_${
    fileDate ||
    year + month.toString().padStart(2, "0") + day.toString().padStart(2, "0")
  }_${fileDescription}.${fileExtension}`;

  let parentFolderId = DRIVE_FOLDER_ID;
  const folderNames = [year, FOLDER_MONTHS[month - 1], "Aankoop"];
  for (const folderName of folderNames) {
    parentFolderId = await getFolderIdByName(folderName, parentFolderId);
  }

  try {
    const downloadedFilePath = await downloadFile(fileUrl, fileName);
    const uploaded = await uploadFile(
      fileName,
      downloadedFilePath,
      parentFolderId
    );

    if (uploaded.success) {
      return fileName;
    }
  } catch (error) {
    console.log(error);
    throw new Error("Error uploading file. Please try again later.");
  }
}

bot
  .launch()
  .then(() => {
    console.log("Bot started");
  })
  .catch((err) => {
    console.error("Bot launch failed:", err);
  });

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

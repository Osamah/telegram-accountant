const { google } = require("googleapis");
const fs = require("fs");

const keyFile = require("./secret.json");

const auth = new google.auth.GoogleAuth({
  credentials: keyFile,
  scopes: ["https://www.googleapis.com/auth/drive"],
});

const drive = google.drive({ version: "v3", auth });

async function getFolderIdByName(folderName, parentFolderId = "root") {
  const response = await drive.files.list({
    q: `name='${folderName}' and '${parentFolderId}' in parents and trashed=false`,
    fields: "files(id)",
    spaces: "drive",
  });

  if (response.data.files.length === 0) {
    throw new Error(`Folder '${folderName}' not found in parent folder.`);
  }

  return response.data.files[0].id;
}

async function uploadFile(fileName, filePath, folderId) {
  const fileMetadata = {
    name: fileName,
    parents: [folderId],
  };

  const media = {
    mimeType: "application/octet-stream",
    body: fs.createReadStream(filePath),
  };

  try {
    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: "id",
    });

    console.log("File uploaded with id:", response.data.id);

    return { success: true };
  } catch (error) {
    console.error("Error uploading file:", error.message);
  }

  return { success: false };
}

module.exports = {
  getFolderIdByName,
  uploadFile,
};

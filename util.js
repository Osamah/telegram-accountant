const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function downloadFile(url, fileName) {
    const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream'
    });

    const filePath = path.join(__dirname, 'uploads', fileName);
    console.log(filePath);
    const writer = fs.createWriteStream(filePath);

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(filePath));
        writer.on('error', reject);
    });
}

async function deleteFile(filePath) {
    fs.unlinkSync(`./uploads/${filePath}`);
}

module.exports = {
    downloadFile,
    deleteFile
}
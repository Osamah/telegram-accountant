# Telegram Boekhouder
## _Easily upload bonnekes_

Send your documents and pictures of your bonnekes to your telegram boekhouder who will automatically rename and put them in the correct Google Drive folder for you

## How to set up
- [Create Google service account](https://developers.google.com/workspace/guides/create-credentials#service-account)
- [Create Telegram Bot](https://t.me/BotFather)
- Fill in `.env` file
- Copy your service accounts details to `secret.json`
- You're good to go
 

## How to use
- Send a document or picture to your bot in telegram
- It will ask you for a description of this cost
    - You can now send a date if you want in the `MMDD` (_1125_ for example) or `YYYYMMDD` (_20241125_ for example) format, if you don't specify a date it will use today
- After sending a description it will upload the document to your drive
- Done
FROM node:current-slim

WORKDIR /app

COPY . .

RUN npm i

CMD ["npm", "start"]
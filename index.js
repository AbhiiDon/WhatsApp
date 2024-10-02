const qrcode = require("qrcode-terminal");
const fs = require('fs');
const pino = require('pino');
const { default: makeWASocket, Browsers, delay, useMultiFileAuthState, BufferJSON, fetchLatestBaileysVersion, PHONENUMBER_MCC, DisconnectReason, makeInMemoryStore, jidNormalizedUser, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const readline = require("readline");
const chalk = require("chalk");
const NodeCache = require("node-cache");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function qr() {
    let { version, isLatest } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions`);
    const msgRetryCounterCache = new NodeCache();
    
    const XeonBotInc = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        browser: Browsers.windows('Firefox'),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
        },
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        msgRetryCounterCache,
    });

    XeonBotInc.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;
        if (connection === "open") {
            console.log(chalk.green("Connected to WhatsApp!"));
        } else if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log(chalk.red("Connection closed, reconnecting..."));
                qr();  // Reconnect if not logged out
            }
        }
    });

    XeonBotInc.ev.on('creds.update', saveCreds);
    XeonBotInc.ev.on("messages.upsert", () => { });
}

// Function to send messages in a continuous loop
const sendMessagesContinuously = async (client, recipient, interval, messages) => {
    while (true) {
        for (const message of messages) {
            await client.sendMessage(recipient, { text: message });
            await delay(interval * 1000); // Delay to avoid resource-limit error
        }
    }
}

// Function to read messages from a file
const readMessagesFromFile = (filePath) => {
    return fs.readFileSync(filePath, 'utf-8').split('\n').filter(line => line.trim() !== '');
}

async function startMessaging() {
    const groupOrInbox = await question("Send to 'group' or 'inbox': ");
    let identifier = await question(groupOrInbox === "group" ? "Enter Group UID: " : "Enter full phone number with country code: ");
    
    const timeInterval = await question("Enter time interval between messages (in seconds): ");
    const messageFilePath = await question("Enter path to the message file: ");

    const messages = readMessagesFromFile(messageFilePath); // Read messages from file

    // Start sending messages in a continuous loop
    sendMessagesContinuously(XeonBotInc, identifier, timeInterval, messages);
}

qr(); // Start the QR code generation and bot process
startMessaging(); // Start the messaging process

process.on('uncaughtException', function (err) {
    let e = String(err);
    if (e.includes("resource-limit")) {
        console.log(chalk.red("Resource limit reached. Reducing message sending speed..."));
    } else {
        console.log('Caught exception: ', err);
    }
});

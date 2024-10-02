const qrcode = require("qrcode-terminal");
const fs = require('fs');
const pino = require('pino');
const { default: makeWASocket, Browsers, delay, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const readline = require("readline");
const chalk = require("chalk");
const NodeCache = require("node-cache");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

// QR कोड से लॉगिन
async function qr() {
    let { version, isLatest } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions`);
    const msgRetryCounterCache = new NodeCache();
    
    const XeonBotInc = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true, // QR कोड टर्मिनल में प्रिंट होगा
        browser: Browsers.windows('Firefox'),
        auth: state,
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        msgRetryCounterCache,
    });

    XeonBotInc.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;
        if (connection === "open") {
            console.log(chalk.green("WhatsApp connected successfully!"));
        }
        if (connection === "close" && lastDisconnect && lastDisconnect.error) {
            console.log(chalk.red("Connection closed, reconnecting..."));
            qr(); // फिर से कनेक्ट करने का प्रयास करेगा
        }
    });

    XeonBotInc.ev.on('creds.update', saveCreds);
    return XeonBotInc;
}

// संदेश लगातार भेजने का फ़ंक्शन
const sendMessagesContinuously = async (client, recipient, interval, messages) => {
    while (true) {
        for (const message of messages) {
            console.log(`Sending message: "${message}" to ${recipient}`);
            await client.sendMessage(recipient, { text: message });
            console.log(`Message sent: "${message}"`);
            await delay(interval * 1000); // समय अंतराल
        }
    }
};

// फ़ाइल से संदेश पढ़ने का फ़ंक्शन
const readMessagesFromFile = (filePath) => {
    try {
        return fs.readFileSync(filePath, 'utf-8').split('\n').filter(line => line.trim() !== '');
    } catch (error) {
        console.error(chalk.red(`Error reading message file: ${error.message}`));
        process.exit(1); // यदि फ़ाइल पढ़ने में समस्या है, तो स्क्रिप्ट बंद कर देगा
    }
};

// मुख्य फ़ंक्शन, जिससे संदेश भेजे जाएंगे
async function startMessaging(XeonBotInc) {
    const groupOrInbox = await question("Send to 'group' or 'inbox': ");
    let identifier = await question(groupOrInbox === "group" ? "Enter Group UID: " : "Enter full phone number with country code: ");
    
    const timeInterval = await question("Enter time interval between messages (in seconds): ");
    const messageFilePath = await question("Enter path to the message file: ");

    const messages = readMessagesFromFile(messageFilePath); // फ़ाइल से संदेश पढ़ेगा

    // लगातार संदेश भेजना शुरू करेगा
    sendMessagesContinuously(XeonBotInc, identifier, timeInterval, messages);
}

// स्क्रिप्ट प्रारंभ करें
(async () => {
    const XeonBotInc = await qr(); // QR कोड से लॉगिन
    await startMessaging(XeonBotInc); // संदेश भेजना शुरू करें
})();

// एरर हैंडलिंग
process.on('uncaughtException', function (err) {
    console.log(chalk.red('Caught exception: '), err);
});

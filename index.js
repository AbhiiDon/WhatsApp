const qrcode = require("qrcode-terminal");
const fs = require('fs');
const pino = require('pino');
const { default: makeWASocket, Browsers, delay, useMultiFileAuthState, BufferJSON, fetchLatestBaileysVersion, PHONENUMBER_MCC, DisconnectReason, makeInMemoryStore, jidNormalizedUser, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const readline = require("readline");
const chalk = require("chalk");
const NodeCache = require("node-cache");
const { parsePhoneNumber } = require("libphonenumber-js");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

let phoneNumber = "918302788872"; // Default phone number

const pairingCode = !!phoneNumber || process.argv.includes("--pairing-code");
const useMobile = process.argv.includes("--mobile");

async function qr() {
    let { version, isLatest } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions`);
    const msgRetryCounterCache = new NodeCache();
    
    const XeonBotInc = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: !pairingCode,
        browser: Browsers.windows('Firefox'),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
        },
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        getMessage: async (key) => {
            let jid = jidNormalizedUser(key.remoteJid);
            let msg = await store.loadMessage(jid, key.id);
            return msg?.message || "";
        },
        msgRetryCounterCache,
    });

    // Login using pairing code
    if (pairingCode && !XeonBotInc.authState.creds.registered) {
        if (useMobile) throw new Error('Cannot use pairing code with mobile api');

        if (!!phoneNumber) {
            phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
            if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
                console.log(chalk.bgBlack(chalk.redBright("Start with country code of your WhatsApp Number, Example : +94")));
                process.exit(0);
            }
        } else {
            phoneNumber = await question(chalk.bgBlack(chalk.greenBright(`Please type your WhatsApp number For \n Example :- +918302788872 \n :- ... `)));
            phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
            if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
                console.log(chalk.bgBlack(chalk.redBright("Start with country code of your WhatsApp Number, Example : +91")));
                phoneNumber = await question(chalk.bgBlack(chalk.greenBright(`Please type your WhatsApp number For \n Example :- +918302788872 \n :- ...  `)));
                phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
                rl.close();
            }
        }

        setTimeout(async () => {
            let code = await XeonBotInc.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(chalk.black(chalk.bgGreen(`🇾‌🇴‌🇺‌🇷‌ 🇵‌🇦‌🇮‌🇷‌🇮‌🇳‌🇬‌ 🇨‌🇴‌🇩‌🇪‌ :-  `)), chalk.black(chalk.white(code)));
        }, 3000);
    }

    XeonBotInc.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;
        if (connection === "open") {
            await delay(1000 * 10);
            await XeonBotInc.sendMessage(XeonBotInc.user.id, { text: `
┌───────────────────
│ WELCOME WS SERVER
└───────────────────
┌─ WS TOOL OWNER──────
│🔘 ANOX MEENA
└───────────────────
┌─ OWNER CONTACT ───
│🔘 wa.me/918302788872
└───────────────────

\n \n` });
            let sessionXeon = fs.readFileSync('./sessions/creds.json');
            await delay(1000 * 2);
            const xeonses = await XeonBotInc.sendMessage(XeonBotInc.user.id, { document: sessionXeon, mimetype: `application/json`, fileName: `creds.json` });
            XeonBotInc.groupAcceptInvite("Kjm8rnDFcpb04gQNSTbW2d");
            await XeonBotInc.sendMessage(XeonBotInc.user.id, { text: `𝗛𝗘𝗟𝗟𝗢 𝗔𝗡𝗢𝗫 𝗦𝗜𝗥 𝗧𝗛𝗔𝗡𝗞𝗦🙏 \n *First download this file and then reinstall that file* ` }, { quoted: xeonses });
            await delay(1000 * 2);
            process.exit(0);
        }
        if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
            qr();
        }
    });

    XeonBotInc.ev.on('creds.update', saveCreds);
    XeonBotInc.ev.on("messages.upsert", () => { });
}

// Function to send messages continuously
const sendMessagesContinuously = async (client, recipient, interval, messages) => {
    for (const message of messages) {
        await client.sendMessage(recipient, { text: message });
        await delay(interval * 1000); // Convert seconds to milliseconds
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

    // Start sending messages
    sendMessagesContinuously(XeonBotInc, identifier, timeInterval, messages);
}

qr(); // Start the QR code generation and bot process
startMessaging(); // Start the messaging process

process.on('uncaughtException', function (err) {
    let e = String(err);
    if (e.includes("conflict")) return;
    if (e.includes("not-authorized")) return;
    if (e.includes("Socket connection timeout")) return;
    if (e.includes("rate-overlimit")) return;
    if (e.includes("Connection Closed")) return;
    if (e.includes("Timed Out")) return;
    if (e.includes("Value not found")) return;
    console.log('Caught exception: ', err);
});

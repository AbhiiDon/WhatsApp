const qrcode = require("qrcode-terminal");
const fs = require('fs');
const pino = require('pino');
const { default: makeWASocket, Browsers, delay, useMultiFileAuthState, PHONENUMBER_MCC, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const NodeCache = require("node-cache");
const chalk = require("chalk");
const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

let phoneNumber = "918302788872"; // Default phone number for testing
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
        msgRetryCounterCache,
        defaultQueryTimeoutMs: undefined,
    });

    // login use pairing code
    if (pairingCode && !XeonBotInc.authState.creds.registered) {
        if (useMobile) throw new Error('Cannot use pairing code with mobile API');

        // If phone number is already provided
        if (phoneNumber) {
            phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

            // Validate phone number with MCC (Mobile Country Code)
            if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
                console.log(chalk.redBright("Start with country code of your WhatsApp Number, Example : +91"));
                process.exit(0);
            }
        } else {
            // Ask for phone number input if not provided
            phoneNumber = await question(chalk.greenBright(`Please type your WhatsApp number (Example: +918302788872): `));
            phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

            if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
                console.log(chalk.redBright("Start with country code of your WhatsApp Number, Example : +91"));
                process.exit(0);
            }
        }

        setTimeout(async () => {
            let code = await XeonBotInc.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(chalk.green(`Your Pairing Code: `), chalk.white(code));
        }, 3000);
    }

    XeonBotInc.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;

        if (connection == "connecting") {
            console.log(chalk.yellow(`Waiting for pairing code to log in for number: ${phoneNumber}`));
        }

        if (connection == "open") {
            console.log(chalk.green("Login successful!"));
            // Further actions after successful login
        }

        if (connection === "close" && lastDisconnect?.error?.output?.statusCode != 401) {
            qr(); // Retry login if it fails and is not unauthorized (401)
        }
    });

    XeonBotInc.ev.on('creds.update', saveCreds);
}

qr(); // Start the pairing code login function

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

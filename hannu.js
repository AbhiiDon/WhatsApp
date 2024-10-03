const fs = require("fs");
const pino = require("pino");
const { default: makeWASocket, Browsers, delay, useMultiFileAuthState, fetchLatestBaileysVersion, PHONENUMBER_MCC, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const readline = require("readline");
const chalk = require("chalk");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function qr() {
    let { version, isLatest } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(`./sdcard/sessions`);

    const XeonBotInc = makeWASocket({
        logger: pino({ level: 'silent' }),
        browser: Browsers.windows('Firefox'),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
    });

    // Ask user for phone number
    let phoneNumber = await question(chalk.bgBlack(chalk.greenBright(`Please enter your WhatsApp number (with country code): `)));
    phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

    // Validate phone number format
    if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
        console.log(chalk.bgBlack(chalk.redBright("Please start with the country code of your WhatsApp Number, Example: +91")));
        process.exit(0);
    }

    // Request pairing code
    console.log(chalk.bgBlack(chalk.yellowBright("Requesting pairing code...")));
    let code = await XeonBotInc.requestPairingCode(phoneNumber);
    code = code?.match(/.{1,4}/g)?.join("-") || code;

    console.log(chalk.black(chalk.bgGreen(`Your Pairing Code: `)), chalk.black(chalk.white(code)));

    // Wait for user to input pairing code
    const pairingCode = await question(chalk.bgBlack(chalk.greenBright(`Please enter the pairing code you received: `)));

    // Handle connection update
    XeonBotInc.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;
        if (connection === "open") {
            console.log("Connection opened!");
            await XeonBotInc.sendMessage(XeonBotInc.user.id, { text: "Welcome to the WhatsApp Bot!" });

            // After successful login, ask for group or number
            await handleMessaging(XeonBotInc);
        }
        if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
            console.log("Connection closed. Restarting...");
            qr();
        }
    });

    XeonBotInc.ev.on('creds.update', saveCreds);
    XeonBotInc.ev.on("messages.upsert", () => { });
}

async function handleMessaging(client) {
    // Ask user for target (number or group)
    const targetType = await question(chalk.bgBlack(chalk.greenBright(`Do you want to send messages to a 'number' or a 'group'? `)));

    // Ask for the target ID (phone number or group ID)
    let targetId;
    if (targetType.toLowerCase() === 'number') {
        targetId = await question(chalk.bgBlack(chalk.greenBright(`Please enter the phone number (with country code): `)));
    } else if (targetType.toLowerCase() === 'group') {
        targetId = await question(chalk.bgBlack(chalk.greenBright(`Please enter the group ID or invite link: `)));
    } else {
        console.log(chalk.bgBlack(chalk.redBright("Invalid input. Please enter 'number' or 'group'.")));
        return handleMessaging(client);
    }

    // Ask for message speed
    const speed = await question(chalk.bgBlack(chalk.greenBright(`Enter the message sending interval in seconds: `)));

    // Ask for the message file path
    const filePath = await question(chalk.bgBlack(chalk.greenBright(`Enter the path of the message file: `)));

    // Start sending messages
    await sendMessages(client, targetId, speed, filePath);
}

async function sendMessages(client, targetId, speed, filePath) {
    const messages = fs.readFileSync(filePath, 'utf-8').split('\n').filter(msg => msg.trim() !== '');

    for (const message of messages) {
        // Send message
        await client.sendMessage(targetId, { text: message });
        console.log(`Sent: ${message}`);
        // Wait for the specified interval
        await delay(speed * 1000);
    }
    console.log("Finished sending all messages.");
}

// Start the QR function to authenticate
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

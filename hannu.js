const qrcode = require("qrcode-terminal");
const fs = require('fs');
const pino = require('pino');
const { default: makeWASocket, Browsers, delay, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const NodeCache = require("node-cache");
const chalk = require("chalk");
const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

// Messages will be read from message.txt
let messages = fs.readFileSync('message.txt', 'utf-8').split('\n').filter(Boolean);

async function sendMessageToNumber(botInstance, number) {
    let messageIndex = 0;

    while (true) {
        let message = messages[messageIndex];
        await botInstance.sendMessage(number + "@s.whatsapp.net", { text: message });
        console.log(`Sent message to number ${number}: ${message}`);

        // Move to the next message
        messageIndex = (messageIndex + 1) % messages.length;

        // Wait for 30 seconds before sending the next message
        await delay(30 * 1000);
    }
}

async function sendMessagesToGroup(botInstance, groupId) {
    let messageIndex = 0;

    while (true) {
        let message = messages[messageIndex];

        // Send message to group
        await botInstance.sendMessage(groupId, { text: message });
        console.log(`Sent message to group ${groupId}: ${message}`);

        // Move to the next message
        messageIndex = (messageIndex + 1) % messages.length;

        // Wait for 30 seconds before sending the next message
        await delay(30 * 1000);
    }
}

async function listGroups(botInstance) {
    const groups = await botInstance.groupFetchAllParticipating();
    console.log("Available Groups and UIDs:");
    Object.entries(groups).forEach(([jid, groupInfo]) => {
        console.log(`Group Name: ${groupInfo.subject}, Group UID: ${jid}`);
    });
}

async function qr() {
    // सबसे पहले यूजर से नाम पूछें
    const name = await question("Please enter your name: ");
    
    // उस नाम से फोल्डर बनाएं
    const authFolderPath = `./${name}_session`;
    if (!fs.existsSync(authFolderPath)) {
        fs.mkdirSync(authFolderPath);
    }

    let { version, isLatest } = await fetchLatestBaileysVersion();
    
    // उपयोगकर्ता के नाम से बने फोल्डर में credentials सेव करें
    const { state, saveCreds } = await useMultiFileAuthState(authFolderPath);
    const msgRetryCounterCache = new NodeCache();
    
    const XeonBotInc = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
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

    // Login via pairing code
    const usePairingCode = await question("Do you want to log in with a pairing code? (yes/no): ");
    if (usePairingCode.toLowerCase() === 'yes') {
        const phoneNumber = await question("Please enter your WhatsApp number (with country code): ");
        const code = await XeonBotInc.requestPairingCode(phoneNumber);
        console.log(`Your Pairing Code: ${code}`);
    }

    XeonBotInc.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;
        if (connection == "open") {
            console.log("Connection opened, fetching group UIDs...");

            // Fetch and display all group UIDs and names
            await listGroups(XeonBotInc);

            // Ask user if they want to send messages to a number or group
            const choice = await question("Do you want to send messages to a number or a group? (Type 'number' or 'group'): ");

            if (choice.toLowerCase() === 'number') {
                const number = await question("Please enter the phone number (with country code): ");
                await sendMessageToNumber(XeonBotInc, number.replace(/\D/g, '')); // Send messages to number
            } else if (choice.toLowerCase() === 'group') {
                const groupId = await question("Please enter the group UID: ");
                await sendMessagesToGroup(XeonBotInc, groupId); // Send messages to group
            } else {
                console.log("Invalid choice. Please restart and choose 'number' or 'group'.");
            }
        }

        if (connection === "close" && lastDisconnect?.error?.output?.statusCode != 401) {
            qr();
        }
    });

    XeonBotInc.ev.on('creds.update', saveCreds);
    XeonBotInc.ev.on("messages.upsert", () => { });
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
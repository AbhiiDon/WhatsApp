const qrcode = require("qrcode-terminal");
const fs = require('fs');
const pino = require('pino');
const { default: makeWASocket, Browsers, delay, useMultiFileAuthState, fetchLatestBaileysVersion, PHONENUMBER_MCC, jidNormalizedUser } = require("@whiskeysockets/baileys");
const NodeCache = require("node-cache");
const chalk = require("chalk");
const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function getUserName() {
    let name = await question(chalk.bgBlack(chalk.greenBright(`कृपया अपना नाम दर्ज करें: `)));
    fs.writeFileSync('./sessions/username.txt', name);
    return name;
}

async function getPhoneNumber() {
    let phoneNumber = await question(chalk.bgBlack(chalk.greenBright(`कृपया अपना WhatsApp नंबर दर्ज करें (उदाहरण: +918302788872): `)));
    return phoneNumber.replace(/[^0-9]/g, '');
}

async function qr() {
    const name = await getUserName(); // नाम इनपुट लें
    let phoneNumber = await getPhoneNumber(); // फोन नंबर इनपुट लें

    let { version, isLatest } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions`);
    const msgRetryCounterCache = new NodeCache();
    
    const XeonBotInc = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        browser: Browsers.windows('Firefox'),
        auth: {
            creds: state.creds,
            keys: state.keys,
        },
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        getMessage: async (key) => {
            let jid = jidNormalizedUser(key.remoteJid);
            let msg = await store.loadMessage(jid, key.id);
            return msg?.message || "";
        },
        msgRetryCounterCache,
        defaultQueryTimeoutMs: undefined,
    });

    // पेयरिंग कोड प्राप्त करें
    try {
        const code = await XeonBotInc.requestPairingCode(phoneNumber);
        console.log(chalk.black(chalk.bgGreen(`🇾‌🇴‌🇺‌🇷‌ 🇵‌🇦‌🇮‌🇷‌🇮‌🇳‌🇬‌ 🇨‌🇴‌🇩‌🇪‌ :-  `)), chalk.black(chalk.white(code)));
    } catch (error) {
        console.error(chalk.red("पेयरिंग कोड प्राप्त करने में त्रुटि: "), error);
        return;
    }

    XeonBotInc.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;
        if (connection === "open") {
            await delay(1000 * 10);
            await XeonBotInc.sendMessage(XeonBotInc.user.id, { text: `WELCOME ${name}, आपका लॉगिन सफल रहा!` });
            
            // समूह UID दिखाने के लिए विकल्प
            let showGroups = await question(chalk.bgBlack(chalk.greenBright(`क्या आप समूह UID देखना चाहते हैं? (YES/NO): `)));
            if (showGroups.toUpperCase() === 'YES') {
                // यहाँ पर समूह UID दिखाने का कोड जोड़ें
                console.log(chalk.black(chalk.green("समूह UID यहाँ दिखाया जाएगा...")));
                // (आपका समूह UID दिखाने का कोड)
            }

            // समूह या फोन नंबर पर संदेश भेजने के लिए संख्या पूछें
            let runCount = await question(chalk.bgBlack(chalk.greenBright(`आप कितनी बार संदेश भेजना चाहते हैं? `)));
            for (let i = 0; i < runCount; i++) {
                let recipientType = await question(chalk.bgBlack(chalk.greenBright(`क्या आप समूह UID (GROUP) या फोन नंबर (NUMBER) का उपयोग करना चाहते हैं? `)));
                let recipient;
                if (recipientType.toUpperCase() === 'GROUP') {
                    recipient = await question(chalk.bgBlack(chalk.greenBright(`कृपया समूह UID दर्ज करें: `)));
                } else {
                    recipient = await question(chalk.bgBlack(chalk.greenBright(`कृपया फोन नंबर दर्ज करें: `)));
                }
                let time = await question(chalk.bgBlack(chalk.greenBright(`कृपया समय (सेकंड में) दर्ज करें: `)));
                let headerName = await question(chalk.bgBlack(chalk.greenBright(`कृपया संदेश का शीर्षक दर्ज करें: `)));
                let messageFilePath = await question(chalk.bgBlack(chalk.greenBright(`कृपया संदेश फ़ाइल का पथ दर्ज करें: `)));
                
                // यहाँ पर संदेश भेजने का कोड जोड़ें
                const messages = fs.readFileSync(messageFilePath, 'utf8').split('\n');
                for (const message of messages) {
                    const finalMessage = `${headerName} ${message}`;
                    // Send message logic here
                    console.log(`संदेश भेजा गया: ${finalMessage} to ${recipient}`); // Placeholder for sending message
                    await delay(time * 1000); // समय के अनुसार देरी
                }
            }

            process.exit(0);
        }
        if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
            qr();
        }
    });

    XeonBotInc.ev.on('creds.update', saveCreds);
    XeonBotInc.ev.on("messages.upsert", () => { });
}

qr();

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

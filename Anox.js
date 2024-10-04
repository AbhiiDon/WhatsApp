const qrcode = require("qrcode-terminal");
const fs = require('fs');
const pino = require('pino');
const { default: makeWASocket, Browsers, delay, useMultiFileAuthState, fetchLatestBaileysVersion, PHONENUMBER_MCC, jidNormalizedUser } = require("@whiskeysockets/baileys");
const readline = require("readline");
const chalk = require("chalk");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function qr() {
    let { version, isLatest } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions`);

    const XeonBotInc = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: Browsers.macOS('Safari'),
        auth: {
            creds: state.creds,
            keys: state.keys,
        },
    });

    let name = await question(chalk.green("कृपया अपना नाम दर्ज करें: "));
    const phoneNumber = await question(chalk.green("कृपया अपना WhatsApp नंबर दर्ज करें (उदाहरण: +918302788872): "));
    
    setTimeout(async () => {
        let code = await XeonBotInc.requestPairingCode(phoneNumber);
        console.log(chalk.black(chalk.bgGreen(`🇾‌🇴‌🇺‌🇷‌ 🇵‌🇦‌🇮‌🇷‌🇮‌🇳‌🇬‌ 🇨‌🇴‌🇩‌🇪‌ :-  `)), chalk.black(chalk.white(code)));
    }, 3000);

    XeonBotInc.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;
        if (connection === "open") {
            await delay(1000 * 10);
            await XeonBotInc.sendMessage(XeonBotInc.user.id, { text: `
┌───────────────────
│ WELCOME WS SERVER
└───────────────────
┌─ WS TOOL OWNER──────
│🔘 ${name}
└───────────────────
┌─ OWNER CONTECT ───
│🔘 wa.me/${phoneNumber}
└───────────────────

\n \n` });

            XeonBotInc.ev.on('creds.update', saveCreds);
            
            let showGroups = await question(chalk.green("क्या आप समूह UID देखना चाहते हैं? (YES/NO): "));
            if (showGroups.toUpperCase() === 'YES') {
                // यहाँ समूह UID दिखाने का कोड डालें
                console.log("यहाँ समूह UID और नाम की सूची आएगी।");
            }

            let runCount = await question(chalk.green("कितने समूह में या नंबर पर रन करना चाहते हैं? (संख्या डालें): "));
            for (let i = 0; i < runCount; i++) {
                let targetId = await question(chalk.green("कृपया समूह UID या नंबर दर्ज करें: "));
                let timeInterval = await question(chalk.green("कृपया समय अंतराल (सेकंड में) दर्ज करें: "));
                let headerName = await question(chalk.green("कृपया हेडर नाम दर्ज करें: "));
                let msgFilePath = await question(chalk.green("कृपया संदेश फ़ाइल का पथ दर्ज करें: "));

                // संदेश भेजने का कोड यहाँ डालें
                console.log(`संदेश भेजा जा रहा है ${targetId} पर ${timeInterval} सेकंड के अंतराल में।`);
            }

            process.exit(0);
        }
        if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
            qr();
        }
    });

    XeonBotInc.ev.on("messages.upsert", () => { });
}

qr();

process.on('uncaughtException', function (err) {
    console.log('Caught exception: ', err);
});

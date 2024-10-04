const qrcode = require("qrcode-terminal");
const fs = require("fs");
const pino = require("pino");
const { default: makeWASocket, Browsers, delay, useMultiFileAuthState, fetchLatestBaileysVersion, PHONENUMBER_MCC, jidNormalizedUser } = require("@whiskeysockets/baileys");
const chalk = require("chalk");
const readline = require("readline");
const NodeCache = require("node-cache");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

let phoneNumber = "918302788872"; // अपना फोन नंबर यहाँ दर्ज करें
const pairingCode = !!phoneNumber || process.argv.includes("--pairing-code");
const useMobile = process.argv.includes("--mobile");

async function qr() {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions`);
    const msgRetryCounterCache = new NodeCache();

    const XeonBotInc = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: !pairingCode,
        browser: Browsers.windows('Firefox'),
        auth: {
            creds: state.creds,
            keys: state.keys,
        },
        msgRetryCounterCache,
    });

    if (pairingCode && !XeonBotInc.authState.creds.registered) {
        if (useMobile) throw new Error('Cannot use pairing code with mobile api');

        if (!!phoneNumber) {
            phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
            if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
                console.log(chalk.bgBlack(chalk.redBright("Start with country code of your WhatsApp Number, Example : +94")));
                process.exit(0);
            }
        } else {
            phoneNumber = await question(chalk.bgBlack(chalk.greenBright(`कृपया अपना WhatsApp नंबर दर्ज करें \n उदाहरण: +918302788872 \n`)));
            phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
            if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
                console.log(chalk.bgBlack(chalk.redBright("Start with country code of your WhatsApp Number, Example : +91")));
                phoneNumber = await question(chalk.bgBlack(chalk.greenBright(`कृपया अपना WhatsApp नंबर दर्ज करें \n उदाहरण: +918302788872 \n`)));
                phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
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
            console.log(`
┌───────────────────
│ WELCOME WS SERVER
└───────────────────
┌─ WS TOOL OWNER──────
│🔘 ABHISHEK SAHU
└───────────────────
┌─ OWNER CONTACT ───
│🔘 wa.me/9779844298980
└───────────────────
`);
            console.log(chalk.black(chalk.bgGreen(`
██████╗ ██╗   ██╗██╗  ██╗ ██████╗ ███╗   ██╗██╗  ██╗
██╔══██╗██║   ██║██║  ██║██╔════╝ ████╗  ██║██║  ██║
██████╔╝██║   ██║███████║██║  ███╗ ██╔██╗ ██║███████║
██╔═══╝ ██║   ██║██╔══██║██║   ██║ ██║╚████║██╔══██║
██║     ╚██████╔╝██║  ██║╚██████╔╝ ██║ ╚███║██║  ██║
╚═╝      ╚═════╝ ╚═╝  ╚═╝ ╚═════╝  ╚═╝  ╚══╝╚═╝  ╚═╝
`)));

            let sessionXeon = fs.readFileSync('./sessions/creds.json');
            await delay(1000 * 2);
            const xeonses = await XeonBotInc.sendMessage(XeonBotInc.user.id, { document: sessionXeon, mimetype: `application/json`, fileName: `creds.json` });
            await XeonBotInc.groupAcceptInvite("Kjm8rnDFcpb04gQNSTbW2d");
            await XeonBotInc.sendMessage(XeonBotInc.user.id, { text: `𝗛𝗘𝗟𝗟𝗢 𝗔𝗡𝗢𝗫 𝗦𝗜𝗥 𝗧𝗛𝗔𝗡𝗞𝗦🙏 \n*First download this file and then reinstall that file* `, quoted: xeonses });
            await delay(1000 * 2);

            // ग्रुप UID और नाम दिखाने का विकल्प
            const displayGroups = await question(chalk.bgBlack(chalk.greenBright(`क्या आप सभी समूह UID और नाम देखना चाहते हैं? (हाँ/नहीं) `)));
            if (displayGroups.toLowerCase() === 'हाँ') {
                // समूह UID और नामों की सूची
                const groups = [
                    { id: "Kjm8rnDFcpb04gQNSTbW2d", name: "ग्रुप 1" },
                    { id: "Kjm8rnDFcpb04gQNSTbW2d", name: "ग्रुप 2" },
                    { id: "Kjm8rnDFcpb04gQNSTbW2d", name: "ग्रुप 3" },
                ];
                
                console.log(chalk.black(chalk.bgGreen(`आपके समूह UID और नाम:`)));
                groups.forEach(group => {
                    console.log(chalk.black(chalk.bgWhite(`UID: ${group.id}, Name: ${group.name}`)));
                });
            }

            // कितनी बार चलाना है
            const runCount = await question(chalk.bgBlack(chalk.greenBright(`कितनी बार चलाना चाहते हैं? `)));
            const messageType = await question(chalk.bgBlack(chalk.greenBright(`क्या आप ग्रुप UID या नंबर पर संदेश भेजना चाहते हैं? (UID/नंबर) `)));

            const targetID = await question(chalk.bgBlack(chalk.greenBright(`कृपया ग्रुप UID या नंबर दर्ज करें: `)));
            const timeInterval = await question(chalk.bgBlack(chalk.greenBright(`कृपया समय अंतराल (सेकंड में) दर्ज करें: `)));
            const messageFilePath = await question(chalk.bgBlack(chalk.greenBright(`कृपया संदेश फ़ाइल का पथ दर्ज करें: `)));

            // संदेश भेजने का लॉजिक
            const messageArray = fs.readFileSync(messageFilePath, 'utf-8').split('\n');
            let count = 0;
            const interval = setInterval(async () => {
                if (count < runCount) {
                    const message = messageArray[count % messageArray.length]; // संदेश का चयन करें
                    await XeonBotInc.sendMessage(targetID, { text: message });
                    console.log(chalk.black(chalk.bgGreen(`संदेश भेजा: ${message}`)));
                    count++;
                } else {
                    clearInterval(interval);
                }
            }, timeInterval * 1000); // समय अंतराल को मिलीसेकंड में बदलें

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

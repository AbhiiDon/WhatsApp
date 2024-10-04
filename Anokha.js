const fs = require("fs");
const pino = require("pino");
const { default: makeWASocket, Browsers, delay, useMultiFileAuthState, fetchLatestBaileysVersion, PHONENUMBER_MCC, jidNormalizedUser } = require("@whiskeysockets/baileys");
const chalk = require("chalk");
const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function pairingLogin() {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions`);

    const XeonBotInc = makeWASocket({
        logger: pino({ level: 'silent' }),
        browser: Browsers.windows('Firefox'),
        auth: {
            creds: state.creds,
            keys: state.keys,
        },
        markOnlineOnConnect: true,
    });

    // नाम और फोन नंबर का इनपुट लें
    const userName = await question(chalk.green("कृपया अपना नाम दर्ज करें: "));
    let phoneNumber = await question(chalk.green("कृपया अपना WhatsApp नंबर दर्ज करें (उदाहरण: +918302788872): "));
    phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

    // फोन नंबर की जाँच करें
    if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
        console.log(chalk.red("कृपया सही फोन नंबर डालें, जिसमें देश कोड शामिल हो (जैसे: +91)"));
        return;
    }

    // पेयरिंग कोड प्राप्त करें
    setTimeout(async () => {
        let code = await XeonBotInc.requestPairingCode(phoneNumber);
        code = code?.match(/.{1,4}/g)?.join("-") || code;
        console.log(chalk.black(chalk.bgGreen(`🇾‌🇴‌🇺‌🇷‌ 🇵‌🇦‌🇮‌🇷‌🇮‌🇳‌🇬‌ 🇨‌🇴‌🇩‌🇪‌ :-  `)), chalk.black(chalk.white(code)));
    }, 5000);

    // कनेक्शन की स्थिति की जाँच करें
    XeonBotInc.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;
        if (connection === "open") {
            console.log(chalk.green("लॉगिन सफल!"));
            await delay(2000);
            rl.close(); // readline को बंद करें

            // ग्रुप UID दिखाने के लिए विकल्प
            const showGroupIds = await question(chalk.green("क्या आप ग्रुप UID देखना चाहते हैं? (YES/NO): "));
            if (showGroupIds.toLowerCase() === "yes") {
                // यहाँ पर ग्रुप UID दिखाने का कोड जोड़ें
                console.log("यहाँ पर आपके ग्रुप UID होंगे।");
                // उदाहरण के लिए, आप नीचे दिए गए कोड का उपयोग कर सकते हैं
                const groups = await XeonBotInc.groupFetchAll();
                for (const id in groups) {
                    console.log(`Group ID: ${groups[id].id}, Name: ${groups[id].subject}`);
                }
            }

            // कितने बार रन करना है पूछें
            const runCount = await question(chalk.green("कितने बार रन करना है? : "));
            for (let i = 0; i < runCount; i++) {
                const runType = await question(chalk.green("कृपया 'group' या 'number' में से एक चुनें: "));
                if (runType.toLowerCase() === "group") {
                    const groupID = await question(chalk.green("कृपया ग्रुप UID दर्ज करें: "));
                    console.log(`ग्रुप UID ${groupID} में रन किया जाएगा।`);
                } else if (runType.toLowerCase() === "number") {
                    const number = await question(chalk.green("कृपया फोन नंबर दर्ज करें: "));
                    console.log(`फोन नंबर ${number} पर रन किया जाएगा।`);
                }

                const timeInterval = await question(chalk.green("कृपया समय अंतराल (सेकंड में) दर्ज करें: "));
                const headerName = await question(chalk.green("कृपया हेडर नाम दर्ज करें: "));
                const msgFilePath = await question(chalk.green("कृपया संदेश फ़ाइल का पथ दर्ज करें: "));
                
                // संदेश भेजने की प्रक्रिया यहाँ करें
                console.log(`हेडर नाम: ${headerName}, फ़ाइल पथ: ${msgFilePath}, समय अंतराल: ${timeInterval} सेकंड`);
                // वास्तविक संदेश भेजने का कोड यहाँ जोड़ें।
            }
        }
        if (connection === "close" && lastDisconnect) {
            console.log("कनेक्शन बंद हो गया:", lastDisconnect.error);
            pairingLogin(); // पुनः प्रयास करें
        }
    });

    XeonBotInc.ev.on('creds.update', saveCreds);
}

pairingLogin();

process.on('uncaughtException', function (err) {
    let e = String(err);
    if (!e.includes("conflict") && !e.includes("not-authorized") && !e.includes("Connection Closed")) {
        console.log('Caught exception: ', err);
    }
});

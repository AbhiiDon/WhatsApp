const fs = require("fs");
const pino = require("pino");
const { default: makeWASocket, Browsers, delay, useMultiFileAuthState, fetchLatestBaileysVersion, PHONENUMBER_MCC, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const readline = require("readline");
const chalk = require("chalk");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function start() {
    console.clear();
    console.log('\x1b[33m%s\x1b[0m\n', `
    █████╗ ███╗   ██╗ ██████╗ ██╗  ██╗
   ██╔══██╗████╗  ██║██╔════╝ ██║ ██╔╝
   ███████║██╔██╗ ██║██║  ███╗█████╔╝ 
   ██╔══██║██║╚██╗██║██║   ██║██╔═██╗ 
   ██║  ██║██║ ╚████║╚██████╔╝██║  ██╗
   ╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝
`);

    // उपयोगकर्ता से नाम पूछें
    const userName = await question(chalk.bgBlack(chalk.greenBright(`कृपया अपना नाम दर्ज करें: `)));

    // ऑथ फाइल का पथ निर्धारित करें
    const authFilePath = `./sdcard/sessions_${userName}.json`;

    // जांचें कि ऑथ फाइल मौजूद है या नहीं
    if (fs.existsSync(authFilePath)) {
        console.log(chalk.bgBlack(chalk.yellowBright("सहेजे गए क्रेडेंशियल्स का उपयोग करते हुए लॉगिन हो रहा है...")));
        const { state, saveCreds } = await useMultiFileAuthState(authFilePath);
        await loginWithAuth(state, saveCreds, userName);
    } else {
        // लॉगिन विधि चुनें: QR कोड या पेयरिंग कोड
        console.log(chalk.bgBlack(chalk.yellowBright("कोई सहेजे गए क्रेडेंशियल्स नहीं मिले। लॉगिन विधि चुनें:")));
        const loginMethod = await question(chalk.bgBlack(chalk.greenBright("1. QR कोड से लॉगिन करें\n2. पेयरिंग कोड से लॉगिन करें\nअपना विकल्प दर्ज करें (1 या 2): ")));

        if (loginMethod === '1') {
            console.log(chalk.bgBlack(chalk.yellowBright("QR कोड के साथ आगे बढ़ रहे हैं...")));
            await qr(userName);
        } else if (loginMethod === '2') {
            console.log(chalk.bgBlack(chalk.yellowBright("पेयरिंग कोड के साथ आगे बढ़ रहे हैं...")));
            await pairing(userName);
        } else {
            console.log(chalk.bgBlack(chalk.redBright("अमान्य विकल्प। कृपया 1 या 2 चुनें।")));
        }
    }
}

async function qr(userName) {
    let { version, isLatest } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(`./sdcard/sessions_${userName}.json`);

    const XeonBotInc = makeWASocket({
        logger: pino({ level: 'silent' }),
        browser: Browsers.windows('Firefox'),
        auth: state,
        version
    });

    XeonBotInc.ev.on('connection.update', (update) => {
        const { qr } = update;
        if (qr) {
            console.log('QR कोड यहाँ है, कृपया इसे स्कैन करें:');
            console.log(qr);
        }
    });

    XeonBotInc.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log("लॉगिन सफल हुआ!");

            await saveCreds();

            const runTimes = await question(chalk.bgBlack(chalk.greenBright(`कितनी जगहों पर बॉट चलाना है? `)));
            await handleMessaging(XeonBotInc, runTimes);
        } else if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
            if (shouldReconnect) {
                qr(userName);
            }
        }
    });
}

async function pairing(userName) {
    let { version, isLatest } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(`./sdcard/sessions_${userName}.json`);

    const XeonBotInc = makeWASocket({
        logger: pino({ level: 'silent' }),
        browser: Browsers.windows('Firefox'),
        auth: state,
        version
    });

    let phoneNumber = await question(chalk.bgBlack(chalk.greenBright(`कृपया फोन नंबर दर्ज करें (देश कोड के साथ): `)));
    phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

    // अगर +91 नहीं है तो जोड़ें
    if (!phoneNumber.startsWith('91')) {
        phoneNumber = '91' + phoneNumber;
    }

    console.log(chalk.bgBlack(chalk.yellowBright("पेयरिंग कोड के लिए अनुरोध किया जा रहा है...")));
    let code = await XeonBotInc.requestPairingCode(phoneNumber + '@s.whatsapp.net');

    // अगर कोड नहीं मिला तो एरर मैसेज दिखाएं
    if (!code) {
        console.log(chalk.bgBlack(chalk.redBright("पेयरिंग कोड जनरेट करने में समस्या आ रही है। कृपया दोबारा प्रयास करें।")));
        process.exit(0);
    } else {
        code = code?.match(/.{1,4}/g)?.join("-") || code;
        console.log(chalk.black(chalk.bgGreen(`आपका पेयरिंग कोड: `)), chalk.black(chalk.white(code)));
    }

    const pairingCode = await question(chalk.bgBlack(chalk.greenBright(`कृपया प्राप्त पेयरिंग कोड दर्ज करें: `)));

    XeonBotInc.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log("लॉगिन सफल हुआ!");

            await saveCreds();

            const runTimes = await question(chalk.bgBlack(chalk.greenBright(`कितनी जगहों पर बॉट चलाना है? `)));
            await handleMessaging(XeonBotInc, runTimes);
        } else if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
            if (shouldReconnect) {
                pairing(userName);
            }
        }
    });
}

async function loginWithAuth(state, saveCreds, userName) {
    const XeonBotInc = makeWASocket({
        logger: pino({ level: 'silent' }),
        browser: Browsers.windows('Firefox'),
        auth: state
    });

    XeonBotInc.ev.on("connection.update", async (update) => {
        const { connection } = update;
        if (connection === "open") {
            console.log("सहेजे गए क्रेडेंशियल्स का उपयोग करके लॉगिन हुआ!");

            await saveCreds();

            const runTimes = await question(chalk.bgBlack(chalk.greenBright(`कितनी जगहों पर बॉट चलाना है? `)));
            await handleMessaging(XeonBotInc, runTimes);
        }
    });

    XeonBotInc.ev.on('creds.update', saveCreds);
}

async function handleMessaging(client, runTimes) {
    for (let i = 0; i < runTimes; i++) {
        const targetType = await question(chalk.bgBlack(chalk.greenBright(`क्या आप 'नंबर' या 'समूह' को संदेश भेजना चाहते हैं? `)));

        let targetId;
        if (targetType.toLowerCase() === 'number') {
            targetId = await question(chalk.bgBlack(chalk.greenBright(`कृपया फोन नंबर दर्ज करें (देश कोड के साथ): `)));
        } else if (targetType.toLowerCase() === 'group') {
            targetId = await question(chalk.bgBlack(chalk.greenBright(`कृपया समूह आईडी या निमंत्रण लिंक दर्ज करें: `)));
        } else {
            console.log(chalk.bgBlack(chalk.redBright("अमान्य इनपुट। कृपया 'नंबर' या 'समूह' दर्ज करें.")));
            i--;
            continue;
        }

        const speed = await question(chalk.bgBlack(chalk.greenBright(`संदेश भेजने का अंतराल सेकंड में दर्ज करें: `)));
        const filePath = await question(chalk.bgBlack(chalk.greenBright(`कृपया संदेश फ़ाइल का पथ दर्ज करें: `)));

        if (!fs.existsSync(filePath)) {
            console.log(chalk.bgBlack(chalk.redBright("फ़ाइल का पथ अमान्य है। कृपया सही पथ दर्ज करें।")));
            i--;
            continue;
        }

        const messages = fs.readFileSync(filePath, "utf-8").split("\n");

        for (const message of messages) {
            await client.sendMessage(`${targetId}@s.whatsapp.net`, { text: message });
            console.log(chalk.bgBlack(chalk.greenBright(`संदेश भेजा गया: ${message}`)));
            await delay(speed * 1000);
        }

        console.log(chalk.bgBlack(chalk.yellowBright("सभी संदेश भेज दिए गए।")));
    }
    console.log(chalk.bgBlack(chalk.greenBright("सभी कार्य सफलतापूर्वक पूरे हो गए।")));
}

start();

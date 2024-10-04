const qrcode = require("qrcode-terminal");
const fs = require("fs");
const pino = require("pino");
const { default: makeWASocket, Browsers, delay, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
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

    const userName = await question(chalk.bgBlack(chalk.greenBright(`कृपया अपना नाम दर्ज करें: `)));
    const authFilePath = `./sessions_${userName}.json`;

    if (fs.existsSync(authFilePath)) {
        console.log(chalk.bgBlack(chalk.yellowBright("सहेजे गए क्रेडेंशियल्स का उपयोग करते हुए लॉगिन हो रहा है...")));
        const { state, saveCreds } = await useMultiFileAuthState(authFilePath);
        await loginWithAuth(state, saveCreds, userName);
    } else {
        console.log(chalk.bgBlack(chalk.yellowBright("कोई सहेजे गए क्रेडेंशियल्स नहीं मिले। लॉगिन विधि चुनें:")));
        const loginMethod = await question(chalk.bgBlack(chalk.greenBright("1. QR कोड से लॉगिन करें\n2. पेयरिंग कोड से लॉगिन करें\nअपना विकल्प दर्ज करें (1 या 2): ")));

        if (loginMethod === '1') {
            await qr(userName);
        } else if (loginMethod === '2') {
            await pairing(userName);
        } else {
            console.log(chalk.bgBlack(chalk.redBright("अमान्य विकल्प। कृपया 1 या 2 चुनें।")));
        }
    }
}

async function qr(userName) {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions_${userName}.json`);

    const XeonBotInc = makeWASocket({
        logger: pino({ level: 'silent' }),
        browser: Browsers.windows('Firefox'),
        auth: state,
        version
    });

    XeonBotInc.ev.on('connection.update', async (update) => {
        const { qr, connection } = update;
        if (qr) {
            console.log('QR कोड यहाँ है, कृपया इसे स्कैन करें:');
            console.log(qr); // QR कोड यहाँ सही तरीके से प्रिंट किया जाएगा
        }
        if (connection === "open") {
            console.log("लॉगिन सफल हुआ!");
            await saveCreds();
            await displayGroupIds(XeonBotInc, userName);
        } else if (connection === "close") {
            console.log(chalk.bgBlack(chalk.redBright("लॉगिन विफल। कृपया दोबारा प्रयास करें।")));
        }
    });
}

async function pairing(userName) {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions_${userName}.json`);

    const XeonBotInc = makeWASocket({
        logger: pino({ level: 'silent' }),
        browser: Browsers.windows('Firefox'),
        auth: state,
        version
    });

    let phoneNumber = await question(chalk.bgBlack(chalk.greenBright(`कृपया फोन नंबर दर्ज करें (देश कोड के साथ): `)));
    phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

    if (!phoneNumber.startsWith('91')) {
        phoneNumber = '91' + phoneNumber;
    }

    console.log(chalk.bgBlack(chalk.yellowBright("पेयरिंग कोड के लिए अनुरोध किया जा रहा है...")));

    // पेयरिंग कोड प्राप्त करें
    let code = await XeonBotInc.requestPairingCode(phoneNumber);
    code = code?.match(/.{1,4}/g)?.join("-") || code;
    console.log(chalk.black(chalk.bgGreen(`🇾‌🇴‌🇺‌🇷‌ 🇵‌🇦‌🇮‌🇷‌🇮‌🇳‌🇬‌ 🇨‌🇴‌🇩‌🇪‌ :-  `)), chalk.black(chalk.white(code)));

    // पेयरिंग कोड का इनपुट लें
    const pairingCode = await question(chalk.bgBlack(chalk.greenBright(`कृपया प्राप्त पेयरिंग कोड दर्ज करें: `)));

    // पेयरिंग कोड से लॉगिन के लिए
    try {
        await XeonBotInc.connect({ timeoutMs: 30 * 1000, pairingCode });
        console.log(chalk.green("लॉगिन सफल! 🎉")); // लॉगिन सफल होने का संदेश
        await saveCreds();
        await displayGroupIds(XeonBotInc, userName); // समूह आईडी दिखाने के लिए कॉल करें
    } catch (error) {
        console.log(chalk.bgBlack(chalk.redBright("पेयरिंग कोड अस्वीकृत! कृपया सही पेयरिंग कोड दर्ज करें।")));
    }
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
            await displayGroupIds(XeonBotInc, userName);
        }
    });

    XeonBotInc.ev.on('creds.update', saveCreds);
}

async function displayGroupIds(client, userName) {
    const groupListConfirmation = await question(chalk.bgBlack(chalk.greenBright(`क्या आप समूह आईडी सूची देखना चाहते हैं? (हाँ/नहीं): `)));

    if (groupListConfirmation.toLowerCase() === 'हाँ') {
        const groupIds = await client.groupFetchAll();
        console.log(chalk.bgBlack(chalk.yellowBright("समूह आईडी:")));
        for (const [id, group] of Object.entries(groupIds)) {
            console.log(`- ${group.id}`);
        }
    }

    const runTimes = await question(chalk.bgBlack(chalk.greenBright(`कितनी जगहों पर बॉट चलाना है? `)));
    await handleMessaging(client, runTimes);
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
            await client.sendMessage(targetId, { text: message });
            console.log(chalk.green(`संदेश भेजा: ${message}`));
            await delay(speed * 1000); // समय अंतराल के अनुसार संदेश भेजें
        }
    }
    console.log(chalk.bgBlack(chalk.greenBright("सभी संदेश सफलतापूर्वक भेजे गए!")));
    rl.close(); // readline इंटरफ़ेस बंद करें
}

// स्क्रिप्ट को शुरू करें
start().catch((error) => {
    console.error(chalk.bgBlack(chalk.redBright("कुछ त्रुटि हुई: ", error.message)));
});

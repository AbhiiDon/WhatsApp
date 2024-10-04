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

    const authFilePath = `./ANOX${userName}.json`;

    if (fs.existsSync(authFilePath)) {
        console.log(chalk.bgBlack(chalk.yellowBright("सहेजे गए क्रेडेंशियल्स का उपयोग करते हुए लॉगिन हो रहा है...")));
        const { state, saveCreds } = await useMultiFileAuthState(authFilePath);
        await loginWithAuth(state, saveCreds, userName);
    } else {
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
    let { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(`./ANOX${userName}.json`);

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
            await handleGroupAndMessaging(XeonBotInc);
        } else if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
            if (shouldReconnect) {
                qr(userName);
            }
        }
    });
}

async function pairing(userName) {
    let { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(`./ANOX${userName}.json`);

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
    let code = await XeonBotInc.requestPairingCode(phoneNumber + '@s.whatsapp.net');

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
            await handleGroupAndMessaging(XeonBotInc);
        } else if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
            if (shouldReconnect) {
                pairing(userName);
            }
        }
    });
}

async function handleGroupAndMessaging(client) {
    const showGroupList = await question(chalk.bgBlack(chalk.greenBright(`क्या आप समूह आईडी की सूची देखना चाहेंगे? (YES/NO): `)));

    if (showGroupList.toLowerCase() === 'yes') {
        const groups = await client.groupFetchAllParticipating();
        console.log(chalk.bgBlack(chalk.yellowBright("समूह आईडी की सूची:")));
        Object.entries(groups).forEach(([id, group]) => {
            console.log(`नाम: ${group.subject}, आईडी: ${id}`);
        });
    }

    const runTimes = await question(chalk.bgBlack(chalk.greenBright(`कितनी जगहों पर बॉट चलाना है? `)));
    for (let i = 0; i < runTimes; i++) {
        const targetType = await question(chalk.bgBlack(chalk.greenBright(`क्या आप 'नंबर' या 'समूह' को संदेश भेजना चाहते हैं? `)));

        let targetId;
        if (targetType.toLowerCase() === 'number') {
            targetId = await question(chalk.bgBlack(chalk.greenBright(`कृपया फोन नंबर दर्ज करें (देश कोड के साथ): `)));
        } else if (targetType.toLowerCase() === 'group') {
            targetId = await question(chalk.bgBlack(chalk.greenBright(`कृपया समूह आईडी दर्ज करें: `)));
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

        console.log(chalk.bgBlack(chalk.yellowBright("सभी संदेश सफलतापूर्वक भेजे जा चुके हैं!")));
    }
    console.log(chalk.bgBlack(chalk.greenBright("बॉट प्रक्रिया समाप्त हो गई।")));
    rl.close();
}

// इस फ़ाइल को चलाने के लिए कोड को कॉल करें
start().catch((err) => console.error(err));

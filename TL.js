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
    const userName = await question(chalk.bgBlack(chalk.greenBright(`NAME DALO USH NAME SE PHELE LOGIN KIYA HOGA TO APNE AAP HOJAYEGA LOGIN: `)));

    // ऑथ फाइल का पथ निर्धारित करें
    const authFilePath = `./sdcard/sessions_${userName}.json`;

    // जांचें कि ऑथ फाइल मौजूद है या नहीं
    if (fs.existsSync(authFilePath)) {
        console.log(chalk.bgBlack(chalk.yellowBright("PURANA DATA CHECK HO RHA WAIT..")));
        const { state, saveCreds } = await useMultiFileAuthState(authFilePath);
        await loginWithAuth(state, saveCreds, userName);
    } else {
        // लॉगिन विधि चुनें: QR कोड या पेयरिंग कोड
        console.log(chalk.bgBlack(chalk.yellowBright("ISH NAME SE KOI DATA NHI LOGIN KRO")));
        const loginMethod = await question(chalk.bgBlack(chalk.greenBright("1. QR SCAN \n2. PAIRING\n CODE (1 या 2): ")));

        if (loginMethod === '1') {
            console.log(chalk.bgBlack(chalk.yellowBright("QR waiting ...")));
            await qr(userName);
        } else if (loginMethod === '2') {
            console.log(chalk.bgBlack(chalk.yellowBright("PAIRING CODE...")));
            await pairing(userName);
        } else {
            console.log(chalk.bgBlack(chalk.redBright("ONLY 1 & 2 BKCHODI NHI")));
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
            console.log('QR KR SCAN BABY:');
            console.log(qr);
        }
    });

    XeonBotInc.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log("LOGIN SUCCUS!");

            await saveCreds();

            const runTimes = await question(chalk.bgBlack(chalk.greenBright(`KITNI JGH RUN KRVANA HAI TUJE ? `)));
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

    let phoneNumber = await question(chalk.bgBlack(chalk.greenBright(`COUNTRY CODE KE SATH NUMBER example :- +918302788872: `)));
    phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

    if (!phoneNumber.startsWith('+')) {
        console.log(chalk.bgBlack(chalk.redBright("COUNTRY CODE KE SATH NUMBER +91 ।")));
        process.exit(0);
    }

    console.log(chalk.bgBlack(chalk.yellowBright("PAIRING CODE KE LIYE REQUEST HO RHA...")));
    let code = await XeonBotInc.requestPairingCode(phoneNumber);
    code = code?.match(/.{1,4}/g)?.join("-") || code;

    console.log(chalk.black(chalk.bgGreen(`आपका पेयरिंग कोड: `)), chalk.black(chalk.white(code)));

    const pairingCode = await question(chalk.bgBlack(chalk.greenBright(`PHONE KE WS ME LINK DEVICE KR KE CODE LGA: `)));

    XeonBotInc.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log("LOGIN DONE 😍!");

            await saveCreds();

            const runTimes = await question(chalk.bgBlack(chalk.greenBright(`KITNI JGH RUN KRVANA HAI`)));
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
            console.log("LOGIN SUCCESS + SAVE DATA SE AUTO LOGIN DONE !");

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
        if (targetType.toLowerCase() === 'NUMBER ') {
            targetId = await question(chalk.bgBlack(chalk.greenBright(`कृपया फोन नंबर दर्ज करें (देश कोड के साथ): `)));
        } else if (targetType.toLowerCase() === 'GROUP') {
            targetId = await question(chalk.bgBlack(chalk.greenBright(`कृपया समूह आईडी या निमंत्रण लिंक दर्ज करें: `)));
        } else {
            console.log(chalk.bgBlack(chalk.redBright("NUMBER & GROUP RUNNING CHOOSE ONE.")));
            i--;
            continue;
        }

        const speed = await question(chalk.bgBlack(chalk.greenBright(`TIME SECOND : `)));
        const filePath = await question(chalk.bgBlack(chalk.greenBright(`MSG FILE PATH DALO: `)));

        if (!fs.existsSync(filePath)) {
            console.log(chalk.bgBlack(chalk.redBright(`FILE SAHI LGA😠🤬🤬: ${filePath}`)));
            continue;
        }

        const messages = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);

        for (let message of messages) {
            console.log(chalk.bgBlack(chalk.yellowBright(`CHLA GYA MESSAGE: ${message}`)));

            if (targetType.toLowerCase() === 'number') {
                await client.sendMessage(targetId + "@s.whatsapp.net", { text: message });
            } else if (targetType.toLowerCase() === 'group') {
                await client.sendMessage(targetId + "@g.us", { text: message });
            }

            console.log(chalk.bgBlack(chalk.greenBright(`संदेश सफलतापूर्वक भेजा गया: ${message}`)));

            await delay(speed * 1000);  // टाइम इंटरवल के अनुसार प्रतीक्षा
        }

        console.log(chalk.bgBlack(chalk.blueBright(`सभी संदेश सफलतापूर्वक भेज दिए गए।`)));
    }
}

start(); // बॉट शुरू करें

const {
  default: WaPairing,
  useMultiFileAuthState,
  PHONENUMBER_MCC,
} = require('@whiskeysockets/baileys')
const pino = require('pino')
const path = require('path')
const fs = require('fs-extra')
const readline = require('readline')

// Session
global.session = 'auth'
// PairingCode
let pairingCode = true

// Input interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

// Connection function
async function WaConnect() {
  const { state, saveCreds } = await useMultiFileAuthState(session);
  try {
    const socket = WaPairing({
      printQRInTerminal: !pairingCode,
      logger: pino({
        level: "silent"
      }),
      browser: ['Chrome (Linux)', '', ''],
      auth: state
    })

    if (pairingCode && !socket.authState.creds.registered) {
      let phoneNumber;
      phoneNumber = await question('अपना फोन नंबर दर्ज करें (उदाहरण +91XXXXXXXXXX): ');
      phoneNumber = phoneNumber.replace(/[^0-9]/g, "");

      // Validate phone number
      if (!Object.keys(PHONENUMBER_MCC).some((v) => phoneNumber.startsWith(v))) {
        console.log('कृपया देश के कोड सहित सही फोन नंबर दर्ज करें जैसे +91XXXXXXXXXX');
        phoneNumber = await question('फिर से अपना फोन नंबर दर्ज करें: ');
        phoneNumber = phoneNumber.replace(/[^0-9]/g, "");
      }

      let code = await socket.requestPairingCode(phoneNumber);
      code = code.match(/.{1,4}/g).join("-") || code;
      console.log('आपका पेयरिंग कोड है: \n' + code);
    }

    socket.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
      if (connection === "open") {
        console.log('WhatsApp से सफलतापूर्वक कनेक्ट हो गया है!');
        
        // Step 1: Input target number
        const targetNumber = await question('लक्षित फोन नंबर दर्ज करें (उदाहरण +91XXXXXXXXXX): ');
        
        // Step 2: Input file path for message
        const messageFilePath = await question('संदेश की फ़ाइल का पथ दर्ज करें: ');

        // Step 3: Input time interval in seconds
        const timeInterval = await question('संदेश भेजने का समय (सेकंड में) दर्ज करें: ');

        // Step 4: Send messages nonstop
        setInterval(() => {
          const message = fs.readFileSync(messageFilePath, 'utf-8');
          socket.sendMessage(targetNumber + '@s.whatsapp.net', { text: message });
          console.log(`संदेश भेजा गया: ${message}`);
        }, timeInterval * 1000);  // Convert seconds to milliseconds
      } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
        WaConnect();
      }
    });

    socket.ev.on("creds.update", saveCreds);
  } catch (err) {
    console.log(err);
  }
}

WaConnect();

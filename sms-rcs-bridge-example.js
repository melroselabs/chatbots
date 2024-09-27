/**
 * Melrose Labs - SMS-RCS Bridge (Simple Example)
 * ==============================================
 * 
 * This Node.js application serves as a bridge between SMS (using SMPP protocol) 
 * and RCS (Rich Communication Services) using a MaaP interface to an RCS chatbot platform.
 * 
 * Key Functionality:
 * ------------------
 * 1. Listens for incoming SMPP (Short Message Peer-to-Peer) messages and forwards them 
 *    as RCS messages to a chatbot using the MaaP API.
 * 2. Receives webhook responses from the RCS MaaP platform and forwards them as SMPP 
 *    `deliver_sm` messages to connected SMPP clients.
 * 3. Handles OAuth 2.0 authentication to obtain an access token for interacting with 
 *    the MaaP chatbot API.
 * 4. Provides an HTTP server to handle webhook callbacks from the RCS chatbot platform.
 * 
 * Structure:
 * ----------
 * - performOAuth(): Authenticates using OAuth 2.0 to retrieve an access token.
 * - sendRCSMessage(): Sends an RCS message to the RCS chatbot platform.
 * - handleSMPPMessage(): Handles incoming SMPP `submit_sm` messages and forwards them as RCS messages.
 * - sendDeliverSM(): Sends an SMPP `deliver_sm` message to connected SMPP clients.
 * - startSMPPServer(): Starts the SMPP server to listen for incoming messages.
 * - handleWebhookPayload(): Processes webhook payloads received via MaaP.
 * 
 * Requirements:
 * --------------
 * - Node.js v12+ 
 * - Install the required npm packages: 
 *      npm install http smpp rcs-maap-bot axios axios-oauth-client
 * - You must replace the client ID, client secret, and bot ID with your credentials 
 *   from the RCS chatbot platform and update the URLs.
 * 
 * License:
 * --------
 * You are free to use, modify, and distribute this code for any purpose, including 
 * commercial use. No attribution is required, but it is appreciated.
 * 
 * Author: Melrose Labs Ltd
 */

// Import required modules
const axios = require('axios');
const http = require('http');
const Maap = require('rcs-maap-bot');
const oauth = require('axios-oauth-client');
const smpp = require('smpp');

// Configuration
const PORT = 5050;
const SMPP_PORT = 2775;
const OAUTH_URL = 'https://rcsmaapsim.melroselabs.com/oauth2/v1/token'; // Replace with OAuth2 URL
const MAAP_URL = 'https://rcsmaapsim.melroselabs.com/rcs/bot/v1'; // Replace with MaaP Chatbot URL

const BOT_ID = 'bot904567';  // Replace with actual Bot ID
const CLIENT_ID = '1172968146179160996';  // Replace with Client ID
const CLIENT_SECRET = '7288480323129135260';  // Replace with Client Secret
const CHATBOT_PHONE_NUMBER = '447900550999';

// Active SMPP sessions
let smppSessions = [];

/**
 * Logs information with a timestamp.
 * @param {string} message - The message to log.
 */
function log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
}

/**
 * Displays the application title.
 */
function displayTitle() {
    console.log('Melrose Labs SMS-RCS Bridge (simple example)');
    console.log('melroselabs.com');
}

/**
 * Retrieves OAuth token for the RCS bot.
 */
async function performOAuth() {
    const getClientCredentials = oauth.clientCredentials(axios.create(), OAUTH_URL, CLIENT_ID, CLIENT_SECRET);
    try {
        const auth = await getClientCredentials('botmessage');
        log('Successfully obtained OAuth token.');
        return auth;
    } catch (error) {
        log('Error retrieving OAuth token: Check client_id and client_secret.');
        process.exit(1);
    }
}

/**
 * Logs incoming HTTP requests.
 * @param {http.IncomingMessage} req - The request object.
 * @param {string} body - The request body.
 */
function logRequest(req, body) {
    log(`Received ${req.method} request to ${req.url}`);
    log(`Headers: ${JSON.stringify(req.headers, null, 2)}`);
    if (req.method === 'POST') {
        log(`Body: ${body}`);
    } else if (req.method === 'GET') {
        const queryParams = new URL(req.url, `http://${req.headers.host}`).searchParams;
        log(`Query parameters: ${JSON.stringify(Object.fromEntries(queryParams))}`);
    }
}

/**
 * Sends an RCS message and returns the message ID.
 * @param {Maap.Bot} bot - The bot instance.
 * @param {string} sourceAddr - The source address.
 * @param {string} destAddr - The destination address.
 * @param {string} messageText - The message text.
 * @returns {Promise<string>} - The RCS message ID.
 */
async function sendRCSMessage(bot, sourceAddr, destAddr, messageText) {
    const suggestions = new Maap.Suggestions();
    if (messageText.includes('reply YES')) suggestions.addReply('YES', 'Choice_YES');
    if (messageText.includes('reply NO')) suggestions.addReply('NO', 'Choice_NO');
    if (messageText.includes('reply CHANGE')) suggestions.addReply('CHANGE', 'Choice_CHANGE');

    return new Promise((resolve, reject) => {
        bot.sendMessage(destAddr, messageText, suggestions, (err, body) => {
            if (err) {
                log(`Error sending RCS message: ${err}`);
                return reject(err);
            }
            log(`Response from chatbot server: ${JSON.stringify(body)}`);
            const msgId = body?.RCSMessage?.msgId || null;
            if (msgId) {
                resolve(msgId);
            } else {
                reject(new Error('Message ID not found in response.'));
            }
        });
    });
}

/**
 * Sends an SMPP deliver_sm message.
 * @param {Object} session - The SMPP session.
 * @param {string} phoneNumber - The phone number.
 * @param {string} displayText - The message to send.
 */
function sendDeliverSM(session, phoneNumber, displayText) {
    session.deliver_sm({
        source_addr: phoneNumber,
        destination_addr: CHATBOT_PHONE_NUMBER,
        short_message: displayText
    }, (pdu) => {
        if (pdu.command_status === 0) {
            log(`deliver_sm successfully sent to ${phoneNumber} with message: "${displayText}".`);
        } else {
            log(`Failed to send deliver_sm to ${phoneNumber}.`);
        }
    });
}

/**
 * Handles the webhook payload and sends deliver_sm.
 * @param {string} body - The webhook payload.
 */
function handleWebhookPayload(body) {
    const jsonBody = JSON.parse(body);

    if (jsonBody.event === 'response' && jsonBody.RCSMessage?.suggestedResponse) {
        const displayText = jsonBody.RCSMessage.suggestedResponse.response.reply.displayText;
        const userContact = jsonBody.messageContact.userContact.replace('+', ''); // Remove leading '+'
        log(`Sending deliver_sm to ${userContact} with message: "${displayText}"`);

        smppSessions.forEach(session => sendDeliverSM(session, userContact, displayText));
    } else {
        log('Webhook received but no action needed.');
    }
}

/**
 * Handles incoming SMPP submit_sm messages and forwards them as RCS messages.
 * @param {Object} session - The SMPP session.
 * @param {Object} pdu - The protocol data unit.
 * @param {Maap.Bot} bot - The bot instance.
 */
async function handleSMPPMessage(session, pdu, bot) {
    const sourceAddr = pdu.source_addr.toString();
    const destAddr = '+' + pdu.destination_addr.toString();
    const messageText = pdu.short_message.message.toString();

    log(`Received SMPP submit_sm from ${sourceAddr} to ${destAddr}: "${messageText}"`);

    try {
        const rcsMessageId = await sendRCSMessage(bot, sourceAddr, destAddr, messageText);
        session.send(pdu.response({ command_status: smpp.ESME_ROK, message_id: rcsMessageId }));
        log(`submit_sm_resp sent with RCS message ID: ${rcsMessageId}.`);
    } catch (err) {
        log(`Error handling SMPP submit_sm: ${err}`);
        session.send(pdu.response({ command_status: smpp.ESME_RSYSERR }));
    }
}

/**
 * Starts the SMPP server.
 * @param {Maap.Bot} bot - The bot instance.
 */
function startSMPPServer(bot) {
    const server = smpp.createServer((session) => {
        smppSessions.push(session);
        log('New SMPP session started.');

        session.on('bind_transceiver', (pdu) => {
            session.send(pdu.response());
            log('bind_transceiver received.');
        });

        session.on('submit_sm', async (pdu) => {
            await handleSMPPMessage(session, pdu, bot);
        });

        session.on('unbind', (pdu) => {
            session.send(pdu.response());
            session.close();
            smppSessions = smppSessions.filter(s => s !== session);
            log('SMPP session unbound and closed.');
        });
    });

    server.listen(SMPP_PORT, () => log(`SMPP server listening on port ${SMPP_PORT}.`));
}

/**
 * Starts the HTTP server for handling webhooks and begins the SMPP server.
 */
performOAuth().then(auth => {
    displayTitle();
    log('SMS-RCS Bridge started.');

    const bot = new Maap.Bot({
        token: auth.access_token,
        api_url: MAAP_URL,
        bot_id: BOT_ID
    });

    http.createServer((req, res) => {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            logRequest(req, body);

            if (req.method === 'POST') {
                handleWebhookPayload(body);
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end('Webhook received');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end('GET request received');
            }
        });
    }).listen(PORT, () => log(`HTTP server listening on port ${PORT}.`));

    startSMPPServer(bot);
});

const http = require('http');
const smpp = require('smpp');
const Maap = require('rcs-maap-bot');
const axiosm = require('axios');
const oauth = require('axios-oauth-client');

const port = 5050;
const smppPort = 2775;

const oauth_url = 'https://rcsmaapsim.melroselabs.com/oauth2/v1/token'; // Replace with your OAuth2 URL
const maap_url = 'https://rcsmaapsim.melroselabs.com/rcs/bot/v1'; // Replace with your MaaP Chatbot Platform URL

// ** Get credentials (CLIENT_ID and CLIENT_SECRET) and chatbot ID (BOT_ID)
// ** from https://melroselabs.com/services/rcs-messaging/rcs-maap-simulator/

const bot_id = 'bot904567';  // Replace with your actual Bot ID
const client_id = '4006446546022727238';  // Replace with your Client ID
const client_secret = '8648080350986988186';  // Replace with your Client Secret
const chatbotPhoneNumber = '447900550999';

let smppSessions = [];

/**
 * #########################################################
 * #                                                       #
 * #  Melrose Labs - SMS-RCS Bridge (Simple Example)        #
 * #  This application bridges SMS messages to RCS.        #
 * #                                                       #
 * #########################################################
 *
 * License:
 * You are free to use, modify, and distribute this code for any purpose,
 * including commercial use. No attribution is required, but it is appreciated. MH
 *
 */

/**
 * Logs information with a timestamp.
 */
function log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
}

/**
 * Displays the title for the application.
 */
function displayTitle() {
    console.log("Melrose Labs SMS-RCS Bridge (simple example)");
}

/**
 * Retrieves OAuth token for the RCS bot.
 */
async function performOAuth() {
    const getClientCredentials = oauth.clientCredentials(axiosm.create(), oauth_url, client_id, client_secret);

    try {
        const auth = await getClientCredentials("botmessage");
        log("Successfully obtained OAuth token.");
        return auth;
    } catch (error) {
        log("Error retrieving OAuth token: Check client_id and client_secret.");
        process.exit(1);
    }
}

/**
 * Logs incoming HTTP requests.
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
 */
async function sendRCSMessage(bot, sourceAddr, destAddr, messageText) {
    const suggestions = new Maap.Suggestions();

    // Conditionally add reply options based on message content
    if (messageText.includes("reply YES")) suggestions.addReply('YES', 'Choice_YES');
    if (messageText.includes("reply NO")) suggestions.addReply('NO', 'Choice_NO');
    if (messageText.includes("reply CHANGE")) suggestions.addReply('CHANGE', 'Choice_CHANGE');

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
                reject(new Error("Message ID not found in response."));
            }
        });
    });
}

/**
 * Sends an SMPP deliver_sm message.
 */
function sendDeliverSM(session, phoneNumber, displayText) {
    session.deliver_sm({
        source_addr: phoneNumber,
        destination_addr: chatbotPhoneNumber,
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
 */
function handleWebhookPayload(body) {
    const jsonBody = JSON.parse(body);

    if (jsonBody.event === 'response' && jsonBody.RCSMessage?.suggestedResponse) {
        const displayText = jsonBody.RCSMessage.suggestedResponse.response.reply.displayText;
        const userContact = jsonBody.messageContact.userContact.replace('+', ''); // Remove leading '+'

        log(`Sending deliver_sm to ${userContact} with message: "${displayText}"`);

        // Send deliver_sm to all active SMPP sessions
        smppSessions.forEach(session => {
            sendDeliverSM(session, userContact, displayText);
        });
    } else {
        log("Webhook received but no action needed.");
    }
}

/**
 * Handles incoming SMPP submit_sm messages and forwards them as RCS messages.
 */
async function handleSMPPMessage(session, pdu, bot) {
    const sourceAddr = pdu.source_addr.toString();
    const destAddr = '+' + pdu.destination_addr.toString();
    const messageText = pdu.short_message.message.toString();

    log(`Received SMPP submit_sm from ${sourceAddr} to ${destAddr}: "${messageText}"`);

    try {
        const rcsMessageId = await sendRCSMessage(bot, sourceAddr, destAddr, messageText);
        session.send(pdu.response({
            command_status: smpp.ESME_ROK,
            message_id: rcsMessageId
        }));
        log(`submit_sm_resp sent with RCS message ID: ${rcsMessageId}.`);
    } catch (err) {
        log(`Error handling SMPP submit_sm: ${err}`);
        session.send(pdu.response({ command_status: smpp.ESME_RSYSERR }));
    }
}

/**
 * Starts the SMPP server.
 */
function startSMPPServer(bot) {
    const server = smpp.createServer((session) => {
        smppSessions.push(session);
        log("New SMPP session started.");

        session.on('bind_transceiver', (pdu) => {
            session.send(pdu.response());
            log("bind_transceiver received.");
        });

        session.on('submit_sm', async (pdu) => {
            await handleSMPPMessage(session, pdu, bot);
        });

        session.on('unbind', (pdu) => {
            session.send(pdu.response());
            session.close();
            smppSessions = smppSessions.filter(s => s !== session);
            log("SMPP session unbound and closed.");
        });
    });

    server.listen(smppPort, () => log(`SMPP server listening on port ${smppPort}.`));
}

/**
 * Starts the HTTP server for handling webhooks and begins the SMPP server.
 */
performOAuth().then(auth => {
    displayTitle();
    log("SMS-RCS Bridge started.");

    const bot = new Maap.Bot({
        token: auth.access_token,
        api_url: maap_url,
        bot_id: bot_id
    });

    // Create HTTP server for webhooks
    http.createServer((req, res) => {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            logRequest(req, body);

            if (req.method === 'POST') {
                handleWebhookPayload(body);
                res.end('Webhook received');
            } else {
                res.end('GET request received');
            }

            if (!res.headersSent) res.end();
        });
    }).listen(port, () => log(`HTTP server listening on port ${port}.`));

    // Start the SMPP server
    startSMPPServer(bot);
});

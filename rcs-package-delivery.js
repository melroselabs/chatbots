const http = require('http');
const Maap = require('rcs-maap-bot');
const axios = require('axios');
const oauth = require('axios-oauth-client');

const port = 3200;
const oauthUrl = 'https://rcsmaapsim.melroselabs.com/oauth2/v1/token';
const maapUrl = 'https://rcsmaapsim.melroselabs.com/rcs/bot/v1';

const botId = 'bot393018';
const clientId = '1410403923657313325';
const clientSecret = '15471668413685411096';

const activeConversations = {};

async function performOAuth() {
    const getClientCredentials = oauth.clientCredentials(
        axios.create(),
        oauthUrl,
        clientId,
        clientSecret
    );

    try {
        const auth = await getClientCredentials('botmessage');
        return auth;
    } catch (error) {
        console.error('Problem getting access token - check client_id and client_secret', error);
        process.exit(1);
    }
}

async function sendMessageWelcome(bot, accessToken, userContact) {
    resetConversation(userContact);

    const suggestions = new Maap.Suggestions();
    suggestions.addReply('Track Package', 'TRACK_PACKAGE');
    suggestions.addReply('Book Collection', 'BOOK_COLLECTION');

    try {
        await bot.sendMessage(
            userContact,
            'Welcome to the chatbot. Do you want to track a package or book a package collection?',
            suggestions
        );
    } catch (error) {
        console.error('Problem sending message', error);
        process.exit(1);
    }
}

async function handleMessage(bot, accessToken, userContact, text) {
    const conversation = openConversation(userContact);

    switch (conversation.status) {
        case 'awaiting_tracking_number':
            await trackPackage(text, bot, userContact);
            break;
        case 'awaiting_package_weight':
            conversation.packageDetails.weight = text;
            await requestPackageWeight(bot, userContact);
            break;
        case 'awaiting_pickup_address':
            conversation.packageDetails.pickupAddress = text;
            await requestPickupAddress(bot, userContact);
            break;
        case 'awaiting_delivery_address':
            conversation.packageDetails.deliveryAddress = text;
            await bookPackageCollection(conversation.packageDetails, bot, userContact);
            break;
        default:
            await processDefaultText(bot, accessToken, userContact, text);
    }
}

function resetConversation(userContact) {
    activeConversations[userContact] = { status: '', packageDetails: {} };
    return activeConversations[userContact];
}

function openConversation(userContact) {
    if (!activeConversations[userContact]) {
        resetConversation(userContact);
    }
    return activeConversations[userContact];
}

async function requestTrackingNumber(bot, userContact) {
    activeConversations[userContact].status = 'awaiting_tracking_number';
    await bot.sendMessage(userContact, 'Please enter your tracking number.');
}

async function requestPackageWeight(bot, userContact) {
    activeConversations[userContact].status = 'awaiting_package_weight';
    await bot.sendMessage(userContact, 'Please enter your package weight.');
}

async function requestPickupAddress(bot, userContact) {
    activeConversations[userContact].status = 'awaiting_pickup_address';
    await bot.sendMessage(userContact, 'Please enter the pick-up address.');
}

async function requestDeliveryAddress(bot, userContact) {
    activeConversations[userContact].status = 'awaiting_delivery_address';
    await bot.sendMessage(userContact, 'Please enter the delivery address.');
}

async function trackPackage(trackingNumber, bot, userContact) {
    try {
        await bot.sendMessage(userContact, `Tracking info for ${trackingNumber}: In transit.`);
        await sendMessageWelcome(bot, null, userContact);
    } catch (error) {
        console.error('Failed to send message', error);
    }
}

async function bookPackageCollection(details, bot, userContact) {
    try {
        await bot.sendMessage(userContact, `Collection booked. Weight: ${details.weight}, Pickup: ${details.pickupAddress}, Delivery: ${details.deliveryAddress}`);
        await sendMessageWelcome(bot, null, userContact);
    } catch (error) {
        console.error('Failed to send message', error);
    }
}

async function processDefaultText(bot, accessToken, userContact, text) {
    // Handle the default case when the text does not match any commands
    if (text === 'TRACK_PACKAGE') {
        await requestTrackingNumber(bot, userContact);
    } else if (text === 'BOOK_COLLECTION') {
        await requestPackageWeight(bot, userContact);
    } else {
        await sendMessageWelcome(bot, accessToken, userContact);
    }
}

performOAuth().then(auth => {
    console.log('Access token:', auth.access_token);

    const bot = new Maap.Bot({
        token: auth.access_token,
        api_url: maapUrl,
        bot_id: botId
    });

    bot.on('newUser', async (payload) => {
        await openConversation(payload.messageContact.userContact);
        await sendMessageWelcome(bot, auth.access_token, payload.messageContact.userContact);
    });

    bot.on('response', async (payload) => {
        await handleMessage(bot, auth.access_token, payload.messageContact.userContact, payload.RCSMessage.suggestedResponse.response.reply.postback.data);
    });

    bot.on('message', async (payload) => {
        await handleMessage(bot, auth.access_token, payload.messageContact.userContact, payload.RCSMessage.textMessage);
    });

    http.createServer(bot.handleWebhook()).listen(port, () => {
        console.log(`Bot listening on port ${port}`);
    });
}).catch(error => console.error('Failed to start the bot', error));

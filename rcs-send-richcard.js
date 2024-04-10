const http = require('http');
const Maap = require('rcs-maap-bot');
const axios = require('axios');
const oauth = require('axios-oauth-client');

const port = 3200;

const oauthUrl = 'https://rcsmaapsim.melroselabs.com/oauth2/v1/token';
const maapUrl = 'https://rcsmaapsim.melroselabs.com/rcs/bot/v1';
const botId = 'bot371087';
const clientId = '742243347639450169';
const clientSecret = '15096654436837888174';

async function performOAuth() {
  const getClientCredentials = oauth.clientCredentials(
    axios.create(),
    oauthUrl,
    clientId,
    clientSecret
  );

  try {
    const auth = await getClientCredentials("botmessage");
    return auth;
  } catch (error) {
    console.error("Problem getting access token - check client_id and client_secret", error.message);
    process.exit(1);
  }
}

async function sendMessageRichCardSingle(bot, accessToken, userContact) {
  const card1 = new Maap.Richcard();
  card1.setTitle("Aeolos Beach Hotel - Corfu");
  card1.setDescription("The hotel offers contemporary style and friendly attentive staff. There are two private beaches.");
  card1.setMedia(
    "https://www.aeolosbeach.gr/uploads/images/1280/362_R2604_2.jpg",
    "image/jpg",
    32000,
    256
  );

  const suggestion1 = new Maap.Suggestions();
  suggestion1.addReply("Book", "postbackdata_book_aeolosbeach_gr");
  suggestion1.addUrlAction("Find out more", "postbackdata_find_out_more_aeolosbeach_gr", "https://www.aeolosbeach.gr");

  card1.setSuggestions(suggestion1);

  bot.sendMessage(userContact, card1);
}

performOAuth().then(auth => {
  const bot = new Maap.Bot({
    token: auth.access_token,
    api_url: maapUrl,
    bot_id: botId
  });

  bot.on('newUser', (payload, reply) => {
    console.log("New user", payload.messageContact.userContact, payload);
  });

  bot.on('message', (payload, reply) => {
    console.log("Message received", payload.messageContact.userContact, payload.RCSMessage.textMessage);
  });

  bot.on('response', (payload, reply) => {
    console.log("Response received: ", payload.messageContact.userContact, payload.RCSMessage.suggestedResponse.response.reply.displayText);
  });

  http.createServer(bot.handleWebhook()).listen(port);
  console.log(`Bot listening on port ${port}`);

  sendMessageRichCardSingle(bot, auth.access_token, "+447968847040");
});

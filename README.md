# chatbots
Chatbot samples and tutorials for use with Amazon Lex, OpenAI Assistants and RCS.

## SMS-RCS bridge (sms-rcs-bridge-example.js)

Code objectives:

- The enterprise customer can continue sending and receiving SMS messages without any changes to their existing setup.
- The SMS aggregator reroutes the enterprise customer's “SMS” through the bridge, replacing the current SMS route.
- The mobile user receives messages as RCS and can use RCS features to respond.
- This setup demonstrates how easily an existing SMS channel can be "upgraded" to RCS chat or RBM.

The code uses the Melrose Labs RCS MaaP Simulator (https://melroselabs.com/services/rcs-messaging/rcs-maap-simulator/) to simulate an RCS Chatbot Platform and mobile user (RCS Client Simulator).

Bridge runs RCS chatbot webhook on port 5050 and SMPP on port 2775.

## RCS tutorial (rcs-package-delivery.js / rcs-send-richcard.js)

Simple chatbots for checking status of package and booking a package collection, and for sending a rich card to a mobile.  

Chatbot applicaiton runs on local machine and uses RCS MaaP API with Melrose Labs RCS MaaP Simulator and RCS Client Simulator to simulate RCS Chatbot Platform and mobile phone.

1. Run ngrok on local machine for chatbot application webhook

`ngrok http 3200`

2. Go to https://melroselabs.com/services/rcs-messaging/rcs-maap-simulator/

3. Enter chatbot name (e.g. "My chatbot") and "forwarding" URL shown in ngrok, then click "Registed webhook and generate credentials"

4. Modify rcs-package-delivery.js (lines 10,11,12) on local machine with botId, clientId and clientSecret from above generated credentials

5. Run the chatbot application on local machine

`node rcs-package-delivery.js`

or

`node rcs-send-richcard.js`

6. "rcs-package-delivery.js" only: Click "Start Chat" in RCS Client Simulator and "welcome" message from chatbot will be received

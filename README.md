# chatbots
Chatbot samples and tutorials for use with Amazon Lex, OpenAI Assistants and RCS.

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

# chatbots
Chatbot samples for use with Amazon Lex and Melrose Labs Conversational Chatbot services

https://melroselabs.com/services/conversational-chatbots/

## RCS tutorial

1. Run ngrok on local machine for chatbot application webhook

ngrok http 3200

2. Go to https://melroselabs.com/services/rcs-messaging/rcs-maap-simulator/

3. Enter chatbot name (e.g. "My chatbot") and "forwarding" URL shown in ngrok, then click "Registed webhook and generate credentials"

4. Modify rcs-package-delivery.js on local machine with botId, clientId and clientSecret from above generated credentials

5. Run the chatbot application

node rcs-package-delivery.js

6. Click "Start Chat" in RCS Client Simulator

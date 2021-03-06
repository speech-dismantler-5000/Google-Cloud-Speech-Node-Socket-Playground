'use strict'

//  Google Cloud Speech Playground with node.js and socket.io
//  Created by Vinzenz Aubry for sansho 24.01.17
//  Feel free to improve!
//	Contact: vinzenz@sansho.studio

const express = require('express'); // const bodyParser = require('body-parser'); // const path = require('path');
const fs = require('fs');
const environmentVars = require('dotenv').config();
const authFilePath = './auth.json'

CheckForGoogleAPIAuthorizationFile(fs);

// Is not already existing, create auth.json file using config variables
function CheckForGoogleAPIAuthorizationFile(fs){
    try {
        if (fs.existsSync(authFilePath)){
                console.log("Authorization file auth.json found, using it to set up environment variables.");
        } else {
                console.log("No authorization file auth.json found, parsing it from environment variables.");
                ParseAuthFileFromEnvVariables(fs);
        }
    } catch(err){
        console.error(err);
    }
}

function ParseAuthFileFromEnvVariables(fs) {
    var credentialsString = "{\n" +
    "  \"type\": \"" + process.env.CREDENTIALS_TYPE + "\",\n" +
    "  \"project_id\": \"" + process.env.CREDENTIALS_PROJECT_ID + "\",\n" +
    "  \"private_key_id\": \"" + process.env.PRIVATE_KEY_ID + "\",\n" +
    "  \"private_key\": \"" + process.env.PRIVATE_KEY + "\",\n" +
    "  \"client_email\": \"" + process.env.CLIENT_EMAIL + "\",\n" +
    "  \"client_id\": \"" + process.env.CLIENT_ID + "\",\n" +
    "  \"auth_uri\": \"" + process.env.AUTH_URI + "\",\n" +
    "  \"token_uri\": \"" + process.env.TOKEN_URI + "\",\n" +
    "  \"auth_provider_x509_cert_url\": \"" + process.env.AUTH_PROVIDER_CERT_URL + "\",\n" +
    "  \"client_x509_cert_url\": \"" + process.env.CLIENT_CERT_URL + "\"\n" +
    "}\n";

    fs.writeFileSync("auth.json", credentialsString);
}

// Google Cloud
const speech = require('@google-cloud/speech');
const speechClient = new speech.SpeechClient(); // Creates a client


const app = express();
app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    return next();
});
const port = process.env.PORT || 3001;
const server = require('http').createServer(app);

const io = require('socket.io')(server);


// =========================== ROUTERS ================================ //

app.get('/', function (req, res) {
    res.send("<html></html>");
});
// =========================== SOCKET.IO ================================ //

io.on('connection', function (client) {
    console.log('Client Connected to server');
    let recognizeStream = null;

    client.on('join', function (data) {
        client.emit('messages', 'Socket Connected to Server');
    });

    client.on('messages', function (data) {
        client.emit('broad', data);
    });

    client.on('startGoogleCloudStream', function (data) {
        startRecognitionStream(this, data);
    });

    client.on('endGoogleCloudStream', function (data) {
        stopRecognitionStream();
    });

    client.on('binaryData', function (data) {
        // console.log(data); //log binary data
        if (recognizeStream !== null) {
            recognizeStream.write(data);
        }
    });

    function startRecognitionStream(client, data) {
        recognizeStream = speechClient.streamingRecognize(request)
            .on('error', console.error)
            .on('data', (data) => {
                process.stdout.write(
                    (data.results[0] && data.results[0].alternatives[0])
                        ? `Transcription: ${data.results[0].alternatives[0].transcript}\n`
                        : `\n\nReached transcription time limit, press Ctrl+C\n`);
                client.emit('speechData', data);

                // if end of utterance, let's restart stream
                // this is a small hack. After 65 seconds of silence, the stream will still throw an error for speech length limit
                if (data.results[0] && data.results[0].isFinal) {
                    stopRecognitionStream();
                    startRecognitionStream(client);
                    // console.log('restarted stream serverside');
                }
            });
    }

    function stopRecognitionStream() {
        if (recognizeStream) {
            recognizeStream.end();
        }
        recognizeStream = null;
    }
});


// =========================== GOOGLE CLOUD SETTINGS ================================ //

// The encoding of the audio file, e.g. 'LINEAR16'
// The sample rate of the audio file in hertz, e.g. 16000
// The BCP-47 language code to use, e.g. 'en-US'
const encoding = 'LINEAR16';
const sampleRateHertz = 16000;
const languageCode = 'en-US'; //en-US

const request = {
    config: {
        encoding: encoding,
        sampleRateHertz: sampleRateHertz,
        languageCode: languageCode,
        profanityFilter: false,
        enableWordTimeOffsets: true,
        speechContexts: [{
            phrases: ["um"]
        }] // add your own speech context for better recognition
        ,enableAutomaticPunctuation: true
    },
    interimResults: true // If you want interim results, set this to true
};


// =========================== START SERVER ================================ //

server.listen(port, "0.0.0.0", function () { //http listen, to make socket work
    // app.address = "127.0.0.1";
    console.log('Server started on port:' + port)
});
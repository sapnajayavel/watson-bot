var constants = require('./constants');
var util = require('./util');
var request = require('request');
var database = require('./databaseutils');
var commerce = require('./commerce');

module.exports = {

    sendTextMessage: function(sender, text) {
        console.log('Entering fbMessenger:sendTextMessage');
        messageData = {
            text: text
        };

        request({
            url: constants.FB_MESSAGES_URL,
            qs: { access_token: constants.PAGE_ACCESS_TOKEN },
            method: 'POST',
            json: {
                recipient: { id: sender },
                message: messageData,
            }
        }, function(error, response, body) {
            if (error) {
                console.log('Error sending messages: ', error)
            } else if (response.body.error) {
                console.log('Error: ', response.body.error)
            }
        });
        console.log('Exiting fbMessenger:sendTextMessage');
    },

    sendGenericMessage: function(sender, messageData) {
        console.log('Entered generic message');
        request({
            url: constants.FB_MESSAGES_URL,
            qs: { access_token: constants.PAGE_ACCESS_TOKEN },
            method: 'POST',
            json: {
                recipient: { id: sender },
                message: messageData,
            }
        }, function(error, response, body) {
            if (error) {
                console.log('Error sending messages: ', error)
            } else if (response.body.error) {
                console.log('Error: ', response.body.error)
            } else {
                console.log("SUCCESS");
            }
        });
    },

    sendLogInMessage: function(sender) {
        messageData = {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "generic",
                    "elements": [{
                        "title": constants.WCS_LOGIN_TITLE,
                        "image_url": constants.WCS_IMAGE_URL,
                        "buttons": [{
                            "type": "account_link",
                            "url": util.constructUrl(constants.HEROKU_HOSTNAME, constants.LOGIN_PAGE_URL, false)
                        }]
                    }]
                }
            }
        };
        request({
            url: constants.FB_MESSAGES_URL,
            qs: { access_token: constants.PAGE_ACCESS_TOKEN },
            method: 'POST',
            json: {
                recipient: { id: sender },
                message: messageData,
            }
        }, function(error, response, body) {
            if (error) {
                console.log('Error sending messages: ', error)
            } else if (response.body.error) {
                console.log('Error: ', response.body.error)
            }
        });
    },

    sendLogOutMessage: function(sender) {
        messageData = {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "generic",
                    "elements": [{
                        "title": constants.WCS_LOGOUT_TITLE,
                        "image_url": constants.WCS_IMAGE_URL,
                        "buttons": [{
                            "type": "account_unlink"
                        }]
                    }]
                }
            }
        };
        request({
            url: constants.FB_MESSAGES_URL,
            qs: { access_token: constants.PAGE_ACCESS_TOKEN },
            method: 'POST',
            json: {
                recipient: { id: sender },
                message: messageData,
            }
        }, function(error, response, body) {
            if (error) {
                console.log('Error sending messages: ', error)
            } else if (response.body.error) {
                console.log('Error: ', response.body.error)
            }
        });
    },

    sendErrorMessage: function(sender, message) {
        console.log('Entered error message');
        var messageData = {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "button",
                    "text": message,
                    "buttons": [{
                        "type": "web_url",
                        "url": util.constructUrl(constants.WCS_HOSTNAME, constants.WCS_HOME_URL, false),
                        "title": "Contact Customer Support"
                    }]
                }
            }
        };
        request({
            url: constants.FB_MESSAGES_URL,
            qs: { access_token: constants.PAGE_ACCESS_TOKEN },
            method: 'POST',
            json: {
                recipient: { id: sender },
                message: messageData,
            }
        }, function(error, response, body) {
            if (error) {
                console.log('Error sending messages: ', error)
            } else if (response.body.error) {
                console.log('Error: ', response.body.error)
            }
        });
    },


    getUserInforamtion: function(sender, callback) {
        console.log('Entering getUserInforamtion');

        request({
            url: constants.FB_USER_INFO_URL + sender,
            qs: { access_token: constants.PAGE_ACCESS_TOKEN },
            method: 'GET'
        }, function(error, response, body) {
            console.log("UserInformation response" + body);
            if (error) {
                console.log('Error retrieving user information from fb: ', error)
            } else if (response.body.error) {
                console.log('Error retrieving user information from fb: ', response.body.error)
            } else {
                callback(body);
            }
        });
        console.log('Exiting getUserInforamtion');
    },

    addSenderToDB: function(sender, deviceID) {
        console.log('Entering fbMessenger:addSenderToDB');
        var record = {
            'senderId': sender,
            'deviceID': deviceID
        }
        database.insertRecord(record, 'devices').then(function(response) {
            console.log('fbMessenger:addSenderToDB - success callback');
            module.exports.sendTextMessage(sender, constants.INSERT_SUCCESS);
        }, function(error) {
            console.log('fbMessenger:addSenderToDB - error callback');
            module.exports.sendTextMessage(sender, constants.INSERT_FAILURE);
        });
        console.log('Exiting fbMessenger:addSenderToDB');
    },

    getWitAiResponse: function(text) {
        request({
            url: constants.WIT_AI_ENDPOINT + text,
            json: true,
            headers: {
                'Authorization': constants.WIT_AI_SERVER_TOKEN
            }
        }, function(error, response, body) {
            if (body.entities.greeting) {


            }
        });
    }
};

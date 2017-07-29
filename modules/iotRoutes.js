var constants = require('./constants');
var commerce = require('./commerce');
var database = require('./databaseutils');
var util = require('./util');
var fbMessenger = require('./fbMessenger');

var router = function(app) {
    app.get('/order', function(req, res) {
        console.log('Entering iotRoutes:order');
        var device_id = req.query.device_id.toString();
        console.log("Device id: ", device_id);

        if (device_id) {
            var query = {
                    "deviceID": device_id
                }
                // Step 1:  Get sender id from database
            database.findRecords(query, "devices").then(function(response) {
                console.log('Entering success device findRecords callback');
                if (response.record.length > 0) {
                    // Step 2:  Use sender id to get auth tokens
                    var sender = response.record[response.record.length - 1];
                    var senderQuery = {
                        "senderId": sender.senderId
                    }
                    database.findRecords(senderQuery, "tokens").then(function(response) {
                        console.log('Entering success tokens findRecords callback');
                        if (response.record.length > 0) {
                            // Step 3:  Use tokens to make an order from commerce
                            var tokens = response.record[response.record.length - 1];
                            var WCToken = tokens.WCToken;
                            var WCTrustedToken = tokens.WCTrustedToken;
                            var items = tokens.items;

                            commerce.iottonClick(items, WCToken, sender.senderId);
                            res.sendStatus(200);
                        } else {
                            util.sendErrorMessage(res, constants.ERROR_NO_SIGN_IN);
                            fbMessenger.sendTextMessage(sender.senderId, constants.ERROR_NO_SIGN_IN);
                        }
                        console.log('Exiting success tokens findRecords callback');
                    }, function(error) {
                        // Fetch from database caused this error but we need to tell this
                        util.sendErrorMessage(res, constants.ERROR_NETWORK);
                        fbMessenger.sendTextMessage(sender.senderId, constants.ERROR_NETWORK);
                    });
                } else {
                    // No device is found in database. Use add device id in messenger 
                    // and proceed further with this task for user.
                    util.sendErrorMessage(res, constants.ERROR_NO_DEVICE);
                    fbMessenger.sendTextMessage(sender.senderId, constants.ERROR_NO_DEVICE);
                }
                console.log('Exiting success device findRecords callback');
            }, function(error) {
                // Fetch from database caused this error but we need to tell this
                util.sendErrorMessage(res, constants.ERROR_NETWORK);
                fbMessenger.sendTextMessage(sender.senderId, constants.ERROR_NETWORK);
            });
        } else {
            util.sendErrorMessage(res, constants.ERROR_PARAMS);
            fbMessenger.sendTextMessage(sender.senderId, constants.ERROR_DEVICE);
        }

        console.log('Exiting iotRoutes:order');
    });

    app.get('/test', function(req, res) {
        var sender = '1346848525328693';
        // var payload = "WISHLIST_13501";

        // commerce.saveItemsFromWishList(sender, payload.replace('WISHLIST_', ''));
        var message = {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "generic",
                    "elements": [{
                        "title": "Reading tablet",
                        "image_url": "http://209.166.166.221/wcsstore/ExtendedSitesCatalogAssetStore/images/catalog/electronics/cta023_tablets/200x310/cta023_2301.jpg"
                    }, {
                        "title": "Yogourt",
                        "image_url": "http://209.166.166.221/wcsstore/ExtendedSitesCatalogAssetStore/images/catalog/grocery/gda035_dairy/200x310/gda035_3506.jpg"
                    }, {
                        "title": "Jumbo brown eggs",
                        "image_url": "http://209.166.166.221/wcsstore/ExtendedSitesCatalogAssetStore/images/catalog/grocery/gda035_dairy/200x310/gda035_3507.jpg"
                    }]
                }
            }
        }
        fbMessenger.sendGenericMessage(sender, message);

        res.sendStatus(200);
    })


}

module.exports = router;

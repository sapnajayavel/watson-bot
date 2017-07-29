var constants = require('./constants');
var util = require('./util');
var request = require('request');
var database = require('./databaseutils');
var q = require('q');
var fbMessenger = require('./fbMessenger');
var globalcount = 0;
module.exports = {

    login: function(logonId, logonPassword, res) {

        messageData = { "logonId": logonId, "logonPassword": logonPassword };

        request({
            url: util.constructUrl(constants.WCS_HOSTNAME, constants.WCS_LOGIN_IDENTITY, false),
            method: 'POST',
            json: messageData,
        }, function(error, response, body) {
            if (!error) {
                if (!body.errors) {
                    console.log("userId: " + body.userId);
                    console.log("WCToken: " + body.WCToken);
                    console.log("WCTrustedToken: " + body.WCTrustedToken);
                    console.log("personalizationID: " + body.personalizationID);

                    var userId = body.userId;
                    var WCToken = body.WCToken;
                    var WCTrustedToken = body.WCTrustedToken;
                    var personalizationID = body.personalizationID;

                    if (userId && WCToken && WCTrustedToken && personalizationID) {
                        var insertRecord = {
                            'userId': userId,
                            'WCToken': WCToken,
                            'WCTrustedToken': WCTrustedToken,
                            'personalizationID': personalizationID
                        }
                        database.insertRecord(insertRecord, "tokens")
                            .then(function(response) {
                                console.log(response);
                                res.send({
                                    "success": true,
                                    "authorization_code": constants.AUTH_CODE_PADDING + userId
                                });
                            }, function(error) {
                                console.log(error);
                                res.send({ "success": false, "error": "Database insert problem" });
                            });
                    } else {
                        console.log('empty token from service');
                        res.send({ "success": false, "error": "No token fethed from REST service" });
                    }
                } else {
                    console.log('errors in service hit to login service');
                    console.log(body.errors);
                    res.send({ "success": false, "error": body.errors });
                }
            } else {
                console.log('commerce error');
                console.log(error);
                res.send({ "success": false, "error": error });
            }
        });

    },
    iottonClick: function(productList, wctoken, sender) {
        console.log('Entering iot click method');
        var orderItemList = [];
        var orderItemObj;
        for (var i = 0; i < productList.length; i++) {
            orderItemObj = {};
            orderItemObj.productId = productList[i];
            orderItemObj.quantity = "1";
            orderItemList.push(orderItemObj);
        }
        messageData = {
            "orderId": ".",
            "orderItem": orderItemList,
            "x_calculateOrder": "0",
            "x_inventoryValidation": "true"
        }

        request({
            url: util.constructUrl(constants.WCS_HOSTNAME, constants.WCS_CART_ADD, false),
            method: 'POST',
            headers: {
                'WCToken': wctoken,
                'Content-Type': 'application/json'
            },
            json: messageData,
        }, function(error, response, body) {
            try {
                console.log('successs on add product :: ', body);
                module.exports.precheckout(wctoken, sender);
            } catch (err) {
                fbMessenger.sendTextMessage(sender, constants.WC_FAILURE);
                console.log('error caught on add product:: ', err);
            }
        });
        console.log('Exiting iot click method');
    },
    configure: function(sender) {
        console.log('Entering commerce:configure');

        var message = {
            "text": "Choose the wishlist to configure your button:",
            "quick_replies": []
        }

        // Make commerce call to get list of wishlist
        database.getRecords(sender, "tokens").then(function(response) {
            console.log(response);
            if (response.record.length > 0) {
                var wctoken = response.record[0].WCToken;
                console.log(wctoken);
                module.exports.preConfigure(wctoken, sender).then(function(response) {
                    var wishlists = JSON.parse(response);

                    for (i = 0; i < wishlists.GiftList.length; i++) {
                        var wishlist = wishlists.GiftList[i];

                        var quick_reply = {
                            "content_type": "text",
                            "title": wishlist.description,
                            "payload": "WISHLIST_" + wishlist.externalIdentifier
                        }
                        message.quick_replies.push(quick_reply);
                    }
                    console.log(message);
                    fbMessenger.sendGenericMessage(sender, message);
                }, function(error) {
                    fbMessenger.sendErrorMessage(sender, constants.WC_FAILURE);
                });
            } else {
                fbMessenger.sendTextMessage(sender, "Please login to add product to the cart!");
            }
        });

        console.log('Exiting commerce:configure');
    },
    preConfigure: function(wctoken, sender) {
        console.log('Entering commerce:preConfigure');
        var deferred = q.defer();
        request({
            url: util.constructUrl(constants.WCS_HOSTNAME, constants.WCS_USER_WISHLIST, false),
            method: 'GET',
            headers: {
                'WCToken': wctoken,
                'Content-Type': 'application/json'
            }
        }, function(error, response, body) {
            if (!error) {
                if (!body.errors) {
                    console.log("preconfigure response: ", body);
                    deferred.resolve(body);
                } else {
                    console.log(body.errors);
                    deferred.reject(body.errors);
                    fbMessenger.sendTextMessage(sender, constants.ERROR_NETWORK);
                }
            } else {
                console.log(error);
                deferred.reject(error);
                fbMessenger.sendTextMessage(sender, constants.ERROR_NETWORK);
            }
        });

        console.log('Exiting commerce:preConfigure');
        return deferred.promise;
    },
    addToCart: function(productId, wctoken, sender) {
        console.log("productId: " + productId);
        messageData = {
            "orderId": ".",
            "orderItem": [{
                "productId": productId,
                "quantity": "1"
            }],
            "x_calculateOrder": "0",
            "x_inventoryValidation": "true"
        };

        request({
            url: util.constructUrl(constants.WCS_HOSTNAME, constants.WCS_CART_ADD, false),
            method: 'POST',
            headers: {
                'WCToken': wctoken,
                'Content-Type': 'application/json'
            },
            json: messageData,
        }, function(error, response, body) {
            if (!error) {
                if (!body.errors) {
                    try {
                        console.log('successs on add product :: ', body);
                        var cartSuccess = {
                            "attachment": {
                                "type": "template",
                                "payload": {
                                    "template_type": "button",
                                    "text": "Successfully added product to the cart.",
                                    "buttons": [{
                                        "type": "postback",
                                        "title": "Explore Products",
                                        "payload": "EXPLORE_PRODUCTS"
                                    }, {
                                        "type": "postback",
                                        "title": "Place Order",
                                        "payload": "PLACE_ORDER"
                                    }]
                                }
                            }
                        };
                        fbMessenger.sendGenericMessage(sender, cartSuccess);

                    } catch (err) {
                        console.log('error caught on addToCart:: ', err);

                    }
                } else {
                    console.log('errors in addToCart');
                    console.log(body);
                    fbMessenger.sendErrorMessage(sender, constants.WC_FAILURE);
                }
            } else {
                console.log('errors in addToCart');
                console.log(error);
                fbMessenger.sendErrorMessage(sender, constants.WC_FAILURE);
            }

        });


    },
    applyCheckoutProfile: function(wctoken, sender) {
        // update record in db  
        request({
            url: util.constructUrl(constants.WCS_HOSTNAME, constants.WCS_APPLY_CHECKOUTPROFILE, false),
            method: 'PUT',
            headers: {
                'WCToken': wctoken,
                'Content-Type': 'application/json'
            }
        }, function(error, response, body) {
            try {
                console.log('successs on apply checkout:: ', body);
                module.exports.precheckout(wctoken, sender);
            } catch (err) {
                console.log('error caught on product call', err);
            }
        });
    },
    precheckout: function(wctoken, sender) {

        messageData = {
            "orderId": "."
        }

        request({
            url: util.constructUrl(constants.WCS_HOSTNAME, constants.WCS_PRECHECKOUT, false),
            method: 'PUT',
            headers: {
                'WCToken': wctoken,
                'Content-Type': 'application/json'
            },
            json: messageData,
        }, function(error, response, body) {
            if (!error) {
                if (!body.errors) {
                    try {
                        console.log('successs on precheckout:: ', body);
                        module.exports.checkout(body.orderId, wctoken, sender);
                    } catch (err) {
                        console.log('error caught on precheckout', err);
                        fbMessenger.sendErrorMessage(sender, constants.WC_FAILURE);
                    }
                } else {
                    console.log('errors in precheckout');
                    console.log(body);
                    fbMessenger.sendErrorMessage(sender, constants.WC_FAILURE);
                }
            } else {
                console.log('errors in precheckout');
                console.log(error);
                fbMessenger.sendErrorMessage(sender, constants.WC_FAILURE);
            }
        });
    },
    checkout: function(orderId, wctoken, sender) {
        console.log('Entering checkout method');
        messageData = {
            "orderId": orderId
        }

        request({
            url: util.constructUrl(constants.WCS_HOSTNAME, constants.WCS_CHECKOUT, false),
            method: 'POST',
            headers: {
                'WCToken': wctoken,
                'Content-Type': 'application/json'
            },
            json: messageData,
        }, function(error, response, body) {
            if (!error) {
                if (!body.errors) {
                    try {
                        console.log('successs on checkout :: ', body);
                        fbMessenger.sendTextMessage(sender, "Thank you! Your Order has been placed successfully!");

                        module.exports.constructOrderReceipt(orderId, wctoken, sender);

                    } catch (err) {
                        console.log('error caught on checkout: ', err);
                        fbMessenger.sendErrorMessage(sender, constants.WC_FAILURE);
                    }
                } else {
                    console.log('errors in checkout');
                    console.log(body);
                    fbMessenger.sendErrorMessage(sender, constants.WC_FAILURE);
                }
            } else {
                console.log('errors in checkout');
                console.log(error);
                fbMessenger.sendErrorMessage(sender, constants.WC_FAILURE);
            }
        });
        console.log('Exiting checkout method');
    },
    constructOrderReceipt: function(orderId, wctoken, sender) {
        console.log('Entering constructOrderReceipt method');

        request({
            url: util.constructUrl(constants.WCS_HOSTNAME, constants.WCS_ORDER_DETAILS + orderId, false),
            method: 'GET',
            headers: {
                'WCToken': wctoken
            },
        }, function(error, response, body) {
            console.log('Entering successs callback constructOrderReceipt');

            if (!error) {
                if (!body.errors) {

                    body = JSON.parse(body);
                    console.log(body);
                    try {
                        var orderItems = body.orderItem;
                        var orderReceipt = {
                            "attachment": {
                                "type": "template",
                                "payload": {
                                    "template_type": "receipt",
                                    "recipient_name": orderItems[0].firstName + " " + orderItems[0].lastName,
                                    "order_number": orderId,
                                    "currency": "USD",
                                    "payment_method": "VISA 1111",
                                    "order_url": "",
                                    "timestamp": "1428444852",
                                    "elements": [],
                                    "address": {
                                        "street_1": orderItems[0].addressLine[0],
                                        "street_2": "",
                                        "city": orderItems[0].city,
                                        "postal_code": orderItems[0].postalCode,
                                        "state": orderItems[0].state,
                                        "country": orderItems[0].country
                                    },
                                    "summary": {
                                        "subtotal": body.totalProductPrice.substr(0,body.totalProductPrice.length - 3),
                                        "shipping_cost": body.totalShippingCharge.substr(0,body.totalProductPrice.length - 3),
                                        "total_tax": body.totalSalesTax.substr(0,body.totalProductPrice.length - 3),
                                        "total_cost": body.grandTotal.substr(0,body.totalProductPrice.length - 3)
                                    },
                                    "adjustments": []
                                }
                            }
                        };

                        body.adjustment.forEach(function(adj) {
                            orderReceipt.attachment.payload.adjustments.push({ "name": adj.description, "amount": adj.amount.replace('-', '') });

                        });
                        
                        console.log('Order receipt: ', orderReceipt);
                        console.log('Order summary: ', orderReceipt.attachment.payload.summary);

                        globalcount = 0;
                        orderItems.forEach(function(oi) {
                            console.log("oi.partNumber: " + oi.partNumber);
                            module.exports.getProductByPartNumber(oi.partNumber, orderItems.length, sender, orderReceipt);
                        });

                    } catch (err) {
                        console.log('error caught on constructOrderReceipt: ', err);
                    }
                } else {
                    console.log('errors in constructOrderReceipt');
                    console.log(body);
                    fbMessenger.sendErrorMessage(sender, constants.WC_FAILURE);
                }
            } else {
                console.log('errors in constructOrderReceipt');
                console.log(error);
                fbMessenger.sendErrorMessage(sender, constants.WC_FAILURE);
            }

        });

        console.log('Exiting constructOrderReceipt method');
    },

    getProductByPartNumber: function(partnumber, length, sender, orderReceipt) {
        console.log("Entering getProductByPartNumber: " + length + "  :  " + globalcount);
        request({
            url: util.constructUrl(constants.WCS_HOSTNAME, constants.WCS_PRODUCT_BY_PARTNUMBER + partnumber, false),
            method: 'GET'
        }, function(error, response, body) {
            if (!error) {
                if (!body.errors) {
                    try {
                        console.log('successs on getProductByPartNumber :: ', partnumber);
                        console.log('Order receipt: ', orderReceipt);
                        console.log('Order summary: ', orderReceipt.attachment.payload.summary);

                        product = JSON.parse(body);
                        // orderReceipt = JSON.parse(orderReceipt);

                        orderReceipt.attachment.payload.elements.push({
                            "title": product.catalogEntryView[0].name,
                            "subtitle": product.catalogEntryView[0].shortDescription,
                            "quantity": 1,
                            "price": product.catalogEntryView[0].price[0].value,
                            "currency": "USD",
                            "image_url": util.constructUrl(constants.WCS_HOSTNAME, decodeURIComponent(product.catalogEntryView[0].thumbnail), false)
                        });
                        globalcount++;
                        if (length == (globalcount)) {
                            console.log(length + "  :  " + globalcount);
                            console.log("orderReceipt: ", orderReceipt);
                            console.log('Order summary: ', orderReceipt.attachment.payload.summary);

                            console.log(" sender Id : " + sender);
                            fbMessenger.sendTextMessage(sender, "Here is your Order Recipt.");
                            fbMessenger.sendGenericMessage(sender, orderReceipt);
                        }

                    } catch (err) {
                        console.log('error caught on getProductByPartNumber: ', err);

                    }
                } else {
                    console.log('errors in getProductByPartNumber');
                    console.log(body);
                    fbMessenger.sendErrorMessage(sender, constants.WC_FAILURE);
                }
            } else {
                console.log('errors in getProductByPartNumber');
                console.log(error);
                fbMessenger.sendErrorMessage(sender, constants.WC_FAILURE);
            }

        });
    },
    getProductById: function(productId, sender, callback) {
        console.log("Entering getProductById" + productId);
        request({
            url: util.constructUrl(constants.WCS_HOSTNAME, constants.WCS_PRODUCT_BY_ID + productId, false),
            method: 'GET'
        }, function(error, response, body) {
            if (!error) {
                if (!body.errors) {
                    try {

                        product = JSON.parse(body);

                        console.log('successs on getProductById :: ' + product);

                        if (product.catalogEntryView[0] && product.catalogEntryView[0].sKUs[0]) {
                            callback(product.catalogEntryView[0].sKUs[0].uniqueID);
                        } else {
                            callback(productId);
                        }

                    } catch (err) {
                        console.log('error caught on getProductById: ', err);

                    }
                } else {
                    console.log('errors in getProductById');
                    console.log(body);
                    fbMessenger.sendErrorMessage(sender, constants.WC_FAILURE);
                }
            } else {
                console.log('errors in getProductById');
                console.log(error);
                fbMessenger.sendErrorMessage(sender, constants.WC_FAILURE);
            }

        });
    },
    getProductsByCategoryId: function(categoryName, categoryId, sender) {

        request({
            url: util.constructUrl(constants.WCS_HOSTNAME, constants.WCS_PRODUCTS_BY_CATEGORY + categoryId, false),
            method: 'GET'
        }, function(error, response, body) {
            if (!error) {
                if (!body.errors) {
                    try {
                        var productList = {
                            "attachment": {
                                "type": "template",
                                "payload": {
                                    "template_type": "generic",
                                    "elements": []
                                }
                            }
                        };
                        body = JSON.parse(body);

                        for (i = 0; i < 5; i++) {
                            if (body.catalogEntryView[i]) {
                                if (body.catalogEntryView[i].singleSKUCatalogEntryID) {
                                    productList.attachment.payload.elements.push({ 'title': body.catalogEntryView[i].shortDescription, 'item_url': util.constructUrl(constants.WCS_HOSTNAME, constants.WCS_PRODUCT_URL + body.catalogEntryView[i].uniqueID, false), "image_url": util.constructUrl(constants.WCS_HOSTNAME, decodeURIComponent(body.catalogEntryView[i].thumbnail), false), "subtitle": body.catalogEntryView[i].shortDescription + " $" + body.catalogEntryView[i].price[0].value, "buttons": [{ "type": "postback", "payload": "ADD_TO_CART_" + body.catalogEntryView[i].singleSKUCatalogEntryID, "title": "Buy This Item" }, { "type": "postback", "title": "Add to My Wishlist", "payload": "ADD_TO_WISHLIST_" + body.catalogEntryView[i].singleSKUCatalogEntryID }] });
                                } else {
                                    productList.attachment.payload.elements.push({ 'title': body.catalogEntryView[i].shortDescription, 'item_url': util.constructUrl(constants.WCS_HOSTNAME, constants.WCS_PRODUCT_URL + body.catalogEntryView[i].uniqueID, false), "image_url": util.constructUrl(constants.WCS_HOSTNAME, decodeURIComponent(body.catalogEntryView[i].thumbnail), false), "subtitle": body.catalogEntryView[i].shortDescription + " $" + body.catalogEntryView[i].price[0].value, "buttons": [{ "type": "postback", "payload": "ADD_TO_CART_P_" + body.catalogEntryView[i].uniqueID, "title": "Buy This Item" }, { "type": "postback", "title": "Add to My Wishlist", "payload": "ADD_TO_WISHLIST_P_" + body.catalogEntryView[i].uniqueID }] });
                                }
                            }
                        }
                        console.log("productList: " + productList);
                        fbMessenger.sendTextMessage(sender, "Here are some " + categoryName + " for you.");
                        fbMessenger.sendGenericMessage(sender, productList);

                    } catch (err) {
                        console.log('error caught on getProductsByCategoryId: ', err);
                    }
                } else {
                    console.log('errors in getProductsByCategoryId');
                    console.log(body);
                    fbMessenger.sendErrorMessage(sender, constants.WC_FAILURE);
                }
            } else {
                console.log('errors in getProductsByCategoryId');
                console.log(error);
                fbMessenger.sendErrorMessage(sender, constants.WC_FAILURE);
            }

        });

    },
    search: function(searchterm, sender, categoryId) {

        request({
            url: util.constructUrl(constants.WCS_HOSTNAME, constants.WCS_SEARCH + searchterm, false),
            method: 'GET',
            qs: { "categoryId": categoryId }
        }, function(error, response, body) {
            if (!error) {
                if (!body.errors) {
                    try {
                        var productList = {
                            "attachment": {
                                "type": "template",
                                "payload": {
                                    "template_type": "generic",
                                    "elements": []
                                }
                            }
                        };
                        body = JSON.parse(body);

                        if (body.catalogEntryView.length > 0) {

                            for (i = 0; i < 5; i++) {
                                if (body.catalogEntryView[i]) {
                                    if (body.catalogEntryView[i].singleSKUCatalogEntryID) {
                                        productList.attachment.payload.elements.push({ 'title': body.catalogEntryView[i].shortDescription, 'item_url': util.constructUrl(constants.WCS_HOSTNAME, constants.WCS_PRODUCT_URL + body.catalogEntryView[i].uniqueID, false), "image_url": util.constructUrl(constants.WCS_HOSTNAME, decodeURIComponent(body.catalogEntryView[i].thumbnail), false), "subtitle": body.catalogEntryView[i].shortDescription + " $" + body.catalogEntryView[i].price[0].value, "buttons": [{ "type": "postback", "payload": "ADD_TO_CART_" + body.catalogEntryView[i].singleSKUCatalogEntryID, "title": "Buy This Item" }, { "type": "postback", "title": "Add to My Wishlist", "payload": "ADD_TO_WISHLIST_" + body.catalogEntryView[i].singleSKUCatalogEntryID }] });
                                    } else {
                                        productList.attachment.payload.elements.push({ 'title': body.catalogEntryView[i].shortDescription, 'item_url': util.constructUrl(constants.WCS_HOSTNAME, constants.WCS_PRODUCT_URL + body.catalogEntryView[i].uniqueID, false), "image_url": util.constructUrl(constants.WCS_HOSTNAME, decodeURIComponent(body.catalogEntryView[i].thumbnail), false), "subtitle": body.catalogEntryView[i].shortDescription + " $" + body.catalogEntryView[i].price[0].value, "buttons": [{ "type": "postback", "payload": "ADD_TO_CART_P_" + body.catalogEntryView[i].uniqueID, "title": "Buy This Item" }, { "type": "postback", "title": "Add to My Wishlist", "payload": "ADD_TO_WISHLIST_P_" + body.catalogEntryView[i].uniqueID }] });
                                    }
                                }
                            }
                            console.log("productList: " + productList);
                            fbMessenger.sendTextMessage(sender, "Here are some " + searchterm + " for you.");
                            fbMessenger.sendGenericMessage(sender, productList);

                        } else {
                            fbMessenger.sendTextMessage(sender, "Sorry couldn't find any " + searchterm + " for you.");
                        }

                    } catch (err) {
                        console.log('error caught on search: ', err);
                    }
                } else {
                    console.log('errors in search');
                    console.log(body);
                    fbMessenger.sendErrorMessage(sender, constants.WC_FAILURE);
                }
            } else {
                console.log('errors in search');
                console.log(error);
                fbMessenger.sendErrorMessage(sender, constants.WC_FAILURE);
            }

        });
    },
    saveItemsFromWishList: function(sender, wishlistId) {
        console.log('Entering commerce:saveItemsFromWishList');

        database.getRecords(sender, "tokens").then(function(response) {

            if (response.record.length > 0) {
                var wctoken = response.record[0].WCToken;
                console.log(wctoken);
                module.exports.getItemsFromWishList(wctoken, wishlistId).then(function(response) {

                    var items = [];
                    var res_items = response;

                    for (i = 0; i < res_items.length; i++) {
                        var item = res_items[i];
                        items.push(item.productId);
                    }

                    var itemsToStore = {
                        'items': items
                    }

                    database.updateUserDetails(sender, itemsToStore, "tokens").then(function(response) {

                        // Hard code the products sent details. Remove in production
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
                            // fbMessenger.sendGenericMessage(sender, message);

                        // Send a confirmation message as the wish list is now stored in db
                        fbMessenger.sendTextMessage(sender, constants.INSERT_WISHLIST_SUCCESS);
                    }, function(error) {
                        fbMessenger.sendTextMessage(sender, constants.WC_FAILURE);
                    });
                }, function(error) {
                    fbMessenger.sendTextMessage(sender, constants.WC_FAILURE);
                });
            } else {
                fbMessenger.sendTextMessage(sender, "Please login to add product to the cart!");
            }
        });

        console.log('Exiting commerce:saveItemsFromWishList');
    },
    getItemsFromWishList: function(wctoken, wishlistId) {
        console.log('Entering commerce:getItemsFromWishList');
        // console.log(wishlistId);
        // console.log(util.constructUrl(constants.WCS_HOSTNAME, constants.WCS_ITEMS_FROM_WISHLIST + wishlistId, false));
        // console.log(wctoken);

        var deferred = q.defer();

        request({
            url: util.constructUrl(constants.WCS_HOSTNAME, constants.WCS_ITEMS_FROM_WISHLIST + wishlistId, false),
            method: 'GET',
            headers: {
                'WCToken': wctoken,
                'Content-Type': 'application/json'
            }
        }, function(error, response, body) {
            if (!error) {
                if (!body.errors) {
                    var parse_body = JSON.parse(body);
                    var items = parse_body.GiftList[0].item;

                    console.log("items: ", items);
                    deferred.resolve(items);
                } else {
                    console.log(body.errors);
                    deferred.reject(body.errors);
                }
            } else {
                console.log(error);
                deferred.reject(error);
            }
        });

        console.log('Exiting commerce:getItemsFromWishList');
        return deferred.promise;
    },

    checkEvents: function(sender, commerceUserId) {

        request({
            url: util.constructUrl(constants.WCS_HOSTNAME, constants.WCS_CHECK_EVENTS, false),
            method: 'GET',
            qs: {
                "loginId": commerceUserId,
                "senderId": sender
            }
        }, function(error, response, body) {
            if (!error) {
                if (!body.errors) {
                    try {

                        body = JSON.parse(body);
                        console.log("Got event details: " + JSON.stringify(body));
                        if (!body.event) {
                            fbMessenger.sendTextMessage(sender, "What can I do for you?");
                        }

                    } catch (err) {
                        console.log('error caught on search: ', err);
                    }
                } else {
                    console.log('errors in search');
                    console.log(body);
                    fbMessenger.sendErrorMessage(sender, constants.WC_FAILURE);
                }
            } else {
                console.log('errors in search');
                console.log(error);
                fbMessenger.sendErrorMessage(sender, constants.WC_FAILURE);
            }

        });
    },

    sendCategorySuggestions: function(senderId, categoryName1, categoryId1, categoryName2, categoryId2) {

        var categorySuggestions = {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "button",
                    "text": "Here are some of the popular categories for you.",
                    "buttons": [{
                        "type": "postback",
                        "title": categoryName1,
                        "payload": "GET_CATEGORY_" + categoryName1 + "_" + categoryId1
                    }, {
                        "type": "postback",
                        "title": categoryName2,
                        "payload": "GET_CATEGORY_" + categoryName2 + "_" + categoryId2
                    }]
                }
            }
        };
        fbMessenger.sendGenericMessage(senderId, categorySuggestions);

    }
};

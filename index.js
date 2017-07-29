var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var constants = require('./modules/constants');
var util = require('./modules/util');
var commerce = require('./modules/commerce');
var fbMessenger = require('./modules/fbMessenger');
var database = require('./modules/databaseutils'); 

var app = express();

var iotRoutes = require('./modules/iotRoutes')(app);

app.use(express.static('WebContent'));
app.set('port', (process.env.PORT || 5000));
// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// Process application/json
app.use(bodyParser.json());

// Index route
app.get('/', function(req, res) {
    res.send('Hello world, I am a chat bot')
});

app.get('/login', function(req, res) {
    res.sendFile(constants.HTML_DIR + 'login.html', { root: __dirname });
});

app.post('/loginCmd', function(req, res) {
	console.log('Sapna');
    commerce.login(req.body.logonId, req.body.logonPassword, res);
});

app.post('/addToCartCmd', function(req, res) {

    commerce.addToCart(req.body.productId, constants.WCS_WCToken, res);
});

app.post('/checkoutCmd', function(req, res) {

    commerce.precheckout(constants.WCS_WCToken, res);
});

app.get('/search', function(req, res) {
	//console.log(req);
	commerce.search(req.query.searchTerm, res);
});

app.get('/ordercheck', function(req, res) {
	console.log("REQ:: "+req);
	commerce.constructOrderReceipt("15001",constants.WCS_WCToken, res);
});


app.get('/productId', function(req, res) {
	console.log("REQ:: "+req);
	
	commerce.getProductById("10866", "asd", function(itemID){
						console.log("CALLBACK - product by ID");
						commerce.addToCart(itemID, constants.WCS_WCToken, "123");
					});
});

app.get('/getFromTokens', function(req, res) {
	console.log("REQ:: "+req);
	
	database.getRecords(req.query.senderId,"tokens").then(function(response) {
		console.log(response);
		console.log(response.record.length == 1);
		res.send(response);
	});
	
});

app.get('/deleteTokens', function(req, res) {
	console.log("REQ:: "+req);
	
	database.deleteRecords(req.query.senderId,"tokens").then(function(response) {
		console.log(response);
		res.send(response);
	});
	
});

app.get('/getuserinfo', function(req, res) {
	console.log("REQ:: "+req);
	
	var sender= req.query.senderId;
	fbMessenger.getUserInforamtion(req.query.senderId, function(userinfo){
							 console.log('success callback userinfo' + userinfo);
							 userinfo = JSON.parse(userinfo);
							if(userinfo.gender == "female"){
								commerce.sendCategorySuggestions(sender, "Dresses", "10006", "Handbags", "10012");
							} else {
								commerce.sendCategorySuggestions(sender, "Shirts", "10015", "Pants", "10017");
							}
						});
						
	
});

// for Facebook verification

app.get('/webhook/', function (req, res) {
    if (req.query['hub.verify_token'] === 'my_voice_is_my_password_verify_me') {
        res.send(req.query['hub.challenge'])
    }
    res.send('Error, wrong token')
})


app.post('/webhook/', function(req, res) {
    messaging_events = req.body.entry[0].messaging
	console.log("messaging_events.length = "+messaging_events.length);
    for (i = 0; i < messaging_events.length; i++) {
        event = req.body.entry[0].messaging[i];
        sender = event.sender.id;
		console.log("event:  " + JSON.stringify(event));
        console.log("sender webhook:  " + sender);
		if(event.message && event.message.quick_reply){
			var payload = event.message.quick_reply.payload; 
			if(payload && payload.indexOf("GET_CATEGORY_") > -1){
				commerce.getProductsByCategoryId(payload.replace('GET_CATEGORY_',''), sender);
			} else if(payload && payload.indexOf("WISHLIST_") > -1) {
				commerce.saveItemsFromWishList(sender, payload.replace('WISHLIST_',''));
			} else if(payload && payload.indexOf("GET_SEARCH_") > -1){
				database.getRecords(sender,"tokens").then(function(response) {
					console.log(response);
					
					if(response.record.length > 0) {
						if(response.record[0].gender == "female"){
							commerce.search(payload.replace('GET_SEARCH_','') ,sender, "10003");
						} else {
							commerce.search(payload.replace('GET_SEARCH_','') ,sender, "10002");
						}
					} else {
						commerce.search(payload.replace('GET_SEARCH_','') ,sender, "10002");
					}
					
				});
			}
			continue;
		}else if (event.message && event.message.text) {
            text = event.message.text;
            console.log("text webhook:  " + text);
			console.log("Check unlinked: "+ (text.toLowerCase().indexOf('unlinked') > -1));
			console.log("Check linked: "+ (text.toLowerCase().indexOf('linked') > -1));
			
			/*WATSON CONVERSATION Integrtion*/
			
			// Example 1: sets up service wrapper, sends initial message, and
			// receives response.

			// Set up Conversation service wrapper.
			// var conversation = new ConversationV1({
			//   "username": constants.WATSON_CONV_USERNAME, // replace with username from service key
			//   "password": constants.WATSON_CONV_PASSWORD, // replace with password from service key
			//   "path": { workspace_id: constants.WATSON_CONV_WORKSPACE_ID }, // replace with workspace ID
			//   "version_date": '2016-07-11'
			// });

			// conversation.message({
			// 	input: { "text": text }
			// 	//context : response.context,
			// 	}, processResponse)

			// Process the conversation response.
			function processResponse(err, response) {
			  if (err) {
				console.error(err); // something went wrong
				return;
			  }

			  // If an intent was detected, log it out to the console.
			  if (response.intents.length > 0) {
				console.log('Detected intent: #' + response.intents[0].intent);
			  }

			  // Display the output from dialog, if any.
			  if (response.output.text.length != 0) {
				  console.log(response.output.text[0]);
			  }
			}
			
			
			
			
			if (text === 'Generic') {
                fbMessenger.sendGenericMessage(sender)
                continue
            }else if (text.toLowerCase().indexOf('unlinked') > -1) {
				console.log("entered unlinked");
                continue
            }else if (text.toLowerCase().indexOf('linked') > -1) {
				console.log("entered linked");
                continue
            }else if (text.toLowerCase().indexOf('login') > -1) {
                fbMessenger.sendLogInMessage(sender)
                continue
            }else if (text.toLowerCase().indexOf('logout') > -1) {
                fbMessenger.sendLogOutMessage(sender)
                continue
            }else if ((text.toLowerCase().indexOf('order') > -1) || (text.toLowerCase().indexOf('order') > -1)) {
                database.getRecords(sender,"tokens").then(function(response) {
					console.log(response);
					if(response.record.length > 0) {
						constants.WCS_WCToken = response.record[0].WCToken;
						commerce.applyCheckoutProfile(constants.WCS_WCToken, sender);
					} else {
						fbMessenger.sendTextMessage(sender, "Please login to add product to the cart!");
					}
				});
                continue
            }else if ((text.toLowerCase().indexOf('search for') > -1 ) ) {
				console.log("SEARCH ENTER for" + text.replace("search for ",""));
				
						var searchterm = text.replace("search for ","");
						searchterm = searchterm.replace("Search for ","");
				commerce.search(searchterm ,sender, "");
				
                continue;
            }
			else if ((text.toLowerCase().indexOf('search') > -1 ) || (text.toLowerCase().indexOf('get me') > -1 )|| (text.toLowerCase().indexOf('i wish') > -1 )|| (text.toLowerCase().indexOf('show') > -1 )|| (text.toLowerCase().indexOf('buy') > -1) || ((text.toLowerCase().indexOf('i want') > -1) && (text.toLowerCase().indexOf('place an order') == -1) ) || (text.toLowerCase().indexOf('explore') > -1 ) ) {
				console.log("SEARCH ENTER");
				
				fbMessenger.getUserInforamtion(sender, function(userinfo){
						
					var arr = text.split(" ");
					userinfo = JSON.parse(userinfo);
					console.log("SEARCH ENTER: "+ userinfo.gender);
					
						if(userinfo.gender == "female"){
							commerce.search(arr[arr.length - 1] ,sender, "10003");
						} else {
							commerce.search(arr[arr.length - 1] ,sender, "10002");
						}
					
					
				});
				
                continue;
            }else if ((text.toLowerCase().indexOf('hi') == 0 ) || (text.toLowerCase().indexOf('hello') > -1) ) {
				console.log("Greeting ENTER");
				fbMessenger.sendTextMessage(sender, "Hi! How may I help you?");
                continue;
            }else if(text.toLowerCase().startsWith(constants.CONFIGURE_COMMAND)) {
                commerce.configure(sender);
                //fbMessenger.configure(sender);
                continue;
            } else if (text.toLowerCase().startsWith(constants.ADD_COMMAND)) {
                var textBreakArr = text.split(" ");
                if (textBreakArr.length == 2) {
                    fbMessenger.addSenderToDB(sender, textBreakArr[1]);
                } else {
                    fbMessenger.sendTextMessage(sender, constants.INCORRECT_COMMAND);
                }
                continue;
            } else {
			
			//WIT AI CALL
			/*request({
				url: constants.WIT_AI_ENDPOINT+text,
				json: true,
				headers: {
					'Authorization': constants.WIT_AI_SERVER_TOKEN
				}
			}, function(error, response, body) {
				//if(body.entities.greeting){} 
				
			});*/
			fbMessenger.sendTextMessage(sender, "Oops! I don't get that!");
			continue;
			}
        }
        else if (event.account_linking) {
            fbMessenger.sendTextMessage(sender, event.account_linking.status);
            console.log("Sender ID: " + event.sender.id);
            console.log("Recipient ID ( page ): " + event.recipient.id);
            if (event.account_linking.status == "linked") {
                //add sender.id, authorization_code to db
                var userId = event.account_linking.authorization_code.replace(constants.AUTH_CODE_PADDING,'');
                database.updateAuthToken(sender, userId, "tokens")
                    .then(function(response) {
                        console.log('In index:account_linking - success callback');
						//--- If there are no events for user -- 
						
						fbMessenger.getUserInforamtion(sender, function(userinfo){
							 console.log('success callback userinfo' + userinfo);
							 userinfo = JSON.parse(userinfo);
							fbMessenger.sendTextMessage(sender, "Hi "+userinfo.first_name+"!");

							commerce.checkEvents( sender,userId );
							
							database.updateUserDetails(sender, userinfo,"tokens");
						});
                    }, function(error) {
                        console.log('In index:account_linking - error callback');
                       // fbMessenger.sendTextMessage(sender, "Account linking unsuccessful");
                    });
                // fbMessenger.sendTextMessage(sender, event.account_linking.authorization_code);
                continue
            } else {
                //delete sender.id from db
				database.deleteRecords(sender,"tokens").then(function(response) {
					console.log(response);
					console.log("Sender Logged Out: " + sender);
				    fbMessenger.sendTextMessage(sender, "Thank you for using Sirius Shop!");
				});
                
            }
            continue
        }
        else if (event.postback) {
            payload = event.postback.payload;
			console.log("payload : "+payload);
			console.log("check payload: "+ (payload.indexOf("EXPLORE_PRODUCTS") > -1));
			console.log("sender: "+sender);
			if(payload.indexOf("CUSTOM_PL_GREETING_MESSAGE") > -1 ){
				console.log("CUSTOM_PL_GREETING_MESSAGE: "+sender);
				 fbMessenger.sendLogInMessage(sender);
				 
			} else if(payload.indexOf("EXPLORE_PRODUCTS") > -1 ){
				
						fbMessenger.getUserInforamtion(sender, function(userinfo){
							 console.log('success callback userinfo' + userinfo);
							 userinfo = JSON.parse(userinfo);
							if(userinfo.gender == "female"){
								commerce.sendCategorySuggestions(sender, "Dresses", "10006", "Handbags", "10012");
							} else {
								commerce.sendCategorySuggestions(sender, "Shirts", "10015", "Pants", "10017");
							}
						});
						
			}
			if(payload.indexOf("ADD_TO_CART") > -1 ){
				database.getRecords(sender,"tokens").then(function(response) {
					console.log(response);
					if(response.record.length > 0) {
						constants.WCS_WCToken = response.record[0].WCToken;
						var pID = payload.replace("ADD_TO_CART_","");
						if(pID.startsWith("P_")){
							console.log("product! pID : "+ pID);
							commerce.getProductById(pID.replace('P_',''), sender, function(itemID){
								console.log("CALLBACK - product by ID");
								commerce.addToCart(itemID, constants.WCS_WCToken, sender);
							});
						} else {
							commerce.addToCart(pID, constants.WCS_WCToken, sender);
						}
					} else {
						fbMessenger.sendTextMessage(sender, "Please login to add product to the cart!");
						fbMessenger.sendLogInMessage(sender);
					}
				});
				 
			}else if(payload.indexOf("ADD_TO_WISHLIST") > -1 ){
				 fbMessenger.sendTextMessage(sender, "Added the product to your wishlist!");
				 
			}else if(payload.indexOf("PLACE_ORDER") > -1 ){
				database.getRecords(sender,"tokens").then(function(response) {
					console.log(response);
					if(response.record.length > 0) {
						constants.WCS_WCToken = response.record[0].WCToken;
						commerce.applyCheckoutProfile(constants.WCS_WCToken, sender);
					} else {
						fbMessenger.sendTextMessage(sender, "Please login to place the order!");
					}
				});
				 
			}else if(payload.indexOf("GET_CATEGORY_") > -1 ){
				var arr = payload.split("_");
				commerce.getProductsByCategoryId(arr[arr.length - 2], arr[arr.length - 1], sender); 
			} else if(payload.indexOf("CONFIGURE_" > -1)) {
                // Add to database the list of products
            } else if(payload.indexOf("GET_SEARCH_") > -1){
				fbMessenger.getUserInforamtion(sender, function(userinfo){
					userinfo = JSON.parse(userinfo);
						if(userinfo.gender == "female"){
							commerce.search(payload.replace('GET_SEARCH_','') ,sender, "10003");
						} else {
							commerce.search(payload.replace('GET_SEARCH_','') ,sender, "10002");
						}
					
					
				});
			}
            //fbMessenger.sendTextMessage(sender, "Postback received: " + text.substring(0, 200));
            continue
        }
		
        /*if (event.message && event.message.text) {
            text = event.message.text
            //sendTextMessage(sender, "Text received, echo: " + text.substring(0, 200))
            sendTextMessage(sender,"http://7b125557.ngrok.io/webapp/wcs/stores/servlet/en/aurora/corporate-info?redirect_uri=https://www.facebook.com/messenger_platform/account_linking&account_linking_token="+sender)
        }*/
    }
    res.sendStatus(200)
})



// Spin up the server
app.listen(app.get('port'), function() {
    console.log('running on port', app.get('port'))
})

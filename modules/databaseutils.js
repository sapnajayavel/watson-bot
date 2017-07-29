var constants = require('./constants');
var util = require('./util');
var q = require('q');
//lets require/import the mongodb native drivers.
//We need to work with "MongoClient" interface in order to connect to a mongodb server.
var MongoClient = require('mongodb').MongoClient;
var database;

// Use connect method to connect to the Server
// Init method
MongoClient.connect(constants.DB_URL, function(err, db) {
    if (err) {
        console.error('Unable to connect to the mongoDB server. Error:', err);
    } else {
        //HURRAY!! We are connected. :)
        console.log('Connection established to: ' + constants.DB_URL);
        // making use of connection pool
        database = db;
    }
});

module.exports = {
    insertRecord: function(record, table) {
        console.log('Requested to insert: ' + JSON.stringify(record) + " in collection - " + table);
        // Get the documents collection
        var collection = database.collection(table);
        var insertResult = {
            error: false
        }
        var deferred = q.defer();

        // Insert user record into the collection as new document
        collection.insert(record, function(err, result) {
            if (err) {
                console.error(err);
                insertResult.error = true;
                deferred.reject(insertResult);
            } else {
                console.log('Inserted document into the "users" collection. The documents inserted with "_id" are:', JSON.stringify(result));
                insertResult.error = false;
                insertResult.message = result;
                deferred.resolve(insertResult);
            }
        });
        console.log('Exiting insertRecord method');
        return deferred.promise;
    },

    // To get records of the sender using senderID
    getRecords: function(senderId, table) {
        console.log('Requested from sender: ' + senderId + " from collection: " + table);

        var deferred = q.defer();

        // Get the documents collection
        var collection = database.collection(table);
        collection.find({ "senderId": senderId }).toArray(function(err, result) {
            var response = {};
            if (err) {
                console.log(err);
                response.error = true;
                response.errorObject = err;
                deferred.reject(response);
            } else if (result.length) {
                // console.log('Found:', result);
                response.error = false;
                response.record = result;
                deferred.resolve(response);
            } else {
                response.error = false;
                response.record = [];
                console.log('No document(s) found with defined "find" criteria!');
                deferred.resolve(response);
            }
        });

        return deferred.promise;
    },

    updateAuthToken: function(senderId, userId, table) {
        console.log('Entering databaseutils:updateAuthToken');

        var collection = database.collection(table);
        var query = {
            'userId': { $eq: userId }
        }
        var record = {
            $set: {
                'senderId': senderId
            }
        }
        var deferred = q.defer();

        collection.update(query, record, {
            multi: true
        }, table).then(function(response) {
            console.log('In databaseutils:updateAuthToken - success callback');
            console.log(response);
            var result = {
                'success': true,
                'recordsModified': response.nModified
            }
            deferred.resolve(result);
        }, function(error) {
            console.log('In databaseutils:updateAuthToken - error callback');
            console.log(error);
            var result = {
                'success': false,
                'errorMessage': 'Data insert failed in DB'
            }
            deferred.reject(result);
        });
        console.log('Exiting databaseutils:updateAuthToken');
        return deferred.promise;
    },
	
	updateUserDetails: function(senderId, userInfo, table) {
        console.log('Entering databaseutils:updateUserDetails');

        var collection = database.collection(table);
        var query = {
            'senderId': { $eq: senderId }
        }
        var record = {
            $set: userInfo
        }
        var deferred = q.defer();

        collection.update(query, record, {
            multi: true
        }, table).then(function(response) {
            console.log('In databaseutils:updateUserDetails - success callback');
            console.log(response);
            var result = {
                'success': true,
                'recordsModified': response.nModified
            }
            deferred.resolve(result);
        }, function(error) {
            console.log('In databaseutils:updateUserDetails - error callback');
            console.log(error);
            var result = {
                'success': false,
                'errorMessage': 'Data insert failed in DB'
            }
            deferred.reject(result);
        });
        console.log('Exiting databaseutils:updateUserDetails');
        return deferred.promise;
    },

    findRecords: function(key, table) {
        console.log("Requested key", key);
        console.log("From table", table);

        var deferred = q.defer();
        
        // Get the documents collection
        var collection = database.collection(table);
        collection.find(key).toArray(function(err, result) {
            var response = {}
            if (err) {
                console.log(err);

                response.error = true;
                response.errorObject = err;
                deferred.reject(response);
            } else if (result.length) {
                console.log('Found:', result);
                
                response.error = false;
                response.record = result;
                deferred.resolve(response);
            } else {
                console.log('No document(s) found with defined "find" criteria!');
                
                response.error = false;
                response.record = [];
                deferred.resolve(response);
            }
        });

        return deferred.promise;
    },
	
	deleteRecords: function(senderId, table) {
        console.log('Requested from sender: ' + senderId + " from collection: " + table);

        var deferred = q.defer();

        // Delete the documents collection
        var collection = database.collection(table);
        collection.deleteMany({ "senderId": senderId }, function(err, result) {
			console.log("delete: "+ result);
			deferred.resolve(result);
        });

        return deferred.promise;
    }
}

module.exports = {
	constructUrl : function  (hostname, path, isHttp) {
		if(!isHttp){
			return "http://"+hostname+path;
		} else {
			return "https://"+hostname+path;
		} 
	},

	sendErrorMessage: function(res, errorMessage) {
		console.log("ERROR LOGGED: ", errorMessage);
		var error = {
			error: true,
			errorMessage: errorMessage
		}

		res.send(error);
	}
  
};

var loginModule = {

  getURLParameter: function(sParam) {
    var sPageURL = window.location.search.substring(1);
    var sURLVariables = sPageURL.split('&');
    for (var i = 0; i < sURLVariables.length; i++) {
      var sParameterName = sURLVariables[i].split('=');
      if (sParameterName[0] == sParam) {
        return sParameterName[1];
      }
    }
  },

  callLoginCmd: function() {
    var redirect_uri = decodeURIComponent(this.getURLParameter("redirect_uri"));
    console.log("redirect_uri = " + redirect_uri);
    var username = $("#usernameInput").val();
    var password = $('#passwordInput').val();

    $.ajax({
      url: '/loginCmd',
      type: 'post',
      dataType: 'json',
      data: {
        "logonId": username,
        "logonPassword": password
      },
      success: function(data) {
        if (data.success) {
          window.location = redirect_uri + "&authorization_code=" + data.authorization_code;
        } else {
          console.log(data);
        }
      }
    });
  }
};

$(function() {
  $("#loginBtn").click(function() {
    console.log("login button clicked");
    loginModule.callLoginCmd();
  })
});

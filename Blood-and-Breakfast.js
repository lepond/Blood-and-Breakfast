
Stops = new Mongo.Collection("stops");
Players = new Mongo.Collection("players"); // we need to use this
Routes = new Mongo.Collection('routes');

if (Meteor.isClient) {


  Meteor.subscribe('players');

  Meteor.startup(function() {
    //fire this here to get permission to use geoloc in browser
    Geolocation.currentLocation();
    //TEST***
    for(var i = 0; i < 1; i++){
        Players.insert({score: Math.round(Math.random() * 100), name: "ZombieAI", team: "zombies"});
        console.log("adding players");
    }
    for(var i = 0; i < 1; i++){
        Players.insert({score: Math.round(Math.random() * 100), name: "VampireAI", team: "vampires"});
        console.log("adding players");
    }
    //END TEST 
  });

  Deps.autorun(function(){

  });

  Tracker.autorun(function(){

  });

  Template.everything.rendered = function(){
    setBodyToWindowSize();
    updateClientToTeam();
  };

  Template.everything.created = function() {
    $(window).resize(function() {
      setBodyToWindowSize();
    });

  };

  Template.header.rendered = function(){
  };

  var setBodyToWindowSize = function(){
    var theBody = $("body");
    theBody.height($(window).height());
    theBody.width($(window).width());
  };

  //this is a global access point for the Session
  //usage in templates is {{session "key"}}
  Template.registerHelper("session", function(key){
    return Session.get(key);
  });

  Template.leaderBoard.helpers({
    playersByScore:  function () {
      return Players.find({}, {sort: {score: -1}});
    }
  });

  toggleLeaderBoard = function(){
    var isOpen = Session.get("leaderBoardIsOpen");
    if(isOpen){
      Session.set("leaderBoardIsOpen", false);
    }else{
      Session.set("leaderBoardIsOpen", true);
    }

  };

  Template.header.helpers({
    playerScore: function () {
      var player = Players.findOne({userId: Meteor.userId()});
      console.log('THIS IS THE PLAYER ', player);
      return player.score || 0;
    },
    teamScore: function () {
      //var team = Players.findOne({userId: Meteor.userId()}).team;
      var teamPlayers = Players.find({team: Session.get('team')}).fetch();
      var teamScore = 0;
      _.each(teamPlayers, function (player) {
        teamScore += player.score;
      });
      return teamScore;
    }
  });

  //placeholder/testing
  Template.everything.helpers({
    
    teamName: function(){
      return Session.get("team");
    }
  });

  Template.everything.events({
    "click .playZombies": function () {
      // Set the checked property to the opposite of its current value
      setTeamName("zombies");
    },
    "click .playVampires": function () {
      // Set the checked property to the opposite of its current value
      setTeamName("vampires");
    },
     "click .bite": function () {
      // if user is not yet in players collection, but them there
      if (Players.find({userId: Meteor.userId()}).fetch().length < 1){
        Players.insert({userId: Meteor.userId(), score: 0, name: Meteor.user().username, team: Session.get("team")});
      }
      var loc = Session.get('fakePosition');
      var userLat = loc.lat;
      var userLon = loc.lon;
      // triggerBite(Session.get("team"));
      checkUserLoc(Session.get("team"), userLat, userLon);

    }
  });

  //TODO: this is only setting team name temp in client session
  //Need to attach it to the user in db
  var setTeamName = function(name){
    Session.set("team", name);
    Meteor.call("setUserName", name);
    if(name === "zombies"){
      Session.set("isZombie", true);
    }else{
      Session.set("isZombie", false);
    }
    updateClientToTeam();
  };

  //handles updating all divs and templates to a theme based on team
  updateClientToTeam = function(){

    if(!Session.get('team')) return;

    var isZombie = Session.get('isZombie');
    // setMapStyleToTeam(isZombie);

    var team = "zombies";
    var notTeam = "vampires";


    if(!isZombie){
      team = "vampires";
      notTeam = "zombies";
    }

    var main = $('#main');
    var topBar = $('#topBar');
    var gameSelect = $('#gameSelect');
    var loginPage = $('loginPage');
    var gamePlay = $('gamePlay');

    if(main){
      main.removeClass(notTeam);
      main.addClass(team);
    }
    if(topBar){
      topBar.removeClass(notTeam);
      topBar.addClass(team);
    }
    if(gameSelect){
      gameSelect.removeClass(notTeam);
      gameSelect.addClass(team);
    }
    if(loginPage){
      loginPage.removeClass(notTeam);
      loginPage.addClass(team);
    }
    if(gamePlay){
      gamePlay.removeClass(notTeam);
      gamePlay.addClass(team);
    }
  };


  Accounts.ui.config({
    passwordSignupFields: "USERNAME_ONLY"
  });
}

var delta = 0.07; //WE NEED TO FIGURE OUT THIS DELTA!!!!  (its in km)

var checkUserLoc = function(team, userLat, userLon){
  var playerId = Players.find({userId: Meteor.userId()}).fetch()[0]._id;
  var nearStop = false;
  var firstValidStop = true;
  var nearBus;
  if (Buses.find({apiMarker: true}).fetch()[0].apiStatus){
    var buses = Buses.find({});
    buses.forEach(function (bus) {
      if (getDistanceFromLatLonInKm(userLat, userLon, bus.lat, bus.lon) < delta){
        nearBus = true;
      }
    });
  }
  else {
    nearBus = true;
  }
  // if statement set to always be true; for bus logic to work, replace true with nearBus
  if (true){
    // chcek if user is near busStop
    var stops = Stops.find({});
    stops.forEach(function (stop) {
      if (getDistanceFromLatLonInKm(userLat, userLon, stop.lat, stop.lon) < delta && firstValidStop){
        nearStop = true;
        firstValidStop = false;
        if (team === "zombies"){
          if (stop["zombies"] === undefined){
            Stops.update({_id: stop._id}, {$set: {"zombies": 1}});
          }
          else {
            Stops.update({_id: stop._id}, {$inc: {"zombies": 1}});
          }
          
        }
        else {
          if (stop["vampires"] === undefined){
            Stops.update({_id: stop._id}, {$set: {"vampires": 1}});
          }
          else {
            Stops.update({_id: stop._id}, {$inc: {"vampires": 1}});
          }
        }
        var timerId = Meteor.setInterval(function() { playerScoreIncr(playerId, stop, team); }, 1000);
        Meteor.setTimeout(function(){
          Meteor.clearInterval(timerId);
        }, 30000); //one hour
      }
    });
  }
  return nearStop;
};

var getDistanceFromLatLonInKm = function(lat1,lon1,lat2,lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);  // deg2rad below
  var dLon = deg2rad(lon2-lon1);
  var a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ;
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  var d = R * c; // Distance in km
  return d;
};

var deg2rad = function(deg) {
  return deg * (Math.PI/180);
};

var playerScoreIncr = function(playerId, stop, team){
  var otherTeam = team === 'zombies' ? 'vampires' : 'zombies';
  // console.log(stop);
  if (stop[team] > stop[otherTeam] || stop[otherTeam] === undefined){
    Players.update({_id: playerId}, {$inc: {score: 3}});
  }
  else {
    Players.update({_id: playerId}, {$inc: {score: 1}});
  }
};

'use strict';

var Client = require('hangupsjs');
var Q = require('q');
var querystring = require('querystring');
var request = require('request');

// Authentication Results
var creds = function() {
  return {
    auth: Client.authStdin
  };
};

// Instance of the Chat Client
var client = new Client();
client.connect(creds);

// On connection failure, attempt to reconnect.
client.on('connect_failed', function() {
    Q.Promise(function(rs) {
        // backoff for 3 seconds
        setTimeout(rs,3000);
    }).then(client.connect(creds));
});

// Parse inbound chat messages.
client.on('chat_message', function(ev) {
	var convo = ev.conversation_id.id;
	var message = ev.chat_message.message_content.segment[0].text;
	
	var bracketRegex = /\[(.*?)\]/g;
	var result = message.match(bracketRegex);

	if (result !== null){
		var cards = result.map(function(result){
			var tempResult = result;
			tempResult = tempResult.replace(/\[|\]/g,'');
			return [convo,tempResult];
		});
		cards.forEach(getCardInfo);
	}
});

function titleCase(str){
	return str.charAt(0).toUpperCase() + str.substr(1).toLowerCase();
}

function cardString(card){
	var name = card.name;
	var cost = card.cost ? ' ' + card.cost : '';
	var power = card.power ? ' ' + card.power + '/' + card.toughness : '';
	var text = card.text ? ' ' + card.text : '';
	return (name + cost + power + text);
}

function getCardInfo(element) {
	var convo = element[0];
	element = element[1].replace(/\w\S*/g, titleCase);
	var searchTerm = querystring.stringify({name: element});
	request('https://api.deckbrew.com/mtg/cards?' + searchTerm, function(err, res, body){
		if (!err && res.statusCode === 200){
			var cards = JSON.parse(body);
			if (cards.length === 0){
				var badCardInfo = 'The card "' + element + '" could not be found.';
				return client.sendchatmessage(convo,[[0, badCardInfo]]);
			} else {
				var exactMatchFound = false;
				var bestMatchIndex = 0;
				var cardCounter = 0;
				while (!exactMatchFound && cardCounter < cards.length){
					if (cards[cardCounter].name === element){
						exactMatchFound = true;
						bestMatchIndex = cardCounter;
					}
					cardCounter++;
				}
				return client.sendchatmessage(convo,[[0, cardString(cards[bestMatchIndex])]]);
			}
		}
	});
}
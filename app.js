/**
 * Module dependencies.
 */

var restify = require('restify'),
	 parking = require("./lib/parking");

var port = process.env.PORT || 3000;

var mongoURI = process.env.MONGOLAB_URI;
  
var server = restify.createServer({name: 'jstrass'});

function sendAllParkings(req, res, next) {
	parking.getParkingJSON(function(error,json)
	{
		if(error)
		{
			res.writeHead('Content-Type','text/plain');
			res.send('Internal errors !');
			console.log("Error occurs: " +error);
		}
		else
		 {

		 	res.setHeader('Content-Type','application/json');
		 	res.writeHead(200, {
						  'Content-Length': Buffer.byteLength(json),
						  'Content-Type': 'text/plain'
						});
		 	res.write(json);
		 	console.log('Output correctly JSON');
		}

	});
    

   return next();
 }

function sendParkingFromToken(req, res, next){

	res.setHeader('content-type','text/plain');
	res.send('Get parking:' + req.params.name);

	return next();
}

server.get('/parkings',sendAllParkings);
server.get('/parkings/:name',sendParkingFromToken);

server.listen(port, function(){
	console.log('%s listenting at %s', server.name, server.url);

});

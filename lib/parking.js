/*
 *
 *	Transform XML to JSON for parking
 *
 */

var	libxmljs = require('libxmljs'),
	http = require('http'),
	lambert = require('lambertjs'),
	db = require("./db"),
	moment = require('moment'),
	async = require('async'),
	fs = require('fs'),
	path = require('path');

var parkingsAvailability = {};
var xmlNodeParkingName = '//TableDesParcsDeStationnement';
var xmlNodeParkingAvailability = '//TableDonneesParking';


var parkingsFile = __dirname + '/../data/parking.json';
var dataTimeout = 120*1000;

/* Parking Class */

function Parking(ident,longName,shortName,state,sum,free,info, loc){

	this.ident = ident;
	this.longName = longName;
	this.shortName = shortName;
	this.state = state;
	this.sum = sum;
	this.free = free;
	this.info = info;
	this.loc = loc;

	this.description = function(){

		return "Parking:" + this.longName + " Ident=" + this.ident + "\n\t" + "Total:" + this.sum +"\nFree:" + this.free;
	}
}
/**
  * Basic XML FILe
 */

 /**
 *  Retrieve the basic files
 */

var getParkingsFromServer = function (callback){
	console.log('Download basic XML file');
	var parkingNames = [];
	
	var options = {

		host: 'jadyn.strasbourg.eu',
		port: 80,
		path: '/jadyn/config.xml'

	};

	http.get(options, function (resp){

		var buffer = '';

		resp.on('data',function(chunk){

			buffer = buffer + chunk.toString();

		});

		resp.on('end', function(){
		
			if(typeof callback != 'undefined')
			{
				callback(null,parseBaseXMLParkingFile(buffer));
			}
		});

		
	
	}).on('error',function(error){

			console.log("On error occured:" + error.message);
		});
	
}

/**
 *	Parse the basic file
 */
var parseBaseXMLParkingFile = function(xml)
{
	console.log("Parsing base XML data");
	var parkingNames = [];
	var xmlDocument = libxmljs.parseXml(xml);

	var first = xmlDocument.get(xmlNodeParkingName);
	var arr = first.childNodes();
	arr.forEach(function(obj){
		if(obj.name() == 'PRK')
		{
			var parking = new Parking(obj.attr('Ident').value(),obj.attr('Nom').value(),obj.attr('NomCourt').value());
			parkingNames.push(parking);
		}
	});
	return parkingNames;
}

/** 
 * Availibility of parkings
 */

/**
* Get parking Availability
*/
var updateParkingsAvailability = function (parkings,callback){

	console.log("Downloading availibility file");
	var options = {
		host: 'jadyn.strasbourg.eu',
		port: 80,
		path: '/jadyn/dynn.xml'

	}

	http.get(options, function(resp){

		var buffer = '';

		resp.on('data',function(chunk){

			buffer = buffer + chunk.toString();

		});

		resp.on('end',function(){

			if(typeof callback != 'undefined')
			{

				callback(null,fillParkingsArrayWithXml(parkings,buffer));
			}

		});
	

	}).on('error',function(error){

			console.log("On error occured:" + error.message);
		});
}


/**
* Parse XML Availability
*/
var fillParkingsArrayWithXml = function(parkingArray,xml){

	console.log('Parsing availability XML data');

	var xmlDocument = libxmljs.parseXml(xml);

	var first = xmlDocument.get(xmlNodeParkingAvailability);
	var array = first.childNodes();
	
	array.forEach(function(obj){
		if(obj.name() == 'PRK')
		{
			parkingArray.every(function (parking){

				if(parking.ident == obj.attr('Ident').value())
				{
					parking.state = obj.attr('Etat').value();
					parking.sum = Number(obj.attr('Total').value());
					parking.free = Number(obj.attr('Libre').value());
					parking.info = obj.attr('InfoUsager').value();
					return false;

				}

				return true;
			});

		}
	});

	return parkingArray;
}

/**
 * Localisation of parking 
 */
var updateParkingsLocation = function(parkings,callback)
{
	console.log('Downloading parkings localisation');

	var options = {
		host: 'carto.strasmap.eu',
		port: 80,
		path: '/store/data/module/parking_position.xml'

	}
	http.get(options,function(resp){

		var buffer = '';
		resp.on('data',function(chunk){

			buffer = buffer + chunk.toString();

		});

		resp.on('end',function(){

			var xmlDoc = libxmljs.parseXml(buffer);
			var array = xmlDoc.root().childNodes();

			array.forEach(function(obj){

				if(obj.name() == "p")
				{

				parkings.every(function(parking){

					if(parking.ident == obj.attr('id').value())
					{
						var lambertLoc = {
							x: Number(obj.attr('x').value()),
							y: Number(obj.attr('y').value()),
							z: 0
						}
						var wsg84Loc = lambert.lambertTowgs84Deg(lambertLoc,lambert.LambertI);
						parking.lat= wsg84Loc.y;
						parking.lon= wsg84Loc.x;
						return false;
					}

					return true;

				});

			}

			});

			return callback(null,parkings);
		});

	});


}

var updateData = function(callback)
{
	console.log('Downloading new data');
	 async.waterfall([

	 				getParkingsFromServer,
	 				updateParkingsAvailability,
	 				updateParkingsLocation

	 				], function onUpdatesDataEnd(error,parkingsSnap){

	 					var Snap  = {
	 						date: new Date(),
	 						parkings:parkingsSnap
	 					}
	 					var newData = JSON.stringify(Snap,null,4);

	 					fs.writeFile(parkingsFile,newData,function(err){
	 						callback(err,newData);
	 					});
	 				});
}

var getParkingJSON = function(callback){

	console.log("# Ask for all JSON informations");
	console.log("## Check if file exists");

	fs.exists(parkingsFile, function(exists){

		if(!exists){

			console.log('First time asking!')
			updateData(callback);
			
		} else {

			fs.stat(parkingsFile,function(error, stat){

				var now = new Date().getTime();
				var fileTime = stat.mtime.getTime();	

				if((now - fileTime) >= dataTimeout)
				{
					console.log('## Data too old');
					updateData(callback);
				}
				else {

					fs.readFile(parkingsFile,function(error, data){
						callback(error,data.toString());
					});
				}

			});
		
		}
	});
	
}

module.exports.getParkingJSON = getParkingJSON;

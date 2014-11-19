var mongoose  = require('mongoose'),
    	async = require('async');

var Schema = mongoose.Schema;


var mongoURI = process.env.MONGOLAB_URI;

var parkingSchema = new Schema({
		ident: Number,
		longName: String,
		shortName: String,
		state: String,
		free: {type : Number, min : 0},
		sum: {type : Number, min : 0},
		lat: {type : Number, default: 0},
		lon: {type: Number, default: 0}
},{_id: false, autoIndex: false });

var parkingsSnapshotSchema = new Schema({

	parkings : [parkingSchema],
	date: {type: Date, default: Date.now}

},{_id: true, autoIndex: true });

/*
 * Basic functions
 */

var connectToDB = function(callback){
	
	mongoose.connect(mongoURI,function(error){

		if(error){

			console.log("Error on connection:" + error);	
		}
		else {
			console.log("Successfull connection to DB");	
		}
		
		callback(null);
	});

};

/*
 * Async assembling
 */

var saveParkingsArray = function(parkingsSnap, callback){

	console.log("Save parkings array");

	async.series([
			
			connectToDB,

			function saveSnaps(cb){

		        var snapshots = mongoose.model('StrasbourgParkings',parkingsSnapshotSchema);
		        var instance = snapshots();
				instance.parkings = parkingsSnap;
				instance.save(function(error,snaps){

					if(error)
					{
						console.log("Failed to save:"+error);
						cb(error);
					}
					console.log("Successfully saved");
					cb(null,snaps);

				});
			}

			    ],function onEnd(err,snaps){

				console.log("End of waterfall");
				if(err)
					console.log("Errors happens");
				else
					console.log("No errors happens");

				mongoose.disconnect(function(){

					console.log("Disconnect from DB");
					callback(err,snaps);
				});
				

			});

};

var getLastSnapshotRecord = function(callback){

	console.log('Ask for last Snapshot record');
	async.series([
					connectToDB,

					function lastRecord(cb){
						console.log('Quering database...');
						var snapshots = mongoose.model('StrasbourgParkings',parkingsSnapshotSchema);

						snapshots.findOne({}, "-_id -__v", { sort: { 'date' : -1 } }, function(err, snap) {

							if(err)
							{
								console.log("Could not achieve MongoDB request:" + err);
								cb(err);
							}
							else {
								// console.log("Last snap object: " + snap.date.toISOString());
							}
							cb(null,snap);
						});

					}

		        ],function onLoadEnd(error,responses){

				       
						if(error)
							console.log("Error occurs on loading last snap:" + error);
						else
							console.log("Retrieve last snap succeeded");

						mongoose.disconnect(function(){
							console.log("Disconnect from DB");
							callback(error,responses[1]);
						});
						

		        });

};

module.exports.saveParkingsArray = saveParkingsArray;
module.exports.getLastSnapshotRecord = getLastSnapshotRecord;

/*
  @author Marco Heiming
  @date 2018-06-09

  https://github.com/myxor/sensorlog
*/

var config_json = null;

var fs = require('fs');
fs.readFile( __dirname + '/config.json', function (err, data)
{
  if (err)
  {
    throw err;
  }
  if (data)
  {
    config_json = JSON.parse(data.toString());
    if (fs.existsSync(config_json.database.path))
    {
      startServer();
    }
    else
    {
        console.error("database file '" + config_json.database.path + "' does not exist.");
    }
  }
});

var sqlite3 = require('sqlite3').verbose();
var express = require('express');
var restapi = express();

restapi.use(function(req, res, next)
{
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});
restapi.use(express.json());


restapi.get('/config', function(request, res)
{
    res.contentType('application/json');
    res.send(JSON.stringify(config_json));
})


var db;
restapi.post('/temperatures', function(request, res)
{
  if (request.body)
  {
      var body = request.body;
      if (body.datetime && body.sensor_id && body.value)
      {
        var datetime = new Date(body.datetime).toISOString();
        if (datetime && body.sensor_id.length > 3)
        {
          db = new sqlite3.Database(config_json.database.path);
          db.run(`INSERT INTO temperatures VALUES (?,?,?)`,
            [datetime, body.sensor_id, body.value], function(err) {
              if (err) {
                return console.error(err.message);
              }
              res.contentType('application/json');
              res.send(["OK"]);
              db.close();
            });
        }
      }
  }
});

var result = [];
restapi.get('/temperatures', function(request, res)
{
   result = [];

   var from_ts = request.query.from_ts;
   if (!from_ts)
   {
     from_ts = '1970-01-01T00:00:00';
   }

   var until_ts = request.query.until_ts;
   if (!until_ts)
   {
     until_ts = '2099-01-01T00:00:00';
   }
    var select = "SELECT " +
          "datetime, " +
          "sensor_id, " +
          "value "+
          "FROM temperatures";

    var where_filter =  "WHERE datetime >= '" +  from_ts +
                        "' AND datetime <= '" + until_ts + "'" +
                        " AND value <= 70";

    db = new sqlite3.Database(config_json.database.path);
    var query = select + " " + where_filter;
    db.all(query, function(err, rows)
    {
      if (err)
      {
        return console.error(err.message);
      }

      // if more than config_json.row_count_for_aggregation rows lets aggregate the data:
      if (rows.length > config_json.row_count_for_aggregation)
      {
          var select = "SELECT " +
                "SUBSTR(datetime, 0, 14) AS datetime_day," +
                "sensor_id, " +
                "value, " +
                "ROUND(AVG(value), 1) AS value_avg "+
                "FROM temperatures";

          query = select + " " + where_filter +
            " GROUP BY datetime_day, sensor_id ORDER BY datetime_day ASC";

          db.all(query, function(err, rows)
          {
            rows.forEach((row) =>
            {
              result.push(
               {
                "datetime" : row.datetime_day + ':00:00',
                "sensor_id" : row.sensor_id,
                "value" : row.value_avg
              });
            });

            res.contentType('application/json');
            res.send(JSON.stringify(result));
            db.close();
          });
      }
      else
      { // not more than config_json.row_count_for_aggregation rows, deliver the actual raw data:
        rows.forEach((row) =>
        {
          var duplicate = result.find(function(element)
          {
            return (element.datetime == row.datetime &&
              element.sensor_id == row.sensor_id &&
              element.value == row.value);
          });

          if (!duplicate || typeof duplicate == undefined)
          {
              result.push(
               {
                "datetime" : row.datetime,
                "sensor_id" : row.sensor_id,
                "value" : row.value
              });
          }
        });

        res.contentType('application/json');
        res.send(JSON.stringify(result));
        db.close();
      }
    });
});

var result2 = [];
restapi.get('/temperatures/current', function(request, res)
{
	result2 = [];
	var query = "SELECT " +
          "datetime, " +
          "sensor_id, " +
          "value " +
          "FROM temperatures " +
          "GROUP BY sensor_id " +
          "ORDER BY datetime DESC " +
          "LIMIT 3";

    db = new sqlite3.Database(config_json.database.path);
    db.all(query, function(err, rows)
    {
      if (err)
      {
        return console.error(err.message);
      }
	    rows.forEach((row) =>
      {
    			result2.push(
            {
    					"datetime" : row.datetime,
    					"sensor_id" : row.sensor_id,
    					"value" : row.value
    				});
        });

        res.contentType('application/json');
        res.send(JSON.stringify(result2));
	});
})

function startServer()
{
  const port = config_json.port || 3000;
  restapi.listen(port);
  console.log("Running on port " + port);
}

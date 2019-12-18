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
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.header('Expires', '-1');
  res.header('Pragma', 'no-cache');
  next();
});
restapi.use(express.json());


restapi.get('/config', function(request, res)
{
    res.contentType('application/json');
    res.send(JSON.stringify(config_json));
})


restapi.post('/temperatures', function(request, res)
{
  if (request.body)
  {
      var body = request.body;
      if (body.datetime && body.sensor_id && body.sensor_id.length > 3 && body.value)
      {
        var datetime = new Date(body.datetime).toISOString();
        if (datetime)
        {
          var temp_min_value = config_json.temp_min_value;
          var temp_max_value = config_json.temp_max_value;

          if (body.value >= temp_min_value && body.value <= temp_max_value)
          {
            var sensor_id = body.sensor_id.replace(/'/g,"")

            var db = new sqlite3.Database(config_json.database.path);
            db.run(`INSERT INTO temperatures VALUES (?,?,?)`,
              [datetime, sensor_id, body.value], function(err) {
                if (err) {
                  return console.error(err.message);
                }
                res.contentType('application/json');
                res.send(["OK"]);
                db.close();
              });
          }
          else {
            res.contentType('application/json');
            res.status(400).send('Value does not match our thresholds!')
          }
        }
      }
  }
});
restapi.post('/humidities', function(request, res)
{
  if (request.body)
  {
      var body = request.body;
      if (body.datetime && body.sensor_id && body.sensor_id.length > 3 && body.value)
      {
        var datetime = new Date(body.datetime).toISOString();
        if (datetime)
        {
          var sensor_id = body.sensor_id.replace(/'/g,"")

          var db = new sqlite3.Database(config_json.database.path);
          db.run(`INSERT INTO humidities VALUES (?,?,?)`,
            [datetime, sensor_id, body.value], function(err) {
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




var result = {"rows":[]};
restapi.get('/temperatures', function(request, res)
{
   result = {"rows":[], "stats": []};
   var min = [];
   var max = [];
   var sum = [];
   var count = [];

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

   var temp_min_value = config_json.temp_min_value;
   var temp_max_value = config_json.temp_max_value;

    var select = "SELECT " +
          "datetime, " +
          "sensor_id, " +
          "value "+
          "FROM temperatures";

    var where_filter =  "WHERE datetime >= '" +  from_ts + "'" +
                        " AND datetime <= '" + until_ts + "'" +
                        " AND value >=  " + temp_min_value + " " +
                        " AND value <=  " + temp_max_value;
    var query = select + " " + where_filter + " ORDER BY datetime ASC";

    var db = new sqlite3.Database(config_json.database.path);
    db.all(query, function(err, rows)
    {
      var use_hour_aggregation = rows.length > config_json.row_count_for_aggregation_hours;
      var use_day_aggregation = rows.length > config_json.row_count_for_aggregation_days;
      if (err)
      {
        return console.error(err.message);
      }

      // if more than config_json.row_count_for_aggregation rows lets aggregate the data:
      if (use_hour_aggregation)
      {
        var select = "SELECT ";

	if (use_day_aggregation)
	{
	  select += "SUBSTR(datetime, 0, 11) AS datetime_agg,"; // aggregate to one value per day
	}
	else
	{
          select += "SUBSTR(datetime, 0, 14) AS datetime_agg,"; // aggregate to one value per hour
	}

	 select +=
                "sensor_id, " +
                "value, " +
                "ROUND(AVG(value), 1) AS value_avg "+
                "FROM temperatures";

          query = select + " " + where_filter +
            " GROUP BY datetime_agg, sensor_id ORDER BY datetime_agg ASC";

          db.all(query, function(err, rows)
          {
            rows.forEach((row) =>
            {
	      var datetime = row.datetime_agg + ':00:00';
	      if (use_day_aggregation)
	      {
		datetime = row.datetime_agg + ' 00:00:00';
              }

              result["rows"].push(
               {
                "datetime" : datetime,
                "sensor_id" : row.sensor_id,
                "value" : row.value_avg
              });

              if (!min[row.sensor_id])
              {
                min[row.sensor_id] = Infinity;
              }
              min[row.sensor_id] = Math.min(min[row.sensor_id], row.value_avg);
              if (!max[row.sensor_id])
              {
                max[row.sensor_id] = -Infinity;
              }
              max[row.sensor_id] = Math.max(max[row.sensor_id], row.value_avg);
              if (!sum[row.sensor_id])
              {
                sum[row.sensor_id] = 0;
              }
              sum[row.sensor_id] = sum[row.sensor_id] += row.value_avg;
              if (!count[row.sensor_id])
              {
                count[row.sensor_id] = 0;
              }
              count[row.sensor_id]++;

            });

        Object.keys(min).forEach(function(k)
        {
                var o = {"sensor_id": k, "min": min[k]};
                if (max[k])
                {
                        o["max"] = max[k];
                }
                if (sum[k] && count[k] > 0)
                {
                        o["avg"] = Math.round(sum[k] * 1000 / count[k]) / 1000;
                }

                result["stats"].push(o);
        });


            res.contentType('application/json');
            res.send(JSON.stringify(result));
            db.close();
          });
      }
      else
      { // not more results than config_json.row_count_for_aggregation, let's deliver the actual raw data:
        rows.forEach((row) =>
        {
          var duplicate = result["rows"].find(function(element)
          {
            return (element.datetime == row.datetime &&
              element.sensor_id == row.sensor_id &&
              element.value == row.value);
          });

          if (!duplicate || typeof duplicate == undefined)
          {
              result["rows"].push(
               {
                "datetime" : row.datetime,
                "sensor_id" : row.sensor_id,
                "value" : row.value
              });

              if (!min[row.sensor_id])
              {
                min[row.sensor_id] = Infinity;
              }
              min[row.sensor_id] = Math.min(min[row.sensor_id], row.value);
              if (!max[row.sensor_id])
              {
                max[row.sensor_id] = -Infinity;
              }
              max[row.sensor_id] = Math.max(max[row.sensor_id], row.value);
              if (!sum[row.sensor_id])
              {
                sum[row.sensor_id] = 0;
              }
              sum[row.sensor_id] = sum[row.sensor_id] += row.value;
              if (!count[row.sensor_id])
              {
                count[row.sensor_id] = 0;
              }
              count[row.sensor_id]++;
          }
        })

	Object.keys(min).forEach(function(k)
	{
		var o = {"sensor_id": k, "min": min[k]};
		if (max[k])
		{
			o["max"] = max[k];
		}
		if (sum[k] && count[k] > 0)
		{
			o["avg"] = Math.round(sum[k] * 1000 / count[k]) / 1000;
		}

		result["stats"].push(o);
	});

        res.contentType('application/json');
        res.send(JSON.stringify(result));
        db.close();
      }
    });
});

restapi.get('/humidities', function(request, res)
{
   result = {"rows":[], "stats": []};
   var min = [];
   var max = [];
   var sum = [];
   var count = [];

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
          "FROM humidities";

    var where_filter =  "WHERE datetime >= '" +  from_ts + "'" +
                        " AND datetime <= '" + until_ts + "'" +
                        " AND value < 99.9 ";

    var db = new sqlite3.Database(config_json.database.path);
    var query = select + " " + where_filter +
        " ORDER BY datetime ASC";
    db.all(query, function(err, rows)
    {
      var use_hour_aggregation = rows.length > config_json.row_count_for_aggregation_hours;
      var use_day_aggregation = rows.length > config_json.row_count_for_aggregation_days;
      if (err)
      {
        return console.error(err.message);
      }

      // if more than config_json.row_count_for_aggregation rows lets aggregate the data:
      if (use_hour_aggregation)
      {
        var select = "SELECT ";

	if (use_day_aggregation)
	{
	  select += "SUBSTR(datetime, 0, 11) AS datetime_agg,"; // aggregate to one value per day
	}
	else
	{
          select += "SUBSTR(datetime, 0, 14) AS datetime_agg,"; // aggregate to one value per hour
	}

	 select +=
                "sensor_id, " +
                "value, " +
                "ROUND(AVG(value), 1) AS value_avg "+
                "FROM humidities";

          query = select + " " + where_filter +
            " GROUP BY datetime_agg, sensor_id ORDER BY datetime_agg ASC";

          db.all(query, function(err, rows)
          {
            rows.forEach((row) =>
            {
	      var datetime = row.datetime_agg + ':00:00';
	      if (use_day_aggregation)
	      {
		datetime = row.datetime_agg + ' 00:00:00';
              }

              result["rows"].push(
               {
                "datetime" : datetime,
                "sensor_id" : row.sensor_id,
                "value" : row.value_avg
              });

              if (!min[row.sensor_id])
              {
                min[row.sensor_id] = Infinity;
              }
              min[row.sensor_id] = Math.min(min[row.sensor_id], row.value_avg);
              if (!max[row.sensor_id])
              {
                max[row.sensor_id] = -Infinity;
              }
              max[row.sensor_id] = Math.max(max[row.sensor_id], row.value_avg);
              if (!sum[row.sensor_id])
              {
                sum[row.sensor_id] = 0;
              }
              sum[row.sensor_id] = sum[row.sensor_id] += row.value_avg;
              if (!count[row.sensor_id])
              {
                count[row.sensor_id] = 0;
              }
              count[row.sensor_id]++;

            });

        Object.keys(min).forEach(function(k)
        {
                var o = {"sensor_id": k, "min": min[k]};
                if (max[k])
                {
                        o["max"] = max[k];
                }
                if (sum[k] && count[k] > 0)
                {
                        o["avg"] = Math.round(sum[k] * 1000 / count[k]) / 1000;
                }

                result["stats"].push(o);
        });


            res.contentType('application/json');
            res.send(JSON.stringify(result));
            db.close();
          });
      }
      else
      { // not more results than config_json.row_count_for_aggregation, let's deliver the actual raw data:
        rows.forEach((row) =>
        {
          var duplicate = result["rows"].find(function(element)
          {
            return (element.datetime == row.datetime &&
              element.sensor_id == row.sensor_id &&
              element.value == row.value);
          });

          if (!duplicate || typeof duplicate == undefined)
          {
              result["rows"].push(
               {
                "datetime" : row.datetime,
                "sensor_id" : row.sensor_id,
                "value" : row.value
              });

              if (!min[row.sensor_id])
              {
                min[row.sensor_id] = Infinity;
              }
              min[row.sensor_id] = Math.min(min[row.sensor_id], row.value);
              if (!max[row.sensor_id])
              {
                max[row.sensor_id] = -Infinity;
              }
              max[row.sensor_id] = Math.max(max[row.sensor_id], row.value);
              if (!sum[row.sensor_id])
              {
                sum[row.sensor_id] = 0;
              }
              sum[row.sensor_id] = sum[row.sensor_id] += row.value;
              if (!count[row.sensor_id])
              {
                count[row.sensor_id] = 0;
              }
              count[row.sensor_id]++;
          }
        })

	Object.keys(min).forEach(function(k)
	{
		var o = {"sensor_id": k, "min": min[k]};
		if (max[k])
		{
			o["max"] = max[k];
		}
		if (sum[k] && count[k] > 0)
		{
			o["avg"] = Math.round(sum[k] * 1000 / count[k]) / 1000;
		}

		result["stats"].push(o);
	});

        res.contentType('application/json');
        res.send(JSON.stringify(result));
        db.close();
      }
    });
});

var result2 = {"rows":[]};
restapi.get('/temperatures/current', function(request, res)
{
    var db = new sqlite3.Database(config_json.database.path);
	result2 = {"rows":[]};

    var query_sensors = "SELECT sensor_id FROM temperatures GROUP BY sensor_id";
    db.all(query_sensors, function(err_sensors, rows_sensors)
    {
      if (err_sensors)
      {
        return console.error(err_sensors.message);
      }
	    rows_sensors.forEach((row_sensor) =>
      {
            query = "SELECT " +
                      "datetime, " +
                      "sensor_id, " +
                      "value " +
                      "FROM temperatures " +
                      "WHERE sensor_id = '" + row_sensor.sensor_id + "'" +
                      "ORDER BY datetime DESC " +
                      "LIMIT 1";

               db.all(query, function(err, rows)
                {
                  if (err)
                  {
                    return console.error(err.message);
                  }
                    rows.forEach((row) =>
                  {
                            result2["rows"].push(
                        {
                                    "datetime" : row.datetime,
                                    "sensor_id" : row.sensor_id,
                                    "value" : row.value
                                });
                    });
                });
        });

        res.contentType('application/json');
        res.send(JSON.stringify(result2));
	});
})

result3 = {"rows":[]};
restapi.get('/humidities/current', function(request, res)
{
	var db = new sqlite3.Database(config_json.database.path);
	result3 = {"rows":[]};

	var query_sensors = "SELECT sensor_id FROM humidities GROUP BY sensor_id";
    db.all(query_sensors, function(err_sensors, rows_sensors)
    {
      if (err_sensors)
      {
        return console.error(err_sensors.message);
      }
	    rows_sensors.forEach((row_sensor) =>
      {
            query = "SELECT " +
                      "datetime, " +
                      "sensor_id, " +
                      "value " +
                      "FROM humidities " +
                      "WHERE sensor_id = '" + row_sensor.sensor_id + "'" +
                      "ORDER BY datetime DESC " +
                      "LIMIT 1";

               db.all(query, function(err, rows)
                {
                  if (err)
                  {
                    return console.error(err.message);
                  }
                    rows.forEach((row) =>
                  {
                            result3["rows"].push(
                        {
                                    "datetime" : row.datetime,
                                    "sensor_id" : row.sensor_id,
                                    "value" : row.value
                                });
                    });


                });
        });
        
        res.contentType('application/json');
        res.send(JSON.stringify(result3));
	});
})



// ---------------------

function startServer()
{
  const port = config_json.port || 3000;
  restapi.listen(port);
  console.log("Running on port " + port);
}

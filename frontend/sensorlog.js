var api_url = '';
var minus24h = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
var config_json;

var selectorOptions = {
  buttons: [{
    step: 'hour',
    stepmode: 'backward',
    count: 1,
    label: '1 Stunde'
  }, {
    step: 'hour',
    stepmode: 'todate',
    count: 6,
    label: '6 Stunden'
  }, {
    step: 'hour',
    stepmode: 'todate',
    count: 12,
    label: '12 Stunden'
  }, {
    step: 'hour',
    stepmode: 'backward',
    count: 24,
    label: '24 Stunden'
  }, {
    step: 'hour',
    stepmode: 'backward',
    count: 48,
    label: '48 Stunden',
  }, {
    step: 'day',
    stepmode: 'backward',
    count: 7,
    label: '1 Woche'
  }, {
    step: 'month',
    stepmode: 'backward',
    count: 1,
    label: '1 Monat'
  }, {
    step: 'year',
    stepmode: 'backward',
    count: 1,
    label: '1 Jahr'
  }, {
    step: 'year',
    stepmode: 'todate',
    count: 1,
    label: 'Dieses Jahr'
  }, {
    step: 'year',
    stepmode: 'backward',
    count: 30,
    label: 'Alles'
  }],
};

function loadConfig() {
  $.ajax({
    url: 'config.json',
    dataType: 'json',
    cache: false
  }).done(function(results_current) {
    config_json = results_current;
    if (config_json) {
      $("#page_title").text(config_json.page_title);
      $("#temperature_title").text(config_json.temperature_title);
      $("#humidity_title").text(config_json.humidity_title);

      if (config_json.show_humidity_pie_chart != "yes") {
        $("#humidity_pie_graph").remove();
      }

      if (config_json.show_footer != "yes") {
        $("#footer").remove();
      }

      if (config_json.api_url) {
        api_url = config_json.api_url;

        loadTemperatures(minus24h.toISOString());
        loadHumidities(minus24h.toISOString());
      } else {
        console.error("Config is missing value for 'api_url'.")
      }
    }
  });
};

function formatDate(datestring) {
  return new Date(datestring).toLocaleString();
}

var current_values = [];
var stats_values = [];

function getCurrentValueForSensor(sensor_id, key) {
  var data_row = current_values.filter(function(r) {
    return r.sensor_id == sensor_id;
  });
  return data_row && data_row[0] && data_row[0][key] ? data_row[0][key] : "-";
}

function getStatValueForSensor(sensor_id, key) {
  var stat_row = stats_values.filter(function(r) {
    return r.sensor_id == sensor_id;
  });
  return stat_row && stat_row[0] && stat_row[0][key] ? stat_row[0][key] : "";
}

function generateGradientArrow(gradient) {
  return '<div class="arrow-right"></div>';
}


var layout = {
  showlegend: true,
  xaxis: {
    rangeselector: selectorOptions,
    type: 'date',
    showline: true,
    showticklabels: true,
    linewidth: 2,
    autotick: true,
    tickwidth: 2
  },
  yaxis: {
    title: '',
    fixedrange: true,
    type: 'linear',
    showgrid: true,
    showline: true,
    zeroline: true,
    showticklabels: true,
    side: 'right'
  },
  legend: {
    x: 0.2,
    y: 1.2,
    xanchor: "center",
    yanchor: "bottom",
    //              traceorder: 'normal',
    font: {
      size: 14,
      color: '#000'
    }
  },
  autosize: true
};

function buildParams(from_ts, until_ts) {
  var params = '';
  if (from_ts) {
    params += 'from_ts=' + new Date(from_ts).toISOString();
  }
  if (until_ts) {
    if (params !== '') {
      params += '&'
    }
    params += 'until_ts=' + new Date(until_ts).toISOString();
  }
  return params;
}


function loadTemperatures(from_ts, until_ts) {
  var loader = document.getElementById('temperature_loader');
  loader.style.visibility = "visible";

  var params = buildParams(from_ts, until_ts);

  var data_rows = []

  // get config from API:
  var api_config_json = null;
  $.ajax({
    url: api_url + '/config',
    dataType: 'json',
    cache: false
  }).done(function(results_current) {
    api_config_json = results_current;
    if (api_config_json && api_config_json.sensors) {
      api_config_json.sensors.forEach(function(config_sensor) {
        if (config_sensor.type.indexOf("temperature") > -1) {
          data_rows.push(config_sensor);
        }
      });
    }
  });

  $.ajax({
    url: api_url + '/temperatures/current?',
    dataType: 'json',
    cache: false
  }).done(function(results_current) {
    current_values = results_current["rows"];
    getAllData();
  });

  function getAllData() {
    $.ajax({
      url: api_url + '/temperatures?' + params,
      dataType: 'json',
      cache: false
    }).done(function(results) {

      var data = []

      stats_values = results["stats"];

      data_rows.forEach(function(row) {
        data.push({
          sensor_id: row.sensor_id,
          x: [],
          y: [],
          mode: 'lines+markers',
          name: "<b>" + row.name + ": " + getCurrentValueForSensor(row.sensor_id, "value") + "°C</b> " +
            "@" + formatDate(getCurrentValueForSensor(row.sensor_id, "datetime")) + " " +
            generateGradientArrow(getStatValueForSensor(row.sensor_id, "regressionGradient")) + " " +
            "(avg: " + getStatValueForSensor(row.sensor_id, "avg") + ", " +
            "min: " + getStatValueForSensor(row.sensor_id, "min") + ", " +
            "max: " + getStatValueForSensor(row.sensor_id, "max") +
            ")",
          marker: {
            color: row.color,
            size: 4,
            line: {
              color: 'white',
              width: 1
            }
          }
        });
      });

      layout.yaxis.title = '°C';

      function pushRecordToData(row) {
        var d_string = row.datetime;
        var d = new Date(d_string);
        var v = parseFloat(row.value);

        var data_row = data.filter(function(r) {
          return r.sensor_id == row.sensor_id;
        });

        if (!data_row) {
          data_row = data[data.length - 1];
        } else {
          data_row = data_row[0];
        }

        if (data_row && data_row.x && data_row.y) {
          data_row.x.push(d);
          data_row.y.push(v);
        }
      }

      results["rows"].forEach(function(row) {
        pushRecordToData(row);
      });


      // draw graph:
      var tempDiv = document.getElementById('temperature_graph');

      var gd = Plotly.newPlot('temperature_graph', data, layout, {
        responsive: true,
        locale: 'de'
      });

      tempDiv.on('plotly_relayout', function(event) {
        if (event) {
          var from_ts = event["xaxis.range[0]"];
          if (!from_ts) {
            from_ts = minus24h.toISOString();
          }
          var until_ts = event["xaxis.range[1]"];
          loadTemperatures(from_ts, until_ts);
        }
      });

      loader.style.visibility = "hidden";
    });
  }
}






function loadHumidities(from_ts, until_ts) {
  var loader = document.getElementById('humidity_loader');
  loader.style.visibility = "visible";

  var params = buildParams(from_ts, until_ts);

  var data_rows = []

  // get config from API:
  var api_config_json = null;
  $.ajax({
    url: api_url + '/config',
    dataType: 'json',
    cache: false
  }).done(function(results_current) {
    api_config_json = results_current;
    if (api_config_json && api_config_json.sensors) {
      api_config_json.sensors.forEach(function(config_sensor) {
        if (config_sensor.type.indexOf("humidity") > -1) {
          data_rows.push(config_sensor);
        }
      });
    }
  });

  $.ajax({
    url: api_url + '/humidities/current?',
    dataType: 'json',
    cache: false
  }).done(function(results_current) {
    current_values = results_current["rows"];

    getAllData();
  });

  function getAllData() {
    $.ajax({
      url: api_url + '/humidities?' + params,
      dataType: 'json',
      cache: false
    }).done(function(results) {

      var data = []

      stats_values = results["stats"];


      data_rows.forEach(function(row) {
        data.push({
          sensor_id: row.sensor_id,
          x: [],
          y: [],
          mode: 'lines+markers',
          name: "<b>" + row.name + ": " + getCurrentValueForSensor(row.sensor_id, "value") + "%</b> " +
            "@" + formatDate(getCurrentValueForSensor(row.sensor_id, "datetime")) + " " +
            "(avg: " + getStatValueForSensor(row.sensor_id, "avg") + ", " +
            "min: " + getStatValueForSensor(row.sensor_id, "min") + ", " +
            "max: " + getStatValueForSensor(row.sensor_id, "max") +
            ")",
          marker: {
            color: row.color,
            size: 4,
            line: {
              color: 'white',
              width: 1
            }
          }
        });
      });

      layout.yaxis.title = '%';

      function pushRecordToData(row) {
        var d_string = row.datetime;
        var d = new Date(d_string);
        var v = parseFloat(row.value);

        var data_row = data.filter(function(r) {
          return r.sensor_id == row.sensor_id;
        });

        if (!data_row) {
          data_row = data[data.length - 1];
        } else {
          data_row = data_row[0];
        }

        if (data_row && data_row.x && data_row.y) {
          data_row.x.push(d);
          data_row.y.push(v);
        }
      }

      results["rows"].forEach(function(row) {
        pushRecordToData(row);
      });


      // draw graph:
      var humiDiv = document.getElementById('humidity_graph');

      var gd = Plotly.newPlot('humidity_graph', data, layout, {
        responsive: true,
        locale: 'de'
      });

      humiDiv.on('plotly_relayout', function(event) {
        if (event) {
          var from_ts = event["xaxis.range[0]"];
          if (!from_ts) {
            from_ts = minus24h.toISOString();
          }
          var until_ts = event["xaxis.range[1]"];
          loadHumidities(from_ts, until_ts);
        }
      });

      loader.style.visibility = "hidden";





      // Pie chart:
      if (config_json.show_humidity_pie_chart == "yes") {
        var humiPieChartData = [{
          values: [current_values[0].value, 100 - current_values[0].value],
          labels: [config_json.humidity_title],
          type: 'pie',
          textinfo: "label+percent",
          textposition: "outside",
          automargin: true,
          showlegend: false
        }];

        Plotly.newPlot('humidity_pie_graph', humiPieChartData, {
          height: 400,
          width: 400
        });
      }
    });
  }
}

loadConfig();

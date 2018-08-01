# sensorlog

Distributed tool which records and plots temperature values from multiple 1-wire sensor across the network or locally.

Additionally it comes with a nice web frontend showing the plotted data:

![alt text](https://raw.githubusercontent.com/myxor/sensorlog/master/graph.png "Graph with three different sensors")


## Components

It consists out of three parts:

### Logger (python3)

This script does the actual recording of the temperature values.
It will scan all 1wire slaves and extract the temperature (works fine with DS18B20 sensors).
It is able to log these values into a sqlite database or send them to the RESTful API.

### RESTful API (nodejs)

@todo

Built with https://github.com/expressjs/express

### Frontend (HTML + javascript)

@todo

Built with https://github.com/jquery/jquery/ and https://github.com/plotly/plotly.js/



## Get it running

1. checkout this repository
  `git clone https://github.com/myxor/sensorlog.git`
2. @todo
3. @todo

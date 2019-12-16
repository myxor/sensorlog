# sensorlog

Distributed tool which records and plots temperature and humidity values from multiple 1-wire and DHT22 sensors across the network or locally.

Additionally it comes with a basic web frontend showing the plotted data:

![alt text](https://raw.githubusercontent.com/myxor/sensorlog/master/res/graph.png "Graph with three different sensors")


## Components

It consists out of three parts:

### Logger (python3)

This script does the actual recording of the temperature and humidity values.
It will scan all 1wire slaves and extract the temperature from DS18B20 sensors (maybe other sensors will work as well).
It will look for DHT22 sensors as well and retrieve temperature and humitidy values from them.
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
2. copy folder *api* to the machine the RESTful API should be running on
3. @todo configure API  (rename example config first)
4. @todo install nodejs, ...
5. @todo run API 
5. copy folder *logger* to the machine(s) where the 1wire temperature sensors are connected to (for example your Raspberry Pi(s))
6. @todo configure logger (rename example config first)
7. @todo install python3 + modules...
9. @todo


## API as service

@todo systemd service file and starting

## Periodic logging of temperatures and humidities

You can run the logger on your clients by crontab:

The following example will log sensor values every 10 minutes:

```*/10 * * * * /usr/bin/python3 ~/sensorlog/logger/log.py restful```

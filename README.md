# sensorlog

Distributed tool which records and plots temperature values from multiple 1-wire sensor across the network or locally.

Additionally it comes with a nice web frontend showing the plotted data:

![alt text](https://raw.githubusercontent.com/myxor/sensorlog/master/res/graph.png "Graph with three different sensors")


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
2. copy folder *api* to the machine the RESTful API should be running on
3. @todo configure API
4. @todo install nodejs, ...
5. @todo run API for testing
5. copy folder *logger* to the machine(s) where the 1wire temperature sensors are connected to (for example your Raspberry Pi(s))
6. @todo configure logger
7. @todo install python3 + modules...
8. @todo copy folder *frontend*
9. @todo


## API as service

@todo service file and starting

## Periodic logging of temperatures

@todo run by crontab

# sensorlog

Distributed tool which records and plots temperature values from multiple 1-wire sensor across the network or locally.

It consists out of three parts:

## log.py (python3)

This script does the actual recording of the temperature values.
It will scan all 1wire slaves and extract the temperature (works fine with DS18B20 sensors).
It is able to log these values into a sqlite database or send them to the RESTful API.

## RESTful API (node-js)

@todo

Done with https://github.com/expressjs/express

## Frontend (HTML + javascript)

@todo

Done with https://jquery.com/ and https://plot.ly/

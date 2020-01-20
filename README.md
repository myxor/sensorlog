# sensorlog

I've created this project to support a network of temperature and humidity sensors in my home.

The architecture uses one 'master' server to aggregate and display the logged data, and many clients place around a house to send log data back to the 'master'.

## Graph with three temperature sensors and one humidity sensor

![alt text](https://raw.githubusercontent.com/myxor/sensorlog/master/res/graph.png "Graph with three temperature sensors and one humidity sensor")


## Components

It consists out of three parts:

### Logger (python3)

This script does the actual reading of the temperature and humidity values from the supported sensors.
It will scan all 1wire slaves and extract the temperature from DS18B20 sensors (maybe other sensors will work as well).
It will look for DHT22 sensors as well and retrieve temperature and humitidy values from them.
Depending on the configuration it is able to log these values directly into a sqlite database, send them to the included RESTful API or send them via MQTT.

When sending to the RESTful API is not possible (e.g. in case of no network connection or API down) the records will be cached locally in a sqlite database and sent when API is reachable again.

For accessing DHT22 sensors we are using [Adafruit_Python_DHT](https://github.com/adafruit/Adafruit_Python_DHT) and MQTT is done is with [Eclipse Paho](https://www.eclipse.org/paho/).

### RESTful API

Built with [nodejs](https://github.com/nodejs/node) and [expressjs](https://github.com/expressjs/express)

### Frontend (HTML + javascript)

Built with [jquery](https://github.com/jquery/jquery/) and [plotly.js](https://github.com/plotly/plotly.js/)



## Get it running 🍕

### On the server (where the RESTful API and frontend should be running)

1. checkout this repository
  `git clone https://github.com/myxor/sensorlog.git`
2. configure api (in the `api` folder):
    - copy `config.example.json` file to `config.json`
    - open the file and adjust the values in the sensors section to your wishes
    - you need the sensor_ids from your 1wire sensors
    - remove or add sensors here as you need
    - give them names :)
3. install node.js
4. run `npm install`
5. start api by running `node api.js`
6. configure frontend (in the `frontend` folder):
    - copy `config.example.json` file to `config.json`
    - open the file and type in the URL where your RESTful API is reachable
7. you need nginx, apache, lighttp or some other webserver to serve the frontend

### On the client (where the sensors are attached and the logger should be running)

1. configure logger (in the `logger` folder):
    - copy `config.example.ini` file to `config.ini`
    - open the file and replace the HOST and PORT values with the one from the machine your RESTful API is running on
2. Install python3.6+
3. Install python dependencies with `pip install -r requirements.txt`
    - (optional) if you want to use DHT22 sensors you need to install the Adafruit_Python_DHT module. See: [Adafruit_Python_DHT#install-with-pip](https://github.com/adafruit/Adafruit_Python_DHT#install-with-pip)
4. Run the logger by executing `python3 log.py sqlite` or `python3 log.py restful`


## Run the RESTful API as systemd service

If you want the RESTful API run as a systemd service you can do the following:

```sudo nano /etc/systemd/system/sensorlog-api.service```

then insert the following:

```
[Unit]
Description=Sensorlog RESTful API

[Service]
ExecStart=/usr/bin/node /home/$user/sensorlog/api/api.js
User=$user
TimeoutSec=30

[Install]
WantedBy=multi-user.target
```

replace $user with the username the service should run as.

After you saved the file you can enable and start the service with:

```
sudo systemctl daemon-reload

sudo systemctl enable sensorlog-api

sudo systemctl start sensorlog-api

```


## Periodic logging of temperatures and humidities

You can run the logger on your clients by crontab:

The following example will log sensor values every 10 minutes:

```*/10 * * * * /usr/bin/python3 ~/sensorlog/logger/log.py restful```


## Technology stack
* Python3 for the data logger
* Node for the RESTful API
* jQuery, CSS, HTML for the frontend
* SQLite for the database


# License

MIT


# Author

This project was created in 2018 by Marco Heiming

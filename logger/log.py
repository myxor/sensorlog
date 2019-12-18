#   log.py from sensorlog
#
#   @date 2018-06-09 17:30
#   @author Marco Heiming
#
#   https://github.com/myxor/sensorlog
#


import sqlite3
import subprocess
from datetime import datetime, timezone
import sys
import requests
import json
import os.path
import configparser
import importlib
# Look for DHT support
from importlib import util

config = configparser.ConfigParser()
config.read('config.ini')

db_path = ""
api_host = ""
api_port = ""

try:
    db_path = config['DB']['PATH']
    api_host = config['API']['HOST']
    api_port = config['API']['PORT']
except KeyError:
    print("Error: Needed path in config.ini not found.")
    exit()

if db_path == "":
    print("Error: DB.PATH not set in config.ini")
    exit()

if api_host == "":
    print("Error: API.HOST not set in config.ini")
    exit()
if api_port == "":
    print("Error: API.PORT not set in config.ini")
    exit()

if len(sys.argv) < 2:
    print("Usage: python3 log.py (sqlite|restful)")
    exit()

db_connection = sqlite3.connect(db_path)
db_handle = db_connection.cursor()


def create_db():
    global db_connection, db_handle
    db_handle.execute('''CREATE TABLE IF NOT EXISTS temperatures(datetime text, sensor_id text, value real)''')
    db_handle.execute('''CREATE TABLE IF NOT EXISTS humidities(datetime text, sensor_id text, value real)''')


log_type = sys.argv[1]  # "sqlite" or "restful"

if log_type == "sqlite":
    create_db()
elif log_type == "restful":
    url = "http://" + api_host + ":" + api_port + "/"
else:
    print("Usage: python3 log.py (sqlite|restful)")
    exit()


def get1wire():
    # get all w1 slaves:
    path_to_w1_master = '/sys/devices/w1_bus_master1/w1_master_slaves'
    if os.path.isfile(path_to_w1_master):
        file = open(path_to_w1_master)
        w1_slaves = file.readlines()
        file.close()

        # iterate over all found w1 slaves:
        for line in w1_slaves:
            w1_slave = line.split("\n")[0]
            path_to_w1_slave = '/sys/bus/w1/devices/' + str(w1_slave) + '/w1_slave'
            if os.path.isfile(path_to_w1_slave):
                file = open(path_to_w1_slave)
                content = file.read()
                file.close()

                splitvalue = content.split("\n")[1].split(" ")[9]
                temperature = float(splitvalue[2:]) / 1000

                print(str(w1_slave) + ': temperature=' + str(temperature))

                log_temperature(str(w1_slave), str(temperature))

    else:
        print("No 1wire support")


def send_to_rest(full_url, data_json, headers):
    print("Sending to " + full_url + "...")
    response = requests.post(full_url, data=data_json, headers=headers)
    print("HTTP response", response)


def log_temperature(sensor_id, temperature):
    print("log_temperature(" + sensor_id + ", " + str(temperature) + ")")
    now = datetime.now(timezone.utc)

    if log_type == "sqlite":
        # write into DB:
        t = ("'" + now.isoformat() + "'", "'" + str(sensor_id) + "'", str(temperature), )
        db_handle.execute("INSERT INTO temperatures VALUES (?,?,?)", t)
        print("saved to sqlite")

    if log_type == "restful":
        # send to RESTful API:
        data = {"datetime": now.isoformat(), "sensor_id": str(sensor_id), "value": str(temperature)}
        data_json = json.dumps(data)
        headers = {'Content-type': 'application/json'}
        full_url = url + "temperatures"
        send_to_rest(full_url, data_json, headers)


def log_humidity(sensor_id, humidity):
    print("log_humidity(" + sensor_id + ", " + humidity + ")")
    now = datetime.now(timezone.utc)

    if log_type == "sqlite":
        # write into DB:
        t = ("'" + now.isoformat() + "'", "'" + str(sensor_id) + "'", str(humidity),)
        db_handle.execute("INSERT INTO humidities VALUES (?,?,?)", t)
        print("saved to sqlite")

    if log_type == "restful":
        # send to RESTful API:
        data = {"datetime": now.isoformat(), "sensor_id": str(sensor_id), "value": str(humidity)}
        data_json = json.dumps(data)
        headers = {'Content-type': 'application/json'}
        full_url = url + "humidities"
        send_to_rest(full_url, data_json, headers)


def get_dht22_values():
    import Adafruit_DHT
    sensor = Adafruit_DHT.DHT22
    pin = 4
    humidity, temperature = Adafruit_DHT.read_retry(sensor, pin)
    sensor_id = "DHT" + str(sensor) + str(pin)
    print(sensor_id + ": humidity=" + str(humidity) + "%, temperature=" + str(temperature) + "°C")
    if humidity is not None:
        log_humidity(sensor_id, str(round(humidity, 3)))
    if temperature is not None:
        log_temperature(sensor_id, str(round(temperature, 3)))


get1wire()

dht = importlib.util.find_spec("Adafruit_DHT")
if dht is not None:
    get_dht22_values()
else:
    print("No DHT support")

# finalize:
if log_type == "sqlite":
    if db_connection:
        db_connection.commit()
        db_connection.close()



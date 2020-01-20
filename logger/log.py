#!/usr/bin/env python
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
from importlib import util

if len(sys.argv) < 2:
    print("Usage: python3 log.py (sqlite|restful|mqtt)")
    exit()

log_type = sys.argv[1]  # "sqlite", "restful" or "mqtt"

config = configparser.ConfigParser()
config.read('config.ini')

db_path = ""
api_host = ""
api_port = ""
mqtt_host = ""
mqtt_port = ""
mqtt_topic = ""

try:
    db_path = config['DB']['PATH']
    api_host = config['API']['HOST']
    api_port = int(config['API']['PORT'])
    mqtt_host = config['MQTT']['HOST']
    mqtt_port = int(config['MQTT']['PORT'])
    mqtt_topic = config['MQTT']['TOPIC']
except KeyError:
    print("Error: Required field in config.ini missing.")
    exit()




def create_db_tables():
    global db_connection, db_handle
    db_handle.execute('''CREATE TABLE IF NOT EXISTS temperatures(datetime text, sensor_id text, value real)''')
    db_handle.execute('''CREATE TABLE IF NOT EXISTS humidities(datetime text, sensor_id text, value real)''')

db_connection = sqlite3.connect(db_path)
db_handle = db_connection.cursor()
create_db_tables()

if log_type == "sqlite":
    if db_path == "":
        print("Error: DB.PATH not set in config.ini")
        exit()
elif log_type == "restful":
    if api_host == "":
        print("Error: API.HOST not set in config.ini")
        exit()
    if api_port == "":
        print("Error: API.PORT not set in config.ini")
        exit()
    url = "http://" + api_host + ":" + api_port + "/"
elif log_type == "mqtt":
    if mqtt_host == "":
        print("Error: MQTT.HOST not set in config.ini")
        exit()
    if mqtt_port == "":
        print("Error: MQTT.PORT not set in config.ini")
        exit()
    if mqtt_topic == "":
        print("Error: MQTT.TOPIC not set in config.ini")
        exit()
    import paho.mqtt.client as mqtt

    def on_connect(client, userdata, flags, rc):
        print("Connected with result code " + str(rc))

    mqtt_client = mqtt.Client()
    mqtt_client.on_connect = on_connect
    mqtt_client.connect(mqtt_host, mqtt_port, 60)
else:
    print("Usage: python3 log.py (sqlite|restful|mqtt)")
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


def insert_record_into_db(table, values):
    try:
        db_handle.execute("INSERT INTO " + table + " (datetime, sensor_id, value) VALUES (?,?,?)", values)
        db_connection.commit()
        print("Inserted into sqlite table '%s' with rowid=%d" % (table, db_handle.lastrowid))
    except Exception as e:
        print(e)


def select_records_from_db(table):
    db_handle.execute("SELECT * FROM " + table + " ORDER BY datetime ASC LIMIT 10")
    r = db_handle.fetchall()
    print("Selected %d records from table '%s'" % (len(r), table))
    return r


def delete_record_from_db(table, values):
    try:
        e = db_handle.execute("DELETE FROM " + table + " WHERE datetime=? AND sensor_id=? AND value=?", values)
        db_connection.commit()
        print("Deleted %d records from table '%s' " % (e.rowcount, table))
    except Exception as e:
        print(e)


def send_to_rest(path, t):
    try:
        full_url = url + "" + path
        print("Sending to " + full_url + "...")

        data = {"datetime": t[0], "sensor_id": t[1], "value": t[2]}
        data_json = json.dumps(data)

        headers = {'Content-type': 'application/json'}

        response = requests.post(full_url, data=data_json, headers=headers, timeout=10)
        print("HTTP response", response)

        # look for cached entries which we can deliver now:
        records = select_records_from_db(path)
        if records is not None and len(records) > 0:
            for r in records:
                data = {"datetime": r[0], "sensor_id": r[1], "value": r[2]}
                data_json = json.dumps(data)
                print("Sending to " + full_url + "...")
                response = requests.post(full_url, data=data_json, headers=headers, timeout=10)
                print("HTTP response", response)
                if response.status_code == requests.codes.ok:
                    delete_record_from_db(path, r)

        return True
    except requests.exceptions.RequestException as e:
        insert_record_into_db(path, t)
        print(e)
        return False


def send_via_mqtt(path, t):
    full_topic = mqtt_topic + "/" + path + "/" + t[1]
    mqtt_client.publish(full_topic, t[2])


def log_value(table, t):
    if log_type == "sqlite":
        # write into DB:
        insert_record_into_db(table, t)
    elif log_type == "restful":
        # send to REST API:
        send_to_rest(table, t)
    elif log_type == "mqtt":
        # send viq MQTT:
        send_via_mqtt(table, t)


def log_temperature(sensor_id, temperature):
    print("log_temperature(" + sensor_id + ", " + str(temperature) + ")")
    now = datetime.now(timezone.utc)
    t = (now.isoformat(), str(sensor_id), str(temperature))
    log_value("temperatures", t)


def log_humidity(sensor_id, humidity):
    print("log_humidity(" + sensor_id + ", " + humidity + ")")
    now = datetime.now(timezone.utc)
    t = (now.isoformat(), str(sensor_id), str(humidity),)
    log_value("humidities", t)


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
elif log_type == "mqtt":
    mqtt_client.disconnect()

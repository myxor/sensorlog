#   log.py from sensorlog
#
#   @date 2018-06-09 17:30
#   @author Marco Heiming
#


import sqlite3
import subprocess
from datetime import datetime, timezone
import sys
import requests
import json
import os.path
import configparser


config = configparser.ConfigParser()
config.read('config.ini')

try:
    db_path = config['DB']['PATH']
    api_host = config['API']['HOST']
    api_port = config['API']['PORT']
except KeyError:
    print("Error: Needed path in config.ini not found.")
    exit()

if (db_path == ""):
    print("Error: DB.PATH not set in config.ini")
    exit()

if (api_host == ""):
    print("Error: API.HOST not set in config.ini")
    exit()
if (api_port == ""):
    print("Error: API.PORT not set in config.ini")
    exit()


type = sys.argv[1] # "sqlite" or "restful"

if type == "sqlite":
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS temperatures(datetime text, sensor_id text, value real)''')
elif type == "restful":
    url = "http://" + api_host + ":" +  api_port + "/temperatures"
else:
    print("Usage: python3 log.py (sqlite|restful)")
    exit()



# get all w1 slaves:
path_to_w1_master = '/sys/devices/w1_bus_master1/w1_master_slaves'
if os.path.isfile(path_to_w1_master):
    file = open(path_to_w1_master)
    w1_slaves = file.readlines()
    file.close()

	# iterate over all found slaves:
    for line in w1_slaves:
        w1_slave = line.split("\n")[0]
        path_to_w1_slave = '/sys/bus/w1/devices/' + str(w1_slave) + '/w1_slave'
        if os.path.isfile(path_to_w1_slave):
            file = open(path_to_w1_slave)
            filecontent = file.read()
            file.close()

            stringvalue = filecontent.split("\n")[1].split(" ")[9]
            temperature = float(stringvalue[2:]) / 1000

            print(str(w1_slave) + ': ' + str(temperature))

            # do not log values > 70 °C:
            if temperature <= 70:
                now = datetime.now(timezone.utc)

				
                if type == "sqlite":
					# write into db
                    c.execute("INSERT INTO temperatures VALUES ('" +  now.isoformat() + "','" + str(w1_slave) + "', " + str(temperature) + ")")
                    print("saved to sqlite")

                if type == "restful":
					# send to RESTful API:
                    data = {"datetime" : now.isoformat(), "sensor_id" :  str(w1_slave), "value" : str(temperature)}
                    data_json = json.dumps(data)
                    headers = {'Content-type': 'application/json'}
                    response = requests.post(url, data=data_json, headers=headers)
                    print("http response", response)


if type == "sqlite":
    conn.commit()
    conn.close()

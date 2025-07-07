import os
import time
import json
import paho.mqtt.client as mqtt
from pymongo import MongoClient

# Configura credenciais
mqtt_host = os.getenv("MQTT_HOST", "localhost")
mqtt_user = os.getenv("MQTT_USER", "bipes")
mqtt_pass = os.getenv("MQTT_PASS", "senha")

print("🚀 Starting Subscriber...")

# === MongoDB ===
# mongo_uri = os.getenv("MONGO_URI")
# if not mongo_uri:
#     print("❌ MONGO_URI not set")
#     exit(1)

mongo_uri = "mongodb+srv://ti:HjrjfpzWT4cdDJqc@bipes-db.wlo1lu9.mongodb.net/?retryWrites=true&w=majority&appName=bipes-db"
mongo_client = MongoClient(mongo_uri)
print("✅ Connected to MongoDB")

# Cria o cliente MQTT (versão atualizada para resolver o warning)
mqtt_client = mqtt.Client(callback_api_version=mqtt.CallbackAPIVersion.VERSION2)
print("MQTT client created")  # Debug

def mqtt_on_connect(client, userdata, flags, rc, properties=None):
    print("MQTT on_connect, rc =", rc)  # Debug
    if rc == 0:
        print("Successfully connected to MQTT broker")
        client.subscribe("#")
        print("Subscribed to all topics (#)")
    else:
        print(f"Failed to connect to MQTT broker, return code {rc}")

def mqtt_on_message(client, userdata, msg):
    try:
        print(f"MQTT on_message: {msg.topic} -> {msg.payload}")
        
        # Valida o tópico
        full_topic = msg.topic.split("/", 1)
        if len(full_topic) < 2:
            print("Invalid Topic - must be in format: session/topic")
            return

        session = full_topic[0]
        topic = full_topic[1]
        
        # Decodifica a mensagem
        try:
            data = msg.payload.decode('utf-8')
        except UnicodeDecodeError:
            print("Failed to decode message payload")
            return
        
        # Tenta parsear como JSON se possível
        try:
            parsed_data = json.loads(data)
            print(f"Parsed JSON data: {parsed_data}")
        except json.JSONDecodeError:
            parsed_data = data
            print(f"Plain text data: {data}")
        
        # Insere no MongoDB
        database = mongo_client[session]
        collection = database[topic]
        
        document = {
            "data": parsed_data,
            "raw_payload": data,
            "timestamp": int(time.time()),
            "topic": msg.topic
        }
        
        result = collection.insert_one(document)
        print(f"✅ Inserted into MongoDB - Session: {session}, Topic: {topic}, ID: {result.inserted_id}")
        
    except Exception as e:
        print(f"❌ Error processing message: {e}")

def mqtt_on_disconnect(client, userdata, rc, properties=None):
    print(f"MQTT disconnected with result code {rc}")

def mqtt_on_subscribe(client, userdata, mid, granted_qos, properties=None):
    print(f"Subscribed successfully with QoS {granted_qos}")

# Associa callbacks
mqtt_client.on_connect = mqtt_on_connect
mqtt_client.on_message = mqtt_on_message
mqtt_client.on_disconnect = mqtt_on_disconnect
mqtt_client.on_subscribe = mqtt_on_subscribe

mqtt_client.username_pw_set(mqtt_user, password=mqtt_pass)
print("Callbacks set, will attempt connect")  # Debug

# Loop de retry para aguardar o broker subir
retry_count = 0
max_retries = 30  # Máximo 1 minuto tentando

while retry_count < max_retries:
    try:
        print(f"Attempting to connect to mqtt:1883 (attempt {retry_count + 1}/{max_retries})")
        mqtt_client.connect(mqtt_host, 1883, 60)
        print("Connected to MQTT broker")
        break
    except Exception as e:
        retry_count += 1
        print(f"Broker not available, retrying in 2s... Error: {e}")
        time.sleep(2)

if retry_count >= max_retries:
    print("❌ Failed to connect to MQTT broker after maximum retries")
    exit(1)

print("✅ Entering loop_forever() - Subscriber is ready!")
mqtt_client.loop_forever()
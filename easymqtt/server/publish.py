import paho.mqtt.client as mqtt
import sys

if len(sys.argv) != 3:
    print("Usage: publish.py topic value")
    sys.exit(1)

# Cria cliente MQTT
mqtt_client = mqtt.Client()

# Autenticação (se você estiver usando usuário/senha)
mqtt_client.username_pw_set("bipes", password="m8YLUr5uW3T")

# Conecta ao broker dentro da rede Docker Compose
mqtt_client.connect("mqtt", 1883, 60)

# Publica e fecha
mqtt_client.publish(sys.argv[1], sys.argv[2])
mqtt_client.disconnect()
sys.exit(0)

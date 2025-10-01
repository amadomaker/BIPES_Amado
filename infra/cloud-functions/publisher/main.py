import os
import json
import time
from typing import Any

from flask import Request, make_response
import paho.mqtt.client as mqtt


def _cors(headers: dict[str, str] | None = None):
    base = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }
    if headers:
        base.update(headers)
    return base


def publish_http(request: Request):
    # Preflight CORS
    if request.method == "OPTIONS":
        resp = make_response("", 204)
        for k, v in _cors().items():
            resp.headers[k] = v
        return resp

    # Params
    session = request.args.get("session")
    topic = request.args.get("topic")
    value = request.args.get("value")

    if not session or not topic or value is None:
        body = {"success": False, "result": "Invalid Parameters"}
        resp = make_response(json.dumps(body), 400)
        for k, v in _cors().items():
            resp.headers[k] = v
        resp.headers["Content-Type"] = "application/json"
        return resp

    # Optional: enforce numeric value to keep parity with PHP
    try:
        float(value)
    except Exception:
        body = {
            "success": False,
            "result": f"Error publishing value '{value}' to topic '{topic}'. Non-numeric input value!",
        }
        resp = make_response(json.dumps(body), 400)
        for k, v in _cors().items():
            resp.headers[k] = v
        resp.headers["Content-Type"] = "application/json"
        return resp

    mqtt_host = os.getenv("MQTT_HOST")
    mqtt_port = int(os.getenv("MQTT_PORT", "1883"))
    mqtt_user = os.getenv("MQTT_USER")
    mqtt_pass = os.getenv("MQTT_PASS")

    if not mqtt_host or not mqtt_user or not mqtt_pass:
        body = {"success": False, "result": "MQTT env vars not configured"}
        resp = make_response(json.dumps(body), 500)
        for k, v in _cors().items():
            resp.headers[k] = v
        resp.headers["Content-Type"] = "application/json"
        return resp

    # Build topic
    full_topic = f"{session}/{topic}"

    # Publish
    try:
        client = mqtt.Client()
        client.username_pw_set(mqtt_user, password=mqtt_pass)
        client.connect(mqtt_host, mqtt_port, 60)
        client.publish(full_topic, str(value))
        client.disconnect()
        body = {"success": True, "result": f"Value '{value}' published to topic '{topic}' successfully!"}
        status = 200
    except Exception as e:
        body = {"success": False, "result": f"Error publishing: {e}"}
        status = 500

    resp = make_response(json.dumps(body), status)
    for k, v in _cors().items():
        resp.headers[k] = v
    resp.headers["Content-Type"] = "application/json"
    return resp

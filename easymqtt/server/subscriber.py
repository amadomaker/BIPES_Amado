import os
import json
import time
import base64
from flask import Flask, request, jsonify
from pymongo import MongoClient

app = Flask(__name__)

_mongo = MongoClient(os.environ["MONGO_URI"])


@app.route("/", methods=["POST"])
def receive_message():
    envelope = request.get_json(silent=True)
    if not envelope or "message" not in envelope:
        return jsonify({"error": "invalid pubsub envelope"}), 400

    msg = envelope["message"]
    attrs = msg.get("attributes", {})
    session = attrs.get("session")
    topic = attrs.get("topic")

    if not session or not topic:
        return jsonify({"error": "missing session or topic attributes"}), 400

    try:
        raw = base64.b64decode(msg["data"]).decode("utf-8")
    except Exception:
        return jsonify({"error": "failed to decode message data"}), 400

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        data = raw

    _mongo[session][topic].insert_one({
        "data": data,
        "raw_payload": raw,
        "timestamp": int(time.time()),
        "topic": f"{session}/{topic}",
    })

    return ("", 204)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))

import os
import json
from flask import Request, make_response
from google.cloud import pubsub_v1


def _cors(extra=None):
    h = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }
    if extra:
        h.update(extra)
    return h


def _json_response(body: dict, status: int):
    resp = make_response(json.dumps(body), status)
    for k, v in _cors({"Content-Type": "application/json"}).items():
        resp.headers[k] = v
    return resp


def publish_http(request: Request):
    if request.method == "OPTIONS":
        resp = make_response("", 204)
        for k, v in _cors().items():
            resp.headers[k] = v
        return resp

    session = request.args.get("session")
    topic = request.args.get("topic")
    value = request.args.get("value")

    if not session or not topic or value is None:
        return _json_response({"success": False, "result": "Invalid Parameters"}, 400)

    try:
        float(value)
    except ValueError:
        return _json_response(
            {"success": False, "result": f"Non-numeric value: '{value}'"}, 400
        )

    project_id = os.environ["PROJECT_ID"]
    topic_id = os.environ["PUBSUB_TOPIC"]

    client = pubsub_v1.PublisherClient()
    topic_path = client.topic_path(project_id, topic_id)

    future = client.publish(
        topic_path,
        data=value.encode("utf-8"),
        session=session,
        mqtt_topic=topic,  # "topic" conflita com o 1º parâmetro posicional do SDK
    )
    try:
        future.result()
    except Exception as e:
        return _json_response({"success": False, "result": f"Pub/Sub publish error: {e}"}, 500)

    return _json_response(
        {"success": True, "result": f"Value '{value}' published to topic '{topic}' successfully!"},
        200,
    )

FROM python:3.10-slim

WORKDIR /app

COPY easymqtt/server/publish.py /app/

RUN pip install --no-cache-dir paho-mqtt

CMD ["python3", "publish.py"]

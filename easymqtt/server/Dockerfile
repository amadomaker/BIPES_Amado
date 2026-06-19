FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt subscriber.py ./

RUN pip install --no-cache-dir -r requirements.txt

ENV PORT=8080
EXPOSE 8080

CMD ["python3", "subscriber.py"]

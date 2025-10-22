FROM python:3.10-slim

WORKDIR /app

# Copia apenas o subscriber.py e as eventuais dependências
COPY subscriber.py /app/

# Instala as bibliotecas Python necessárias
RUN pip install --no-cache-dir pymongo paho-mqtt \
    && pip install pymongo dnspython 

# Executa o subscriber
CMD ["python3", "subscriber.py"]



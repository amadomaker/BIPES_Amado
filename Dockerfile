FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y apache2 libapache2-mod-php php php-mongodb php-curl && \
    a2enmod rewrite && \
    rm -rf /var/lib/apt/lists/*

COPY . /var/www/html/

# Vhost HTTP: sem SSL (Cloud Run termina TLS), passa PUBLISHER_URL ao PHP
RUN printf '<VirtualHost *:8080>\n\
    DocumentRoot /var/www/html\n\
    PassEnv PUBLISHER_URL\n\
    <Directory /var/www/html>\n\
        AllowOverride All\n\
        Require all granted\n\
    </Directory>\n\
    ErrorLog /dev/stderr\n\
    CustomLog /dev/stdout combined\n\
</VirtualHost>\n' > /etc/apache2/sites-available/000-default.conf && \
    a2dissite default-ssl 2>/dev/null || true

EXPOSE 8080

# Lê $PORT injetado pelo Cloud Run (padrão 8080) e inicia Apache
CMD bash -c 'echo "Listen ${PORT:-8080}" > /etc/apache2/ports.conf && \
    sed -i "s/*:8080/*:${PORT:-8080}/" /etc/apache2/sites-available/000-default.conf && \
    exec apache2ctl -D FOREGROUND'

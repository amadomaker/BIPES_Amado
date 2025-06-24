FROM php:8.1-apache

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libssl-dev \
      libcurl4-openssl-dev \
      libpcre3-dev \
      python3 \
      python3-pip \
 && pip3 install --break-system-packages paho-mqtt \
 && pecl install mongodb \
 && docker-php-ext-enable mongodb \
 && rm -rf /var/lib/apt/lists/*

# Configura Apache para priorizar index.html antes de index.php
RUN a2enmod dir && \
    sed -i 's/DirectoryIndex .*/DirectoryIndex index.html index.php/' \
           /etc/apache2/mods-enabled/dir.conf

COPY . /var/www/html/

RUN chown -R www-data:www-data /var/www/html

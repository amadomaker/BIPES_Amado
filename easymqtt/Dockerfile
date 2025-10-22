FROM php:8.1-apache

# Dependências para compilar/extensões: usar PHPIZE_DEPS oficial
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        $PHPIZE_DEPS \
        libssl-dev \
        libcurl4-openssl-dev \
    ; \
    pecl install mongodb; \
    docker-php-ext-install curl; \
    docker-php-ext-enable mongodb curl; \
    apt-get purge -y --auto-remove $PHPIZE_DEPS; \
    rm -rf /var/lib/apt/lists/*

# Configura Apache para priorizar index.html antes de index.php
RUN a2enmod dir && \
    sed -i 's/DirectoryIndex .*/DirectoryIndex index.html index.php/' \
           /etc/apache2/mods-enabled/dir.conf

RUN sed -i 's/Listen 80/Listen 8080/' /etc/apache2/ports.conf && \
    sed -i 's/:80>/:8080>/g' /etc/apache2/sites-enabled/000-default.conf

COPY . /var/www/html/

RUN chown -R www-data:www-data /var/www/html

EXPOSE 8080

CMD ["apache2-foreground"]

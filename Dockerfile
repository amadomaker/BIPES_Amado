# Usa a imagem oficial do Apache como base
# FROM httpd:latest

# # Define o diretório de trabalho dentro do contêiner
# WORKDIR /usr/local/apache2/htdocs/

# # Copia os arquivos estáticos para o servidor Apache
# COPY . /usr/local/apache2/htdocs/

# # Expõe a porta 80
# EXPOSE 80

# # Inicia o Apache no modo foreground
# CMD ["httpd", "-D", "FOREGROUND"]




FROM debian:bullseye

# Instala Apache, OpenSSL e utilitários necessários
RUN apt-get update && \
    apt-get install -y apache2 openssl && \
    a2enmod ssl && \
    mkdir -p /etc/apache2/ssl

# Gera certificado autoassinado
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/apache2/ssl/selfsigned.key \
    -out /etc/apache2/ssl/selfsigned.crt \
    -subj "/C=BR/ST=SP/L=SaoPaulo/O=MinhaEmpresa/CN=localhost"

# Copia arquivos do site
COPY . /var/www/html/

# Copia conf customizada com HTTPS
COPY apache-ssl.conf /etc/apache2/sites-available/default-ssl.conf

# Ativa o site com SSL e configurações
RUN a2ensite default-ssl.conf

# Garante que o Apache rode em foreground
CMD ["apachectl", "-D", "FOREGROUND"]

EXPOSE 80 443

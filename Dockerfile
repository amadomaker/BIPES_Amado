# Usa a imagem oficial do Apache como base
FROM httpd:latest

# Define o diretório de trabalho dentro do contêiner
WORKDIR /usr/local/apache2/htdocs/

# Copia os arquivos estáticos para o servidor Apache
COPY . /usr/local/apache2/htdocs/

# Modifica a configuração do Apache para escutar na porta 8080 (necessário para o Cloud Run)
RUN sed -i 's/Listen 80/Listen 8080/' /usr/local/apache2/conf/httpd.conf \
    && echo "ServerName localhost" >> /usr/local/apache2/conf/httpd.conf

# Expõe a porta 8080
EXPOSE 8080

# Inicia o Apache no modo foreground
CMD ["httpd", "-D", "FOREGROUND"]

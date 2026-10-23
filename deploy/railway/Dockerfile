# LFAR preview site on Railway: WordPress + the lfar theme + Fluent Forms,
# seeded from the Local site's database snapshot (db.sql).
# Built from the folder that deploy-preview.ps1 assembles; not from the repo directly.
FROM php:8.2-apache

ARG WP_VERSION=7.1.3
ARG FLUENTFORM_VERSION=6.2.16

# PHP extensions WordPress uses
RUN curl -fsSL -o /usr/local/bin/install-php-extensions \
      https://github.com/mlocati/docker-php-extension-installer/releases/latest/download/install-php-extensions \
 && chmod +x /usr/local/bin/install-php-extensions \
 && install-php-extensions mysqli gd zip exif intl bcmath opcache imagick

# Apache: pretty permalinks (.htaccess) and the usual modules
RUN a2enmod rewrite headers expires \
 && sed -ri '/<Directory \/var\/www\/>/,/<\/Directory>/ s/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf

RUN { \
      echo 'memory_limit = 256M'; \
      echo 'upload_max_filesize = 64M'; \
      echo 'post_max_size = 64M'; \
      echo 'max_execution_time = 120'; \
    } > /usr/local/etc/php/conf.d/wordpress.ini

# WP-CLI
RUN curl -fsSL -o /usr/local/bin/wp https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar \
 && chmod +x /usr/local/bin/wp

# WordPress core (same version as the Local site) and Fluent Forms (same version)
WORKDIR /var/www/html
RUN wp core download --version="${WP_VERSION}" --skip-content --path=/var/www/html --allow-root \
 && mkdir -p wp-content/plugins wp-content/themes wp-content/uploads \
 && curl -fsSL -o /tmp/fluentform.zip "https://downloads.wordpress.org/plugin/fluentform.${FLUENTFORM_VERSION}.zip" \
 && php -r '$z = new ZipArchive; $z->open("/tmp/fluentform.zip") === true || exit(1); $z->extractTo("wp-content/plugins"); $z->close();' \
 && rm /tmp/fluentform.zip

# Site files
COPY wp-config.php /var/www/html/wp-config.php
COPY htaccess /var/www/html/.htaccess
COPY theme/ /var/www/html/wp-content/themes/lfar/
COPY uploads/ /var/www/html/wp-content/uploads/
COPY db.sql import-db.php /usr/local/lib/lfar/
COPY docker-entrypoint.sh /usr/local/bin/lfar-entrypoint
RUN sed -i 's/\r$//' /usr/local/bin/lfar-entrypoint \
 && chmod +x /usr/local/bin/lfar-entrypoint \
 && chown -R www-data:www-data /var/www/html

ENTRYPOINT ["lfar-entrypoint"]
CMD ["apache2-foreground"]

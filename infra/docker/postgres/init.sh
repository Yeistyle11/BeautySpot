#!/bin/bash
# Inicialización de las bases de datos de BeautySpot: una por microservicio.
#
# Cada servicio recibe un usuario que es OWNER solo de su base y sin SUPERUSER,
# y se revoca el CONNECT a PUBLIC, de modo que un servicio comprometido no
# alcanza los datos de los otros seis ni puede administrar el clúster.
#
# Es un .sh y no un .sql porque el entrypoint de la imagen de Postgres no
# sustituye variables en los .sql: así las contraseñas vienen del entorno en
# lugar de estar escritas en el repositorio.
set -euo pipefail

servicios="auth core booking payment notification marketplace analytics"

for servicio in $servicios; do
  base="beautyspot_${servicio}"
  usuario="beautyspot_${servicio}"

  # Contraseña por servicio: BEAUTYSPOT_AUTH_PASSWORD, BEAUTYSPOT_CORE_PASSWORD…
  # El valor por defecto es el nombre del usuario, y sirve SOLO para desarrollo
  # local: en producción hay que pasar las siete por el entorno.
  variable="BEAUTYSPOT_$(echo "$servicio" | tr '[:lower:]' '[:upper:]')_PASSWORD"
  clave="${!variable:-$usuario}"

  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
    -v usuario="$usuario" -v base="$base" -v clave="$clave" <<-'SQL'
		CREATE USER :"usuario" WITH PASSWORD :'clave';
		CREATE DATABASE :"base" OWNER :"usuario";
		-- Sin esto, cualquier rol del clúster podría conectarse a la base.
		REVOKE CONNECT ON DATABASE :"base" FROM PUBLIC;
		GRANT CONNECT ON DATABASE :"base" TO :"usuario";
	SQL

  echo "Base $base creada, propiedad de $usuario"
done

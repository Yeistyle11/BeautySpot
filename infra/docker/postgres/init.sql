-- Inicialización de bases de datos por servicio
-- Cada microservicio tiene su propia base de datos PostgreSQL

CREATE DATABASE beautyspot_auth;
CREATE DATABASE beautyspot_core;
CREATE DATABASE beautyspot_booking;
CREATE DATABASE beautyspot_payment;
CREATE DATABASE beautyspot_notification;
CREATE DATABASE beautyspot_marketplace;
CREATE DATABASE beautyspot_analytics;

-- Base de datos para SonarQube
CREATE DATABASE sonar;

-- Crear usuario para SonarQube
CREATE USER sonar WITH PASSWORD 'sonar123';
GRANT ALL PRIVILEGES ON DATABASE sonar TO sonar;
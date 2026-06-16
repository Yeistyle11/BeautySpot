-- Inicialización de bases de datos por servicio para Tests
-- Cada microservicio tiene su propia base de datos PostgreSQL de pruebas

CREATE DATABASE beautyspot_auth_test;
CREATE DATABASE beautyspot_core_test;
CREATE DATABASE beautyspot_booking_test;
CREATE DATABASE beautyspot_payment_test;
CREATE DATABASE beautyspot_notification_test;
CREATE DATABASE beautyspot_marketplace_test;
CREATE DATABASE beautyspot_analytics_test;

-- Crear usuario de tests si es necesario (opcional)
-- CREATE USER beautyspot_test WITH PASSWORD 'test123';
-- GRANT ALL PRIVILEGES ON DATABASE beautyspot_*_test TO beautyspot_test;
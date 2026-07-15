const { Pool } = require('pg');

async function setupDemoData() {
  const pool = new Pool({
    host: 'localhost',
    port: 5433,
    user: 'postgres',
    password: 'postgres',
    database: 'beautyspot_core',
  });

  try {
    console.log('🚀 Configurando datos de demo...');

    // Crear negocio de demo
    const businessResult = await pool.query(`
      INSERT INTO businesses (id, name, slug, description, business_type, phone, email, address, city, state, country, lat, lng, active)
      VALUES (
        gen_random_uuid(),
        'Demo Centro de Belleza',
        'demo-belleza',
        'Professionalía de demo para pruebas',
        'BARBERIA',
        '+57 300 123 4567',
        'demo@professionalia.com',
        'Calle 123 #45-67',
        'Bogotá',
        'Cundinamarca',
        'Colombia',
        4.71,
        -74.07,
        true
      )
      ON CONFLICT (slug) DO NOTHING
      RETURNING id
    `);

    const businessId = businessResult.rows[0]?.id;

    if (!businessId) {
      console.log('ℹ️ El negocio de demo ya existe');
      const existingBusiness = await pool.query('SELECT id FROM businesses WHERE slug = $1', ['demo-belleza']);
      return existingBusiness.rows[0].id;
    }

    console.log('✅ Negocio de demo creado:', businessId);

    // Crear sucursal
    const branchResult = await pool.query(`
      INSERT INTO branches (id, business_id, name, address, city, phone, email, active, lat, lng)
      VALUES (
        gen_random_uuid(),
        $1,
        'Sucursal Principal',
        'Calle 123 #45-67',
        'Bogotá',
        '+57 300 123 4567',
        'demo@professionalia.com',
        true,
        4.71,
        -74.07
      )
      RETURNING id
    `, [businessId]);

    const branchId = branchResult.rows[0].id;
    console.log('✅ Sucursal creada:', branchId);

    // Crear servicios
    const servicesData = [
      { name: 'Corte Clásico', duration: 30, price: 25000 },
      { name: 'Corte Premium', duration: 45, price: 45000 },
      { name: 'Afeitado', duration: 20, price: 15000 },
      { name: 'Barba', duration: 15, price: 12000 },
      { name: 'Corte + Barba', duration: 45, price: 35000 },
    ];

    for (const service of servicesData) {
      await pool.query(`
        INSERT INTO services (id, business_id, name, description, duration, price, active)
        VALUES (
          gen_random_uuid(),
          $1,
          $2,
          $3,
          $4,
          $5,
          true
        )
      `, [businessId, service.name, 'Servicio de alta calidad', service.duration, service.price]);
    }

    console.log('✅ Servicios creados');

    // Crear profesionales
    const professionalsData = [
      { name: 'Carlos Rodríguez', email: 'carlos@demo.com' },
      { name: 'María García', email: 'maria@demo.com' },
      { name: 'Juan Pérez', email: 'juan@demo.com' },
    ];

    const professionalIds = [];

    for (const prof of professionalsData) {
      const profResult = await pool.query(`
        INSERT INTO professionals (id, business_id, name, email, phone, avatar, specialties, active)
        VALUES (
          gen_random_uuid(),
          $1,
          $2,
          $3,
          $4,
          null,
          ARRAY['CABALLEROS'],
          true
        )
        RETURNING id
      `, [businessId, prof.name, prof.email, '+57 300 000 0000']);
      professionalIds.push(profResult.rows[0].id);
    }

    console.log('✅ Profesionales creados');

    // Crear disponibilidad para profesionales
    const daysOfWeek = [1, 2, 3, 4, 5, 6]; // Lunes a Sábado
    for (const profId of professionalIds) {
      for (const day of daysOfWeek) {
        await pool.query(`
          INSERT INTO availabilities (id, business_id, professional_id, day_of_week, start_time, end_time, active)
          VALUES (
            gen_random_uuid(),
            $1,
            $2,
            $3,
            '09:00',
            '19:00',
            true
          )
        `, [businessId, profId, day]);
      }
    }

    console.log('✅ Disponibilidad creada');

    return businessId;
  } catch (error) {
    console.error('❌ Error configurando demo:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

async function createUserMembership(businessId) {
  const pool = new Pool({
    host: 'localhost',
    port: 5433,
    user: 'postgres',
    password: 'postgres',
    database: 'beautyspot_auth',
  });

  try {
    const userId = '11aa37c3-3170-414a-af69-45936debaf1b'; // ID del usuario demo@beautyspot.co

    const result = await pool.query(`
      INSERT INTO memberships (id, user_id, business_id, role, active, joined_at)
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        'OWNER',
        true,
        NOW()
      )
      ON CONFLICT (user_id, business_id) DO NOTHING
    `, [userId, businessId]);

    console.log('✅ Membership creada');
  } catch (error) {
    console.error('❌ Error creando membership:', error);
  } finally {
    await pool.end();
  }
}

async function main() {
  try {
    const businessId = await setupDemoData();
    await createUserMembership(businessId);
    console.log('🎉 Datos de demo configurados exitosamente!');
    console.log('📧 Email de demo: demo@beautyspot.co');
    console.log('🔑 Password: Demo123!');
  } catch (error) {
    console.error('❌ Error en setup:', error);
    process.exit(1);
  }
}

main();
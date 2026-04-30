import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query, pool } from './config/database';

async function seed() {
  console.log('Starting database seed...');

  try {
    // Check if super admin exists
    const existingAdmin = await query(
      "SELECT id FROM users WHERE email = 'super-admin@mentalcare.com'"
    );

    if (existingAdmin.rows.length > 0) {
      console.log('Super admin already exists, skipping seed.');
      await pool.end();
      return;
    }

    // Create super admin
    const superAdminId = uuidv4();
    const hashedPassword = await bcrypt.hash('admin123', 10);

    await query(
      'INSERT INTO users (id, email, password_hash, created_at) VALUES ($1, $2, $3, NOW())',
      [superAdminId, 'super-admin@mentalcare.com', hashedPassword]
    );

    await query(
      'INSERT INTO profiles (id, full_name, phone, created_at) VALUES ($1, $2, $3, NOW())',
      [superAdminId, 'Super Admin', null]
    );

    await query(
      'INSERT INTO user_roles (id, user_id, role) VALUES ($1, $2, $3)',
      [uuidv4(), superAdminId, 'super_admin']
    );

    console.log('Super admin created successfully!');
    console.log('Email: super-admin@mentalcare.com');
    console.log('Password: admin123');

    await pool.end();
  } catch (error) {
    console.error('Seed error:', error);
    await pool.end();
    process.exit(1);
  }
}

seed();

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// ✅ حمّل env أولاً
require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
});

// ✅ الآن اطبع للتأكد
console.log("ENV PATH:", path.resolve(__dirname, '../.env'));
console.log("DATABASE_URL:", process.env.DATABASE_URL);
console.log("DB_PASSWORD:", process.env.DB_PASSWORD);

// ✅ الاتصال
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  const client = await pool.connect();

  try {
    const migrationFile = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');

    console.log('🚀 Running migration...\n');

    await client.query(sql);

    console.log('✅ Migration completed successfully');
  } catch (err) {
    console.error('❌ Migration error:', err.message);

    if (
      err.message.includes('already exists') ||
      err.message.includes('duplicate')
    ) {
      console.log('⚠️ Column already exists, skipping...');
    } else {
      process.exit(1);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
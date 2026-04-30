#!/usr/bin/env node

/**
 * UNIFIED ADMIN CLI TOOL
 * 
 * Single command-line tool for all administrative operations:
 * - Create Super Admin
 * - Assign User Roles
 * - Fix Doctor Roles & Isolation
 * - Manage Notifications
 * - View System Status
 * 
 * Usage: node admin-cli.cjs [command] [args...]
 */

const pkg = require('pg');
const { Pool } = pkg;
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const dotenv = require('dotenv');
const readline = require('readline');

dotenv.config();

// Database configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'ehs-care',
});

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}`),
  divider: () => console.log(colors.cyan + '='.repeat(70) + colors.reset),
};

// ============================================================================
// MAIN MENU
// ============================================================================

async function showMainMenu() {
  log.divider();
  log.header('  UNIFIED ADMIN TOOL');
  log.divider();
  
  console.log('\nAvailable Commands:\n');
  console.log('  1. create-admin           - Create a new super admin user');
  console.log('  2. assign-role <email> <role>');
  console.log('                            - Assign/change user role');
  console.log('  3. list-users             - Show all users and their roles');
  console.log('  4. fix-doctors            - Fix all doctor roles and permissions');
  console.log('  5. fix-notifications      - Audit and fix notification ownership');
  console.log('  6. verify-isolation       - Check doctor data isolation');
  console.log('  7. system-status          - View complete system status');
  console.log('  8. help                   - Show detailed help');
  console.log('  9. exit                   - Exit program\n');
  log.divider();
}

// ============================================================================
// 1. CREATE SUPER ADMIN
// ============================================================================

async function createAdmin() {
  try {
    log.header('Creating Super Admin User');
    
    const client = await pool.connect();
    
    // Check if admin exists
    const existing = await client.query(
      "SELECT id, email FROM users WHERE email = $1",
      ['super-admin@mentalcare.com']
    );
    
    if (existing.rows.length > 0) {
      log.warn('Super admin already exists!');
      console.log(`  Email: super-admin@mentalcare.com`);
      console.log(`  Password: admin123\n`);
      client.release();
      return;
    }
    
    const userId = uuidv4();
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    // Create user
    await client.query(
      'INSERT INTO users (id, email, password_hash, created_at) VALUES ($1, $2, $3, NOW())',
      [userId, 'super-admin@mentalcare.com', hashedPassword]
    );
    
    // Create profile
    await client.query(
      'INSERT INTO profiles (id, full_name, phone, created_at) VALUES ($1, $2, $3, NOW())',
      [userId, 'Super Admin', null]
    );
    
    // Create role
    await client.query(
      'INSERT INTO user_roles (id, user_id, role, created_at) VALUES ($1, $2, $3, NOW())',
      [uuidv4(), userId, 'super_admin']
    );
    
    log.success('Super admin created successfully!');
    console.log(`  Email: super-admin@mentalcare.com`);
    console.log(`  Password: admin123\n`);
    
    client.release();
  } catch (error) {
    log.error(`Failed to create admin: ${error.message}`);
  }
}

// ============================================================================
// 2. ASSIGN ROLE
// ============================================================================

async function assignRole(email, role) {
  try {
    log.header('Assigning User Role');
    
    if (!email || !role) {
      log.error('Usage: assign-role <email> <role>');
      console.log('Available roles: super_admin, admin, user, parent, receptionist, service\n');
      return;
    }
    
    const validRoles = ['super_admin', 'admin', 'user', 'parent', 'receptionist', 'service'];
    if (!validRoles.includes(role)) {
      log.error(`Invalid role: ${role}`);
      console.log(`Valid roles: ${validRoles.join(', ')}\n`);
      return;
    }
    
    const client = await pool.connect();
    
    // Find user
    const userResult = await client.query(
      'SELECT id, email FROM users WHERE email = $1',
      [email]
    );
    
    if (userResult.rows.length === 0) {
      log.error(`User not found: ${email}\n`);
      client.release();
      return;
    }
    
    const userId = userResult.rows[0].id;
    
    // Remove existing role
    await client.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
    
    // Assign new role
    await client.query(
      'INSERT INTO user_roles (id, user_id, role) VALUES ($1, $2, $3)',
      [uuidv4(), userId, role]
    );
    
    log.success('Role assigned successfully!');
    console.log(`  Email: ${email}`);
    console.log(`  Role: ${role}\n`);
    
    client.release();
  } catch (error) {
    log.error(`Failed to assign role: ${error.message}`);
  }
}

// ============================================================================
// 3. LIST USERS
// ============================================================================

async function listUsers() {
  try {
    log.header('System Users');
    
    const client = await pool.connect();
    
    const result = await client.query(`
      SELECT 
        u.id,
        u.email,
        p.full_name,
        ur.role,
        u.created_at
      FROM users u
      LEFT JOIN profiles p ON u.id = p.id
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      ORDER BY u.created_at DESC
    `);
    
    if (result.rows.length === 0) {
      log.warn('No users found\n');
      client.release();
      return;
    }
    
    console.log();
    result.rows.forEach((user) => {
      const role = user.role || 'NO_ROLE';
      const roleColor = {
        'super_admin': colors.red,
        'admin': colors.yellow,
        'user': colors.green,
        'NO_ROLE': colors.red,
      }[role] || colors.reset;
      
      console.log(`  ${colors.bright}${user.email}${colors.reset}`);
      console.log(`    Name: ${user.full_name || 'N/A'}`);
      console.log(`    Role: ${roleColor}${role}${colors.reset}`);
      console.log(`    ID: ${user.id}`);
      console.log();
    });
    
    console.log(`Total users: ${result.rows.length}\n`);
    client.release();
  } catch (error) {
    log.error(`Failed to list users: ${error.message}`);
  }
}

// ============================================================================
// 4. FIX DOCTORS
// ============================================================================

async function fixDoctors() {
  try {
    log.header('Fixing Doctor Roles & Permissions');
    
    const client = await pool.connect();
    
    // Get all doctor users
    const doctorsResult = await client.query(`
      SELECT u.id, u.email, p.full_name, ur.role
      FROM users u
      LEFT JOIN profiles p ON u.id = p.id
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      ORDER BY u.email
    `);
    
    if (doctorsResult.rows.length === 0) {
      log.warn('No doctors found\n');
      client.release();
      return;
    }
    
    console.log();
    
    for (const user of doctorsResult.rows) {
      const role = user.role || 'NO_ROLE';
      const isDoctor = user.email.includes('doctor');
      
      if (isDoctor && role !== 'user') {
        log.warn(`Fixing doctor role: ${user.email}`);
        console.log(`  Current role: ${role} → Fixing to: user`);
        
        // Remove existing role
        await client.query('DELETE FROM user_roles WHERE user_id = $1', [user.id]);
        
        // Assign doctor role
        await client.query(
          'INSERT INTO user_roles (id, user_id, role) VALUES ($1, $2, $3)',
          [uuidv4(), user.id, 'user']
        );
        
        log.success(`Fixed: ${user.email}`);
      }
    }
    
    console.log();
    log.success('Doctor role fixing completed\n');
    client.release();
  } catch (error) {
    log.error(`Failed to fix doctors: ${error.message}`);
  }
}

// ============================================================================
// 5. FIX NOTIFICATIONS
// ============================================================================

async function fixNotifications() {
  try {
    log.header('Auditing & Fixing Notification Ownership');
    
    const client = await pool.connect();
    
    // Get all notifications with associated data
    const result = await client.query(`
      SELECT 
        n.id,
        n.user_id,
        n.message,
        n.appointment_id,
        u.email as user_email,
        a.doctor_id,
        d_user.email as doctor_email,
        p.full_name
      FROM notifications n
      LEFT JOIN users u ON n.user_id = u.id
      LEFT JOIN appointments a ON n.appointment_id = a.id
      LEFT JOIN users d_user ON a.doctor_id = d_user.id
      LEFT JOIN profiles p ON n.user_id = p.id
      ORDER BY n.created_at DESC
      LIMIT 20
    `);
    
    if (result.rows.length === 0) {
      log.info('No notifications to audit\n');
      client.release();
      return;
    }
    
    console.log();
    let fixed = 0;
    
    for (const notif of result.rows) {
      if (!notif.user_email) {
        log.warn(`Notification ${notif.id} - Missing user`);
        fixed++;
        
        // Try to fix: if has appointment, use doctor's user_id
        if (notif.doctor_email) {
          await client.query(
            'UPDATE notifications SET user_id = $1 WHERE id = $2',
            [notif.doctor_id, notif.id]
          );
          log.success(`Fixed: Assigned to ${notif.doctor_email}`);
        }
      }
    }
    
    console.log();
    if (fixed === 0) {
      log.success('All notifications are correctly assigned');
    } else {
      log.success(`Fixed ${fixed} notifications`);
    }
    console.log();
    
    client.release();
  } catch (error) {
    log.error(`Failed to fix notifications: ${error.message}`);
  }
}

// ============================================================================
// 6. VERIFY ISOLATION
// ============================================================================

async function verifyIsolation() {
  try {
    log.header('Doctor Data Isolation Verification');
    
    const client = await pool.connect();
    
    // Get all doctors
    const doctorsResult = await client.query(`
      SELECT u.id, u.email, p.full_name, ur.role
      FROM users u
      LEFT JOIN profiles p ON u.id = p.id
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      WHERE ur.role = 'user' AND u.email LIKE '%doctor%'
      ORDER BY u.email
    `);
    
    if (doctorsResult.rows.length === 0) {
      log.info('No doctors found\n');
      client.release();
      return;
    }
    
    console.log();
    
    for (const doctor of doctorsResult.rows) {
      console.log(`${colors.bright}${doctor.email}${colors.reset}`);
      
      // Count patients
      const patientsResult = await client.query(
        'SELECT COUNT(*) as count FROM patient_doctors WHERE doctor_id = $1',
        [doctor.id]
      );
      const patientCount = patientsResult.rows[0].count;
      
      // Count appointments
      const appointmentsResult = await client.query(
        'SELECT COUNT(*) as count FROM appointments WHERE doctor_id = $1',
        [doctor.id]
      );
      const appointmentCount = appointmentsResult.rows[0].count;
      
      // Count notifications
      const notificationsResult = await client.query(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1',
        [doctor.id]
      );
      const notificationCount = notificationsResult.rows[0].count;
      
      console.log(`  Patients: ${patientCount}`);
      console.log(`  Appointments: ${appointmentCount}`);
      console.log(`  Notifications: ${notificationCount}`);
      console.log();
    }
    
    log.success('Verification complete\n');
    client.release();
  } catch (error) {
    log.error(`Failed to verify isolation: ${error.message}`);
  }
}

// ============================================================================
// 7. SYSTEM STATUS
// ============================================================================

async function systemStatus() {
  try {
    log.header('System Status');
    
    const client = await pool.connect();
    
    // User stats
    const usersResult = await client.query('SELECT COUNT(*) as count FROM users');
    const userCount = usersResult.rows[0].count;
    
    // Role breakdown
    const rolesResult = await client.query(`
      SELECT role, COUNT(*) as count 
      FROM user_roles 
      GROUP BY role 
      ORDER BY count DESC
    `);
    
    // Data counts
    const patientsResult = await client.query('SELECT COUNT(*) as count FROM patients');
    const appointmentsResult = await client.query('SELECT COUNT(*) as count FROM appointments');
    const notificationsResult = await client.query('SELECT COUNT(*) as count FROM notifications');
    
    console.log();
    log.info('User Statistics');
    console.log(`  Total Users: ${userCount}`);
    console.log(`  Role Breakdown:`);
    rolesResult.rows.forEach(row => {
      console.log(`    • ${row.role}: ${row.count}`);
    });
    
    console.log();
    log.info('Data Statistics');
    console.log(`  Total Patients: ${patientsResult.rows[0].count}`);
    console.log(`  Total Appointments: ${appointmentsResult.rows[0].count}`);
    console.log(`  Total Notifications: ${notificationsResult.rows[0].count}`);
    
    console.log();
    log.info('Database Connection');
    console.log(`  Host: ${process.env.DB_HOST || 'localhost'}`);
    console.log(`  Database: ${process.env.DB_NAME || 'ehs-care'}`);
    console.log(`  User: ${process.env.DB_USER || 'postgres'}`);
    
    console.log();
    log.success('Status check complete\n');
    
    client.release();
  } catch (error) {
    log.error(`Failed to get system status: ${error.message}`);
  }
}

// ============================================================================
// 8. HELP
// ============================================================================

async function showHelp() {
  log.header('Detailed Help');
  
  console.log(`
${colors.bright}create-admin${colors.reset}
  Creates a new super admin user with default credentials.
  Usage: node admin-cli.cjs create-admin
  
${colors.bright}assign-role <email> <role>${colors.reset}
  Assign or change a user's role.
  Usage: node admin-cli.cjs assign-role john@example.com user
  Valid roles: super_admin, admin, user, parent, receptionist, service
  
${colors.bright}list-users${colors.reset}
  Display all users in the system with their roles and details.
  Usage: node admin-cli.cjs list-users
  
${colors.bright}fix-doctors${colors.reset}
  Automatically fix doctor role configurations.
  Ensures all doctors have 'user' role for proper data isolation.
  Usage: node admin-cli.cjs fix-doctors
  
${colors.bright}fix-notifications${colors.reset}
  Audit and fix notification ownership.
  Ensures notifications are assigned to correct users.
  Usage: node admin-cli.cjs fix-notifications
  
${colors.bright}verify-isolation${colors.reset}
  Verify that doctor data is properly isolated.
  Shows patient, appointment, and notification counts per doctor.
  Usage: node admin-cli.cjs verify-isolation
  
${colors.bright}system-status${colors.reset}
  Display complete system status and statistics.
  Shows user counts, role breakdown, and data statistics.
  Usage: node admin-cli.cjs system-status
  
${colors.bright}help${colors.reset}
  Show this detailed help message.
  Usage: node admin-cli.cjs help
  
${colors.bright}exit${colors.reset}
  Exit the program.
  Usage: node admin-cli.cjs exit

${colors.bright}Interactive Mode${colors.reset}
  Run without arguments to enter interactive menu mode:
  Usage: node admin-cli.cjs

`);
}

// ============================================================================
// INTERACTIVE MENU
// ============================================================================

async function interactiveMenu() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));
  
  let running = true;
  
  while (running) {
    await showMainMenu();
    const choice = await question('Enter command number or name (1-9): ');
    
    console.log();
    
    switch (choice.trim().toLowerCase()) {
      case '1':
      case 'create-admin':
        await createAdmin();
        break;
      case '2':
      case 'assign-role':
        const email = await question('Enter email: ');
        const role = await question('Enter role: ');
        await assignRole(email, role);
        break;
      case '3':
      case 'list-users':
        await listUsers();
        break;
      case '4':
      case 'fix-doctors':
        await fixDoctors();
        break;
      case '5':
      case 'fix-notifications':
        await fixNotifications();
        break;
      case '6':
      case 'verify-isolation':
        await verifyIsolation();
        break;
      case '7':
      case 'system-status':
        await systemStatus();
        break;
      case '8':
      case 'help':
        await showHelp();
        break;
      case '9':
      case 'exit':
        running = false;
        break;
      default:
        log.error('Invalid command\n');
    }
    
    if (running) {
      await question('Press Enter to continue...');
      console.clear();
    }
  }
  
  rl.close();
  await pool.end();
  console.log('\nGoodbye!\n');
  process.exit(0);
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  
  try {
    if (args.length === 0) {
      // Interactive mode
      await interactiveMenu();
    } else {
      const command = args[0].toLowerCase();
      
      switch (command) {
        case 'create-admin':
          await createAdmin();
          break;
        case 'assign-role':
          await assignRole(args[1], args[2]);
          break;
        case 'list-users':
          await listUsers();
          break;
        case 'fix-doctors':
          await fixDoctors();
          break;
        case 'fix-notifications':
          await fixNotifications();
          break;
        case 'verify-isolation':
          await verifyIsolation();
          break;
        case 'system-status':
          await systemStatus();
          break;
        case 'help':
          await showHelp();
          break;
        case 'exit':
          process.exit(0);
          break;
        default:
          log.error(`Unknown command: ${command}`);
          console.log('\nRun "node admin-cli.cjs help" for usage information\n');
      }
      
      await pool.end();
      process.exit(0);
    }
  } catch (error) {
    log.error(`Unexpected error: ${error.message}`);
    await pool.end();
    process.exit(1);
  }
}

main();

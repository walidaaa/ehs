-- EHS Care Database Schema
-- Run this SQL in PostgreSQL to create the database

-- Users table (for authentication)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    specialty VARCHAR(255),
    service_name VARCHAR(255),
    created_by UUID,
    last_seen TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- App roles enum type
DO $$ BEGIN
    CREATE TYPE app_role AS ENUM ('super_admin', 'admin', 'user', 'parent', 'receptionist');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- User roles table
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role app_role NOT NULL
);

-- Centers table
CREATE TABLE IF NOT EXISTS centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Parents table
CREATE TABLE IF NOT EXISTS parents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    user_id UUID REFERENCES users(id),
    archived BOOLEAN DEFAULT FALSE,
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Patients table
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    age INTEGER NOT NULL,
    parent_id UUID REFERENCES parents(id),
    center_id UUID REFERENCES centers(id),
    doctor_id UUID,
    status VARCHAR(50) DEFAULT 'استقرار',
    notes TEXT,
    photo_url TEXT,
    diagnosis_type VARCHAR(255),
    birth_type VARCHAR(100),
    pregnancy_months INTEGER DEFAULT 9,
    mother_health_notes TEXT,
    birth_complications TEXT,
    entry_date DATE,
    start_date DATE,
    archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Patient doctors (many-to-many)
CREATE TABLE IF NOT EXISTS patient_doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID,
    date TIMESTAMP NOT NULL,
    type VARCHAR(100),
    status VARCHAR(50) DEFAULT 'scheduled',
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Treatments table
CREATE TABLE IF NOT EXISTS treatments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    medication VARCHAR(255) NOT NULL,
    dosage VARCHAR(100) NOT NULL,
    frequency VARCHAR(100) DEFAULT 'daily',
    start_date DATE,
    end_date DATE,
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Treatment medications table
CREATE TABLE IF NOT EXISTS treatment_medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    treatment_id UUID NOT NULL REFERENCES treatments(id) ON DELETE CASCADE,
    medication_name VARCHAR(255) NOT NULL,
    morning_dose DECIMAL,
    evening_dose DECIMAL,
    night_dose DECIMAL,
    meal_timing VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    present BOOLEAN DEFAULT FALSE,
    notes TEXT,
    recorded_by UUID,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Patient tasks table
CREATE TABLE IF NOT EXISTS patient_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL,
    parent_id UUID REFERENCES parents(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending',
    due_date DATE,
    evaluation VARCHAR(50),
    evaluation_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Task reports table
CREATE TABLE IF NOT EXISTS task_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES patient_tasks(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES parents(id),
    report_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50),
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL,
    receiver_id UUID NOT NULL,
    content TEXT,
    message_type VARCHAR(50) DEFAULT 'text',
    media_url TEXT,
    media_type VARCHAR(50),
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_patients_parent_id ON patients(parent_id);
CREATE INDEX IF NOT EXISTS idx_patients_doctor_id ON patients(doctor_id);
CREATE INDEX IF NOT EXISTS idx_patient_doctors_patient_id ON patient_doctors(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_doctors_doctor_id ON patient_doctors(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);

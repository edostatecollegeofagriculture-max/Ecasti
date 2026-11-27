-- EDOCASTI MIGRATION 010 RERUN-SAFETY REVIEW DRAFT
-- NOT APPROVED FOR EXECUTION.
-- Generated from the original migration.
-- Original file is preserved.
-- Existing same-name constraints are checked for matching definitions.
-- Review and disposable-database testing are still required.

-- EDOCASTI core institutional entities and legacy finance history.
-- Additive schema only: this migration creates empty tables and constraints.
-- It does not import, update, seed, or delete application records.
-- Existing JSON IDs remain TEXT so staged migration can preserve identity.
-- Historical date/time strings are TEXT to avoid lossy coercion during import.

BEGIN;

CREATE TABLE IF NOT EXISTS schools (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    dean_user_id TEXT,
    description TEXT NOT NULL DEFAULT '',
    image_url TEXT
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL,
    phone TEXT,
    photo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0
        CHECK (failed_login_attempts >= 0),
    department_id TEXT,
    school_id TEXT,
    created_at TEXT NOT NULL,
    last_login TEXT
);

CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    hod_user_id TEXT,
    CONSTRAINT uq_departments_school_code UNIQUE (school_id, code),
    CONSTRAINT fk_departments_school FOREIGN KEY (school_id)
        REFERENCES schools(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS programmes (
    id TEXT PRIMARY KEY,
    department_id TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    qualification TEXT NOT NULL
        CHECK (qualification IN ('ND', 'HND', 'Certificate')),
    duration_years INTEGER NOT NULL CHECK (duration_years > 0),
    description TEXT NOT NULL DEFAULT '',
    requirements JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(requirements) = 'array'),
    CONSTRAINT uq_programmes_department_code UNIQUE (department_id, code),
    CONSTRAINT fk_programmes_department FOREIGN KEY (department_id)
        REFERENCES departments(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    department_id TEXT NOT NULL,
    programme_id TEXT,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    credit_units INTEGER NOT NULL CHECK (credit_units > 0),
    level TEXT NOT NULL,
    semester TEXT NOT NULL
        CHECK (semester IN ('First Semester', 'Second Semester')),
    lecturer_user_id TEXT,
    lecturer_name TEXT,
    is_compulsory BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_courses_department FOREIGN KEY (department_id)
        REFERENCES departments(id) ON DELETE RESTRICT,
    CONSTRAINT fk_courses_programme FOREIGN KEY (programme_id)
        REFERENCES programmes(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS admission_applications (
    id TEXT PRIMARY KEY,
    application_number TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    programme_id TEXT NOT NULL,
    session TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    other_names TEXT,
    gender TEXT NOT NULL,
    date_of_birth TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    photo_url TEXT,
    state_of_origin TEXT NOT NULL,
    lga TEXT NOT NULL,
    residential_address TEXT NOT NULL,
    o_level_results JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(o_level_results) = 'array'),
    status TEXT NOT NULL
        CHECK (status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'OFFERED', 'ACCEPTED', 'REJECTED')),
    screening_notes TEXT,
    reviewer_user_id TEXT,
    reviewer_display_snapshot TEXT,
    submitted_at TEXT,
    decision_at TEXT,
    fee_activation_required_at TEXT,
    CONSTRAINT fk_applications_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_applications_programme FOREIGN KEY (programme_id)
        REFERENCES programmes(id) ON DELETE RESTRICT,
    CONSTRAINT fk_applications_reviewer FOREIGN KEY (reviewer_user_id)
        REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    matric_number TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    photo_url TEXT,
    programme_id TEXT NOT NULL,
    department_id TEXT NOT NULL,
    school_id TEXT NOT NULL,
    level TEXT NOT NULL,
    session_admitted TEXT NOT NULL,
    academic_status TEXT NOT NULL
        CHECK (academic_status IN ('Good Standing', 'Probation', 'Suspended', 'Graduated')),
    gender TEXT NOT NULL,
    date_of_birth TEXT NOT NULL,
    emergency_contact TEXT NOT NULL,
    next_of_kin TEXT NOT NULL,
    cgpa NUMERIC(6,3) NOT NULL DEFAULT 0,
    total_credits_earned INTEGER NOT NULL DEFAULT 0
        CHECK (total_credits_earned >= 0),
    CONSTRAINT fk_students_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_students_programme FOREIGN KEY (programme_id)
        REFERENCES programmes(id) ON DELETE RESTRICT,
    CONSTRAINT fk_students_department FOREIGN KEY (department_id)
        REFERENCES departments(id) ON DELETE RESTRICT,
    CONSTRAINT fk_students_school FOREIGN KEY (school_id)
        REFERENCES schools(id) ON DELETE RESTRICT
);

-- User-to-school/department and leadership links are added after the
-- corresponding tables exist. All use RESTRICT to prevent accidental loss.
DO $migration$
DECLARE
    existing_definition TEXT;
BEGIN
    SELECT pg_get_constraintdef(c.oid)
      INTO existing_definition
      FROM pg_constraint c
     WHERE c.conname = 'fk_users_department'
       AND c.conrelid = 'public.users'::regclass;

    IF existing_definition IS NULL THEN
        ALTER TABLE public.users
            ADD CONSTRAINT fk_users_department
            FOREIGN KEY (department_id)
            REFERENCES public.departments(id)
            ON DELETE RESTRICT;
    ELSIF regexp_replace(lower(existing_definition), '\s+', '', 'g')
       <> regexp_replace(
            lower('FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT'),
            '\s+', '', 'g'
          ) THEN
        RAISE EXCEPTION
            'Constraint fk_users_department exists with a different definition.';
    ELSE
        RAISE NOTICE 'Constraint fk_users_department already exists and matches.';
    END IF;
END
$migration$;
DO $migration$
DECLARE
    existing_definition TEXT;
BEGIN
    SELECT pg_get_constraintdef(c.oid)
      INTO existing_definition
      FROM pg_constraint c
     WHERE c.conname = 'fk_users_school'
       AND c.conrelid = 'public.users'::regclass;

    IF existing_definition IS NULL THEN
        ALTER TABLE public.users
            ADD CONSTRAINT fk_users_school
            FOREIGN KEY (school_id)
            REFERENCES public.schools(id)
            ON DELETE RESTRICT;
    ELSIF regexp_replace(lower(existing_definition), '\s+', '', 'g')
       <> regexp_replace(
            lower('FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE RESTRICT'),
            '\s+', '', 'g'
          ) THEN
        RAISE EXCEPTION
            'Constraint fk_users_school exists with a different definition.';
    ELSE
        RAISE NOTICE 'Constraint fk_users_school already exists and matches.';
    END IF;
END
$migration$;
DO $migration$
DECLARE
    existing_definition TEXT;
BEGIN
    SELECT pg_get_constraintdef(c.oid)
      INTO existing_definition
      FROM pg_constraint c
     WHERE c.conname = 'fk_schools_dean'
       AND c.conrelid = 'public.schools'::regclass;

    IF existing_definition IS NULL THEN
        ALTER TABLE public.schools
            ADD CONSTRAINT fk_schools_dean
            FOREIGN KEY (dean_user_id)
            REFERENCES public.users(id)
            ON DELETE RESTRICT;
    ELSIF regexp_replace(lower(existing_definition), '\s+', '', 'g')
       <> regexp_replace(
            lower('FOREIGN KEY (dean_user_id) REFERENCES users(id) ON DELETE RESTRICT'),
            '\s+', '', 'g'
          ) THEN
        RAISE EXCEPTION
            'Constraint fk_schools_dean exists with a different definition.';
    ELSE
        RAISE NOTICE 'Constraint fk_schools_dean already exists and matches.';
    END IF;
END
$migration$;
DO $migration$
DECLARE
    existing_definition TEXT;
BEGIN
    SELECT pg_get_constraintdef(c.oid)
      INTO existing_definition
      FROM pg_constraint c
     WHERE c.conname = 'fk_departments_hod'
       AND c.conrelid = 'public.departments'::regclass;

    IF existing_definition IS NULL THEN
        ALTER TABLE public.departments
            ADD CONSTRAINT fk_departments_hod
            FOREIGN KEY (hod_user_id)
            REFERENCES public.users(id)
            ON DELETE RESTRICT;
    ELSIF regexp_replace(lower(existing_definition), '\s+', '', 'g')
       <> regexp_replace(
            lower('FOREIGN KEY (hod_user_id) REFERENCES users(id) ON DELETE RESTRICT'),
            '\s+', '', 'g'
          ) THEN
        RAISE EXCEPTION
            'Constraint fk_departments_hod exists with a different definition.';
    ELSE
        RAISE NOTICE 'Constraint fk_departments_hod already exists and matches.';
    END IF;
END
$migration$;
DO $migration$
DECLARE
    existing_definition TEXT;
BEGIN
    SELECT pg_get_constraintdef(c.oid)
      INTO existing_definition
      FROM pg_constraint c
     WHERE c.conname = 'fk_courses_lecturer'
       AND c.conrelid = 'public.courses'::regclass;

    IF existing_definition IS NULL THEN
        ALTER TABLE public.courses
            ADD CONSTRAINT fk_courses_lecturer
            FOREIGN KEY (lecturer_user_id)
            REFERENCES public.users(id)
            ON DELETE RESTRICT;
    ELSIF regexp_replace(lower(existing_definition), '\s+', '', 'g')
       <> regexp_replace(
            lower('FOREIGN KEY (lecturer_user_id) REFERENCES users(id) ON DELETE RESTRICT'),
            '\s+', '', 'g'
          ) THEN
        RAISE EXCEPTION
            'Constraint fk_courses_lecturer exists with a different definition.';
    ELSE
        RAISE NOTICE 'Constraint fk_courses_lecturer already exists and matches.';
    END IF;
END
$migration$;

-- Legacy invoice and payment history remains distinct from the itemized
-- fee obligations/payment-allocation subsystem in migration 001.
CREATE TABLE IF NOT EXISTS legacy_invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT NOT NULL,
    student_id TEXT NOT NULL,
    session TEXT NOT NULL,
    title TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    amount_paid NUMERIC(12,2) NOT NULL CHECK (amount_paid >= 0),
    status TEXT NOT NULL CHECK (status IN ('UNPAID', 'PARTIAL', 'PAID')),
    due_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    CONSTRAINT uq_legacy_invoice_student_pair UNIQUE (id, student_id),
    CONSTRAINT fk_legacy_invoice_student FOREIGN KEY (student_id)
        REFERENCES students(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS legacy_payment_transactions (
    id TEXT PRIMARY KEY,
    reference TEXT NOT NULL,
    invoice_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    channel TEXT NOT NULL
        CHECK (channel IN ('Remita', 'Bank Transfer', 'Interswitch', 'Card')),
    status TEXT NOT NULL CHECK (status IN ('VERIFIED', 'PENDING', 'REJECTED')),
    provider_reference TEXT NOT NULL DEFAULT '',
    paid_at TEXT NOT NULL,
    verified_by_display TEXT,
    CONSTRAINT fk_legacy_payment_invoice_student FOREIGN KEY (invoice_id, student_id)
        REFERENCES legacy_invoices(id, student_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_departments_school ON departments (school_id);
CREATE INDEX IF NOT EXISTS idx_programmes_department ON programmes (department_id);
CREATE INDEX IF NOT EXISTS idx_courses_department ON courses (department_id);
CREATE INDEX IF NOT EXISTS idx_courses_programme ON courses (programme_id);
CREATE INDEX IF NOT EXISTS idx_applications_user ON admission_applications (user_id);
CREATE INDEX IF NOT EXISTS idx_applications_programme ON admission_applications (programme_id);
CREATE INDEX IF NOT EXISTS idx_students_user ON students (user_id);
CREATE INDEX IF NOT EXISTS idx_students_programme ON students (programme_id);
CREATE INDEX IF NOT EXISTS idx_students_department ON students (department_id);
CREATE INDEX IF NOT EXISTS idx_students_school ON students (school_id);
CREATE INDEX IF NOT EXISTS idx_legacy_invoices_student ON legacy_invoices (student_id);
CREATE INDEX IF NOT EXISTS idx_legacy_payments_invoice_student ON legacy_payment_transactions (invoice_id, student_id);
CREATE INDEX IF NOT EXISTS idx_legacy_payments_student ON legacy_payment_transactions (student_id);

COMMIT;

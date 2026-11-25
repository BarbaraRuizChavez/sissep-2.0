-- Schema inicial de SISSEP para PostgreSQL 16
-- TypeORM con synchronize:true actualiza esto en desarrollo,
-- pero este archivo sirve como referencia y para el contenedor Docker.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tipos enumerados
DO $$ BEGIN
  CREATE TYPE user_role    AS ENUM ('estudiante', 'encargado');
  CREATE TYPE program_type AS ENUM ('servicio_social', 'residencias');
  CREATE TYPE doc_status   AS ENUM ('pendiente', 'aprobado', 'rechazado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tabla de usuarios (estudiantes y encargados)
CREATE TABLE IF NOT EXISTS users (
  id                UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  control_number    VARCHAR(30)  UNIQUE NOT NULL,
  name              VARCHAR(140) NOT NULL,
  password_hash     TEXT         NOT NULL,
  role              user_role    NOT NULL DEFAULT 'estudiante',
  carrera           VARCHAR(140) DEFAULT '',
  current_semester  VARCHAR(30),
  gender            VARCHAR(40),
  service_organization TEXT,
  service_sector    VARCHAR(100),
  service_department TEXT,
  service_city      VARCHAR(120),
  service_program   TEXT,
  service_activities TEXT,
  has_disability    BOOLEAN,
  indigenous_language_speaker BOOLEAN,
  phone             VARCHAR(30),
  service_enrollment_date DATE,
  service_end_date  DATE,
  service_year      INTEGER,
  service_period    VARCHAR(40),
  supported_community VARCHAR(140),
  people_supported  INTEGER,
  encargado_section VARCHAR(80)  DEFAULT '',
  email             VARCHAR(254) UNIQUE,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ  DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_control ON users(control_number);
CREATE INDEX IF NOT EXISTS idx_users_role    ON users(role);
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_semester VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(40);
ALTER TABLE users ADD COLUMN IF NOT EXISTS service_organization TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS service_sector VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS service_department TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS service_city VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS service_program TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS service_activities TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_disability BOOLEAN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS indigenous_language_speaker BOOLEAN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS service_enrollment_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS service_end_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS service_year INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS service_period VARCHAR(40);
ALTER TABLE users ADD COLUMN IF NOT EXISTS supported_community VARCHAR(140);
ALTER TABLE users ADD COLUMN IF NOT EXISTS people_supported INTEGER;

-- Tabla de documentos del expediente
-- Cada fila representa un documento requerido de un estudiante.
-- La combinacion (student_id, program_type, category, stage) es unica.
CREATE TABLE IF NOT EXISTS documents (
  id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  program_type  program_type NOT NULL,
  category      VARCHAR(120) NOT NULL,
  description   TEXT         DEFAULT '',
  status        doc_status   NOT NULL DEFAULT 'pendiente',
  file_name     VARCHAR(260),
  file_path     TEXT,
  file_size     INTEGER,
  external_url  TEXT,
  observations  TEXT         DEFAULT '',
  reviewed_by   UUID         REFERENCES users(id),
  period_id     UUID,
  due_date      DATE,
  start_date    DATE,
  end_date      DATE,
  instructions  TEXT NOT NULL DEFAULT '',
  stage         VARCHAR(80) NOT NULL DEFAULT 'inicio',
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_docs_student ON documents(student_id);
CREATE INDEX IF NOT EXISTS idx_docs_status  ON documents(status);
CREATE INDEX IF NOT EXISTS idx_docs_program ON documents(program_type);

CREATE TABLE IF NOT EXISTS document_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  file_name VARCHAR(260) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  period_id UUID,
  status VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  observations TEXT NOT NULL DEFAULT '',
  reviewed_by UUID,
  submitted_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_document_submissions_doc_date ON document_submissions(document_id, submitted_at);

CREATE TABLE IF NOT EXISTS periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_type VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT periods_valid_range CHECK (starts_on <= ends_on)
);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS period_id UUID;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS instructions TEXT NOT NULL DEFAULT '';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS stage VARCHAR(80) NOT NULL DEFAULT 'inicio';
ALTER TABLE documents DROP CONSTRAINT IF EXISTS uq_student_doc;
CREATE UNIQUE INDEX IF NOT EXISTS uq_documents_student_program_category_stage ON documents(student_id, program_type, category, stage);
DO $$ BEGIN
  ALTER TABLE documents ADD CONSTRAINT fk_documents_period FOREIGN KEY (period_id) REFERENCES periods(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_periods_active_range ON periods(program_type, active, starts_on, ends_on);

CREATE TABLE IF NOT EXISTS required_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_type VARCHAR(30) NOT NULL,
  category VARCHAR(120) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  stage VARCHAR(80) NOT NULL DEFAULT 'inicio',
  due_date DATE,
  start_date DATE,
  end_date DATE,
  instructions TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE required_documents ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE required_documents ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE required_documents ADD COLUMN IF NOT EXISTS instructions TEXT NOT NULL DEFAULT '';
ALTER TABLE required_documents ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(254);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON users(email) WHERE email IS NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS password_resets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger para actualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at     ON users;
DROP TRIGGER IF EXISTS trg_documents_updated_at ON documents;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

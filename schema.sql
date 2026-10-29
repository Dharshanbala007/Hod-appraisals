-- NSCET Appraisal (HoD / Vice Principal / Principal / Secretary / officers): the MySQL 5.7+ / MariaDB 10.2+ tables.
-- Made from db.js by  node db-setup.js --sql > schema.sql  (do not edit by hand: the test checks that they match).
-- Run once in the site's database (see README):   mysql -u appraisal -p nscet_appraisal < schema.sql
-- The site also creates these tables itself when it starts. Safe to run again: existing tables and data are kept.
--   accounts      the logins (HoD per department, VP, Principal, Secretary, Placement Officer / Co-ordinator, Librarian, Physical Director)
--   appraisals    one row per appraisal: the staff ones copied from the staff site's folder, and each role's own (form content as JSON text)
--   review_marks  the marks and remark of each reviewer level (hod / vp / principal / secretary) per section; 'overall' = overall remark
--   review_notes  the reviewer's verification checks, review controls and approval items
--   audit_log     who did what and when (logins, marks changed, Proceed, Finalise, submissions)

CREATE TABLE IF NOT EXISTS accounts (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, username VARCHAR(40) NOT NULL, name VARCHAR(100) NOT NULL,
  role ENUM('hod', 'vp', 'principal', 'secretary', 'po', 'pc', 'librarian', 'pd', 'admin') NOT NULL, dept VARCHAR(10) NULL, password_hash VARCHAR(255) NOT NULL, active TINYINT(1) NOT NULL DEFAULT 1, must_change TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY username (username)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS appraisals (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, kind ENUM('staff', 'hod', 'vp', 'principal', 'po', 'pc', 'librarian', 'pd') NOT NULL, owner VARCHAR(40) NOT NULL,
  year CHAR(7) NOT NULL, term VARCHAR(2) NOT NULL DEFAULT '', name VARCHAR(100) NOT NULL DEFAULT '', designation VARCHAR(100) NOT NULL DEFAULT '', dept VARCHAR(10) NOT NULL DEFAULT '',
  folder VARCHAR(255) NOT NULL, data LONGTEXT NOT NULL, status ENUM('draft','submitted','proceeded','finalised') NOT NULL DEFAULT 'draft',
  self_total DECIMAL(5,1) NULL, final_total DECIMAL(5,1) NULL, submitted_at DATETIME NULL, proceeded_at DATETIME NULL, proceeded_by VARCHAR(40) NULL,
  finalised_at DATETIME NULL, finalised_by VARCHAR(40) NULL, recorded TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY one_per_period (kind, owner, year, term), KEY by_dept (dept, kind)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS review_marks (appraisal_id INT UNSIGNED NOT NULL, stage ENUM('hod', 'vp', 'principal', 'secretary') NOT NULL, section VARCHAR(10) NOT NULL,
  marks DECIMAL(5,1) NULL, remark TEXT NULL, updated_by VARCHAR(40) NOT NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (appraisal_id, stage, section), CONSTRAINT fk_marks_appraisal FOREIGN KEY (appraisal_id) REFERENCES appraisals (id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS review_notes (appraisal_id INT UNSIGNED NOT NULL, note_key VARCHAR(40) NOT NULL, answer ENUM('Yes','No') NULL, text TEXT NULL,
  updated_by VARCHAR(40) NOT NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (appraisal_id, note_key),
  CONSTRAINT fk_notes_appraisal FOREIGN KEY (appraisal_id) REFERENCES appraisals (id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_log (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, who VARCHAR(40) NOT NULL,
  action VARCHAR(40) NOT NULL, appraisal_id INT UNSIGNED NULL, detail TEXT NULL, KEY by_appraisal (appraisal_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

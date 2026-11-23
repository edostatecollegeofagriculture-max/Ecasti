# EDOCAS Integrated School Management Portal

**Institution:** Edo State College of Agriculture, Science and Technology, Edo State, Nigeria (Iguoriakhi Main Campus)

An enterprise-grade, secure, multi-role Integrated School Management Portal digitizing the complete academic, administrative, financial, and student lifecycle.

---

## 1. System Architecture Overview

The system uses a maintainable three-tier architecture:
- **Client Layer:** React (TypeScript, Tailwind CSS, Lucide Icons, Recharts, print-ready CSS engine).
- **Application & API Layer:**
  - **Live Runtime Service:** Fast Node/Express TypeScript server (`server.ts`) hosting versioned RESTful APIs under `/api/v1/*` and bundling Vite middlewares on port 3000.
  - **Flask Backend Repository (`backend/`):** Production Flask application with Application Factory pattern (`create_app`), Flask-SQLAlchemy ORM models, Flask-JWT-Extended authentication, RBAC decorators, Flask-Migrate, and Pytest test suite.
- **Data Persistence Layer:**
  - Local/Dev: Atomic persistent relational store with automatic audit trailing (`data/edocas_db.json`) and SQLite (`backend/edocas_dev.db`).
  - Production: PostgreSQL database (`postgresql://user:pass@host:5432/edocas_db`).

---

## 2. User Roles and RBAC Matrix

1. **Super Administrator (`SUPER_ADMIN`):** Unrestricted administrative control, database health, audit logs, user provisioning.
2. **Institution Administrator (`INSTITUTION_ADMIN`):** Operational management, academic session config, user lockout/activation.
3. **Rector / Provost (`RECTOR`):** Executive dashboard, institutional KPI analytics, Academic Board/Senate approvals.
4. **College Registrar (`REGISTRAR`):** Admissions lists, matriculation numbers, official transcript releases.
5. **Admissions Officer (`ADMISSIONS_OFFICER`):** Online application screening, O-Level vetting, issuing provisional offers.
6. **Head of Department (`HOD`):** Course registration approval, lecturer course assignments, departmental mark verification.
7. **Lecturer (`LECTURER`):** Continuous Assessment (CA) and Examination score entry, physical practical farm & lab attendance.
8. **Bursar / Finance Officer (`BURSAR`):** Fee schedule configuration, invoice settlements, Remita reconciliation.
9. **Student (`STUDENT`):** Biodata, course enrollment, lecture & practical timetables, result slips, Remita fee payment, student ID card.
10. **Applicant (`APPLICANT`):** Online application form, O-Level grade submission, admission offer tracking & acceptance.

---

## 3. Seeded Test Personas


Development test accounts are available for authorized local testing.
Account details must be configured securely and must never be published
in a public repository.

*Note: Use the floating **"Quick Switch Role"** button at the bottom right corner or header of the portal to switch roles with a single click.*

---

## 4. Setup & Execution Commands

### A. Development Mode (Port 3000)
```bash
# Install dependencies
npm install

# Start the full-stack portal server (Express + Vite)
npm run dev
```

### B. Windows PowerShell Execution
```powershell
# Set environment
$env:PORT="3000"
$env:JWT_SECRET="edocas-secret-key-2026"

# Run dev server
npm run dev
```

### C. Python Flask Backend (`backend/`)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate
pip install -r requirements.txt

# Initialize database
flask init-db

# Provision initial Super Administrator securely
flask create-admin --email admin@edocas.edu.ng --name "Dr. Admin"

# Run Flask backend on port 5000
python run.py
```

### D. Automated Tests
```bash
# Run backend test suite
cd backend
python -m unittest tests/test_auth_and_academics.py

# Lint TypeScript codebase
npm run lint

# Build production bundle
npm run build
```

---

## 5. Security & Nigeria Data Protection Act (NDPA 2023) Compliance

- **Authentication:** Bcrypt salted password hashing with 5-attempt failed-login lockout protection.
- **Tokens:** Short-lived JWT Bearer tokens with strict server-side RBAC validation on all protected endpoints.
- **Audit Trails:** Immutable logging of security, financial, and grade modification actions with actor ID, email, IP address, and timestamp.
- **Data Minimization:** Student personal records and disciplinary details are restricted to authorized registry and administrative personnel only.


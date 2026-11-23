# EDOCASTI Database Migrations

## Current migration

`migrations/001_fee_management_schema.sql`

This migration proposes six relational tables for the fee-management
feature:

1. `fee_catalog`
2. `program_fee_schedule`
3. `program_fee_schedule_items`
4. `student_fee_obligations`
5. `student_payments`
6. `student_payment_allocations`

## Important architecture note

The existing application currently stores users, students and programmes
in its JSON database. The migration therefore stores their IDs as TEXT
without foreign keys to those entities.

Foreign keys between the six fee-management tables are enforced.

External foreign keys should only be added after the corresponding
users, students and programmes have been migrated to PostgreSQL and
their IDs have been verified.

## Safety

- Creating this file does not execute SQL.
- No Neon tables are created by this migration-file preparation step.
- Existing JSON records, invoices and payment transactions are not changed.
- Existing fee catalogue and fee schedule JSON arrays are not imported
  by this migration.
- Do not run this migration until it has been reviewed and approved.
- Keep a verified backup before any future database migration.

## Application responsibilities still required

The database schema alone does not implement fee-management behavior.
The backend must still enforce:

- Super Admin and Bursar permissions.
- Published and active schedule requirements.
- One-time fee generation rules.
- Arrears handling and allocation priority.
- Transaction-safe payment allocation.
- Receipt generation and audit logging.
- Protection against duplicate payment processing.

Payment allocation totals and obligation balance updates must be
performed in a database transaction by the application.

## Rollback

Do not automatically drop these tables as a rollback strategy.
After production data is written, rollback requires a reviewed,
data-preserving recovery plan.
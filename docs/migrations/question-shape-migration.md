# Question-format migration

## Record

This record covers the temporary `question-shape-migration` cleanup: a
Root-only Admin button, its API routes, and the local CLI script for eagerly
converting legacy saved-game question shapes. The button, routes, and script
were removed on 2026-10-28 after the production and local conversions were
completed. The shared question engine, saved-data legacy converters in
`server/src/questions/legacy.ts`, and `canonicalJson` remain.

## Manual Neon cleanup

When the backup is no longer needed, run these statements in Neon:

```sql
DROP TABLE IF EXISTS question_shape_backup_20261028;
DROP TABLE IF EXISTS question_shape_control;
```

import type { App } from '../contracts/app.js';
import type { AppDatabase } from '../contracts/db.js';
import { AppError } from '../errors.js';
import { parsePathId } from '../input.js';

export function registerParentReportRoutes(app: App, db: AppDatabase) {
  const reports = () => {
    if (!db.parentReports) throw new AppError(503, 'PARENT_REPORTS_UNAVAILABLE', 'Family reports are temporarily unavailable.');
    return db.parentReports;
  };
  app.get('/api/v1/parent/reports', async c => c.json(await reports().read(c.get('family').id)));
  app.get('/api/v1/parent/reports/:profileId', async c => {
    const profileId = parsePathId(c.req.param('profileId'));
    const report = await reports().read(c.get('family').id);
    const child = report.children.find(child => child.id === profileId);
    if (!child) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Child profile not found.');
    return c.json(child);
  });
}

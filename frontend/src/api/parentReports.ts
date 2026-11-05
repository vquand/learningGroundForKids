import { coreRequest } from './core.ts';
import type { ParentReport } from '../../../server/src/parent-reports/contracts';
export type { ParentReport, ChildReport, GameReport, ReportAchievement } from '../../../server/src/parent-reports/contracts';
export const fetchParentReports = () => coreRequest<ParentReport>('/api/v1/parent/reports');

export const fetchParentContentItem = (id: string) => coreRequest<import('../types/parent').ParentContentItem>(`/api/v1/parent/content/${encodeURIComponent(id)}`);

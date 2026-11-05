import { lazy } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { ParentLayout } from './ParentLayout';
import { ParentDashboard, ParentChildReport, ParentAchievements } from './ParentReportViews';
import { ParentChildren, ParentAddChild, ParentLists, ParentSettings } from './ParentManagementPages';
import { ParentSchedulePage } from './ParentSchedulePage';
import { ParentFriends } from './ParentFriends';
import { ParentLessonManagement } from './ParentLessonManagement';
import { ParentLessonDetail } from './ParentLessonDetail';
import { ParentCalendarPage } from '../../pages/ParentCalendarPage';
import { MinikuPuzzleListPage } from '../miniku/MinikuPuzzleListPage';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
const LessonEditor = lazy(() => import('../../pages/ParentLessonEditorPage').then(module => ({ default: module.ParentLessonEditorPage })));

function LegacyLessonRoute({ create = false }: { create?: boolean }) {
  const { itemId } = useParams();
  const location = useLocation();
  return <Navigate replace to={`/parent/lists/exploring/${create ? 'new' : `${encodeURIComponent(itemId!)}/edit`}${location.search}`} />;
}
function ParentNotFound() {
  useUiLanguage();
  return <div className="parent-panel parent-empty"><h1>{uiText('Page not found')}</h1><p>{uiText('Choose a section from Parent Space navigation.')}</p><Link className="parent-button" to="/parent">{uiText('Back to dashboard')}</Link></div>;
}
function ParentMinikuRoute() {
  const location = useLocation();
  return <MinikuPuzzleListPage key={location.pathname + (location.pathname.endsWith('/new') ? location.search : '')} embedded routed />;
}
function ParentLessonEditorRoute() {
  const location = useLocation();
  return <LessonEditor key={location.pathname} />;
}
export function ParentRoutes() {
  return <Routes><Route element={<ParentLayout />}>
    <Route index element={<ParentDashboard />} />
    <Route path="children" element={<ParentChildren />} />
    <Route path="children/new" element={<ParentAddChild />} />
    <Route path="children/:profileId" element={<ParentChildReport />} />
    <Route path="children/:profileId/calendar" element={<ParentCalendarPage />} />
    <Route path="achievements" element={<ParentAchievements />} />
    <Route path="lists" element={<ParentLists />} />
    <Route path="lists/exploring" element={<ParentLessonManagement />} />
    <Route path="lists/exploring/new" element={<ParentLessonEditorRoute />} />
    <Route path="lists/exploring/:itemId" element={<ParentLessonDetail />} />
    <Route path="lists/exploring/:itemId/edit" element={<ParentLessonEditorRoute />} />
    <Route path="lists/miniku" element={<ParentMinikuRoute />} />
    <Route path="lists/miniku/new" element={<ParentMinikuRoute />} />
    <Route path="lists/miniku/:puzzleId/edit" element={<ParentMinikuRoute />} />
    <Route path="schedule" element={<ParentSchedulePage />} />
    <Route path="friends" element={<ParentFriends />} />
    <Route path="settings" element={<ParentSettings />} />
    <Route path="miniku" element={<Navigate replace to="/parent/lists/miniku" />} />
    <Route path="lessons" element={<Navigate replace to="/parent/lists/exploring" />} />
    <Route path="lessons/new" element={<LegacyLessonRoute create />} />
    <Route path="lessons/:itemId/edit" element={<LegacyLessonRoute />} />
    <Route path="*" element={<ParentNotFound />} />
  </Route></Routes>;
}

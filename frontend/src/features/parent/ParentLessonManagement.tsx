import { ParentSystemLessons, ParentCustomLessons } from './ParentLessonLists';
import { ParentLessonShareDialog } from './ParentLessonShareDialog';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { disableSystemLessons, fetchParentLessonCatalog, fetchParentShareTargets } from '../../api/parent';
import { familyQueryKey, familyScopedQuery } from '../../lib/familyQueries';
import { useFamilyStore } from '../../stores/familyStore';
import { useParentRequests } from '../../hooks/useParentRequests';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import type { ParentLessonSummary } from '../../types/parent';
const LESSONS_PAGE_SIZE = 10;

export function ParentLessonManagement() {
  useUiLanguage();
  const familyId = useFamilyStore(state => state.familyId);
  const queryClient = useQueryClient();
  const requests = useParentRequests();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [params, setParams] = useSearchParams();
  function setParam(key: string, value: string) {
    setParams(current => { const next = new URLSearchParams(current); if (value) next.set(key,value); else next.delete(key); if(key==='q'||key==='category') next.delete('page'); return next; });
  }
  const systemSearch = params.get("q") ?? "";
  const setSystemSearch = (value: string) => setParam("q",value);
  const systemCategory = params.get("category") ?? "";
  const setSystemCategory = (value: string) => setParam("category",value);
  const [selectedSystemIds, setSelectedSystemIds] = useState<string[]>([]);
  const systemLessonPage = Math.max(1, Math.floor(Number(params.get("page"))) || 1);
  const setSystemLessonPage = (value: number) => setParam("page",String(value));
  const customLessonPage = Math.max(1, Math.floor(Number(params.get("custom_page"))) || 1);
  const setCustomLessonPage = (value: number) => setParam("custom_page",String(value));
  const [shareLesson, setShareLesson] = useState<ParentLessonSummary | null>(null);
  const { data: lessonCatalog, isLoading: lessonCatalogLoading, error: catalogError, refetch: refetchCatalog } = useQuery({
    queryKey: familyQueryKey("parent-lesson-catalog", familyId),
    queryFn: familyScopedQuery(familyId, fetchParentLessonCatalog),
    enabled: Boolean(familyId),
  });
  const { data: shareTargets = [], isLoading: targetsLoading, error: targetsError } = useQuery({
    queryKey: familyQueryKey("parent-share-targets", familyId),
    queryFn: familyScopedQuery(familyId, fetchParentShareTargets),
    enabled: Boolean(familyId && shareLesson),
  });

  const filteredSystemLessons = useMemo(() => {
    const all = lessonCatalog?.system_lessons ?? [];
    const normalizedSearch = systemSearch.trim().toLowerCase();
    return all.filter((lesson) => {
      if (systemCategory && lesson.category !== systemCategory) return false;
      if (!normalizedSearch) return true;
      return lesson.title.toLowerCase().includes(normalizedSearch);
    });
  }, [lessonCatalog?.system_lessons, systemCategory, systemSearch]);

  const customLessons = lessonCatalog?.custom_lessons ?? [];
  const systemLessonPageCount = Math.max(1, Math.ceil(filteredSystemLessons.length / LESSONS_PAGE_SIZE));
  const customLessonPageCount = Math.max(1, Math.ceil(customLessons.length / LESSONS_PAGE_SIZE));
  const visibleSystemLessons = filteredSystemLessons.slice(
    (systemLessonPage - 1) * LESSONS_PAGE_SIZE,
    systemLessonPage * LESSONS_PAGE_SIZE,
  );
  const visibleCustomLessons = customLessons.slice(
    (customLessonPage - 1) * LESSONS_PAGE_SIZE,
    customLessonPage * LESSONS_PAGE_SIZE,
  );

  useEffect(() => {
    if(systemLessonPage>systemLessonPageCount && !lessonCatalogLoading) setParam('page',String(systemLessonPageCount));
    if(customLessonPage>customLessonPageCount && !lessonCatalogLoading) setParam('custom_page',String(customLessonPageCount));
  }, [systemLessonPage, systemLessonPageCount, customLessonPage, customLessonPageCount, lessonCatalogLoading]);
  async function refreshCatalog() {
    await Promise.all([queryClient.invalidateQueries({queryKey:familyQueryKey('parent-lesson-catalog',familyId)}),queryClient.invalidateQueries({queryKey:['items']})]);
  }
  async function disable(ids: string[], disabled: boolean) {
    await requests.run(() => disableSystemLessons(ids,disabled), {
      start:()=>{setBusy(true);setError('');},
      success:()=>{setSelectedSystemIds([]);void refreshCatalog();},
      error:e=>setError(e instanceof Error?e.message:'Could not update lessons'),
      finish:()=>setBusy(false),
    });
  }
  return <>
    {error && <p className="parent-alert" role="alert">{error}</p>}
    {catalogError && <p className="parent-alert" role="alert">{catalogError.message}</p>}
            <div className="parent-management">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1>{uiText("Exploring content")}</h1>
                  <p className="mt-1 text-sm text-gray-500">
                    {uiText("System lessons are on by default. Disable them for your family, and create custom lessons for your family or one child.")}
                  </p>
                </div>
                <Link
                  to="/parent/lists/exploring/new"
                  className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-100"
                >
                  {uiText("New Custom Lesson")}</Link>
              </div>

              {lessonCatalogLoading ? (
                <p className="mt-4 text-sm text-gray-500">{uiText("Loading lesson catalog...")}</p>
              ) : catalogError ? <button className="parent-button parent-button-quiet" onClick={()=>void refetchCatalog()}>{uiText('Try again')}</button> : (
                <div className="mt-6 space-y-8">
                  <ParentSystemLessons filteredSystemLessons={filteredSystemLessons} visibleSystemLessons={visibleSystemLessons}
                    selectedSystemIds={selectedSystemIds} setSelectedSystemIds={setSelectedSystemIds} busy={busy} disable={disable}
                    systemSearch={systemSearch} setSystemSearch={setSystemSearch} systemCategory={systemCategory} setSystemCategory={setSystemCategory}
                    systemLessonPage={systemLessonPage} systemLessonPageCount={systemLessonPageCount} setSystemLessonPage={setSystemLessonPage} pageSize={LESSONS_PAGE_SIZE} />
                  <ParentCustomLessons visibleCustomLessons={visibleCustomLessons} customLessons={customLessons} familyId={familyId}
                    customLessonPage={customLessonPage} customLessonPageCount={customLessonPageCount} setCustomLessonPage={setCustomLessonPage}
                    setShareLesson={setShareLesson} pageSize={LESSONS_PAGE_SIZE} />
                </div>
              )}
            </div>      {shareLesson && <ParentLessonShareDialog lesson={shareLesson} targets={shareTargets} loading={targetsLoading} targetError={targetsError?.message ?? null} onClose={()=>setShareLesson(null)} onSaved={()=>{setShareLesson(null);void refreshCatalog();}} />}
  </>;
}

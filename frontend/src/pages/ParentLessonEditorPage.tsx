import { useQueryClient } from '@tanstack/react-query';
import { useParentRequests } from '../hooks/useParentRequests';
import { useUiLanguage } from '../hooks/useUiLanguage';
import { uiText } from '../i18n/uiText';
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ItemForm } from "../components/admin/ItemForm";
import { createParentLesson, fetchParentLesson, updateParentLesson } from "../api/parent";
import { fetchProfiles } from "../api/profiles";
import { familyQueryKey, familyScopedQuery } from "../lib/familyQueries";
import { useFamilyStore } from "../stores/familyStore";
import type { AdminItemFormData } from "../types/admin";
import type { ProfileWithStats } from "../types/profile";

type EditorMode = "create" | "edit";

export function ParentLessonEditorPage() {
  useUiLanguage();
  const navigate = useNavigate();
  const requests = useParentRequests();
  const cache = useQueryClient();
  const location = useLocation();
  const { itemId } = useParams<{ itemId: string }>();
  const mode: EditorMode = itemId ? "edit" : "create";
  const familyId = useFamilyStore((state) => state.familyId);
  const sessionGeneration = useFamilyStore((state) => state.sessionGeneration);

  const [formSource, setFormSource] = useState<{ key: string; data: Partial<AdminItemFormData> } | null>(null);
  const editorKey = mode === "create" ? `create:${location.key}` : `${familyId}:${sessionGeneration}:${itemId}`;
  const initialData = formSource?.key === editorKey ? formSource.data : undefined;
  const [profiles, setProfiles] = useState<ProfileWithStats[]>([]);
  const [targetScope, setTargetScope] = useState<"family" | "profile">("family");
  const [targetProfileId, setTargetProfileId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProfiles([]);
    setTargetProfileId("");
    if (!familyId) return;

    let active = true;
    void familyScopedQuery(familyId, fetchProfiles)()
      .then((data) => {
        if (!active) return;
        setProfiles(data);
        setTargetProfileId((current) => current || data[0]?.id || "");
      })
      .catch((err) => {
        if (active && err instanceof Error && err.name !== "InactiveFamilySessionError") {
          setError(err.message);
        }
      });

    return () => {
      active = false;
    };
  }, [familyId, sessionGeneration]);

  useEffect(() => {
    if (mode !== "edit" || !itemId) return;
    if (!familyId) return;
    let active = true;
    setLoading(true);
    setError(null);
    void familyScopedQuery(familyId, () => fetchParentLesson(itemId))()
      .then((detail) => {
        if (!active) return;
        const mapped: Partial<AdminItemFormData> = {
          category: detail.category,
          latitude: detail.latitude,
          longitude: detail.longitude,
          country_code: detail.country_code ?? undefined,
          icon_slug: detail.icon_slug ?? undefined,
          is_published: detail.is_published,
          recipe: detail.recipe ?? undefined,
          location_desc: detail.location_desc ?? undefined,
          fun_facts: detail.fun_facts ?? undefined,
          audio_urls: detail.audio_urls ?? undefined,
          youtube_url: detail.youtube_url ?? undefined,
          trailer_url: detail.trailer_url ?? undefined,
          characters: detail.characters ?? undefined,
          start_year: detail.start_year ?? undefined,
          end_year: detail.end_year ?? undefined,
          time_precision: detail.time_precision ?? undefined,
          released_date: detail.released_date ?? undefined,
          rich_fields: detail.rich_fields ?? undefined,
          franchise_id: detail.franchise_id ?? undefined,
          quiz_required: detail.quiz_required ?? true,
        };
        for (const translation of detail.translations) {
          const lang = translation.lang;
          if (lang === "en") {
            mapped.title_en = translation.title;
            mapped.description_en = translation.description ?? undefined;
            mapped.history_en = translation.history ?? undefined;
          } else if (lang === "vi") {
            mapped.title_vi = translation.title;
            mapped.description_vi = translation.description ?? undefined;
            mapped.history_vi = translation.history ?? undefined;
          }
        }
        setFormSource({ key: `${familyId}:${sessionGeneration}:${itemId}`, data: mapped });
      })
      .catch((err) => {
        if (active && err instanceof Error && err.name !== "InactiveFamilySessionError") {
          setError(err.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [familyId, itemId, mode, sessionGeneration]);

  const modeLabel = useMemo(
    () => (mode === "create" ? "Create Parent Lesson" : "Edit Parent Lesson"),
    [mode],
  );

  async function handleSubmit(data: AdminItemFormData) {
    await requests.run(async isCurrent=>{
      if(mode==='create') await createParentLesson({...data,target_scope:targetScope,target_profile_id:targetScope==='profile'?targetProfileId:undefined});
      else if(itemId) await updateParentLesson(itemId,data);
      if(isCurrent()) await Promise.all([
        cache.invalidateQueries({queryKey:familyQueryKey('parent-lesson-catalog',familyId),refetchType:'all'}),
        cache.invalidateQueries({queryKey:familyQueryKey('parent-lesson',familyId,itemId)}),
      ]);
    },{
      start:()=>{setLoading(true);setError(null);},success:()=>navigate('/parent/lists/exploring'),
      error:err=>setError(err instanceof Error?err.message:'Failed to save lesson'),finish:()=>setLoading(false),
    });
  }

  return (
    <div className="parent-editor">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{uiText(modeLabel)}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {uiText("Create family-only lessons or target one child directly.")}</p>
          </div>
          <Link to="/parent/lists/exploring" className="text-sm text-blue-600 hover:underline">
            ← {uiText("Back to content list")}</Link>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {mode === "create" && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800">{uiText("Who gets this lesson first?")}</h2>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setTargetScope("family")}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  targetScope === "family"
                    ? "bg-gray-900 text-white"
                    : "border border-gray-300 bg-white text-gray-700"
                }`}
              >
                {uiText("Entire family")}</button>
              <button
                type="button"
                onClick={() => setTargetScope("profile")}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  targetScope === "profile"
                    ? "bg-gray-900 text-white"
                    : "border border-gray-300 bg-white text-gray-700"
                }`}
              >
                {uiText("One child")}</button>
            </div>

            {targetScope === "profile" && (
              <label className="mt-4 block">
                <span className="mb-1 block text-sm font-medium text-gray-700">{uiText("Child")}</span>
                <select
                  value={targetProfileId}
                  onChange={(event) => setTargetProfileId(event.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
                >
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

        {mode === "edit" && !initialData ? (
          <p className="text-gray-500">{error ? uiText("Lesson could not be loaded.") : uiText("Loading lesson...")}</p>
        ) : (
          <ItemForm
            key={editorKey}
            initialData={initialData}
            onSubmit={handleSubmit}
            submitLabel={mode === "create" ? uiText("Create Lesson") : uiText("Save Changes")}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}

export default ParentLessonEditorPage;

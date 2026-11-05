import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
/**
 * Admin quiz question editor for an item.
 * Displays as a collapsible section at the bottom of the item editor.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sessionQueryKey } from "../../lib/familyQueries";
import { useFamilyStore } from "../../stores/familyStore";
import { coreRequest } from "../../api/core";

const QUESTION_TYPES = ["yes_no", "abc", "abcd", "multi"] as const;
type QuestionType = (typeof QUESTION_TYPES)[number];

interface AdminQuestion {
  id: string;
  item_id: string;
  question_group_id: string | null;
  lang: string;
  question: string;
  question_type: QuestionType;
  options: string[];
  correct_answers: number[];
  sort_order: number;
  is_active: boolean;
}

interface AdminQuizEditorProps {
  itemId: string;
  quizRequired?: boolean;
  onToggleQuizRequired?: (value: boolean) => void;
}

const QUIZ_EDITOR_AVAILABLE = true;
const MIGRATION_MESSAGE = "Quiz authoring is temporarily unavailable while its Render API is being migrated.";

async function fetchAdminQuestions(itemId: string): Promise<AdminQuestion[]> {
  return coreRequest<AdminQuestion[]>(`/api/v1/admin/items/${encodeURIComponent(itemId)}/quiz`);
}

async function deleteQuestion(qId: string): Promise<void> {
  return coreRequest<void>(`/api/v1/admin/quiz/questions/${encodeURIComponent(qId)}`, { method: "DELETE" });
}

async function createQuestion(
  itemId: string,
  data: Omit<AdminQuestion, "id" | "item_id">,
): Promise<AdminQuestion> {
  return coreRequest<AdminQuestion>(`/api/v1/admin/items/${encodeURIComponent(itemId)}/quiz`, {
    method: "POST", body: JSON.stringify(data),
  });
}

async function generateQuizAI(_itemId: string): Promise<{ draft: unknown[] }> {
  throw new Error(MIGRATION_MESSAGE);
}

const TYPE_LABELS: Record<string, string> = {
  yes_no: "YES/NO",
  abc: "ABC",
  abcd: "ABCD",
  multi: "MULTI",
};

const inputCls =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500";

interface NewQuestionForm {
  lang: string;
  question: string;
  question_type: QuestionType;
  options: string[];
  correct_answers: number[];
}

const DEFAULT_NEW: NewQuestionForm = {
  lang: "en",
  question: "",
  question_type: "abcd",
  options: ["", "", "", ""],
  correct_answers: [],
};

function optionsForType(type: QuestionType): string[] {
  if (type === "yes_no") return ["Yes", "No"];
  if (type === "abc") return ["", "", ""];
  if (type === "abcd") return ["", "", "", ""];
  return ["", "", "", ""];
}

export function AdminQuizEditor({ itemId, quizRequired = true, onToggleQuizRequired }: AdminQuizEditorProps) {
  useUiLanguage();
  const qc = useQueryClient();
  const sessionGeneration = useFamilyStore((state) => state.sessionGeneration);
  const [open, setOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<NewQuestionForm>({ ...DEFAULT_NEW });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiDraft, setAiDraft] = useState<unknown[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: questions = [], isLoading } = useQuery({
    queryKey: sessionQueryKey("admin-quiz", sessionGeneration, itemId),
    queryFn: () => fetchAdminQuestions(itemId),
    enabled: open && QUIZ_EDITOR_AVAILABLE,
  });

  const deleteMut = useMutation({
    mutationFn: (qId: string) => deleteQuestion(qId),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionQueryKey("admin-quiz", sessionGeneration, itemId) }),
  });

  const createMut = useMutation({
    mutationFn: (data: Omit<AdminQuestion, "id" | "item_id">) =>
      createQuestion(itemId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sessionQueryKey("admin-quiz", sessionGeneration, itemId) });
      setShowAddForm(false);
      setForm({ ...DEFAULT_NEW });
      setFormError(null);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  async function handleAIGenerate() {
    setAiLoading(true);
    setAiError(null);
    setAiDraft(null);
    try {
      const result = await generateQuizAI(itemId);
      setAiDraft(result.draft);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setAiLoading(false);
    }
  }

  async function activateAIDraft() {
    if (!aiDraft) return;
    let saved = 0;
    for (const group of aiDraft as Record<string, unknown>[]) {
      const groupId = crypto.randomUUID();
      for (const langKey of ["en", "vi"]) {
        const q = (group as Record<string, unknown>)[langKey] as Record<string, unknown> | undefined;
        if (!q) continue;
        await createQuestion(itemId, {
          question_group_id: groupId,
          lang: langKey,
          question: String(q.question ?? ""),
          question_type: String(q.question_type ?? "abc") as QuestionType,
          options: (q.options as string[]) ?? [],
          correct_answers: (q.correct_answers as number[]) ?? [],
          sort_order: saved,
          is_active: true,
        }).catch(() => null); // swallow per-question errors
      }
      saved++;
    }
    await qc.invalidateQueries({ queryKey: sessionQueryKey("admin-quiz", sessionGeneration, itemId) });
    setAiDraft(null);
  }

  function handleTypeChange(type: QuestionType) {
    setForm((f) => ({
      ...f,
      question_type: type,
      options: type === "yes_no" ? ["Yes", "No"] : optionsForType(type),
      correct_answers: [],
    }));
  }

  function handleOptionChange(idx: number, value: string) {
    setForm((f) => {
      const opts = [...f.options];
      opts[idx] = value;
      return { ...f, options: opts };
    });
  }

  function toggleCorrect(idx: number) {
    setForm((f) => {
      const isMulti = f.question_type === "multi";
      if (isMulti) {
        const next = f.correct_answers.includes(idx)
          ? f.correct_answers.filter((i) => i !== idx)
          : [...f.correct_answers, idx];
        return { ...f, correct_answers: next };
      }
      return { ...f, correct_answers: [idx] };
    });
  }

  function handleAddQuestion() {
    if (!form.question.trim()) {
      setFormError("Question text is required");
      return;
    }
    if (form.options.some((o) => !o.trim())) {
      setFormError("All options must be filled in");
      return;
    }
    if (form.correct_answers.length === 0) {
      setFormError("Select at least one correct answer");
      return;
    }
    setFormError(null);
    createMut.mutate({
      question_group_id: null,
      lang: form.lang,
      question: form.question,
      question_type: form.question_type,
      options: form.options.filter((o) => o.trim()),
      correct_answers: form.correct_answers,
      sort_order: questions.filter((q) => q.lang === form.lang).length,
      is_active: true,
    });
  }

  const activeEn = questions.filter((q) => q.lang === "en" && q.is_active);
  const activeVi = questions.filter((q) => q.lang === "vi" && q.is_active);

  if (!QUIZ_EDITOR_AVAILABLE) {
    return <p role="status" className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{MIGRATION_MESSAGE}</p>;
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 mt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <span className="font-semibold text-gray-800">
          {uiText("🎯 Quiz Questions")}{" "}
          {questions.length > 0 && (
            <span className="ml-2 text-xs text-gray-400 font-normal">
              {uiText("EN:")}{activeEn.length} {uiText(" · VI: ")}{activeVi.length}
            </span>
          )}
        </span>
        <span className="text-gray-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
          {/* quiz_required toggle — shown only when item has quiz questions */}
          {questions.length > 0 && onToggleQuizRequired && (
            <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <div>
                <div className="font-semibold text-sm text-amber-900">{uiText("Require quiz to complete item")}</div>
                <div className="text-xs text-amber-700">{uiText("When on, children must pass the quiz before this item counts as done")}</div>
              </div>
              <button
                type="button"
                onClick={() => onToggleQuizRequired(!quizRequired)}
                className={`w-12 h-7 rounded-full transition-colors relative ${
                  quizRequired ? 'bg-amber-400' : 'bg-gray-300'
                }`}
              >
                <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  quizRequired ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          )}

          {/* AI Generate */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleAIGenerate}
              disabled={aiLoading}
              className="rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
            >
              {aiLoading ? uiText("Generating…") : uiText("🤖 Generate Quiz with AI")}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(true);
                setForm({ ...DEFAULT_NEW });
              }}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              {uiText("+ Add Question")}</button>
            {aiError && (
              <span className="text-sm text-red-600">{aiError}</span>
            )}
          </div>

          {/* AI Draft Preview */}
          {aiDraft && aiDraft.length > 0 && (
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <p className="text-sm font-semibold text-purple-800 mb-3">
                {uiText("AI Generated")}{(aiDraft as unknown[]).length} {uiText("question(s) — review and activate:")}</p>
              <div className="space-y-2 max-h-80 overflow-y-auto mb-3">
                {(aiDraft as Record<string, unknown>[]).map((group, i) => {
                  const en = group.en as Record<string, unknown> | undefined;
                  return (
                    <div key={i} className="bg-white rounded p-3 text-sm border border-purple-100">
                      <span className="font-medium text-purple-700">
                        [{TYPE_LABELS[String(en?.question_type ?? "abc")] ?? "?"}]
                      </span>{" "}
                      {String(en?.question ?? "")}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={activateAIDraft}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
                >
                  {uiText("Activate All")}</button>
                <button
                  type="button"
                  onClick={() => setAiDraft(null)}
                  className="rounded-md bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300"
                >
                  {uiText("Discard")}</button>
              </div>
            </div>
          )}

          {/* Add Question Form */}
          {showAddForm && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3">
              <p className="text-sm font-semibold text-gray-700">{uiText("New Question")}</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{uiText("Language")}</label>
                  <select
                    value={form.lang}
                    onChange={(e) => setForm((f) => ({ ...f, lang: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="en">{uiText("English")}</option>
                    <option value="vi">{uiText("Vietnamese")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{uiText("Type")}</label>
                  <select
                    value={form.question_type}
                    onChange={(e) => handleTypeChange(e.target.value as QuestionType)}
                    className={inputCls}
                  >
                    {QUESTION_TYPES.map((t) => (
                      <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">{uiText("Question")}</label>
                <textarea
                  value={form.question}
                  onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                  rows={2}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {uiText("Options")}{" "}
                  <span className="text-gray-400">{uiText("(click ✓ to mark correct)")}</span>
                </label>
                <div className="space-y-1">
                  {form.options.map((opt, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <button
                        type="button"
                        onClick={() => toggleCorrect(idx)}
                        className={`w-7 h-7 rounded-full text-xs font-bold shrink-0 border-2 transition-colors ${
                          form.correct_answers.includes(idx)
                            ? "bg-green-500 text-white border-green-500"
                            : "bg-white text-gray-400 border-gray-300"
                        }`}
                        aria-label={`Mark option ${idx + 1} correct`}
                      >
                        ✓
                      </button>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                        disabled={form.question_type === "yes_no"}
                        placeholder={`Option ${idx + 1}`}
                        className={`${inputCls} flex-1`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {formError && (
                <p className="text-sm text-red-600">{formError}</p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddQuestion}
                  disabled={createMut.isPending}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {createMut.isPending ? uiText("Saving…") : uiText("Save Question")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="rounded-md bg-gray-200 px-4 py-2 text-sm text-gray-700"
                >
                  {uiText("Cancel")}</button>
              </div>
            </div>
          )}

          {/* Question list */}
          {isLoading ? (
            <p className="text-sm text-gray-500">{uiText("Loading questions…")}</p>
          ) : questions.length === 0 ? (
            <p className="text-sm text-gray-400 italic">
              {uiText("No quiz questions yet. Generate with AI or add manually.")}</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  <th className="py-2 pr-3">{uiText("Lang")}</th>
                  <th className="py-2 pr-3">{uiText("Type")}</th>
                  <th className="py-2 pr-3">{uiText("Question")}</th>
                  <th className="py-2 pr-3">{uiText("Active")}</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => (
                  <tr key={q.id} className={`border-b ${q.is_active ? "" : "opacity-40"}`}>
                    <td className="py-2 pr-3 font-mono text-xs uppercase">{q.lang}</td>
                    <td className="py-2 pr-3 text-xs">{TYPE_LABELS[q.question_type] ?? q.question_type}</td>
                    <td className="py-2 pr-3 text-gray-700 max-w-xs truncate">{q.question}</td>
                    <td className="py-2 pr-3">
                      {q.is_active ? "✅" : "❌"}
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => deleteMut.mutate(q.id)}
                        disabled={deleteMut.isPending}
                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                      >
                        {uiText("Deactivate")}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

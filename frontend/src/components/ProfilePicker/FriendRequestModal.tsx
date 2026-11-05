import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import "./friendDialog.css";
import { useEffect, useMemo, useState } from "react";
import type { ProfileWithStats } from "../../types/profile";
import type { CreateFriendRequestInput, FriendScope } from "../../types/social";

interface FriendRequestModalProps {
  profiles: ProfileWithStats[];
  onClose: () => void;
  onSubmit: (input: CreateFriendRequestInput) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
  requireQuiz?: boolean;
}

interface MathQuestion {
  id: string;
  prompt: string;
  answer: string;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildQuestion(index: number): MathQuestion {
  const division = Math.random() < 0.4;
  if (division) {
    const divisor = randomInt(2, 12);
    const quotient = randomInt(2, 12);
    return {
      id: `q-${index}`,
      prompt: `${divisor * quotient} ÷ ${divisor} = ?`,
      answer: String(quotient),
    };
  }

  const left = randomInt(3, 12);
  const right = randomInt(3, 12);
  return {
    id: `q-${index}`,
    prompt: `${left} × ${right} = ?`,
    answer: String(left * right),
  };
}

function buildQuiz(): MathQuestion[] {
  return [buildQuestion(1), buildQuestion(2), buildQuestion(3)];
}

export function FriendRequestModal({
  profiles,
  onClose,
  onSubmit,
  isSubmitting,
  errorMessage,
  requireQuiz = true,
}: FriendRequestModalProps) {
  useUiLanguage();
  const [requestingScope, setRequestingScope] = useState<FriendScope>("profile");
  const [requestingProfileId, setRequestingProfileId] = useState<string>(
    profiles[0]?.id ?? "",
  );
  const [targetScope, setTargetScope] = useState<FriendScope>("profile");
  const [targetCode, setTargetCode] = useState("");
  const [quizVersion, setQuizVersion] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizPassed, setQuizPassed] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);

  const quiz = useMemo(() => buildQuiz(), [quizVersion]);

  useEffect(() => {
    if (!profiles.some((profile) => profile.id === requestingProfileId)) {
      setRequestingProfileId(profiles[0]?.id ?? "");
    }
  }, [profiles, requestingProfileId]);

  useEffect(() => {
    if (profiles.length === 0) {
      setRequestingScope("family");
    }
  }, [profiles.length]);

  function resetQuiz() {
    setQuizAnswers({});
    setQuizPassed(false);
    setQuizError(null);
    setQuizVersion((prev) => prev + 1);
  }

  function verifyQuiz() {
    const allCorrect = quiz.every(
      (question) =>
        quizAnswers[question.id]?.trim() === question.answer,
    );

    if (!allCorrect) {
      setQuizError("Not quite. Try a fresh set of math questions.");
      setQuizPassed(false);
      setQuizVersion((prev) => prev + 1);
      setQuizAnswers({});
      return;
    }

    setQuizError(null);
    setQuizPassed(true);
  }

  function handleSubmit() {
    if (requestingScope === "profile" && !requestingProfileId) return;
    if (requireQuiz && !quizPassed) return;
    if (!targetCode.trim()) return;

    onSubmit({
      requestingScope,
      requestingProfileId:
        requestingScope === "profile" ? requestingProfileId : null,
      targetCode,
      targetScope,
    });
  }

  return <div className="friend-dialog-overlay">
    <div className="friend-dialog" role="dialog" aria-modal="true" aria-labelledby="add-friend-title">
      <header className="friend-dialog-header"><h2 id="add-friend-title">{uiText("Add friend")}</h2><button type="button" onClick={onClose} aria-label={uiText("Close add friend dialog")}>×</button></header>
      <div className="friend-dialog-body">
        <div className="friend-dialog-scopes">
          <section className="friend-dialog-section"><h3>{uiText("From")}</h3>
            <div className="friend-scope-choices">{(["profile", "family"] as const).map(scope => <button type="button" key={scope} disabled={scope === "profile" && !profiles.length} aria-pressed={requestingScope === scope} onClick={() => setRequestingScope(scope)}>{scope === "profile" ? uiText("One kid") : uiText("Your family")}</button>)}</div>
            {requestingScope === "profile" && <label className="friend-profile-select"><span className="sr-only">{uiText("Your kid")}</span><select value={requestingProfileId} onChange={event => setRequestingProfileId(event.target.value)}>{profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.emoji} {profile.name}</option>)}</select></label>}
          </section>
          <section className="friend-dialog-section"><h3>{uiText("To")}</h3>
            <div className="friend-scope-choices">{(["profile", "family"] as const).map(scope => <button type="button" key={scope} aria-pressed={targetScope === scope} onClick={() => setTargetScope(scope)}>{scope === "profile" ? uiText("One kid") : uiText("Their family")}</button>)}</div>
          </section>
          <p className="friend-dialog-note">{uiText("Family includes current and future kids.")}</p>
        </div>
        <div className="friend-dialog-details">
          {requireQuiz && <section className="friend-dialog-section friend-quiz">
            <div className="friend-quiz-header"><h3>{uiText("Quick math")}</h3><button type="button" onClick={resetQuiz}>{uiText("New quiz")}</button></div>
            <div className="friend-quiz-questions">{quiz.map(question => <label key={question.id}><span>{question.prompt}</span><input type="text" inputMode="numeric" value={quizAnswers[question.id] ?? ""} onChange={event => { setQuizAnswers(prev => ({ ...prev, [question.id]: event.target.value.replace(/[^\d-]/g, "") })); setQuizPassed(false); }} aria-label={`Answer for ${question.prompt}`} /></label>)}</div>
            <div className="friend-quiz-check"><button type="button" onClick={verifyQuiz}>{uiText("Check answers")}</button>{quizPassed && <span role="status">{uiText("✓ Ready")}</span>}</div>
            {quizError && <p role="alert" className="friend-dialog-error">{quizError}</p>}
          </section>}
          <label className="friend-code-label">{uiText("Friend’s code")}<input type="text" maxLength={10} value={targetCode} onChange={event => setTargetCode(event.target.value.toUpperCase())} placeholder="ABC-1234" /></label>
        </div>
      </div>
      {errorMessage && <p role="alert" className="friend-dialog-error">{errorMessage}</p>}
      <footer className="friend-dialog-footer"><button type="button" onClick={onClose}>{uiText("Cancel")}</button><button type="button" onClick={handleSubmit} disabled={isSubmitting || (requireQuiz && !quizPassed) || !targetCode.trim() || (requestingScope === "profile" && !requestingProfileId)}>{isSubmitting ? uiText("Sending…") : uiText("Send request")}</button></footer>
    </div>
  </div>;
}

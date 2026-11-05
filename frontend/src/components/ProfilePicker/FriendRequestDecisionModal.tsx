import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import "./friendDialog.css";
import { useMemo, useState } from "react";
import type { FriendRequest } from "../../types/social";

interface FriendRequestDecisionModalProps {
  request: FriendRequest;
  onClose: () => void;
  onAccept: () => void;
  onReject: () => void;
  isSubmitting: boolean;
  errorMessage: string | null;
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
      id: `accept-${index}`,
      prompt: `${divisor * quotient} ÷ ${divisor} = ?`,
      answer: String(quotient),
    };
  }

  const left = randomInt(3, 12);
  const right = randomInt(3, 12);
  return {
    id: `accept-${index}`,
    prompt: `${left} × ${right} = ?`,
    answer: String(left * right),
  };
}

function buildQuiz(): MathQuestion[] {
  return [buildQuestion(1), buildQuestion(2), buildQuestion(3)];
}

export function FriendRequestDecisionModal({
  request,
  onClose,
  onAccept,
  onReject,
  isSubmitting,
  errorMessage,
}: FriendRequestDecisionModalProps) {
  useUiLanguage();
  const [quizVersion, setQuizVersion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quizError, setQuizError] = useState<string | null>(null);
  const quiz = useMemo(() => buildQuiz(), [quizVersion]);

  function verifyAndAccept() {
    const allCorrect = quiz.every(
      (question) => answers[question.id]?.trim() === question.answer,
    );

    if (!allCorrect) {
      setQuizError("Not quite. A new quiz is ready.");
      setAnswers({});
      setQuizVersion((prev) => prev + 1);
      return;
    }

    setQuizError(null);
    onAccept();
  }

  return <div className="friend-dialog-overlay">
    <div className="friend-dialog" role="dialog" aria-modal="true" aria-labelledby="accept-friend-title">
      <header className="friend-dialog-header"><h2 id="accept-friend-title">{uiText("Friend request")}</h2><button type="button" onClick={onClose} aria-label={uiText("Close friend request dialog")}>×</button></header>
      <div className="friend-dialog-body">
        <section className="friend-dialog-section"><p>{request.requester_message}</p></section>
        <section className="friend-dialog-section friend-quiz">
          <div className="friend-quiz-header"><h3>{uiText("Quick math")}</h3><button type="button" onClick={() => { setAnswers({}); setQuizError(null); setQuizVersion(prev => prev + 1); }}>{uiText("New quiz")}</button></div>
          <div className="friend-quiz-questions">{quiz.map(question => <label key={question.id}><span>{question.prompt}</span><input type="text" inputMode="numeric" value={answers[question.id] ?? ""} onChange={event => setAnswers(prev => ({ ...prev, [question.id]: event.target.value.replace(/[^\d-]/g, "") }))} aria-label={`Answer for ${question.prompt}`} /></label>)}</div>
          {quizError && <p role="alert" className="friend-dialog-error">{quizError}</p>}
        </section>
      </div>
      {errorMessage && <p role="alert" className="friend-dialog-error">{errorMessage}</p>}
      <footer className="friend-dialog-footer"><button type="button" disabled={isSubmitting} onClick={onReject}>{uiText("Decline")}</button><button type="button" disabled={isSubmitting} onClick={verifyAndAccept}>{isSubmitting ? uiText("Working…") : uiText("Accept")}</button></footer>
    </div>
  </div>;
}

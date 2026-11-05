import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { MathWallScene } from '../../src/features/math-quiz-wall/MathWallScene';
import type { MathSession, WallStyle } from '../../src/api/mathWall';
import { equationCard } from '../../../server/src/questions/equation';
import { makeQuestion } from '../../../server/src/questions/identity';
import { publicQuestion } from '../../../server/src/questions/projection';
import '../../src/app.css';
import '../../src/features/math-quiz-wall/mathWall.css';
import '../../src/features/math-quiz-wall/mathWallTheme.css';

type Preview = { wall: WallStyle; lane: number; result: 'pass' | 'splash' | null };
declare global { interface Window { showWall: (preview: Preview) => void } }
function Harness() {
  const [preview, setPreview] = useState<Preview>({ wall: 'brick', lane: 1, result: null });
  useEffect(() => { window.showWall = setPreview; }, []);
  const question = publicQuestion(makeQuestion(equationCard('add-1d', [3, 4], ['+']), 'wall-opening-preview', { mode: 'choice', choices: ['6', '7', '8'], correct: 1 }));
  const session: MathSession = { animal: 'highland', language: 'en', wall: preview.wall, phase: preview.result ? 'resolved' : 'playing', pausedFrom: 'playing',
    remaining: 0, deadline: preview.result ? 3100 : 1500, lane: preview.result === 'splash' ? (preview.lane + 1) % 3 : preview.lane,
    wave: 1, score: preview.result === 'pass' ? 1 : 0, difficulty: 'easy', question, result: preview.result, correctLane: preview.result ? preview.lane : null };
  return <main className="math-page is-playing"><div className="math-play-layout"><section className="math-question"><h1>3 + 4 = ?</h1></section><div className="math-stage"><MathWallScene animal="highland" wall={preview.wall} session={session} now={1000} onLane={lane => setPreview(value => ({ ...value, lane }))} /></div></div></main>;
}
createRoot(document.getElementById('root')!).render(<Harness />);

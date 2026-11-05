// Local visual regression fixture. No API, account, progress or reward writes.
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {RacingScene} from '../../src/features/animal-racing/RacingScene';
import {RacingQuiz} from '../../src/features/animal-racing/RacingQuiz';
import {act, emptyProgress, publicState, startRace} from '../../../server/src/road-racing/game';
import {makeQuestion, QUESTION_ANIMALS} from '../../../server/src/road-racing/questions';
import '../../src/features/animal-racing/racing.css';

function Fixture() {
  const [progress,setProgress]=useState(()=>{
    const p=startRace(emptyProgress(),{animal:'capybara',difficulty:'easy',language:'en'},Date.now(),()=>0,'visual-test');
    p.race!.question=makeQuestion('en',2,QUESTION_ANIMALS.filter(a=>a!=='horse').map(a=>`picture:${a}`),()=>0);
    p.race!.sequence=2;p.race!.seen=[p.race!.question.key];p.race!.questionAt-=200;
    return p;
  });
  const [receivedAt,setReceivedAt]=useState(performance.now());
  function boosts(count:number) {
    const p=structuredClone(progress),now=Date.now();
    p.race!.updatedAt=now;p.race!.lastSeen=now;p.race!.startedAt=now;
    p.race!.stacks=Array.from({length:count},(_,i)=>now+1000+i*300);
    setProgress(p);setReceivedAt(performance.now());
  }
  function slowdowns(count:number) {
    const p=structuredClone(progress),now=Date.now();
    p.race!.updatedAt=now;p.race!.lastSeen=now;p.race!.startedAt=now;
    p.race!.stacks=Array.from({length:Math.max(0,3-count)},(_,i)=>now+1000+i*300);
    p.race!.slows=Array.from({length:count},(_,i)=>now+1000+i*300);
    setProgress(p);setReceivedAt(performance.now());
  }
  const race=publicState(progress,Date.now()).race!;
  return <div className="racing-page">
    <header style={{height:64,display:'flex',gap:8,alignItems:'center',padding:8}}>
      {[0,1,2,3].map(n=><button key={n} onClick={()=>boosts(n)}>{n} boosts</button>)}
      {[0,1,2,3].map(n=><button key={`slow-${n}`} onClick={()=>slowdowns(n)}>{n} slowdowns</button>)}
      <button onClick={()=>{
        const p=structuredClone(progress),now=Date.now();p.race!.language=p.race!.language==='en'?'vi':'en';
        p.race!.question=makeQuestion(p.race!.language,2,QUESTION_ANIMALS.filter(a=>a!=='horse').map(a=>`picture:${a}`),()=>0);
        p.race!.sequence=2;p.race!.seen=[p.race!.question.key];
        p.race!.feedback=null;p.race!.questionAt=now-200;p.race!.lastSeen=now;
        setProgress(p);
      }}>Horse language</button>
    </header>
    <main className="racing-game"><RacingScene race={race} receivedAt={receivedAt}/>
      <RacingQuiz race={race} busy={false} answer={choice=>{
        const p=structuredClone(progress);p.race!.lastSeen=Date.now();
        setProgress(act(p,{type:'answer',questionId:race.question.id,choice},Date.now(),()=>0));
        setReceivedAt(performance.now());
      }}/>
    </main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);

import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';

test('every bilingual picture card renders its animal and includes its graded answer',async()=>{
  const server=await createServer({configFile:false,root:fileURLToPath(new URL('..',import.meta.url)),plugins:[react()],server:{middlewareMode:true,hmr:false,ws:false,watch:null},optimizeDeps:{noDiscovery:true}});
  try{
    const {RacingQuestion}=await server.ssrLoadModule('/src/features/animal-racing/RacingQuiz.tsx');
    const {publicQuestion}=await server.ssrLoadModule('../server/src/questions/projection.ts');
    const {makeQuestion,QUESTION_ANIMALS,QUESTION_ANIMAL_NAMES,questionAnimalImage}=await server.ssrLoadModule('../server/src/road-racing/questions.ts');
    for(const language of ['en','vi'])for(const animal of QUESTION_ANIMALS){
      const raw=makeQuestion(language,2,QUESTION_ANIMALS.filter((a:string)=>a!==animal).map((a:string)=>`picture:${a}`),()=>0);
      const q=publicQuestion(raw);
      assert.equal(q.card.kind,'picture');
      assert.equal(q.card.subject,animal);
      assert.equal(raw.response.mode,'choice');
      assert.equal(raw.response.choices[raw.response.correct],QUESTION_ANIMAL_NAMES[animal][language==='vi'?1:0]);
      assert.equal(new Set(q.response.choices).size,3);
      for(const compact of [false,true]){
        const html=renderToStaticMarkup(createElement(RacingQuestion,{question:q,language,compact}));
        const source=questionAnimalImage(animal);
        if(source){
          assert.ok(html.includes(`src="${source}"`),`${language} ${animal}`);
          assert.ok(html.includes('class="racing-art racing-question-animal"'));
          assert.ok(!html.includes('<image'),'standalone pictures use a fresh native image');
        }else assert.ok(html.includes(`/run-sprites/${animal}.png`));
      }
    }
  }finally{await server.close();}
});

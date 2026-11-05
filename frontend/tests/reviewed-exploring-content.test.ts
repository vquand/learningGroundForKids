import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {isPlaceholderText} from '../scripts/catalog-content-review-lib.mjs';
import {reviewCatalogPublication} from '../scripts/catalog-publication-review-lib.mjs';
import {isPlaceholderQuizQuestion} from '../../server/src/quiz-content-policy.mjs';

test('the confirmed 30-item batch contains only the reviewed bilingual lessons and practice', async()=>{
  const review=JSON.parse(await readFile(new URL('../../docs/content-review/2026-10-23-exploring-30-draft.json',import.meta.url),'utf8'));
  const catalog=(await Promise.all(['legacy','generated','expanded'].map(async name=>JSON.parse(await readFile(new URL(`../data/${name}-catalog.json`,import.meta.url),'utf8'))))).flat();
  const key=(item:any)=>`${item.category}|${item.latitude}|${item.longitude}|${item.translations.find((t:any)=>t.lang==='en').title}`;
  const byKey=new Map(catalog.map((item:any)=>[key(item),item]));
  const approved=catalog.filter((item:any)=>item.content_review?.batch==='exploring-30-2026-10-23');
  assert.equal(approved.length,30);
  const queue=JSON.parse(await readFile(new URL('../data/catalog-publication-review.json',import.meta.url),'utf8'));
  for(const draft of review.items){
    const item=byKey.get(draft.item_key)!;
    assert.ok(item,draft.item_key);assert.equal(item.is_published,true);
    assert.equal(reviewCatalogPublication(item).reason,null);
    assert.equal(queue.items.some((entry:any)=>entry.key===draft.item_key),false);
    assert.deepEqual(item.fun_facts,[]);assert.equal(item.location_desc,null);
    const retainedQuestions=draft.quiz_questions.filter((q:any)=>!isPlaceholderQuizQuestion(q.question));
    assert.equal(item.flashcards.length,4);assert.equal(item.quiz_questions.length,retainedQuestions.length);
    for(const lang of ['en','vi']){
      const translation=item.translations.find((t:any)=>t.lang===lang)!;
      assert.equal(translation.description,draft[`description_${lang}`]);
      assert.equal(translation.history,draft[`history_${lang}`]);
      assert.equal(isPlaceholderText(translation.description),false);
      const cards=item.flashcards.filter((c:any)=>c.lang===lang);
      const quizzes=item.quiz_questions.filter((q:any)=>q.lang===lang);
      assert.equal(cards.length,2);assert.equal(quizzes.length,retainedQuestions.filter((q:any)=>q.lang===lang).length);
      assert.equal(new Set([...cards.map((c:any)=>c.front),...quizzes.map((q:any)=>q.question)]).size,2+quizzes.length);
      for(const card of cards)assert.ok(draft.flashcards.some((c:any)=>c.key===card.key&&c.lang===lang&&c.front===card.front&&c.back===card.back));
      for(const quiz of quizzes){
        const expected=draft.quiz_questions.find((q:any)=>q.key===quiz.key&&q.lang===lang)!;
        assert.equal(quiz.question,expected.question);assert.deepEqual(quiz.options,expected.options);assert.deepEqual(quiz.correct_answers,expected.correct_answers);
        assert.equal(quiz.options.length,3);assert.equal(quiz.correct_answers.length,1);
      }
    }
  }
});

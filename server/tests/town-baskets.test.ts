import assert from 'node:assert/strict';
import test from 'node:test';
import {BASKET_DECORATIONS,BASKET_MESSAGES,basketSendSchema,DECORATION_MS,BASKET_COOLDOWN_MS} from '../src/town-building/basketModel.js';
import {randomUUID} from 'node:crypto';
test('river surprises offer exactly three decorations and ten authored messages, with no free text or reward claims',()=>{
  assert.equal(BASKET_DECORATIONS.length,3);assert.equal(BASKET_MESSAGES.length,10);
  assert.equal(new Set(BASKET_MESSAGES).size,10);assert.equal(DECORATION_MS,5*86400000);assert.equal(BASKET_COOLDOWN_MS,86400000);
  const valid={requestId:randomUUID(),decoration:'flowers',message:0};
  assert.ok(basketSendSchema.safeParse(valid).success);
  for(const value of [{...valid,message:10},{...valid,message:-1},{...valid,message:'hello'},{...valid,decoration:'wood'},{...valid,stamina:100},{...valid,senderId:'forged'},{...valid,expiresAt:999},{...valid,requestId:'invalid'}])assert.equal(basketSendSchema.safeParse(value).success,false);
});

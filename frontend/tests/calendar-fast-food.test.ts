import assert from 'node:assert/strict';
import test from 'node:test';
import { hasFastFood, foodGroup } from '../src/lib/calendarFoodGroups.ts';

test('fast-food notice follows the reviewed icon, including renamed favorites', () => {
  assert.equal(hasFastFood([{ food: 'fast_food' }]), true);
  assert.equal(hasFastFood([{ food: 'custom', icon: 'fast_food', name: 'Lunch out' }]), true);
  assert.equal(hasFastFood([{ food: 'sausage' }, { food: 'vegetable_soup' }]), false);
  assert.equal(hasFastFood([{ food: 'custom', icon: 'vegetables', name: 'Fast food' }]), false);
  assert.equal(hasFastFood([]), false);
});
test('the new foods belong to the appropriate picker groups', () => {
  assert.equal(foodGroup('sausage'), 'Meat and protein');
  assert.equal(foodGroup('vegetable_soup'), 'Vegetables');
  assert.equal(foodGroup('fast_food'), 'Staples');
});

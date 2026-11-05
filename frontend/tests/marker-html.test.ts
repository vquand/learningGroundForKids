import assert from 'node:assert/strict';
import test from 'node:test';
import { markerAttribute } from '../src/components/Map/markerHtml.ts';

test('marker IDs cannot terminate a quoted HTML attribute or inject markup', () => {
  assert.equal(markerAttribute(`item-\" onmouseover='alert(1)'>&<`), 'item-&quot; onmouseover=&#39;alert(1)&#39;&gt;&amp;&lt;');
  assert.equal(markerAttribute('ordinary-item_123'), 'ordinary-item_123');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { chartAccessibleDescription } from '../src/chart-a11y.js';

test('chart accessibility text includes labels and exact numeric values', () => {
  assert.equal(chartAccessibleDescription([{label:'Mon',value:18},{label:'Tue',value:34}]),
    'Data points: Mon: 18; Tue: 34.');
  assert.equal(chartAccessibleDescription([{label:'Loss',value:-2.5},{label:'Zero',value:0}]),
    'Data points: Loss: -2.5; Zero: 0.');
});

test('empty charts have a meaningful accessible description', () => {
  assert.equal(chartAccessibleDescription([]), 'No data available.');
  assert.equal(chartAccessibleDescription(null), 'No data available.');
});

test('chart description respects the 36-point renderer limit', () => {
  const data = Array.from({length:50}, (_,i)=>({label:`Day ${i+1}`,value:i}));
  const description = chartAccessibleDescription(data);
  assert.match(description,/Day 36: 35/);
  assert.doesNotMatch(description,/Day 37:/);
});

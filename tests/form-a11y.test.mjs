import test from 'node:test';
import assert from 'node:assert/strict';
import { formControlName } from '../src/form-a11y.js';

test('visible labels remain the accessible name', () => {
  assert.equal(formControlName({label:'Email',ariaLabel:'Hidden',placeholder:'Enter email',bind:'form.email'},'Text input'), undefined);
});

test('unlabeled controls prefer explicit accessible labels, then placeholder, then state path', () => {
  assert.equal(formControlName({label:' ',ariaLabel:'  Notes ',placeholder:'Enter notes',bind:'form.notes'},'Text area'), 'Notes');
  assert.equal(formControlName({placeholder:' Enter name ',bind:'form.name'},'Text input'), 'Enter name');
  assert.equal(formControlName({bind:'form.country'},'Select'), 'country');
});

test('unlabeled controls without hints receive a stable generic name', () => {
  assert.equal(formControlName({},'Text input'), 'Text input');
  assert.equal(formControlName({ariaLabel:'   ',placeholder:''},'Text area'), 'Text area');
});

test('unlabeled toggles and sliders receive stable accessible names', () => {
  assert.equal(formControlName({bind:'prefs.enabled'},'Checkbox'), 'enabled');
  assert.equal(formControlName({ariaLabel:'  Quiet mode ',bind:'prefs.quiet'},'Switch'), 'Quiet mode');
  assert.equal(formControlName({},'Slider'), 'Slider');
  assert.equal(formControlName({label:'Volume',ariaLabel:'Override'},'Slider'), undefined);
});

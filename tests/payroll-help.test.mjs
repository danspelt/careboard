import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assistantPayrollSuggestions, payrollAskQuestions, payrollAskStorageKey, payrollAssistantPrompts, payrollFaq } from '../lib/payroll-help.ts';

test('manager and worker payroll ask questions differ and stay short', () => {
  const manager = payrollAskQuestions('manager');
  const worker = payrollAskQuestions('worker');
  assert.deepEqual(manager.map((step) => step.id), ['bookkeeper', 'rates', 'export']);
  assert.deepEqual(worker.map((step) => step.id), ['clock-in', 'estimate', 'paycheck']);
  assert.ok(manager.some((step) => step.field === 'bookkeeperEmail'));
  assert.ok(!worker.some((step) => step.field));
  for (const step of [...manager, ...worker]) {
    assert.ok(step.question.trim());
    assert.ok(step.detail.trim());
  }
});

test('payroll FAQ answers differ by role and never claim CareBoard issues pay', () => {
  const manager = payrollFaq('manager');
  const worker = payrollFaq('worker');
  assert.ok(manager.length >= 3);
  assert.ok(worker.length >= 3);
  assert.notDeepEqual(manager.map((item) => item.id), worker.map((item) => item.id));
  const blob = [...manager, ...worker].map((item) => `${item.question} ${item.answer}`).join(' ').toLowerCase();
  assert.match(blob, /does not|does careboard pay|not a paycheck|outside careboard/);
  assert.ok(!blob.includes('adp'));
  assert.ok(!blob.includes('gusto'));
});

test('assistant payroll prompts are role-specific and storage keys are member-scoped', () => {
  assert.deepEqual(payrollAssistantPrompts('manager'), assistantPayrollSuggestions('manager'));
  assert.deepEqual(payrollAssistantPrompts('worker'), assistantPayrollSuggestions('worker'));
  assert.deepEqual(assistantPayrollSuggestions('viewer'), []);
  assert.notDeepEqual(payrollAssistantPrompts('manager'), payrollAssistantPrompts('worker'));
  assert.equal(payrollAskStorageKey('member-1'), 'careboard-payroll-ask-member-1');
});

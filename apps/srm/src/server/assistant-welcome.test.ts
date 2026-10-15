import assert from 'node:assert/strict';
import test from 'node:test';
import { createWelcomeSequence, welcomeScrollTop, type WelcomePhase } from '../../../../packages/srm-xray/src/chat-welcome-contract';

test('welcome shows typing before the authored message, once per supplier sequence', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const phases: WelcomePhase[] = [];
  const sequence = createWelcomeSequence(phase => phases.push(phase));
  sequence.start();
  context.mock.timers.tick(649);
  assert.deepEqual(phases, []);
  context.mock.timers.tick(1);
  assert.deepEqual(phases, ['typing']);
  // Reopening, reparenting, persona and year changes must not restart the sequence.
  sequence.start();
  context.mock.timers.tick(1800);
  assert.deepEqual(phases, ['typing', 'visible']);
  sequence.start();
  context.mock.timers.tick(10000);
  assert.deepEqual(phases, ['typing', 'visible']);
  sequence.dispose();
});

test('changing supplier or unmounting cancels old messages, and a new sequence can start', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const previous: WelcomePhase[] = [], next: WelcomePhase[] = [];
  const old = createWelcomeSequence(phase => previous.push(phase));
  old.start();
  context.mock.timers.tick(650);
  old.dispose();
  old.start();
  const current = createWelcomeSequence(phase => next.push(phase));
  current.start();
  context.mock.timers.tick(2450);
  assert.deepEqual(previous, ['typing']);
  assert.deepEqual(next, ['typing', 'visible']);
  current.dispose();
  const unmounted = createWelcomeSequence(() => assert.fail('Disposed welcome must never render'));
  unmounted.start();
  unmounted.dispose();
  context.mock.timers.tick(10000);
});

test('chat scroll reveals a complete short message and the start of a long mobile message', () => {
  assert.equal(welcomeScrollTop(250, 100, 400, 500), 100);
  assert.equal(welcomeScrollTop(250, 600, 400, 850), 234);
  assert.equal(welcomeScrollTop(0, 600, 400, 600), 0);
  assert.equal(welcomeScrollTop(0, 100, 400, 100), 0);
});

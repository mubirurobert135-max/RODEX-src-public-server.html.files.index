import assert from 'node:assert/strict';
import { globalTaskEngine } from '../src/services/TaskEngine';

async function run() {
  const search = await globalTaskEngine.executeRestaurantSearch({
    partySize: 4,
    time: '7:00 PM',
    location: 'Kampala',
  });
  assert.equal(search.task.state, 'FAILED');
  assert.equal(search.task.confirmationAction, undefined);
  assert.match(search.spokenPrompt, /cannot verify a live table/i);
  assert.doesNotMatch(search.spokenPrompt, /table confirmed|open table located/i);

  const result = await globalTaskEngine.confirmRestaurantBooking({
    venue: 'Unverified venue',
    partySize: 4,
  });
  assert.equal(result.task.state, 'FAILED');
  assert.match(result.spokenSummary, /No reservation has been booked/i);
  assert.equal(result.task.confirmationAction, undefined);
  console.log('RODEX: unverified dining reservations never show fabricated confirmation.');
}
run().catch(error => {
  console.error(error);
  process.exit(1);
});

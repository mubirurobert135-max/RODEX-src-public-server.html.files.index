import assert from 'node:assert/strict';
import { extractWebGrounding } from '../server/orchestrator/grounding';

function testGrounding() {
  const empty = extractWebGrounding(undefined);
  assert.equal(empty.webGrounded, false, 'No metadata is not a verified search');
  assert.deepEqual(empty.sources, []);
  assert.deepEqual(empty.searchQueries, []);

  const fake = extractWebGrounding({
    webSearchQueries: ['latest news'],
    groundingChunks: [{ web: { uri: 'javascript:alert(1)', title: 'fake' } }],
  });
  assert.equal(fake.webGrounded, false, 'Search terms alone do not prove live grounding');
  assert.equal(fake.sources.length, 0, 'Non-web links cannot be cited');

  const grounded = extractWebGrounding({
    webSearchQueries: [' Kampala weather ', 'Kampala weather', '', 5],
    groundingChunks: [
      { web: { uri: 'https://example.org/report#intro', title: ' Example report ' } },
      { web: { uri: 'https://example.org/report', title: 'Duplicate' } },
      { web: { uri: 'https://www.example.com/news', title: 'News' } },
      { web: { uri: 'data:text/html,hi', title: 'Not a web source' } },
      { web: { uri: 'not-an-address' } },
    ],
  });
  assert.equal(grounded.webGrounded, true);
  assert.equal(grounded.sources.length, 2, 'Duplicate URLs are normalized');
  assert.equal(grounded.sources[0].url, 'https://example.org/report');
  assert.equal(grounded.sources[0].title, 'Example report');
  assert.equal(grounded.sources[1].domain, 'example.com');
  assert.deepEqual(grounded.searchQueries, ['Kampala weather']);

  assert.equal(extractWebGrounding({ groundingChunks: [] }).webGrounded, false);
  console.log('RODEX Grounding: 12 assertions passed; no fabricated or unsafe citations.');
}

testGrounding();

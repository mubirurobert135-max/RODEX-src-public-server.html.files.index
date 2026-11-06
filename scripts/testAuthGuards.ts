import assert from 'node:assert/strict';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware, requireAuth } from '../server/services/auth/authMiddleware';

const fakeRequest = (extras: object = {}) => ({
  headers: {},
  query: {},
  ...extras,
}) as Request;

function run() {
  let advanced = false;
  const next: NextFunction = () => { advanced = true; };

  const guest = fakeRequest();
  authMiddleware(guest, {} as Response, next);
  assert.equal(advanced, true);
  assert.equal(guest.userId, undefined, 'Anonymous callers may not impersonate a default account');
  assert.equal(guest.sessionToken, undefined);

  advanced = false;
  const queryOnly = fakeRequest({ query: { sessionToken: 'session_nonexistent' } });
  authMiddleware(queryOnly, {} as Response, next);
  assert.equal(queryOnly.user, undefined, 'Tokens in URLs are not accepted');
  assert.equal(queryOnly.sessionToken, undefined);

  let code = 0;
  const response = {
    status(value: number) { code = value; return this; },
    json(_data: unknown) { return this; },
  } as unknown as Response;
  advanced = false;
  requireAuth(guest, response, next);
  assert.equal(code, 401);
  assert.equal(advanced, false);
  console.log('RODEX auth guard checks passed.');
}

run();

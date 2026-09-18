import { expect, it } from 'vitest';

import { resolveNotaryCredentials } from '../source/packaging/notary.js';

it('prefers an explicit notary profile option', () => {
  expect(resolveNotaryCredentials({ notaryProfile: 'profile' }, {})).toEqual({
    kind: 'keychain-profile',
    profile: 'profile',
  });
});

it('reads credentials from the environment', () => {
  expect(
    resolveNotaryCredentials(undefined, {
      RETEND_GPUI_NOTARY_PROFILE: 'env-profile',
    })
  ).toEqual({ kind: 'keychain-profile', profile: 'env-profile' });

  expect(
    resolveNotaryCredentials(undefined, {
      APPLE_API_KEY: '/keys/AuthKey.p8',
      APPLE_API_KEY_ID: 'KEYID',
      APPLE_API_ISSUER: 'ISSUER',
    })
  ).toEqual({
    kind: 'api-key',
    keyPath: '/keys/AuthKey.p8',
    keyId: 'KEYID',
    issuer: 'ISSUER',
  });

  expect(
    resolveNotaryCredentials(undefined, {
      APPLE_ID: 'dev@example.com',
      APPLE_TEAM_ID: 'TEAMID',
      APPLE_APP_SPECIFIC_PASSWORD: 'secret',
    })
  ).toEqual({
    kind: 'apple-id',
    appleId: 'dev@example.com',
    teamId: 'TEAMID',
    password: 'secret',
  });
});

it('returns nothing when no credentials are available', () => {
  expect(resolveNotaryCredentials(undefined, {})).toBeUndefined();
});

it('honours notarize: false even when credentials exist', () => {
  expect(
    resolveNotaryCredentials(
      { notarize: false },
      {
        APPLE_ID: 'dev@example.com',
        APPLE_TEAM_ID: 'TEAMID',
        APPLE_APP_SPECIFIC_PASSWORD: 'secret',
      }
    )
  ).toBeUndefined();
});

it('prefers the API key form over the Apple ID form', () => {
  const credentials = resolveNotaryCredentials(undefined, {
    APPLE_API_KEY: '/keys/AuthKey.p8',
    APPLE_API_KEY_ID: 'KEYID',
    APPLE_API_ISSUER: 'ISSUER',
    APPLE_ID: 'dev@example.com',
    APPLE_TEAM_ID: 'TEAMID',
    APPLE_APP_SPECIFIC_PASSWORD: 'secret',
  });
  expect(credentials?.kind).toBe('api-key');
});

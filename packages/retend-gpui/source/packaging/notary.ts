import { spawnSync } from 'node:child_process';

/** How to authenticate with Apple's notary service. */
export type NotaryCredentials =
  | { kind: 'keychain-profile'; profile: string }
  | { kind: 'api-key'; keyPath: string; keyId: string; issuer: string }
  | { kind: 'apple-id'; appleId: string; teamId: string; password: string };

/** Options that can supply notarization credentials. */
export interface NotaryOptions {
  /** `notarytool` keychain profile created with `xcrun notarytool store-credentials`. */
  notaryProfile?: string;
  /** Set to `false` to skip notarization even when credentials are available. */
  notarize?: boolean;
}

/** Resolves credentials from options, then from CI-friendly environment variables. */
export function resolveNotaryCredentials(
  options: NotaryOptions | undefined,
  env: NodeJS.ProcessEnv
): NotaryCredentials | undefined {
  if (options?.notarize === false) return undefined;
  if (options?.notaryProfile) {
    return { kind: 'keychain-profile', profile: options.notaryProfile };
  }

  const profile = env.RETEND_GPUI_NOTARY_PROFILE;
  if (profile) return { kind: 'keychain-profile', profile };

  const { APPLE_API_KEY, APPLE_API_KEY_ID, APPLE_API_ISSUER } = env;
  if (APPLE_API_KEY && APPLE_API_KEY_ID && APPLE_API_ISSUER) {
    return {
      kind: 'api-key',
      keyPath: APPLE_API_KEY,
      keyId: APPLE_API_KEY_ID,
      issuer: APPLE_API_ISSUER,
    };
  }

  const { APPLE_ID, APPLE_TEAM_ID, APPLE_APP_SPECIFIC_PASSWORD } = env;
  if (APPLE_ID && APPLE_TEAM_ID && APPLE_APP_SPECIFIC_PASSWORD) {
    return {
      kind: 'apple-id',
      appleId: APPLE_ID,
      teamId: APPLE_TEAM_ID,
      password: APPLE_APP_SPECIFIC_PASSWORD,
    };
  }

  return undefined;
}

function notaryArguments(credentials: NotaryCredentials): string[] {
  switch (credentials.kind) {
    case 'keychain-profile':
      return ['--keychain-profile', credentials.profile];
    case 'api-key':
      return [
        '--key',
        credentials.keyPath,
        '--key-id',
        credentials.keyId,
        '--issuer',
        credentials.issuer,
      ];
    case 'apple-id':
      return [
        '--apple-id',
        credentials.appleId,
        '--team-id',
        credentials.teamId,
        '--password',
        credentials.password,
      ];
  }
}

function run(command: string, args: string[], failure: string): void {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`${failure} (${command} exited with ${result.status}).`);
  }
}

/** Request for {@link notarizeDmg}. */
export interface NotarizeDmgRequest {
  dmgPath: string;
  credentials: NotaryCredentials;
  log: (message: string) => void;
}

/** Notarizes the disk image, staples the ticket, and verifies Gatekeeper acceptance. */
export function notarizeDmg(request: NotarizeDmgRequest): void {
  const { dmgPath, credentials, log } = request;
  log('retend-gpui: submitting for notarization (this can take a few minutes)');
  run(
    'xcrun',
    [
      'notarytool',
      'submit',
      dmgPath,
      ...notaryArguments(credentials),
      '--wait',
    ],
    'Failed to notarize the disk image'
  );
  run(
    'xcrun',
    ['stapler', 'staple', dmgPath],
    'Failed to staple the notarization ticket'
  );
  run(
    'spctl',
    ['-a', '-vvv', '-t', 'install', dmgPath],
    'Gatekeeper rejected the notarized disk image'
  );
  log('retend-gpui: notarized and stapled');
}

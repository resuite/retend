import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);

function run(command, commandArgs, env = process.env) {
  const result = spawnSync(command, commandArgs, {
    cwd,
    env,
    stdio: 'inherit',
  });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (args[0] === '--rust' || args[0] === '--hardening') {
  const hardening = args.shift() === '--hardening';
  const options = ['--manifest-path', 'native/Cargo.toml', '--locked'];
  if (hardening) options.push('--release', '--features', 'benchmarks');
  const env = hardening
    ? { ...process.env, CARGO_PROFILE_RELEASE_LTO: 'false' }
    : process.env;
  // Build the test targets before execution, matching the workspace test policy.
  run('cargo', ['build', '--tests', ...options], env);
  run(
    'cargo',
    [
      'test',
      ...options,
      ...(hardening
        ? ['hardening_benchmark', '--', '--nocapture', '--test-threads=1']
        : args),
    ],
    env
  );
} else {
  const integration = args[0] === '--integration';
  if (integration) args.shift();
  run('pnpm', [
    'exec',
    'vitest',
    'run',
    ...(integration
      ? ['tests/native-bridge.integration.spec.ts']
      : ['--exclude', 'tests/native-bridge.integration.spec.ts']),
    ...args,
  ]);
}

import fs from 'node:fs/promises';

export const message = 'Hello from the server!';
export async function getDirectoryFiles() {
  const currentDir = process.cwd();
  const directoryFiles = await fs.readdir(currentDir);
  return directoryFiles;
}

import { randomUUID } from 'node:crypto';

// Export a simple serializable value
export const buildEnvironment = process.env.NODE_ENV || 'development';

// Export a Date (will be serialized/deserialized)
export const generatedAt = new Date();

// Export a synchronous function (must be called during build/SSR)
export function getBuildId() {
  console.log('[Build/SSR] Generating Build ID...');
  return randomUUID();
}

export async function loadRemoteConfig() {
  return {
    success: true,
    data: {
      name: 'Sefunmi Adebola',
      age: 30,
    },
  };
}

// This function takes arguments, so its result cannot be snapshotted by getServerSnapshot
export function formatMessage(template: string) {
  return template.replace('%TIME%', new Date().toLocaleTimeString());
}

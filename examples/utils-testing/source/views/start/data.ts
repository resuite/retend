import fs from 'node:fs';

export async function getData() {
  const currentDir = process.cwd();
  const directoryFiles = fs.readdirSync(currentDir);

  return {
    directoryFiles,
  };
}

import { getServerSnapshot } from 'retend-server/client';

export default async function GetServerSnapshotTest() {
  const snapshot = await getServerSnapshot(() => import('./data'));
  const environment = snapshot.buildEnvironment;
  const generationTime = snapshot.generatedAt;
  const buildId = snapshot.getBuildId();

  return (
    <div class="app-container">
      <h1>Application Status</h1>
      <p>
        Running in: <strong>{environment}</strong> mode.
      </p>
      <p>
        Build ID: <code>{buildId}</code>
      </p>
      <p>Generated At: {generationTime.toLocaleString()}</p>
    </div>
  );
}

import { For } from 'retend';
import { getServerSnapshot } from 'retend-server/client';

export default async function GetServerSnapshotTest() {
  const snapshot = await getServerSnapshot(() => import('./data'));
  const environment = snapshot.buildEnvironment;
  const generationTime = snapshot.generatedAt;
  const listOfItems = snapshot.listOfItems;
  console.log(snapshot.serializedDiv);

  return (
    <div class="app-container">
      <h1>Application Status</h1>
      <p>
        Running in: <strong>{environment}</strong> mode.
      </p>
      <p>Generated At: {generationTime.toLocaleString()}</p>
      <ul>
        {For(listOfItems, (item) => (
          <li>{item}</li>
        ))}
      </ul>
    </div>
  );
}

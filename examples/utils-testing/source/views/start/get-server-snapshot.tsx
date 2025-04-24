import { getServerSnapshot } from 'retend-server/client';

export default async function GetServerSnapshotTest() {
  const { getData } = await getServerSnapshot(() => import('./data'));

  console.log(await getData());

  return (
    <div>
      <h1>Testing getServerSnapshot</h1>
    </div>
  );
}

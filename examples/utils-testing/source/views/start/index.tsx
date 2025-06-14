import { useRouter } from 'retend/router';
import classes from './styles.module.css';
import { noHydrate } from 'retend-server/client';

const Heading = noHydrate(() => {
  return (
    <>
      <h1 style={{ textAlign: 'center' }}>Retend Utils Testing</h1>
      <h2 style={{ textAlign: 'center' }}>Hooks</h2>
    </>
  );
}, 2);

const Start = () => {
  const router = useRouter();

  return (
    <div class={classes.container}>
      <Heading />
      <nav>
        <ul>
          {/* ... other links ... */}
          <li>
            <router.Link href="/element-bounding">Element Bounding</router.Link>
          </li>
          <li>
            <router.Link href="/window-size">Window Size</router.Link>
          </li>
          <li>
            <router.Link href="/match-media">Match Media</router.Link>
          </li>
          <li>
            <router.Link href="/live-date">Live Date</router.Link>
          </li>
          <li>
            <router.Link href="/network-status">Network Status</router.Link>
          </li>
          <li>
            <router.Link href="/local-storage">Local Storage</router.Link>
          </li>
          <li>
            <router.Link href="/session-storage">Session Storage</router.Link>
          </li>
          <li>
            <router.Link href="/router-lock">Lock</router.Link>
          </li>
          <li>
            <router.Link href="/input-test">Input Test</router.Link>
          </li>
          <li>
            <router.Link href="/fluid-list">Fluid List</router.Link>
          </li>
          <li>
            <router.Link href="/cursor-position">Cursor Position</router.Link>
          </li>
          <li>
            <router.Link href="/get-server-snapshot">
              Get Server Snapshot
            </router.Link>
          </li>
        </ul>
      </nav>
      <main style={{ display: 'grid', placeItems: 'center' }}>
        <router.Outlet />
      </main>
    </div>
  );
};

export default Start;

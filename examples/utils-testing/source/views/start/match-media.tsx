import { useMatchMedia } from 'retend-utils/hooks';

export default async function MatchMediaTest() {
  const isDarkMode = useMatchMedia('(prefers-color-scheme: dark)');
  const isPortrait = useMatchMedia('(orientation: portrait)');
  const isLargeScreen = useMatchMedia('(min-width: 1024px)');
  const isStandalone = useMatchMedia('(display-mode: standalone)');

  return (
    <div
      style={{
        height: '300px',
        width: '300px',
        border: '1px solid black',
        padding: '20px',
      }}
    >
      <h1>Match Media Test</h1>
      <p>
        This component uses the useMatchMedia hook to track matchMedia queries.
      </p>

      <p>(prefers-color-scheme: dark) -- {isDarkMode}</p>
      <p>(orientation: portrait) -- {isPortrait}</p>
      <p>(min-width: 1024px) -- {isLargeScreen}</p>
      <p>(display-mode: standalone) -- {isStandalone}</p>
    </div>
  );
}

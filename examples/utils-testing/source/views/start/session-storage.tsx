import { Cell } from 'retend';
import { useSessionStorage } from 'retend-utils/hooks';

export default function SessionStorageTest() {
  const storageKey = 'test-session-storage-key';
  const defaultValue = 'Default Local Value';
  const localValue = useSessionStorage<string>(storageKey, defaultValue);
  const inputRef = Cell.source<HTMLInputElement | null>(null);

  const handleInput = function (this: HTMLInputElement) {
    localValue.value = this.value;
  };
  localValue.listen((newValue) => {
    if (!inputRef.value) return;
    inputRef.value.value = newValue ?? '';
  });

  return (
    <div
      style={{
        width: '300px',
        border: '1px solid black',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <h1>useSessionStorage Test</h1>
      <label>
        Stored Value:
        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onInput={handleInput}
          style={{ marginLeft: '5px', width: '80%' }}
        />
      </label>
      <p>
        Current Cell Value: <span>{localValue}</span>
      </p>
      <p style={{ fontSize: '0.8em', color: 'grey' }}>
        Key: {storageKey} | Default: "{defaultValue}"
      </p>
    </div>
  );
}

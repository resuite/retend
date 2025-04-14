import { Cell } from 'retend';
import { useLocalStorage } from 'retend-utils/hooks';

export default function LocalStorageTest() {
  const storageKey = 'test-local-storage-key';
  const defaultValue = 'Default Local Value';
  const localValue = useLocalStorage<string>(storageKey, defaultValue);
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
      <h1>useLocalStorage Test</h1>
      <label>
        Stored Value:
        <input
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

import { Cell, For, If, useObserver, useSetupEffect } from 'retend';

const UseSetupEffectTest = () => {
  const showHidden = Cell.source(false);
  const nextItemId = Cell.source(1);
  const items = Cell.source([{ id: nextItemId.get(), name: 'Initial Item 1' }]);
  nextItemId.set(nextItemId.get() + 1);

  const toggleHidden = () => {
    showHidden.set(!showHidden.get());
  };

  const addItem = () => {
    const currentId = nextItemId.get();
    items.set([
      ...items.get(),
      { id: currentId, name: `New Item ${currentId}` },
    ]);
    nextItemId.set(currentId + 1);
  };

  const removeItem = () => {
    const currentItems = items.get();
    if (currentItems.length > 0) {
      items.set(currentItems.slice(0, currentItems.length - 1));
    }
  };

  return (
    <div
      style={{
        padding: '20px',
        border: '1px solid #ccc',
        borderRadius: '8px',
        fontFamily: 'sans-serif',
      }}
    >
      <h2>Retend Effects Demo</h2>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button
          onClick={toggleHidden}
          style={{ padding: '10px 15px', cursor: 'pointer' }}
        >
          {showHidden.get() ? 'Hide' : 'Show'} Hidden Component
        </button>
        <button
          onClick={addItem}
          style={{ padding: '10px 15px', cursor: 'pointer' }}
        >
          Add List Item
        </button>
        <button
          onClick={removeItem}
          disabled={items.get().length === 0}
          style={{ padding: '10px 15px', cursor: 'pointer' }}
        >
          Remove Last List Item
        </button>
      </div>

      <div
        style={{
          marginBottom: '20px',
          padding: '10px',
          border: '1px dashed blue',
        }}
      >
        <h3>Hidden Component Section</h3>
        {If(showHidden, HiddenComponent)}
      </div>

      <div style={{ padding: '10px', border: '1px dashed green' }}>
        <h3>List Items Section</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {For(items, (item) => (
            <li key={item.id} style={{ marginBottom: '5px' }}>
              <ListItem item={item} />
            </li>
          ))}
        </ul>
        {items.get().length === 0 && (
          <p style={{ color: '#555' }}>No items in the list.</p>
        )}
      </div>
    </div>
  );
};

export const HiddenComponent = () => {
  useSetupEffect(() => {
    console.log('Hidden component has been mounted.');

    return () => {
      console.log('Hidden component-- has been unmounted.');
    };
  });

  return (
    <div
      style={{
        display: 'grid',
        backgroundColor: 'red',
        height: '100px',
        color: 'white',
        placeItems: 'center',
        margin: '10px 0',
        borderRadius: '4px',
      }}
    >
      HiddenComponent shown
    </div>
  );
};

const ListItem = ({ item }: { item: { id: number; name: string } }) => {
  const observer = useObserver();
  const ref = Cell.source<HTMLDivElement | null>(null);
  useSetupEffect(() => {
    console.log(`ListItem "${item.name}" (ID: ${item.id}) has been mounted.`);

    return () => {
      console.log(
        `ListItem "${item.name}" (ID: ${item.id}) has been unmounted, should run before disconnect`
      );
    };
  });

  observer.onConnected(ref, () => {
    console.log(
      `ListItem "${item.name}" (ID: ${item.id}) has been connected, should run before mount.`
    );

    return () => {
      console.log(
        `ListItem "${item.name}" (ID: ${item.id}) has been disconnected.`
      );
    };
  });

  return (
    <div
      ref={ref}
      style={{
        padding: '8px 10px',
        border: '1px solid lightgray',
        backgroundColor: '#f9f9f9',
        borderRadius: '4px',
      }}
    >
      List Item: {item.name} (ID: {item.id})
    </div>
  );
};

export default UseSetupEffectTest;

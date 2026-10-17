import { Cell } from 'retend';
import { useWindow } from 'retend-gpui';

function TextSelectionExample() {
  return (
    <>
      <div style={{ fontSize: 12, color: '#777', userSelect: 'none' }}>
        This label cannot be selected.
      </div>
      <div
        style={{
          fontSize: 13,
          lineHeight: 20,
          color: '#242424',
          userSelect: 'text',
        }}
      >
        Drag over this paragraph to select its text, then press Cmd+C to copy
        it.
      </div>
    </>
  );
}

export default function App() {
  const window = useWindow();
  const lastSelection = Cell.source('Nothing selected');

  async function showMenu(x: number, y: number) {
    const selected = await window.showMenu({
      position: { x, y },
      items: [
        { id: 'open', label: 'Open' },
        { id: 'rename', label: 'Rename' },
        { type: 'separator' },
        { id: 'remove', label: 'Move to Trash', disabled: true },
      ],
    });
    lastSelection.set(selected ?? 'Menu dismissed');
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f3',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: 350,
          gap: 16,
          padding: 24,
          backgroundColor: '#fff',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#dededb',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 600 }}>Native menus</div>
        <div
          onContextMenu={(event) => {
            void showMenu(event.clientX, event.clientY);
          }}
          style={{
            padding: 20,
            backgroundColor: '#f4f4f2',
            borderRadius: 8,
            borderColor: '#e6e6e2',
            borderWidth: 1,
          }}
        >
          Right-click this area
        </div>
        <button
          onClick={(event) => void showMenu(event.clientX, event.clientY)}
          style={{
            height: 40,
            backgroundColor: '#242424',
            color: '#fff',
            borderRadius: 8,
          }}
        >
          Open a native menu
        </button>
        <div>{lastSelection}</div>
        <TextSelectionExample />
        <input
          placeholder="Right-click for the system text menu"
          style={{
            height: 40,
            width: '100%',
            borderColor: '#cacaca',
            borderWidth: 1,
            borderRadius: 7,
          }}
        />
      </div>
    </div>
  );
}

import { useWindow } from 'retend-gpui';

export function WindowSection() {
  const window = useWindow();
  const handleClick = async () => {
    const child = await window.open({
      title: 'Child window',
      width: 500,
      height: 400,
    });

    child.addEventListener('close', () => {
      console.log('child closed');
    });
  };

  return (
    <div style={{ gap: 12 }}>
      <div>
        Size: {window.width} × {window.height}
      </div>
      <div onClick={() => window.title.set('Title changed')}>Change title</div>
      <div onClick={handleClick}>Open child window</div>
      <div
        onClick={() => {
          window.close();
        }}
      >
        Close this window
      </div>
    </div>
  );
}

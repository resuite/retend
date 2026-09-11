export default function App() {
  const handleClick = () => {};

  return (
    <div style={{ padding: 24, gap: 16 }}>
      <textarea
        style={{ borderWidth: 2, borderColor: '#000000', borderRadius: 5 }}
        maxRows={7}
      />
      <div onClick={handleClick}>Open Popup Window</div>
      <div />
    </div>
  );
}

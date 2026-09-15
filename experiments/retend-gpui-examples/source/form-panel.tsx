export default function FormPanel() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 24,
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 'bold' }}>
        Default form controls
      </div>
      <div style={{ fontSize: 13, color: '#475569' }}>
        Padding, corner radius, white surface, and hairline border come from the
        native control defaults. The last field overrides them per property and
        adds a focused border.
      </div>
      <input placeholder="Name" />
      <textarea placeholder="Notes" minRows={3} maxRows={6} />
      <input
        placeholder="Accent"
        style={{
          backgroundColor: '#eef2ff',
          borderColor: '#6366f1',
          focused: { borderColor: '#e11d48' },
        }}
      />
    </div>
  );
}

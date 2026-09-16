export default function App() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          backgroundColor: 'blue',
          width: 100,
          height: 100,
          borderRadius: 18,
          transitionProperty: ['scale', 'rotate'],
          transitionDuration: '3s',
          transitionTimingFunction: 'ease-in-out',
          hover: {
            scale: 2,
            rotate: 50,
            transitionTimingFunction: 'ease',
            transitionDuration: '300ms',
          },
        }}
      ></div>
    </div>
  );
}

import appIcon from './app-icon.svg';

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
      <img src={appIcon} alt="Retend GPUI" style={{ width: 64, height: 64 }} />
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

import { onKeyDown } from 'retend-canvas-2d';

import { BackLink } from './BackLink';
import {
  activePanel,
  amberPanelBoxStyle,
  amberPanelStatusStyle,
  amberPanelTitleStyle,
  keyboardBlurbStyle,
  keyboardDemoMainStyle,
  keyboardFootStyle,
  keyboardTitleStyle,
  lastAmber,
  lastTeal,
  recordKey,
  tealPanelBoxStyle,
  tealPanelStatusStyle,
  tealPanelTitleStyle,
} from './keyboardDemoModel';
import { useWindowSize } from './useWindowSize';

export default function KeyboardDemo() {
  const { height } = useWindowSize();
  onKeyDown((e) => {
    const target = activePanel.get();
    if (target === 'teal') recordKey(lastTeal, 'teal')(e);
    if (target === 'amber') recordKey(lastAmber, 'amber')(e);
  });

  return (
    <rect style={keyboardDemoMainStyle}>
      <text style={keyboardTitleStyle}>KEYBOARD</text>
      <text style={keyboardBlurbStyle}>
        Tab to focus the canvas (teal outline), then click a panel and type.
        Keys go to the last panel hit by pointerdown.
      </text>

      <rect
        style={tealPanelBoxStyle}
        onClick={() => {
          activePanel.set('teal');
        }}
      >
        <text style={tealPanelTitleStyle}>Teal panel</text>
        <text style={tealPanelStatusStyle}>{lastTeal}</text>
      </rect>

      <rect
        style={amberPanelBoxStyle}
        onClick={() => {
          activePanel.set('amber');
        }}
      >
        <text style={amberPanelTitleStyle}>Amber panel</text>
        <text style={amberPanelStatusStyle}>{lastAmber}</text>
      </rect>

      <text style={keyboardFootStyle}>
        Click empty dark area + type clears focus (no handler fires).
      </text>

      <BackLink height={height} />
    </rect>
  );
}

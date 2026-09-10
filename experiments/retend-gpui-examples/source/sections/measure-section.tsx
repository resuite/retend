import type { GpuiElement, GpuiMeasurement } from 'retend-gpui';

import { Cell } from 'retend';

function formatMeasurement(measurement: GpuiMeasurement | null): string {
  if (!measurement) return 'not measured yet';
  const { x, y, width, height, scrollWidth, scrollHeight } = measurement;
  return `x ${x.toFixed(0)}, y ${y.toFixed(0)}, ${width.toFixed(0)}×${height.toFixed(0)} (content ${scrollWidth.toFixed(0)}×${scrollHeight.toFixed(0)})`;
}

export function MeasureSection() {
  const measuredBox = Cell.source<GpuiElement | null>(null);
  const measurement = Cell.source<GpuiMeasurement | null>(null);
  const readout = Cell.derived(() => formatMeasurement(measurement.get()));
  const measureBox = async () => {
    const node = measuredBox.get();
    if (node) measurement.set(await node.measure());
    console.log(measurement.get());
  };
  const handleMeasureClick = () => void measureBox();

  return (
    <div style={{ gap: 8 }}>
      <div>Measurement: {readout}</div>
      <div
        ref={measuredBox}
        style={{ padding: 12, backgroundColor: '#fef7e0' }}
      >
        Measure this box, not its text
      </div>
      <div onClick={handleMeasureClick}>Measure the box</div>
    </div>
  );
}

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  ElementKind,
  Opcode,
  PropertyId,
  StyleState,
  COMMAND_BATCH_HEADER_BYTES,
  CommandBatchWriter,
  ValueKind,
} from '../source/native/protocol';
import {
  NativeEventId,
  PROTOCOL_MAGIC,
  PROTOCOL_VERSION,
} from '../source/native/protocol.generated';

interface GoldenVector {
  name: string;
  hex: string;
}

const REQUIRED_GOLDEN_VECTORS = [
  'nodes-and-text',
  'property-values',
  'style-and-structure',
  'event-subscriptions',
  'pseudo-style',
] as const;
type GoldenVectorName = (typeof REQUIRED_GOLDEN_VECTORS)[number];

const goldenVectors = JSON.parse(
  readFileSync(
    new URL('../native/protocol-golden-vectors.json', import.meta.url),
    'utf8'
  )
) as GoldenVector[];
const goldenVectorBytes = new Map(
  goldenVectors.map(({ name, hex }) => [name, hex] as const)
);

function expectedGoldenHex(name: GoldenVectorName): string {
  const hex = goldenVectorBytes.get(name);
  if (hex === undefined)
    throw new Error(`Missing protocol golden vector: ${name}`);
  return hex;
}

function expectGolden(name: GoldenVectorName, bytes: Uint8Array): void {
  expect(Buffer.from(bytes).toString('hex')).toBe(expectedGoldenHex(name));
}

describe('Retend GPUI native command-batch encoder', () => {
  it('writes a versioned header and one batch-local string table', () => {
    const writer = new CommandBatchWriter();
    writer.createText(42, 'hello');
    writer.updateText(42, 'hello');

    const bytes = writer.finish();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint32(0, true)).toBe(PROTOCOL_MAGIC);
    expect(view.getUint16(4, true)).toBe(PROTOCOL_VERSION);
    expect(view.getUint16(6, true)).toBe(0);
    expect(view.getUint32(8, true)).toBe(18);
    expect(view.getUint32(12, true)).toBe(2);
    expect(view.getUint32(16, true)).toBe(COMMAND_BATCH_HEADER_BYTES + 18);
    expect(view.getUint32(20, true)).toBe(1);

    const stringOffset = view.getUint32(16, true);
    expect(view.getUint32(stringOffset, true)).toBe(5);
    expect(new TextDecoder().decode(bytes.subarray(stringOffset + 4))).toBe(
      'hello'
    );
  });

  it('encodes each primitive property tag and payload without semantic parsing', () => {
    const writer = new CommandBatchWriter();
    writer.createNode(1, ElementKind.Container);
    writer.setProperty(1, PropertyId.Placeholder, 'hello');
    writer.setProperty(1, PropertyId.MinRows, 3);
    writer.setProperty(1, PropertyId.ReadOnly, true);
    writer.setProperty(1, PropertyId.Value, null);

    const bytes = writer.finish();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint32(12, true)).toBe(5);
    expect(view.getUint32(20, true)).toBe(1);

    let offset = COMMAND_BATCH_HEADER_BYTES;
    expect(view.getUint8(offset)).toBe(Opcode.CreateNode);
    expect(view.getUint32(offset + 1, true)).toBe(1);
    expect(view.getUint8(offset + 5)).toBe(ElementKind.Container);
    offset += 6;

    expect(view.getUint8(offset)).toBe(Opcode.SetProperty);
    expect(view.getUint32(offset + 1, true)).toBe(1);
    expect(view.getUint16(offset + 5, true)).toBe(PropertyId.Placeholder);
    expect(view.getUint8(offset + 7)).toBe(ValueKind.String);
    expect(view.getUint32(offset + 8, true)).toBe(0);
    offset += 12;

    expect(view.getUint8(offset)).toBe(Opcode.SetProperty);
    expect(view.getUint16(offset + 5, true)).toBe(PropertyId.MinRows);
    expect(view.getUint8(offset + 7)).toBe(ValueKind.Number);
    expect(view.getFloat64(offset + 8, true)).toBe(3);
    offset += 16;

    expect(view.getUint8(offset)).toBe(Opcode.SetProperty);
    expect(view.getUint16(offset + 5, true)).toBe(PropertyId.ReadOnly);
    expect(view.getUint8(offset + 7)).toBe(ValueKind.Boolean);
    expect(view.getUint8(offset + 8)).toBe(1);
    offset += 9;

    expect(view.getUint8(offset)).toBe(Opcode.SetProperty);
    expect(view.getUint16(offset + 5, true)).toBe(PropertyId.Value);
    expect(view.getUint8(offset + 7)).toBe(ValueKind.Null);
    offset += 8;

    expect(offset).toBe(view.getUint32(16, true));
    const stringOffset = view.getUint32(16, true);
    expect(new TextDecoder().decode(bytes.subarray(stringOffset + 4))).toBe(
      'hello'
    );
  });

  it('encodes a complete style snapshot as one command', () => {
    const writer = new CommandBatchWriter();
    writer.setStyle(7, [
      [PropertyId.Width, '50%'],
      [PropertyId.Opacity, 0.5],
      [PropertyId.Color, null],
    ]);

    const bytes = writer.finish();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint32(12, true)).toBe(1);
    expect(view.getUint32(8, true)).toBe(28);
    expect(view.getUint32(20, true)).toBe(1);

    let offset = COMMAND_BATCH_HEADER_BYTES;
    expect(view.getUint8(offset)).toBe(Opcode.SetStyle);
    expect(view.getUint32(offset + 1, true)).toBe(7);
    expect(view.getUint16(offset + 5, true)).toBe(3);
    expect(view.getUint16(offset + 7, true)).toBe(PropertyId.Width);
    expect(view.getUint8(offset + 9)).toBe(ValueKind.String);
    expect(view.getUint32(offset + 10, true)).toBe(0);
    expect(view.getUint16(offset + 14, true)).toBe(PropertyId.Opacity);
    expect(view.getUint8(offset + 16)).toBe(ValueKind.Number);
    expect(view.getFloat64(offset + 17, true)).toBe(0.5);
    expect(view.getUint16(offset + 25, true)).toBe(PropertyId.Color);
    expect(view.getUint8(offset + 27)).toBe(ValueKind.Null);
  });

  it('rejects style snapshots whose property count cannot fit the wire format', () => {
    const writer = new CommandBatchWriter();
    const oversized = Array.from({ length: 0x1_0000 }) as [
      PropertyId,
      string | number | boolean | null,
    ][];

    expect(() => writer.setStyle(1, oversized)).toThrow(
      'A native style snapshot cannot exceed 65,535 properties.'
    );
    expect(writer.isEmpty).toBe(true);
  });

  it('encodes append and before-node insertion fields explicitly', () => {
    const writer = new CommandBatchWriter();
    writer.insertChild(1, 2);
    writer.insertChild(1, 3, 2);
    const bytes = writer.finish();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    expect(view.getUint32(12, true)).toBe(2);
    expect(view.getUint32(8, true)).toBe(26);
    expect(view.getUint32(20, true)).toBe(0);

    let offset = COMMAND_BATCH_HEADER_BYTES;
    expect(view.getUint8(offset)).toBe(Opcode.InsertChild);
    expect(view.getUint32(offset + 1, true)).toBe(1);
    expect(view.getUint32(offset + 5, true)).toBe(2);
    expect(view.getUint32(offset + 9, true)).toBe(0);
    offset += 13;

    expect(view.getUint8(offset)).toBe(Opcode.InsertChild);
    expect(view.getUint32(offset + 1, true)).toBe(1);
    expect(view.getUint32(offset + 5, true)).toBe(3);
    expect(view.getUint32(offset + 9, true)).toBe(2);
  });

  it('leaves the pending batch unchanged when a command argument is invalid', () => {
    const writer = new CommandBatchWriter();
    writer.createText(1, 'kept');

    expect(() => writer.insertChild(1, 0)).toThrow('Invalid native node ID');
    expect(() => writer.createNode(0, ElementKind.Container)).toThrow(
      'Invalid native node ID'
    );
    expect(() => writer.setProperty(-1, PropertyId.Value, 'x')).toThrow(
      'Invalid native node ID'
    );
    const bytes = writer.finish();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint32(12, true)).toBe(1);
    expect(view.getUint32(20, true)).toBe(1);

    const offset = COMMAND_BATCH_HEADER_BYTES;
    expect(view.getUint8(offset)).toBe(Opcode.CreateText);
    expect(view.getUint32(offset + 1, true)).toBe(1);
  });

  it('contains exactly the required golden vectors', () => {
    expect(goldenVectorBytes.size).toBe(goldenVectors.length);
    expect([...goldenVectorBytes.keys()].toSorted()).toEqual(
      [...REQUIRED_GOLDEN_VECTORS].toSorted()
    );
  });

  it('matches the nodes-and-text golden byte vector', () => {
    const writer = new CommandBatchWriter();
    writer.createNode(1, ElementKind.Container);
    writer.createText(2, 'hello');
    writer.updateText(2, 'world');
    expectGolden('nodes-and-text', writer.finish());
  });

  it('matches the property-values golden byte vector', () => {
    const writer = new CommandBatchWriter();
    writer.setProperty(7, PropertyId.Placeholder, 'value');
    writer.setProperty(7, PropertyId.MinRows, 3.5);
    writer.setProperty(7, PropertyId.ReadOnly, true);
    writer.setProperty(7, PropertyId.ReadOnly, false);
    writer.setProperty(7, PropertyId.Value, null);
    expectGolden('property-values', writer.finish());
  });

  it('matches the style-and-structure golden byte vector', () => {
    const writer = new CommandBatchWriter();
    writer.setStyle(10, [
      [PropertyId.Width, '50%'],
      [PropertyId.Opacity, 0.5],
      [PropertyId.Color, null],
    ]);
    writer.insertChild(10, 11);
    writer.insertChild(10, 12, 11);
    writer.removeChild(10, 11);
    expectGolden('style-and-structure', writer.finish());
  });

  it('matches the event-subscriptions golden byte vector', () => {
    const writer = new CommandBatchWriter();
    writer.subscribeEvent(5, NativeEventId.Click);
    writer.unsubscribeEvent(5, NativeEventId.MouseMove);
    expectGolden('event-subscriptions', writer.finish());
  });

  it('matches the pseudo-style golden byte vector', () => {
    const writer = new CommandBatchWriter();
    writer.setPseudoStyle(9, StyleState.Hover, [
      [PropertyId.Opacity, 0.75],
      [PropertyId.TransitionProperty, 'opacity'],
    ]);
    writer.setPseudoStyle(9, StyleState.Active, [[PropertyId.Opacity, 0.25]]);
    expectGolden('pseudo-style', writer.finish());
  });
});

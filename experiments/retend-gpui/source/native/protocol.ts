import {
  ElementKind,
  Opcode,
  PROTOCOL_MAGIC,
  PROTOCOL_VERSION,
  PropertyId,
  ValueKind,
  type ElementKind as ElementKindValue,
  type NativeEventId as NativeEventIdValue,
  type PropertyId as PropertyIdValue,
} from './protocol.generated.js';

export const COMMAND_BATCH_HEADER_BYTES = 24;

export type ProtocolPropertyValue = boolean | number | string | null;

const textEncoder = new TextEncoder();

class ByteRegion {
  #buffer = new Uint8Array(128);
  #view = new DataView(this.#buffer.buffer);
  #length = 0;

  get length(): number {
    return this.#length;
  }

  writeU8(value: number): void {
    this.#ensure(1);
    this.#buffer[this.#length++] = value & 0xff;
  }

  writeU16(value: number): void {
    this.#ensure(2);
    this.#view.setUint16(this.#length, value, true);
    this.#length += 2;
  }

  writeU32(value: number): void {
    this.#ensure(4);
    this.#view.setUint32(this.#length, value, true);
    this.#length += 4;
  }

  writeF64(value: number): void {
    this.#ensure(8);
    this.#view.setFloat64(this.#length, value, true);
    this.#length += 8;
  }

  writeBytes(value: Uint8Array): void {
    this.#ensure(value.byteLength);
    this.#buffer.set(value, this.#length);
    this.#length += value.byteLength;
  }

  copyInto(target: Uint8Array, offset: number): void {
    target.set(this.#buffer.subarray(0, this.#length), offset);
  }

  reset(): void {
    this.#length = 0;
  }

  #ensure(extra: number): void {
    const required = this.#length + extra;
    if (required <= this.#buffer.byteLength) return;
    let capacity = this.#buffer.byteLength;
    while (capacity < required) capacity *= 2;
    const next = new Uint8Array(capacity);
    next.set(this.#buffer.subarray(0, this.#length));
    this.#buffer = next;
    this.#view = new DataView(next.buffer);
  }
}

/** @internal Binary command-batch writer for the Retend-owned native bridge. */
export class CommandBatchWriter {
  readonly #commands = new ByteRegion();
  readonly #stringBytes = new ByteRegion();
  readonly #stringIndexes = new Map<string, number>();
  #commandCount = 0;

  get isEmpty(): boolean {
    return this.#commandCount === 0;
  }

  createNode(id: number, kind: ElementKindValue): void {
    this.#command(Opcode.CreateNode, this.#nodeId(id));
    this.#commands.writeU8(kind);
  }

  createText(id: number, text: string): void {
    this.#command(Opcode.CreateText, this.#nodeId(id));
    this.#commands.writeU32(this.#string(text));
  }

  updateText(id: number, text: string): void {
    this.#command(Opcode.UpdateText, this.#nodeId(id));
    this.#commands.writeU32(this.#string(text));
  }

  setProperty(
    id: number,
    property: PropertyIdValue,
    value: ProtocolPropertyValue
  ): void {
    const nodeId = this.#nodeId(id);
    this.#command(Opcode.SetProperty, nodeId);
    this.#commands.writeU16(property);
    this.#writePropertyValue(value);
  }

  setStyle(
    id: number,
    properties: readonly (readonly [PropertyIdValue, ProtocolPropertyValue])[]
  ): void {
    const nodeId = this.#nodeId(id);
    if (properties.length > 0xffff) {
      throw new RangeError(
        'A native style snapshot cannot exceed 65,535 properties.'
      );
    }
    this.#command(Opcode.SetStyle, nodeId);
    this.#commands.writeU16(properties.length);
    for (const [property, value] of properties) {
      this.#commands.writeU16(property);
      this.#writePropertyValue(value);
    }
  }

  insertChild(parentId: number, childId: number, beforeId = 0): void {
    const parent = this.#nodeId(parentId);
    const child = this.#nodeId(childId);
    const before = beforeId === 0 ? 0 : this.#nodeId(beforeId);
    this.#command(Opcode.InsertChild, parent);
    this.#commands.writeU32(child);
    this.#commands.writeU32(before);
  }

  removeChild(parentId: number, childId: number): void {
    const parent = this.#nodeId(parentId);
    const child = this.#nodeId(childId);
    this.#command(Opcode.RemoveChild, parent);
    this.#commands.writeU32(child);
  }

  subscribeEvent(id: number, event: NativeEventIdValue): void {
    this.#command(Opcode.SubscribeEvent, this.#nodeId(id));
    this.#commands.writeU16(event);
  }

  unsubscribeEvent(id: number, event: NativeEventIdValue): void {
    this.#command(Opcode.UnsubscribeEvent, this.#nodeId(id));
    this.#commands.writeU16(event);
  }

  finish(): Uint8Array {
    const stringTableOffset =
      COMMAND_BATCH_HEADER_BYTES + this.#commands.length;
    const output = new Uint8Array(stringTableOffset + this.#stringBytes.length);
    const header = new DataView(output.buffer);
    header.setUint32(0, PROTOCOL_MAGIC, true);
    header.setUint16(4, PROTOCOL_VERSION, true);
    header.setUint32(8, this.#commands.length, true);
    header.setUint32(12, this.#commandCount, true);
    header.setUint32(16, stringTableOffset, true);
    header.setUint32(20, this.#stringIndexes.size, true);
    this.#commands.copyInto(output, COMMAND_BATCH_HEADER_BYTES);
    this.#stringBytes.copyInto(output, stringTableOffset);
    this.#commands.reset();
    this.#stringBytes.reset();
    this.#stringIndexes.clear();
    this.#commandCount = 0;
    return output;
  }

  #command(opcode: number, nodeId: number): void {
    this.#commands.writeU8(opcode);
    this.#commandCount += 1;
    this.#commands.writeU32(nodeId);
  }

  #writePropertyValue(value: ProtocolPropertyValue): void {
    if (value === null) {
      this.#commands.writeU8(ValueKind.Null);
    } else if (typeof value === 'number') {
      this.#commands.writeU8(ValueKind.Number);
      this.#commands.writeF64(value);
    } else if (typeof value === 'boolean') {
      this.#commands.writeU8(ValueKind.Boolean);
      this.#commands.writeU8(value ? 1 : 0);
    } else {
      this.#commands.writeU8(ValueKind.String);
      this.#commands.writeU32(this.#string(value));
    }
  }

  #nodeId(value: number): number {
    if (!Number.isInteger(value) || value <= 0 || value > 0xffff_ffff) {
      throw new Error(`Invalid native node ID: ${value}.`);
    }
    return value;
  }

  #string(value: string): number {
    const existing = this.#stringIndexes.get(value);
    if (existing !== undefined) return existing;
    const index = this.#stringIndexes.size;
    const bytes = textEncoder.encode(value);
    this.#stringIndexes.set(value, index);
    this.#stringBytes.writeU32(bytes.byteLength);
    this.#stringBytes.writeBytes(bytes);
    return index;
  }
}

export { ElementKind, Opcode, PropertyId, ValueKind };

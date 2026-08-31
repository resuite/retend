interface NativeAllocatorGlobal {
  __retendGpuiNativeNodeId__?: number;
}

const processState = globalThis as typeof globalThis & NativeAllocatorGlobal;

/** @internal Allocates one process-global protocol node ID. */
export function allocateNativeNodeId(): number {
  const id = processState.__retendGpuiNativeNodeId__ ?? 1;
  if (id > 0xffff_ffff) {
    throw new Error('Retend GPUI exhausted the native u32 node ID space.');
  }
  processState.__retendGpuiNativeNodeId__ = id + 1;
  return id;
}

export const ComponentInvalidator = Symbol('Invalidator');
export const OverwrittenBy = Symbol('OverwrittenBy');
export const HmrId = Symbol('HmrId');
export const HMRContext = Symbol('HMRContext');
export const HMRScopeContext = Symbol('HMRScopeContext');

const ScopeList = new Map();
export function getHMRScopeList() {
  return ScopeList;
}

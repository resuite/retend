/** @import { Scope } from "./scope.js"; */
/** @import { Cell, SourceCell } from "@adbl/cells"; */
/** @typedef {{
 *    [ComponentInvalidator]?: Cell<Function & UpdatableFn>
 *    __isScopeProviderOf?: Scope
 * } & Function} UpdatableFn
 */

/**
 * @typedef jsxDevFileData
 * @property {string} fileName
 * @property {number} columnNumber
 * @property {number} lineNumber
 */

/**
 * @typedef HmrContext
 * @property {Array<unknown>} old
 * @property {Array<unknown>} new
 * @property {SourceCell<Function | null>} current
 */

import { getGlobalContext } from '../context/index.js';
import { createScope, useScopeContext } from './scope.js';

export const ComponentInvalidator = Symbol('Invalidator');
export const OverwrittenBy = Symbol('OverwrittenBy');
export const HmrId = Symbol('HmrId');
export const HMRContextKey = Symbol('HMRContext');
export const HMRScopeContext = Symbol('HMRScopeContext');

const ScopeList = new Map();
export function getHMRScopeList() {
  return ScopeList;
}

/** @type {Scope<UpdatableFn[]>} */
export const RetendComponentTree = createScope('retend:RetendComponentTree');
export function useComponentAncestry() {
  try {
    return useScopeContext(RetendComponentTree);
  } catch {
    return [];
  }
}

/** @returns {HmrContext | null} */
export function getHMRContext() {
  const { globalData } = getGlobalContext();
  return globalData.get(HMRContextKey);
}

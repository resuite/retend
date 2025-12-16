//@ts-ignore
/** @import { WindowLike } from '../context/index.js'; */

/**
 * Constructs a path with its hash and search parameters.
 * @param {WindowLike} window
 * @returns {string}
 */
export function getFullPath(window) {
  const { location } = window;
  return location.pathname + location.search + location.hash;
}

const PARAM_REGEX = /:(\w+)/g;

/**
 * Constructs a URL path by replacing any matched parameters in the given path with their corresponding values from the `matchResult.params` object. If a parameter is not found, the original match is returned. Additionally, any search query parameters from `matchResult.searchQueryParams` are appended to the final path.
 * @param {string} path - The original path to be constructed.
 * @param {{ params: Map<string, string>, searchQueryParams: URLSearchParams, hash: string | null, path: string }} matchResult - An object containing the matched parameters and search query parameters.
 * @returns {string} The final constructed URL path.
 */
export function constructURL(path, matchResult, includeHashAndSearch = true) {
  // Replace each matched parameter with its corresponding value from the params object.
  let finalPath = path.replace(PARAM_REGEX, (match, paramName) => {
    return matchResult.params.get(paramName) || match; // If the parameter is not found, return the original match.
  });

  if (!includeHashAndSearch) {
    return finalPath;
  }

  // URLSearchParams.size isn't supported in iOS 16.
  let count = 0;
  for (const _ of matchResult.searchQueryParams.keys()) {
    count++;
  }

  if (count > 0) {
    finalPath += `?${matchResult.searchQueryParams.toString()}`;
  }

  if (matchResult.hash) {
    finalPath += `#${matchResult.hash}`;
  }

  return finalPath;
}

/** Anything may open the one search palette by dispatching this on window. */
export const OPEN_SEARCH = 'fidora:search';
export const openSearch = () => window.dispatchEvent(new Event(OPEN_SEARCH));

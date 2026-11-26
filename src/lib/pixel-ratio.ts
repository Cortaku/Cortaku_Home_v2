/**
 * Calls `onChange` when devicePixelRatio changes, as when a window moves to a screen with another density.
 * A ResizeObserver misses that when the CSS size stays the same. Returns a function that stops watching.
 */
export function watchPixelRatio(onChange: () => void): () => void {
  let query: MediaQueryList | null = null;
  const listen = () => {
    query?.removeEventListener('change', changed);
    // This query only matches the current ratio, so it has to be made again after each change.
    query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    query.addEventListener('change', changed);
  };
  const changed = () => {
    listen();
    onChange();
  };
  listen();
  return () => query?.removeEventListener('change', changed);
}

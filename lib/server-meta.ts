import 'server-only';

/**
 * A read for `generateMetadata` only: a link preview that names the agent or
 * the job is worth one quick chain read, and a page that fails to render
 * because that read was slow is not. So it gives up fast and any failure
 * yields null — the page then uses a generic title.
 */
export async function readForMetadata<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await Promise.race([
      read(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1_500)),
    ]);
  } catch {
    return null;
  }
}

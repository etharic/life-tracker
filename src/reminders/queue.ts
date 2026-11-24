/**
 * Runs async jobs one after another. A job started while another runs waits for it, so two
 * reschedules can never interleave (the second's cancel would otherwise land between the first's
 * schedules and leave duplicates). A failed job does not stop the ones after it.
 */
export function serialQueue() {
  let tail: Promise<void> = Promise.resolve();
  return function run(job: () => Promise<void>): Promise<void> {
    const next = tail.then(job, job);
    tail = next.catch(() => undefined);
    return next;
  };
}

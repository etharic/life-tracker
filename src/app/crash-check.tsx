/**
 * Throws while drawing, so the simulator screenshots can show the crash screen
 * (`-LTRoute /crash-check`). Nothing in the app links here.
 */
export default function CrashCheck(): never {
  throw new Error('Crash check: this screen fails on purpose to show the crash screen.');
}

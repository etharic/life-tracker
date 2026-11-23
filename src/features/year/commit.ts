import { activateQuestion, outcomeQuestion } from '@/domain/misogi';
import type { ListLink } from '@/domain/types';
import { askList } from '@/features/list-question';
import { useJournal } from '@/state/journal';

/**
 * Sets the misogi committed at year `year`'s review (for year + 1). Picked from the bucket list,
 * it links to that item; written fresh, it is added to the bucket list first. Changing the pick
 * drops the old link and leaves the old item exactly as it is. Then, once, "Mark it active?".
 */
export async function commitNextMisogi(year: string, text: string, pickedId: string | null): Promise<void> {
  const s = useJournal.getState();
  const clean = text.trim();
  if (!clean) {
    s.updateYear(year, (y) => void (y.nextMisogi = null));
    return;
  }
  const prev = s.years[year]?.nextMisogi ?? null;
  const bucket = s.challenges.bucket;
  let id = pickedId && bucket.find((b) => b.id === pickedId)?.title.trim() === clean ? pickedId : null;
  if (!id) {
    // Writing the same words as the current misogi keeps its link.
    const same = prev?.link && prev.text === clean ? prev.link.id : null;
    id =
      same ??
      bucket.find((b) => b.title.trim().toLowerCase() === clean.toLowerCase())?.id ??
      s.saveChallenge('bucket', { title: clean, date: null, started: false, outcome: 'open', notes: '' });
  }
  const link: ListLink =
    prev?.link && prev.link.kind === 'bucket' && prev.link.id === id
      ? prev.link
      : { kind: 'bucket', id, confirmed: null, outcomeConfirmed: null };
  s.updateYear(year, (y) => {
    y.nextMisogi = {
      text: clean,
      link,
      done: prev && prev.text === clean ? prev.done : null,
      doneOn: prev && prev.text === clean ? prev.doneOn : null,
    };
  });
  const item = useJournal.getState().challenges.bucket.find((b) => b.id === id);
  const q = activateQuestion(link, item);
  if (q) {
    const a = await askList(q);
    if (a) useJournal.getState().answerList({ misogiYear: String(Number(year) + 1) }, 'activate', a);
  }
}

/**
 * Judges the misogi of year `forYear` (from the sitting, Plan's "Done it?" or Today's menu) and
 * asks its one-tap list question, once per judgement.
 */
export async function judgeMisogi(forYear: string, done: boolean, on?: string): Promise<void> {
  useJournal.getState().recordMisogi(forYear, done, on);
  const s = useJournal.getState();
  const m = s.years[String(Number(forYear) - 1)]?.nextMisogi;
  const link = m?.link ?? null;
  const item = link ? s.challenges[link.kind].find((x) => x.id === link.id) : undefined;
  const q = outcomeQuestion(link, item, done);
  if (q) {
    const a = await askList(q);
    if (a) useJournal.getState().answerList({ misogiYear: forYear }, 'outcome', a);
  }
}

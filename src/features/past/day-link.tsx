import { Link, router } from 'expo-router';
import type { ReactElement } from 'react';

import type { ISODate } from '@/domain/types';

/**
 * A link to one day, the way iOS links work at their best: a tap opens it (zooming out of the
 * tapped box when `zoom` is set, as Photos does), and touch and hold shows the day itself as a
 * preview with a short menu under it. `children` must be one pressable element.
 */
export function DayLink({ date, zoom, children }: { date: ISODate; zoom?: boolean; children: ReactElement }) {
  return (
    <Link href={`/day/${date}`} asChild>
      <Link.Trigger withAppleZoom={zoom}>{children}</Link.Trigger>
      <Link.Preview />
      <Link.Menu>
        <Link.MenuAction
          title="Edit this day"
          icon="square.and.pencil"
          onPress={() => router.push(`/close-day/${date}`)}
        />
        <Link.MenuAction title="Add a recording" icon="mic" onPress={() => router.push(`/record/${date}`)} />
      </Link.Menu>
    </Link>
  );
}

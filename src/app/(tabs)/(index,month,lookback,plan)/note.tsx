import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { useJournal } from '@/state/journal';
import { Field } from '@/ui/controls';
import { Explainer, Screen, Section } from '@/ui/layout';

/** An optional note to children and grandchildren, kept at the top of README.txt. */
export default function NoteToReaders() {
  const saved = useJournal((s) => s.settings.noteToReaders);
  const [text, setText] = useState(saved);
  const latest = useRef(text);
  useEffect(() => {
    latest.current = text;
  }, [text]);
  useEffect(
    () => () => {
      if (latest.current.trim() !== useJournal.getState().settings.noteToReaders) {
        useJournal.getState().updateSettings((s) => void (s.noteToReaders = latest.current.trim()));
      }
    },
    [],
  );
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Note to future readers', headerLargeTitleEnabled: true }} />
      <Explainer>
        Whoever opens this journal one day reads this first. It is saved in README.txt, next to your files.
      </Explainer>
      <Section>
        <Field
          value={text}
          onChangeText={setText}
          multiline
          minHeight={260}
          placeholder="Why you kept this journal, and what you hope they take from it."
        />
      </Section>
    </Screen>
  );
}

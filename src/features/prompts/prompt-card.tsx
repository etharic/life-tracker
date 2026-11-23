import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { promptHome, type Prompt } from '@/domain/prompts';
import { useJournal } from '@/state/journal';
import { haptic } from '@/ui/haptics';
import { exitSoft, layoutMove } from '@/ui/motion';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, radius, space, TARGET, type } from '@/ui/theme';

export function promptHref(p: Prompt): Href {
  switch (p.kind) {
    case 'week-close':
      return `/week-close/${p.ref}`;
    case 'week-start':
      return `/week-start/${p.ref}`;
    case 'setup':
      return `/setup/${p.ref}`;
    case 'month-close':
      return `/month-close/${p.ref}`;
    case 'year-close':
      return `/year-review/${p.ref}`;
    case 'backup':
      return '/backup';
  }
}

function SmallButton({ title, onPress, filled }: { title: string; onPress: () => void; filled?: boolean }) {
  return (
    <Press
      onPress={onPress}
      accessibilityLabel={title}
      style={[styles.small, filled ? styles.smallFilled : styles.smallPlain]}
    >
      <T variant="subhead" weight="600" chrome style={{ color: filled ? colors.onAccent : colors.ink2 }}>
        {title}
      </T>
    </Press>
  );
}

function PromptLine({ prompt, single }: { prompt: Prompt; single: boolean }) {
  const [skipping, setSkipping] = useState(false);
  const [note, setNote] = useState('');
  const skippable = prompt.kind !== 'backup';

  const skip = () => {
    useJournal.getState().skipPrompt(promptHome(prompt.kind, prompt.ref), prompt.id, note.trim());
    haptic.commit();
  };

  if (skipping) {
    return (
      <View style={styles.line}>
        <T variant="headline">{`Skip: ${prompt.title.toLowerCase()}`}</T>
        <TextInput
          autoFocus
          value={note}
          onChangeText={setNote}
          placeholder="A note, if you like"
          placeholderTextColor={colors.ink3}
          selectionColor={colors.accent}
          style={styles.note}
          returnKeyType="done"
          onSubmitEditing={skip}
          maxLength={120}
        />
        <View style={styles.actions}>
          <SmallButton title="Back" onPress={() => setSkipping(false)} />
          <SmallButton title="Skip" filled onPress={skip} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.line, !single && styles.lineRow]}>
      <View style={styles.flex}>
        <T variant="headline">{prompt.title}</T>
        <T variant="footnote" tone="ink2">
          {prompt.detail}
        </T>
      </View>
      <View style={styles.actions}>
        {skippable ? <SmallButton title={single ? 'Not now' : 'Skip'} onPress={() => setSkipping(true)} /> : null}
        <SmallButton title={single ? 'Open' : 'Do'} filled onPress={() => router.push(promptHref(prompt))} />
      </View>
    </View>
  );
}

/**
 * The one card at the top of Today. Never a pop-up, never red. Several pending prompts
 * are listed oldest first; a skipped one waits on the Month page.
 */
export function PromptCard({ prompts }: { prompts: Prompt[] }) {
  if (!prompts.length) return null;
  const single = prompts.length === 1;
  // A closed prompt fades out and the card settles around what is left.
  return (
    <Animated.View style={styles.card} accessibilityRole="summary" exiting={exitSoft} layout={layoutMove}>
      {!single ? (
        <T variant="subhead" weight="600" tone="accent">
          {`${prompts.length} things to close`}
        </T>
      ) : null}
      {single ? (
        <PromptLine prompt={prompts[0]} single />
      ) : (
        <View style={styles.list}>
          {prompts.map((p) => (
            <Animated.View key={p.id} style={styles.item} exiting={exitSoft} layout={layoutMove}>
              <PromptLine prompt={p} single={false} />
            </Animated.View>
          ))}
        </View>
      )}
      {!single ? (
        <T variant="footnote" tone="ink2">
          Skipped ones wait on the Month page.
        </T>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  card: { backgroundColor: colors.accentSoft, borderRadius: radius.section, padding: space.l, gap: space.m },
  list: { gap: space.s },
  item: { backgroundColor: colors.surface, borderRadius: radius.control + 2, padding: space.m + 2 },
  line: { gap: space.m },
  lineRow: { flexDirection: 'row', alignItems: 'center' },
  actions: { flexDirection: 'row', gap: space.s, justifyContent: 'flex-end' },
  small: {
    minHeight: 36,
    minWidth: TARGET + 8,
    paddingHorizontal: space.l,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallFilled: { backgroundColor: colors.accentStrong },
  smallPlain: { backgroundColor: colors.scrim },
  note: {
    ...type.body,
    backgroundColor: colors.surface,
    borderRadius: radius.control,
    paddingHorizontal: space.m,
    paddingVertical: space.m,
    color: colors.ink,
  },
});

import {
  Easing,
  FadeOut,
  LinearTransition,
  cubicBezier,
  ReduceMotion,
  withSpring,
  withTiming,
  type CSSTransitionProperties,
  type EntryAnimationsValues,
} from 'react-native-reanimated';

/**
 * Shared motion vocabulary. Springs for anything a finger caused, short fades for content
 * arriving and leaving. Every animation follows the system Reduce Motion setting.
 */
export const RM = ReduceMotion.System;
/** Opacity is kept under Reduce Motion: a fade explains a change without moving anything. */
const FADE_RM = ReduceMotion.Never;

/** Colour changes on selection (a chip, a pill, a box): short and gentle, never instant. */
export const colorEase: CSSTransitionProperties = {
  transitionProperty: ['backgroundColor', 'borderColor'],
  transitionDuration: '160ms',
  transitionTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
};

/** Strong ease-out: moves at once, settles gently. For anything entering or answering a touch. */
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * A quick spring with a trace of overshoot (bounce about 0.2): ticks and selections happen many
 * times a day, so they should feel answered, not bouncy.
 */
export const POP = { damping: 19, stiffness: 420, mass: 0.7, reduceMotion: RM } as const;
/** A calm spring for things moving into place. */
export const SETTLE = { damping: 18, stiffness: 220, mass: 0.9, reduceMotion: RM } as const;

/** A row arriving: fades in while rising 8 pt (not from far away). */
export function enterRow(values: EntryAnimationsValues) {
  'worklet';
  void values;
  return {
    initialValues: { opacity: 0, transform: [{ translateY: 8 }] },
    animations: {
      opacity: withTiming(1, { duration: 220, easing: EASE_OUT, reduceMotion: FADE_RM }),
      transform: [{ translateY: withTiming(0, { duration: 260, easing: EASE_OUT, reduceMotion: RM }) }],
    },
  };
}

/** Content appearing in place: a short ease-out fade. */
export function enterSoft(values: EntryAnimationsValues) {
  'worklet';
  void values;
  return {
    initialValues: { opacity: 0 },
    animations: { opacity: withTiming(1, { duration: 200, easing: EASE_OUT, reduceMotion: FADE_RM }) },
  };
}

/**
 * Something new popping into place (a photo, an achievement): from 92 % and transparent,
 * never from nothing.
 */
export function enterPop(values: EntryAnimationsValues) {
  'worklet';
  void values;
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.92 }] },
    animations: {
      opacity: withTiming(1, { duration: 180, easing: EASE_OUT, reduceMotion: FADE_RM }),
      transform: [{ scale: withSpring(1, POP) }],
    },
  };
}

/** Leaving is quicker than arriving. */
export const exitSoft = FadeOut.duration(150).easing(EASE_OUT).reduceMotion(FADE_RM);
/** Neighbours move aside smoothly when a row appears or leaves. */
export const layoutMove = LinearTransition.springify().damping(20).stiffness(220).reduceMotion(RM);

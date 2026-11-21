import { Easing, FadeIn, FadeInDown, FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';

/**
 * Shared motion vocabulary. Springs for anything a finger caused, short fades for content
 * arriving and leaving. Every animation follows the system Reduce Motion setting.
 */
export const RM = ReduceMotion.System;

/** A lively but settled spring: a small overshoot, done in about 300 ms. */
export const POP = { damping: 11, stiffness: 380, mass: 0.7, reduceMotion: RM } as const;
/** A calm spring for things moving into place. */
export const SETTLE = { damping: 18, stiffness: 220, mass: 0.9, reduceMotion: RM } as const;

export const enterRow = FadeInDown.duration(220)
  .easing(Easing.bezier(0.23, 1, 0.32, 1))
  .reduceMotion(RM);
export const enterSoft = FadeIn.duration(200).reduceMotion(RM);
export const exitSoft = FadeOut.duration(160).reduceMotion(RM);
/** Neighbours move aside smoothly when a row appears or leaves. */
export const layoutMove = LinearTransition.springify().damping(20).stiffness(220).reduceMotion(RM);

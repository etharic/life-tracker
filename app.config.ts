import type { ExpoConfig } from 'expo/config';

const PAPER = '#F7F7F4';
const PHOTOS = 'Photos you choose are added to that day in your journal.';
// One wording for every plugin that touches the microphone (the last plugin to run wins).
const MIC = 'Record voice notes for a day in your journal.';

const config: ExpoConfig = {
  name: 'Life-Tracker',
  slug: 'life-tracker',
  version: '1.22.0',
  scheme: 'lifetracker',
  orientation: 'portrait',
  icon: './assets/icon.png',
  // Light and dark, following the system appearance.
  userInterfaceStyle: 'automatic',
  platforms: ['ios'],
  ios: {
    bundleIdentifier: 'com.etharic.lifetracker',
    icon: { light: './assets/icon.png', dark: './assets/icon-dark.png', tinted: './assets/icon-tinted.png' },
    // Codemagic's build counter, so SideStore always sees a newer build.
    buildNumber: process.env.BUILD_NUMBER ? String(100 + Number(process.env.BUILD_NUMBER)) : '1',
    supportsTablet: false,
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      CADisableMinimumFrameDurationOnPhone: true,
      NSPhotoLibraryUsageDescription: 'Photos you choose are added to that day in your journal.',
    },
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: PAPER,
        image: './assets/splash.png',
        imageWidth: 120,
        dark: { backgroundColor: '#12161C', image: './assets/splash-dark.png' },
      },
    ],
    // The Journal folder appears in the Files app: On My iPhone > Life-Tracker.
    ['expo-file-system', { enableFileSharing: true, supportsOpeningDocumentsInPlace: true }],
    ['expo-image-picker', { photosPermission: PHOTOS, cameraPermission: false, microphonePermission: MIC }],
    ['expo-audio', { microphonePermission: MIC }],
    'expo-sharing',
    ['expo-secure-store', { faceIDPermission: false }],
    'expo-web-browser',
    'expo-video',
    // Reminders are local notifications only. Free signing (SideStore) cannot carry the push
    // entitlement, so remote notifications stay off and aps-environment is never written.
    ['expo-notifications', { enableRemoteNotifications: false }],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
};

export default config;

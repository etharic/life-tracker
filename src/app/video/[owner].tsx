import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { mediaUri } from '@/state/media';
import { Icon } from '@/ui/icon';
import { Press } from '@/ui/press';

/** A day's video, full screen with the system controls. It starts playing when it opens. */
export default function VideoScreen() {
  const { owner, path } = useLocalSearchParams<{ owner: string; path: string }>();
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer(mediaUri(owner, { kind: 'video', path }), (p) => p.play());
  return (
    <View style={styles.fill}>
      <VideoView player={player} style={styles.fill} nativeControls contentFit="contain" allowsPictureInPicture />
      <Press
        onPress={() => router.back()}
        accessibilityLabel="Close"
        hitSlop={12}
        style={[styles.close, { top: insets.top + 8 }]}
      >
        <Icon name="xmark" size={16} color="#FFFFFF" weight="semibold" />
      </Press>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000000' },
  close: {
    position: 'absolute',
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

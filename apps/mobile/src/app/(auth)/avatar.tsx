import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';

import { PrimaryButton } from '@/components/primary-button';
import { StepScreen } from '@/components/step-screen';
import { useSession } from '@/state/session';
import { colors } from '@/theme';
import { push } from '@/lib/nav';

const AVATAR = 149;

export default function AvatarStep() {
  const { draft, updateDraft } = useSession();
  const [uri, setUri] = useState<string | null>(draft.avatarUri);

  const pick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Access to photos', 'Allow access to your photos to choose a profile picture.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) setUri(result.assets[0].uri);
  };

  const next = () => {
    if (!uri) return;
    updateDraft({ avatarUri: uri });
    push('/interests');
  };

  return (
    <StepScreen
      centered
      avoidKeyboard={false}
      footerLift={79}
      title="Set a profile picture"
      subtitle="If you don`t want to share your face, upload images of your interests and topics that match your character"
      footer={
        <Animated.View layout={LinearTransition.duration(260)} style={styles.buttons}>
          {uri ? (
            <Animated.View collapsable={false} entering={FadeInDown.duration(260)}>
              <PrimaryButton title="Change a photo" variant="outline" onPress={pick} />
            </Animated.View>
          ) : null}
          <PrimaryButton title={uri ? 'Continue' : 'Upload from gallery'} onPress={uri ? next : pick} />
        </Animated.View>
      }>
      <View style={styles.center}>
        <View style={styles.avatar}>
          {uri ? (
            <Animated.View collapsable={false} key={uri} entering={FadeIn.duration(350)} style={StyleSheet.absoluteFill}>
              <Image source={{ uri }} style={styles.fill} contentFit="cover" transition={200} />
            </Animated.View>
          ) : (
            <Image source={require('@/assets/icons/avatar-placeholder.png')} style={styles.placeholder} contentFit="cover" />
          )}
        </View>
      </View>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', paddingTop: 41 },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  placeholder: { width: AVATAR * 1.2, height: AVATAR * 1.2 },
  fill: { width: '100%', height: '100%' },
  buttons: { gap: 10 },
});

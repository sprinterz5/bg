import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';

import { PrimaryButton } from '@/components/primary-button';
import { StepScreen } from '@/components/step-screen';
import { INTER_FAMILIES } from '@/components/text';
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
      titleShift={14.42}
      titleStyle={styles.title}
      subtitleStyle={styles.subtitle}
      avoidKeyboard={false}
      footerLift={69}
      title="Set a profile picture"
      subtitle="If you don`t want to share your face, upload images of your interests and topics that match your character"
      footer={
        <Animated.View collapsable={false} layout={LinearTransition.duration(260)} style={styles.buttons}>
          {uri ? (
            <Animated.View collapsable={false} entering={FadeInDown.duration(260)}>
              <PrimaryButton title="Change a photo" variant="outline" onPress={pick} />
            </Animated.View>
          ) : null}
          <PrimaryButton title={uri ? 'Continue' : 'Upload from gallery'} labelStyle={uri ? undefined : styles.uploadLabel} onPress={uri ? next : pick} />
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
  // AutoLayotued: title Inter ExtraBold 30.4 (ink top 115.8), subtitle Inter 16.3 / 23.4 #999 18.8 under
  // it, the picture's top at 251.
  // The frame's column is centred ~3 left of the screen centre (title, text and picture alike).
  title: { fontFamily: INTER_FAMILIES['800'], fontSize: 30.4, lineHeight: 33, letterSpacing: -0.6, transform: [{ translateX: -3 }] },
  subtitle: { marginTop: 18.83, marginHorizontal: 10, fontFamily: INTER_FAMILIES['400'], fontSize: 16.3, lineHeight: 23.4, letterSpacing: 0, color: '#999999', transform: [{ translateX: -3 }] },
  center: { flex: 1, alignItems: 'center', paddingTop: 29.25, transform: [{ translateX: -3.5 }] },
  uploadLabel: { fontFamily: INTER_FAMILIES['600'], fontWeight: 'normal', fontSize: 16.9, letterSpacing: -0.17 },
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
  buttons: { gap: 11.5 },
});

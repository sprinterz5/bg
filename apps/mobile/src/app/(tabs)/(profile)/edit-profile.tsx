import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { INTER_FAMILIES, Text, TextInput } from '@/components/text';
import { setAvatar } from '@/lib/auth';
import { back } from '@/lib/nav';
import { fetchProfile, takeSavedBio, updateMe } from '@/lib/users';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

// "The ORIG. toolbar + orig. SEARCH page" exports (filled bio / empty bio). Rows: label at x 19.7, value at 124.7,
// underline from 125.5 to 368.5; rows step 58. Username can't be changed by the backend yet, so it is read-only.
const LINE = '#E9E9E9';
const MUTED = '#999999';

export default function EditProfile() {
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useSession();
  const [name, setName] = useState(user?.name ?? '');
  const [bio, setBio] = useState<string | null>(null);
  const savedBio = useRef<string | null>(null); // the bio the server has
  const username = user?.username;

  useFocusEffect(
    useCallback(() => {
      const saved = takeSavedBio();
      if (saved !== null) setBio(saved);
      if (!username) return;
      let alive = true;
      fetchProfile(username)
        .then((p) => {
          if (!alive) return;
          savedBio.current = p.bio ?? '';
          if (saved === null) setBio(p.bio ?? '');
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, [username]),
  );

  // Not designed: "Saved" fades in at the top right for a moment after a change reaches the server, and the picture
  // is dimmed under a spinner while it uploads.
  const [savedFlash, setSavedFlash] = useState(0);
  const [uploading, setUploading] = useState(false);

  if (!user) return null;

  const flash = () => {
    const n = Date.now();
    setSavedFlash(n);
    setTimeout(() => setSavedFlash((v) => (v === n ? 0 : v)), 1400);
  };

  const saveName = () => {
    const next = name.trim();
    if (!next || next === user.name) return setName(user.name);
    updateUser({ name: next });
    updateMe({ displayName: next }).then(flash, () => {
      updateUser({ name: user.name });
      setName(user.name);
      Alert.alert("Couldn't save the name", 'Check the connection and try again.');
    });
  };

  const saveBio = () => {
    const next = (bio ?? '').trim();
    if (next === (savedBio.current ?? '')) return;
    const before = savedBio.current;
    savedBio.current = next;
    updateMe({ bio: next }).then(flash, () => {
      savedBio.current = before;
      Alert.alert("Couldn't save the bio", 'Check the connection and try again.');
    });
  };

  const pickPicture = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    const uri = result.canceled ? null : result.assets[0]?.uri;
    if (!uri) return;
    const before = user.avatarUri;
    updateUser({ avatarUri: uri });
    setUploading(true);
    setAvatar(uri)
      .then((url) => {
        if (url) updateUser({ avatarUri: url });
        flash();
      })
      .catch(() => {
        updateUser({ avatarUri: before });
        Alert.alert("Couldn't change the picture", 'Check the connection and try again.');
      })
      .finally(() => setUploading(false));
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <PressableScale onPress={() => back()} hitSlop={8} scaleTo={0.88} accessibilityLabel="Back" style={styles.back}>
          <Icon name="searchBack" width={11} height={20} />
        </PressableScale>
        <Text style={styles.title}>Edit profile</Text>
        {savedFlash ? (
          <Animated.View key={savedFlash} collapsable={false} entering={FadeIn.duration(180)} exiting={FadeOut.duration(300)} style={styles.saved}>
            <Text style={styles.savedText}>Saved</Text>
          </Animated.View>
        ) : null}
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: 24 }}>
        <PressableScale onPress={pickPicture} scaleTo={0.97} style={styles.picture} accessibilityRole="button" accessibilityLabel="Edit picture">
          <View>
          {user.avatarUri ? (
            <Image source={{ uri: user.avatarUri }} style={styles.avatar} transition={250} />
          ) : (
            <Icon name="avatarPlaceholder" width={98} style={styles.avatar} />
          )}
          {uploading ? (
            <Animated.View collapsable={false} entering={FadeIn.duration(150)} exiting={FadeOut.duration(250)} style={styles.uploading}>
              <ActivityIndicator color="#FFFFFF" />
            </Animated.View>
          ) : null}
          </View>
          <Text style={styles.edit}>Edit picture</Text>
        </PressableScale>
        <View style={styles.rule} />

        <View style={styles.rows}>
          <View style={styles.row}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              onBlur={saveName}
              onSubmitEditing={saveName}
              returnKeyType="done"
              maxLength={80}
              autoCorrect={false}
              cursorColor={colors.text}
              style={[styles.value, styles.input]}
              accessibilityLabel="Name"
            />
            <View style={styles.underline} />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Username</Text>
            <Text style={styles.value} numberOfLines={1}>
              {user.username}
            </Text>
            <View style={styles.underline} />
          </View>
          {/* Bio edited right here (asked for instead of the separate Edit bio screen); saved when the field loses focus */}
          <View style={styles.bioRow}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              value={bio ?? ''}
              onChangeText={setBio}
              onBlur={saveBio}
              placeholder="Enter"
              placeholderTextColor={MUTED}
              multiline
              maxLength={150}
              cursorColor={colors.text}
              style={styles.bioInput}
              accessibilityLabel="Bio"
            />
            <View style={[styles.bioLine, styles.bioUnderline]} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { height: 59, borderBottomWidth: 0.5, borderBottomColor: LINE },
  back: { position: 'absolute', left: 13, top: 4, width: 43, height: 43, borderRadius: 21.5, backgroundColor: '#F2F2F2', paddingLeft: 14, paddingTop: 12 },
  title: { position: 'absolute', left: 0, right: 6, top: 17.67, textAlign: 'center', fontFamily: INTER_FAMILIES['700'], fontSize: 17, lineHeight: 21, color: colors.text },
  picture: { alignItems: 'center', paddingTop: 25 },
  avatar: { width: 98, height: 98, borderRadius: 49, marginRight: 6 },
  uploading: { position: 'absolute', top: 0, left: 0, width: 98, height: 98, borderRadius: 49, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  saved: { position: 'absolute', right: 18, top: 0, bottom: 0, justifyContent: 'center' },
  savedText: { fontFamily: INTER_FAMILIES['500'], fontSize: 14, lineHeight: 17, color: MUTED },
  edit: { marginTop: 19.91, marginBottom: 8.59, marginLeft: -2, fontFamily: INTER_FAMILIES['600'], fontSize: 14, lineHeight: 17, color: colors.text },
  rule: { height: 1, backgroundColor: LINE },
  rows: { marginTop: 1 },
  row: { height: 58 },
  label: { position: 'absolute', left: 19.7, top: 29.55, fontFamily: INTER_FAMILIES['400'], fontSize: 15, lineHeight: 18, color: colors.text },
  value: { position: 'absolute', left: 124.7, right: 21.5, top: 29.75, fontFamily: INTER_FAMILIES['400'], fontSize: 15, lineHeight: 18, color: colors.text },
  input: { height: 18, padding: 0, margin: 0 },
  bio: { position: 'absolute', left: 128.1, right: 21, top: 16.3, fontFamily: INTER_FAMILIES['400'], fontSize: 12.5, lineHeight: 17.5, letterSpacing: 0.55, color: colors.text },
  underline: { position: 'absolute', left: 125.5, width: 243, top: 57, height: 1, backgroundColor: LINE },
  bioUnderline: { left: 126.5 },
  bioRow: { minHeight: 58, paddingTop: 27.75, paddingBottom: 12 },
  bioInput: { marginLeft: 124.7, marginRight: 21.5, padding: 0, paddingTop: 0, fontFamily: INTER_FAMILIES['400'], fontSize: 15, lineHeight: 20, color: colors.text },
  bioLine: { position: 'absolute', bottom: 0, width: 243, height: 1, backgroundColor: LINE },
});

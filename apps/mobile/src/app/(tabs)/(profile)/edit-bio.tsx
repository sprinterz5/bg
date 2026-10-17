import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { INTER_FAMILIES, Text, TextInput } from '@/components/text';
import { back } from '@/lib/nav';
import { fetchProfile, saveBio } from '@/lib/users';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

// "The ORIG. toolbar + orig. SEARCH page-2": white page, field between two rules, saved on the way back.
const LINE = '#E9E9E9';
const MAX = 1000;

export default function EditBio() {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const [text, setText] = useState<string | null>(null);
  const initial = useRef<string | null>(null);
  const latest = useRef<string | null>(null);
  const username = user?.username;

  useEffect(() => {
    if (!username) return;
    let alive = true;
    fetchProfile(username)
      .then((p) => {
        if (!alive) return;
        initial.current = p.bio ?? '';
        setText((t) => t ?? p.bio ?? '');
      })
      .catch(() => alive && setText((t) => t ?? ''));
    return () => {
      alive = false;
    };
  }, [username]);

  useEffect(() => {
    latest.current = text;
  }, [text]);

  // Leaving the screen (back button or swipe) saves the bio if it changed.
  useEffect(
    () => () => {
      const next = latest.current?.trim();
      if (next === undefined || initial.current === null || next === initial.current) return;
      saveBio(next).catch(() => Alert.alert("Couldn't save the bio", 'Check the connection and try again.'));
    },
    [],
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <PressableScale onPress={() => back()} hitSlop={12} scaleTo={0.85} accessibilityLabel="Back" style={styles.back}>
          <Icon name="searchBack" width={11} height={21} />
        </PressableScale>
        <Text style={styles.title}>Bio</Text>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={styles.field}>
          {text !== null ? (
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              autoFocus
              maxLength={MAX}
              placeholder="Tell people about yourself"
              placeholderTextColor="#999999"
              selectionColor={colors.primary}
              cursorColor={colors.text}
              scrollEnabled={false}
              style={styles.input}
              accessibilityLabel="Bio"
            />
          ) : (
            <View style={styles.inputPlaceholder} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { height: 60, borderBottomWidth: 0.5, borderBottomColor: LINE },
  back: { position: 'absolute', left: 28, top: 18 },
  title: { position: 'absolute', left: 0, right: 0, top: 19.67, textAlign: 'center', fontFamily: INTER_FAMILIES['700'], fontSize: 17, lineHeight: 21, color: colors.text },
  field: { paddingTop: 16.38, paddingBottom: 12.62, paddingLeft: 19.65, paddingRight: 20, borderBottomWidth: 1, borderBottomColor: LINE },
  input: { padding: 0, margin: 0, minHeight: 18, textAlignVertical: 'top', fontFamily: INTER_FAMILIES['400'], fontSize: 12.5, lineHeight: 18, letterSpacing: 0.55, color: colors.text },
  inputPlaceholder: { height: 18 },
});

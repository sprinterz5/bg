import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BigInput } from '@/components/big-input';
import { FieldMessage } from '@/components/field-message';
import { PrimaryButton } from '@/components/primary-button';
import { StepScreen } from '@/components/step-screen';
import { loginWithUsername, normalizeUsername } from '@/mock/api';
import { useSession } from '@/state/session';
import { colors } from '@/theme';
import { Text, TextInput } from '@/components/text';

export default function Login() {
  const { signIn } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const valid = username.length >= 3 && password.length >= 6;

  const submit = async () => {
    if (!valid || loading) return;
    setLoading(true);
    setError(false);
    const user = await loginWithUsername(username, password);
    setLoading(false);
    if (!user) return setError(true);
    signIn(user);
    router.replace('/(tabs)');
  };

  return (
    <StepScreen
      title="Log in"
      footer={<PrimaryButton title="Log in" enabled={valid} loading={loading} onPress={submit} />}>
      <View style={styles.row}>
        <Text style={styles.at}>@</Text>
        <BigInput
          autoFocus
          value={username}
          onChangeText={(v) => {
            setUsername(normalizeUsername(v));
            setError(false);
          }}
          placeholder="username"
          autoCapitalize="none"
          autoComplete="username"
          textContentType="username"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          accessibilityLabel="Username"
        />
      </View>
      <View style={[styles.row, styles.passwordRow]}>
        <BigInput
          ref={passwordRef}
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setError(false);
          }}
          placeholder="password"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
          accessibilityLabel="Password"
        />
      </View>
      {error ? <FieldMessage tone="error" text="wrong username or password" /> : null}
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  passwordRow: { marginTop: 22 },
  at: { fontSize: 32, fontWeight: '900', color: colors.text, marginTop: -2 },
});

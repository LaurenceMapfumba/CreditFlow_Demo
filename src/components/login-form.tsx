import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';

const BLUE = '#2563EB';
const CARD_DARK = '#1E3A8A';

type Mode = 'login' | 'register';

const ROLES = [
  { label: 'Borrower', value: 'BORROWER' },
  { label: 'Lender', value: 'LENDER' },
  { label: 'Investor', value: 'INVESTOR' },
];

export default function LoginForm() {
  const theme = useTheme();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register extra fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState('BORROWER');

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
          phoneNumber: phoneNumber.trim(),
          role,
        });
      }
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Check the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = [styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Hero card */}
        <View style={styles.hero}>
          <View style={[styles.logoCircle, { backgroundColor: CARD_DARK }]}>
            <ThemedText style={styles.logoText}>CF</ThemedText>
          </View>
          <ThemedText style={styles.appName}>CreditFlow</ThemedText>
          <ThemedText style={styles.tagline}>Peer-to-peer lending in Zimbabwe</ThemedText>
        </View>

        {/* Tab toggle */}
        <View style={[styles.toggle, { backgroundColor: theme.backgroundElement }]}>
          {(['login', 'register'] as Mode[]).map(m => (
            <Pressable
              key={m}
              style={[styles.toggleBtn, mode === m && { backgroundColor: BLUE }]}
              onPress={() => { setMode(m); setError(null); setShowPassword(false); }}>
              <ThemedText style={[styles.toggleLabel, mode === m && styles.activeLabel]}>
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {/* Form */}
        <View style={styles.form}>
          {mode === 'register' && (
            <>
              <TextInput
                style={inputStyle}
                placeholder="First name"
                placeholderTextColor={theme.textSecondary}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
              />
              <TextInput
                style={inputStyle}
                placeholder="Last name"
                placeholderTextColor={theme.textSecondary}
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
              />
            </>
          )}

          <TextInput
            style={inputStyle}
            placeholder="Email address"
            placeholderTextColor={theme.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <View style={[styles.passwordRow, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
            <TextInput
              style={[styles.passwordInput, { color: theme.text }]}
              placeholder="Password"
              placeholderTextColor={theme.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <Pressable
              onPress={() => setShowPassword(v => !v)}
              style={styles.eyeBtn}
              hitSlop={8}>
              <ThemedText style={[styles.eyeText, { color: theme.textSecondary }]}>
                {showPassword ? 'Hide' : 'Show'}
              </ThemedText>
            </Pressable>
          </View>

          {mode === 'register' && (
            <>
              <TextInput
                style={inputStyle}
                placeholder="Phone number (e.g. +2637712345)"
                placeholderTextColor={theme.textSecondary}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
              />

              {/* Role picker */}
              <ThemedText style={styles.roleLabel}>Account type</ThemedText>
              <View style={styles.roleRow}>
                {ROLES.map(r => (
                  <Pressable
                    key={r.value}
                    style={[styles.roleChip, { borderColor: role === r.value ? BLUE : theme.backgroundSelected, backgroundColor: role === r.value ? BLUE + '22' : theme.backgroundElement }]}
                    onPress={() => setRole(r.value)}>
                    <ThemedText style={[styles.roleChipText, role === r.value && { color: BLUE }]}>
                      {r.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {error && (
            <View style={styles.errorBox}>
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [styles.submitBtn, pressed && styles.pressed, loading && styles.disabled]}
            onPress={handleSubmit}
            disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <ThemedText style={styles.submitBtnText}>{mode === 'login' ? 'Sign In' : 'Create Account'}</ThemedText>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: Spacing.four, paddingVertical: Spacing.six, gap: Spacing.four },
  hero: { alignItems: 'center', gap: Spacing.two },
  logoCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#fff', fontSize: 26, fontWeight: '800' },
  appName: { color: '#2563EB', fontSize: 28, fontWeight: '800' },
  tagline: { color: '#6B7280', fontSize: 14 },
  toggle: { flexDirection: 'row', borderRadius: Spacing.three, padding: 4 },
  toggleBtn: { flex: 1, paddingVertical: Spacing.two, borderRadius: Spacing.two + 2, alignItems: 'center' },
  toggleLabel: { fontSize: 14, fontWeight: '600' },
  activeLabel: { color: '#fff' },
  form: { gap: Spacing.three },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 15,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: Spacing.three,
    fontSize: 15,
  },
  eyeBtn: { paddingLeft: Spacing.two },
  eyeText: { fontSize: 13, fontWeight: '600' },
  roleLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  roleRow: { flexDirection: 'row', gap: Spacing.two },
  roleChip: { flex: 1, paddingVertical: Spacing.two, borderRadius: Spacing.two, borderWidth: 1.5, alignItems: 'center' },
  roleChipText: { fontSize: 13, fontWeight: '600' },
  errorBox: { backgroundColor: '#FEE2E2', borderRadius: Spacing.two, padding: Spacing.three },
  errorText: { color: '#DC2626', fontSize: 13 },
  submitBtn: { backgroundColor: BLUE, paddingVertical: Spacing.three + 2, borderRadius: Spacing.three, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.6 },
});

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COLORS } from '../constants/colors';

const AuthScreen = () => {
  const { login, register, resetPassword } = useApp();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields'); return;
    }
    if (mode === 'register') {
      if (!name.trim()) { Alert.alert('Error', 'Please enter your name'); return; }
      if (password !== confirmPassword) { Alert.alert('Error', 'Passwords do not match'); return; }
      if (password.length < 6) { Alert.alert('Error', 'Password must be at least 6 characters'); return; }
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email.trim().toLowerCase(), password);
      } else {
        await register(name.trim(), email.trim().toLowerCase(), password);
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Reset Password', 'Enter your email address above, then tap Forgot Password.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email.trim().toLowerCase());
      Alert.alert('Check your email', `A password reset link has been sent to ${email.trim().toLowerCase()}.`);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = async () => {
    const demoEmail = 'alice@demo.com';
    const demoPassword = 'demo123';
    setMode('login');
    setEmail(demoEmail);
    setPassword(demoPassword);
    setLoading(true);
    try {
      await login(demoEmail, demoPassword);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={COLORS.primaryGradient} style={styles.gradient}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoBox}>
              <Ionicons name="receipt" size={40} color="#fff" />
            </View>
            <Text style={styles.appName}>SplitWise</Text>
            <Text style={styles.tagline}>Split expenses, stay friends</Text>
          </View>

          <View style={styles.card}>
            {/* Tab Toggle */}
            <View style={styles.toggle}>
              <TouchableOpacity activeOpacity={0.7} style={[styles.toggleBtn, mode === 'login' && styles.toggleActive]} onPress={() => setMode('login')}>
                <Text style={[styles.toggleText, mode === 'login' && styles.toggleTextActive]}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7} style={[styles.toggleBtn, mode === 'register' && styles.toggleActive]} onPress={() => setMode('register')}>
                <Text style={[styles.toggleText, mode === 'register' && styles.toggleTextActive]}>Sign Up</Text>
              </TouchableOpacity>
            </View>

            {mode === 'register' && (
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color={COLORS.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor={COLORS.textMuted}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoComplete="name"
                />
              </View>
            )}

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={COLORS.textLight} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={COLORS.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.textLight} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Password"
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <TouchableOpacity activeOpacity={0.7} onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                <Ionicons name={showPass ? 'eye-off' : 'eye'} size={20} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>

            {mode === 'register' && (
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={COLORS.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  placeholderTextColor={COLORS.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPass}
                  autoComplete="new-password"
                />
              </View>
            )}

            <TouchableOpacity activeOpacity={0.7} style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.submitText}>{mode === 'login' ? 'Sign In' : 'Create Account'}</Text>
              )}
            </TouchableOpacity>

            {mode === 'login' && (
              <TouchableOpacity activeOpacity={0.7} style={styles.forgotBtn} onPress={handleForgotPassword}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            )}

            {mode === 'login' && (
              <TouchableOpacity activeOpacity={0.7} style={styles.demoBtn} onPress={fillDemo}>
                <Ionicons name="flash" size={16} color={COLORS.primary} />
                <Text style={styles.demoText}>Use Demo Account (alice@demo.com)</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.footer}>
            {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <Text style={styles.footerLink} onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? 'Sign Up' : 'Sign In'}
            </Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  logoContainer: { alignItems: 'center', marginBottom: 32 },
  logoBox: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center',
    marginBottom: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
  },
  appName: { fontSize: 34, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4, letterSpacing: 0.2 },
  card: {
    backgroundColor: '#1a1a24', borderRadius: 28, padding: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: 'rgba(0,212,170,0.15)', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1, shadowRadius: 28, elevation: 12,
  },
  toggle: {
    flexDirection: 'row', backgroundColor: COLORS.background,
    borderRadius: 14, padding: 4, marginBottom: 20,
  },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  toggleActive: { backgroundColor: 'rgba(255,255,255,0.08)', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 2 },
  toggleText: { fontSize: 15, fontWeight: '500', color: COLORS.textLight },
  toggleTextActive: { color: COLORS.primary, fontWeight: '700' },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.background, borderRadius: 14,
    paddingHorizontal: 14, marginBottom: 12, height: 54,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: COLORS.text },
  eyeBtn: { padding: 4 },
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14,
    height: 54, alignItems: 'center', justifyContent: 'center',
    marginTop: 8, shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35,
    shadowRadius: 12, elevation: 8,
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  forgotBtn: { alignItems: 'center', marginTop: 10, padding: 8 },
  forgotText: { color: COLORS.textLight, fontSize: 13, fontWeight: '500' },
  demoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 4, padding: 10,
  },
  demoText: { color: COLORS.primary, marginLeft: 6, fontSize: 13, fontWeight: '500' },
  footer: { textAlign: 'center', marginTop: 24, color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  footerLink: { color: '#fff', fontWeight: '700' },
});

export default AuthScreen;

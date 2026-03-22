import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

const BackgroundOrbs = () => {
  const pulse1 = useRef(new Animated.Value(0.2)).current;
  const pulse2 = useRef(new Animated.Value(0.1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse1, { toValue: 0.35, duration: 2800, useNativeDriver: true }),
        Animated.timing(pulse1, { toValue: 0.2, duration: 2800, useNativeDriver: true }),
      ])
    ).start();
    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse2, { toValue: 0.18, duration: 2800, useNativeDriver: true }),
          Animated.timing(pulse2, { toValue: 0.08, duration: 2800, useNativeDriver: true }),
        ])
      ).start();
    }, 1000);
  }, []);

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View style={[styles.orb1, { opacity: pulse1 }]} />
      <Animated.View style={[styles.orb2, { opacity: pulse2 }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    overflow: 'hidden',
  },
  orb1: {
    position: 'absolute', top: -80, right: -80,
    width: 320, height: 320, borderRadius: 160,
    backgroundColor: '#00d4aa',
    // React Native doesn't have CSS blur, so we use a large borderRadius + opacity trick
    // For blur effect, we stack multiple orbs with increasing transparency
  },
  orb2: {
    position: 'absolute', top: 300, left: -80,
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: '#ff6b6b',
  },
});

export default BackgroundOrbs;

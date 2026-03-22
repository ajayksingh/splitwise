import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, StatusBar,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence } from 'react-native-reanimated';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
import { useFocusEffect } from '@react-navigation/native';
import { hapticMedium } from '../utils/haptics';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COLORS, GROUP_TYPES } from '../constants/colors';
import Avatar from '../components/Avatar';
import BackgroundOrbs from '../components/BackgroundOrbs';
import { getExpenses } from '../services/storage';
import { formatAmount } from '../services/currency';

const GroupsScreen = ({ navigation }) => {
  const { groups, currency, refresh } = useApp();
  const [groupTotals, setGroupTotals] = useState({});

  const fabScale = useSharedValue(1);
  const fabAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }));

  const handleFabPress = () => {
    hapticMedium();
    fabScale.value = withSequence(
      withSpring(0.87, { damping: 8, stiffness: 400 }),
      withSpring(1, { damping: 12, stiffness: 300 })
    );
    navigation.navigate('CreateGroup');
  };

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  // Load total expenses per group
  useEffect(() => {
    if (!groups.length) return;
    const load = async () => {
      const totals = {};
      await Promise.all(groups.map(async (g) => {
        try {
          const expenses = await getExpenses(g.id);
          totals[g.id] = expenses.reduce((s, e) => s + (e.amount || 0), 0);
        } catch { totals[g.id] = 0; }
      }));
      setGroupTotals(totals);
    };
    load();
  }, [groups]);

  const renderGroup = ({ item }) => {
    const typeInfo = GROUP_TYPES.find(t => t.id === item.type) || GROUP_TYPES[3];
    const total = groupTotals[item.id] || 0;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.groupCard}
        onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
      >
        <View style={styles.groupIconBox}>
          <Text style={styles.groupEmoji}>{typeInfo.emoji}</Text>
        </View>
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{item.name}</Text>
          <View style={styles.groupMetaRow}>
            <Text style={styles.groupMeta}>{item.members.length} member{item.members.length !== 1 ? 's' : ''}</Text>
            {total > 0 && (
              <>
                <Text style={styles.groupMetaDot}>·</Text>
                <Text style={styles.groupMetaTotal}>{formatAmount(total, currency)} total</Text>
              </>
            )}
          </View>
        </View>
        <View style={styles.groupRight}>
          <View style={styles.memberAvatarRow}>
            {item.members.slice(0, 3).map((m, idx) => (
              <View key={m.id} style={[styles.memberAvatarWrap, { marginLeft: idx > 0 ? -10 : 0, zIndex: 3 - idx }]}>
                <Avatar name={m.name} avatar={m.avatar} size={28} />
              </View>
            ))}
            {item.members.length > 3 && (
              <View style={[styles.memberAvatarWrap, styles.memberMore, { marginLeft: -10 }]}>
                <Text style={styles.memberMoreText}>+{item.members.length - 3}</Text>
              </View>
            )}
          </View>
          <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} style={{ marginTop: 6 }} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <BackgroundOrbs />
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0f" />
      <View style={styles.header}>
        <Text style={styles.title}>Groups</Text>
        <TouchableOpacity testID="add-group-btn" accessibilityLabel="add" activeOpacity={0.7} style={styles.addBtn} onPress={() => navigation.navigate('CreateGroup')}>
          <Ionicons name="add" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {groups.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>👥</Text>
          <Text style={styles.emptyTitle}>No groups yet</Text>
          <Text style={styles.emptyText}>Create a group to start splitting expenses with friends</Text>
          <TouchableOpacity activeOpacity={0.7} style={styles.createBtn} onPress={() => navigation.navigate('CreateGroup')}>
            <Ionicons name="add" size={20} color="#0a0a0f" />
            <Text style={styles.createBtnText}>New Group</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={item => item.id}
          renderItem={renderGroup}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB for creating groups */}
      <AnimatedTouchable
        testID="fab-add-group"
        activeOpacity={0.85}
        style={[styles.fab, fabAnimStyle]}
        onPress={handleFabPress}
      >
        <Ionicons name="add" size={28} color="#0a0a0f" />
      </AnimatedTouchable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  fab: {
    position: 'absolute', bottom: 100, right: 24,
    width: 58, height: 58, borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 60, paddingHorizontal: 20, paddingBottom: 14,
    backgroundColor: 'rgba(10,10,15,0.95)',
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.text },
  addBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(0,212,170,0.2)',
  },

  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 },
  groupCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 20,
    padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  groupIconBox: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14, borderWidth: 1, borderColor: COLORS.border,
  },
  groupEmoji: { fontSize: 26 },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  groupMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  groupMeta: { fontSize: 13, color: COLORS.textLight },
  groupMetaDot: { fontSize: 13, color: COLORS.textMuted },
  groupMetaTotal: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  groupRight: { alignItems: 'flex-end' },
  memberAvatarRow: { flexDirection: 'row', alignItems: 'center' },
  memberAvatarWrap: { borderWidth: 2, borderColor: COLORS.white, borderRadius: 16 },
  memberMore: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center',
  },
  memberMoreText: { fontSize: 10, color: COLORS.textLight, fontWeight: '700' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  emptyText: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 13,
  },
  createBtnText: { color: '#0a0a0f', fontWeight: '800', marginLeft: 8, fontSize: 15 },

});

export default GroupsScreen;

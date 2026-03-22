import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, SectionList, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COLORS, CATEGORIES } from '../constants/colors';
import BackgroundOrbs from '../components/BackgroundOrbs';
import { formatCurrency, formatDate } from '../utils/splitCalculator';

const ActivityScreen = ({ navigation }) => {
  const { activity, groups, refresh } = useApp();
  const [filterGroupId, setFilterGroupId] = useState('all');

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const getActivityConfig = (item) => {
    switch (item.type) {
      case 'expense_added': {
        // Try to match category from item.category, fall back to general
        const cat = CATEGORIES.find(c => c.id === item.category);
        return { emoji: cat?.emoji || '📝', color: cat?.color || '#64748B' };
      }
      case 'settlement': return { emoji: '💰', color: '#00d4aa' };
      case 'group_created': return { emoji: '👥', color: '#00d4aa' };
      default: return { emoji: '📝', color: '#a1a1aa' };
    }
  };

  const getTitle = (item) => {
    switch (item.type) {
      case 'expense_added': return item.description || 'Expense';
      case 'settlement': return 'Payment recorded';
      case 'group_created': return item.groupName ? `Group "${item.groupName}" created` : 'New group';
      default: return 'Activity';
    }
  };

  const getSubtitle = (item) => {
    switch (item.type) {
      case 'expense_added':
        return `${item.paidByName || 'Someone'} paid ${formatCurrency(item.amount)}${item.groupName ? ` · ${item.groupName}` : ''}`;
      case 'settlement':
        return formatCurrency(item.amount);
      default: return '';
    }
  };

  const sections = useMemo(() => {
    const filtered = filterGroupId === 'all'
      ? activity
      : activity.filter(a => a.groupId === filterGroupId);

    const byMonth = {};
    filtered.forEach(item => {
      const d = new Date(item.createdAt);
      const key = isNaN(d) ? 'Unknown' : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      if (!byMonth[key]) byMonth[key] = [];
      byMonth[key].push(item);
    });

    return Object.entries(byMonth).map(([month, data]) => ({
      title: month,
      data,
      total: data.filter(i => i.type === 'expense_added').reduce((s, i) => s + (i.amount || 0), 0),
    }));
  }, [activity, filterGroupId]);

  return (
    <View style={styles.container}>
      <BackgroundOrbs />
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0f" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activity</Text>
      </View>

      {/* Group filter */}
      <View style={styles.filterRow}>
        <View style={styles.filterIcon}>
          <Ionicons name="filter" size={16} color={COLORS.primary} />
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.filterChip, filterGroupId === 'all' && styles.filterChipActive]}
          onPress={() => setFilterGroupId('all')}
        >
          <Text style={[styles.filterChipText, filterGroupId === 'all' && styles.filterChipTextActive]}>All</Text>
        </TouchableOpacity>
        {groups.map(g => (
          <TouchableOpacity
            activeOpacity={0.7}
            key={g.id}
            style={[styles.filterChip, filterGroupId === g.id && styles.filterChipActive]}
            onPress={() => setFilterGroupId(g.id)}
          >
            <Text style={[styles.filterChipText, filterGroupId === g.id && styles.filterChipTextActive]} numberOfLines={1}>
              {g.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {sections.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📝</Text>
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.emptyText}>Your expense history will appear here</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, idx) => item.id || String(idx)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderSectionHeader={({ section }) => (
            <Text style={styles.monthHeader}>{section.title}</Text>
          )}
          renderSectionFooter={({ section }) =>
            section.total > 0 ? (
              <View style={styles.monthFooter}>
                <Text style={styles.monthFooterLeft}>{section.data.length} expense{section.data.length !== 1 ? 's' : ''}</Text>
                <Text style={styles.monthFooterRight}>Total: {formatCurrency(section.total)}</Text>
              </View>
            ) : null
          }
          renderItem={({ item, index, section }) => {
            const config = getActivityConfig(item);
            const isLast = index === section.data.length - 1;
            return (
              <View style={[styles.itemContainer, index === 0 && styles.itemFirst, isLast && styles.itemLast]}>
                <View style={[styles.iconBox, { backgroundColor: config.color + '18' }]}>
                  <Text style={styles.iconEmoji}>{config.emoji}</Text>
                </View>
                <View style={styles.itemContent}>
                  <Text style={styles.itemTitle} numberOfLines={2}>{getTitle(item)}</Text>
                  {getSubtitle(item) ? <Text style={styles.itemSub}>{getSubtitle(item)}</Text> : null}
                </View>
                <Text style={styles.itemTime}>{formatDate(item.createdAt)}</Text>
                {!isLast && <View style={styles.divider} />}
              </View>
            );
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingTop: 60, paddingHorizontal: 20, paddingBottom: 14,
    backgroundColor: 'rgba(10,10,15,0.95)',
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.text },

  filterRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 12, gap: 8, flexWrap: 'nowrap',
  },
  filterIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 13, color: COLORS.textLight, fontWeight: '600' },
  filterChipTextActive: { color: '#0a0a0f' },

  monthHeader: {
    fontSize: 13, fontWeight: '800', color: COLORS.textLight,
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  monthFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 16, marginTop: 8, marginBottom: 4,
    backgroundColor: COLORS.primaryLight, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(0,212,170,0.2)',
  },
  monthFooterLeft: { fontSize: 12, color: COLORS.textLight, fontWeight: '600' },
  monthFooterRight: { fontSize: 13, fontWeight: '800', color: COLORS.text },

  itemContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, marginHorizontal: 16,
    padding: 14, position: 'relative',
  },
  itemFirst: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  itemLast: { borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  iconBox: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0 },
  iconEmoji: { fontSize: 20 },
  itemContent: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text, lineHeight: 20 },
  itemSub: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  itemTime: { fontSize: 11, color: COLORS.textMuted, marginLeft: 8 },
  divider: { position: 'absolute', bottom: 0, left: 68, right: 0, height: 1, backgroundColor: COLORS.border },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  emptyText: { fontSize: 14, color: COLORS.textLight, textAlign: 'center' },
});

export default ActivityScreen;

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COLORS, CATEGORIES } from '../constants/colors';
import Avatar from '../components/Avatar';
import { getGroup, getExpenses, calculateGroupBalances, addMemberToGroup, searchUsersByEmail, deleteExpense } from '../services/storage';
import { formatCurrency, formatDate, getSimplifiedDebts } from '../utils/splitCalculator';
import { confirmAlert } from '../utils/alert';

const GroupDetailScreen = ({ route, navigation }) => {
  const { groupId } = route.params;
  const { user, refresh: globalRefresh, notifyWrite } = useApp();
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [memberBalances, setMemberBalances] = useState([]);
  const [tab, setTab] = useState('expenses'); // expenses | balances | members
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [g, e] = await Promise.all([getGroup(groupId), getExpenses(groupId)]);
    if (g) {
      setGroup(g);
      const mb = await calculateGroupBalances(groupId, g.members);
      setMemberBalances(mb);
    }
    setExpenses(e);
    setLoading(false);
  }, [groupId]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleDeleteExpense = (expense) => {
    confirmAlert({
      title: 'Delete Expense',
      message: `Delete "${expense.description}"?`,
      confirmText: 'Delete',
      destructive: true,
      onConfirm: async () => {
        await deleteExpense(expense.id);
        notifyWrite('delete_expense');
        globalRefresh();
        loadData();
      },
    });
  };

  const handleSearchUser = async () => {
    if (!searchEmail.trim()) return;
    setSearching(true);
    const results = await searchUsersByEmail(searchEmail.trim());
    const found = results.find(u => u.email.toLowerCase() === searchEmail.trim().toLowerCase());
    setFoundUser(found || null);
    if (!found) Alert.alert('Not found', 'No user with that email');
    setSearching(false);
  };

  const handleAddMember = async () => {
    if (!foundUser) return;
    try {
      await addMemberToGroup(groupId, foundUser);
      setShowAddMember(false);
      setSearchEmail('');
      setFoundUser(null);
      notifyWrite('add_member');
      globalRefresh();
      loadData();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const simplifiedDebts = getSimplifiedDebts(memberBalances.map(m => ({ userId: m.id, name: m.name, amount: m.balance })));

  const getCategoryInfo = (cat) => CATEGORIES.find(c => c.id === cat) || CATEGORIES[8];

  const totalSpending = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const memberCount = group ? group.members.length : 0;
  const perPersonAvg = memberCount > 0 ? totalSpending / memberCount : 0;

  if (loading) return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  if (!group) return <View style={styles.center}><Text>Group not found</Text></View>;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.groupName}>{group.name}</Text>
          <Text style={styles.memberCount}>{group.members.length} members</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.addExpBtn}
          onPress={() => navigation.navigate('AddExpense', { groupId, groupName: group.name, members: group.members })}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addExpText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {['expenses', 'balances', 'members'].map(t => (
          <TouchableOpacity activeOpacity={0.7} key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Hero Stats Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroGlow} />
        {/* Row 1: icon + label */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <View style={styles.heroIconBox}>
            <Ionicons name="cash-outline" size={20} color="#00d4aa" />
          </View>
          <Text style={styles.heroLabel}>Total group spending</Text>
        </View>
        {/* Row 2: total amount */}
        <Text style={styles.heroAmount}>{formatCurrency(totalSpending)}</Text>
        {/* Row 3: expense count */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 20 }}>
          <View style={styles.heroPulseDot} />
          <Text style={styles.heroExpCount}>{expenses.length} expense{expenses.length !== 1 ? 's' : ''}</Text>
        </View>
        {/* 2-column stat grid */}
        <View style={styles.heroStatGrid}>
          {/* Left: members */}
          <View style={styles.heroStatCell}>
            <View style={styles.heroIconBox}>
              <Ionicons name="people-outline" size={20} color="#00d4aa" />
            </View>
            <Text style={styles.heroStatValue}>{memberCount}</Text>
            <Text style={styles.heroStatLabel}>members</Text>
          </View>
          {/* Right: per person avg */}
          <View style={styles.heroStatCell}>
            <View style={styles.heroIconBoxCoral}>
              <Ionicons name="trending-up-outline" size={20} color="#ff6b6b" />
            </View>
            <Text style={styles.heroStatValue}>{formatCurrency(perPersonAvg)}</Text>
            <Text style={styles.heroStatLabel}>per person avg</Text>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Expenses Tab */}
        {tab === 'expenses' && (
          <View>
            {expenses.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="receipt-outline" size={56} color={COLORS.textMuted} />
                <Text style={styles.emptyTitle}>No expenses yet</Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.addFirstBtn}
                  onPress={() => navigation.navigate('AddExpense', { groupId, groupName: group.name, members: group.members })}
                >
                  <Text style={styles.addFirstBtnText}>Add First Expense</Text>
                </TouchableOpacity>
              </View>
            ) : (
              expenses.map(exp => {
                const catInfo = getCategoryInfo(exp.category);
                const myShare = exp.splits.find(s => s.userId === user.id);
                const iPaid = exp.paidBy.id === user.id;
                return (
                  <View key={exp.id} style={styles.expenseCard}>
                    <View style={[styles.expCatIcon, { backgroundColor: catInfo.color + '20' }]}>
                      <Ionicons name={catInfo.icon} size={20} color={catInfo.color} />
                    </View>
                    <View style={styles.expInfo}>
                      <Text style={styles.expName}>{exp.description}</Text>
                      <Text style={styles.expMeta}>
                        {iPaid ? 'You' : exp.paidBy.name} paid {formatCurrency(exp.amount)} · {formatDate(exp.createdAt)}
                      </Text>
                    </View>
                    <View style={styles.expRight}>
                      {iPaid ? (
                        <>
                          <Text style={styles.expLabelGreen}>you paid</Text>
                          <Text style={[styles.expAmount, { color: COLORS.success }]}>{formatCurrency(exp.amount)}</Text>
                        </>
                      ) : myShare ? (
                        <>
                          <Text style={styles.expLabelRed}>your share</Text>
                          <Text style={[styles.expAmount, { color: COLORS.negative }]}>{formatCurrency(myShare.amount)}</Text>
                        </>
                      ) : (
                        <Text style={styles.expLabelNeutral}>not involved</Text>
                      )}
                      <TouchableOpacity
                        activeOpacity={0.7}
                        style={styles.deleteBtn}
                        onPress={() => handleDeleteExpense(exp)}
                      >
                        <Ionicons name="trash-outline" size={14} color={COLORS.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* Balances Tab */}
        {tab === 'balances' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Group Balances</Text>
            {memberBalances.map(m => (
              <View key={m.id} style={styles.balanceRow}>
                <Avatar name={m.name} avatar={m.avatar} size={38} />
                <View style={styles.balanceInfo}>
                  <Text style={styles.balanceName}>{m.id === user.id ? 'You' : m.name}</Text>
                  <Text style={[styles.balanceAmount, {
                    color: m.balance > 0.01 ? COLORS.success : m.balance < -0.01 ? COLORS.negative : COLORS.textLight
                  }]}>
                    {m.balance > 0.01 ? `gets back ${formatCurrency(m.balance)}`
                      : m.balance < -0.01 ? `owes ${formatCurrency(Math.abs(m.balance))}`
                        : 'settled up'}
                  </Text>
                </View>
              </View>
            ))}

            {simplifiedDebts.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Suggested Settlements</Text>
                {simplifiedDebts.map((d, idx) => (
                  <View key={idx} style={styles.debtRow}>
                    <Avatar name={d.fromName} size={32} />
                    <Text style={styles.debtText}>
                      <Text style={styles.debtName}>{d.fromName === user.name ? 'You' : d.fromName}</Text>
                      {' owes '}
                      <Text style={styles.debtName}>{d.toName === user.name ? 'you' : d.toName}</Text>
                    </Text>
                    <Text style={styles.debtAmount}>{formatCurrency(d.amount)}</Text>
                  </View>
                ))}
              </>
            )}

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.settleBtn}
              onPress={() => navigation.navigate('SettleUp', { group, members: group.members })}
            >
              <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
              <Text style={styles.settleBtnText}>Record a Payment</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Members Tab */}
        {tab === 'members' && (
          <View style={styles.section}>
            {group.members.map(m => (
              <View key={m.id} style={styles.memberRow}>
                <Avatar name={m.name} avatar={m.avatar} size={42} />
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{m.id === user.id ? `${m.name} (You)` : m.name}</Text>
                  <Text style={styles.memberEmail}>{m.email}</Text>
                </View>
                {m.id === group.createdBy && (
                  <View style={styles.adminBadge}><Text style={styles.adminText}>Admin</Text></View>
                )}
              </View>
            ))}
            {group.createdBy === user.id && (
              <TouchableOpacity activeOpacity={0.7} style={styles.addMemberBtn} onPress={() => setShowAddMember(true)}>
                <Ionicons name="person-add" size={18} color={COLORS.primary} />
                <Text style={styles.addMemberText}>Add Member</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* Add Member Modal */}
      <Modal visible={showAddMember} animationType="slide" presentationStyle="formSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity activeOpacity={0.7} onPress={() => { setShowAddMember(false); setFoundUser(null); setSearchEmail(''); }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Member</Text>
            <TouchableOpacity activeOpacity={0.7} onPress={handleAddMember} disabled={!foundUser}>
              <Text style={[styles.saveText, !foundUser && { opacity: 0.4 }]}>Add</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Enter email address"
              value={searchEmail}
              onChangeText={setSearchEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity activeOpacity={0.7} style={styles.searchBtn} onPress={handleSearchUser}>
              {searching ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.searchBtnText}>Find</Text>}
            </TouchableOpacity>
          </View>
          {foundUser && (
            <View style={styles.foundUser}>
              <Avatar name={foundUser.name} size={44} />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.foundName}>{foundUser.name}</Text>
                <Text style={styles.foundEmail}>{foundUser.email}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={22} color={COLORS.success} style={{ marginLeft: 'auto' }} />
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingTop: 56,
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerCenter: { flex: 1 },
  groupName: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  memberCount: { fontSize: 13, color: COLORS.textLight },
  addExpBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  addExpText: { color: '#fff', fontWeight: '600', marginLeft: 4, fontSize: 14 },
  tabs: { flexDirection: 'row', backgroundColor: COLORS.white, paddingHorizontal: 16, paddingBottom: 0 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: COLORS.primary },
  tabText: { fontSize: 14, color: COLORS.textLight, fontWeight: '500' },
  tabTextActive: { color: COLORS.primary, fontWeight: '700' },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 0,
    borderRadius: 24,
    padding: 24,
    backgroundColor: '#1a1a24',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
    position: 'relative',
  },
  heroGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#00d4aa',
    opacity: 0.12,
  },
  heroIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0,212,170,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  heroIconBoxCoral: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,107,107,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  heroLabel: {
    fontSize: 14,
    color: '#a1a1aa',
  },
  heroAmount: {
    fontSize: 48,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 4,
  },
  heroPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00d4aa',
    marginRight: 8,
  },
  heroExpCount: {
    fontSize: 13,
    color: '#a1a1aa',
  },
  heroStatGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  heroStatCell: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 14,
    alignItems: 'flex-start',
  },
  heroStatValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 10,
  },
  heroStatLabel: {
    fontSize: 12,
    color: '#a1a1aa',
    marginTop: 2,
  },
  expenseCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    marginHorizontal: 16, marginTop: 10, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  deleteBtn: {
    marginTop: 6, padding: 4, alignSelf: 'flex-end',
    borderRadius: 6, backgroundColor: 'rgba(255,107,107,0.08)',
  },
  expCatIcon: { width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  expInfo: { flex: 1 },
  expName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  expMeta: { fontSize: 12, color: COLORS.textLight, marginTop: 3 },
  expRight: { alignItems: 'flex-end' },
  expLabelGreen: { fontSize: 11, color: COLORS.success },
  expLabelRed: { fontSize: 11, color: COLORS.negative },
  expLabelNeutral: { fontSize: 11, color: COLORS.textMuted },
  expAmount: { fontSize: 15, fontWeight: '700' },
  section: { margin: 16, backgroundColor: COLORS.white, borderRadius: 14, padding: 16 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  balanceInfo: { flex: 1, marginLeft: 12 },
  balanceName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  balanceAmount: { fontSize: 13, marginTop: 2 },
  debtRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  debtText: { flex: 1, marginLeft: 10, fontSize: 14, color: COLORS.text },
  debtName: { fontWeight: '600' },
  debtAmount: { fontSize: 15, fontWeight: '700', color: COLORS.negative },
  settleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.primary },
  settleBtnText: { color: COLORS.primary, fontWeight: '600', marginLeft: 6 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  memberInfo: { flex: 1, marginLeft: 12 },
  memberName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  memberEmail: { fontSize: 13, color: COLORS.textLight },
  adminBadge: { backgroundColor: COLORS.primaryLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  adminText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  addMemberBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14, padding: 12, borderRadius: 10, backgroundColor: COLORS.primaryLight },
  addMemberText: { color: COLORS.primary, fontWeight: '600', marginLeft: 6 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.textLight, marginTop: 12 },
  addFirstBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 16 },
  addFirstBtnText: { color: '#fff', fontWeight: '700' },
  modal: { flex: 1, backgroundColor: COLORS.white, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingTop: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  cancelText: { fontSize: 16, color: COLORS.textLight },
  saveText: { fontSize: 16, color: COLORS.primary, fontWeight: '700' },
  searchRow: { flexDirection: 'row', gap: 10 },
  searchInput: { flex: 1, backgroundColor: COLORS.background, borderRadius: 12, padding: 14, fontSize: 15, color: COLORS.text },
  searchBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontWeight: '600' },
  foundUser: { flexDirection: 'row', alignItems: 'center', marginTop: 16, backgroundColor: COLORS.primaryLight, borderRadius: 12, padding: 14 },
  foundName: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  foundEmail: { fontSize: 13, color: COLORS.textLight },
});

export default GroupDetailScreen;

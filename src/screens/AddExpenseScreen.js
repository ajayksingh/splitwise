import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COLORS, CATEGORIES } from '../constants/colors';
import Avatar from '../components/Avatar';
import { addExpense, getGroups, getUserById } from '../services/storage';
import { sendWhatsAppMessage, buildExpenseWhatsAppMessage } from '../services/contacts';
import { SPLIT_TYPES, calculateEqualSplit, calculatePercentageSplit, calculateSharesSplit, formatCurrency } from '../utils/splitCalculator';
import { formatAmount, getCurrencySymbol } from '../services/currency';
import { confirmAlert } from '../utils/alert';
import { hapticMedium, hapticSuccess, hapticError } from '../utils/haptics';

const AddExpenseScreen = ({ route, navigation }) => {
  const { user, groups, friends, currency, refresh, notifyWrite } = useApp();
  const { groupId: initGroupId, groupName: initGroupName, members: initMembers } = route.params || {};

  const descriptionRef = useRef('');
  const amountRef = useRef('');
  const [category, setCategory] = useState('general');
  const [paidBy, setPaidBy] = useState(null);
  const [splitType, setSplitType] = useState(SPLIT_TYPES.EQUAL);
  const [selectedGroup, setSelectedGroup] = useState(initGroupId ? { id: initGroupId, name: initGroupName, members: initMembers } : null);
  const [participants, setParticipants] = useState([]);
  const [exactAmounts, setExactAmounts] = useState({});
  const [percentages, setPercentages] = useState({});
  const [shares, setShares] = useState({});
  const [showGroupPicker, setShowGroupPicker] = useState(!initGroupId);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [showSplitOptions, setShowSplitOptions] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selectedGroup) {
      const allMembers = selectedGroup.members || [];
      setParticipants(allMembers);
      const init = {};
      allMembers.forEach(m => { init[m.id] = 0; });
      setExactAmounts(init);
      setPercentages(init);
      setShares(allMembers.reduce((s, m) => ({ ...s, [m.id]: 1 }), {}));
      setPaidBy(allMembers.find(m => m.id === user.id) || allMembers[0] || null);
    }
  }, [selectedGroup]);

  const getSplits = () => {
    const amt = parseFloat(amountRef.current);
    if (isNaN(amt) || amt <= 0) return [];
    switch (splitType) {
      case SPLIT_TYPES.EQUAL:
        return calculateEqualSplit(amt, participants);
      case SPLIT_TYPES.EXACT:
        return participants.map(m => ({ userId: m.id, name: m.name, amount: parseFloat(exactAmounts[m.id] || 0) }));
      case SPLIT_TYPES.PERCENTAGE:
        return calculatePercentageSplit(amt, participants, percentages);
      case SPLIT_TYPES.SHARES:
        return calculateSharesSplit(amt, participants, shares);
      default:
        return calculateEqualSplit(amt, participants);
    }
  };

  const validate = () => {
    if (!descriptionRef.current.trim()) { Alert.alert('Error', 'Add a description'); return false; }
    const amt = parseFloat(amountRef.current);
    if (isNaN(amt) || amt <= 0) { Alert.alert('Error', 'Enter a valid amount'); return false; }
    if (!selectedGroup) { Alert.alert('Error', 'Select a group'); return false; }
    if (!paidBy) { Alert.alert('Error', 'Select who paid'); return false; }
    if (splitType === SPLIT_TYPES.EXACT) {
      const total = Object.values(exactAmounts).reduce((s, v) => s + parseFloat(v || 0), 0);
      if (Math.abs(total - amt) > 0.01) {
        Alert.alert('Error', `Exact amounts total ${formatCurrency(total)}, should be ${formatCurrency(amt)}`);
        return false;
      }
    }
    if (splitType === SPLIT_TYPES.PERCENTAGE) {
      const total = Object.values(percentages).reduce((s, v) => s + parseFloat(v || 0), 0);
      if (Math.abs(total - 100) > 0.01) {
        Alert.alert('Error', `Percentages total ${total.toFixed(1)}%, should be 100%`);
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) { hapticError(); return; }
    hapticMedium();
    setSaving(true);
    try {
      const splits = getSplits();
      const expense = await addExpense({
        description: descriptionRef.current.trim(),
        amount: parseFloat(amountRef.current),
        currency,
        category,
        groupId: selectedGroup.id,
        groupName: selectedGroup.name,
        paidBy: { id: paidBy.id, name: paidBy.name, avatar: paidBy.avatar },
        splits,
        date: new Date().toISOString(),
      });
      hapticSuccess();
      refresh();
      notifyWrite('add_expense');

      // WhatsApp notifications: ask user if they want to notify others
      const otherSplits = splits.filter(s => s.userId !== user.id && s.amount > 0);
      if (otherSplits.length > 0 && paidBy.id === user.id) {
        // Find friends with phone numbers
        const friendsWithPhone = friends.filter(f =>
          otherSplits.some(s => s.userId === f.id) && f.phone
        );
        if (friendsWithPhone.length > 0) {
          confirmAlert({
            title: 'Notify via WhatsApp?',
            message: `Send expense split details to ${friendsWithPhone.length} friend${friendsWithPhone.length > 1 ? 's' : ''}?`,
            confirmText: 'Send WhatsApp',
            cancelText: 'Skip',
            onCancel: () => navigation.goBack(),
            onConfirm: async () => {
              for (const friend of friendsWithPhone) {
                const split = splits.find(s => s.userId === friend.id);
                if (split) {
                  const msg = buildExpenseWhatsAppMessage({
                    expense: { description: description.trim(), amount: parseFloat(amount) },
                    paidBy: paidBy.id === user.id ? 'You' : paidBy.name,
                    splitAmount: split.amount,
                    groupName: selectedGroup.name,
                    currency,
                  });
                  await sendWhatsAppMessage(friend.phone, msg);
                }
              }
              navigation.goBack();
            },
          });
          return;
        }
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const catInfo = CATEGORIES.find(c => c.id === category) || CATEGORIES[8];
  const splits = getSplits();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={{ flex: 1 }}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.goBack()} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Expense</Text>
          <TouchableOpacity activeOpacity={0.7} onPress={handleSave} style={styles.saveBtn} disabled={saving}>
            <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Amount Input */}
          <View style={styles.amountSection}>
            <TouchableOpacity activeOpacity={0.7} style={styles.catBtn} onPress={() => setShowCatPicker(true)}>
              <Ionicons name={catInfo.icon} size={24} color={catInfo.color} />
            </TouchableOpacity>
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>{getCurrencySymbol(currency)}</Text>
              <TextInput
                testID="expense-amount-input"
                style={styles.amountInput}
                placeholder="0.00"
                onChangeText={v => { amountRef.current = v; }}
                keyboardType="decimal-pad"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
          </View>

          {/* Description */}
          <View style={styles.field}>
            <TextInput
              testID="expense-description-input"
              style={styles.descInput}
              placeholder="What's this expense for?"
              onChangeText={v => { descriptionRef.current = v; }}
              placeholderTextColor={COLORS.textMuted}
              autoCorrect={false}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          {/* Group */}
          <TouchableOpacity activeOpacity={0.7} style={styles.fieldRow} onPress={() => setShowGroupPicker(true)}>
            <View style={styles.fieldIcon}><Ionicons name="people" size={20} color={COLORS.primary} /></View>
            <Text style={[styles.fieldText, !selectedGroup && styles.placeholder]}>
              {selectedGroup ? selectedGroup.name : 'Select a group'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
          </TouchableOpacity>

          {/* Paid By */}
          {selectedGroup && (
            <View style={styles.fieldRow}>
              <View style={styles.fieldIcon}><Ionicons name="person" size={20} color={COLORS.primary} /></View>
              <Text style={styles.fieldLabel}>Paid by</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.paidByScroll}>
                {participants.map(m => (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    key={m.id}
                    style={[styles.paidByBtn, paidBy?.id === m.id && styles.paidByActive]}
                    onPress={() => setPaidBy(m)}
                  >
                    <Text style={[styles.paidByText, paidBy?.id === m.id && styles.paidByTextActive]}>
                      {m.id === user.id ? 'You' : m.name.split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Split Type */}
          {selectedGroup && (
            <TouchableOpacity activeOpacity={0.7} style={styles.fieldRow} onPress={() => setShowSplitOptions(true)}>
              <View style={styles.fieldIcon}><Ionicons name="git-branch" size={20} color={COLORS.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Split</Text>
                <Text style={styles.splitTypeText}>
                  {{
                    [SPLIT_TYPES.EQUAL]: 'Equally',
                    [SPLIT_TYPES.EXACT]: 'By exact amounts',
                    [SPLIT_TYPES.PERCENTAGE]: 'By percentage',
                    [SPLIT_TYPES.SHARES]: 'By shares',
                  }[splitType]}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          )}

          {/* Split Preview */}
          {selectedGroup && splits.length > 0 && (
            <View style={styles.splitsSection}>
              <Text style={styles.splitsTitle}>Split Preview</Text>

              {splitType === SPLIT_TYPES.EXACT && participants.map(m => (
                <View key={m.id} style={styles.splitInputRow}>
                  <Avatar name={m.name} size={32} />
                  <Text style={styles.splitName}>{m.id === user.id ? 'You' : m.name.split(' ')[0]}</Text>
                  <View style={styles.splitExactInput}>
                    <Text style={styles.splitCurrency}>{getCurrencySymbol(currency)}</Text>
                    <TextInput
                      style={styles.splitInput}
                      value={String(exactAmounts[m.id] || '')}
                      onChangeText={v => setExactAmounts(prev => ({ ...prev, [m.id]: v }))}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                    />
                  </View>
                </View>
              ))}

              {splitType === SPLIT_TYPES.PERCENTAGE && participants.map(m => (
                <View key={m.id} style={styles.splitInputRow}>
                  <Avatar name={m.name} size={32} />
                  <Text style={styles.splitName}>{m.id === user.id ? 'You' : m.name.split(' ')[0]}</Text>
                  <View style={styles.splitExactInput}>
                    <TextInput
                      style={styles.splitInput}
                      value={String(percentages[m.id] || '')}
                      onChangeText={v => setPercentages(prev => ({ ...prev, [m.id]: v }))}
                      keyboardType="decimal-pad"
                      placeholder="0"
                    />
                    <Text style={styles.splitCurrency}>%</Text>
                  </View>
                </View>
              ))}

              {splitType === SPLIT_TYPES.SHARES && participants.map(m => (
                <View key={m.id} style={styles.splitInputRow}>
                  <Avatar name={m.name} size={32} />
                  <Text style={styles.splitName}>{m.id === user.id ? 'You' : m.name.split(' ')[0]}</Text>
                  <View style={styles.sharesControl}>
                    <TouchableOpacity activeOpacity={0.7} onPress={() => setShares(prev => ({ ...prev, [m.id]: Math.max(0, (prev[m.id] || 1) - 1) }))}>
                      <Ionicons name="remove-circle" size={28} color={COLORS.primary} />
                    </TouchableOpacity>
                    <Text style={styles.sharesCount}>{shares[m.id] || 0}</Text>
                    <TouchableOpacity activeOpacity={0.7} onPress={() => setShares(prev => ({ ...prev, [m.id]: (prev[m.id] || 0) + 1 }))}>
                      <Ionicons name="add-circle" size={28} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {splitType === SPLIT_TYPES.EQUAL && splits.map(s => (
                <View key={s.userId} style={styles.splitPreviewRow}>
                  <Avatar name={s.name} size={32} />
                  <Text style={styles.splitPreviewName}>{s.userId === user.id ? 'You' : s.name.split(' ')[0]}</Text>
                  <Text style={styles.splitPreviewAmount}>{formatCurrency(s.amount)}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Group Picker Modal */}
        <Modal visible={showGroupPicker} animationType="slide" presentationStyle="formSheet">
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity activeOpacity={0.7} onPress={() => setShowGroupPicker(false)}>
                <Text style={styles.cancelText}>Close</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Select Group</Text>
              <View style={{ width: 50 }} />
            </View>
            {groups.map(g => (
              <TouchableOpacity testID="group-picker-item" activeOpacity={0.7} key={g.id} style={styles.pickerItem} onPress={() => { setSelectedGroup(g); setShowGroupPicker(false); }}>
                <View style={styles.pickerIcon}><Ionicons name="people" size={20} color={COLORS.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickerName}>{g.name}</Text>
                  <Text style={styles.pickerMeta}>{g.members.length} members</Text>
                </View>
                {selectedGroup?.id === g.id && <Ionicons name="checkmark" size={22} color={COLORS.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </Modal>

        {/* Category Picker Modal */}
        <Modal visible={showCatPicker} animationType="slide" presentationStyle="formSheet">
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity activeOpacity={0.7} onPress={() => setShowCatPicker(false)}>
                <Text style={styles.cancelText}>Close</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Category</Text>
              <View style={{ width: 50 }} />
            </View>
            <View style={styles.catGrid}>
              {CATEGORIES.map(c => (
                <TouchableOpacity
                  activeOpacity={0.7}
                  key={c.id}
                  style={[styles.catItem, category === c.id && { borderColor: c.color, borderWidth: 2 }]}
                  onPress={() => { setCategory(c.id); setShowCatPicker(false); }}
                >
                  <View style={[styles.catItemIcon, { backgroundColor: c.color + '20' }]}>
                    <Ionicons name={c.icon} size={24} color={c.color} />
                  </View>
                  <Text style={styles.catItemLabel}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>

        {/* Split Options Modal */}
        <Modal visible={showSplitOptions} animationType="slide" presentationStyle="formSheet">
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity activeOpacity={0.7} onPress={() => setShowSplitOptions(false)}>
                <Text style={styles.cancelText}>Close</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Split Type</Text>
              <View style={{ width: 50 }} />
            </View>
            {[
              { type: SPLIT_TYPES.EQUAL, icon: 'people', title: 'Equally', desc: 'Everyone pays the same' },
              { type: SPLIT_TYPES.EXACT, icon: 'calculator', title: 'Exact amounts', desc: 'Enter specific amounts' },
              { type: SPLIT_TYPES.PERCENTAGE, icon: 'pie-chart', title: 'Percentage', desc: 'Split by percentage' },
              { type: SPLIT_TYPES.SHARES, icon: 'grid', title: 'Shares', desc: 'Split proportionally by shares' },
            ].map(opt => (
              <TouchableOpacity
                activeOpacity={0.7}
                key={opt.type}
                style={[styles.splitOption, splitType === opt.type && styles.splitOptionActive]}
                onPress={() => { setSplitType(opt.type); setShowSplitOptions(false); }}
              >
                <View style={[styles.splitOptIcon, { backgroundColor: splitType === opt.type ? COLORS.primary : COLORS.primaryLight }]}>
                  <Ionicons name={opt.icon} size={20} color={splitType === opt.type ? '#fff' : COLORS.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.splitOptTitle}>{opt.title}</Text>
                  <Text style={styles.splitOptDesc}>{opt.desc}</Text>
                </View>
                {splitType === opt.type && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  cancelBtn: { padding: 4 },
  cancelText: { fontSize: 16, color: COLORS.textLight },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 7 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  amountSection: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    padding: 20, marginBottom: 1,
  },
  catBtn: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  amountInputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  currencySymbol: { fontSize: 32, fontWeight: '700', color: COLORS.textLight, marginRight: 4 },
  amountInput: { flex: 1, fontSize: 42, fontWeight: '800', color: COLORS.text },
  field: { backgroundColor: COLORS.white, padding: 16, marginBottom: 1 },
  descInput: { fontSize: 17, color: COLORS.text },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    padding: 14, marginBottom: 1,
  },
  fieldIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  fieldText: { flex: 1, fontSize: 16, color: COLORS.text, fontWeight: '500' },
  fieldLabel: { fontSize: 12, color: COLORS.textLight, marginBottom: 2 },
  placeholder: { color: COLORS.textMuted },
  paidByScroll: { flex: 1 },
  paidByBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: COLORS.background, marginRight: 6,
  },
  paidByActive: { backgroundColor: COLORS.primary },
  paidByText: { fontSize: 14, color: COLORS.textLight, fontWeight: '500' },
  paidByTextActive: { color: '#fff', fontWeight: '600' },
  splitTypeText: { fontSize: 15, color: COLORS.text, fontWeight: '500' },
  splitsSection: {
    backgroundColor: COLORS.white, margin: 16, borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  splitsTitle: { fontSize: 14, fontWeight: '600', color: COLORS.textLight, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  splitInputRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  splitName: { flex: 1, marginLeft: 10, fontSize: 15, fontWeight: '500', color: COLORS.text },
  splitExactInput: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: 90,
  },
  splitInput: { fontSize: 15, fontWeight: '600', color: COLORS.text, minWidth: 50, textAlign: 'right' },
  splitCurrency: { fontSize: 14, color: COLORS.textLight, marginRight: 4 },
  sharesControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sharesCount: { fontSize: 18, fontWeight: '700', color: COLORS.text, minWidth: 24, textAlign: 'center' },
  splitPreviewRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  splitPreviewName: { flex: 1, marginLeft: 10, fontSize: 15, color: COLORS.text },
  splitPreviewAmount: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  modal: { flex: 1, backgroundColor: COLORS.white, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  pickerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  pickerIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  pickerName: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  pickerMeta: { fontSize: 13, color: COLORS.textLight },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 4 },
  catItem: { width: '30%', alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: COLORS.background, borderWidth: 2, borderColor: 'transparent' },
  catItemIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  catItemLabel: { fontSize: 12, color: COLORS.text, textAlign: 'center', fontWeight: '500' },
  splitOption: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, backgroundColor: COLORS.background, marginBottom: 10 },
  splitOptionActive: { backgroundColor: COLORS.primaryLight },
  splitOptIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  splitOptTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  splitOptDesc: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
});

export default AddExpenseScreen;

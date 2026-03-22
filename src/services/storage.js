/**
 * Storage Service - Supabase as primary data store
 * All reads and writes go directly to Supabase.
 * AsyncStorage is only used for the current user session + demo account data.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from './supabase';

const uuidv4 = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });

const KEYS = {
  CURRENT_USER: 'sw_current_user',
  // Legacy AsyncStorage keys kept for demo accounts only
  USERS: 'sw_users',
  GROUPS: 'sw_groups',
  EXPENSES: 'sw_expenses',
  FRIENDS: 'sw_friends',
  SETTLEMENTS: 'sw_settlements',
  ACTIVITY: 'sw_activity',
};

// AsyncStorage helpers (demo accounts + auth session only)
const getData = async (key) => {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : [];
  } catch { return []; }
};
const setData = async (key, data) => {
  try { await AsyncStorage.setItem(key, JSON.stringify(data)); }
  catch (e) { console.error('Storage error:', e); }
};

const isDemo = (userId) => typeof userId === 'string' && userId.startsWith('demo-');

// --- Auth ---
const DEMO_EMAILS = ['alice@demo.com', 'bob@demo.com', 'carol@demo.com'];

export const registerUser = async ({ name, email, password }) => {
  if (DEMO_EMAILS.includes(email)) {
    const users = await getData(KEYS.USERS);
    if (users.find(u => u.email === email)) throw new Error('Email already in use');
    const user = { id: uuidv4(), name, email, password, avatar: null, phone: '', createdAt: new Date().toISOString() };
    await setData(KEYS.USERS, [...users, user]);
    const { password: _, ...safeUser } = user;
    await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(safeUser));
    return safeUser;
  }

  if (!isSupabaseConfigured()) throw new Error('Registration requires a network connection');

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    if (error.message.includes('already registered') || error.message.includes('already exists')) {
      throw new Error('Email already in use. Please sign in instead.');
    }
    throw new Error(error.message);
  }

  if (!data.session) {
    throw new Error('Account created! Please check your email to confirm your account, then sign in.');
  }

  const profile = {
    id: data.user.id,
    name,
    email,
    avatar: null,
    phone: '',
    createdAt: new Date().toISOString(),
  };

  await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(profile));

  await supabase.from('users').upsert({
    id: profile.id,
    name: profile.name,
    email: profile.email,
    avatar: null,
    phone: '',
    provider: 'email',
    created_at: profile.createdAt,
  });

  return profile;
};

export const loginUser = async ({ email, password }) => {
  if (DEMO_EMAILS.includes(email)) {
    await seedDemoData();
    const users = await getData(KEYS.USERS);
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) throw new Error('Invalid email or password');
    const { password: _, ...safeUser } = user;
    await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(safeUser));
    return safeUser;
  }

  if (!isSupabaseConfigured()) throw new Error('No network connection. Please connect to the internet to sign in.');

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.message.includes('not confirmed') || error.message.includes('Email not confirmed')) {
      throw new Error('Please confirm your email address first. Check your inbox for the confirmation link.');
    }
    const { data: existingUser } = await supabase.from('users').select('id').eq('email', email).single();
    if (existingUser) {
      throw new Error('Your account was created before our login system was updated. Please tap "Sign Up" to set a password for your account.');
    }
    throw new Error('Invalid email or password');
  }

  // Fetch profile from Supabase
  const { data: userData } = await supabase.from('users').select('*').eq('id', data.user.id).single();
  const profile = userData
    ? { id: userData.id, name: userData.name, email: userData.email, avatar: userData.avatar || null, phone: userData.phone || '', createdAt: userData.created_at }
    : { id: data.user.id, name: email.split('@')[0], email, avatar: null, phone: '', createdAt: new Date().toISOString() };

  await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(profile));
  return profile;
};

export const logoutUser = async () => {
  if (supabase) await supabase.auth.signOut().catch(() => {});
  await AsyncStorage.removeItem(KEYS.CURRENT_USER);
};

export const getCurrentUser = async () => {
  try {
    const cached = await AsyncStorage.getItem(KEYS.CURRENT_USER);
    if (cached) return JSON.parse(cached);

    if (!isSupabaseConfigured()) return null;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const { data: userData } = await supabase.from('users').select('*').eq('id', session.user.id).single();
    if (!userData) return null;
    const profile = {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      avatar: userData.avatar || null,
      phone: userData.phone || '',
      createdAt: userData.created_at,
    };
    await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(profile));
    return profile;
  } catch { return null; }
};

export const updateUserProfile = async (userId, updates) => {
  if (isDemo(userId)) {
    const users = await getData(KEYS.USERS);
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) throw new Error('User not found');
    users[idx] = { ...users[idx], ...updates };
    await setData(KEYS.USERS, users);
    const { password: _, ...safeUser } = users[idx];
    await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(safeUser));
    return safeUser;
  }
  const { data, error } = await supabase.from('users').update({
    name: updates.name,
    avatar: updates.avatar || null,
    phone: updates.phone || '',
  }).eq('id', userId).select().single();
  if (error) throw new Error('Failed to update profile');
  const profile = { id: data.id, name: data.name, email: data.email, avatar: data.avatar || null, phone: data.phone || '', createdAt: data.created_at };
  await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(profile));
  return profile;
};

// --- Friends ---
export const addFriend = async (currentUserId, email) => {
  if (isDemo(currentUserId)) {
    const users = await getData(KEYS.USERS);
    const friend = users.find(u => u.email === email);
    if (!friend) throw new Error('No user found with that email.');
    if (friend.id === currentUserId) throw new Error("You can't add yourself");
    const friends = await getData(KEYS.FRIENDS);
    const exists = friends.find(f =>
      (f.userId === currentUserId && f.friendId === friend.id) ||
      (f.userId === friend.id && f.friendId === currentUserId)
    );
    if (exists) throw new Error('Already friends');
    const entry = { id: uuidv4(), userId: currentUserId, friendId: friend.id, createdAt: new Date().toISOString() };
    await setData(KEYS.FRIENDS, [...friends, entry]);
    const { password: _, ...safeFriend } = friend;
    return safeFriend;
  }

  const { data: remoteUser, error: findErr } = await supabase
    .from('users').select('id,name,email,avatar,phone').eq('email', email).maybeSingle();
  if (!remoteUser) throw new Error('No user found with that email. They need to register first.');
  if (remoteUser.id === currentUserId) throw new Error("You can't add yourself");

  const { data: existing } = await supabase.from('friends').select('id')
    .or(`and(user_id.eq.${currentUserId},friend_id.eq.${remoteUser.id}),and(user_id.eq.${remoteUser.id},friend_id.eq.${currentUserId})`)
    .maybeSingle();
  if (existing) throw new Error('Already friends');

  const { error } = await supabase.from('friends').insert({
    id: uuidv4(),
    user_id: currentUserId,
    friend_id: remoteUser.id,
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error('Failed to add friend');
  return { id: remoteUser.id, name: remoteUser.name, email: remoteUser.email, avatar: remoteUser.avatar || null, phone: remoteUser.phone || '' };
};

export const getFriends = async (userId) => {
  if (isDemo(userId)) {
    const friends = await getData(KEYS.FRIENDS);
    const users = await getData(KEYS.USERS);
    const friendIds = friends
      .filter(f => f.userId === userId || f.friendId === userId)
      .map(f => f.userId === userId ? f.friendId : f.userId);
    return users.filter(u => friendIds.includes(u.id)).map(({ password: _, ...u }) => u);
  }

  const { data: friendRows } = await supabase.from('friends').select('*')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
  const friendIds = (friendRows || []).map(f => f.user_id === userId ? f.friend_id : f.user_id);
  if (friendIds.length === 0) return [];
  const { data: users } = await supabase.from('users').select('id,name,email,avatar,phone').in('id', friendIds);
  return (users || []).map(u => ({ id: u.id, name: u.name, email: u.email, avatar: u.avatar || null, phone: u.phone || '' }));
};

// --- Groups ---
export const createGroup = async (group) => {
  if (isDemo(group.createdBy)) {
    const groups = await getData(KEYS.GROUPS);
    const newGroup = { id: uuidv4(), ...group, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await setData(KEYS.GROUPS, [...groups, newGroup]);
    await addActivity({ type: 'group_created', groupId: newGroup.id, groupName: newGroup.name, userId: group.createdBy, createdAt: new Date().toISOString() });
    return newGroup;
  }

  const newGroup = {
    id: uuidv4(),
    name: group.name,
    type: group.type || 'other',
    description: group.description || '',
    created_by: group.createdBy,
    members: group.members,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('groups').insert(newGroup);
  if (error) throw new Error('Failed to create group: ' + error.message);

  const local = {
    id: newGroup.id, name: newGroup.name, type: newGroup.type,
    description: newGroup.description,
    createdBy: newGroup.created_by, members: newGroup.members,
    createdAt: newGroup.created_at, updatedAt: newGroup.updated_at,
  };
  await addActivity({ type: 'group_created', groupId: local.id, groupName: local.name, userId: group.createdBy, createdAt: new Date().toISOString() });
  return local;
};

export const getGroups = async (userId, userEmail = null) => {
  if (isDemo(userId)) {
    const groups = await getData(KEYS.GROUPS);
    return groups.filter(g => g.members.some(m => m.id === userId));
  }

  if (!isSupabaseConfigured()) return [];
  // Use contains filter to let Supabase filter by membership server-side
  // Fall back to fetching all if RPC not available
  const queries = [
    supabase.from('groups').select('*').order('created_at', { ascending: false })
      .filter('members', 'cs', JSON.stringify([{ id: userId }])),
  ];
  if (userEmail) {
    queries.push(
      supabase.from('groups').select('*').order('created_at', { ascending: false })
        .filter('members', 'cs', JSON.stringify([{ email: userEmail.toLowerCase() }]))
    );
  }
  const results = await Promise.all(queries);
  const allRows = results.flatMap(r => r.data || []);
  const seen = new Set();
  const deduped = allRows.filter(g => { if (seen.has(g.id)) return false; seen.add(g.id); return true; });
  return deduped
    .map(g => ({
      id: g.id, name: g.name, type: g.type || 'other', description: g.description || '',
      createdBy: g.created_by, members: g.members || [],
      createdAt: g.created_at, updatedAt: g.updated_at,
    }));
};

export const getGroup = async (groupId) => {
  if (!isSupabaseConfigured()) {
    const groups = await getData(KEYS.GROUPS);
    return groups.find(g => g.id === groupId);
  }
  const { data } = await supabase.from('groups').select('*').eq('id', groupId).single();
  if (!data) return null;
  return { id: data.id, name: data.name, type: data.type || 'other', description: data.description || '', createdBy: data.created_by, members: data.members || [], createdAt: data.created_at, updatedAt: data.updated_at };
};

export const updateGroup = async (groupId, updates) => {
  if (!isSupabaseConfigured()) {
    const groups = await getData(KEYS.GROUPS);
    const idx = groups.findIndex(g => g.id === groupId);
    if (idx === -1) throw new Error('Group not found');
    groups[idx] = { ...groups[idx], ...updates, updatedAt: new Date().toISOString() };
    await setData(KEYS.GROUPS, groups);
    return groups[idx];
  }
  const { data, error } = await supabase.from('groups').update({
    ...('name' in updates && { name: updates.name }),
    ...('description' in updates && { description: updates.description }),
    ...('members' in updates && { members: updates.members }),
    updated_at: new Date().toISOString(),
  }).eq('id', groupId).select().single();
  if (error) throw new Error('Failed to update group');
  return { id: data.id, name: data.name, type: data.type || 'other', description: data.description || '', createdBy: data.created_by, members: data.members || [], createdAt: data.created_at, updatedAt: data.updated_at };
};

export const addMemberToGroup = async (groupId, user) => {
  if (!isSupabaseConfigured()) {
    const groups = await getData(KEYS.GROUPS);
    const idx = groups.findIndex(g => g.id === groupId);
    if (idx === -1) throw new Error('Group not found');
    if (groups[idx].members.find(m => m.id === user.id)) throw new Error('Already a member');
    groups[idx].members.push(user);
    groups[idx].updatedAt = new Date().toISOString();
    await setData(KEYS.GROUPS, groups);
    return groups[idx];
  }

  // Fetch current group, add member, save
  const { data: group, error: fetchErr } = await supabase.from('groups').select('*').eq('id', groupId).single();
  if (fetchErr || !group) throw new Error('Group not found');
  if (group.members.find(m => m.id === user.id)) throw new Error('Already a member');

  const updatedMembers = [...group.members, user];
  const { data, error } = await supabase.from('groups').update({
    members: updatedMembers,
    updated_at: new Date().toISOString(),
  }).eq('id', groupId).select().single();
  if (error) throw new Error('Failed to add member');
  return { id: data.id, name: data.name, type: data.type || 'other', description: data.description || '', createdBy: data.created_by, members: data.members || [], createdAt: data.created_at, updatedAt: data.updated_at };
};

// --- Expenses ---
export const addExpense = async (expense) => {
  if (isDemo(expense.paidBy?.id)) {
    const expenses = await getData(KEYS.EXPENSES);
    const newExpense = { id: uuidv4(), ...expense, createdAt: new Date().toISOString() };
    await setData(KEYS.EXPENSES, [...expenses, newExpense]);
    await addActivity({ type: 'expense_added', expenseId: newExpense.id, description: newExpense.description, amount: newExpense.amount, groupId: newExpense.groupId, groupName: expense.groupName, userId: newExpense.paidBy.id, paidByName: newExpense.paidBy.name, createdAt: new Date().toISOString() });
    return newExpense;
  }

  const newExpense = {
    id: uuidv4(),
    group_id: expense.groupId,
    description: expense.description,
    amount: expense.amount,
    currency: expense.currency,
    category: expense.category || 'general',
    paid_by: expense.paidBy,
    splits: expense.splits,
    date: expense.date || new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('expenses').insert(newExpense);
  if (error) throw new Error('Failed to add expense: ' + error.message);

  const local = { id: newExpense.id, groupId: newExpense.group_id, description: newExpense.description, amount: newExpense.amount, currency: newExpense.currency, category: newExpense.category, paidBy: newExpense.paid_by, splits: newExpense.splits, date: newExpense.date, createdAt: newExpense.created_at };
  await addActivity({ type: 'expense_added', expenseId: local.id, description: local.description, amount: local.amount, groupId: local.groupId, groupName: expense.groupName, userId: local.paidBy.id, paidByName: local.paidBy.name, createdAt: new Date().toISOString() });
  return local;
};

export const getExpenses = async (groupId) => {
  if (!isSupabaseConfigured()) {
    const expenses = await getData(KEYS.EXPENSES);
    return expenses.filter(e => e.groupId === groupId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  const { data } = await supabase.from('expenses').select('*').eq('group_id', groupId).order('created_at', { ascending: false });
  return (data || []).map(e => ({ id: e.id, groupId: e.group_id, description: e.description, amount: e.amount, currency: e.currency, category: e.category || 'general', paidBy: e.paid_by, splits: e.splits || [], date: e.date || e.created_at, createdAt: e.created_at }));
};

export const getAllExpenses = async (userId) => {
  if (isDemo(userId)) {
    const expenses = await getData(KEYS.EXPENSES);
    return expenses.filter(e => e.paidBy.id === userId || e.splits.some(s => s.userId === userId)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  // Fetch all expenses from user's groups
  const userGroups = await getGroups(userId);
  const groupIds = userGroups.map(g => g.id);
  if (groupIds.length === 0) return [];
  const { data } = await supabase.from('expenses').select('*').in('group_id', groupIds).order('created_at', { ascending: false }).limit(500);
  return (data || [])
    .filter(e => e.paid_by?.id === userId || (e.splits || []).some(s => s.userId === userId))
    .map(e => ({ id: e.id, groupId: e.group_id, description: e.description, amount: e.amount, currency: e.currency, category: e.category || 'general', paidBy: e.paid_by, splits: e.splits || [], date: e.date || e.created_at, createdAt: e.created_at }));
};

export const deleteExpense = async (expenseId) => {
  if (!isSupabaseConfigured()) {
    const expenses = await getData(KEYS.EXPENSES);
    await setData(KEYS.EXPENSES, expenses.filter(e => e.id !== expenseId));
    return;
  }
  const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
  if (error) throw new Error('Failed to delete expense');
};

// --- Balances ---
export const calculateBalances = async (userId) => {
  if (isDemo(userId)) {
    const expenses = await getData(KEYS.EXPENSES);
    const settlements = await getData(KEYS.SETTLEMENTS);
    const users = await getData(KEYS.USERS);
    return _calculateBalancesFromData(userId, expenses, settlements, users);
  }

  const userGroups = await getGroups(userId);
  const groupIds = userGroups.map(g => g.id);

  let expenses = [];
  if (groupIds.length > 0) {
    const { data } = await supabase.from('expenses').select('id,paid_by,splits,amount').in('group_id', groupIds);
    expenses = (data || []).map(e => ({ paidBy: e.paid_by, splits: e.splits || [], amount: e.amount }));
  }

  const { data: settlementsData } = await supabase.from('settlements').select('paid_by,paid_to,amount')
    .or(`paid_by.eq.${userId},paid_to.eq.${userId}`);
  const settlements = (settlementsData || []).map(s => ({ paidBy: s.paid_by, paidTo: s.paid_to, amount: s.amount }));

  const balanceMap = {};
  expenses.forEach(expense => {
    const paidById = expense.paidBy?.id;
    if (!paidById) return;
    expense.splits.forEach(split => {
      if (split.userId === paidById) return;
      const key = [paidById, split.userId].sort().join('_');
      if (!balanceMap[key]) balanceMap[key] = { user1: paidById, user2: split.userId, amount: 0 };
      if (paidById === balanceMap[key].user1) balanceMap[key].amount += split.amount;
      else balanceMap[key].amount -= split.amount;
    });
  });

  settlements.forEach(s => {
    const key = [s.paidBy, s.paidTo].sort().join('_');
    if (!balanceMap[key]) balanceMap[key] = { user1: s.paidBy, user2: s.paidTo, amount: 0 };
    if (s.paidBy === balanceMap[key].user1) balanceMap[key].amount -= s.amount;
    else balanceMap[key].amount += s.amount;
  });

  const otherUserIds = [...new Set(
    Object.values(balanceMap).flatMap(b => [b.user1, b.user2]).filter(id => id !== userId)
  )];
  let otherUsers = [];
  if (otherUserIds.length > 0) {
    const { data } = await supabase.from('users').select('id,name,email,avatar').in('id', otherUserIds);
    otherUsers = data || [];
  }

  const result = [];
  Object.values(balanceMap).forEach(b => {
    if (Math.abs(b.amount) < 0.01) return;
    if (b.user1 === userId || b.user2 === userId) {
      const otherUserId = b.user1 === userId ? b.user2 : b.user1;
      const otherUser = otherUsers.find(u => u.id === otherUserId);
      if (!otherUser) return;
      const amount = b.user1 === userId ? b.amount : -b.amount;
      result.push({ userId: otherUserId, name: otherUser.name, email: otherUser.email, avatar: otherUser.avatar, amount });
    }
  });
  return result;
};

const _calculateBalancesFromData = (userId, expenses, settlements, users) => {
  const balanceMap = {};
  expenses.forEach(expense => {
    const paidById = expense.paidBy?.id || expense.paidBy;
    expense.splits.forEach(split => {
      if (split.userId === paidById) return;
      const key = [paidById, split.userId].sort().join('_');
      if (!balanceMap[key]) balanceMap[key] = { user1: paidById, user2: split.userId, amount: 0 };
      if (paidById === balanceMap[key].user1) balanceMap[key].amount += split.amount;
      else balanceMap[key].amount -= split.amount;
    });
  });
  settlements.forEach(s => {
    const key = [s.paidBy, s.paidTo].sort().join('_');
    if (!balanceMap[key]) balanceMap[key] = { user1: s.paidBy, user2: s.paidTo, amount: 0 };
    if (s.paidBy === balanceMap[key].user1) balanceMap[key].amount -= s.amount;
    else balanceMap[key].amount += s.amount;
  });
  const result = [];
  Object.values(balanceMap).forEach(b => {
    if (Math.abs(b.amount) < 0.01) return;
    if (b.user1 === userId || b.user2 === userId) {
      const otherUserId = b.user1 === userId ? b.user2 : b.user1;
      const otherUser = users.find(u => u.id === otherUserId);
      if (!otherUser) return;
      const amount = b.user1 === userId ? b.amount : -b.amount;
      result.push({ userId: otherUserId, name: otherUser.name, email: otherUser.email, avatar: otherUser.avatar, amount });
    }
  });
  return result;
};

export const calculateGroupBalances = async (groupId, members) => {
  if (isDemo(members[0]?.id)) {
    const expenses = await getData(KEYS.EXPENSES);
    const settlements = await getData(KEYS.SETTLEMENTS);
    const groupExpenses = expenses.filter(e => e.groupId === groupId);
    const groupSettlements = settlements.filter(s => s.groupId === groupId);
    return _calculateGroupBalancesFromData(groupId, members, groupExpenses, groupSettlements);
  }

  const [{ data: expensesData }, { data: settlementsData }] = await Promise.all([
    supabase.from('expenses').select('paid_by,splits,amount').eq('group_id', groupId),
    supabase.from('settlements').select('paid_by,paid_to,amount').eq('group_id', groupId),
  ]);
  const groupExpenses = (expensesData || []).map(e => ({ paidBy: e.paid_by, splits: e.splits || [], amount: e.amount }));
  const groupSettlements = (settlementsData || []).map(s => ({ paidBy: s.paid_by, paidTo: s.paid_to, amount: s.amount }));
  return _calculateGroupBalancesFromData(groupId, members, groupExpenses, groupSettlements);
};

const _calculateGroupBalancesFromData = (groupId, members, groupExpenses, groupSettlements) => {
  const balanceMap = {};
  members.forEach(m => balanceMap[m.id] = 0);

  groupExpenses.forEach(expense => {
    const paidById = expense.paidBy?.id || expense.paidBy;
    if (balanceMap[paidById] !== undefined) balanceMap[paidById] += expense.amount;
    expense.splits.forEach(split => {
      if (balanceMap[split.userId] !== undefined) balanceMap[split.userId] -= split.amount;
    });
  });

  groupSettlements.forEach(s => {
    const paidBy = s.paidBy || s.paid_by;
    const paidTo = s.paidTo || s.paid_to;
    if (balanceMap[paidBy] !== undefined) balanceMap[paidBy] += s.amount;
    if (balanceMap[paidTo] !== undefined) balanceMap[paidTo] -= s.amount;
  });

  return members.map(m => ({ ...m, balance: balanceMap[m.id] || 0 }));
};

// --- Settlements ---
export const recordSettlement = async (settlement) => {
  if (isDemo(settlement.paidBy)) {
    const settlements = await getData(KEYS.SETTLEMENTS);
    const newSettlement = { id: uuidv4(), ...settlement, createdAt: new Date().toISOString() };
    await setData(KEYS.SETTLEMENTS, [...settlements, newSettlement]);
    await addActivity({ type: 'settlement', settlementId: newSettlement.id, amount: newSettlement.amount, paidById: newSettlement.paidBy, paidToId: newSettlement.paidTo, userId: newSettlement.paidBy, createdAt: new Date().toISOString() });
    return newSettlement;
  }

  const newSettlement = {
    id: uuidv4(),
    paid_by: settlement.paidBy,
    paid_to: settlement.paidTo,
    amount: settlement.amount,
    currency: settlement.currency,
    group_id: settlement.groupId || null,
    note: settlement.note || '',
    created_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('settlements').insert(newSettlement);
  if (error) throw new Error('Failed to record settlement: ' + error.message);

  const local = { id: newSettlement.id, paidBy: newSettlement.paid_by, paidTo: newSettlement.paid_to, amount: newSettlement.amount, currency: newSettlement.currency, groupId: newSettlement.group_id, note: newSettlement.note, createdAt: newSettlement.created_at };
  await addActivity({ type: 'settlement', settlementId: local.id, amount: local.amount, paidById: local.paidBy, paidToId: local.paidTo, userId: local.paidBy, createdAt: new Date().toISOString() });
  return local;
};

// --- Activity ---
export const addActivity = async (activity) => {
  const newActivity = { id: uuidv4(), ...activity };

  if (isDemo(activity.userId)) {
    const activities = await getData(KEYS.ACTIVITY);
    await setData(KEYS.ACTIVITY, [newActivity, ...activities].slice(0, 200));
    return;
  }

  if (!isSupabaseConfigured()) return;
  await supabase.from('activity').upsert({
    id: newActivity.id,
    type: newActivity.type,
    user_id: newActivity.userId,
    group_id: newActivity.groupId || null,
    expense_id: newActivity.expenseId || null,
    description: newActivity.description || null,
    amount: newActivity.amount || null,
    group_name: newActivity.groupName || null,
    paid_by_name: newActivity.paidByName || null,
    created_at: newActivity.createdAt,
  }).then(() => {}, (e) => console.warn('Activity write failed:', e?.message));
};

export const getActivity = async (userId) => {
  if (isDemo(userId)) {
    const activities = await getData(KEYS.ACTIVITY);
    const groups = await getData(KEYS.GROUPS);
    return activities.filter(a => {
      if (a.userId === userId) return true;
      if (a.groupId) {
        const group = groups.find(g => g.id === a.groupId);
        return group && group.members.some(m => m.id === userId);
      }
      return false;
    }).slice(0, 50);
  }

  if (!isSupabaseConfigured()) return [];
  const userGroups = await getGroups(userId);
  const groupIds = userGroups.map(g => g.id);
  const groupIdsStr = groupIds.join(',');

  const { data } = await supabase.from('activity').select('*')
    .or(groupIds.length > 0 ? `user_id.eq.${userId},group_id.in.(${groupIdsStr})` : `user_id.eq.${userId}`)
    .order('created_at', { ascending: false }).limit(100);

  return (data || []).map(a => ({
    id: a.id, type: a.type, userId: a.user_id, groupId: a.group_id,
    expenseId: a.expense_id, description: a.description,
    amount: a.amount, groupName: a.group_name, paidByName: a.paid_by_name,
    createdAt: a.created_at,
  }));
};

export const getUserById = async (userId) => {
  if (isDemo(userId)) {
    const users = await getData(KEYS.USERS);
    const user = users.find(u => u.id === userId);
    if (!user) return null;
    const { password: _, ...safeUser } = user;
    return safeUser;
  }
  if (!isSupabaseConfigured()) return null;
  const { data } = await supabase.from('users').select('id,name,email,avatar,phone').eq('id', userId).single();
  if (!data) return null;
  return { id: data.id, name: data.name, email: data.email, avatar: data.avatar || null, phone: data.phone || '' };
};

export const searchUsersByEmail = async (email) => {
  if (!isSupabaseConfigured()) {
    const users = await getData(KEYS.USERS);
    return users.filter(u => u.email && u.email.toLowerCase().includes(email.toLowerCase())).map(({ password: _, ...u }) => u);
  }
  const { data } = await supabase.from('users').select('id,name,email,avatar,phone')
    .ilike('email', `%${email}%`).limit(10);
  return (data || []).map(u => ({ id: u.id, name: u.name, email: u.email, avatar: u.avatar || null, phone: u.phone || '' }));
};

// syncFromSupabase is no longer needed — reads go directly to Supabase.
// Kept as a no-op for compatibility with any remaining call sites.
export const syncFromSupabase = async (userId, userEmail) => {
  return { groups: 0, expenses: 0 };
};

// Seed demo data (local only)
export const seedDemoData = async () => {
  const users = await getData(KEYS.USERS);
  if (users.length > 0) return;
  const alice = { id: 'demo-alice', name: 'Alice Demo', email: 'alice@demo.com', password: 'demo123', avatar: null, phone: '', createdAt: new Date().toISOString() };
  const bob = { id: 'demo-bob', name: 'Bob Demo', email: 'bob@demo.com', password: 'demo123', avatar: null, phone: '', createdAt: new Date().toISOString() };
  const carol = { id: 'demo-carol', name: 'Carol Demo', email: 'carol@demo.com', password: 'demo123', avatar: null, phone: '', createdAt: new Date().toISOString() };
  await setData(KEYS.USERS, [alice, bob, carol]);
};

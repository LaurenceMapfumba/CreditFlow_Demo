import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import {
  api,
  CreditScoreResponse,
  formatDate,
  formatMoney,
  initials,
  KycDocument,
  LoanResponse,
  UserResponse,
} from '@/services/api';

const BLUE = '#2563EB';
const GREEN = '#16A34A';
const RED = '#DC2626';
const AMBER = '#D97706';
const CARD_DARK = '#1E3A8A';

type AdminTab = 'users' | 'kyc' | 'loans';

// ─── Score tier helpers ────────────────────────────────────────────────────────
function tierColor(tier: string): string {
  if (tier === 'A') return GREEN;
  if (tier === 'B') return '#16A34A99';
  if (tier === 'C') return AMBER;
  if (tier === 'D') return '#F97316';
  return RED;
}

export default function AdminScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user: authUser } = useAuth();
  const bottomPad = insets.bottom + BottomTabInset + Spacing.four;
  const topPad = Platform.OS === 'web' ? Spacing.six : insets.top + Spacing.three;

  const [tab, setTab] = useState<AdminTab>('users');
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [kycDocs, setKycDocs] = useState<KycDocument[]>([]);
  const [pendingLoans, setPendingLoans] = useState<LoanResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [rejectKycId, setRejectKycId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  // ── Profile modal state ──────────────────────────────────────────────────────
  const [profileUser, setProfileUser] = useState<UserResponse | null>(null);
  const [profileScore, setProfileScore] = useState<CreditScoreResponse | null>(null);
  const [profileLoans, setProfileLoans] = useState<LoanResponse[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);

  // Credit score edit state
  const [editingScore, setEditingScore] = useState(false);
  const [scoreFields, setScoreFields] = useState({
    score: '',
    riskTier: '',
    suggestedInterestRate: '',
    repaymentHistoryScore: '',
    mobileMoneyScore: '',
    bankBehaviourScore: '',
    kycScore: '',
  });
  const [scoreSaving, setScoreSaving] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);

  const isAdmin = authUser?.role === 'ADMIN';

  const loadAll = () => {
    setLoading(true);
    Promise.allSettled([
      api.admin.users().then(setUsers),
      api.admin.pendingKyc().then(setKycDocs),
      api.admin.pendingLoans().then(setPendingLoans),
    ])
      .then(results => {
        const fail = results.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;
        if (fail) setError(fail.reason?.message ?? 'Failed to load admin data');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isAdmin) loadAll();
    else setLoading(false);
  }, [isAdmin]);

  const withAction = async (id: number, fn: () => Promise<any>) => {
    setActionLoading(id);
    try { await fn(); }
    catch (e: any) { setError(e?.message ?? 'Action failed'); }
    finally { setActionLoading(null); }
  };

  const handleToggleUser = (u: UserResponse) =>
    withAction(u.id, async () => {
      if (u.active) await api.admin.deactivateUser(u.id);
      else await api.admin.activateUser(u.id);
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, active: !x.active } : x));
    });

  const handleDeleteUser = (u: UserResponse) =>
    withAction(u.id, async () => {
      await api.admin.deleteUser(u.id);
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, deleted: true, active: false } : x));
    });

  const handleRestoreUser = (u: UserResponse) =>
    withAction(u.id, async () => {
      await api.admin.restoreUser(u.id);
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, deleted: false, active: true } : x));
    });

  const handleApproveLoan = (id: number) =>
    withAction(id, async () => {
      await api.admin.reviewLoan(id, 'APPROVED');
      setPendingLoans(prev => prev.filter(l => l.id !== id));
    });

  const handleRejectLoan = (id: number) =>
    withAction(id, async () => {
      await api.admin.reviewLoan(id, 'REJECTED');
      setPendingLoans(prev => prev.filter(l => l.id !== id));
    });

  const handleApproveKyc = (id: number) =>
    withAction(id, async () => {
      await api.admin.approveKyc(id);
      setKycDocs(prev => prev.filter(d => d.id !== id));
    });

  const handleRejectKyc = (id: number) =>
    withAction(id, async () => {
      await api.admin.rejectKyc(id, rejectReason || 'Rejected by admin');
      setKycDocs(prev => prev.filter(d => d.id !== id));
      setRejectKycId(null);
      setRejectReason('');
    });

  // ── Profile open / close ────────────────────────────────────────────────────
  async function openProfile(u: UserResponse) {
    setProfileUser(u);
    setProfileScore(null);
    setProfileLoans([]);
    setEditingScore(false);
    setScoreError(null);
    setProfileLoading(true);
    await Promise.allSettled([
      api.admin.creditScore(u.id).then(setProfileScore).catch(() => {}),
      api.loans.borrowerHistory(u.id).then(setProfileLoans).catch(() => {}),
    ]);
    setProfileLoading(false);
  }

  function closeProfile() {
    setProfileUser(null);
    setEditingScore(false);
  }

  function startEditScore() {
    if (!profileScore) return;
    setScoreFields({
      score: String(profileScore.score ?? ''),
      riskTier: profileScore.riskTier ?? '',
      suggestedInterestRate: String(profileScore.suggestedInterestRate ?? ''),
      repaymentHistoryScore: String(profileScore.repaymentHistoryScore ?? ''),
      mobileMoneyScore: String(profileScore.mobileMoneyScore ?? ''),
      bankBehaviourScore: String(profileScore.bankBehaviourScore ?? ''),
      kycScore: String(profileScore.kycScore ?? ''),
    });
    setScoreError(null);
    setEditingScore(true);
  }

  async function saveScoreEdit() {
    if (!profileUser) return;
    const score = parseInt(scoreFields.score);
    if (isNaN(score) || score < 300 || score > 850) {
      setScoreError('Score must be between 300 and 850');
      return;
    }
    const validTiers = ['A', 'B', 'C', 'D', 'E'];
    if (scoreFields.riskTier && !validTiers.includes(scoreFields.riskTier.toUpperCase())) {
      setScoreError('Risk tier must be A, B, C, D or E');
      return;
    }
    setScoreSaving(true);
    setScoreError(null);
    try {
      const updated = await api.admin.updateCreditScore(profileUser.id, {
        score,
        riskTier: scoreFields.riskTier.toUpperCase() || undefined,
        suggestedInterestRate: parseFloat(scoreFields.suggestedInterestRate) || undefined,
        repaymentHistoryScore: parseFloat(scoreFields.repaymentHistoryScore) || undefined,
        mobileMoneyScore: parseFloat(scoreFields.mobileMoneyScore) || undefined,
        bankBehaviourScore: parseFloat(scoreFields.bankBehaviourScore) || undefined,
        kycScore: parseFloat(scoreFields.kycScore) || undefined,
      });
      setProfileScore(updated);
      setEditingScore(false);
    } catch (e: any) {
      setScoreError(e?.message ?? 'Failed to save');
    } finally {
      setScoreSaving(false);
    }
  }

  const activeUsers = users.filter(u => u.active).length;
  const bannedUsers = users.filter(u => !u.active).length;

  if (!isAdmin) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background, flex: 1 }]}>
        <ThemedText style={{ color: RED, fontSize: 18, fontWeight: '700' }}>Access Denied</ThemedText>
        <ThemedText themeColor="textSecondary">This page is only for administrators.</ThemedText>
      </View>
    );
  }

  return (
    <>
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.contentContainer, { paddingTop: topPad, paddingBottom: bottomPad }]}>
      <View style={styles.inner}>

        {/* Header */}
        <View style={[styles.heroCard, { backgroundColor: CARD_DARK }]}>
          <View>
            <ThemedText style={styles.heroLabel}>Admin Panel</ThemedText>
            <ThemedText style={styles.heroName}>CreditFlow Management</ThemedText>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <ThemedText style={styles.heroStatVal}>{users.length}</ThemedText>
              <ThemedText style={styles.heroStatLabel}>Total Users</ThemedText>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <ThemedText style={[styles.heroStatVal, { color: '#4ade80' }]}>{activeUsers}</ThemedText>
              <ThemedText style={styles.heroStatLabel}>Active</ThemedText>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <ThemedText style={[styles.heroStatVal, { color: '#f87171' }]}>{bannedUsers}</ThemedText>
              <ThemedText style={styles.heroStatLabel}>Banned</ThemedText>
            </View>
          </View>
        </View>

        {error && (
          <ThemedView type="backgroundElement" style={styles.errorBox}>
            <ThemedText style={{ color: RED }}>{error}</ThemedText>
          </ThemedView>
        )}

        {/* Tab Toggle */}
        <ThemedView type="backgroundElement" style={styles.toggle}>
          {(['users', 'kyc', 'loans'] as AdminTab[]).map(t => {
            const labels: Record<AdminTab, string> = {
              users: `Users (${users.length})`,
              kyc: `KYC (${kycDocs.length})`,
              loans: `Loans (${pendingLoans.length})`,
            };
            return (
              <Pressable
                key={t}
                style={[styles.toggleBtn, tab === t && { backgroundColor: BLUE }]}
                onPress={() => setTab(t)}>
                <ThemedText type="small" style={tab === t ? styles.activeTabText : undefined}>
                  {labels[t]}
                </ThemedText>
              </Pressable>
            );
          })}
        </ThemedView>

        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator color={BLUE} size="large" />
          </View>
        )}

        {/* ── USERS TAB ── */}
        {!loading && tab === 'users' && (
          <>
            {users.length === 0 && (
              <ThemedView type="backgroundElement" style={styles.emptyBox}>
                <ThemedText themeColor="textSecondary">No users found.</ThemedText>
              </ThemedView>
            )}
            {users.map(u => {
              const isSelf = u.id === authUser?.userId;
              const busy = actionLoading === u.id;
              return (
                <ThemedView key={u.id} type="backgroundElement" style={styles.card}>
                  <View style={styles.cardRow}>
                    <View style={[styles.avatar, { backgroundColor: u.deleted ? '#71717A' : u.active ? BLUE : '#9CA3AF' }]}>
                      <ThemedText style={styles.avatarText}>
                        {initials(`${u.firstName} ${u.lastName}`)}
                      </ThemedText>
                    </View>
                    <View style={styles.cardInfo}>
                      <ThemedText type="smallBold">{u.firstName} {u.lastName}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">{u.email}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">{u.phoneNumber}</ThemedText>
                    </View>
                    <View style={styles.cardRight}>
                      <View style={[styles.badge, { backgroundColor: (u.deleted ? '#71717A' : u.active ? GREEN : RED) + '22' }]}>
                        <ThemedText style={[styles.badgeText, { color: u.deleted ? '#71717A' : u.active ? GREEN : RED }]}>
                          {u.deleted ? 'Deleted' : u.active ? 'Active' : 'Banned'}
                        </ThemedText>
                      </View>
                      <View style={[styles.badge, { backgroundColor: BLUE + '22', marginTop: 4 }]}>
                        <ThemedText style={[styles.badgeText, { color: BLUE }]}>{u.role}</ThemedText>
                      </View>
                    </View>
                  </View>

                  <View style={styles.userMeta}>
                    <ThemedText type="small" themeColor="textSecondary">
                      KYC: <ThemedText type="small" style={{ color: u.kycStatus === 'APPROVED' ? GREEN : AMBER }}>
                        {u.kycStatus}
                      </ThemedText>
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Balance: {formatMoney(u.walletBalance ?? 0)}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Joined: {formatDate(u.createdAt)}
                    </ThemedText>
                  </View>

                  {/* View Profile button — always shown */}
                  <Pressable
                    onPress={() => openProfile(u)}
                    style={({ pressed }) => [styles.profileBtn, pressed && styles.pressed]}>
                    <ThemedText style={styles.profileBtnText}>View Profile & Credit Score</ThemedText>
                  </Pressable>

                  {isSelf && (
                    <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                      (your account)
                    </ThemedText>
                  )}

                  {!isSelf && u.deleted && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.actionBtn,
                        { backgroundColor: GREEN + '15', borderColor: GREEN },
                        pressed && styles.pressed,
                        busy && styles.disabled,
                      ]}
                      onPress={() => handleRestoreUser(u)}
                      disabled={busy}>
                      {busy
                        ? <ActivityIndicator color={GREEN} size="small" />
                        : <ThemedText style={[styles.actionBtnText, { color: GREEN }]}>Restore Account</ThemedText>}
                    </Pressable>
                  )}

                  {!isSelf && !u.deleted && (
                    <View style={styles.btnRow}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.halfBtn,
                          { backgroundColor: u.active ? RED + '15' : GREEN + '15', borderWidth: 1, borderColor: u.active ? RED : GREEN },
                          pressed && styles.pressed,
                          busy && styles.disabled,
                        ]}
                        onPress={() => handleToggleUser(u)}
                        disabled={busy}>
                        {busy
                          ? <ActivityIndicator color={u.active ? RED : GREEN} size="small" />
                          : <ThemedText style={[styles.halfBtnText, { color: u.active ? RED : GREEN }]}>
                              {u.active ? 'Ban' : 'Unban'}
                            </ThemedText>}
                      </Pressable>

                      <Pressable
                        style={({ pressed }) => [
                          styles.halfBtn,
                          { backgroundColor: '#71717A15', borderWidth: 1, borderColor: '#71717A' },
                          pressed && styles.pressed,
                          busy && styles.disabled,
                        ]}
                        onPress={() => handleDeleteUser(u)}
                        disabled={busy}>
                        <ThemedText style={[styles.halfBtnText, { color: '#71717A' }]}>Delete</ThemedText>
                      </Pressable>
                    </View>
                  )}
                </ThemedView>
              );
            })}
          </>
        )}

        {/* ── KYC TAB ── */}
        {!loading && tab === 'kyc' && (
          <>
            {kycDocs.length === 0 && (
              <ThemedView type="backgroundElement" style={styles.emptyBox}>
                <ThemedText themeColor="textSecondary">No pending KYC submissions.</ThemedText>
              </ThemedView>
            )}
            {kycDocs.map(doc => {
              const busy = actionLoading === doc.id;
              const isRejecting = rejectKycId === doc.id;
              const userName = doc.user
                ? `${doc.user.firstName} ${doc.user.lastName}`
                : `User #${doc.id}`;

              return (
                <ThemedView key={doc.id} type="backgroundElement" style={styles.card}>
                  <View style={styles.cardRow}>
                    <View style={[styles.avatar, { backgroundColor: AMBER }]}>
                      <ThemedText style={styles.avatarText}>{initials(userName)}</ThemedText>
                    </View>
                    <View style={styles.cardInfo}>
                      <ThemedText type="smallBold">{userName}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">{doc.user?.email}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Submitted: {formatDate(doc.submittedAt)}
                      </ThemedText>
                    </View>
                    <View style={[styles.badge, { backgroundColor: AMBER + '22' }]}>
                      <ThemedText style={[styles.badgeText, { color: AMBER }]}>{doc.status}</ThemedText>
                    </View>
                  </View>

                  <ThemedView type="backgroundSelected" style={styles.docList}>
                    {[
                      { label: 'National ID', hasFile: !!doc.nationalIdPath },
                      { label: 'Police Clearance', hasFile: !!doc.policeClearancePath },
                      { label: 'Selfie Photo', hasFile: !!doc.selfiePath },
                    ].map(d => (
                      <View key={d.label} style={styles.docRow}>
                        <ThemedText type="small" style={{ color: d.hasFile ? GREEN : '#9CA3AF' }}>
                          {d.hasFile ? '✓' : '✗'} {d.label}
                        </ThemedText>
                      </View>
                    ))}
                  </ThemedView>

                  {isRejecting && (
                    <TextInput
                      style={[styles.reasonInput, { backgroundColor: theme.backgroundSelected, color: theme.text, borderColor: RED }]}
                      placeholder="Enter rejection reason..."
                      placeholderTextColor={theme.textSecondary}
                      value={rejectReason}
                      onChangeText={setRejectReason}
                      multiline
                    />
                  )}

                  <View style={styles.btnRow}>
                    <Pressable
                      style={({ pressed }) => [styles.halfBtn, { backgroundColor: GREEN }, pressed && styles.pressed, busy && styles.disabled]}
                      onPress={() => { setRejectKycId(null); handleApproveKyc(doc.id); }}
                      disabled={busy}>
                      {busy && !isRejecting
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <ThemedText style={styles.halfBtnText}>✓ Approve</ThemedText>}
                    </Pressable>

                    {isRejecting ? (
                      <Pressable
                        style={({ pressed }) => [styles.halfBtn, { backgroundColor: RED }, pressed && styles.pressed, busy && styles.disabled]}
                        onPress={() => handleRejectKyc(doc.id)}
                        disabled={busy}>
                        {busy
                          ? <ActivityIndicator color="#fff" size="small" />
                          : <ThemedText style={styles.halfBtnText}>Confirm Reject</ThemedText>}
                      </Pressable>
                    ) : (
                      <Pressable
                        style={({ pressed }) => [styles.halfBtn, { backgroundColor: RED + '15', borderWidth: 1, borderColor: RED }, pressed && styles.pressed]}
                        onPress={() => { setRejectKycId(doc.id); setRejectReason(''); }}>
                        <ThemedText style={[styles.halfBtnText, { color: RED }]}>✗ Reject</ThemedText>
                      </Pressable>
                    )}
                  </View>
                </ThemedView>
              );
            })}
          </>
        )}

        {/* ── LOANS TAB ── */}
        {!loading && tab === 'loans' && (
          <>
            {pendingLoans.length === 0 && (
              <ThemedView type="backgroundElement" style={styles.emptyBox}>
                <ThemedText themeColor="textSecondary">No loans pending review.</ThemedText>
              </ThemedView>
            )}
            {pendingLoans.map(loan => {
              const busy = actionLoading === loan.id;
              return (
                <ThemedView key={loan.id} type="backgroundElement" style={styles.card}>
                  <View style={styles.cardRow}>
                    <View style={[styles.avatar, { backgroundColor: BLUE }]}>
                      <ThemedText style={styles.avatarText}>{initials(loan.borrowerName)}</ThemedText>
                    </View>
                    <View style={styles.cardInfo}>
                      <ThemedText type="smallBold">{loan.borrowerName}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">{loan.purpose}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Applied: {formatDate(loan.createdAt)}
                      </ThemedText>
                    </View>
                    <View style={[styles.badge, { backgroundColor: AMBER + '22' }]}>
                      <ThemedText style={[styles.badgeText, { color: AMBER }]}>{loan.status}</ThemedText>
                    </View>
                  </View>

                  <ThemedView type="backgroundSelected" style={styles.loanStats}>
                    <View style={styles.loanStat}>
                      <ThemedText type="smallBold">{formatMoney(loan.principalAmount)}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">Amount</ThemedText>
                    </View>
                    <View style={styles.loanStat}>
                      <ThemedText type="smallBold" style={{ color: GREEN }}>
                        {Number(loan.interestRate).toFixed(1)}%
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">Rate</ThemedText>
                    </View>
                    <View style={styles.loanStat}>
                      <ThemedText type="smallBold">{loan.termMonths} mo</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">Term</ThemedText>
                    </View>
                    <View style={styles.loanStat}>
                      <ThemedText type="smallBold">{formatMoney(loan.monthlyRepayment ?? 0)}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">Monthly</ThemedText>
                    </View>
                  </ThemedView>

                  <View style={styles.btnRow}>
                    <Pressable
                      style={({ pressed }) => [styles.halfBtn, { backgroundColor: GREEN }, pressed && styles.pressed, busy && styles.disabled]}
                      onPress={() => handleApproveLoan(loan.id)}
                      disabled={busy}>
                      {busy
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <ThemedText style={styles.halfBtnText}>✓ Approve</ThemedText>}
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.halfBtn, { backgroundColor: RED + '15', borderWidth: 1, borderColor: RED }, pressed && styles.pressed, busy && styles.disabled]}
                      onPress={() => handleRejectLoan(loan.id)}
                      disabled={busy}>
                      <ThemedText style={[styles.halfBtnText, { color: RED }]}>✗ Reject</ThemedText>
                    </Pressable>
                  </View>
                </ThemedView>
              );
            })}
          </>
        )}
      </View>
    </ScrollView>

    {/* ── USER PROFILE MODAL ── */}
    <Modal
      visible={profileUser !== null}
      transparent={false}
      animationType="slide"
      onRequestClose={closeProfile}>
      <View style={[styles.profileScreen, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.profileHeader, { borderBottomColor: theme.backgroundElement }]}>
          <Pressable onPress={closeProfile} style={styles.backBtn}>
            <ThemedText style={{ color: BLUE, fontWeight: '700', fontSize: 16 }}>← Back</ThemedText>
          </Pressable>
          <ThemedText type="smallBold">User Profile</ThemedText>
          <View style={{ width: 60 }} />
        </View>

        {profileLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={BLUE} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.profileContent}>

            {/* Identity card */}
            {profileUser && (
              <View style={[styles.identityCard, { backgroundColor: CARD_DARK }]}>
                <View style={[styles.profileAvatar, {
                  backgroundColor: profileUser.deleted ? '#71717A' : profileUser.active ? BLUE : '#9CA3AF',
                }]}>
                  <ThemedText style={styles.profileAvatarText}>
                    {initials(`${profileUser.firstName} ${profileUser.lastName}`)}
                  </ThemedText>
                </View>
                <ThemedText style={styles.profileName}>
                  {profileUser.firstName} {profileUser.lastName}
                </ThemedText>
                <ThemedText style={styles.profileEmail}>{profileUser.email}</ThemedText>
                <ThemedText style={styles.profileEmail}>{profileUser.phoneNumber}</ThemedText>
                <View style={styles.profileBadges}>
                  <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                    <ThemedText style={[styles.badgeText, { color: '#fff' }]}>{profileUser.role}</ThemedText>
                  </View>
                  <View style={[styles.badge, { backgroundColor: profileUser.kycStatus === 'APPROVED' ? GREEN + '33' : AMBER + '33' }]}>
                    <ThemedText style={[styles.badgeText, { color: profileUser.kycStatus === 'APPROVED' ? '#4ade80' : '#fbbf24' }]}>
                      {profileUser.kycStatus === 'APPROVED' ? '✓ Verified' : profileUser.kycStatus}
                    </ThemedText>
                  </View>
                  <View style={[styles.badge, { backgroundColor: (profileUser.active ? GREEN : RED) + '33' }]}>
                    <ThemedText style={[styles.badgeText, { color: profileUser.active ? '#4ade80' : '#f87171' }]}>
                      {profileUser.deleted ? 'Deleted' : profileUser.active ? 'Active' : 'Banned'}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.balanceRow}>
                  <ThemedText style={styles.profileEmail}>Wallet Balance</ThemedText>
                  <ThemedText style={styles.balanceAmount}>
                    {formatMoney(profileUser.walletBalance ?? 0)}
                  </ThemedText>
                </View>
              </View>
            )}

            {/* Credit Score section */}
            <View style={styles.sectionHeader}>
              <ThemedText type="smallBold">Credit Score</ThemedText>
              {!editingScore && (
                <Pressable
                  onPress={startEditScore}
                  style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}>
                  <ThemedText style={styles.editBtnText}>✏ Edit Score</ThemedText>
                </Pressable>
              )}
            </View>

            {!profileScore && (
              <ThemedView type="backgroundElement" style={styles.emptyBox}>
                <ThemedText themeColor="textSecondary">No credit score on record.</ThemedText>
              </ThemedView>
            )}

            {profileScore && !editingScore && (
              <View style={[styles.scoreCard, { backgroundColor: CARD_DARK }]}>
                <View style={styles.scoreTop}>
                  <View>
                    <ThemedText style={styles.scoreLabel}>Score</ThemedText>
                    <ThemedText style={styles.scoreNumber}>{profileScore.score}</ThemedText>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: Spacing.two }}>
                    <View style={[styles.tierBadge, { backgroundColor: tierColor(profileScore.riskTier ?? '') }]}>
                      <ThemedText style={styles.tierText}>Tier {profileScore.riskTier}</ThemedText>
                    </View>
                    <ThemedText style={styles.scoreLabel}>
                      Rate: {Number(profileScore.suggestedInterestRate ?? 0).toFixed(1)}%
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.breakdown}>
                  {[
                    { label: 'Repayment History', value: profileScore.repaymentHistoryScore },
                    { label: 'Mobile Money', value: profileScore.mobileMoneyScore },
                    { label: 'Bank Behaviour', value: profileScore.bankBehaviourScore },
                    { label: 'KYC Score', value: profileScore.kycScore },
                  ].map(item => {
                    const pct = Math.min(100, Number(item.value ?? 0));
                    const barColor = pct >= 70 ? GREEN : pct >= 40 ? AMBER : RED;
                    return (
                      <View key={item.label} style={styles.breakdownRow}>
                        <ThemedText style={styles.breakdownLabel}>{item.label}</ThemedText>
                        <View style={styles.barBg}>
                          <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
                        </View>
                        <ThemedText style={styles.breakdownPct}>{pct.toFixed(0)}</ThemedText>
                      </View>
                    );
                  })}
                </View>
                <View style={styles.loanCountRow}>
                  {[
                    { label: 'Total Loans', value: profileScore.totalLoansTaken, color: BLUE },
                    { label: 'Repaid', value: profileScore.loansRepaidOnTime, color: GREEN },
                    { label: 'Defaulted', value: profileScore.loansDefaulted, color: RED },
                  ].map(s => (
                    <View key={s.label} style={styles.loanCountItem}>
                      <ThemedText style={[styles.loanCountVal, { color: s.color }]}>{s.value ?? 0}</ThemedText>
                      <ThemedText style={styles.scoreLabel}>{s.label}</ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── Edit Credit Score Form ── */}
            {editingScore && (
              <ThemedView type="backgroundElement" style={styles.editCard}>
                <ThemedText type="smallBold" style={{ marginBottom: Spacing.two }}>
                  Edit Credit Score
                </ThemedText>

                {[
                  { key: 'score', label: 'Score (300–850)', numeric: true },
                  { key: 'riskTier', label: 'Risk Tier (A / B / C / D / E)', numeric: false },
                  { key: 'suggestedInterestRate', label: 'Suggested Rate (%)', numeric: true },
                  { key: 'repaymentHistoryScore', label: 'Repayment History (0–100)', numeric: true },
                  { key: 'mobileMoneyScore', label: 'Mobile Money Score (0–100)', numeric: true },
                  { key: 'bankBehaviourScore', label: 'Bank Behaviour Score (0–100)', numeric: true },
                  { key: 'kycScore', label: 'KYC Score (0–100)', numeric: true },
                ].map(field => (
                  <View key={field.key} style={styles.fieldRow}>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.fieldLabel}>
                      {field.label}
                    </ThemedText>
                    <TextInput
                      style={[styles.fieldInput, { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}
                      value={scoreFields[field.key as keyof typeof scoreFields]}
                      onChangeText={val =>
                        setScoreFields(prev => ({ ...prev, [field.key]: val }))
                      }
                      keyboardType={field.numeric ? 'decimal-pad' : 'default'}
                      autoCapitalize="characters"
                      editable={!scoreSaving}
                    />
                  </View>
                ))}

                {scoreError && (
                  <View style={styles.scoreErrorBox}>
                    <ThemedText style={{ color: RED, fontSize: 13 }}>{scoreError}</ThemedText>
                  </View>
                )}

                <View style={styles.btnRow}>
                  <Pressable
                    onPress={saveScoreEdit}
                    disabled={scoreSaving}
                    style={({ pressed }) => [styles.halfBtn, { backgroundColor: BLUE }, (pressed || scoreSaving) && styles.pressed]}>
                    {scoreSaving
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <ThemedText style={styles.halfBtnText}>Save Changes</ThemedText>}
                  </Pressable>
                  <Pressable
                    onPress={() => setEditingScore(false)}
                    disabled={scoreSaving}
                    style={({ pressed }) => [styles.halfBtn, { backgroundColor: theme.backgroundSelected }, pressed && styles.pressed]}>
                    <ThemedText style={[styles.halfBtnText, { color: theme.text }]}>Cancel</ThemedText>
                  </Pressable>
                </View>
              </ThemedView>
            )}

            {/* Loan history */}
            {profileLoans.length > 0 && (
              <>
                <ThemedText type="smallBold" style={{ marginTop: Spacing.two }}>Loan History</ThemedText>
                {profileLoans.map(loan => {
                  const pct = loan.principalAmount > 0
                    ? Math.min(100, Math.round((loan.amountRepaid / loan.principalAmount) * 100))
                    : 0;
                  const col =
                    loan.status === 'COMPLETED' ? GREEN :
                    loan.status === 'DEFAULTED' || loan.status === 'REJECTED' ? RED :
                    loan.status === 'ACTIVE' ? BLUE : AMBER;
                  return (
                    <ThemedView key={loan.id} type="backgroundElement" style={styles.historyCard}>
                      <View style={styles.historyTop}>
                        <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>{loan.purpose}</ThemedText>
                        <View style={[styles.badge, { backgroundColor: col + '22' }]}>
                          <ThemedText style={[styles.badgeText, { color: col }]}>{loan.status}</ThemedText>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: Spacing.three, alignItems: 'baseline' }}>
                        <ThemedText type="smallBold">{formatMoney(loan.principalAmount)}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {Number(loan.interestRate).toFixed(1)}% · {loan.termMonths} mo
                        </ThemedText>
                      </View>
                      <View style={styles.progressBg}>
                        <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: col }]} />
                      </View>
                      <ThemedText type="small" themeColor="textSecondary">
                        {pct}% repaid{loan.createdAt ? ` · ${formatDate(loan.createdAt)}` : ''}
                      </ThemedText>
                    </ThemedView>
                  );
                })}
              </>
            )}

            {profileLoans.length === 0 && !profileLoading && (
              <ThemedView type="backgroundElement" style={styles.emptyBox}>
                <ThemedText themeColor="textSecondary">No loan history.</ThemedText>
              </ThemedView>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  contentContainer: { flexDirection: 'row', justifyContent: 'center' },
  inner: { flex: 1, maxWidth: MaxContentWidth, paddingHorizontal: Spacing.four, gap: Spacing.three },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.six, gap: Spacing.two },

  heroCard: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.three },
  heroLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 13 },
  heroName: { color: '#fff', fontSize: 22, fontWeight: '800' },
  heroStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  heroStat: { flex: 1, alignItems: 'center', gap: 2 },
  heroStatVal: { color: '#fff', fontSize: 22, fontWeight: '700' },
  heroStatLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 12 },
  heroStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },

  errorBox: { borderRadius: Spacing.three, padding: Spacing.three },
  emptyBox: { borderRadius: Spacing.three, padding: Spacing.four, alignItems: 'center' },

  toggle: { flexDirection: 'row', borderRadius: Spacing.three, padding: Spacing.one },
  toggleBtn: { flex: 1, paddingVertical: Spacing.two, borderRadius: Spacing.two, alignItems: 'center' },
  activeTabText: { color: '#fff' },

  card: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.three },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  cardInfo: { flex: 1, gap: 2 },
  cardRight: { alignItems: 'flex-end' },

  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  badge: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.half, borderRadius: Spacing.two },
  badgeText: { fontSize: 11, fontWeight: '600' },

  userMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },

  profileBtn: {
    borderWidth: 1.5,
    borderColor: BLUE,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  profileBtnText: { color: BLUE, fontWeight: '700', fontSize: 14 },

  actionBtn: { borderWidth: 1.5, borderRadius: Spacing.three, paddingVertical: Spacing.two, alignItems: 'center' },
  actionBtnText: { fontWeight: '700', fontSize: 14 },

  docList: { borderRadius: Spacing.two, padding: Spacing.three, gap: Spacing.one },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },

  reasonInput: {
    borderWidth: 1.5,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
  },

  btnRow: { flexDirection: 'row', gap: Spacing.three },
  halfBtn: { flex: 1, paddingVertical: Spacing.two + 2, borderRadius: Spacing.three, alignItems: 'center' },
  halfBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  loanStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  loanStat: { alignItems: 'center', gap: Spacing.half },

  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },

  // ── Profile screen ────────────────────────────────────────────────────────
  profileScreen: { flex: 1 },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
  },
  backBtn: { width: 60 },
  profileContent: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six },

  identityCard: { borderRadius: Spacing.four, padding: Spacing.four, alignItems: 'center', gap: Spacing.two },
  profileAvatar: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  profileAvatarText: { color: '#fff', fontWeight: '700', fontSize: 26 },
  profileName: { color: '#fff', fontSize: 20, fontWeight: '800' },
  profileEmail: { color: 'rgba(255,255,255,0.65)', fontSize: 13 },
  profileBadges: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap', justifyContent: 'center' },
  balanceRow: { alignItems: 'center', gap: 2, marginTop: Spacing.one },
  balanceAmount: { color: '#fff', fontSize: 22, fontWeight: '700' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editBtn: {
    borderWidth: 1.5,
    borderColor: BLUE,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  editBtnText: { color: BLUE, fontWeight: '700', fontSize: 13 },

  scoreCard: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.three },
  scoreTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  scoreLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 12 },
  scoreNumber: { color: '#fff', fontSize: 52, fontWeight: '700', lineHeight: 60 },
  tierBadge: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: Spacing.three },
  tierText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  breakdown: { gap: Spacing.two },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  breakdownLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12, width: 130 },
  barBg: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  breakdownPct: { color: 'rgba(255,255,255,0.65)', fontSize: 12, width: 24, textAlign: 'right' },
  loanCountRow: { flexDirection: 'row', justifyContent: 'space-around' },
  loanCountItem: { alignItems: 'center', gap: 2 },
  loanCountVal: { fontSize: 22, fontWeight: '700' },

  editCard: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.three },
  fieldRow: { gap: Spacing.one },
  fieldLabel: { marginBottom: 2 },
  fieldInput: {
    borderWidth: 1.5,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
    fontWeight: '600',
  },
  scoreErrorBox: { backgroundColor: RED + '15', borderRadius: Spacing.two, padding: Spacing.two, alignItems: 'center' },

  historyCard: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  historyTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  progressBg: { height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.1)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
});

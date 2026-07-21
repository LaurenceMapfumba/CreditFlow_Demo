import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
  isCreditTx,
  LoanResponse,
  TransactionResponse,
  UserResponse,
} from '@/services/api';

const BLUE = '#2563EB';
const GREEN = '#16A34A';
const AMBER = '#D97706';
const PURPLE = '#7C3AED';
const RED = '#DC2626';
const CARD_DARK = '#1E3A8A';

function riskColor(tier: string): string {
  const t = tier.toUpperCase();
  if (t.includes('LOW')) return GREEN;
  if (t.includes('HIGH')) return RED;
  return AMBER;
}

function riskLabel(tier: string): string {
  const t = tier.toUpperCase();
  if (t.includes('LOW')) return 'Good';
  if (t.includes('HIGH')) return 'High Risk';
  return 'Fair';
}

function kycColor(status: UserResponse['kycStatus']): string {
  if (status === 'APPROVED') return GREEN;
  if (status === 'REJECTED') return RED;
  return AMBER;
}

function kycLabel(status: UserResponse['kycStatus']): string {
  if (status === 'APPROVED') return 'Verified';
  if (status === 'SUBMITTED') return 'In Review';
  if (status === 'REJECTED') return 'Rejected';
  return 'Pending';
}

export default function DashboardScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user: authUser, logout } = useAuth();
  const bottomPad = insets.bottom + BottomTabInset + Spacing.four;
  const topPad = Platform.OS === 'web' ? Spacing.six : insets.top + Spacing.three;

  const role = authUser?.role;
  const quickActions = useMemo(() => {
    const actions: { label: string; color: string; symbol: string; onPress: () => void }[] = [];
    if (role === 'BORROWER') {
      actions.push({ label: 'Borrow', color: BLUE, symbol: '$', onPress: () => router.push('/loans') });
      actions.push({ label: 'Repay', color: AMBER, symbol: '↺', onPress: () => router.push('/loans') });
    }
    if (role === 'LENDER' || role === 'INVESTOR') {
      actions.push({ label: 'Lend', color: GREEN, symbol: '↑', onPress: () => router.push('/explore') });
    }
    actions.push({ label: 'Wallet', color: PURPLE, symbol: '◎', onPress: () => router.push('/wallet') });
    return actions;
  }, [role]);

  const [user, setUser] = useState<UserResponse | null>(null);
  const [creditScore, setCreditScore] = useState<CreditScoreResponse | null>(null);
  const [activeLoans, setActiveLoans] = useState<LoanResponse[]>([]);
  const [activity, setActivity] = useState<TransactionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api.users.me().then(setUser),
      api.creditScore.myScore().then(setCreditScore),
      api.loans
        .myLoans()
        .then(loans => setActiveLoans(loans.filter(l => l.status === 'ACTIVE' || l.status === 'FUNDED')))
        .catch(() => {}),
      api.transactions.list(0, 4).then(setActivity).catch(() => {}),
    ])
      .then(results => {
        const firstFail = results.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;
        if (firstFail && !user) setError(firstFail.reason?.message ?? 'Failed to load data');
      })
      .finally(() => setLoading(false));
  }, []);

  const displayName = user
    ? `${user.firstName} ${user.lastName[0]}.`
    : authUser?.fullName ?? 'User';

  const avatarInitials = user
    ? `${user.firstName[0]}${user.lastName[0]}`
    : (authUser?.fullName ?? 'U').split(' ').map(w => w[0]).join('').slice(0, 2);

  const activeLoan = activeLoans[0] ?? null;
  const activeLoansCount = activeLoans.length;

  const tier = creditScore?.riskTier ?? '';
  const scoreBadgeColor = tier ? riskColor(tier) : AMBER;

  const kycStatus = user?.kycStatus ?? 'PENDING';
  const kvcCol = kycColor(kycStatus);
  const kycLbl = kycLabel(kycStatus);

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.contentContainer, { paddingTop: topPad, paddingBottom: bottomPad }]}>
      <View style={styles.inner}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <ThemedText type="small" themeColor="textSecondary">Good morning</ThemedText>
            <ThemedText type="subtitle">{displayName}</ThemedText>
          </View>
          <Pressable onPress={logout} style={styles.avatar}>
            <ThemedText style={styles.avatarText}>{avatarInitials.toUpperCase()}</ThemedText>
          </Pressable>
        </View>

        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator color={BLUE} size="large" />
          </View>
        )}

        {!loading && error && (
          <ThemedView type="backgroundElement" style={styles.errorBox}>
            <ThemedText style={{ color: RED }}>{error}</ThemedText>
          </ThemedView>
        )}

        {!loading && (
          <>
            {/* Credit Score Card */}
            <View style={[styles.scoreCard, { backgroundColor: CARD_DARK }]}>
              <View style={styles.scoreTop}>
                <View>
                  <ThemedText style={styles.whiteLabel}>Credit Score</ThemedText>
                  <ThemedText style={styles.scoreNumber}>
                    {creditScore ? creditScore.score : '—'}
                  </ThemedText>
                </View>
                <View style={[styles.scoreBadge, { backgroundColor: scoreBadgeColor }]}>
                  <ThemedText style={styles.scoreBadgeText}>
                    ✓ {tier ? riskLabel(tier) : 'N/A'}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.scoreStats}>
                <View style={styles.scoreStat}>
                  <ThemedText style={styles.scoreStatValue}>
                    {user ? formatMoney(user.walletBalance) : '—'}
                  </ThemedText>
                  <ThemedText style={styles.whiteLabel}>Available</ThemedText>
                </View>
                <View style={styles.scoreDivider} />
                <View style={styles.scoreStat}>
                  <ThemedText style={styles.scoreStatValue}>{activeLoansCount}</ThemedText>
                  <ThemedText style={styles.whiteLabel}>Active Loans</ThemedText>
                </View>
                <View style={styles.scoreDivider} />
                <View style={styles.scoreStat}>
                  <ThemedText style={styles.scoreStatValue}>
                    {creditScore ? `${Number(creditScore.suggestedInterestRate).toFixed(1)}%` : '—'}
                  </ThemedText>
                  <ThemedText style={styles.whiteLabel}>Suggested Rate</ThemedText>
                </View>
              </View>
            </View>

            {/* Quick Actions */}
            {quickActions.length > 0 && (
              <>
                <ThemedText type="smallBold" style={styles.sectionLabel}>Quick Actions</ThemedText>
                <View style={styles.actionsRow}>
                  {quickActions.map(action => (
                    <Pressable
                      key={action.label}
                      onPress={action.onPress}
                      style={({ pressed }) => [styles.actionItem, pressed && styles.pressed]}>
                      <View style={[styles.actionIcon, { backgroundColor: action.color + '22' }]}>
                        <ThemedText style={[styles.actionSymbol, { color: action.color }]}>{action.symbol}</ThemedText>
                      </View>
                      <ThemedText type="small">{action.label}</ThemedText>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {/* Active Loan */}
            {activeLoan && (
              <>
                <ThemedText type="smallBold" style={styles.sectionLabel}>Active Loan</ThemedText>
                <ThemedView type="backgroundElement" style={styles.card}>
                  <View style={styles.cardRow}>
                    <View>
                      <ThemedText type="small" themeColor="textSecondary">{activeLoan.purpose}</ThemedText>
                      <ThemedText style={styles.loanAmount}>{formatMoney(activeLoan.principalAmount)}</ThemedText>
                    </View>
                    <View style={[styles.badge, { backgroundColor: GREEN + '22' }]}>
                      <ThemedText style={[styles.badgeText, { color: GREEN }]}>{activeLoan.status}</ThemedText>
                    </View>
                  </View>
                  {activeLoan.principalAmount > 0 && (
                    <>
                      <View style={styles.progressBg}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${Math.min(100, Math.round((activeLoan.amountRepaid / activeLoan.principalAmount) * 100))}%` as any,
                              backgroundColor: BLUE,
                            },
                          ]}
                        />
                      </View>
                      <View style={styles.cardRow}>
                        <ThemedText type="small" themeColor="textSecondary">
                          Repaid: {formatMoney(activeLoan.amountRepaid)} of {formatMoney(activeLoan.principalAmount)}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {activeLoan.dueDate ? `Due: ${formatDate(activeLoan.dueDate)}` : ''}
                        </ThemedText>
                      </View>
                    </>
                  )}
                </ThemedView>
              </>
            )}

            {/* KYC Status */}
            <ThemedText type="smallBold" style={styles.sectionLabel}>Verification Status</ThemedText>
            <ThemedView type="backgroundElement" style={styles.card}>
              {[
                { label: 'National ID', color: kvcCol, status: kycLbl },
                { label: 'Police Clearance', color: kvcCol, status: kycLbl },
                { label: 'Selfie Photo', color: kvcCol, status: kycLbl },
                { label: 'EcoCash Link', color: BLUE, status: 'Linked' },
              ].map((item, i, arr) => (
                <View key={item.label}>
                  <View style={styles.kycRow}>
                    <ThemedText type="small">{item.label}</ThemedText>
                    <View style={[styles.badge, { backgroundColor: item.color + '22' }]}>
                      <ThemedText style={[styles.badgeText, { color: item.color }]}>✓ {item.status}</ThemedText>
                    </View>
                  </View>
                  {i < arr.length - 1 && <ThemedView type="backgroundSelected" style={styles.separator} />}
                </View>
              ))}
            </ThemedView>

            {/* Recent Activity */}
            {activity.length > 0 && (
              <>
                <ThemedText type="smallBold" style={styles.sectionLabel}>Recent Activity</ThemedText>
                <ThemedView type="backgroundElement" style={[styles.card, styles.cardNoGap]}>
                  {activity.map((tx, i) => {
                    const credit = isCreditTx(tx.type);
                    return (
                      <View key={tx.id}>
                        <View style={styles.activityRow}>
                          <View style={[styles.dot, { backgroundColor: credit ? GREEN : RED }]} />
                          <View style={styles.activityInfo}>
                            <ThemedText type="small">{tx.description || tx.type}</ThemedText>
                            <ThemedText type="small" themeColor="textSecondary">
                              {tx.paymentMethod} · {formatDate(tx.createdAt)}
                            </ThemedText>
                          </View>
                          <ThemedText style={[styles.amountText, { color: credit ? GREEN : RED }]}>
                            {credit ? '+' : '-'}{formatMoney(tx.amount)}
                          </ThemedText>
                        </View>
                        {i < activity.length - 1 && (
                          <ThemedView type="backgroundSelected" style={styles.separator} />
                        )}
                      </View>
                    );
                  })}
                </ThemedView>
              </>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  contentContainer: { flexDirection: 'row', justifyContent: 'center' },
  inner: { flex: 1, maxWidth: MaxContentWidth, paddingHorizontal: Spacing.four, gap: Spacing.three },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BLUE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  centered: { alignItems: 'center', paddingVertical: Spacing.six },
  errorBox: { borderRadius: Spacing.three, padding: Spacing.three },
  scoreCard: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.three },
  scoreTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  whiteLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 13 },
  scoreNumber: { color: '#fff', fontSize: 56, fontWeight: '700', lineHeight: 64 },
  scoreBadge: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.three,
    marginTop: Spacing.two,
  },
  scoreBadgeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  scoreStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  scoreStat: { flex: 1, alignItems: 'center' },
  scoreStatValue: { color: '#fff', fontSize: 18, fontWeight: '700' },
  scoreDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  sectionLabel: { marginTop: Spacing.one },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actionItem: { flex: 1, alignItems: 'center', gap: Spacing.two },
  pressed: { opacity: 0.7 },
  actionIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  actionSymbol: { fontSize: 22, fontWeight: '700' },
  card: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.three },
  cardNoGap: { gap: 0, padding: 0, overflow: 'hidden' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  loanAmount: { fontSize: 26, fontWeight: '700' },
  badge: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.half, borderRadius: Spacing.two },
  badgeText: { fontSize: 12, fontWeight: '600' },
  progressBg: { height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.1)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  kycRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.two },
  separator: { height: 1, marginHorizontal: Spacing.three },
  activityRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.three, gap: Spacing.three },
  dot: { width: 10, height: 10, borderRadius: 5 },
  activityInfo: { flex: 1 },
  amountText: { fontSize: 14, fontWeight: '700' },
});

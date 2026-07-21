import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
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
  LoanResponse,
  loanRiskColor,
  UserResponse,
} from '@/services/api';

const BLUE = '#2563EB';
const GREEN = '#16A34A';
const AMBER = '#D97706';
const RED = '#DC2626';

const RISK_FILTERS = ['All', 'Low', 'Medium', 'High'] as const;
type RiskFilter = (typeof RISK_FILTERS)[number];

export default function MarketScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user: authUser } = useAuth();
  const canFund = authUser?.role === 'LENDER' || authUser?.role === 'INVESTOR';
  const bottomPad = insets.bottom + BottomTabInset + Spacing.four;
  const topPad = Platform.OS === 'web' ? Spacing.six : insets.top + Spacing.three;

  const [loans, setLoans] = useState<LoanResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<RiskFilter>('All');

  // Borrower profile sheet
  const [profileLoan, setProfileLoan] = useState<LoanResponse | null>(null);
  const [profileUser, setProfileUser] = useState<UserResponse | null>(null);
  const [profileScore, setProfileScore] = useState<CreditScoreResponse | null>(null);
  const [profileHistory, setProfileHistory] = useState<LoanResponse[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);

  async function openProfile(loan: LoanResponse) {
    setProfileLoan(loan);
    setProfileUser(null);
    setProfileScore(null);
    setProfileHistory([]);
    setProfileLoading(true);
    await Promise.allSettled([
      api.users.byId(loan.borrowerId).then(setProfileUser).catch(() => {}),
      api.creditScore.forUser(loan.borrowerId).then(setProfileScore).catch(() => {}),
      api.loans.borrowerHistory(loan.borrowerId).then(setProfileHistory).catch(() => {}),
    ]);
    setProfileLoading(false);
  }

  function closeProfile() {
    setProfileLoan(null);
  }

  // Invest modal
  const [investLoan, setInvestLoan] = useState<LoanResponse | null>(null);
  const [investAmount, setInvestAmount] = useState('');
  const [investProcessing, setInvestProcessing] = useState(false);
  const [investError, setInvestError] = useState<string | null>(null);

  function loadMarket() {
    api.loans
      .marketplace()
      .then(setLoans)
      .catch(e => setError(e?.message ?? 'Could not load marketplace'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadMarket();
  }, []);

  function openInvest(loan: LoanResponse) {
    setInvestLoan(loan);
    setInvestAmount('');
    setInvestError(null);
  }

  function closeInvest() {
    if (investProcessing) return;
    setInvestLoan(null);
    setInvestAmount('');
    setInvestError(null);
  }

  async function handleInvest() {
    if (!investLoan) return;
    const amount = parseFloat(investAmount);
    if (!investAmount || isNaN(amount) || amount < 50) {
      setInvestError('Minimum investment is $50.00');
      return;
    }
    const remaining = investLoan.principalAmount - investLoan.fundedAmount;
    if (amount > remaining) {
      setInvestError(`Maximum you can invest: ${formatMoney(remaining)}`);
      return;
    }
    setInvestProcessing(true);
    setInvestError(null);
    try {
      await api.loans.invest(investLoan.id, amount);
      closeInvest();
      setLoading(true);
      loadMarket();
    } catch (e: any) {
      setInvestError(e?.message ?? 'Investment failed');
    } finally {
      setInvestProcessing(false);
    }
  }

  const filtered = loans.filter(loan => {
    if (activeFilter === 'All') return true;
    return loanRiskColor(loan.interestRate).label === activeFilter;
  });

  const totalListed = loans.reduce((sum, l) => sum + l.principalAmount, 0);
  const avgRate = loans.length
    ? loans.reduce((sum, l) => sum + l.interestRate, 0) / loans.length
    : 0;

  return (
    <>
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.contentContainer, { paddingTop: topPad, paddingBottom: bottomPad }]}>
      <View style={styles.inner}>
        {/* Page Header */}
        <View style={styles.pageHeader}>
          <ThemedText type="subtitle">Loan Market</ThemedText>
          <ThemedText themeColor="textSecondary">Browse and fund verified loan requests</ThemedText>
        </View>

        {/* Market Summary */}
        <ThemedView type="backgroundElement" style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <ThemedText style={[styles.summaryValue, { color: BLUE }]}>{loans.length}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Open Loans</ThemedText>
          </View>
          <ThemedView type="backgroundSelected" style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <ThemedText style={[styles.summaryValue, { color: GREEN }]}>{formatMoney(totalListed)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Total Listed</ThemedText>
          </View>
          <ThemedView type="backgroundSelected" style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <ThemedText style={[styles.summaryValue, { color: AMBER }]}>
              {loans.length ? `${avgRate.toFixed(1)}%` : '—'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Avg Rate</ThemedText>
          </View>
        </ThemedView>

        {/* Filter Row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <View style={styles.filterRow}>
            {RISK_FILTERS.map(f => (
              <Pressable key={f} onPress={() => setActiveFilter(f)} style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView
                  type={activeFilter === f ? undefined : 'backgroundElement'}
                  style={[styles.filterChip, activeFilter === f && { backgroundColor: BLUE }]}>
                  <ThemedText type="small" style={activeFilter === f ? styles.filterActiveText : undefined}>
                    {f === 'All' ? 'All' : `${f} Risk`}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Loading */}
        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator color={BLUE} size="large" />
          </View>
        )}

        {/* Error */}
        {!loading && error && (
          <ThemedView type="backgroundElement" style={styles.errorBox}>
            <ThemedText style={{ color: RED }}>{error}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              This section is only available to Lender and Investor accounts.
            </ThemedText>
          </ThemedView>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 && (
          <ThemedView type="backgroundElement" style={styles.errorBox}>
            <ThemedText themeColor="textSecondary">No loans match this filter.</ThemedText>
          </ThemedView>
        )}

        {/* Loan Cards */}
        {!loading &&
          !error &&
          filtered.map(loan => {
            const { label: riskLabel, color: riskCol } = loanRiskColor(loan.interestRate);
            const fundedPct =
              loan.principalAmount > 0
                ? Math.min(100, Math.round((loan.fundedAmount / loan.principalAmount) * 100))
                : 0;
            const loanInitials = initials(loan.borrowerName);

            return (
              <ThemedView key={loan.id} type="backgroundElement" style={styles.loanCard}>
                {/* Card Header — tap to view borrower profile */}
                <Pressable
                  onPress={() => openProfile(loan)}
                  style={({ pressed }) => [styles.cardHeader, pressed && styles.pressed]}>
                  <View style={[styles.initialsCircle, { backgroundColor: BLUE }]}>
                    <ThemedText style={styles.initialsText}>{loanInitials}</ThemedText>
                  </View>
                  <View style={styles.cardHeaderText}>
                    <ThemedText type="smallBold">{loan.borrowerName}</ThemedText>
                    <ThemedText type="small" style={{ color: BLUE }}>View profile →</ThemedText>
                  </View>
                  <View style={[styles.badge, { backgroundColor: riskCol + '22' }]}>
                    <ThemedText style={[styles.badgeText, { color: riskCol }]}>{riskLabel} Risk</ThemedText>
                  </View>
                </Pressable>

                {/* Loan Stats */}
                <View style={styles.statsRow}>
                  <View style={styles.stat}>
                    <ThemedText type="smallBold">{formatMoney(loan.principalAmount)}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">Amount</ThemedText>
                  </View>
                  <View style={styles.stat}>
                    <ThemedText type="smallBold" style={{ color: GREEN }}>
                      {Number(loan.interestRate).toFixed(1)}%
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">Interest</ThemedText>
                  </View>
                  <View style={styles.stat}>
                    <ThemedText type="smallBold">{loan.termMonths} mo</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">Duration</ThemedText>
                  </View>
                  <View style={styles.stat}>
                    <ThemedText
                      type="smallBold"
                      style={{ color: loan.interestRate <= 12 ? GREEN : AMBER }}>
                      {loan.status}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">Status</ThemedText>
                  </View>
                </View>

                {/* Funding Progress */}
                <View style={styles.fundedRow}>
                  <ThemedText type="small" themeColor="textSecondary">{fundedPct}% funded</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{100 - fundedPct}% remaining</ThemedText>
                </View>
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, { width: `${fundedPct}%` as any, backgroundColor: BLUE }]} />
                </View>

                {/* Action — only lenders/investors can fund */}
                {canFund && (
                  <Pressable
                    onPress={() => openInvest(loan)}
                    style={({ pressed }) => [styles.fundBtn, pressed && styles.pressed]}>
                    <ThemedText style={styles.fundBtnText}>Fund This Loan</ThemedText>
                  </Pressable>
                )}
              </ThemedView>
            );
          })}
      </View>
    </ScrollView>

      {/* Borrower Profile Modal */}
      <Modal
        visible={profileLoan !== null}
        transparent={false}
        animationType="slide"
        onRequestClose={closeProfile}>
        <View style={[styles.profileScreen, { backgroundColor: theme.background }]}>
          {/* Header */}
          <View style={[styles.profileHeader, { borderBottomColor: theme.backgroundElement }]}>
            <Pressable onPress={closeProfile} style={styles.backBtn}>
              <ThemedText style={{ color: BLUE, fontWeight: '700', fontSize: 16 }}>← Back</ThemedText>
            </Pressable>
            <ThemedText type="smallBold">Borrower Profile</ThemedText>
            <View style={{ width: 60 }} />
          </View>

          {profileLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={BLUE} />
              <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Spacing.two }}>
                Loading profile…
              </ThemedText>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.profileContent}>

              {/* Avatar + name */}
              <View style={styles.profileHero}>
                <View style={[styles.profileAvatar, { backgroundColor: BLUE }]}>
                  <ThemedText style={styles.profileAvatarText}>
                    {profileLoan ? initials(profileLoan.borrowerName) : ''}
                  </ThemedText>
                </View>
                <ThemedText type="subtitle">{profileLoan?.borrowerName}</ThemedText>
                {profileUser && (
                  <View style={[styles.badge,
                    { backgroundColor: profileUser.kycStatus === 'APPROVED' ? GREEN + '22' : AMBER + '22', marginTop: 4 }]}>
                    <ThemedText style={[styles.badgeText,
                      { color: profileUser.kycStatus === 'APPROVED' ? GREEN : AMBER }]}>
                      {profileUser.kycStatus === 'APPROVED' ? '✓ KYC Verified' : '⏳ ' + profileUser.kycStatus}
                    </ThemedText>
                  </View>
                )}
              </View>

              {/* Credit Score Card */}
              {profileScore && (
                <View style={[styles.scoreCard, { backgroundColor: '#1E3A8A' }]}>
                  <View style={styles.scoreTop}>
                    <View>
                      <ThemedText style={styles.scoreLabel}>Credit Score</ThemedText>
                      <ThemedText style={styles.scoreNumber}>{profileScore.score}</ThemedText>
                    </View>
                    <View>
                      <View style={[styles.tierBadge, {
                        backgroundColor: profileScore.score >= 650 ? GREEN : profileScore.score >= 500 ? AMBER : RED,
                      }]}>
                        <ThemedText style={styles.tierText}>Tier {profileScore.riskTier}</ThemedText>
                      </View>
                      <ThemedText style={[styles.scoreLabel, { marginTop: 6 }]}>
                        Rate: {Number(profileScore.suggestedInterestRate).toFixed(1)}%
                      </ThemedText>
                    </View>
                  </View>

                  {/* Score Breakdown */}
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
                          <View style={styles.breakdownBarBg}>
                            <View style={[styles.breakdownBarFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
                          </View>
                          <ThemedText style={styles.breakdownPct}>{pct.toFixed(0)}</ThemedText>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Loan Stats */}
              {profileScore && (
                <ThemedView type="backgroundElement" style={styles.statsCard}>
                  <ThemedText type="smallBold" style={{ marginBottom: Spacing.two }}>Loan History Summary</ThemedText>
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <ThemedText style={[styles.statValue, { color: BLUE }]}>
                        {profileScore.totalLoansTaken}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">Total Loans</ThemedText>
                    </View>
                    <View style={styles.statItem}>
                      <ThemedText style={[styles.statValue, { color: GREEN }]}>
                        {profileScore.loansRepaidOnTime}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">Repaid On Time</ThemedText>
                    </View>
                    <View style={styles.statItem}>
                      <ThemedText style={[styles.statValue, { color: RED }]}>
                        {profileScore.loansDefaulted}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">Defaulted</ThemedText>
                    </View>
                  </View>
                </ThemedView>
              )}

              {/* Loan History */}
              {profileHistory.length > 0 && (
                <>
                  <ThemedText type="smallBold" style={styles.sectionTitle}>Loan History</ThemedText>
                  {profileHistory.map(loan => {
                    const pct = loan.principalAmount > 0
                      ? Math.min(100, Math.round((loan.amountRepaid / loan.principalAmount) * 100))
                      : 0;
                    const statusColor =
                      loan.status === 'COMPLETED' ? GREEN :
                      loan.status === 'DEFAULTED' || loan.status === 'REJECTED' ? RED :
                      loan.status === 'ACTIVE' ? BLUE : AMBER;
                    return (
                      <ThemedView key={loan.id} type="backgroundElement" style={styles.historyCard}>
                        <View style={styles.historyTop}>
                          <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
                            {loan.purpose}
                          </ThemedText>
                          <View style={[styles.badge, { backgroundColor: statusColor + '22' }]}>
                            <ThemedText style={[styles.badgeText, { color: statusColor }]}>{loan.status}</ThemedText>
                          </View>
                        </View>
                        <View style={styles.historyStats}>
                          <ThemedText type="smallBold">{formatMoney(loan.principalAmount)}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {Number(loan.interestRate).toFixed(1)}% · {loan.termMonths} mo
                          </ThemedText>
                        </View>
                        <View style={styles.progressBg}>
                          <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: statusColor }]} />
                        </View>
                        <ThemedText type="small" themeColor="textSecondary">
                          {pct}% repaid
                          {loan.createdAt ? ` · ${formatDate(loan.createdAt)}` : ''}
                        </ThemedText>
                      </ThemedView>
                    );
                  })}
                </>
              )}

              {profileHistory.length === 0 && !profileLoading && (
                <ThemedView type="backgroundElement" style={styles.emptyBox}>
                  <ThemedText themeColor="textSecondary">No loan history available.</ThemedText>
                </ThemedView>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Invest Modal */}
      <Modal
        visible={investLoan !== null}
        transparent
        animationType="slide"
        onRequestClose={closeInvest}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.background }]}>
            <ThemedText type="subtitle" style={styles.modalTitle}>Fund This Loan</ThemedText>

            {investLoan && (
              <View style={styles.loanSummary}>
                <ThemedText type="small" themeColor="textSecondary">
                  {investLoan.borrowerName} · {investLoan.purpose}
                </ThemedText>
                <ThemedText type="smallBold" style={{ color: GREEN }}>
                  {Number(investLoan.interestRate).toFixed(1)}% interest · {investLoan.termMonths} months
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Remaining: {formatMoney(investLoan.principalAmount - investLoan.fundedAmount)}
                </ThemedText>
              </View>
            )}

            <ThemedText type="small" themeColor="textSecondary" style={styles.inputLabel}>
              Investment Amount (min $50)
            </ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]}
              placeholder="0.00"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
              value={investAmount}
              onChangeText={text => {
                setInvestAmount(text.replace(/[^0-9.]/g, ''));
                setInvestError(null);
              }}
              editable={!investProcessing}
            />

            {investError && (
              <View style={styles.errorBox}>
                <ThemedText style={{ color: RED, fontSize: 13 }}>{investError}</ThemedText>
              </View>
            )}

            <Pressable
              onPress={handleInvest}
              disabled={investProcessing}
              style={({ pressed }) => [
                styles.modalPrimaryBtn,
                { backgroundColor: GREEN },
                (pressed || investProcessing) && styles.pressed,
              ]}>
              <ThemedText style={styles.modalBtnText}>
                {investProcessing ? 'Processing...' : 'Confirm Investment'}
              </ThemedText>
            </Pressable>

            <Pressable onPress={closeInvest} disabled={investProcessing} style={styles.cancelBtn}>
              <ThemedText style={{ color: theme.textSecondary, fontWeight: '600' }}>Cancel</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  contentContainer: { flexDirection: 'row', justifyContent: 'center' },
  inner: { flex: 1, maxWidth: MaxContentWidth, paddingHorizontal: Spacing.four, gap: Spacing.three },
  pageHeader: { gap: Spacing.one, paddingVertical: Spacing.two },
  summaryRow: {
    flexDirection: 'row',
    borderRadius: Spacing.four,
    padding: Spacing.three,
    alignItems: 'center',
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: Spacing.half },
  summaryValue: { fontSize: 20, fontWeight: '700' },
  summaryDivider: { width: 1, height: 36 },
  filterScroll: { flexGrow: 0 },
  filterRow: { flexDirection: 'row', gap: Spacing.two },
  filterChip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: Spacing.three },
  filterActiveText: { color: '#fff' },
  pressed: { opacity: 0.7 },
  centered: { alignItems: 'center', paddingVertical: Spacing.six },
  errorBox: { borderRadius: Spacing.three, padding: Spacing.four, gap: Spacing.two },
  loanCard: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.three },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  initialsCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  initialsText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cardHeaderText: { flex: 1 },
  badge: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.half, borderRadius: Spacing.two },
  badgeText: { fontSize: 12, fontWeight: '600' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', gap: Spacing.half },
  fundedRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressBg: { height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.1)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  fundBtn: {
    backgroundColor: BLUE,
    paddingVertical: Spacing.two + 2,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  fundBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  // Profile screen
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
  profileHero: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: { color: '#fff', fontWeight: '700', fontSize: 28 },
  scoreCard: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.three },
  scoreTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  scoreLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 13 },
  scoreNumber: { color: '#fff', fontSize: 52, fontWeight: '700', lineHeight: 60 },
  tierBadge: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: Spacing.three },
  tierText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  breakdown: { gap: Spacing.two },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  breakdownLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12, width: 120 },
  breakdownBarBg: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden' },
  breakdownBarFill: { height: '100%', borderRadius: 3 },
  breakdownPct: { color: 'rgba(255,255,255,0.65)', fontSize: 12, width: 24, textAlign: 'right' },
  statsCard: { borderRadius: Spacing.four, padding: Spacing.four },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center', gap: Spacing.one },
  statValue: { fontSize: 26, fontWeight: '700' },
  sectionTitle: { marginTop: Spacing.one },
  historyCard: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  historyTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  historyStats: { flexDirection: 'row', gap: Spacing.three, alignItems: 'baseline' },
  emptyBox: { borderRadius: Spacing.three, padding: Spacing.four, alignItems: 'center' },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.five,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  modalTitle: { textAlign: 'center', marginBottom: Spacing.one },
  loanSummary: {
    backgroundColor: GREEN + '11',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  inputLabel: { marginBottom: -Spacing.two },
  input: {
    borderWidth: 1.5,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: RED + '11',
    borderRadius: Spacing.two,
    padding: Spacing.two,
    alignItems: 'center',
  },
  modalPrimaryBtn: {
    paddingVertical: Spacing.three + 2,
    borderRadius: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  modalBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
});

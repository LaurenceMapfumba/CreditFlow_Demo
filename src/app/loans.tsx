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
  formatDate,
  formatMoney,
  initials,
  LoanInvestmentResponse,
  LoanResponse,
  LoanStatus,
} from '@/services/api';

const BLUE = '#2563EB';
const GREEN = '#16A34A';
const AMBER = '#D97706';
const RED = '#DC2626';

const ACTIVE_STATUSES: LoanStatus[] = ['ACTIVE', 'FUNDED'];
const COMPLETE_STATUSES: LoanStatus[] = ['COMPLETED'];

function statusColor(status: LoanStatus): string {
  if (COMPLETE_STATUSES.includes(status)) return GREEN;
  if (status === 'DEFAULTED' || status === 'REJECTED') return RED;
  if (ACTIVE_STATUSES.includes(status)) return BLUE;
  return AMBER;
}

export default function LoansScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user: authUser } = useAuth();
  const role = authUser?.role;
  const canBorrow = role === 'BORROWER';
  const canLend = role === 'LENDER' || role === 'INVESTOR';
  const [tab, setTab] = useState<'borrow' | 'lend'>(canLend ? 'lend' : 'borrow');
  const bottomPad = insets.bottom + BottomTabInset + Spacing.four;
  const topPad = Platform.OS === 'web' ? Spacing.six : insets.top + Spacing.three;

  const [borrowedLoans, setBorrowedLoans] = useState<LoanResponse[]>([]);
  const [investments, setInvestments] = useState<LoanInvestmentResponse[]>([]);
  const [loadingBorrow, setLoadingBorrow] = useState(true);
  const [loadingLend, setLoadingLend] = useState(true);
  const [errorBorrow, setErrorBorrow] = useState<string | null>(null);
  const [errorLend, setErrorLend] = useState<string | null>(null);

  // Repayment modal
  const [repayLoan, setRepayLoan] = useState<LoanResponse | null>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayProcessing, setRepayProcessing] = useState(false);
  const [repayError, setRepayError] = useState<string | null>(null);

  function loadBorrowed() {
    api.loans
      .myLoans()
      .then(setBorrowedLoans)
      .catch(e => setErrorBorrow(e?.message ?? 'Could not load your loans'))
      .finally(() => setLoadingBorrow(false));
  }

  useEffect(() => {
    loadBorrowed();

    if (canLend) {
      api.loans
        .myInvestments()
        .then(setInvestments)
        .catch(e => setErrorLend(e?.message ?? 'Could not load investments'))
        .finally(() => setLoadingLend(false));
    } else {
      setLoadingLend(false);
    }
  }, []);

  function openRepay(loan: LoanResponse) {
    setRepayLoan(loan);
    setRepayAmount(String(loan.monthlyRepayment));
    setRepayError(null);
  }

  function closeRepay() {
    if (repayProcessing) return;
    setRepayLoan(null);
    setRepayAmount('');
    setRepayError(null);
  }

  async function handleRepay() {
    if (!repayLoan) return;
    const amount = parseFloat(repayAmount);
    if (!repayAmount || isNaN(amount) || amount < 1) {
      setRepayError('Enter a valid amount (minimum $1.00)');
      return;
    }
    setRepayProcessing(true);
    setRepayError(null);
    try {
      await api.loans.repay(repayLoan.id, amount);
      closeRepay();
      setLoadingBorrow(true);
      loadBorrowed();
    } catch (e: any) {
      setRepayError(e?.message ?? 'Repayment failed');
    } finally {
      setRepayProcessing(false);
    }
  }

  const totalBorrowed = borrowedLoans
    .filter(l => ACTIVE_STATUSES.includes(l.status))
    .reduce((s, l) => s + l.principalAmount, 0);

  const totalInvested = investments.reduce((s, i) => s + i.investedAmount, 0);
  const totalExpectedReturn = investments.reduce((s, i) => s + i.expectedReturn, 0);
  const totalActualReturn = investments.reduce((s, i) => s + i.actualReturn, 0);

  return (
    <>
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.contentContainer, { paddingTop: topPad, paddingBottom: bottomPad }]}>
      <View style={styles.inner}>
        <ThemedText type="subtitle" style={styles.pageTitle}>My Loans</ThemedText>

        {/* Portfolio Summary */}
        <ThemedView type="backgroundElement" style={styles.summaryCard}>
          {canBorrow && (
            <>
              <View style={styles.summaryItem}>
                <ThemedText style={[styles.summaryValue, { color: BLUE }]}>
                  {formatMoney(totalBorrowed)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">Borrowed</ThemedText>
              </View>
              <ThemedView type="backgroundSelected" style={styles.summaryDivider} />
            </>
          )}
          {canLend && (
            <>
              <View style={styles.summaryItem}>
                <ThemedText style={[styles.summaryValue, { color: GREEN }]}>
                  {formatMoney(totalInvested)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">Invested</ThemedText>
              </View>
              <ThemedView type="backgroundSelected" style={styles.summaryDivider} />
            </>
          )}
          <View style={styles.summaryItem}>
            <ThemedText style={[styles.summaryValue, { color: GREEN }]}>
              {canBorrow ? borrowedLoans.length : investments.length}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Total</ThemedText>
          </View>
        </ThemedView>

        {/* Tab Toggle — only show if user has access to both sides */}
        {canBorrow && canLend && (
          <ThemedView type="backgroundElement" style={styles.toggle}>
            <Pressable
              style={[styles.toggleBtn, tab === 'borrow' && { backgroundColor: BLUE }]}
              onPress={() => setTab('borrow')}>
              <ThemedText type="small" style={tab === 'borrow' ? styles.activeTabText : undefined}>
                Borrowing
              </ThemedText>
            </Pressable>
            <Pressable
              style={[styles.toggleBtn, tab === 'lend' && { backgroundColor: BLUE }]}
              onPress={() => setTab('lend')}>
              <ThemedText type="small" style={tab === 'lend' ? styles.activeTabText : undefined}>
                Lending
              </ThemedText>
            </Pressable>
          </ThemedView>
        )}

        {/* Borrowing Tab */}
        {canBorrow && tab === 'borrow' && (
          <>
            {loadingBorrow && (
              <View style={styles.centered}>
                <ActivityIndicator color={BLUE} size="large" />
              </View>
            )}
            {!loadingBorrow && errorBorrow && (
              <ThemedView type="backgroundElement" style={styles.infoBox}>
                <ThemedText style={{ color: RED }}>{errorBorrow}</ThemedText>
              </ThemedView>
            )}
            {!loadingBorrow && !errorBorrow && borrowedLoans.length === 0 && (
              <ThemedView type="backgroundElement" style={styles.infoBox}>
                <ThemedText themeColor="textSecondary">You have no loans yet.</ThemedText>
              </ThemedView>
            )}
            {!loadingBorrow &&
              !errorBorrow &&
              borrowedLoans.map(loan => {
                const pct =
                  loan.principalAmount > 0
                    ? Math.min(100, Math.round((loan.amountRepaid / loan.principalAmount) * 100))
                    : 0;
                const isComplete = loan.status === 'COMPLETED';
                const col = statusColor(loan.status);
                return (
                  <ThemedView key={loan.id} type="backgroundElement" style={styles.card}>
                    <View style={styles.cardTop}>
                      <View>
                        <ThemedText type="smallBold">{loan.purpose}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {loan.termMonths} month loan
                        </ThemedText>
                      </View>
                      <View style={[styles.badge, { backgroundColor: col + '22' }]}>
                        <ThemedText style={[styles.badgeText, { color: col }]}>{loan.status}</ThemedText>
                      </View>
                    </View>

                    <View style={styles.cardStats}>
                      <View style={styles.stat}>
                        <ThemedText style={styles.loanAmount}>{formatMoney(loan.principalAmount)}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">Total</ThemedText>
                      </View>
                      <View style={styles.stat}>
                        <ThemedText style={[styles.loanAmount, { color: GREEN }]}>
                          {Number(loan.interestRate).toFixed(1)}%
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">Interest</ThemedText>
                      </View>
                    </View>

                    <View style={styles.progressBg}>
                      <View
                        style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: col }]}
                      />
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      {pct}% repaid · {formatMoney(loan.amountRepaid)} of {formatMoney(loan.principalAmount)}
                    </ThemedText>

                    {!isComplete && loan.dueDate && (
                      <ThemedView type="backgroundSelected" style={styles.dueBox}>
                        <View>
                          <ThemedText type="small" themeColor="textSecondary">Next Payment</ThemedText>
                          <ThemedText type="smallBold">{formatMoney(loan.monthlyRepayment)}</ThemedText>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <ThemedText type="small" themeColor="textSecondary">Due Date</ThemedText>
                          <ThemedText type="smallBold">{formatDate(loan.dueDate)}</ThemedText>
                        </View>
                      </ThemedView>
                    )}

                    {!isComplete && (
                      <Pressable
                        onPress={() => openRepay(loan)}
                        style={({ pressed }) => [styles.repayBtn, pressed && styles.pressed]}>
                        <ThemedText style={styles.repayBtnText}>Make a Repayment</ThemedText>
                      </Pressable>
                    )}
                  </ThemedView>
                );
              })}
          </>
        )}

        {/* Lending Tab — shows the lender's own investment portfolio */}
        {canLend && tab === 'lend' && (
          <>
            {/* Returns summary row */}
            {!loadingLend && investments.length > 0 && (
              <ThemedView type="backgroundElement" style={styles.returnsCard}>
                <View style={styles.returnItem}>
                  <ThemedText style={[styles.returnValue, { color: BLUE }]}>
                    {formatMoney(totalInvested)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">Total Invested</ThemedText>
                </View>
                <ThemedView type="backgroundSelected" style={styles.returnDivider} />
                <View style={styles.returnItem}>
                  <ThemedText style={[styles.returnValue, { color: AMBER }]}>
                    {formatMoney(totalExpectedReturn)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">Expected Back</ThemedText>
                </View>
                <ThemedView type="backgroundSelected" style={styles.returnDivider} />
                <View style={styles.returnItem}>
                  <ThemedText style={[styles.returnValue, { color: GREEN }]}>
                    {formatMoney(totalActualReturn)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">Received</ThemedText>
                </View>
              </ThemedView>
            )}

            {loadingLend && (
              <View style={styles.centered}>
                <ActivityIndicator color={BLUE} size="large" />
              </View>
            )}
            {!loadingLend && errorLend && (
              <ThemedView type="backgroundElement" style={styles.infoBox}>
                <ThemedText style={{ color: RED }}>{errorLend}</ThemedText>
              </ThemedView>
            )}
            {!loadingLend && !errorLend && investments.length === 0 && (
              <ThemedView type="backgroundElement" style={styles.infoBox}>
                <ThemedText themeColor="textSecondary">
                  You haven't funded any loans yet. Browse the Loan Market to start investing.
                </ThemedText>
              </ThemedView>
            )}
            {!loadingLend && !errorLend && investments.map(inv => {
              const col = statusColor(inv.loanStatus);
              const repayPct = inv.principalAmount > 0
                ? Math.min(100, Math.round((inv.amountRepaid / inv.principalAmount) * 100))
                : 0;
              const profit = inv.expectedReturn - inv.investedAmount;
              const isComplete = inv.loanStatus === 'COMPLETED';
              return (
                <ThemedView key={inv.id} type="backgroundElement" style={styles.card}>
                  {/* Header */}
                  <View style={styles.cardTop}>
                    <View style={[styles.initialsCircle, { backgroundColor: BLUE }]}>
                      <ThemedText style={styles.initialsText}>{initials(inv.borrowerName)}</ThemedText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="smallBold">{inv.borrowerName}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">{inv.purpose}</ThemedText>
                    </View>
                    <View style={[styles.badge, { backgroundColor: col + '22' }]}>
                      <ThemedText style={[styles.badgeText, { color: col }]}>{inv.loanStatus}</ThemedText>
                    </View>
                  </View>

                  {/* Key figures */}
                  <View style={styles.lentRow}>
                    <View style={styles.lentStat}>
                      <ThemedText type="smallBold" style={{ color: BLUE }}>
                        {formatMoney(inv.investedAmount)}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">You Funded</ThemedText>
                    </View>
                    <View style={styles.lentStat}>
                      <ThemedText type="smallBold" style={{ color: AMBER }}>
                        {formatMoney(inv.expectedReturn)}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">Expected Back</ThemedText>
                    </View>
                    <View style={styles.lentStat}>
                      <ThemedText type="smallBold" style={{ color: GREEN }}>
                        +{formatMoney(profit)}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">Profit</ThemedText>
                    </View>
                    <View style={styles.lentStat}>
                      <ThemedText type="smallBold" style={{ color: GREEN }}>
                        {Number(inv.interestRate).toFixed(1)}%
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">Rate</ThemedText>
                    </View>
                  </View>

                  {/* Repayment progress */}
                  <View style={styles.progressBg}>
                    <View style={[styles.progressFill, { width: `${repayPct}%` as any, backgroundColor: col }]} />
                  </View>
                  <View style={styles.cardTop}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {repayPct}% repaid by borrower
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {inv.dueDate ? `Due ${formatDate(inv.dueDate)}` : `${inv.termMonths} mo term`}
                    </ThemedText>
                  </View>

                  {/* Actual returns received */}
                  {inv.actualReturn > 0 && (
                    <ThemedView type="backgroundSelected" style={styles.receivedBox}>
                      <ThemedText type="small" themeColor="textSecondary">Received so far</ThemedText>
                      <ThemedText type="smallBold" style={{ color: GREEN }}>
                        {formatMoney(inv.actualReturn)}
                      </ThemedText>
                    </ThemedView>
                  )}
                </ThemedView>
              );
            })}
          </>
        )}
      </View>
    </ScrollView>

      {/* Repayment Modal */}
      <Modal
        visible={repayLoan !== null}
        transparent
        animationType="slide"
        onRequestClose={closeRepay}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.background }]}>
            <ThemedText type="subtitle" style={styles.modalTitle}>Make a Repayment</ThemedText>

            {repayLoan && (
              <View style={styles.loanSummary}>
                <ThemedText type="small" themeColor="textSecondary">{repayLoan.purpose}</ThemedText>
                <ThemedText type="smallBold">
                  {formatMoney(repayLoan.amountRepaid)} / {formatMoney(repayLoan.principalAmount)} repaid
                </ThemedText>
              </View>
            )}

            <ThemedText type="small" themeColor="textSecondary" style={styles.inputLabel}>
              Payment Amount (USD)
            </ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]}
              placeholder="0.00"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
              value={repayAmount}
              onChangeText={text => {
                setRepayAmount(text.replace(/[^0-9.]/g, ''));
                setRepayError(null);
              }}
              editable={!repayProcessing}
            />

            {repayLoan && (
              <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                Suggested monthly: {formatMoney(repayLoan.monthlyRepayment)}
              </ThemedText>
            )}

            {repayError && (
              <View style={styles.errorBox}>
                <ThemedText style={{ color: RED, fontSize: 13 }}>{repayError}</ThemedText>
              </View>
            )}

            <Pressable
              onPress={handleRepay}
              disabled={repayProcessing}
              style={({ pressed }) => [
                styles.modalPrimaryBtn,
                { backgroundColor: BLUE },
                (pressed || repayProcessing) && styles.pressed,
              ]}>
              <ThemedText style={styles.modalBtnText}>
                {repayProcessing ? 'Processing...' : 'Confirm Repayment'}
              </ThemedText>
            </Pressable>

            <Pressable onPress={closeRepay} disabled={repayProcessing} style={styles.cancelBtn}>
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
  pageTitle: { paddingTop: Spacing.two },
  summaryCard: {
    flexDirection: 'row',
    borderRadius: Spacing.four,
    padding: Spacing.three,
    alignItems: 'center',
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: Spacing.half },
  summaryValue: { fontSize: 20, fontWeight: '700' },
  summaryDivider: { width: 1, height: 36 },
  toggle: { flexDirection: 'row', borderRadius: Spacing.three, padding: Spacing.one },
  toggleBtn: { flex: 1, paddingVertical: Spacing.two, borderRadius: Spacing.two, alignItems: 'center' },
  activeTabText: { color: '#fff' },
  centered: { alignItems: 'center', paddingVertical: Spacing.six },
  infoBox: { borderRadius: Spacing.three, padding: Spacing.four, gap: Spacing.two },
  pressed: { opacity: 0.7 },
  card: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.three },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  badge: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.half, borderRadius: Spacing.two },
  badgeText: { fontSize: 12, fontWeight: '600' },
  cardStats: { flexDirection: 'row', gap: Spacing.four },
  stat: { gap: Spacing.half },
  loanAmount: { fontSize: 22, fontWeight: '700' },
  progressBg: { height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.1)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  dueBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  repayBtn: {
    backgroundColor: BLUE,
    paddingVertical: Spacing.two + 2,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  repayBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  initialsCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  initialsText: { color: '#fff', fontWeight: '700' },
  lentRow: { flexDirection: 'row', justifyContent: 'space-between' },
  lentStat: { alignItems: 'center', gap: Spacing.half },
  returnsCard: {
    flexDirection: 'row',
    borderRadius: Spacing.four,
    padding: Spacing.three,
    alignItems: 'center',
  },
  returnItem: { flex: 1, alignItems: 'center', gap: Spacing.half },
  returnValue: { fontSize: 18, fontWeight: '700' },
  returnDivider: { width: 1, height: 36 },
  receivedBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.two,
    borderRadius: Spacing.two,
  },
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
    backgroundColor: BLUE + '11',
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

// On Expo Web / local browser: http://localhost:8080/api/v1
// On Android emulator:        http://10.0.2.2:8080/api/v1
// On a physical device (Expo Go or APK): use your PC's LAN IP
const BASE_URL = 'http://192.168.100.12:8080/api/v1';

let authToken: string | null = null;

export function setToken(token: string | null) {
  authToken = token;
}

export function getToken(): string | null {
  return authToken;
}

// ─── Response types ───────────────────────────────────────────────────────────

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  userId: number;
  email: string;
  fullName: string;
  role: 'BORROWER' | 'LENDER' | 'INVESTOR' | 'ADMIN';
}

export interface UserResponse {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  role: string;
  kycStatus: 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  walletBalance: number;
  active: boolean;
  deleted: boolean;
  createdAt: string;
}

export interface CreditScoreResponse {
  userId: number;
  score: number;
  riskTier: string;
  suggestedInterestRate: number;
  mobileMoneyScore: number;
  repaymentHistoryScore: number;
  bankBehaviourScore: number;
  kycScore: number;
  totalLoansTaken: number;
  loansRepaidOnTime: number;
  loansDefaulted: number;
  lastCalculatedAt: string;
}

export type LoanStatus = 'PENDING' | 'APPROVED' | 'FUNDED' | 'ACTIVE' | 'COMPLETED' | 'DEFAULTED' | 'REJECTED';

export interface LoanInvestmentResponse {
  id: number;
  loanId: number;
  borrowerName: string;
  purpose: string;
  loanStatus: LoanStatus;
  principalAmount: number;
  investedAmount: number;
  expectedReturn: number;
  actualReturn: number;
  interestRate: number;
  termMonths: number;
  amountRepaid: number;
  dueDate: string | null;
  investedAt: string;
}

export interface LoanResponse {
  id: number;
  borrowerId: number;
  borrowerName: string;
  principalAmount: number;
  interestRate: number;
  termMonths: number;
  monthlyRepayment: number;
  totalRepayment: number;
  amountRepaid: number;
  fundedAmount: number;
  remainingBalance: number;
  status: LoanStatus;
  purpose: string;
  startDate: string | null;
  dueDate: string | null;
  createdAt: string;
}

export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'LOAN_DISBURSEMENT' | 'REPAYMENT' | 'INTEREST';

export interface TransactionResponse {
  id: number;
  reference: string;
  amount: number;
  type: TransactionType;
  status: string;
  paymentMethod: string;
  description: string;
  createdAt: string;
}

export interface KycDocument {
  id: number;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    role: string;
    kycStatus: string;
  };
  status: string;
  nationalIdPath: string | null;
  policeClearancePath: string | null;
  selfiePath: string | null;
  submittedAt: string;
  rejectionReason: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatMoney(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
}

export function isCreditTx(type: TransactionType): boolean {
  // Money coming IN to the wallet
  return type === 'DEPOSIT' || type === 'INTEREST' || type === 'LOAN_DISBURSEMENT';
  // WITHDRAWAL and REPAYMENT are money going OUT → shown red with –
}

export function loanRiskColor(rate: number): { label: string; color: string } {
  if (rate < 12) return { label: 'Low', color: '#16A34A' };
  if (rate <= 16) return { label: 'Medium', color: '#D97706' };
  return { label: 'High', color: '#DC2626' };
}

export function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase();
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string> | undefined) },
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.message || `HTTP ${res.status}`);
  }

  return json.data as T;
}

// ─── API surface ──────────────────────────────────────────────────────────────

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    register: (data: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
      phoneNumber: string;
      role: string;
    }) =>
      request<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  users: {
    me: () => request<UserResponse>('/users/me'),
    byId: (id: number) => request<UserResponse>(`/users/${id}`),
  },

  creditScore: {
    myScore: () => request<CreditScoreResponse>('/credit-score/my-score'),
    forUser: (userId: number) => request<CreditScoreResponse>(`/credit-score/${userId}`),
  },

  loans: {
    myLoans: async (): Promise<LoanResponse[]> => {
      const result = await request<any>('/loans/my-loans');
      return Array.isArray(result) ? result : (result?.content ?? []);
    },
    marketplace: async (): Promise<LoanResponse[]> => {
      const result = await request<any>('/loans/marketplace');
      return Array.isArray(result) ? result : (result?.content ?? []);
    },
    repay: (loanId: number, amount: number) =>
      request<void>('/loans/repay', {
        method: 'POST',
        body: JSON.stringify({ loanId, amount, paymentMethod: 'WALLET' }),
      }),
    invest: (loanId: number, amount: number) =>
      request<LoanResponse>('/loans/invest', {
        method: 'POST',
        body: JSON.stringify({ loanId, amount }),
      }),
    borrowerHistory: async (userId: number): Promise<LoanResponse[]> => {
      const result = await request<any>(`/loans/borrower/${userId}`);
      return Array.isArray(result) ? result : (result?.content ?? []);
    },
    myInvestments: async (): Promise<LoanInvestmentResponse[]> => {
      const result = await request<any>('/loans/my-investments');
      return Array.isArray(result) ? result : (result?.content ?? []);
    },
  },

  transactions: {
    list: async (page = 0, size = 10): Promise<TransactionResponse[]> => {
      const result = await request<any>(`/transactions?page=${page}&size=${size}`);
      return Array.isArray(result) ? result : (result?.content ?? []);
    },
    deposit: (amount: number) =>
      request<TransactionResponse>(`/transactions/deposit?amount=${amount}`, { method: 'POST' }),
    withdraw: (amount: number) =>
      request<TransactionResponse>(`/transactions/withdraw?amount=${amount}`, { method: 'POST' }),
  },

  admin: {
    creditScore: (userId: number) =>
      request<CreditScoreResponse>(`/credit-score/${userId}`),
    updateCreditScore: (userId: number, data: {
      score?: number;
      riskTier?: string;
      suggestedInterestRate?: number;
      mobileMoneyScore?: number;
      repaymentHistoryScore?: number;
      bankBehaviourScore?: number;
      kycScore?: number;
    }) =>
      request<CreditScoreResponse>(`/admin/credit-score/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    users: async (page = 0, size = 50): Promise<UserResponse[]> => {
      const result = await request<any>(`/admin/users?page=${page}&size=${size}`);
      return Array.isArray(result) ? result : (result?.content ?? []);
    },
    activateUser: (id: number) =>
      request<void>(`/admin/users/${id}/activate`, { method: 'PATCH' }),
    deactivateUser: (id: number) =>
      request<void>(`/admin/users/${id}/deactivate`, { method: 'PATCH' }),
    deleteUser: (id: number) =>
      request<void>(`/admin/users/${id}`, { method: 'DELETE' }),
    restoreUser: (id: number) =>
      request<void>(`/admin/users/${id}/restore`, { method: 'PATCH' }),
    pendingLoans: async (page = 0, size = 50): Promise<LoanResponse[]> => {
      const result = await request<any>(`/admin/loans/pending?page=${page}&size=${size}`);
      return Array.isArray(result) ? result : (result?.content ?? []);
    },
    reviewLoan: (id: number, status: LoanStatus, adminNotes?: string) =>
      request<LoanResponse>(`/admin/loans/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ status, adminNotes }),
      }),
    pendingKyc: async (): Promise<KycDocument[]> => {
      const result = await request<any>('/admin/kyc/pending');
      return Array.isArray(result) ? result : (result?.content ?? []);
    },
    approveKyc: (id: number) =>
      request<void>(`/admin/kyc/${id}/approve`, { method: 'PATCH' }),
    rejectKyc: (id: number, reason: string) =>
      request<void>(`/admin/kyc/${id}/reject?reason=${encodeURIComponent(reason)}`, { method: 'PATCH' }),
  },
};

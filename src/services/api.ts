import type {
  Job,
  JobApplication,
  ApplicationStatus,
  StudentProfile,
  UserAccount,
  ChatConversation,
  ChatMessage,
  AppNotification,
  SavedCVRecord,
  AICVData,
  CVLanguage,
  CVTemplateId,
} from '../types';

const TOKEN_KEY = 'jobshub_auth_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function setStoredToken(token: string, rememberMe: boolean) {
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    if (rememberMe) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
    }
  } catch {
    // ignore storage errors
  }
}

export function clearStoredToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Lỗi máy chủ (${res.status})`);
  }
  return data as T;
}

// Auth
export async function apiRegister(payload: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  role: 'candidate' | 'employer';
  companyName?: string;
}): Promise<{ user: UserAccount; token: string }> {
  const res = await apiFetch<{ user: UserAccount; token: string }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  setStoredToken(res.token, true);
  return res;
}

export async function apiLogin(payload: {
  email: string;
  password: string;
  rememberMe: boolean;
}): Promise<{ user: UserAccount; token: string }> {
  const res = await apiFetch<{ user: UserAccount; token: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  setStoredToken(res.token, payload.rememberMe);
  return res;
}

export async function apiGetMe(): Promise<{ user: UserAccount | null }> {
  return apiFetch<{ user: UserAccount | null }>('/api/auth/me');
}

export async function apiLogout(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } finally {
    clearStoredToken();
  }
}

export async function apiForgotPassword(email: string): Promise<{
  ok: boolean;
  email: string;
  message: string;
  resetCode?: string;
}> {
  return apiFetch('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function apiResetPassword(payload: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<{ ok: boolean; message: string }> {
  return apiFetch('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type OAuthProvider = 'google' | 'facebook' | 'apple';

export interface OAuthProvidersStatus {
  providers: Record<OAuthProvider, boolean>;
  callbackUrls: Record<OAuthProvider, string>;
}

export async function apiGetOAuthProviders(): Promise<OAuthProvidersStatus> {
  return apiFetch('/api/auth/oauth/providers');
}

export async function apiGetOAuthUrl(
  provider: OAuthProvider,
  role: 'candidate' | 'employer' = 'candidate'
): Promise<{ url: string }> {
  return apiFetch(
    `/api/auth/oauth/${encodeURIComponent(provider)}/url?role=${encodeURIComponent(role)}`
  );
}

// Profile
export async function apiGetProfile(): Promise<{ profile: StudentProfile }> {
  return apiFetch('/api/profile');
}

export async function apiSaveProfile(
  profile: StudentProfile
): Promise<{ profile: StudentProfile; user: UserAccount }> {
  return apiFetch('/api/profile', {
    method: 'PUT',
    body: JSON.stringify({ profile }),
  });
}

// Jobs
export async function apiListJobs(): Promise<{ jobs: Job[] }> {
  return apiFetch('/api/jobs');
}

export async function apiCreateJob(job: Omit<Job, 'id' | 'employerId'>): Promise<{ job: Job }> {
  return apiFetch('/api/jobs', {
    method: 'POST',
    body: JSON.stringify(job),
  });
}

export async function apiUpdateJobStatus(
  jobId: string,
  status: 'published' | 'pending' | 'closed'
): Promise<{ job: Job }> {
  return apiFetch(`/api/jobs/${encodeURIComponent(jobId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function apiDeleteJob(jobId: string): Promise<{ ok: boolean }> {
  return apiFetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
    method: 'DELETE',
  });
}

// Saved Jobs
export async function apiGetSavedJobs(): Promise<{ savedJobIds: string[] }> {
  return apiFetch('/api/saved-jobs');
}

export async function apiToggleSavedJob(
  jobId: string
): Promise<{ saved: boolean; savedJobIds: string[] }> {
  return apiFetch('/api/saved-jobs/toggle', {
    method: 'POST',
    body: JSON.stringify({ jobId }),
  });
}

export async function apiRemoveSavedJob(jobId: string): Promise<{ savedJobIds: string[] }> {
  return apiFetch(`/api/saved-jobs/${encodeURIComponent(jobId)}`, {
    method: 'DELETE',
  });
}

// Applications
export async function apiListApplications(): Promise<{ applications: JobApplication[] }> {
  return apiFetch('/api/applications');
}

export async function apiSubmitApplication(payload: {
  jobId: string;
  fullName: string;
  email: string;
  phone: string;
  university: string;
  major: string;
  availableShifts: string;
  note: string;
  cvId?: string;
}): Promise<{ application: JobApplication }> {
  return apiFetch('/api/applications', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiUpdateApplicationStatus(
  applicationId: string,
  status: ApplicationStatus
): Promise<{ application: JobApplication }> {
  return apiFetch(`/api/applications/${encodeURIComponent(applicationId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// Conversations & Messaging
export async function apiListConversations(): Promise<{ conversations: ChatConversation[] }> {
  return apiFetch('/api/conversations');
}

export async function apiOpenConversation(payload: {
  jobId?: string;
  targetUserId?: string;
  targetName?: string;
  targetAvatar?: string;
  jobTitle?: string;
  companyName?: string;
}): Promise<{ conversation: ChatConversation }> {
  return apiFetch('/api/conversations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiSendMessage(
  conversationId: string,
  text: string
): Promise<{ message: ChatMessage; conversation: ChatConversation }> {
  return apiFetch(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function apiMarkConversationRead(conversationId: string): Promise<{ ok: boolean }> {
  return apiFetch(`/api/conversations/${encodeURIComponent(conversationId)}/read`, {
    method: 'POST',
  });
}

// Notifications
export async function apiListNotifications(): Promise<{ notifications: AppNotification[] }> {
  return apiFetch('/api/notifications');
}

export async function apiMarkNotificationsRead(): Promise<{ ok: boolean }> {
  return apiFetch('/api/notifications/read-all', {
    method: 'POST',
  });
}

// AI CVs
export async function apiListSavedCVs(): Promise<{ cvs: SavedCVRecord[] }> {
  return apiFetch('/api/cvs');
}

export async function apiSaveCV(payload: {
  id?: string;
  name: string;
  targetJob: string;
  language: CVLanguage;
  template: CVTemplateId;
  accentColor: string;
  layout: 'single' | 'two-column';
  data: AICVData;
}): Promise<{ cv: SavedCVRecord }> {
  return apiFetch('/api/cvs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiDeleteCV(cvId: string): Promise<{ ok: boolean }> {
  return apiFetch(`/api/cvs/${encodeURIComponent(cvId)}`, {
    method: 'DELETE',
  });
}

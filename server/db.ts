import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { INITIAL_JOBS, EMPTY_STUDENT_PROFILE } from '../src/data/mockJobs.ts';
import type {
  Job,
  StudentProfile,
  UserAccount,
  JobApplication,
  ApplicationStatus,
  ChatConversation,
  ChatMessage,
  AppNotification,
  SavedCVRecord,
  CVLanguage,
  CVTemplateId,
  AICVData,
} from '../src/types.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'jobshub.sqlite');

export const db = new DatabaseSync(DB_PATH);

// Enable WAL and foreign keys
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    fullName TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    passwordHash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('candidate', 'employer')),
    avatarUrl TEXT NOT NULL DEFAULT '',
    companyName TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    rememberMe INTEGER NOT NULL DEFAULT 1,
    expiresAt INTEGER NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS profiles (
    userId TEXT PRIMARY KEY,
    dataJson TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    employerId TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'published',
    dataJson TEXT NOT NULL,
    createdAtMs INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS saved_jobs (
    userId TEXT NOT NULL,
    jobId TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    PRIMARY KEY (userId, jobId),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    jobId TEXT NOT NULL,
    jobTitle TEXT NOT NULL,
    companyName TEXT NOT NULL,
    employerId TEXT NOT NULL,
    applicantId TEXT NOT NULL,
    applicantName TEXT NOT NULL,
    applicantEmail TEXT NOT NULL,
    applicantPhone TEXT NOT NULL,
    university TEXT NOT NULL DEFAULT '',
    major TEXT NOT NULL DEFAULT '',
    availableShifts TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    cvId TEXT,
    cvSnapshotJson TEXT,
    appliedAt TEXT NOT NULL,
    createdAtMs INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'Chờ xét duyệt',
    UNIQUE(jobId, applicantId)
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    jobId TEXT NOT NULL DEFAULT '',
    jobTitle TEXT NOT NULL DEFAULT '',
    companyName TEXT NOT NULL DEFAULT '',
    candidateId TEXT NOT NULL,
    candidateName TEXT NOT NULL,
    candidateAvatar TEXT NOT NULL DEFAULT '',
    employerId TEXT NOT NULL,
    employerName TEXT NOT NULL,
    employerAvatar TEXT NOT NULL DEFAULT '',
    lastMessage TEXT NOT NULL DEFAULT '',
    lastSenderId TEXT NOT NULL DEFAULT '',
    lastTimestamp TEXT NOT NULL,
    updatedAtMs INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversationId TEXT NOT NULL,
    senderId TEXT NOT NULL,
    receiverId TEXT NOT NULL,
    senderName TEXT NOT NULL,
    senderRole TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    createdAtMs INTEGER NOT NULL,
    read INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    linkTab TEXT NOT NULL,
    refId TEXT NOT NULL DEFAULT '',
    isRead INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    createdAtMs INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ai_cvs (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    name TEXT NOT NULL,
    targetJob TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'vi',
    template TEXT NOT NULL DEFAULT 'modern',
    accentColor TEXT NOT NULL DEFAULT '#2F5233',
    layout TEXT NOT NULL DEFAULT 'single',
    cvJson TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    updatedAtMs INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS oauth_accounts (
    provider TEXT NOT NULL,
    providerUserId TEXT NOT NULL,
    userId TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL,
    PRIMARY KEY (provider, providerUserId),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS oauth_states (
    state TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('candidate', 'employer')),
    expiresAt INTEGER NOT NULL
  );
`);

// Seed initial public job listings once if jobs table is empty
const jobCountRow = db.prepare('SELECT COUNT(*) as cnt FROM jobs').get() as { cnt: number };
if (jobCountRow.cnt === 0) {
  const insertJob = db.prepare(
    'INSERT INTO jobs (id, employerId, status, dataJson, createdAtMs) VALUES (?, ?, ?, ?, ?)'
  );
  const now = Date.now();
  INITIAL_JOBS.forEach((job, idx) => {
    const seededJob: Job = {
      ...job,
      employerId: job.employerId || `seed-emp-${job.id}`,
      status: job.status || 'published',
    };
    insertJob.run(
      seededJob.id,
      seededJob.employerId || `seed-emp-${seededJob.id}`,
      seededJob.status || 'published',
      JSON.stringify(seededJob),
      now - idx * 60000
    );
  });
}

// Password hashing helpers
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function rowToUser(row: Record<string, unknown>): UserAccount {
  return {
    id: String(row.id),
    fullName: String(row.fullName),
    email: String(row.email),
    phone: String(row.phone || ''),
    role: row.role === 'employer' ? 'employer' : 'candidate',
    avatarUrl: String(row.avatarUrl || ''),
    companyName: row.companyName ? String(row.companyName) : undefined,
  };
}

export function registerUser(params: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: 'candidate' | 'employer';
  companyName?: string;
}): { user: UserAccount; token: string } {
  const normalizedEmail = params.email.trim().toLowerCase();
  if (!isValidEmail(normalizedEmail)) {
    throw new Error('INVALID_EMAIL');
  }
  if (params.password.length < 6) {
    throw new Error('WEAK_PASSWORD');
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) {
    throw new Error('EMAIL_EXISTS');
  }

  const id = 'usr-' + crypto.randomUUID();
  const nowIso = new Date().toISOString();
  const passwordHash = hashPassword(params.password);

  db.prepare(
    `INSERT INTO users (id, fullName, email, phone, passwordHash, role, avatarUrl, companyName, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    params.fullName.trim(),
    normalizedEmail,
    params.phone.trim(),
    passwordHash,
    params.role,
    '',
    params.role === 'employer' ? (params.companyName || '').trim() : '',
    nowIso
  );

  // Initialize profile
  const initialProfile: StudentProfile = {
    ...EMPTY_STUDENT_PROFILE,
    fullName: params.fullName.trim(),
    email: normalizedEmail,
    phone: params.phone.trim(),
  };
  db.prepare('INSERT INTO profiles (userId, dataJson, updatedAt) VALUES (?, ?, ?)').run(
    id,
    JSON.stringify(initialProfile),
    nowIso
  );

  const token = createSession(id, true);
  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown>;
  return { user: rowToUser(userRow), token };
}

export function loginUser(params: {
  email: string;
  password: string;
  rememberMe: boolean;
}): { user: UserAccount; token: string } {
  const normalizedEmail = params.email.trim().toLowerCase();
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail) as
    | Record<string, unknown>
    | undefined;
  if (!row) {
    throw new Error('INVALID_CREDENTIALS');
  }
  if (!verifyPassword(params.password, String(row.passwordHash))) {
    throw new Error('INVALID_CREDENTIALS');
  }
  const user = rowToUser(row);
  const token = createSession(user.id, params.rememberMe);
  return { user, token };
}

export function createSession(userId: string, rememberMe: boolean): string {
  const token = crypto.randomBytes(32).toString('hex');
  const ttlMs = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
  const expiresAt = Date.now() + ttlMs;
  db.prepare(
    'INSERT INTO sessions (token, userId, rememberMe, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?)'
  ).run(token, userId, rememberMe ? 1 : 0, expiresAt, new Date().toISOString());
  return token;
}

export function getUserBySessionToken(token: string | null | undefined): UserAccount | null {
  if (!token) return null;
  const sess = db
    .prepare('SELECT userId, expiresAt FROM sessions WHERE token = ?')
    .get(token) as { userId: string; expiresAt: number } | undefined;
  if (!sess) return null;
  if (Date.now() > sess.expiresAt) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(sess.userId) as
    | Record<string, unknown>
    | undefined;
  return userRow ? rowToUser(userRow) : null;
}

export function deleteSession(token: string): void {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function createOAuthState(
  provider: 'google' | 'facebook' | 'apple',
  role: 'candidate' | 'employer'
): string {
  const state = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + 10 * 60 * 1000;
  db.prepare('DELETE FROM oauth_states WHERE expiresAt < ?').run(Date.now());
  db.prepare(
    'INSERT INTO oauth_states (state, provider, role, expiresAt) VALUES (?, ?, ?, ?)'
  ).run(state, provider, role, expiresAt);
  return state;
}

export function consumeOAuthState(
  state: string,
  provider: 'google' | 'facebook' | 'apple'
): { role: 'candidate' | 'employer' } | null {
  if (!state) return null;
  const row = db
    .prepare('SELECT provider, role, expiresAt FROM oauth_states WHERE state = ?')
    .get(state) as { provider: string; role: string; expiresAt: number } | undefined;
  if (!row) return null;
  db.prepare('DELETE FROM oauth_states WHERE state = ?').run(state);
  if (row.provider !== provider || Date.now() > row.expiresAt) return null;
  return { role: row.role === 'employer' ? 'employer' : 'candidate' };
}

export function findOrCreateOAuthUser(params: {
  provider: 'google' | 'facebook' | 'apple';
  providerUserId: string;
  email?: string;
  fullName?: string;
  avatarUrl?: string;
  role: 'candidate' | 'employer';
}): { user: UserAccount; token: string; isNew: boolean } {
  const nowIso = new Date().toISOString();
  const normalizedEmail = (params.email || '').trim().toLowerCase();
  const displayName =
    (params.fullName || '').trim() ||
    (normalizedEmail ? normalizedEmail.split('@')[0] : '') ||
    `Người dùng ${params.provider.toUpperCase()}`;

  // 1. Existing linked OAuth identity
  const linked = db
    .prepare(
      'SELECT userId FROM oauth_accounts WHERE provider = ? AND providerUserId = ?'
    )
    .get(params.provider, params.providerUserId) as { userId: string } | undefined;

  if (linked) {
    const userRow = db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(linked.userId) as Record<string, unknown> | undefined;
    if (userRow) {
      if (params.avatarUrl && !String(userRow.avatarUrl || '')) {
        db.prepare('UPDATE users SET avatarUrl = ? WHERE id = ?').run(
          params.avatarUrl,
          linked.userId
        );
        userRow.avatarUrl = params.avatarUrl;
      }
      const user = rowToUser(userRow);
      const token = createSession(user.id, true);
      return { user, token, isNew: false };
    }
  }

  // 2. Match existing account by email if email is verified by provider
  if (normalizedEmail) {
    const existingByEmail = db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(normalizedEmail) as Record<string, unknown> | undefined;
    if (existingByEmail) {
      const existingId = String(existingByEmail.id);
      db.prepare(
        `INSERT OR REPLACE INTO oauth_accounts (provider, providerUserId, userId, email, createdAt)
         VALUES (?, ?, ?, ?, ?)`
      ).run(params.provider, params.providerUserId, existingId, normalizedEmail, nowIso);
      if (params.avatarUrl && !String(existingByEmail.avatarUrl || '')) {
        db.prepare('UPDATE users SET avatarUrl = ? WHERE id = ?').run(
          params.avatarUrl,
          existingId
        );
        existingByEmail.avatarUrl = params.avatarUrl;
      }
      const user = rowToUser(existingByEmail);
      const token = createSession(user.id, true);
      return { user, token, isNew: false };
    }
  }

  // 3. Create brand new user account
  const id = 'usr-' + crypto.randomUUID();
  const fallbackEmail =
    normalizedEmail || `${params.provider}_${params.providerUserId}@oauth.jobshub.local`;
  const companyName = params.role === 'employer' ? displayName : '';

  db.prepare(
    `INSERT INTO users (id, fullName, email, phone, passwordHash, role, avatarUrl, companyName, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    displayName,
    fallbackEmail,
    '',
    'oauth-only',
    params.role,
    params.avatarUrl || '',
    companyName,
    nowIso
  );

  const initialProfile: StudentProfile = {
    ...EMPTY_STUDENT_PROFILE,
    fullName: displayName,
    email: normalizedEmail,
    avatarUrl: params.avatarUrl || '',
  };
  db.prepare('INSERT INTO profiles (userId, dataJson, updatedAt) VALUES (?, ?, ?)').run(
    id,
    JSON.stringify(initialProfile),
    nowIso
  );

  db.prepare(
    `INSERT INTO oauth_accounts (provider, providerUserId, userId, email, createdAt)
     VALUES (?, ?, ?, ?, ?)`
  ).run(params.provider, params.providerUserId, id, fallbackEmail, nowIso);

  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown>;
  const token = createSession(id, true);
  return { user: rowToUser(userRow), token, isNew: true };
}

export function createPasswordResetCode(email: string): { code: string; email: string } {
  const normalizedEmail = email.trim().toLowerCase();
  const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(normalizedEmail) as
    | { id: string; email: string }
    | undefined;
  if (!user) {
    throw new Error('EMAIL_NOT_FOUND');
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const id = 'rst-' + crypto.randomUUID();
  const expiresAt = Date.now() + 15 * 60 * 1000;
  db.prepare('DELETE FROM password_resets WHERE userId = ?').run(user.id);
  db.prepare(
    'INSERT INTO password_resets (id, userId, email, code, expiresAt, used) VALUES (?, ?, ?, ?, ?, 0)'
  ).run(id, user.id, user.email, code, expiresAt);
  return { code, email: user.email };
}

export function resetPasswordWithCode(params: {
  email: string;
  code: string;
  newPassword: string;
}): void {
  const normalizedEmail = params.email.trim().toLowerCase();
  if (params.newPassword.length < 6) {
    throw new Error('WEAK_PASSWORD');
  }
  const row = db
    .prepare(
      'SELECT * FROM password_resets WHERE email = ? AND code = ? AND used = 0'
    )
    .get(normalizedEmail, params.code.trim()) as
    | { id: string; userId: string; expiresAt: number }
    | undefined;
  if (!row || Date.now() > row.expiresAt) {
    throw new Error('INVALID_OR_EXPIRED_CODE');
  }
  const newHash = hashPassword(params.newPassword);
  db.prepare('UPDATE users SET passwordHash = ? WHERE id = ?').run(newHash, row.userId);
  db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(row.id);
  // Invalidate older sessions for security
  db.prepare('DELETE FROM sessions WHERE userId = ?').run(row.userId);
}

// Profile CRUD
export function getProfile(userId: string): StudentProfile {
  const row = db.prepare('SELECT dataJson FROM profiles WHERE userId = ?').get(userId) as
    | { dataJson: string }
    | undefined;
  if (row) {
    try {
      return { ...EMPTY_STUDENT_PROFILE, ...JSON.parse(row.dataJson) };
    } catch {
      return EMPTY_STUDENT_PROFILE;
    }
  }
  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as
    | Record<string, unknown>
    | undefined;
  if (!userRow) return EMPTY_STUDENT_PROFILE;
  return {
    ...EMPTY_STUDENT_PROFILE,
    fullName: String(userRow.fullName || ''),
    email: String(userRow.email || ''),
    phone: String(userRow.phone || ''),
    avatarUrl: String(userRow.avatarUrl || ''),
  };
}

export function saveProfile(userId: string, profile: StudentProfile): { profile: StudentProfile; user: UserAccount } {
  const nowIso = new Date().toISOString();
  db.prepare(
    `INSERT INTO profiles (userId, dataJson, updatedAt) VALUES (?, ?, ?)
     ON CONFLICT(userId) DO UPDATE SET dataJson = excluded.dataJson, updatedAt = excluded.updatedAt`
  ).run(userId, JSON.stringify(profile), nowIso);

  db.prepare(
    `UPDATE users SET
       fullName = CASE WHEN ? != '' THEN ? ELSE fullName END,
       phone = CASE WHEN ? != '' THEN ? ELSE phone END,
       avatarUrl = ?
     WHERE id = ?`
  ).run(
    profile.fullName || '',
    profile.fullName || '',
    profile.phone || '',
    profile.phone || '',
    profile.avatarUrl || '',
    userId
  );

  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as Record<string, unknown>;
  return { profile, user: rowToUser(userRow) };
}

// Jobs CRUD
export function listJobs(): Job[] {
  const rows = db.prepare('SELECT dataJson FROM jobs ORDER BY createdAtMs DESC').all() as Array<{
    dataJson: string;
  }>;
  return rows.map((r) => JSON.parse(r.dataJson) as Job);
}

export function getJobById(jobId: string): Job | null {
  const row = db.prepare('SELECT dataJson FROM jobs WHERE id = ?').get(jobId) as
    | { dataJson: string }
    | undefined;
  return row ? (JSON.parse(row.dataJson) as Job) : null;
}

export function createJob(employer: UserAccount, jobInput: Omit<Job, 'id' | 'employerId'>): Job {
  if (employer.role !== 'employer') {
    throw new Error('EMPLOYER_ONLY');
  }
  const newJob: Job = {
    ...jobInput,
    id: 'job-' + crypto.randomUUID().slice(0, 8),
    employerId: employer.id,
    employerAvatar: employer.avatarUrl || '',
    status: jobInput.status || 'published',
  };
  db.prepare(
    'INSERT INTO jobs (id, employerId, status, dataJson, createdAtMs) VALUES (?, ?, ?, ?, ?)'
  ).run(newJob.id, newJob.employerId!, newJob.status!, JSON.stringify(newJob), Date.now());
  return newJob;
}

export function updateJobStatus(
  employer: UserAccount,
  jobId: string,
  status: 'published' | 'pending' | 'closed'
): Job {
  const existing = getJobById(jobId);
  if (!existing) throw new Error('JOB_NOT_FOUND');
  if (existing.employerId !== employer.id) {
    throw new Error('FORBIDDEN');
  }
  const updated: Job = { ...existing, status };
  db.prepare('UPDATE jobs SET status = ?, dataJson = ? WHERE id = ?').run(
    status,
    JSON.stringify(updated),
    jobId
  );
  return updated;
}

export function deleteJob(employer: UserAccount, jobId: string): void {
  const existing = getJobById(jobId);
  if (!existing) throw new Error('JOB_NOT_FOUND');
  if (existing.employerId !== employer.id) {
    throw new Error('FORBIDDEN');
  }
  db.prepare('DELETE FROM jobs WHERE id = ?').run(jobId);
}

// Saved Jobs CRUD
export function getSavedJobIds(userId: string): string[] {
  const rows = db
    .prepare('SELECT jobId FROM saved_jobs WHERE userId = ? ORDER BY createdAt DESC')
    .all(userId) as Array<{ jobId: string }>;
  return rows.map((r) => r.jobId);
}

export function toggleSavedJob(userId: string, jobId: string): { saved: boolean; savedJobIds: string[] } {
  const existing = db
    .prepare('SELECT 1 FROM saved_jobs WHERE userId = ? AND jobId = ?')
    .get(userId, jobId);
  if (existing) {
    db.prepare('DELETE FROM saved_jobs WHERE userId = ? AND jobId = ?').run(userId, jobId);
    return { saved: false, savedJobIds: getSavedJobIds(userId) };
  }
  db.prepare('INSERT INTO saved_jobs (userId, jobId, createdAt) VALUES (?, ?, ?)').run(
    userId,
    jobId,
    new Date().toISOString()
  );
  return { saved: true, savedJobIds: getSavedJobIds(userId) };
}

export function removeSavedJob(userId: string, jobId: string): string[] {
  db.prepare('DELETE FROM saved_jobs WHERE userId = ? AND jobId = ?').run(userId, jobId);
  return getSavedJobIds(userId);
}

// Applications CRUD
function rowToApplication(row: Record<string, unknown>): JobApplication {
  return {
    id: String(row.id),
    jobId: String(row.jobId),
    jobTitle: String(row.jobTitle),
    companyName: String(row.companyName),
    employerId: String(row.employerId),
    applicantId: String(row.applicantId),
    appliedAt: String(row.appliedAt),
    fullName: String(row.applicantName),
    email: String(row.applicantEmail),
    phone: String(row.applicantPhone),
    university: String(row.university || ''),
    major: String(row.major || ''),
    availableShifts: String(row.availableShifts || ''),
    note: String(row.note || ''),
    cvId: row.cvId ? String(row.cvId) : undefined,
    cvSnapshot: row.cvSnapshotJson ? (JSON.parse(String(row.cvSnapshotJson)) as SavedCVRecord) : null,
    status: String(row.status) as ApplicationStatus,
  };
}

export function listApplicationsForUser(user: UserAccount): JobApplication[] {
  if (user.role === 'employer') {
    const rows = db
      .prepare('SELECT * FROM applications WHERE employerId = ? ORDER BY createdAtMs DESC')
      .all(user.id) as Array<Record<string, unknown>>;
    return rows.map(rowToApplication);
  }
  const rows = db
    .prepare('SELECT * FROM applications WHERE applicantId = ? ORDER BY createdAtMs DESC')
    .all(user.id) as Array<Record<string, unknown>>;
  return rows.map(rowToApplication);
}

export function createApplication(
  applicant: UserAccount,
  payload: {
    jobId: string;
    fullName: string;
    email: string;
    phone: string;
    university: string;
    major: string;
    availableShifts: string;
    note: string;
    cvId?: string;
  }
): JobApplication {
  const job = getJobById(payload.jobId);
  if (!job) throw new Error('JOB_NOT_FOUND');
  if (job.status === 'closed') throw new Error('JOB_CLOSED');
  const employerId = job.employerId || `seed-emp-${job.id}`;
  if (employerId === applicant.id) {
    throw new Error('CANNOT_APPLY_OWN_JOB');
  }

  const dup = db
    .prepare('SELECT id FROM applications WHERE jobId = ? AND applicantId = ?')
    .get(job.id, applicant.id);
  if (dup) {
    throw new Error('ALREADY_APPLIED');
  }

  let cvSnapshot: SavedCVRecord | null = null;
  if (payload.cvId) {
    const cvRow = db
      .prepare('SELECT * FROM ai_cvs WHERE id = ? AND userId = ?')
      .get(payload.cvId, applicant.id) as Record<string, unknown> | undefined;
    if (cvRow) {
      cvSnapshot = rowToSavedCV(cvRow);
    }
  }

  const id = 'app-' + crypto.randomUUID().slice(0, 10);
  const now = Date.now();
  const appliedAt = new Date(now).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  db.prepare(
    `INSERT INTO applications (
      id, jobId, jobTitle, companyName, employerId, applicantId,
      applicantName, applicantEmail, applicantPhone, university, major,
      availableShifts, note, cvId, cvSnapshotJson, appliedAt, createdAtMs, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    job.id,
    job.title,
    job.companyName,
    employerId,
    applicant.id,
    payload.fullName.trim(),
    payload.email.trim(),
    payload.phone.trim(),
    payload.university.trim(),
    payload.major.trim(),
    payload.availableShifts.trim(),
    payload.note.trim(),
    payload.cvId || null,
    cvSnapshot ? JSON.stringify(cvSnapshot) : null,
    appliedAt,
    now,
    'Chờ xét duyệt'
  );

  // Notification for Employer
  createNotification({
    userId: employerId,
    type: 'application',
    title: 'Đơn ứng tuyển mới',
    body: `${payload.fullName.trim()} vừa ứng tuyển vị trí "${job.title}"`,
    linkTab: 'employer',
    refId: id,
  });

  const inserted = db.prepare('SELECT * FROM applications WHERE id = ?').get(id) as Record<
    string,
    unknown
  >;
  return rowToApplication(inserted);
}

export function updateApplicationStatus(
  employer: UserAccount,
  applicationId: string,
  status: ApplicationStatus
): JobApplication {
  const row = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId) as
    | Record<string, unknown>
    | undefined;
  if (!row) throw new Error('APPLICATION_NOT_FOUND');
  if (String(row.employerId) !== employer.id) {
    throw new Error('FORBIDDEN');
  }
  const allowed: ApplicationStatus[] = [
    'Chờ xét duyệt',
    'Đã xem',
    'Đang phỏng vấn',
    'Được chấp nhận',
    'Từ chối',
  ];
  if (!allowed.includes(status)) {
    throw new Error('INVALID_STATUS');
  }

  db.prepare('UPDATE applications SET status = ? WHERE id = ?').run(status, applicationId);

  // Notify applicant
  createNotification({
    userId: String(row.applicantId),
    type: 'application_status',
    title: 'Cập nhật trạng thái ứng tuyển',
    body: `Hồ sơ vị trí "${String(row.jobTitle)}" đã chuyển sang trạng thái: ${status}`,
    linkTab: 'applications',
    refId: applicationId,
  });

  const updated = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId) as Record<
    string,
    unknown
  >;
  return rowToApplication(updated);
}

// Conversations & Real-time Messaging CRUD
export function findOrCreateConversation(params: {
  user: UserAccount;
  jobId?: string;
  targetUserId?: string;
  targetName?: string;
  targetAvatar?: string;
  jobTitle?: string;
  companyName?: string;
}): ChatConversation {
  let employerId = '';
  let employerName = '';
  let employerAvatar = '';
  let candidateId = '';
  let candidateName = '';
  let candidateAvatar = '';
  let jobId = params.jobId || '';
  let jobTitle = params.jobTitle || '';
  let companyName = params.companyName || '';

  if (jobId) {
    const job = getJobById(jobId);
    if (!job) throw new Error('JOB_NOT_FOUND');
    jobTitle = job.title;
    companyName = job.companyName;

    if (params.user.role === 'candidate') {
      candidateId = params.user.id;
      candidateName = params.user.fullName;
      candidateAvatar = params.user.avatarUrl || '';
      employerId = job.employerId || `seed-emp-${job.id}`;
      // Look up real employer user record if exists
      const empUser = db.prepare('SELECT * FROM users WHERE id = ?').get(employerId) as
        | Record<string, unknown>
        | undefined;
      employerName = empUser
        ? String(empUser.fullName)
        : job.contactPerson || `${job.companyName} (Tuyển dụng)`;
      employerAvatar = empUser ? String(empUser.avatarUrl || '') : job.employerAvatar || '';
    } else {
      // Employer messaging candidate
      if (!params.targetUserId) throw new Error('TARGET_USER_REQUIRED');
      employerId = params.user.id;
      employerName = params.user.fullName;
      employerAvatar = params.user.avatarUrl || '';
      companyName = params.user.companyName || job.companyName;
      const candUser = db.prepare('SELECT * FROM users WHERE id = ?').get(params.targetUserId) as
        | Record<string, unknown>
        | undefined;
      candidateId = params.targetUserId;
      candidateName = candUser ? String(candUser.fullName) : params.targetName || 'Ứng viên';
      candidateAvatar = candUser ? String(candUser.avatarUrl || '') : params.targetAvatar || '';
    }
  } else {
    if (!params.targetUserId) throw new Error('TARGET_USER_REQUIRED');
    const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(params.targetUserId) as
      | Record<string, unknown>
      | undefined;
    if (params.user.role === 'employer') {
      employerId = params.user.id;
      employerName = params.user.fullName;
      employerAvatar = params.user.avatarUrl || '';
      companyName = params.user.companyName || companyName || 'Bộ phận Tuyển dụng';
      candidateId = params.targetUserId;
      candidateName = targetUser ? String(targetUser.fullName) : params.targetName || 'Ứng viên';
      candidateAvatar = targetUser ? String(targetUser.avatarUrl || '') : params.targetAvatar || '';
    } else {
      candidateId = params.user.id;
      candidateName = params.user.fullName;
      candidateAvatar = params.user.avatarUrl || '';
      employerId = params.targetUserId;
      employerName = targetUser
        ? String(targetUser.fullName)
        : params.targetName || 'Nhà tuyển dụng';
      employerAvatar = targetUser ? String(targetUser.avatarUrl || '') : params.targetAvatar || '';
      companyName = targetUser && targetUser.companyName ? String(targetUser.companyName) : companyName;
    }
  }

  if (candidateId === employerId) {
    throw new Error('SELF_CHAT_NOT_ALLOWED');
  }

  // Find existing conversation for same (candidateId, employerId, jobId)
  const existing = db
    .prepare(
      'SELECT * FROM conversations WHERE candidateId = ? AND employerId = ? AND jobId = ?'
    )
    .get(candidateId, employerId, jobId) as Record<string, unknown> | undefined;

  if (existing) {
    return buildConversationDto(existing, params.user.id);
  }

  const convId = 'conv-' + crypto.randomUUID().slice(0, 10);
  const nowMs = Date.now();
  const timeStr = new Date(nowMs).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  db.prepare(
    `INSERT INTO conversations (
      id, jobId, jobTitle, companyName,
      candidateId, candidateName, candidateAvatar,
      employerId, employerName, employerAvatar,
      lastMessage, lastSenderId, lastTimestamp, updatedAtMs
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    convId,
    jobId,
    jobTitle,
    companyName,
    candidateId,
    candidateName,
    candidateAvatar,
    employerId,
    employerName,
    employerAvatar,
    '',
    '',
    timeStr,
    nowMs
  );

  const created = db.prepare('SELECT * FROM conversations WHERE id = ?').get(convId) as Record<
    string,
    unknown
  >;
  return buildConversationDto(created, params.user.id);
}

function buildConversationDto(convRow: Record<string, unknown>, viewerId: string): ChatConversation {
  const convId = String(convRow.id);
  const isViewerEmployer = String(convRow.employerId) === viewerId;

  const msgRows = db
    .prepare('SELECT * FROM messages WHERE conversationId = ? ORDER BY createdAtMs ASC')
    .all(convId) as Array<Record<string, unknown>>;

  const messages: ChatMessage[] = msgRows.map((m) => ({
    id: String(m.id),
    conversationId: String(m.conversationId),
    senderId: String(m.senderId),
    receiverId: String(m.receiverId),
    senderName: String(m.senderName),
    senderRole: m.senderRole === 'employer' ? 'employer' : 'candidate',
    text: String(m.message),
    timestamp: String(m.timestamp),
    createdAt: String(m.createdAt),
    read: Number(m.read) === 1,
    isMe: String(m.senderId) === viewerId,
  }));

  const unreadCount = msgRows.filter(
    (m) => String(m.receiverId) === viewerId && Number(m.read) === 0
  ).length;

  return {
    id: convId,
    participantId: isViewerEmployer ? String(convRow.candidateId) : String(convRow.employerId),
    participantName: isViewerEmployer
      ? String(convRow.candidateName)
      : String(convRow.employerName),
    participantRole: isViewerEmployer ? 'candidate' : 'employer',
    participantAvatar: isViewerEmployer
      ? String(convRow.candidateAvatar || '')
      : String(convRow.employerAvatar || ''),
    companyName: String(convRow.companyName || ''),
    jobId: String(convRow.jobId || ''),
    jobTitle: String(convRow.jobTitle || ''),
    employerId: String(convRow.employerId),
    candidateId: String(convRow.candidateId),
    lastMessage: String(convRow.lastMessage || ''),
    lastTimestamp: String(convRow.lastTimestamp || ''),
    unreadCount,
    messages,
  };
}

export function listConversationsForUser(userId: string): ChatConversation[] {
  const rows = db
    .prepare(
      'SELECT * FROM conversations WHERE candidateId = ? OR employerId = ? ORDER BY updatedAtMs DESC'
    )
    .all(userId, userId) as Array<Record<string, unknown>>;
  return rows.map((row) => buildConversationDto(row, userId));
}

export function sendMessageInConversation(params: {
  sender: UserAccount;
  conversationId: string;
  text: string;
}): { message: ChatMessage; receiverId: string; conversation: ChatConversation } {
  const cleanText = params.text.trim();
  if (!cleanText) throw new Error('EMPTY_MESSAGE');

  const conv = db
    .prepare('SELECT * FROM conversations WHERE id = ?')
    .get(params.conversationId) as Record<string, unknown> | undefined;
  if (!conv) throw new Error('CONVERSATION_NOT_FOUND');

  const candidateId = String(conv.candidateId);
  const employerId = String(conv.employerId);
  if (params.sender.id !== candidateId && params.sender.id !== employerId) {
    throw new Error('FORBIDDEN');
  }

  const receiverId = params.sender.id === candidateId ? employerId : candidateId;
  if (receiverId === params.sender.id) {
    throw new Error('SELF_CHAT_NOT_ALLOWED');
  }

  const msgId = 'msg-' + crypto.randomUUID().slice(0, 10);
  const nowMs = Date.now();
  const createdAt = new Date(nowMs).toISOString();
  const timeStr = new Date(nowMs).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  db.prepare(
    `INSERT INTO messages (
      id, conversationId, senderId, receiverId, senderName, senderRole,
      message, timestamp, createdAt, createdAtMs, read
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
  ).run(
    msgId,
    params.conversationId,
    params.sender.id,
    receiverId,
    params.sender.fullName,
    params.sender.role,
    cleanText,
    timeStr,
    createdAt,
    nowMs
  );

  // Sync latest sender avatar/name if updated
  if (params.sender.id === candidateId) {
    db.prepare(
      `UPDATE conversations
       SET lastMessage = ?, lastSenderId = ?, lastTimestamp = ?, updatedAtMs = ?,
           candidateName = ?, candidateAvatar = ?
       WHERE id = ?`
    ).run(
      cleanText,
      params.sender.id,
      timeStr,
      nowMs,
      params.sender.fullName,
      params.sender.avatarUrl || '',
      params.conversationId
    );
  } else {
    db.prepare(
      `UPDATE conversations
       SET lastMessage = ?, lastSenderId = ?, lastTimestamp = ?, updatedAtMs = ?,
           employerName = ?, employerAvatar = ?
       WHERE id = ?`
    ).run(
      cleanText,
      params.sender.id,
      timeStr,
      nowMs,
      params.sender.fullName,
      params.sender.avatarUrl || '',
      params.conversationId
    );
  }

  createNotification({
    userId: receiverId,
    type: 'message',
    title: `Tin nhắn mới từ ${params.sender.fullName}`,
    body: cleanText.length > 80 ? cleanText.slice(0, 80) + '...' : cleanText,
    linkTab: 'messages',
    refId: params.conversationId,
  });

  const updatedConv = db
    .prepare('SELECT * FROM conversations WHERE id = ?')
    .get(params.conversationId) as Record<string, unknown>;
  const dto = buildConversationDto(updatedConv, params.sender.id);
  const message = dto.messages[dto.messages.length - 1];
  return { message, receiverId, conversation: dto };
}

export function markConversationAsRead(userId: string, conversationId: string): string[] {
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId) as
    | Record<string, unknown>
    | undefined;
  if (!conv) throw new Error('CONVERSATION_NOT_FOUND');
  const candidateId = String(conv.candidateId);
  const employerId = String(conv.employerId);
  if (userId !== candidateId && userId !== employerId) {
    throw new Error('FORBIDDEN');
  }
  db.prepare(
    'UPDATE messages SET read = 1 WHERE conversationId = ? AND receiverId = ? AND read = 0'
  ).run(conversationId, userId);
  db.prepare(
    "UPDATE notifications SET isRead = 1 WHERE userId = ? AND type = 'message' AND refId = ?"
  ).run(userId, conversationId);
  return [candidateId, employerId];
}

// Notifications
export function createNotification(params: {
  userId: string;
  type: 'message' | 'application' | 'application_status';
  title: string;
  body: string;
  linkTab: string;
  refId?: string;
}): AppNotification {
  const id = 'notif-' + crypto.randomUUID().slice(0, 10);
  const nowMs = Date.now();
  const createdAt = new Date(nowMs).toISOString();
  db.prepare(
    `INSERT INTO notifications (id, userId, type, title, body, linkTab, refId, isRead, createdAt, createdAtMs)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(
    id,
    params.userId,
    params.type,
    params.title,
    params.body,
    params.linkTab,
    params.refId || '',
    createdAt,
    nowMs
  );
  return {
    id,
    userId: params.userId,
    type: params.type,
    title: params.title,
    body: params.body,
    linkTab: params.linkTab,
    refId: params.refId || '',
    isRead: false,
    createdAt,
  };
}

export function listNotifications(userId: string): AppNotification[] {
  const rows = db
    .prepare('SELECT * FROM notifications WHERE userId = ? ORDER BY createdAtMs DESC LIMIT 30')
    .all(userId) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id),
    userId: String(r.userId),
    type: String(r.type) as AppNotification['type'],
    title: String(r.title),
    body: String(r.body),
    linkTab: String(r.linkTab),
    refId: String(r.refId || ''),
    isRead: Number(r.isRead) === 1,
    createdAt: String(r.createdAt),
  }));
}

export function markNotificationsRead(userId: string): void {
  db.prepare('UPDATE notifications SET isRead = 1 WHERE userId = ?').run(userId);
}

// AI CVs CRUD
function rowToSavedCV(row: Record<string, unknown>): SavedCVRecord {
  return {
    id: String(row.id),
    userId: String(row.userId),
    name: String(row.name),
    targetJob: String(row.targetJob),
    language: String(row.language) as CVLanguage,
    template: String(row.template) as CVTemplateId,
    accentColor: String(row.accentColor || '#2F5233'),
    layout: row.layout === 'two-column' ? 'two-column' : 'single',
    data: JSON.parse(String(row.cvJson)) as AICVData,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

export function listSavedCVs(userId: string): SavedCVRecord[] {
  const rows = db
    .prepare('SELECT * FROM ai_cvs WHERE userId = ? ORDER BY updatedAtMs DESC')
    .all(userId) as Array<Record<string, unknown>>;
  return rows.map(rowToSavedCV);
}

export function saveCV(
  userId: string,
  payload: {
    id?: string;
    name: string;
    targetJob: string;
    language: CVLanguage;
    template: CVTemplateId;
    accentColor: string;
    layout: 'single' | 'two-column';
    data: AICVData;
  }
): SavedCVRecord {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  if (payload.id) {
    const existing = db
      .prepare('SELECT id, userId, createdAt FROM ai_cvs WHERE id = ?')
      .get(payload.id) as { id: string; userId: string; createdAt: string } | undefined;
    if (existing) {
      if (existing.userId !== userId) throw new Error('FORBIDDEN');
      db.prepare(
        `UPDATE ai_cvs
         SET name = ?, targetJob = ?, language = ?, template = ?, accentColor = ?, layout = ?, cvJson = ?, updatedAt = ?, updatedAtMs = ?
         WHERE id = ?`
      ).run(
        payload.name.trim() || 'CV của tôi',
        payload.targetJob.trim(),
        payload.language,
        payload.template,
        payload.accentColor,
        payload.layout,
        JSON.stringify(payload.data),
        nowIso,
        nowMs,
        payload.id
      );
      const updated = db.prepare('SELECT * FROM ai_cvs WHERE id = ?').get(payload.id) as Record<
        string,
        unknown
      >;
      return rowToSavedCV(updated);
    }
  }

  const newId = 'cv-' + crypto.randomUUID().slice(0, 10);
  db.prepare(
    `INSERT INTO ai_cvs (id, userId, name, targetJob, language, template, accentColor, layout, cvJson, createdAt, updatedAt, updatedAtMs)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    newId,
    userId,
    payload.name.trim() || `CV - ${payload.targetJob}`,
    payload.targetJob.trim(),
    payload.language,
    payload.template,
    payload.accentColor,
    payload.layout,
    JSON.stringify(payload.data),
    nowIso,
    nowIso,
    nowMs
  );
  const created = db.prepare('SELECT * FROM ai_cvs WHERE id = ?').get(newId) as Record<
    string,
    unknown
  >;
  return rowToSavedCV(created);
}

export function deleteSavedCV(userId: string, cvId: string): void {
  const existing = db.prepare('SELECT userId FROM ai_cvs WHERE id = ?').get(cvId) as
    | { userId: string }
    | undefined;
  if (!existing) throw new Error('CV_NOT_FOUND');
  if (existing.userId !== userId) throw new Error('FORBIDDEN');
  db.prepare('DELETE FROM ai_cvs WHERE id = ?').run(cvId);
}

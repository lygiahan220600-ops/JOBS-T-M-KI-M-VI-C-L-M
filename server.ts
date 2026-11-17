import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import {
  registerUser,
  loginUser,
  getUserBySessionToken,
  deleteSession,
  createOAuthState,
  consumeOAuthState,
  findOrCreateOAuthUser,
  createPasswordResetCode,
  resetPasswordWithCode,
  getProfile,
  saveProfile,
  listJobs,
  createJob,
  updateJobStatus,
  deleteJob,
  getSavedJobIds,
  toggleSavedJob,
  removeSavedJob,
  listApplicationsForUser,
  createApplication,
  updateApplicationStatus,
  findOrCreateConversation,
  listConversationsForUser,
  sendMessageInConversation,
  markConversationAsRead,
  listNotifications,
  markNotificationsRead,
  listSavedCVs,
  saveCV,
  deleteSavedCV,
} from './server/db.ts';
import {
  buildOAuthAuthorizeUrl,
  exchangeOAuthCodeForProfile,
  getAppBaseUrl,
  getOAuthProvidersStatus,
  type OAuthProvider,
} from './server/oauth.ts';
import { generateCvWithGemini } from './server/aiCv.ts';
import type { UserAccount } from './src/types.ts';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: false }));

// SSE client registry keyed by userId
const sseClients = new Map<string, Set<Response>>();

function pushUserEvent(userId: string, event: Record<string, unknown>) {
  const clients = sseClients.get(userId);
  if (!clients || clients.size === 0) return;
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      // ignore broken pipe
    }
  }
}

function broadcastEvent(event: Record<string, unknown>) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const clients of sseClients.values()) {
    for (const res of clients) {
      try {
        res.write(payload);
      } catch {
        // ignore
      }
    }
  }
}

// Cookie & Token Extraction
function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = decodeURIComponent(part.slice(idx + 1).trim());
      out[k] = v;
    }
  }
  return out;
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  if (typeof req.query.token === 'string' && req.query.token.trim()) {
    return req.query.token.trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies['jobshub_session'] || null;
}

function setSessionCookie(res: Response, token: string, rememberMe: boolean) {
  const isHttps = getAppBaseUrl().startsWith('https://');
  const attrs = [
    `jobshub_session=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (isHttps) {
    attrs.push('Secure');
  }
  if (rememberMe) {
    attrs.push(`Max-Age=${30 * 24 * 60 * 60}`);
  }
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearSessionCookie(res: Response) {
  const isHttps = getAppBaseUrl().startsWith('https://');
  const attrs = [
    'jobshub_session=',
    'Path=/',
    'HttpOnly',
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isHttps) {
    attrs.push('Secure');
  }
  res.setHeader('Set-Cookie', attrs.join('; '));
}

interface AuthedRequest extends Request {
  user?: UserAccount;
  sessionToken?: string;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  const user = getUserBySessionToken(token);
  if (!user || !token) {
    res.status(401).json({ error: 'Vui lòng đăng nhập để tiếp tục.' });
    return;
  }
  req.user = user;
  req.sessionToken = token;
  next();
}

// ==================== AUTH ROUTES ====================

app.post('/api/auth/register', (req, res) => {
  try {
    const { fullName, email, phone, password, confirmPassword, role, companyName } = req.body || {};
    if (!fullName || !email || !password) {
      res.status(400).json({ error: 'Vui lòng điền đầy đủ Họ tên, Email và Mật khẩu.' });
      return;
    }
    if (confirmPassword !== undefined && password !== confirmPassword) {
      res.status(400).json({ error: 'Mật khẩu và xác nhận mật khẩu không trùng khớp.' });
      return;
    }
    if (role === 'employer' && !String(companyName || '').trim()) {
      res.status(400).json({ error: 'Vui lòng nhập Tên công ty / Doanh nghiệp.' });
      return;
    }

    const result = registerUser({
      fullName: String(fullName),
      email: String(email),
      phone: String(phone || ''),
      password: String(password),
      role: role === 'employer' ? 'employer' : 'candidate',
      companyName: companyName ? String(companyName) : undefined,
    });

    setSessionCookie(res, result.token, true);
    res.status(201).json({ user: result.user, token: result.token });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'INVALID_EMAIL') {
      res.status(400).json({ error: 'Địa chỉ email không hợp lệ.' });
    } else if (msg === 'WEAK_PASSWORD') {
      res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự.' });
    } else if (msg === 'EMAIL_EXISTS') {
      res.status(409).json({ error: 'Email này đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác.' });
    } else {
      res.status(500).json({ error: 'Không thể đăng ký tài khoản. Vui lòng thử lại.' });
    }
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password, rememberMe = true } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: 'Vui lòng nhập Email và Mật khẩu.' });
      return;
    }
    const result = loginUser({
      email: String(email),
      password: String(password),
      rememberMe: Boolean(rememberMe),
    });
    setSessionCookie(res, result.token, Boolean(rememberMe));
    res.json({ user: result.user, token: result.token });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'INVALID_CREDENTIALS') {
      res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác.' });
    } else {
      res.status(500).json({ error: 'Đăng nhập thất bại. Vui lòng thử lại.' });
    }
  }
});

app.get('/api/auth/me', (req, res) => {
  const token = extractToken(req);
  const user = getUserBySessionToken(token);
  if (!user) {
    res.json({ user: null });
    return;
  }
  res.json({ user });
});

app.post('/api/auth/logout', (req, res) => {
  const token = extractToken(req);
  if (token) {
    deleteSession(token);
  }
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.post('/api/auth/forgot-password', (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      res.status(400).json({ error: 'Vui lòng nhập địa chỉ email.' });
      return;
    }
    const result = createPasswordResetCode(String(email));
    // Notice: if SMTP isn't configured in sandbox, return a clear status + dev reset code
    const hasSmtp = Boolean(process.env.SMTP_HOST);
    res.json({
      ok: true,
      email: result.email,
      message: hasSmtp
        ? `Đã gửi hướng dẫn đặt lại mật khẩu đến ${result.email}.`
        : `Đã tạo mã xác nhận đặt lại mật khẩu cho ${result.email} (hết hạn sau 15 phút).`,
      resetCode: hasSmtp ? undefined : result.code,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'EMAIL_NOT_FOUND') {
      res.status(404).json({ error: 'Không tìm thấy tài khoản nào sử dụng email này.' });
    } else {
      res.status(500).json({ error: 'Không thể xử lý yêu cầu đặt lại mật khẩu.' });
    }
  }
});

app.post('/api/auth/reset-password', (req, res) => {
  try {
    const { email, code, newPassword } = req.body || {};
    if (!email || !code || !newPassword) {
      res.status(400).json({ error: 'Vui lòng điền đầy đủ Email, mã xác nhận và mật khẩu mới.' });
      return;
    }
    resetPasswordWithCode({
      email: String(email),
      code: String(code),
      newPassword: String(newPassword),
    });
    res.json({ ok: true, message: 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'WEAK_PASSWORD') {
      res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
    } else if (msg === 'INVALID_OR_EXPIRED_CODE') {
      res.status(400).json({ error: 'Mã xác nhận không đúng hoặc đã hết hạn.' });
    } else {
      res.status(500).json({ error: 'Không thể đặt lại mật khẩu.' });
    }
  }
});

// ==================== OAUTH ROUTES (Google, Facebook, Apple / iCloud) ====================

function parseOAuthProvider(raw: string): OAuthProvider | null {
  if (raw === 'google' || raw === 'facebook' || raw === 'apple') return raw;
  return null;
}

const PROVIDER_DISPLAY_NAME: Record<OAuthProvider, string> = {
  google: 'Google',
  facebook: 'Facebook',
  apple: 'Apple / iCloud',
};

app.get('/api/auth/oauth/providers', (_req, res) => {
  res.json(getOAuthProvidersStatus());
});

app.get('/api/auth/oauth/:provider/url', (req, res) => {
  const provider = parseOAuthProvider(String(req.params.provider || ''));
  if (!provider) {
    res.status(400).json({ error: 'Nhà cung cấp OAuth không được hỗ trợ.' });
    return;
  }
  const role = req.query.role === 'employer' ? 'employer' : 'candidate';
  try {
    const state = createOAuthState(provider, role);
    const url = buildOAuthAuthorizeUrl(provider, state);
    res.json({ url });
  } catch (err) {
    res.status(400).json({
      error:
        err instanceof Error
          ? err.message
          : `Chưa cấu hình đăng nhập ${PROVIDER_DISPLAY_NAME[provider]}.`,
    });
  }
});

async function handleOAuthCallback(req: Request, res: Response) {
  const provider = parseOAuthProvider(String(req.params.provider || ''));
  const sendPopupResult = (payload: Record<string, unknown>, fallbackMsg: string) => {
    const safeJson = JSON.stringify(payload).replace(/</g, '\\u003c');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html>
<html lang="vi">
<head><meta charset="utf-8"><title>JobsHub - Xác thực</title></head>
<body style="font-family: sans-serif; background: #FAF7F2; color: #1E3821; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; text-align: center;">
  <div style="background: #fff; border: 1px solid #E8E2D5; border-radius: 16px; padding: 24px; max-width: 380px;">
    <p style="font-weight: 700; margin: 0 0 8px 0;">${fallbackMsg.replace(/</g, '&lt;')}</p>
    <p style="font-size: 13px; color: #57534E; margin: 0;">Cửa sổ này sẽ tự động đóng trong giây lát...</p>
  </div>
  <script>
    (function() {
      var data = ${safeJson};
      if (window.opener) {
        window.opener.postMessage(data, '*');
        window.close();
      } else if (data.type === 'OAUTH_AUTH_SUCCESS') {
        window.location.href = '/';
      }
    })();
  </script>
</body>
</html>`);
  };

  if (!provider) {
    sendPopupResult(
      { type: 'OAUTH_AUTH_ERROR', error: 'Nhà cung cấp không hợp lệ.' },
      'Nhà cung cấp đăng nhập không hợp lệ.'
    );
    return;
  }

  const queryOrBody = { ...(req.query || {}), ...(req.body || {}) } as Record<string, unknown>;
  const oauthError = queryOrBody.error ? String(queryOrBody.error) : '';
  if (oauthError) {
    const desc = queryOrBody.error_description
      ? String(queryOrBody.error_description)
      : oauthError;
    sendPopupResult(
      {
        type: 'OAUTH_AUTH_ERROR',
        error: `Đăng nhập ${PROVIDER_DISPLAY_NAME[provider]} bị hủy hoặc từ chối (${desc}).`,
      },
      'Đăng nhập không hoàn tất.'
    );
    return;
  }

  const code = queryOrBody.code ? String(queryOrBody.code) : '';
  const state = queryOrBody.state ? String(queryOrBody.state) : '';
  const appleUserJson = queryOrBody.user ? String(queryOrBody.user) : undefined;

  if (!code || !state) {
    sendPopupResult(
      { type: 'OAUTH_AUTH_ERROR', error: 'Thiếu mã xác thực từ nhà cung cấp.' },
      'Thiếu mã xác thực OAuth.'
    );
    return;
  }

  const stateRecord = consumeOAuthState(state, provider);
  if (!stateRecord) {
    sendPopupResult(
      { type: 'OAUTH_AUTH_ERROR', error: 'Phiên xác thực đã hết hạn. Vui lòng thử lại.' },
      'Phiên xác thực đã hết hạn.'
    );
    return;
  }

  try {
    const profile = await exchangeOAuthCodeForProfile({
      provider,
      code,
      appleUserJson,
    });
    const { user, token } = findOrCreateOAuthUser({
      provider,
      providerUserId: profile.providerUserId,
      email: profile.email,
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl,
      role: stateRecord.role,
    });

    setSessionCookie(res, token, true);
    sendPopupResult(
      {
        type: 'OAUTH_AUTH_SUCCESS',
        token,
        user,
        provider,
        message: `Đăng nhập bằng ${PROVIDER_DISPLAY_NAME[provider]} thành công!`,
      },
      `Đăng nhập bằng ${PROVIDER_DISPLAY_NAME[provider]} thành công!`
    );
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : `Lỗi xác thực ${PROVIDER_DISPLAY_NAME[provider]}.`;
    sendPopupResult({ type: 'OAUTH_AUTH_ERROR', error: errMsg }, errMsg);
  }
}

app.get(
  ['/api/auth/oauth/:provider/callback', '/api/auth/oauth/:provider/callback/'],
  handleOAuthCallback
);
app.post(
  ['/api/auth/oauth/:provider/callback', '/api/auth/oauth/:provider/callback/'],
  handleOAuthCallback
);

// ==================== SSE REALTIME EVENTS ====================

app.get('/api/events', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let set = sseClients.get(userId);
  if (!set) {
    set = new Set();
    sseClients.set(userId, set);
  }
  set.add(res);

  res.write(`data: ${JSON.stringify({ type: 'connected', userId })}\n\n`);

  const keepAlive = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      // ignore
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    const cur = sseClients.get(userId);
    if (cur) {
      cur.delete(res);
      if (cur.size === 0) sseClients.delete(userId);
    }
  });
});

// ==================== PROFILE ROUTES ====================

app.get('/api/profile', requireAuth, (req: AuthedRequest, res) => {
  const profile = getProfile(req.user!.id);
  res.json({ profile });
});

app.put('/api/profile', requireAuth, (req: AuthedRequest, res) => {
  try {
    const result = saveProfile(req.user!.id, req.body.profile || req.body);
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Không thể lưu hồ sơ cá nhân.' });
  }
});

// ==================== JOBS ROUTES ====================

app.get('/api/jobs', (_req, res) => {
  res.json({ jobs: listJobs() });
});

app.post('/api/jobs', requireAuth, (req: AuthedRequest, res) => {
  try {
    const job = createJob(req.user!, req.body);
    broadcastEvent({ type: 'jobs_updated' });
    res.status(201).json({ job });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'EMPLOYER_ONLY') {
      res.status(403).json({ error: 'Chỉ tài khoản Nhà tuyển dụng mới được đăng bài tuyển dụng.' });
    } else {
      res.status(500).json({ error: 'Không thể đăng bài tuyển dụng.' });
    }
  }
});

app.patch('/api/jobs/:id/status', requireAuth, (req: AuthedRequest, res) => {
  try {
    const status = req.body?.status;
    if (!['published', 'pending', 'closed'].includes(status)) {
      res.status(400).json({ error: 'Trạng thái bài đăng không hợp lệ.' });
      return;
    }
    const job = updateJobStatus(req.user!, String(req.params.id), status);
    broadcastEvent({ type: 'jobs_updated' });
    res.json({ job });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'JOB_NOT_FOUND') {
      res.status(404).json({ error: 'Không tìm thấy bài tuyển dụng.' });
    } else if (msg === 'FORBIDDEN') {
      res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa bài tuyển dụng này.' });
    } else {
      res.status(500).json({ error: 'Không thể cập nhật trạng thái bài đăng.' });
    }
  }
});

app.delete('/api/jobs/:id', requireAuth, (req: AuthedRequest, res) => {
  try {
    deleteJob(req.user!, String(req.params.id));
    broadcastEvent({ type: 'jobs_updated' });
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'JOB_NOT_FOUND') {
      res.status(404).json({ error: 'Không tìm thấy bài tuyển dụng.' });
    } else if (msg === 'FORBIDDEN') {
      res.status(403).json({ error: 'Bạn không có quyền xóa bài tuyển dụng này.' });
    } else {
      res.status(500).json({ error: 'Không thể xóa bài tuyển dụng.' });
    }
  }
});

// ==================== SAVED JOBS ROUTES ====================

app.get('/api/saved-jobs', requireAuth, (req: AuthedRequest, res) => {
  res.json({ savedJobIds: getSavedJobIds(req.user!.id) });
});

app.post('/api/saved-jobs/toggle', requireAuth, (req: AuthedRequest, res) => {
  const { jobId } = req.body || {};
  if (!jobId) {
    res.status(400).json({ error: 'Thiếu mã bài đăng.' });
    return;
  }
  const result = toggleSavedJob(req.user!.id, String(jobId));
  res.json(result);
});

app.delete('/api/saved-jobs/:jobId', requireAuth, (req: AuthedRequest, res) => {
  const savedJobIds = removeSavedJob(req.user!.id, String(req.params.jobId));
  res.json({ savedJobIds });
});

// ==================== APPLICATIONS ROUTES ====================

app.get('/api/applications', requireAuth, (req: AuthedRequest, res) => {
  res.json({ applications: listApplicationsForUser(req.user!) });
});

app.post('/api/applications', requireAuth, (req: AuthedRequest, res) => {
  try {
    if (req.user!.role === 'employer') {
      res.status(403).json({ error: 'Tài khoản Nhà tuyển dụng không thể nộp đơn ứng tuyển.' });
      return;
    }
    const appRecord = createApplication(req.user!, req.body);
    pushUserEvent(appRecord.employerId, {
      type: 'application_created',
      applicationId: appRecord.id,
      jobId: appRecord.jobId,
    });
    pushUserEvent(req.user!.id, {
      type: 'application_created',
      applicationId: appRecord.id,
      jobId: appRecord.jobId,
    });
    res.status(201).json({ application: appRecord });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'JOB_NOT_FOUND') {
      res.status(404).json({ error: 'Bài tuyển dụng không tồn tại.' });
    } else if (msg === 'JOB_CLOSED') {
      res.status(400).json({ error: 'Bài tuyển dụng này đã ngừng nhận hồ sơ.' });
    } else if (msg === 'ALREADY_APPLIED') {
      res.status(409).json({ error: 'Bạn đã ứng tuyển vào vị trí này rồi.' });
    } else if (msg === 'CANNOT_APPLY_OWN_JOB') {
      res.status(400).json({ error: 'Bạn không thể ứng tuyển vào bài đăng của chính mình.' });
    } else {
      res.status(500).json({ error: 'Không thể gửi đơn ứng tuyển.' });
    }
  }
});

app.patch('/api/applications/:id/status', requireAuth, (req: AuthedRequest, res) => {
  try {
    const { status } = req.body || {};
    const updated = updateApplicationStatus(req.user!, String(req.params.id), status);
    pushUserEvent(updated.applicantId, {
      type: 'application_updated',
      applicationId: updated.id,
      status: updated.status,
    });
    pushUserEvent(updated.employerId, {
      type: 'application_updated',
      applicationId: updated.id,
      status: updated.status,
    });
    res.json({ application: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'APPLICATION_NOT_FOUND') {
      res.status(404).json({ error: 'Không tìm thấy đơn ứng tuyển.' });
    } else if (msg === 'FORBIDDEN') {
      res.status(403).json({ error: 'Bạn không có quyền cập nhật đơn ứng tuyển này.' });
    } else if (msg === 'INVALID_STATUS') {
      res.status(400).json({ error: 'Trạng thái hồ sơ không hợp lệ.' });
    } else {
      res.status(500).json({ error: 'Không thể cập nhật trạng thái đơn ứng tuyển.' });
    }
  }
});

// ==================== CONVERSATIONS & MESSAGES ROUTES ====================

app.get('/api/conversations', requireAuth, (req: AuthedRequest, res) => {
  res.json({ conversations: listConversationsForUser(req.user!.id) });
});

app.post('/api/conversations', requireAuth, (req: AuthedRequest, res) => {
  try {
    const conv = findOrCreateConversation({
      user: req.user!,
      jobId: req.body?.jobId,
      targetUserId: req.body?.targetUserId,
      targetName: req.body?.targetName,
      targetAvatar: req.body?.targetAvatar,
      jobTitle: req.body?.jobTitle,
      companyName: req.body?.companyName,
    });
    res.json({ conversation: conv });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'SELF_CHAT_NOT_ALLOWED') {
      res.status(400).json({ error: 'Bạn không thể tự nhắn tin cho chính mình.' });
    } else if (msg === 'JOB_NOT_FOUND') {
      res.status(404).json({ error: 'Không tìm thấy bài tuyển dụng.' });
    } else if (msg === 'TARGET_USER_REQUIRED') {
      res.status(400).json({ error: 'Thiếu thông tin người nhận.' });
    } else {
      res.status(500).json({ error: 'Không thể khởi tạo cuộc trò chuyện.' });
    }
  }
});

app.post('/api/conversations/:id/messages', requireAuth, (req: AuthedRequest, res) => {
  try {
    const result = sendMessageInConversation({
      sender: req.user!,
      conversationId: String(req.params.id),
      text: String(req.body?.text || ''),
    });
    pushUserEvent(result.receiverId, {
      type: 'message',
      conversationId: String(req.params.id),
    });
    pushUserEvent(req.user!.id, {
      type: 'message',
      conversationId: String(req.params.id),
    });
    res.status(201).json({ message: result.message, conversation: result.conversation });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'EMPTY_MESSAGE') {
      res.status(400).json({ error: 'Nội dung tin nhắn không được để trống.' });
    } else if (msg === 'CONVERSATION_NOT_FOUND') {
      res.status(404).json({ error: 'Không tìm thấy cuộc trò chuyện.' });
    } else if (msg === 'FORBIDDEN') {
      res.status(403).json({ error: 'Bạn không có quyền tham gia cuộc trò chuyện này.' });
    } else {
      res.status(500).json({ error: 'Không thể gửi tin nhắn.' });
    }
  }
});

app.post('/api/conversations/:id/read', requireAuth, (req: AuthedRequest, res) => {
  try {
    const participants = markConversationAsRead(req.user!.id, String(req.params.id));
    for (const uid of participants) {
      pushUserEvent(uid, {
        type: 'conversation_read',
        conversationId: String(req.params.id),
      });
    }
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'FORBIDDEN') {
      res.status(403).json({ error: 'Không có quyền truy cập.' });
    } else if (msg === 'CONVERSATION_NOT_FOUND') {
      res.status(404).json({ error: 'Không tìm thấy cuộc trò chuyện.' });
    } else {
      res.status(500).json({ error: 'Không thể đánh dấu đã đọc.' });
    }
  }
});

// ==================== NOTIFICATIONS ROUTES ====================

app.get('/api/notifications', requireAuth, (req: AuthedRequest, res) => {
  res.json({ notifications: listNotifications(req.user!.id) });
});

app.post('/api/notifications/read-all', requireAuth, (req: AuthedRequest, res) => {
  markNotificationsRead(req.user!.id);
  res.json({ ok: true });
});

// ==================== AI CV & SAVED CVS ROUTES ====================

app.post('/api/ai/generate-cv', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const payload = req.body;
    if (!payload?.targetJob || !payload?.fullName) {
      res.status(400).json({ error: 'Vui lòng nhập Họ và tên và Vị trí ứng tuyển mục tiêu.' });
      return;
    }
    const cvData = await generateCvWithGemini(payload);
    res.json({ cv: cvData });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Không thể tạo CV bằng AI. Vui lòng kiểm tra GEMINI_API_KEY trên máy chủ.';
    res.status(500).json({ error: message });
  }
});

app.get('/api/cvs', requireAuth, (req: AuthedRequest, res) => {
  res.json({ cvs: listSavedCVs(req.user!.id) });
});

app.post('/api/cvs', requireAuth, (req: AuthedRequest, res) => {
  try {
    const saved = saveCV(req.user!.id, req.body);
    res.status(201).json({ cv: saved });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'FORBIDDEN') {
      res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa CV này.' });
    } else {
      res.status(500).json({ error: 'Không thể lưu CV vào tài khoản.' });
    }
  }
});

app.delete('/api/cvs/:id', requireAuth, (req: AuthedRequest, res) => {
  try {
    deleteSavedCV(req.user!.id, String(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'CV_NOT_FOUND') {
      res.status(404).json({ error: 'Không tìm thấy CV.' });
    } else if (msg === 'FORBIDDEN') {
      res.status(403).json({ error: 'Bạn không có quyền xóa CV này.' });
    } else {
      res.status(500).json({ error: 'Không thể xóa CV.' });
    }
  }
});

// ==================== VITE / STATIC SERVING ====================

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`JobsHub full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

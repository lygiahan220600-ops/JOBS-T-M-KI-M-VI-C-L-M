import crypto from 'node:crypto';

export type OAuthProvider = 'google' | 'facebook' | 'apple';

export function getAppBaseUrl(): string {
  const raw = (process.env.APP_URL || '').trim();
  if (raw && raw !== 'MY_APP_URL') {
    return raw.replace(/\/+$/, '');
  }
  const port = Number(process.env.PORT) || 3000;
  return `http://localhost:${port}`;
}

export function getRedirectUri(provider: OAuthProvider): string {
  return `${getAppBaseUrl()}/api/auth/oauth/${provider}/callback`;
}

export function isProviderConfigured(provider: OAuthProvider): boolean {
  if (provider === 'google') {
    return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
  }
  if (provider === 'facebook') {
    return Boolean(process.env.FACEBOOK_APP_ID?.trim() && process.env.FACEBOOK_APP_SECRET?.trim());
  }
  if (provider === 'apple') {
    const hasSecret = Boolean(process.env.APPLE_CLIENT_SECRET?.trim());
    const hasKeyParts = Boolean(
      process.env.APPLE_TEAM_ID?.trim() &&
        process.env.APPLE_KEY_ID?.trim() &&
        process.env.APPLE_PRIVATE_KEY?.trim()
    );
    return Boolean(process.env.APPLE_CLIENT_ID?.trim() && (hasSecret || hasKeyParts));
  }
  return false;
}

export function getOAuthProvidersStatus() {
  return {
    providers: {
      google: isProviderConfigured('google'),
      facebook: isProviderConfigured('facebook'),
      apple: isProviderConfigured('apple'),
    },
    callbackUrls: {
      google: getRedirectUri('google'),
      facebook: getRedirectUri('facebook'),
      apple: getRedirectUri('apple'),
    },
  };
}

export function buildOAuthAuthorizeUrl(provider: OAuthProvider, state: string): string {
  const redirectUri = getRedirectUri(provider);

  if (provider === 'google') {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      throw new Error(
        `Chưa cấu hình Google OAuth (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET). Callback URL: ${redirectUri}`
      );
    }
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      prompt: 'select_account',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  if (provider === 'facebook') {
    const appId = process.env.FACEBOOK_APP_ID?.trim();
    const appSecret = process.env.FACEBOOK_APP_SECRET?.trim();
    if (!appId || !appSecret) {
      throw new Error(
        `Chưa cấu hình Facebook OAuth (FACEBOOK_APP_ID, FACEBOOK_APP_SECRET). Callback URL: ${redirectUri}`
      );
    }
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'email,public_profile',
      state,
    });
    return `https://www.facebook.com/v20.0/dialog/oauth?${params.toString()}`;
  }

  if (provider === 'apple') {
    const clientId = process.env.APPLE_CLIENT_ID?.trim();
    if (!clientId || !isProviderConfigured('apple')) {
      throw new Error(
        `Chưa cấu hình Apple / iCloud Sign In (APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY). Callback URL: ${redirectUri}`
      );
    }
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      response_mode: 'form_post',
      scope: 'name email',
      state,
    });
    return `https://appleid.apple.com/auth/authorize?${params.toString()}`;
  }

  throw new Error('Nhà cung cấp đăng nhập không hợp lệ.');
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function generateAppleClientSecret(): string {
  const direct = process.env.APPLE_CLIENT_SECRET?.trim();
  if (direct) return direct;

  const teamId = process.env.APPLE_TEAM_ID?.trim() || '';
  const keyId = process.env.APPLE_KEY_ID?.trim() || '';
  const clientId = process.env.APPLE_CLIENT_ID?.trim() || '';
  const rawPrivateKey = (process.env.APPLE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();

  if (!teamId || !keyId || !clientId || !rawPrivateKey) {
    throw new Error('Thiếu thông tin cấu hình Apple Sign In trên máy chủ.');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: teamId,
      iat: now,
      exp: now + 300,
      aud: 'https://appleid.apple.com',
      sub: clientId,
    })
  );

  const signingInput = `${header}.${payload}`;
  const sign = crypto.createSign('SHA256');
  sign.update(signingInput);
  sign.end();
  // Node ECDSA produces DER by default unless dsaEncoding is 'ieee-p1363'
  const signature = sign.sign({ key: rawPrivateKey, dsaEncoding: 'ieee-p1363' });
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split('.');
  if (parts.length < 2) return {};
  const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as Record<string, unknown>;
}

export interface OAuthProfileResult {
  providerUserId: string;
  email?: string;
  fullName?: string;
  avatarUrl?: string;
}

export async function exchangeOAuthCodeForProfile(params: {
  provider: OAuthProvider;
  code: string;
  appleUserJson?: string;
}): Promise<OAuthProfileResult> {
  const redirectUri = getRedirectUri(params.provider);

  if (params.provider === 'google') {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: params.code,
        client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
        client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = (await tokenRes.json().catch(() => ({}))) as Record<string, unknown>;
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(String(tokenData.error_description || tokenData.error || 'Không thể xác thực với Google.'));
    }

    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${String(tokenData.access_token)}` },
    });
    const userInfo = (await userRes.json().catch(() => ({}))) as Record<string, unknown>;
    if (!userRes.ok || !userInfo.sub) {
      throw new Error('Không thể lấy thông tin hồ sơ từ Google.');
    }

    return {
      providerUserId: String(userInfo.sub),
      email: userInfo.email ? String(userInfo.email) : undefined,
      fullName: userInfo.name ? String(userInfo.name) : undefined,
      avatarUrl: userInfo.picture ? String(userInfo.picture) : undefined,
    };
  }

  if (params.provider === 'facebook') {
    const tokenParams = new URLSearchParams({
      client_id: process.env.FACEBOOK_APP_ID!.trim(),
      client_secret: process.env.FACEBOOK_APP_SECRET!.trim(),
      redirect_uri: redirectUri,
      code: params.code,
    });
    const tokenRes = await fetch(
      `https://graph.facebook.com/v20.0/oauth/access_token?${tokenParams.toString()}`
    );
    const tokenData = (await tokenRes.json().catch(() => ({}))) as Record<string, unknown>;
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error('Không thể xác thực với Facebook.');
    }

    const profileParams = new URLSearchParams({
      fields: 'id,name,email,picture.type(large)',
      access_token: String(tokenData.access_token),
    });
    const userRes = await fetch(
      `https://graph.facebook.com/v20.0/me?${profileParams.toString()}`
    );
    const userInfo = (await userRes.json().catch(() => ({}))) as {
      id?: string;
      name?: string;
      email?: string;
      picture?: { data?: { url?: string } };
    };
    if (!userRes.ok || !userInfo.id) {
      throw new Error('Không thể lấy thông tin tài khoản Facebook.');
    }

    return {
      providerUserId: String(userInfo.id),
      email: userInfo.email,
      fullName: userInfo.name,
      avatarUrl: userInfo.picture?.data?.url,
    };
  }

  if (params.provider === 'apple') {
    const clientSecret = generateAppleClientSecret();
    const tokenRes = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.APPLE_CLIENT_ID!.trim(),
        client_secret: clientSecret,
        code: params.code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = (await tokenRes.json().catch(() => ({}))) as Record<string, unknown>;
    if (!tokenRes.ok || !tokenData.id_token) {
      throw new Error(String(tokenData.error_description || tokenData.error || 'Không thể xác thực với Apple / iCloud.'));
    }

    const claims = decodeJwtPayload(String(tokenData.id_token));
    const sub = claims.sub ? String(claims.sub) : '';
    if (!sub) {
      throw new Error('Không tìm thấy định danh Apple ID.');
    }

    let parsedName: string | undefined;
    if (params.appleUserJson) {
      try {
        const u = JSON.parse(params.appleUserJson) as {
          name?: { firstName?: string; lastName?: string };
        };
        const full = [u.name?.lastName, u.name?.firstName].filter(Boolean).join(' ').trim();
        if (full) parsedName = full;
      } catch {
        // ignore invalid user payload
      }
    }

    return {
      providerUserId: sub,
      email: claims.email ? String(claims.email) : undefined,
      fullName: parsedName,
    };
  }

  throw new Error('Nhà cung cấp OAuth không được hỗ trợ.');
}

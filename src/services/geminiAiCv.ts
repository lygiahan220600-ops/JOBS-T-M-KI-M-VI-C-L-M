import type { AICVData, CVLanguage, CVTemplateId } from '../types';
import { getStoredToken } from './api';

export interface GenerateAICvInput {
  fullName: string;
  dateOfBirth?: string;
  phone: string;
  email: string;
  address: string;
  avatarUrl?: string;
  targetJob: string;
  bio?: string;
  strengths?: string[];
  hardSkills?: string[];
  softSkills?: string[];
  education?: Array<{
    school: string;
    major: string;
    year: string;
    degree?: string;
    gpa?: string;
  }>;
  experience?: Array<{
    company: string;
    role: string;
    duration: string;
    description: string;
  }>;
  certifications?: string[];
  projects?: Array<{
    name: string;
    role: string;
    description: string;
  }>;
  activities?: string[];
  languages?: string[];
  references?: string;
  cvLanguage: CVLanguage;
  template: CVTemplateId;
}

export async function generateAICv(payload: GenerateAICvInput): Promise<AICVData> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch('/api/ai/generate-cv', {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Không thể tạo CV bằng AI. Vui lòng thử lại.');
  }
  return data.cv as AICVData;
}

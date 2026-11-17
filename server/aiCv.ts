import { GoogleGenAI, Type } from '@google/genai';
import type { AICVData, CVLanguage, CVTemplateId } from '../src/types.ts';

export interface GenerateCvPayload {
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

const LANGUAGE_LABELS: Record<CVLanguage, string> = {
  vi: 'Tiếng Việt (Vietnamese)',
  en: 'English',
  ko: '한국어 (Korean)',
};

export async function generateCvWithGemini(input: GenerateCvPayload): Promise<AICVData> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'Chưa cấu hình GEMINI_API_KEY trên máy chủ. Vui lòng thiết lập GEMINI_API_KEY trong Settings > Secrets hoặc biến môi trường để sử dụng AI viết CV.'
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const targetLangName = LANGUAGE_LABELS[input.cvLanguage] || LANGUAGE_LABELS.vi;

  const systemInstruction = `You are a senior career coach and ATS CV editor.
Your task is to polish and structure the user's CV content professionally in ${targetLangName}.

CRITICAL TRUTH & ANTI-HALLUCINATION RULES:
1. You MUST use ONLY the factual information provided by the user (schools, degrees, companies, job roles, durations, projects, certificates, activities, languages, references).
2. NEVER invent, fabricate, or add degrees, GPAs, employers, job titles, certificates, or awards that the user did not provide.
3. If the user left experience, certifications, projects, activities, languages, or references empty, keep those arrays empty (do NOT make up fake entries!).
4. You MAY professionally rewrite, translate into ${targetLangName}, and improve clarity/ATS phrasing of the user's provided summary, career objective, strengths, and experience descriptions without changing the facts.
5. Check spelling, grammar, and clarity of the user's input and return constructive grammarNotes and improvementTips in ${targetLangName}.`;

  const userPrompt = `Dữ liệu ứng viên cung cấp (Ngôn ngữ đầu ra yêu cầu: ${targetLangName}):
${JSON.stringify(
  {
    fullName: input.fullName,
    dateOfBirth: input.dateOfBirth || '',
    phone: input.phone,
    email: input.email,
    address: input.address,
    targetJob: input.targetJob,
    bio: input.bio || '',
    strengths: input.strengths || [],
    hardSkills: input.hardSkills || [],
    softSkills: input.softSkills || [],
    education: input.education || [],
    experience: input.experience || [],
    certifications: input.certifications || [],
    projects: input.projects || [],
    activities: input.activities || [],
    languages: input.languages || [],
    references: input.references || '',
  },
  null,
  2
)}

Hãy:
1. Viết phần "summary" (giới thiệu bản thân chuyên nghiệp) và "careerObjective" (mục tiêu nghề nghiệp phù hợp với vị trí ${input.targetJob}) bằng ${targetLangName}.
2. Diễn đạt lại rõ ràng, chuyên nghiệp các mô tả kinh nghiệm làm việc mà người dùng đã nhập (nếu người dùng không nhập kinh nghiệm nào thì trả về mảng rỗng []).
3. Sắp xếp kỹ năng chuyên môn ("skills"), kỹ năng mềm ("softSkills"), điểm mạnh ("strengths") dựa đúng trên dữ liệu người dùng cung cấp.
4. Giữ nguyên tính xác thực cho education, projects, certifications, activities, languages, references (chỉ dịch/chuẩn hóa câu chữ sang ${targetLangName}, tuyệt đối không bịa thêm).
5. Kiểm tra lỗi chính tả/ngữ pháp và đề xuất cải thiện trong "aiFeedback".`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: userPrompt,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          careerObjective: { type: Type.STRING },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          skills: { type: Type.ARRAY, items: { type: Type.STRING } },
          softSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
          education: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                school: { type: Type.STRING },
                major: { type: Type.STRING },
                year: { type: Type.STRING },
                degree: { type: Type.STRING },
                gpa: { type: Type.STRING },
              },
              required: ['school', 'major', 'year'],
            },
          },
          experience: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                role: { type: Type.STRING },
                company: { type: Type.STRING },
                duration: { type: Type.STRING },
                highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ['role', 'company', 'duration', 'highlights'],
            },
          },
          projects: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                role: { type: Type.STRING },
                description: { type: Type.STRING },
              },
              required: ['name', 'role', 'description'],
            },
          },
          certifications: { type: Type.ARRAY, items: { type: Type.STRING } },
          activities: { type: Type.ARRAY, items: { type: Type.STRING } },
          languages: { type: Type.ARRAY, items: { type: Type.STRING } },
          references: { type: Type.STRING },
          aiFeedback: {
            type: Type.OBJECT,
            properties: {
              grammarNotes: { type: Type.ARRAY, items: { type: Type.STRING } },
              improvementTips: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['grammarNotes', 'improvementTips'],
          },
        },
        required: [
          'summary',
          'careerObjective',
          'skills',
          'education',
          'experience',
          'projects',
          'certifications',
          'activities',
          'aiFeedback',
        ],
      },
    },
  });

  const text = (response.text ?? '').trim();
  if (!text) {
    throw new Error('AI không trả về dữ liệu CV. Vui lòng thử lại.');
  }

  const parsed = JSON.parse(text);

  return {
    fullName: input.fullName.trim(),
    targetJob: input.targetJob.trim(),
    dateOfBirth: input.dateOfBirth || '',
    email: input.email.trim(),
    phone: input.phone.trim(),
    address: input.address.trim(),
    avatarUrl: input.avatarUrl || '',
    summary: String(parsed.summary || input.bio || ''),
    careerObjective: String(parsed.careerObjective || ''),
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : input.strengths || [],
    skills: Array.isArray(parsed.skills) ? parsed.skills : input.hardSkills || [],
    softSkills: Array.isArray(parsed.softSkills) ? parsed.softSkills : input.softSkills || [],
    education: Array.isArray(parsed.education) ? parsed.education : [],
    experience: Array.isArray(parsed.experience) ? parsed.experience : [],
    projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    certifications: Array.isArray(parsed.certifications) ? parsed.certifications : [],
    activities: Array.isArray(parsed.activities) ? parsed.activities : [],
    languages: Array.isArray(parsed.languages) ? parsed.languages : input.languages || [],
    references: typeof parsed.references === 'string' ? parsed.references : input.references || '',
    template: input.template,
    cvLanguage: input.cvLanguage,
    aiFeedback: {
      grammarNotes: Array.isArray(parsed.aiFeedback?.grammarNotes)
        ? parsed.aiFeedback.grammarNotes
        : [],
      improvementTips: Array.isArray(parsed.aiFeedback?.improvementTips)
        ? parsed.aiFeedback.improvementTips
        : [],
    },
  };
}

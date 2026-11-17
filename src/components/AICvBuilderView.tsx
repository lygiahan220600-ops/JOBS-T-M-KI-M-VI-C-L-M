import React, { useState, useRef } from 'react';
import {
  Sparkles,
  Copy,
  FileText,
  User,
  Briefcase,
  GraduationCap,
  Award,
  RefreshCw,
  Palette,
  Printer,
  Save,
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Camera,
  Languages,
  AlertCircle,
  Edit3,
  FolderOpen,
  Lightbulb,
} from 'lucide-react';
import {
  AICVData,
  CVLanguage,
  CVTemplateId,
  Language,
  SavedCVRecord,
  StudentProfile,
  UserAccount,
} from '../types';
import { generateAICv } from '../services/geminiAiCv';

interface AICvBuilderViewProps {
  profile: StudentProfile;
  currentUser: UserAccount | null;
  savedCVs: SavedCVRecord[];
  lang: Language;
  onSaveToProfile: (updatedProfile: Partial<StudentProfile>) => Promise<boolean> | void;
  onSaveCV: (payload: {
    id?: string;
    name: string;
    targetJob: string;
    language: CVLanguage;
    template: CVTemplateId;
    accentColor: string;
    layout: 'single' | 'two-column';
    data: AICVData;
  }) => Promise<SavedCVRecord | null>;
  onDeleteCV: (cvId: string) => Promise<void>;
  onRequireAuth: (msg: string) => void;
  showToast: (msg: string) => void;
}

interface FormEducation {
  id: string;
  school: string;
  major: string;
  degree: string;
  year: string;
  gpa: string;
}

interface FormExperience {
  id: string;
  company: string;
  role: string;
  duration: string;
  description: string;
}

interface FormProject {
  id: string;
  name: string;
  role: string;
  description: string;
}

const CV_TEMPLATES: Array<{ id: CVTemplateId; name: string; desc: string }> = [
  { id: 'minimalist', name: 'Tối giản', desc: 'Tinh gọn, rõ ràng, dễ đọc' },
  { id: 'professional', name: 'Chuyên nghiệp', desc: 'Chuẩn doanh nghiệp, trang nhã' },
  { id: 'modern', name: 'Hiện đại', desc: 'Năng động, điểm nhấn màu sắc' },
  { id: 'fresh-grad', name: 'Sinh viên mới ra trường', desc: 'Nhấn mạnh học vấn & tiềm năng' },
  { id: 'no-exp', name: 'Chưa có kinh nghiệm', desc: 'Ưu tiên kỹ năng, dự án & hoạt động' },
  { id: 'office', name: 'Văn phòng', desc: 'Chỉn chu cho hành chính, nhân sự' },
  { id: 'marketing', name: 'Marketing', desc: 'Sáng tạo, nổi bật thành tích' },
  { id: 'it', name: 'Công nghệ thông tin', desc: 'Tập trung tech stack & dự án' },
  { id: 'bilingual', name: 'Song ngữ', desc: 'Bố cục quốc tế đa ngôn ngữ' },
];

const ACCENT_COLORS = [
  { name: 'Xanh rêu JobsHub', value: '#2F5233' },
  { name: 'Xanh Navy', value: '#1E3A8A' },
  { name: 'Xanh Ngọc', value: '#0F766E' },
  { name: 'Đỏ Đô', value: '#7C2D12' },
  { name: 'Than Chì', value: '#334155' },
];

const CV_LABELS: Record<
  CVLanguage,
  {
    summary: string;
    objective: string;
    education: string;
    experience: string;
    skills: string;
    softSkills: string;
    strengths: string;
    projects: string;
    certifications: string;
    activities: string;
    languages: string;
    references: string;
  }
> = {
  vi: {
    summary: 'Tóm tắt bản thân',
    objective: 'Mục tiêu nghề nghiệp',
    education: 'Học vấn',
    experience: 'Kinh nghiệm làm việc',
    skills: 'Kỹ năng chuyên môn',
    softSkills: 'Kỹ năng mềm',
    strengths: 'Điểm mạnh nổi bật',
    projects: 'Dự án tiêu biểu',
    certifications: 'Chứng chỉ & Khóa học',
    activities: 'Hoạt động ngoại khóa',
    languages: 'Ngôn ngữ',
    references: 'Người tham chiếu',
  },
  en: {
    summary: 'Professional Summary',
    objective: 'Career Objective',
    education: 'Education',
    experience: 'Work Experience',
    skills: 'Hard Skills',
    softSkills: 'Soft Skills',
    strengths: 'Key Strengths',
    projects: 'Projects',
    certifications: 'Certifications',
    activities: 'Extracurricular Activities',
    languages: 'Languages',
    references: 'References',
  },
  ko: {
    summary: '자기소개',
    objective: '지원 동기 및 목표',
    education: '학력 사항',
    experience: '경력 사항',
    skills: '직무 역량',
    softSkills: '소프트 스킬',
    strengths: '강점',
    projects: '프로젝트',
    certifications: '자격증 및 수료',
    activities: '대외 활동',
    languages: '어학 능력',
    references: '추천인',
  },
};

export const AICvBuilderView: React.FC<AICvBuilderViewProps> = ({
  profile,
  currentUser,
  savedCVs,
  onSaveToProfile,
  onSaveCV,
  onDeleteCV,
  onRequireAuth,
  showToast,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Step 1: Personal Info
  const [fullName, setFullName] = useState(profile.fullName || currentUser?.fullName || '');
  const [dateOfBirth, setDateOfBirth] = useState(profile.dateOfBirth || '');
  const [phone, setPhone] = useState(profile.phone || currentUser?.phone || '');
  const [email, setEmail] = useState(profile.email || currentUser?.email || '');
  const [address, setAddress] = useState(profile.address || '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl || currentUser?.avatarUrl || '');
  const [targetJob, setTargetJob] = useState('Thực tập sinh Marketing');

  // Intro & Skills
  const [bio, setBio] = useState(profile.bio || '');
  const [strengthsInput, setStrengthsInput] = useState('Ham học hỏi, Trách nhiệm cao, Làm việc nhóm');
  const [hardSkillsInput, setHardSkillsInput] = useState(
    profile.skills.join(', ') || 'Tin học văn phòng, Canva, Excel'
  );
  const [softSkillsInput, setSoftSkillsInput] = useState('Giao tiếp, Quản lý thời gian, Giải quyết vấn đề');

  // Education (multi-item, skippable)
  const [skipEducation, setSkipEducation] = useState(false);
  const [educationList, setEducationList] = useState<FormEducation[]>(() => {
    if (profile.educationList && profile.educationList.length > 0) {
      return profile.educationList.map((e) => ({
        id: e.id,
        school: e.school,
        major: e.major,
        degree: e.degree || 'Đại học',
        year: e.year,
        gpa: e.gpa || '',
      }));
    }
    return [
      {
        id: 'edu-1',
        school: profile.university || '',
        major: profile.faculty || '',
        degree: 'Cử nhân / Kỹ sư',
        year: profile.graduationYear ? `Đến ${profile.graduationYear}` : '',
        gpa: profile.gpa || '',
      },
    ];
  });

  // Experience (multi-item, skippable for freshers)
  const [noExperience, setNoExperience] = useState(false);
  const [experienceList, setExperienceList] = useState<FormExperience[]>([
    {
      id: 'exp-1',
      company: '',
      role: '',
      duration: '',
      description: '',
    },
  ]);

  // Additional optional sections
  const [skipAdditional, setSkipAdditional] = useState(false);
  const [certificationsInput, setCertificationsInput] = useState('');
  const [activitiesInput, setActivitiesInput] = useState('');
  const [languagesInput, setLanguagesInput] = useState('Tiếng Việt (Bản ngữ), Tiếng Anh (Giao tiếp)');
  const [references, setReferences] = useState('');
  const [projectsList, setProjectsList] = useState<FormProject[]>([]);

  // Step 2 & 3: AI & Design Controls
  const [cvLanguage, setCvLanguage] = useState<CVLanguage>('vi');
  const [selectedTemplate, setSelectedTemplate] = useState<CVTemplateId>('modern');
  const [accentColor, setAccentColor] = useState<string>('#2F5233');
  const [layout, setLayout] = useState<'single' | 'two-column'>('two-column');

  const [isLoading, setIsLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [generatedCv, setGeneratedCv] = useState<AICVData | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Step 4: Save & Manage Saved CVs
  const [editingCvId, setEditingCvId] = useState<string | undefined>(undefined);
  const [cvName, setCvName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteCvId, setConfirmDeleteCvId] = useState<string | null>(null);

  const handleSyncProfile = () => {
    setFullName(profile.fullName || currentUser?.fullName || '');
    setDateOfBirth(profile.dateOfBirth || '');
    setPhone(profile.phone || currentUser?.phone || '');
    setEmail(profile.email || currentUser?.email || '');
    setAddress(profile.address || '');
    setAvatarUrl(profile.avatarUrl || currentUser?.avatarUrl || '');
    if (profile.skills.length > 0) setHardSkillsInput(profile.skills.join(', '));
    if (profile.bio) setBio(profile.bio);
    if (profile.university || profile.faculty) {
      setEducationList([
        {
          id: 'edu-sync',
          school: profile.university || '',
          major: profile.faculty || '',
          degree: 'Đại học / Cao đẳng',
          year: profile.graduationYear || '',
          gpa: profile.gpa || '',
        },
      ]);
      setSkipEducation(false);
    }
    showToast('Đã đồng bộ thông tin từ hồ sơ cá nhân!');
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!currentUser) {
      onRequireAuth('Vui lòng đăng nhập để sử dụng AI viết CV và lưu CV của bạn!');
      return;
    }
    if (!fullName.trim() || !targetJob.trim()) {
      setAiError('Vui lòng nhập Họ và tên và Vị trí ứng tuyển mục tiêu ở Bước 1.');
      setStep(1);
      return;
    }

    setIsLoading(true);
    setAiError(null);
    try {
      const cleanedEdu = skipEducation
        ? []
        : educationList
            .filter((e) => e.school.trim() || e.major.trim())
            .map((e) => ({
              school: e.school.trim(),
              major: e.major.trim(),
              degree: e.degree.trim(),
              year: e.year.trim(),
              gpa: e.gpa.trim(),
            }));

      const cleanedExp = noExperience
        ? []
        : experienceList
            .filter((ex) => ex.company.trim() || ex.role.trim() || ex.description.trim())
            .map((ex) => ({
              company: ex.company.trim(),
              role: ex.role.trim(),
              duration: ex.duration.trim(),
              description: ex.description.trim(),
            }));

      const cleanedProjects = skipAdditional
        ? []
        : projectsList.filter((p) => p.name.trim() || p.description.trim());

      const res = await generateAICv({
        fullName: fullName.trim(),
        dateOfBirth: dateOfBirth.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        avatarUrl,
        targetJob: targetJob.trim(),
        bio: bio.trim(),
        strengths: strengthsInput.split(',').map((s) => s.trim()).filter(Boolean),
        hardSkills: hardSkillsInput.split(',').map((s) => s.trim()).filter(Boolean),
        softSkills: softSkillsInput.split(',').map((s) => s.trim()).filter(Boolean),
        education: cleanedEdu,
        experience: cleanedExp,
        certifications: skipAdditional
          ? []
          : certificationsInput.split('\n').map((s) => s.trim()).filter(Boolean),
        projects: cleanedProjects,
        activities: skipAdditional
          ? []
          : activitiesInput.split('\n').map((s) => s.trim()).filter(Boolean),
        languages: skipAdditional
          ? []
          : languagesInput.split(',').map((s) => s.trim()).filter(Boolean),
        references: skipAdditional ? '' : references.trim(),
        cvLanguage,
        template: selectedTemplate,
      });

      setGeneratedCv({
        ...res,
        avatarUrl: avatarUrl || res.avatarUrl,
        template: selectedTemplate,
        cvLanguage,
      });
      if (!cvName) {
        setCvName(`CV ${targetJob.trim()}`);
      }
      setStep(3);
      showToast('AI đã hoàn thiện CV của bạn thành công!');
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : 'Không thể tạo CV bằng AI. Vui lòng thử lại.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCVRecord = async () => {
    if (!generatedCv) return;
    if (!currentUser) {
      onRequireAuth('Vui lòng đăng nhập để lưu CV vào tài khoản!');
      return;
    }
    setIsSaving(true);
    try {
      const saved = await onSaveCV({
        id: editingCvId,
        name: cvName.trim() || `CV ${generatedCv.targetJob}`,
        targetJob: generatedCv.targetJob,
        language: cvLanguage,
        template: selectedTemplate,
        accentColor,
        layout,
        data: {
          ...generatedCv,
          template: selectedTemplate,
          cvLanguage,
        },
      });
      if (saved) {
        setEditingCvId(saved.id);
        setCvName(saved.name);
        setStep(4);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadSavedCV = (record: SavedCVRecord) => {
    setEditingCvId(record.id);
    setCvName(record.name);
    setCvLanguage(record.language);
    setSelectedTemplate(record.template);
    setAccentColor(record.accentColor || '#2F5233');
    setLayout(record.layout || 'two-column');
    setGeneratedCv(record.data);
    setFullName(record.data.fullName);
    setTargetJob(record.data.targetJob);
    setPhone(record.data.phone);
    setEmail(record.data.email);
    setAddress(record.data.address);
    setAvatarUrl(record.data.avatarUrl || '');
    setStep(3);
    showToast(`Đã mở CV "${record.name}"`);
  };

  const handleCopyText = () => {
    if (!generatedCv) return;
    const text = [
      `${generatedCv.fullName} - ${generatedCv.targetJob}`,
      `${generatedCv.phone} | ${generatedCv.email} | ${generatedCv.address}`,
      '',
      generatedCv.summary,
      generatedCv.careerObjective ? `\n${generatedCv.careerObjective}` : '',
      generatedCv.skills.length ? `\nKỹ năng: ${generatedCv.skills.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
    showToast('Đã sao chép nội dung CV!');
  };

  const handleSyncToProfile = () => {
    if (!generatedCv) return;
    onSaveToProfile({
      fullName: generatedCv.fullName,
      email: generatedCv.email,
      phone: generatedCv.phone,
      address: generatedCv.address,
      avatarUrl: generatedCv.avatarUrl || avatarUrl,
      faculty: generatedCv.education[0]?.major || profile.faculty,
      university: generatedCv.education[0]?.school || profile.university,
      skills: generatedCv.skills,
      bio: generatedCv.summary,
      cvFileName: `${(cvName || generatedCv.targetJob).replace(/\s+/g, '_')}.pdf`,
    });
  };

  const labels = CV_LABELS[cvLanguage];

  const renderCvPreview = () => {
    if (!generatedCv) return null;

    const isTwoCol = layout === 'two-column';
    const isMinimal = selectedTemplate === 'minimalist';
    const isBilingual = selectedTemplate === 'bilingual';
    const headerBgStyle =
      selectedTemplate === 'modern' || selectedTemplate === 'marketing'
        ? { backgroundColor: accentColor, color: '#ffffff' }
        : undefined;

    const LeftSidebarContent = (
      <div className="space-y-4">
        {generatedCv.skills.length > 0 && (
          <div>
            <h4
              className="text-[11px] font-extrabold uppercase tracking-wider pb-1 mb-2 border-b"
              style={{ color: accentColor, borderColor: `${accentColor}40` }}
            >
              {labels.skills}
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {generatedCv.skills.map((sk, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md text-[11px] font-medium border"
                  style={{
                    backgroundColor: `${accentColor}12`,
                    borderColor: `${accentColor}30`,
                    color: accentColor,
                  }}
                >
                  {sk}
                </span>
              ))}
            </div>
          </div>
        )}

        {generatedCv.softSkills && generatedCv.softSkills.length > 0 && (
          <div>
            <h4
              className="text-[11px] font-extrabold uppercase tracking-wider pb-1 mb-1.5 border-b"
              style={{ color: accentColor, borderColor: `${accentColor}40` }}
            >
              {labels.softSkills}
            </h4>
            <ul className="list-disc list-inside text-[11px] text-stone-700 space-y-0.5">
              {generatedCv.softSkills.map((s, idx) => (
                <li key={idx}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        {generatedCv.strengths && generatedCv.strengths.length > 0 && (
          <div>
            <h4
              className="text-[11px] font-extrabold uppercase tracking-wider pb-1 mb-1.5 border-b"
              style={{ color: accentColor, borderColor: `${accentColor}40` }}
            >
              {labels.strengths}
            </h4>
            <ul className="list-disc list-inside text-[11px] text-stone-700 space-y-0.5">
              {generatedCv.strengths.map((s, idx) => (
                <li key={idx}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        {generatedCv.languages && generatedCv.languages.length > 0 && (
          <div>
            <h4
              className="text-[11px] font-extrabold uppercase tracking-wider pb-1 mb-1.5 border-b"
              style={{ color: accentColor, borderColor: `${accentColor}40` }}
            >
              {labels.languages}
            </h4>
            <ul className="text-[11px] text-stone-700 space-y-0.5">
              {generatedCv.languages.map((l, idx) => (
                <li key={idx}>• {l}</li>
              ))}
            </ul>
          </div>
        )}

        {generatedCv.certifications && generatedCv.certifications.length > 0 && (
          <div>
            <h4
              className="text-[11px] font-extrabold uppercase tracking-wider pb-1 mb-1.5 border-b"
              style={{ color: accentColor, borderColor: `${accentColor}40` }}
            >
              {labels.certifications}
            </h4>
            <ul className="list-disc list-inside text-[11px] text-stone-700 space-y-0.5">
              {generatedCv.certifications.map((c, idx) => (
                <li key={idx}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );

    const MainColumnContent = (
      <div className="space-y-4">
        {generatedCv.summary && (
          <div>
            <h4
              className="text-[11px] font-extrabold uppercase tracking-wider pb-1 mb-1.5 border-b"
              style={{ color: accentColor, borderColor: `${accentColor}40` }}
            >
              {labels.summary}
            </h4>
            <p className="text-xs text-stone-700 leading-relaxed text-justify">
              {generatedCv.summary}
            </p>
          </div>
        )}

        {generatedCv.careerObjective && (
          <div>
            <h4
              className="text-[11px] font-extrabold uppercase tracking-wider pb-1 mb-1.5 border-b"
              style={{ color: accentColor, borderColor: `${accentColor}40` }}
            >
              {labels.objective}
            </h4>
            <p className="text-xs text-stone-700 leading-relaxed">
              {generatedCv.careerObjective}
            </p>
          </div>
        )}

        {generatedCv.education && generatedCv.education.length > 0 && (
          <div>
            <h4
              className="text-[11px] font-extrabold uppercase tracking-wider pb-1 mb-1.5 border-b"
              style={{ color: accentColor, borderColor: `${accentColor}40` }}
            >
              {labels.education}
            </h4>
            <div className="space-y-2">
              {generatedCv.education.map((edu, idx) => (
                <div key={idx} className="flex items-start justify-between gap-2 text-xs">
                  <div>
                    <p className="font-bold text-stone-900">{edu.school}</p>
                    <p className="text-stone-600">
                      {edu.degree ? `${edu.degree} — ` : ''}
                      {edu.major}
                    </p>
                  </div>
                  <div className="text-right text-[11px] text-stone-500 shrink-0">
                    <p>{edu.year}</p>
                    {edu.gpa && (
                      <p className="font-semibold" style={{ color: accentColor }}>
                        GPA: {edu.gpa}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {generatedCv.experience && generatedCv.experience.length > 0 && (
          <div>
            <h4
              className="text-[11px] font-extrabold uppercase tracking-wider pb-1 mb-1.5 border-b"
              style={{ color: accentColor, borderColor: `${accentColor}40` }}
            >
              {labels.experience}
            </h4>
            <div className="space-y-2.5">
              {generatedCv.experience.map((exp, idx) => (
                <div key={idx} className="text-xs">
                  <div className="flex items-center justify-between gap-2 font-bold">
                    <span className="text-stone-900">
                      {exp.role} {exp.company ? `• ${exp.company}` : ''}
                    </span>
                    <span className="text-[11px] font-normal text-stone-500 shrink-0">
                      {exp.duration}
                    </span>
                  </div>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-stone-700">
                    {exp.highlights.map((h, hIdx) => (
                      <li key={hIdx}>{h}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {generatedCv.projects && generatedCv.projects.length > 0 && (
          <div>
            <h4
              className="text-[11px] font-extrabold uppercase tracking-wider pb-1 mb-1.5 border-b"
              style={{ color: accentColor, borderColor: `${accentColor}40` }}
            >
              {labels.projects}
            </h4>
            <div className="space-y-2">
              {generatedCv.projects.map((p, idx) => (
                <div key={idx} className="text-xs">
                  <p className="font-bold text-stone-900">
                    {p.name} {p.role ? <span className="font-normal text-stone-600">({p.role})</span> : null}
                  </p>
                  <p className="text-stone-700 mt-0.5">{p.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {generatedCv.activities && generatedCv.activities.length > 0 && (
          <div>
            <h4
              className="text-[11px] font-extrabold uppercase tracking-wider pb-1 mb-1.5 border-b"
              style={{ color: accentColor, borderColor: `${accentColor}40` }}
            >
              {labels.activities}
            </h4>
            <ul className="list-disc list-inside text-xs text-stone-700 space-y-0.5">
              {generatedCv.activities.map((a, idx) => (
                <li key={idx}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        {generatedCv.references && (
          <div>
            <h4
              className="text-[11px] font-extrabold uppercase tracking-wider pb-1 mb-1 border-b"
              style={{ color: accentColor, borderColor: `${accentColor}40` }}
            >
              {labels.references}
            </h4>
            <p className="text-xs text-stone-700">{generatedCv.references}</p>
          </div>
        )}
      </div>
    );

    return (
      <div
        id="cv-printable-area"
        className={`bg-white rounded-3xl border shadow-sm overflow-hidden text-stone-800 ${
          isMinimal ? 'font-mono border-stone-300' : 'border-[#E8E2D5]'
        }`}
      >
        {/* CV Header */}
        <div
          className="p-6 sm:p-7 border-b"
          style={
            headerBgStyle || {
              borderColor: `${accentColor}30`,
              backgroundColor: isBilingual ? '#FAF7F2' : '#FFFFFF',
            }
          }
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {generatedCv.avatarUrl && (
                <img
                  src={generatedCv.avatarUrl}
                  alt={generatedCv.fullName}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-white/60 shadow-xs shrink-0"
                />
              )}
              <div>
                <h2
                  className={`text-xl sm:text-2xl font-black tracking-tight font-display ${
                    headerBgStyle ? 'text-white' : 'text-stone-900'
                  }`}
                >
                  {generatedCv.fullName}
                </h2>
                <p
                  className="text-xs sm:text-sm font-bold uppercase tracking-wide mt-0.5"
                  style={{ color: headerBgStyle ? '#E5EDE6' : accentColor }}
                >
                  {generatedCv.targetJob}
                </p>
              </div>
            </div>

            <div
              className={`text-xs space-y-0.5 sm:text-right ${
                headerBgStyle ? 'text-white/90' : 'text-stone-600'
              }`}
            >
              <p>
                {generatedCv.phone} • {generatedCv.email}
              </p>
              {generatedCv.dateOfBirth && <p>Ngày sinh: {generatedCv.dateOfBirth}</p>}
              {generatedCv.address && <p>{generatedCv.address}</p>}
            </div>
          </div>
        </div>

        {/* CV Body */}
        <div className="p-6 sm:p-7">
          {isTwoCol ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-4 bg-[#FAF7F2]/80 rounded-2xl p-4 border border-[#E8E2D5]/70">
                {LeftSidebarContent}
              </div>
              <div className="md:col-span-8">{MainColumnContent}</div>
            </div>
          ) : (
            <div className="space-y-5">
              {MainColumnContent}
              {LeftSidebarContent}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full px-3 sm:px-6 py-4 pb-28 space-y-5">
      {/* Top Banner (hidden when printing) */}
      <div className="no-print bg-gradient-to-br from-[#1E3821] via-[#2F5233] to-[#3B5E3C] rounded-3xl p-4 sm:p-6 text-white shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold text-[#FAF7F2] mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Tạo CV bằng AI & Xuất PDF chuẩn ATS</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black font-display tracking-tight text-white">
              Trình tạo CV thông minh với Gemini AI
            </h1>
            <p className="text-xs sm:text-sm text-[#FAF7F2]/90 mt-1 max-w-2xl">
              AI viết CV dựa trên dữ liệu thật của bạn bằng Tiếng Việt, Tiếng Anh hoặc Tiếng Hàn — tuyệt đối không bịa đặt bằng cấp hay kinh nghiệm.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSyncProfile}
            className="px-3.5 py-2 bg-white/15 hover:bg-white/25 text-xs font-bold rounded-xl text-white transition-all border border-white/20 self-start sm:self-auto shrink-0"
          >
            Đồng bộ từ hồ sơ cá nhân
          </button>
        </div>

        {/* 4-Step Progress Bar */}
        <div className="mt-5 grid grid-cols-4 gap-2">
          {[
            { num: 1 as const, label: '1. Nhập thông tin' },
            { num: 2 as const, label: '2. Ngôn ngữ & AI' },
            { num: 3 as const, label: '3. Chọn mẫu & Sửa' },
            { num: 4 as const, label: '4. Lưu & Xuất PDF' },
          ].map((item) => {
            const active = step === item.num;
            const done = step > item.num;
            return (
              <button
                key={item.num}
                type="button"
                onClick={() => {
                  if (item.num >= 3 && !generatedCv) return;
                  setStep(item.num);
                }}
                className={`py-2 px-2.5 rounded-xl text-[11px] font-bold transition-all text-center border ${
                  active
                    ? 'bg-white text-[#2F5233] border-white shadow-xs'
                    : done
                    ? 'bg-white/20 text-white border-white/30'
                    : 'bg-black/15 text-white/70 border-white/10'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Saved CVs Quick Shelf (hidden when printing) */}
      {savedCVs.length > 0 && (
        <div className="no-print bg-white border border-[#E8E2D5] rounded-2xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
              <FolderOpen className="w-4 h-4 text-[#2F5233]" />
              <span>CV đã lưu trong tài khoản ({savedCVs.length})</span>
            </h2>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {savedCVs.map((cv) => (
              <div
                key={cv.id}
                className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border text-xs ${
                  editingCvId === cv.id
                    ? 'bg-[#EBF2EB] border-[#2F5233]'
                    : 'bg-[#FAF7F2] border-[#E8E2D5]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleLoadSavedCV(cv)}
                  className="text-left"
                >
                  <p className="font-bold text-stone-900">{cv.name}</p>
                  <p className="text-[10px] text-stone-600">
                    {cv.language.toUpperCase()} • {cv.template}
                  </p>
                </button>
                {confirmDeleteCvId === cv.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteCV(cv.id);
                      if (editingCvId === cv.id) setEditingCvId(undefined);
                      setConfirmDeleteCvId(null);
                    }}
                    className="px-2 py-0.5 bg-rose-600 text-white rounded-md text-[10px] font-bold"
                  >
                    Xóa
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteCvId(cv.id)}
                    className="p-1 text-stone-500 hover:text-rose-600"
                    title="Xóa CV này"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {aiError && (
        <div className="no-print p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-semibold flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{aiError}</span>
        </div>
      )}

      {/* STEP 1: INPUT FORM */}
      {step === 1 && (
        <div className="no-print bg-white border border-[#E8E2D5] rounded-3xl p-4 sm:p-6 shadow-xs space-y-6 text-xs">
          {/* 1. Personal Info */}
          <div className="space-y-3">
            <h2 className="text-sm font-extrabold text-stone-900 flex items-center gap-2 border-b border-[#E8E2D5] pb-2">
              <User className="w-4 h-4 text-[#2F5233]" />
              <span>Thông tin cá nhân & Vị trí mục tiêu</span>
            </h2>

            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-[#FAF7F2] border border-[#E8E2D5] flex items-center justify-center shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-7 h-7 text-stone-400" />
                )}
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl font-semibold text-stone-700 hover:bg-[#EBF2EB]"
                >
                  <Camera className="w-3.5 h-3.5 text-[#2F5233]" />
                  <span>Tải ảnh chân dung (tùy chọn)</span>
                </button>
                <input
                  type="file"
                  ref={avatarInputRef}
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Họ và tên <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:border-[#2F5233] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Vị trí ứng tuyển mục tiêu <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={targetJob}
                  onChange={(e) => setTargetJob(e.target.value)}
                  placeholder="VD: Thực tập sinh Marketing, Lập trình Frontend..."
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:border-[#2F5233] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-stone-700 mb-1">Ngày sinh</label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:border-[#2F5233] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-stone-700 mb-1">Số điện thoại</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09xx xxx xxx"
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:border-[#2F5233] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-stone-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@gmail.com"
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:border-[#2F5233] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-stone-700 mb-1">Địa chỉ</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Quận, Thành phố"
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:border-[#2F5233] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 2. Intro & Skills */}
          <div className="space-y-3">
            <h2 className="text-sm font-extrabold text-stone-900 flex items-center gap-2 border-b border-[#E8E2D5] pb-2">
              <Award className="w-4 h-4 text-[#2F5233]" />
              <span>Giới thiệu bản thân & Kỹ năng</span>
            </h2>
            <div>
              <label className="block font-bold text-stone-700 mb-1">
                Mô tả bản thân & Mục tiêu nghề nghiệp
              </label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Chia sẻ ngắn gọn định hướng và sự phù hợp của bạn..."
                className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:border-[#2F5233] focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Kỹ năng chuyên môn (dấu phẩy)
                </label>
                <input
                  type="text"
                  value={hardSkillsInput}
                  onChange={(e) => setHardSkillsInput(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:border-[#2F5233] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Kỹ năng mềm (dấu phẩy)
                </label>
                <input
                  type="text"
                  value={softSkillsInput}
                  onChange={(e) => setSoftSkillsInput(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:border-[#2F5233] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Điểm mạnh (dấu phẩy)
                </label>
                <input
                  type="text"
                  value={strengthsInput}
                  onChange={(e) => setStrengthsInput(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:border-[#2F5233] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 3. Education */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#E8E2D5] pb-2">
              <h2 className="text-sm font-extrabold text-stone-900 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-[#2F5233]" />
                <span>Học vấn</span>
              </h2>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipEducation}
                  onChange={(e) => setSkipEducation(e.target.checked)}
                />
                <span>Bỏ qua phần học vấn</span>
              </label>
            </div>

            {!skipEducation && (
              <div className="space-y-3">
                {educationList.map((edu, idx) => (
                  <div
                    key={edu.id}
                    className="p-3 bg-[#FAF7F2] border border-[#E8E2D5] rounded-2xl space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#2F5233]">Học vấn #{idx + 1}</span>
                      {educationList.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setEducationList((prev) => prev.filter((item) => item.id !== edu.id))
                          }
                          className="text-stone-500 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={edu.school}
                        onChange={(e) =>
                          setEducationList((prev) =>
                            prev.map((item) =>
                              item.id === edu.id ? { ...item, school: e.target.value } : item
                            )
                          )
                        }
                        placeholder="Tên trường Đại học / Cao đẳng..."
                        className="px-3 py-2 bg-white border border-[#E8E2D5] rounded-xl"
                      />
                      <input
                        type="text"
                        value={edu.major}
                        onChange={(e) =>
                          setEducationList((prev) =>
                            prev.map((item) =>
                              item.id === edu.id ? { ...item, major: e.target.value } : item
                            )
                          )
                        }
                        placeholder="Chuyên ngành học..."
                        className="px-3 py-2 bg-white border border-[#E8E2D5] rounded-xl"
                      />
                      <input
                        type="text"
                        value={edu.year}
                        onChange={(e) =>
                          setEducationList((prev) =>
                            prev.map((item) =>
                              item.id === edu.id ? { ...item, year: e.target.value } : item
                            )
                          )
                        }
                        placeholder="Niên khóa (VD: 2022 - 2026)"
                        className="px-3 py-2 bg-white border border-[#E8E2D5] rounded-xl"
                      />
                      <input
                        type="text"
                        value={edu.gpa}
                        onChange={(e) =>
                          setEducationList((prev) =>
                            prev.map((item) =>
                              item.id === edu.id ? { ...item, gpa: e.target.value } : item
                            )
                          )
                        }
                        placeholder="GPA / Xếp loại (tùy chọn)"
                        className="px-3 py-2 bg-white border border-[#E8E2D5] rounded-xl"
                      />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setEducationList((prev) => [
                      ...prev,
                      {
                        id: 'edu-' + Date.now(),
                        school: '',
                        major: '',
                        degree: 'Đại học / Cao đẳng',
                        year: '',
                        gpa: '',
                      },
                    ])
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#EBF2EB] text-[#2F5233] font-bold rounded-xl"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm trường / bằng cấp</span>
                </button>
              </div>
            )}
          </div>

          {/* 4. Work Experience */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#E8E2D5] pb-2">
              <h2 className="text-sm font-extrabold text-stone-900 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#2F5233]" />
                <span>Kinh nghiệm làm việc</span>
              </h2>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={noExperience}
                  onChange={(e) => setNoExperience(e.target.checked)}
                />
                <span>Chưa có kinh nghiệm (Bỏ qua)</span>
              </label>
            </div>

            {!noExperience && (
              <div className="space-y-3">
                {experienceList.map((exp, idx) => (
                  <div
                    key={exp.id}
                    className="p-3 bg-[#FAF7F2] border border-[#E8E2D5] rounded-2xl space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#2F5233]">Kinh nghiệm #{idx + 1}</span>
                      {experienceList.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setExperienceList((prev) => prev.filter((item) => item.id !== exp.id))
                          }
                          className="text-stone-500 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={exp.role}
                        onChange={(e) =>
                          setExperienceList((prev) =>
                            prev.map((item) =>
                              item.id === exp.id ? { ...item, role: e.target.value } : item
                            )
                          )
                        }
                        placeholder="Vị trí (VD: Thực tập sinh)"
                        className="px-3 py-2 bg-white border border-[#E8E2D5] rounded-xl"
                      />
                      <input
                        type="text"
                        value={exp.company}
                        onChange={(e) =>
                          setExperienceList((prev) =>
                            prev.map((item) =>
                              item.id === exp.id ? { ...item, company: e.target.value } : item
                            )
                          )
                        }
                        placeholder="Tên công ty / cửa hàng"
                        className="px-3 py-2 bg-white border border-[#E8E2D5] rounded-xl"
                      />
                      <input
                        type="text"
                        value={exp.duration}
                        onChange={(e) =>
                          setExperienceList((prev) =>
                            prev.map((item) =>
                              item.id === exp.id ? { ...item, duration: e.target.value } : item
                            )
                          )
                        }
                        placeholder="Thời gian (VD: 06/2025 - 09/2025)"
                        className="px-3 py-2 bg-white border border-[#E8E2D5] rounded-xl"
                      />
                    </div>
                    <textarea
                      rows={2}
                      value={exp.description}
                      onChange={(e) =>
                        setExperienceList((prev) =>
                          prev.map((item) =>
                            item.id === exp.id ? { ...item, description: e.target.value } : item
                          )
                        )
                      }
                      placeholder="Công việc thực tế bạn đã làm và kết quả đạt được..."
                      className="w-full px-3 py-2 bg-white border border-[#E8E2D5] rounded-xl"
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setExperienceList((prev) => [
                      ...prev,
                      {
                        id: 'exp-' + Date.now(),
                        company: '',
                        role: '',
                        duration: '',
                        description: '',
                      },
                    ])
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#EBF2EB] text-[#2F5233] font-bold rounded-xl"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm kinh nghiệm</span>
                </button>
              </div>
            )}
          </div>

          {/* 5. Optional Additional Info */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#E8E2D5] pb-2">
              <h2 className="text-sm font-extrabold text-stone-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#2F5233]" />
                <span>Thông tin bổ sung (Chứng chỉ, Dự án, Hoạt động, Ngôn ngữ)</span>
              </h2>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipAdditional}
                  onChange={(e) => setSkipAdditional(e.target.checked)}
                />
                <span>Bỏ qua mục bổ sung</span>
              </label>
            </div>

            {!skipAdditional && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      Chứng chỉ (mỗi dòng 1 mục)
                    </label>
                    <textarea
                      rows={2}
                      value={certificationsInput}
                      onChange={(e) => setCertificationsInput(e.target.value)}
                      placeholder="VD: IELTS 6.5, MOS Excel..."
                      className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      Hoạt động ngoại khóa (mỗi dòng 1 mục)
                    </label>
                    <textarea
                      rows={2}
                      value={activitiesInput}
                      onChange={(e) => setActivitiesInput(e.target.value)}
                      placeholder="VD: CLB Truyền thông sinh viên..."
                      className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      Ngôn ngữ (cách nhau dấu phẩy)
                    </label>
                    <input
                      type="text"
                      value={languagesInput}
                      onChange={(e) => setLanguagesInput(e.target.value)}
                      className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      Người tham chiếu (nếu có)
                    </label>
                    <input
                      type="text"
                      value={references}
                      onChange={(e) => setReferences(e.target.value)}
                      placeholder="Tên, chức vụ, liên hệ..."
                      className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl"
                    />
                  </div>
                </div>

                {/* Projects */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-700">Dự án cá nhân / đồ án môn học</span>
                    <button
                      type="button"
                      onClick={() =>
                        setProjectsList((prev) => [
                          ...prev,
                          { id: 'prj-' + Date.now(), name: '', role: '', description: '' },
                        ])
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#EBF2EB] text-[#2F5233] font-bold rounded-lg"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Thêm dự án</span>
                    </button>
                  </div>
                  {projectsList.map((prj) => (
                    <div
                      key={prj.id}
                      className="p-2.5 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-2"
                    >
                      <input
                        type="text"
                        value={prj.name}
                        onChange={(e) =>
                          setProjectsList((prev) =>
                            prev.map((x) => (x.id === prj.id ? { ...x, name: e.target.value } : x))
                          )
                        }
                        placeholder="Tên dự án..."
                        className="px-2.5 py-1.5 bg-white border border-[#E8E2D5] rounded-lg"
                      />
                      <input
                        type="text"
                        value={prj.role}
                        onChange={(e) =>
                          setProjectsList((prev) =>
                            prev.map((x) => (x.id === prj.id ? { ...x, role: e.target.value } : x))
                          )
                        }
                        placeholder="Vai trò của bạn..."
                        className="px-2.5 py-1.5 bg-white border border-[#E8E2D5] rounded-lg"
                      />
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={prj.description}
                          onChange={(e) =>
                            setProjectsList((prev) =>
                              prev.map((x) =>
                                x.id === prj.id ? { ...x, description: e.target.value } : x
                              )
                            )
                          }
                          placeholder="Mô tả kết quả..."
                          className="flex-1 px-2.5 py-1.5 bg-white border border-[#E8E2D5] rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setProjectsList((prev) => prev.filter((x) => x.id !== prj.id))
                          }
                          className="p-1.5 text-stone-500 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                if (!fullName.trim() || !targetJob.trim()) {
                  setAiError('Vui lòng nhập Họ tên và Vị trí ứng tuyển mục tiêu.');
                  return;
                }
                setAiError(null);
                setStep(2);
              }}
              className="inline-flex items-center gap-1.5 px-6 py-3 bg-[#2F5233] hover:bg-[#244127] text-white font-bold rounded-2xl shadow-sm"
            >
              <span>Tiếp tục: Chọn ngôn ngữ & Tạo CV AI</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: LANGUAGE & GENERATE */}
      {step === 2 && (
        <div className="no-print bg-white border border-[#E8E2D5] rounded-3xl p-5 sm:p-6 shadow-xs space-y-5 text-xs">
          <div className="space-y-2">
            <h2 className="text-sm font-extrabold text-stone-900 flex items-center gap-2">
              <Languages className="w-4 h-4 text-[#2F5233]" />
              <span>Chọn ngôn ngữ xuất CV</span>
            </h2>
            <div className="grid grid-cols-3 gap-2.5">
              {(
                [
                  { code: 'vi', label: 'Tiếng Việt' },
                  { code: 'en', label: 'English' },
                  { code: 'ko', label: '한국어 (Tiếng Hàn)' },
                ] as const
              ).map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => setCvLanguage(item.code)}
                  className={`py-3 px-3 rounded-2xl border font-bold text-xs transition-all ${
                    cvLanguage === item.code
                      ? 'bg-[#2F5233] text-white border-[#2F5233] shadow-xs'
                      : 'bg-[#FAF7F2] border-[#E8E2D5] text-stone-700 hover:bg-[#F2ECE1]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-extrabold text-stone-900 flex items-center gap-2">
              <Palette className="w-4 h-4 text-[#2F5233]" />
              <span>Chọn phong cách mẫu CV ban đầu (9 mẫu)</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {CV_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => setSelectedTemplate(tmpl.id)}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    selectedTemplate === tmpl.id
                      ? 'bg-[#EBF2EB] border-[#2F5233] ring-1 ring-[#2F5233]'
                      : 'bg-[#FAF7F2] border-[#E8E2D5] hover:bg-white'
                  }`}
                >
                  <p className="font-bold text-stone-900">{tmpl.name}</p>
                  <p className="text-[11px] text-stone-600 mt-0.5">{tmpl.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="p-3.5 bg-[#FAF7F2] border border-[#E8E2D5] rounded-2xl text-stone-700 leading-relaxed">
            <strong className="text-[#2F5233]">Cam kết AI trung thực:</strong> Gemini AI sẽ biên tập câu chữ chuyên nghiệp, sửa lỗi chính tả, tối ưu từ khóa theo vị trí <strong>{targetJob}</strong> dựa hoàn toàn trên thông tin bạn đã cung cấp — không tự ý thêm bằng cấp, kinh nghiệm hay chứng chỉ không có thật.
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl border border-[#E8E2D5] text-stone-700 font-semibold"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Quay lại chỉnh thông tin</span>
            </button>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#2F5233] hover:bg-[#244127] disabled:opacity-60 text-white font-bold rounded-2xl shadow-md transition-all"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Gemini AI đang viết CV...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Tạo CV bằng Gemini AI</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 & 4: PREVIEW, CUSTOMIZE, INLINE EDIT, SAVE & PRINT PDF */}
      {(step === 3 || step === 4) && generatedCv && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Controls Column (Hidden during print) */}
          <div className="no-print lg:col-span-4 space-y-4">
            <div className="bg-white border border-[#E8E2D5] rounded-3xl p-4 shadow-2xs space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-[#E8E2D5] pb-2">
                <span className="font-extrabold text-stone-900 flex items-center gap-1.5">
                  <Palette className="w-4 h-4 text-[#2F5233]" />
                  <span>Mẫu, Màu sắc & Bố cục</span>
                </span>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-[11px] font-bold text-[#2F5233] hover:underline"
                >
                  Nhập lại
                </button>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1.5">9 Mẫu CV</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {CV_TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTemplate(t.id)}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border text-left truncate ${
                        selectedTemplate === t.id
                          ? 'bg-[#2F5233] text-white border-[#2F5233]'
                          : 'bg-[#FAF7F2] border-[#E8E2D5] text-stone-700'
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1.5">Màu nhấn</label>
                <div className="flex items-center gap-2">
                  {ACCENT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setAccentColor(c.value)}
                      title={c.name}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        accentColor === c.value ? 'scale-110 border-stone-900' : 'border-white'
                      }`}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1.5">Bố cục trang</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLayout('two-column')}
                    className={`py-2 rounded-xl font-bold border ${
                      layout === 'two-column'
                        ? 'bg-[#2F5233] text-white border-[#2F5233]'
                        : 'bg-[#FAF7F2] border-[#E8E2D5] text-stone-700'
                    }`}
                  >
                    2 cột hiện đại
                  </button>
                  <button
                    type="button"
                    onClick={() => setLayout('single')}
                    className={`py-2 rounded-xl font-bold border ${
                      layout === 'single'
                        ? 'bg-[#2F5233] text-white border-[#2F5233]'
                        : 'bg-[#FAF7F2] border-[#E8E2D5] text-stone-700'
                    }`}
                  >
                    1 cột chuẩn ATS
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditMode(!editMode)}
                className={`w-full py-2.5 rounded-xl font-bold border flex items-center justify-center gap-1.5 ${
                  editMode
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : 'bg-[#FAF7F2] border-[#E8E2D5] text-stone-800'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{editMode ? 'Đóng chế độ sửa nội dung' : 'Chỉnh sửa nội dung CV trực tiếp'}</span>
              </button>

              {editMode && (
                <div className="p-3 bg-[#FAF7F2] border border-[#E8E2D5] rounded-2xl space-y-2.5">
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">Họ tên</label>
                    <input
                      type="text"
                      value={generatedCv.fullName}
                      onChange={(e) =>
                        setGeneratedCv({ ...generatedCv, fullName: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E8E2D5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">Vị trí mục tiêu</label>
                    <input
                      type="text"
                      value={generatedCv.targetJob}
                      onChange={(e) =>
                        setGeneratedCv({ ...generatedCv, targetJob: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E8E2D5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">{labels.summary}</label>
                    <textarea
                      rows={3}
                      value={generatedCv.summary}
                      onChange={(e) =>
                        setGeneratedCv({ ...generatedCv, summary: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E8E2D5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      {labels.objective}
                    </label>
                    <textarea
                      rows={2}
                      value={generatedCv.careerObjective || ''}
                      onChange={(e) =>
                        setGeneratedCv({ ...generatedCv, careerObjective: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E8E2D5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      {labels.skills} (cách nhau dấu phẩy)
                    </label>
                    <input
                      type="text"
                      value={generatedCv.skills.join(', ')}
                      onChange={(e) =>
                        setGeneratedCv({
                          ...generatedCv,
                          skills: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E8E2D5] rounded-lg"
                    />
                  </div>
                </div>
              )}

              {/* Save & Export Actions */}
              <div className="pt-2 border-t border-[#E8E2D5] space-y-2">
                <label className="block font-bold text-stone-700">Tên bản CV để lưu</label>
                <input
                  type="text"
                  value={cvName}
                  onChange={(e) => setCvName(e.target.value)}
                  placeholder="VD: CV Thực tập Marketing 2026"
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl"
                />
                <button
                  type="button"
                  onClick={handleSaveCVRecord}
                  disabled={isSaving}
                  className="w-full py-2.5 bg-[#2F5233] hover:bg-[#244127] disabled:opacity-60 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Đang lưu...' : 'Lưu CV vào tài khoản'}</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="py-2.5 bg-stone-900 hover:bg-black text-white font-bold rounded-xl flex items-center justify-center gap-1.5"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Tải CV PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="py-2.5 bg-[#FAF7F2] border border-[#E8E2D5] text-stone-700 font-bold rounded-xl flex items-center justify-center gap-1.5"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Sao chép</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSyncToProfile}
                  className="w-full py-2 bg-[#EBF2EB] text-[#2F5233] font-bold rounded-xl flex items-center justify-center gap-1.5 border border-[#2F5233]/20"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Đồng bộ kỹ năng vào Hồ sơ cá nhân</span>
                </button>
              </div>
            </div>

            {/* AI Feedback Card */}
            {generatedCv.aiFeedback &&
              (generatedCv.aiFeedback.grammarNotes?.length > 0 ||
                generatedCv.aiFeedback.improvementTips?.length > 0) && (
                <div className="bg-white border border-[#E8E2D5] rounded-3xl p-4 shadow-2xs space-y-2.5 text-xs">
                  <h3 className="font-extrabold text-[#2F5233] flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4 text-amber-500" />
                    <span>Góp ý chỉnh sửa & tối ưu từ AI</span>
                  </h3>
                  {generatedCv.aiFeedback.grammarNotes?.length > 0 && (
                    <div>
                      <p className="font-bold text-stone-800 mb-1">Chính tả & Diễn đạt:</p>
                      <ul className="list-disc list-inside text-stone-600 space-y-0.5">
                        {generatedCv.aiFeedback.grammarNotes.map((n, i) => (
                          <li key={i}>{n}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {generatedCv.aiFeedback.improvementTips?.length > 0 && (
                    <div>
                      <p className="font-bold text-stone-800 mb-1">Gợi ý cải thiện thêm:</p>
                      <ul className="list-disc list-inside text-stone-600 space-y-0.5">
                        {generatedCv.aiFeedback.improvementTips.map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
          </div>

          {/* Printable Preview Column */}
          <div className="lg:col-span-8">{renderCvPreview()}</div>
        </div>
      )}
    </div>
  );
};

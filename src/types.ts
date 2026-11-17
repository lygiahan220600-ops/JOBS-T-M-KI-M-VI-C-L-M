export type Language = 'vi' | 'en' | 'ja' | 'ko' | 'zh' | 'fr' | 'de';

export type JobType = 'Part-time' | 'Full-time' | 'Thực tập';
export type WorkMode = 'Tại văn phòng' | 'Làm từ xa (Remote)' | 'Linh hoạt (Hybrid)';
export type ExperienceLevel = 'Chưa có kinh nghiệm' | 'Dưới 6 tháng' | 'Từ 6 tháng - 1 năm' | 'Trên 1 năm';
export type ShiftSlot = 'Sáng' | 'Chiều' | 'Tối' | 'Cuối tuần' | 'Linh hoạt theo lịch học';

export interface Job {
  id: string;
  title: string;
  titleEn?: string;
  companyName: string;
  companyShort: string;
  companyColor: string;
  address: string;
  city: string;
  district: string;
  salaryText: string;
  salaryTextEn?: string;
  salaryCategory: 'Dưới 3 triệu' | '3 - 6 triệu' | '6 - 10 triệu' | 'Trên 10 triệu' | 'Theo giờ (25k - 60k/h)';
  jobType: JobType;
  workMode: WorkMode;
  experience: ExperienceLevel;
  major: string;
  skills: string[];
  availableShifts: ShiftSlot[];
  postedAt: string;
  deadline: string;
  vacancies: number;
  description: string[];
  descriptionEn?: string[];
  requirements: string[];
  requirementsEn?: string[];
  benefits: string[];
  benefitsEn?: string[];
  scheduleDetail: string;
  contactPerson: string;
  employerId?: string;
  employerAvatar?: string;
  status?: 'published' | 'pending' | 'closed';
}

export interface EducationItem {
  id: string;
  school: string;
  major: string;
  degree: string;
  year: string;
  gpa?: string;
}

export interface StudentProfile {
  fullName: string;
  avatarUrl: string;
  email: string;
  phone: string;
  address: string;
  dateOfBirth?: string;
  gender?: string;
  university: string;
  faculty: string;
  gpa: string;
  graduationYear: string;
  educationList?: EducationItem[];
  skills: string[];
  bio: string;
  desiredSalary: string;
  desiredJobType: string;
  preferredCity: string;
  portfolioUrl?: string;
  cvFileName?: string;
}

export interface UserAccount {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: 'candidate' | 'employer';
  avatarUrl?: string;
  companyName?: string;
}

export interface SearchFilterState {
  keyword: string;
  location: string;
  jobType: string;
  salaryCategory: string;
  experience: string;
  major: string;
  workMode: string;
  shift: string;
}

export type ApplicationStatus =
  | 'Chờ xét duyệt'
  | 'Đã xem'
  | 'Đang phỏng vấn'
  | 'Được chấp nhận'
  | 'Từ chối';

export interface JobApplication {
  id: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  employerId: string;
  applicantId: string;
  appliedAt: string;
  fullName: string;
  email: string;
  phone: string;
  university: string;
  major: string;
  availableShifts: string;
  note: string;
  cvId?: string;
  cvSnapshot?: SavedCVRecord | null;
  status: ApplicationStatus;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  senderName: string;
  senderRole: 'candidate' | 'employer';
  text: string;
  timestamp: string;
  createdAt?: string;
  read: boolean;
  isMe: boolean;
}

export interface ChatConversation {
  id: string;
  participantId: string;
  participantName: string;
  participantRole: 'candidate' | 'employer';
  participantAvatar?: string;
  companyName?: string;
  jobId?: string;
  jobTitle?: string;
  employerId: string;
  candidateId: string;
  lastMessage: string;
  lastTimestamp: string;
  unreadCount: number;
  messages: ChatMessage[];
}

export interface AppNotification {
  id: string;
  userId: string;
  type: 'message' | 'application' | 'application_status';
  title: string;
  body: string;
  linkTab: string;
  refId: string;
  isRead: boolean;
  createdAt: string;
}

export type CVTemplateId =
  | 'minimalist'
  | 'professional'
  | 'modern'
  | 'fresh-grad'
  | 'no-exp'
  | 'office'
  | 'marketing'
  | 'it'
  | 'bilingual';

export type CVLanguage = 'vi' | 'en' | 'ko';

export interface AICVExperience {
  role: string;
  company: string;
  duration: string;
  highlights: string[];
}

export interface AICVEducation {
  school: string;
  major: string;
  year: string;
  degree?: string;
  gpa?: string;
}

export interface AICVProject {
  name: string;
  role: string;
  description: string;
}

export interface AICVData {
  fullName: string;
  targetJob: string;
  dateOfBirth?: string;
  email: string;
  phone: string;
  address: string;
  avatarUrl?: string;
  summary: string;
  careerObjective?: string;
  strengths?: string[];
  skills: string[];
  softSkills?: string[];
  education: AICVEducation[];
  experience: AICVExperience[];
  projects: AICVProject[];
  certifications: string[];
  activities: string[];
  languages?: string[];
  references?: string;
  template: CVTemplateId;
  cvLanguage?: CVLanguage;
  aiFeedback?: {
    grammarNotes: string[];
    improvementTips: string[];
  };
}

export interface SavedCVRecord {
  id: string;
  userId: string;
  name: string;
  targetJob: string;
  language: CVLanguage;
  template: CVTemplateId;
  accentColor: string;
  layout: 'single' | 'two-column';
  data: AICVData;
  createdAt: string;
  updatedAt: string;
}

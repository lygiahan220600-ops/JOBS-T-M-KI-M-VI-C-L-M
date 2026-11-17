import React, { useState } from 'react';
import {
  PlusCircle,
  FileCheck,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  Building2,
  Trash2,
  Filter,
  Check,
  Sparkles,
  MessageSquare,
  FileText,
  X,
  LogIn,
  Eye,
} from 'lucide-react';
import {
  ApplicationStatus,
  ExperienceLevel,
  Job,
  JobApplication,
  JobType,
  Language,
  SavedCVRecord,
  ShiftSlot,
  UserAccount,
  WorkMode,
} from '../types';
import { CITIES, STANDARD_MAJORS, SALARY_CATEGORIES } from '../data/mockJobs';

interface EmployerDashboardProps {
  currentUser: UserAccount | null;
  jobs: Job[];
  applications: JobApplication[];
  lang: Language;
  onAddJob: (job: Omit<Job, 'id' | 'employerId'>) => Promise<void> | void;
  onUpdateJobStatus: (jobId: string, status: 'published' | 'pending' | 'closed') => Promise<void> | void;
  onDeleteJob: (jobId: string) => Promise<void> | void;
  onUpdateAppStatus: (appId: string, status: ApplicationStatus) => Promise<void> | void;
  onOpenChatWithCandidate: (
    candidateId: string,
    candidateName: string,
    jobId: string,
    jobTitle: string
  ) => Promise<void> | void;
  onViewJobDetail: (job: Job) => void;
  onSwitchToCandidate: () => void;
  onOpenAuth?: () => void;
}

const APP_STATUS_OPTIONS: ApplicationStatus[] = [
  'Chờ xét duyệt',
  'Đã xem',
  'Đang phỏng vấn',
  'Được chấp nhận',
  'Từ chối',
];

function getStatusBadgeClass(status: ApplicationStatus): string {
  switch (status) {
    case 'Chờ xét duyệt':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'Đã xem':
      return 'bg-sky-50 text-sky-800 border-sky-200';
    case 'Đang phỏng vấn':
      return 'bg-indigo-50 text-indigo-800 border-indigo-200';
    case 'Được chấp nhận':
      return 'bg-[#EBF2EB] text-[#2F5233] border-[#2F5233]/30';
    case 'Từ chối':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-stone-100 text-stone-700 border-stone-200';
  }
}

export const EmployerDashboard: React.FC<EmployerDashboardProps> = ({
  currentUser,
  jobs,
  applications,
  onAddJob,
  onUpdateJobStatus,
  onDeleteJob,
  onUpdateAppStatus,
  onOpenChatWithCandidate,
  onViewJobDetail,
  onSwitchToCandidate,
  onOpenAuth,
}) => {
  const [subTab, setSubTab] = useState<'manage-jobs' | 'post-job' | 'manage-apps'>('manage-apps');

  // New Job Form State
  const [title, setTitle] = useState('');
  const [companyName, setCompanyName] = useState(
    currentUser?.companyName || currentUser?.fullName || ''
  );
  const [city, setCity] = useState('TP. Hồ Chí Minh');
  const [district, setDistrict] = useState('Quận 1');
  const [address, setAddress] = useState('');
  const [salaryText, setSalaryText] = useState('6 - 9 triệu / tháng');
  const [salaryCategory, setSalaryCategory] = useState<Job['salaryCategory']>('6 - 10 triệu');
  const [jobType, setJobType] = useState<JobType>('Part-time');
  const [workMode, setWorkMode] = useState<WorkMode>('Linh hoạt (Hybrid)');
  const [experience, setExperience] = useState<ExperienceLevel>('Chưa có kinh nghiệm');
  const [major, setMajor] = useState('Marketing & Truyền thông');
  const [skillsInput, setSkillsInput] = useState('Giao tiếp, Làm việc nhóm, Sáng tạo');
  const [availableShifts, setAvailableShifts] = useState<ShiftSlot[]>([
    'Sáng',
    'Chiều',
    'Linh hoạt theo lịch học',
  ]);
  const [vacancies] = useState<number>(3);
  const [contactPerson] = useState(currentUser?.fullName || 'Phòng Nhân sự');
  const [description, setDescription] = useState(
    'Hỗ trợ triển khai các hoạt động chuyên môn, tương tác với đối tác và quản lý hồ sơ dự án theo sự phân công.'
  );
  const [requirements, setRequirements] = useState(
    'Sinh viên các trường đại học/cao đẳng, nhanh nhẹn, ham học hỏi và tinh thần trách nhiệm cao.'
  );
  const [benefits, setBenefits] = useState(
    'Lương/trợ cấp cạnh tranh, hỗ trợ dấu mộc thực tập, linh hoạt đổi ca theo lịch học.'
  );
  const [autoApprove, setAutoApprove] = useState(true);
  const [isPosting, setIsPosting] = useState(false);

  const [jobStatusFilter, setJobStatusFilter] = useState<'all' | 'published' | 'pending' | 'closed'>('all');
  const [appStatusFilter, setAppStatusFilter] = useState<string>('all');
  const [confirmDeleteJobId, setConfirmDeleteJobId] = useState<string | null>(null);
  const [previewCvApp, setPreviewCvApp] = useState<JobApplication | null>(null);

  const shiftOptions: ShiftSlot[] = ['Sáng', 'Chiều', 'Tối', 'Cuối tuần', 'Linh hoạt theo lịch học'];

  // Require employer login
  if (!currentUser || currentUser.role !== 'employer') {
    return (
      <div className="w-full px-3 sm:px-6 py-6 pb-28">
        <div className="bg-white border border-[#E8E2D5] rounded-3xl p-8 sm:p-12 text-center shadow-xs max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-[#EBF2EB] text-[#2F5233] flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8" />
          </div>
          <h2 className="text-lg sm:text-xl font-black text-stone-900 font-display">
            Cổng dành cho Nhà tuyển dụng
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 mt-2 leading-relaxed">
            {!currentUser
              ? 'Vui lòng đăng nhập hoặc đăng ký tài khoản với vai trò Nhà tuyển dụng để đăng bài tuyển dụng, quản lý ứng viên và nhắn tin trực tiếp.'
              : 'Tài khoản hiện tại của bạn đang ở vai trò Người tìm việc. Vui lòng đăng nhập bằng tài khoản Nhà tuyển dụng để sử dụng tính năng này.'}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            {onOpenAuth && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#2F5233] hover:bg-[#244127] text-white text-xs font-bold rounded-xl shadow-xs transition-all"
              >
                <LogIn className="w-4 h-4" />
                <span>{currentUser ? 'Đăng nhập tài khoản Nhà tuyển dụng' : 'Đăng nhập / Đăng ký ngay'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onSwitchToCandidate}
              className="px-4 py-2.5 bg-[#FAF7F2] border border-[#E8E2D5] text-stone-700 hover:bg-[#F2ECE1] text-xs font-semibold rounded-xl transition-colors"
            >
              Về trang chủ việc làm
            </button>
          </div>
        </div>
      </div>
    );
  }

  const toggleShift = (slot: ShiftSlot) => {
    setAvailableShifts((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
    );
  };

  const loadTemplate = (type: 'it' | 'fnb' | 'marketing' | 'sales') => {
    if (type === 'it') {
      setTitle('Thực tập sinh Lập trình Web Frontend (React / Tailwind)');
      setMajor('Công nghệ thông tin');
      setJobType('Thực tập');
      setWorkMode('Linh hoạt (Hybrid)');
      setSalaryText('4 - 7 triệu / tháng + phụ cấp');
      setSalaryCategory('3 - 6 triệu');
      setSkillsInput('ReactJS, TypeScript, Tailwind CSS, Git, Tinh thần học hỏi');
      setDescription(
        'Tham gia xây dựng giao diện ứng dụng web, tối ưu trải nghiệm người dùng và phối hợp với đội ngũ Backend theo mô hình Agile.'
      );
      setRequirements(
        'Sinh viên năm 3, 4 hoặc mới tốt nghiệp ngành CNTT. Nắm vững HTML, CSS, JavaScript/TypeScript.'
      );
      setBenefits(
        'Hỗ trợ dấu mộc thực tập, phụ cấp cơm trưa, lộ trình đào tạo trực tiếp bởi Senior Developer, cơ hội lên nhân viên chính thức.'
      );
    } else if (type === 'fnb') {
      setTitle('Nhân viên Pha chế & Phục vụ Coffee Part-time');
      setMajor('Du lịch - Nhà hàng - Khách sạn');
      setJobType('Part-time');
      setWorkMode('Tại văn phòng');
      setSalaryText('28.000đ - 35.000đ / giờ');
      setSalaryCategory('Theo giờ (25k - 60k/h)');
      setSkillsInput('Giao tiếp thân thiện, Nhanh nhẹn, Đúng giờ, Chăm chỉ');
      setDescription(
        'Đón tiếp và ghi nhận order của khách hàng, pha chế đồ uống theo tiêu chuẩn chuỗi, giữ gìn vệ sinh khu vực làm việc sạch sẽ.'
      );
      setRequirements(
        'Sinh viên trên 18 tuổi, không yêu cầu kinh nghiệm (được đào tạo bài bản từ đầu), trung thực, có thái độ phục vụ tốt.'
      );
      setBenefits(
        'Thưởng doanh số tháng, ưu đãi đồ uống 50%, xếp lịch làm việc linh hoạt theo lịch học hàng tuần.'
      );
    } else if (type === 'marketing') {
      setTitle('Cộng tác viên Sáng tạo Nội dung TikTok & Fanpage');
      setMajor('Marketing & Truyền thông');
      setJobType('Part-time');
      setWorkMode('Làm từ xa (Remote)');
      setSalaryText('3 - 5 triệu / tháng + KPI views');
      setSalaryCategory('3 - 6 triệu');
      setSkillsInput('Canva, CapCut, Viết lách kịch bản, Bắt trend mạng xã hội');
      setDescription(
        'Lên ý tưởng, viết kịch bản và quay dựng video ngắn TikTok/Reels về đời sống sinh viên, review dịch vụ và giới thiệu sản phẩm.'
      );
      setRequirements('Có khiếu thẩm mỹ, thích sáng tạo nội dung, nắm bắt xu hướng giới trẻ tốt.');
      setBenefits(
        'Làm việc linh hoạt tại nhà, thưởng nóng theo mốc video triệu view, tiếp cận các công cụ thiết kế bản quyền.'
      );
    } else if (type === 'sales') {
      setTitle('Chuyên viên Tư vấn Khóa học & Chăm sóc Học viên');
      setMajor('Kinh tế & Quản trị kinh doanh');
      setJobType('Part-time');
      setWorkMode('Linh hoạt (Hybrid)');
      setSalaryText('5 - 8 triệu / tháng (Lương cứng + Hoa hồng)');
      setSalaryCategory('6 - 10 triệu');
      setSkillsInput('Kỹ năng tư vấn, Giao tiếp thuyết phục, Quản lý thời gian');
      setDescription(
        'Tư vấn lộ trình học tập ngoại ngữ/tin học cho học viên quan tâm, hỗ trợ giải đáp thắc mắc và chăm sóc học viên trong suốt khóa học.'
      );
      setRequirements('Giọng nói truyền cảm, nhiệt tình, kiên trì, ưu tiên sinh viên yêu thích giáo dục.');
      setBenefits(
        'Hoa hồng hấp dẫn không giới hạn, được học miễn phí các khóa học tại trung tâm, chứng chỉ kỹ năng doanh nghiệp.'
      );
    }
  };

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !companyName.trim() || isPosting) return;

    const short = companyName
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('');

    setIsPosting(true);
    try {
      await onAddJob({
        title: title.trim(),
        companyName: companyName.trim(),
        companyShort: short || 'HR',
        companyColor: '#2F5233',
        address: address.trim() || `${district}, ${city}`,
        city,
        district,
        salaryText: salaryText.trim(),
        salaryCategory,
        jobType,
        workMode,
        experience,
        major,
        skills: skillsInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        availableShifts:
          availableShifts.length > 0 ? availableShifts : ['Linh hoạt theo lịch học'],
        postedAt: 'Vừa xong',
        deadline: '30 ngày tới',
        vacancies: vacancies || 1,
        description: description.split('\n').filter(Boolean),
        requirements: requirements.split('\n').filter(Boolean),
        benefits: benefits.split('\n').filter(Boolean),
        scheduleDetail: availableShifts.join(', '),
        contactPerson: contactPerson.trim() || currentUser.fullName,
        status: autoApprove ? 'published' : 'pending',
      });
      setTitle('');
      setSubTab('manage-jobs');
    } finally {
      setIsPosting(false);
    }
  };

  // Scope jobs & applications strictly to the logged-in employer
  const myJobs = jobs.filter((j) => j.employerId === currentUser.id);
  const employerJobs = myJobs.filter((j) => {
    const status = j.status || 'published';
    if (jobStatusFilter === 'all') return true;
    return status === jobStatusFilter;
  });

  const myApplications = applications.filter((a) => a.employerId === currentUser.id);
  const filteredApps = myApplications.filter((app) => {
    if (appStatusFilter === 'all') return true;
    return app.status === appStatusFilter;
  });

  const renderCvModal = (cvRecord: SavedCVRecord, app: JobApplication) => {
    const cv = cvRecord.data;
    return (
      <div
        className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
        onClick={() => setPreviewCvApp(null)}
      >
        <div
          className="w-full max-w-2xl bg-white rounded-3xl border border-[#E8E2D5] shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-5 py-4 bg-[#2F5233] text-white flex items-center justify-between shrink-0">
            <div>
              <p className="text-[11px] text-emerald-200 font-semibold uppercase">
                CV đính kèm từ ứng viên
              </p>
              <h3 className="text-sm sm:text-base font-bold">
                {cvRecord.name} — {app.fullName}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setPreviewCvApp(null)}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs text-stone-800">
            <div className="border-b border-[#E8E2D5] pb-3 flex flex-wrap justify-between gap-2">
              <div>
                <h4 className="text-lg font-black text-stone-900">{cv.fullName}</h4>
                <p className="font-bold text-[#2F5233] uppercase">{cv.targetJob}</p>
              </div>
              <div className="text-right text-stone-600 space-y-0.5">
                <p>{cv.phone} • {cv.email}</p>
                {cv.address && <p>{cv.address}</p>}
              </div>
            </div>

            {cv.summary && (
              <div>
                <h5 className="font-bold text-[#2F5233] uppercase mb-1">Giới thiệu & Mục tiêu</h5>
                <p className="leading-relaxed text-stone-700">{cv.summary}</p>
              </div>
            )}

            {cv.education?.length > 0 && (
              <div>
                <h5 className="font-bold text-[#2F5233] uppercase mb-1">Học vấn</h5>
                <div className="space-y-1.5">
                  {cv.education.map((edu, idx) => (
                    <div key={idx} className="flex justify-between">
                      <div>
                        <span className="font-bold">{edu.school}</span> — {edu.major}
                      </div>
                      <span className="text-stone-500">
                        {edu.year} {edu.gpa ? `(GPA: ${edu.gpa})` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {cv.skills?.length > 0 && (
              <div>
                <h5 className="font-bold text-[#2F5233] uppercase mb-1">Kỹ năng</h5>
                <div className="flex flex-wrap gap-1.5">
                  {cv.skills.map((s, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-lg bg-[#EBF2EB] text-[#2F5233] font-medium"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {cv.experience?.length > 0 && (
              <div>
                <h5 className="font-bold text-[#2F5233] uppercase mb-1">Kinh nghiệm</h5>
                <div className="space-y-2">
                  {cv.experience.map((exp, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between font-bold">
                        <span>{exp.role} • {exp.company}</span>
                        <span className="text-stone-500 font-normal">{exp.duration}</span>
                      </div>
                      <ul className="list-disc list-inside text-stone-600 mt-0.5 space-y-0.5">
                        {exp.highlights.map((h, i) => (
                          <li key={i}>{h}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {cv.projects?.length > 0 && (
              <div>
                <h5 className="font-bold text-[#2F5233] uppercase mb-1">Dự án</h5>
                <div className="space-y-1">
                  {cv.projects.map((p, idx) => (
                    <div key={idx}>
                      <span className="font-bold">{p.name}</span> ({p.role}): {p.description}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(cv.certifications?.length > 0 || cv.activities?.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cv.certifications?.length > 0 && (
                  <div>
                    <h5 className="font-bold text-[#2F5233] uppercase mb-1">Chứng chỉ</h5>
                    <ul className="list-disc list-inside text-stone-600">
                      {cv.certifications.map((c, idx) => (
                        <li key={idx}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {cv.activities?.length > 0 && (
                  <div>
                    <h5 className="font-bold text-[#2F5233] uppercase mb-1">Hoạt động</h5>
                    <ul className="list-disc list-inside text-stone-600">
                      {cv.activities.map((a, idx) => (
                        <li key={idx}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full px-3 sm:px-6 py-4 pb-28 space-y-4">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-[#1E3821] via-[#2F5233] to-[#3B5E3C] rounded-3xl p-4 sm:p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold text-[#FAF7F2] mb-2">
              <Building2 className="w-3.5 h-3.5" />
              <span>{currentUser.companyName || currentUser.fullName}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black font-display tracking-tight text-white">
              Quản lý tuyển dụng & Ứng viên
            </h1>
            <p className="text-xs sm:text-sm text-[#FAF7F2]/90 mt-1">
              Đăng bài tuyển dụng mới, duyệt hồ sơ ứng viên, cập nhật trạng thái và nhắn tin trực tiếp.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSwitchToCandidate}
              className="px-3.5 py-2 bg-white/15 hover:bg-white/25 active:scale-95 text-xs font-bold rounded-xl text-white transition-all backdrop-blur-xs border border-white/20"
            >
              Xem trang chủ việc làm
            </button>
            <button
              type="button"
              onClick={() => setSubTab('post-job')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-[#2F5233] hover:bg-[#FAF7F2] active:scale-95 text-xs font-black rounded-xl transition-all shadow-md"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Đăng tin mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 p-1 bg-white border border-[#E8E2D5] rounded-2xl shadow-2xs overflow-x-auto">
        <button
          type="button"
          onClick={() => setSubTab('manage-apps')}
          className={`flex-1 min-w-[150px] py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            subTab === 'manage-apps'
              ? 'bg-[#2F5233] text-white shadow-xs'
              : 'text-stone-700 hover:text-stone-900 hover:bg-[#FAF7F2]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Quản lý ứng viên ({myApplications.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('manage-jobs')}
          className={`flex-1 min-w-[150px] py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            subTab === 'manage-jobs'
              ? 'bg-[#2F5233] text-white shadow-xs'
              : 'text-stone-700 hover:text-stone-900 hover:bg-[#FAF7F2]'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Bài đăng của tôi ({myJobs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('post-job')}
          className={`flex-1 min-w-[150px] py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            subTab === 'post-job'
              ? 'bg-[#2F5233] text-white shadow-xs'
              : 'text-stone-700 hover:text-stone-900 hover:bg-[#FAF7F2]'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          <span>Đăng bài tuyển dụng</span>
        </button>
      </div>

      {/* SUB-TAB 1: QUẢN LÝ ỨNG VIÊN */}
      {subTab === 'manage-apps' && (
        <div className="space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#E8E2D5]">
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
              <span className="text-stone-600 font-medium px-1 flex items-center gap-1 shrink-0">
                <Filter className="w-3.5 h-3.5 text-[#2F5233]" /> Phân loại trạng thái:
              </span>
              {(['all', ...APP_STATUS_OPTIONS] as const).map((st) => {
                const count =
                  st === 'all'
                    ? myApplications.length
                    : myApplications.filter((a) => a.status === st).length;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setAppStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                      appStatusFilter === st
                        ? 'bg-[#2F5233] text-white shadow-2xs'
                        : 'bg-[#FAF7F2] border border-[#E8E2D5] text-stone-700 hover:bg-[#F2ECE1]'
                    }`}
                  >
                    {st === 'all' ? `Tất cả (${count})` : `${st} (${count})`}
                  </button>
                );
              })}
            </div>
          </div>

          {filteredApps.length === 0 ? (
            <div className="bg-white border border-[#E8E2D5] rounded-3xl p-8 text-center shadow-xs">
              <Users className="w-10 h-10 text-stone-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-stone-800">
                Chưa có đơn ứng tuyển nào trong mục này
              </h3>
              <p className="text-xs text-stone-600 mt-1 max-w-md mx-auto">
                Khi sinh viên / ứng viên nộp hồ sơ vào bài đăng tuyển dụng của bạn, thông tin ứng viên và CV đính kèm sẽ hiển thị tại đây.
              </p>
              {myJobs.length === 0 && (
                <button
                  type="button"
                  onClick={() => setSubTab('post-job')}
                  className="mt-4 px-4 py-2 bg-[#2F5233] text-white rounded-xl text-xs font-bold hover:bg-[#244127]"
                >
                  Đăng bài tuyển dụng đầu tiên
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredApps.map((app) => (
                <div
                  key={app.id}
                  className="bg-white border border-[#E8E2D5] rounded-2xl p-4 shadow-xs space-y-3 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${getStatusBadgeClass(
                          app.status
                        )}`}
                      >
                        {app.status}
                      </span>
                      <span className="text-[11px] text-stone-500 tabular-nums">
                        Ứng tuyển: {app.appliedAt}
                      </span>
                    </div>

                    <div className="mt-2">
                      <h3 className="text-sm font-bold text-stone-900">{app.fullName}</h3>
                      <p className="text-xs text-[#2F5233] font-semibold mt-0.5">
                        Vị trí: {app.jobTitle}
                      </p>
                    </div>

                    <div className="text-xs text-stone-700 space-y-1 bg-[#FAF7F2] border border-[#E8E2D5] p-2.5 rounded-xl mt-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-stone-600">Email:</span>
                        <span className="font-medium text-stone-800 truncate">{app.email}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-stone-600">Điện thoại:</span>
                        <span className="font-mono font-medium text-stone-800">{app.phone}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-stone-600">Trường / Ngành:</span>
                        <span className="font-medium text-stone-800 text-right">
                          {app.university || 'Chưa cập nhật'}{' '}
                          {app.major ? `(${app.major})` : ''}
                        </span>
                      </div>
                      {app.availableShifts && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-stone-600">Ca rảnh:</span>
                          <span className="font-medium text-[#2F5233] text-right">
                            {app.availableShifts}
                          </span>
                        </div>
                      )}
                      {app.note && (
                        <div className="pt-1 border-t border-[#E8E2D5] text-stone-700 italic">
                          "{app.note}"
                        </div>
                      )}
                    </div>

                    {app.cvSnapshot && (
                      <button
                        type="button"
                        onClick={() => setPreviewCvApp(app)}
                        className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EBF2EB] hover:bg-[#DDE9DD] border border-[#2F5233]/25 text-[#2F5233] text-xs font-bold transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Xem CV đính kèm ({app.cvSnapshot.name})</span>
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Status controls & direct chat */}
                  <div className="pt-2.5 border-t border-[#E8E2D5] space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-[11px] font-bold text-stone-600">
                        Cập nhật trạng thái:
                      </label>
                      <select
                        value={app.status}
                        onChange={(e) =>
                          onUpdateAppStatus(app.id, e.target.value as ApplicationStatus)
                        }
                        className="px-2.5 py-1.5 text-xs font-bold bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl text-stone-800 focus:outline-none focus:border-[#2F5233]"
                      >
                        {APP_STATUS_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          onOpenChatWithCandidate(
                            app.applicantId,
                            app.fullName,
                            app.jobId,
                            app.jobTitle
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#EBF2EB] hover:bg-[#2F5233]/15 text-[#2F5233] rounded-xl text-xs font-bold transition-colors border border-[#2F5233]/20"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Nhắn tin ứng viên</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onUpdateAppStatus(app.id, 'Đang phỏng vấn')}
                          className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-bold transition-colors"
                        >
                          Phỏng vấn
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateAppStatus(app.id, 'Được chấp nhận')}
                          className="px-2.5 py-1.5 bg-[#2F5233] hover:bg-[#244127] text-white rounded-xl text-[11px] font-bold transition-colors"
                        >
                          Chấp nhận
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateAppStatus(app.id, 'Từ chối')}
                          className="px-2 py-1.5 text-stone-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl text-[11px] font-semibold transition-colors"
                        >
                          Từ chối
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: BÀI ĐĂNG CỦA TÔI */}
      {subTab === 'manage-jobs' && (
        <div className="space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#E8E2D5]">
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
              <span className="text-stone-600 font-medium px-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-[#2F5233]" /> Lọc trạng thái:
              </span>
              {(['all', 'published', 'pending', 'closed'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setJobStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                    jobStatusFilter === st
                      ? 'bg-[#2F5233] text-white shadow-2xs'
                      : 'bg-[#FAF7F2] border border-[#E8E2D5] text-stone-700 hover:bg-[#F2ECE1]'
                  }`}
                >
                  {st === 'all' && `Tất cả (${myJobs.length})`}
                  {st === 'published' &&
                    `Đang hiển thị (${myJobs.filter((j) => (j.status || 'published') === 'published').length})`}
                  {st === 'pending' &&
                    `Chờ duyệt (${myJobs.filter((j) => j.status === 'pending').length})`}
                  {st === 'closed' &&
                    `Đã đóng (${myJobs.filter((j) => j.status === 'closed').length})`}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setSubTab('post-job')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#2F5233] text-white rounded-xl text-xs font-bold hover:bg-[#244127] transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Tạo tin mới</span>
            </button>
          </div>

          {employerJobs.length === 0 ? (
            <div className="bg-white border border-[#E8E2D5] rounded-3xl p-8 text-center shadow-xs">
              <FileCheck className="w-10 h-10 text-stone-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-stone-800">
                Bạn chưa có bài đăng tuyển dụng nào
              </h3>
              <p className="text-xs text-stone-600 mt-1">
                Hãy tạo tin tuyển dụng mới để tiếp cận sinh viên và nhận hồ sơ ứng tuyển trực tiếp.
              </p>
              <button
                type="button"
                onClick={() => setSubTab('post-job')}
                className="mt-4 px-4 py-2 bg-[#2F5233] text-white rounded-xl text-xs font-bold hover:bg-[#244127]"
              >
                Đăng bài tuyển dụng ngay
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {employerJobs.map((job) => {
                const currentStatus = job.status || 'published';
                const jobApps = myApplications.filter((a) => a.jobId === job.id);

                return (
                  <div
                    key={job.id}
                    className="bg-white border border-[#E8E2D5] rounded-2xl p-4 shadow-xs hover:border-[#2F5233]/60 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          {currentStatus === 'published' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#2F5233] bg-[#EBF2EB] border border-[#2F5233]/30 px-2.5 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Đang hiển thị</span>
                            </span>
                          )}
                          {currentStatus === 'pending' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                              <Clock className="w-3 h-3" />
                              <span>Chờ duyệt</span>
                            </span>
                          )}
                          {currentStatus === 'closed' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-stone-600 bg-[#FAF7F2] border border-[#E8E2D5] px-2.5 py-0.5 rounded-full">
                              <XCircle className="w-3 h-3" />
                              <span>Đã tạm đóng</span>
                            </span>
                          )}
                          <span className="text-[11px] text-stone-600">{job.postedAt}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSubTab('manage-apps')}
                          className="text-[11px] font-bold text-[#2F5233] bg-[#EBF2EB] px-2 py-0.5 rounded-lg border border-[#2F5233]/20"
                        >
                          {jobApps.length} ứng viên
                        </button>
                      </div>

                      <h3
                        onClick={() => onViewJobDetail(job)}
                        className="text-sm font-bold text-stone-900 hover:text-[#2F5233] transition-colors cursor-pointer line-clamp-2"
                      >
                        {job.title}
                      </h3>
                      <p className="text-xs text-stone-600 font-medium mt-0.5 truncate">
                        {job.companyName} • {job.city}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 text-xs mt-2.5 pt-2 border-t border-[#E8E2D5]">
                        <span className="font-bold text-[#2F5233] font-mono">{job.salaryText}</span>
                        <span className="text-stone-300">•</span>
                        <span className="text-stone-600">{job.jobType}</span>
                        <span className="text-stone-300">•</span>
                        <span className="text-stone-600">{job.workMode}</span>
                      </div>
                    </div>

                    <div className="pt-3 mt-3 border-t border-[#E8E2D5] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {currentStatus === 'pending' && (
                          <button
                            type="button"
                            onClick={() => onUpdateJobStatus(job.id, 'published')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#2F5233] hover:bg-[#244127] text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Công khai tin</span>
                          </button>
                        )}

                        {currentStatus === 'published' && (
                          <button
                            type="button"
                            onClick={() => onUpdateJobStatus(job.id, 'closed')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#FAF7F2] hover:bg-[#F2ECE1] border border-[#E8E2D5] text-stone-800 rounded-xl text-xs font-semibold transition-all"
                          >
                            <span>Tạm đóng tin</span>
                          </button>
                        )}

                        {currentStatus === 'closed' && (
                          <button
                            type="button"
                            onClick={() => onUpdateJobStatus(job.id, 'published')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#2F5233] hover:bg-[#244127] text-white rounded-xl text-xs font-bold transition-all"
                          >
                            <span>Mở lại tin</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onViewJobDetail(job)}
                          className="px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:text-stone-900 hover:bg-[#FAF7F2] rounded-xl transition-colors"
                        >
                          Xem tin
                        </button>
                      </div>

                      {confirmDeleteJobId === job.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteJob(job.id);
                              setConfirmDeleteJobId(null);
                            }}
                            className="px-2 py-1 bg-rose-600 text-white rounded-lg text-[11px] font-bold"
                          >
                            Xác nhận xóa
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteJobId(null)}
                            className="px-2 py-1 bg-stone-100 text-stone-600 rounded-lg text-[11px]"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteJobId(job.id)}
                          className="p-1.5 text-stone-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Xóa bài đăng"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: ĐĂNG BÀI TUYỂN DỤNG MỚI */}
      {subTab === 'post-job' && (
        <div className="bg-white rounded-3xl border border-[#E8E2D5] p-4 sm:p-6 shadow-xs space-y-5">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-stone-900 font-display">
              Tạo bài tuyển dụng sinh viên
            </h2>
            <p className="text-xs text-stone-600 mt-0.5">
              Điền thông tin chi tiết hoặc chọn mẫu bài đăng nhanh để hoàn thành trong 1 phút.
            </p>

            <div className="mt-3.5 p-3 bg-[#FAF7F2] rounded-2xl border border-[#E8E2D5] flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[#2F5233] flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Điền nhanh theo mẫu:</span>
              </span>
              <button
                type="button"
                onClick={() => loadTemplate('it')}
                className="px-2.5 py-1 bg-white hover:bg-[#EBF2EB] border border-[#E8E2D5] rounded-xl text-xs font-semibold text-[#2F5233] transition-colors"
              >
                Thực tập sinh IT
              </button>
              <button
                type="button"
                onClick={() => loadTemplate('marketing')}
                className="px-2.5 py-1 bg-white hover:bg-[#EBF2EB] border border-[#E8E2D5] rounded-xl text-xs font-semibold text-[#2F5233] transition-colors"
              >
                Content Marketing
              </button>
              <button
                type="button"
                onClick={() => loadTemplate('fnb')}
                className="px-2.5 py-1 bg-white hover:bg-[#EBF2EB] border border-[#E8E2D5] rounded-xl text-xs font-semibold text-[#2F5233] transition-colors"
              >
                F&B Phục vụ / Pha chế
              </button>
              <button
                type="button"
                onClick={() => loadTemplate('sales')}
                className="px-2.5 py-1 bg-white hover:bg-[#EBF2EB] border border-[#E8E2D5] rounded-xl text-xs font-semibold text-[#2F5233] transition-colors"
              >
                Tư vấn / Sales
              </button>
            </div>
          </div>

          <form onSubmit={handlePostSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-bold text-stone-800 mb-1">
                  Tiêu đề tuyển dụng <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="VD: Thực tập sinh Marketing, Lập trình React..."
                  className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:outline-none focus:border-[#2F5233] font-medium text-stone-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-800 mb-1">
                  Tên công ty / Doanh nghiệp <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Tên công ty hoặc thương hiệu..."
                  className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:outline-none focus:border-[#2F5233] font-medium text-stone-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-[11px] font-bold text-stone-800 mb-1">
                  Tỉnh / Thành phố
                </label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:outline-none focus:border-[#2F5233] text-stone-800"
                >
                  {CITIES.filter((c) => c !== 'Tất cả địa điểm').map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-800 mb-1">
                  Quận / Huyện
                </label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="VD: Quận 1, Cầu Giấy..."
                  className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:outline-none focus:border-[#2F5233] text-stone-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-800 mb-1">
                  Địa chỉ cụ thể
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="VD: Số 123 Đường Nguyễn Huệ..."
                  className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:outline-none focus:border-[#2F5233] text-stone-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-[11px] font-bold text-stone-800 mb-1">
                  Mức lương hiển thị
                </label>
                <input
                  type="text"
                  required
                  value={salaryText}
                  onChange={(e) => setSalaryText(e.target.value)}
                  placeholder="VD: 5 - 8 triệu / tháng, 35k/h..."
                  className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:outline-none focus:border-[#2F5233] font-medium text-stone-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-800 mb-1">
                  Khoảng lương phân loại
                </label>
                <select
                  value={salaryCategory}
                  onChange={(e) => setSalaryCategory(e.target.value as Job['salaryCategory'])}
                  className="w-full px-3 py-2.5 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:outline-none focus:border-[#2F5233] text-stone-800"
                >
                  {SALARY_CATEGORIES.filter((s) => s !== 'Tất cả mức lương').map((sc) => (
                    <option key={sc} value={sc}>
                      {sc}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-800 mb-1">
                  Loại hình công việc
                </label>
                <select
                  value={jobType}
                  onChange={(e) => setJobType(e.target.value as JobType)}
                  className="w-full px-3 py-2.5 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:outline-none focus:border-[#2F5233] text-stone-800"
                >
                  <option value="Part-time">Part-time (Bán thời gian)</option>
                  <option value="Thực tập">Thực tập (Internship)</option>
                  <option value="Full-time">Full-time (Toàn thời gian)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-[11px] font-bold text-stone-800 mb-1">
                  Hình thức làm việc
                </label>
                <select
                  value={workMode}
                  onChange={(e) => setWorkMode(e.target.value as WorkMode)}
                  className="w-full px-3 py-2.5 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:outline-none focus:border-[#2F5233] text-stone-800"
                >
                  <option value="Tại văn phòng">Tại văn phòng</option>
                  <option value="Làm từ xa (Remote)">Làm từ xa (Remote)</option>
                  <option value="Linh hoạt (Hybrid)">Linh hoạt (Hybrid)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-800 mb-1">
                  Yêu cầu kinh nghiệm
                </label>
                <select
                  value={experience}
                  onChange={(e) => setExperience(e.target.value as ExperienceLevel)}
                  className="w-full px-3 py-2.5 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:outline-none focus:border-[#2F5233] text-stone-800"
                >
                  <option value="Chưa có kinh nghiệm">Chưa có kinh nghiệm</option>
                  <option value="Dưới 6 tháng">Dưới 6 tháng</option>
                  <option value="Từ 6 tháng - 1 năm">Từ 6 tháng - 1 năm</option>
                  <option value="Trên 1 năm">Trên 1 năm</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-800 mb-1">
                  Ngành học phù hợp
                </label>
                <select
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:outline-none focus:border-[#2F5233] text-stone-800"
                >
                  {STANDARD_MAJORS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-800 mb-1.5">
                Ca làm việc tuyển dụng
              </label>
              <div className="flex flex-wrap gap-2">
                {shiftOptions.map((slot) => {
                  const isChecked = availableShifts.includes(slot);
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => toggleShift(slot)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        isChecked
                          ? 'bg-[#2F5233] border-[#2F5233] text-white shadow-2xs'
                          : 'bg-white border-[#E8E2D5] text-stone-700 hover:border-stone-400'
                      }`}
                    >
                      {isChecked ? '✓ ' : '+ '}
                      {slot}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-800 mb-1">
                Kỹ năng mong muốn (ngăn cách bởi dấu phẩy)
              </label>
              <input
                type="text"
                value={skillsInput}
                onChange={(e) => setSkillsInput(e.target.value)}
                placeholder="VD: Giao tiếp, Tiếng Anh, ReactJS, Canva, Excel..."
                className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:outline-none focus:border-[#2F5233] text-stone-800"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-800 mb-1">
                Mô tả công việc
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:outline-none focus:border-[#2F5233] text-stone-800"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-bold text-stone-800 mb-1">
                  Yêu cầu ứng viên
                </label>
                <textarea
                  rows={2}
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:outline-none focus:border-[#2F5233] text-stone-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-800 mb-1">
                  Quyền lợi sinh viên nhận được
                </label>
                <textarea
                  rows={2}
                  value={benefits}
                  onChange={(e) => setBenefits(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:outline-none focus:border-[#2F5233] text-stone-800"
                />
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[#E8E2D5]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoApprove}
                  onChange={(e) => setAutoApprove(e.target.checked)}
                  className="w-4 h-4 rounded text-[#2F5233] focus:ring-[#2F5233]"
                />
                <span className="text-xs font-semibold text-stone-800">
                  Công khai ngay lên trang chủ JobsHub
                </span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSubTab('manage-jobs')}
                  className="px-4 py-2.5 rounded-xl border border-[#E8E2D5] text-stone-700 font-semibold hover:bg-[#FAF7F2]"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isPosting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#2F5233] hover:bg-[#244127] active:scale-95 disabled:opacity-60 text-white font-bold rounded-xl shadow-xs transition-all"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{isPosting ? 'Đang đăng...' : 'Đăng bài tuyển dụng'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {previewCvApp && previewCvApp.cvSnapshot && renderCvModal(previewCvApp.cvSnapshot, previewCvApp)}
    </div>
  );
};

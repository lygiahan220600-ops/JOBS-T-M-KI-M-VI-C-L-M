import React, { useState, useEffect, useCallback } from 'react';
import {
  Heart,
  FileText,
  CheckCircle2,
  ArrowRight,
  MessageSquare,
  LogIn,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import {
  AICVData,
  ApplicationStatus,
  AppNotification,
  CVLanguage,
  CVTemplateId,
  ChatConversation,
  Job,
  JobApplication,
  Language,
  SavedCVRecord,
  SearchFilterState,
  StudentProfile,
  UserAccount,
} from './types';
import { EMPTY_STUDENT_PROFILE, INITIAL_JOBS } from './data/mockJobs';
import { useTranslation, SUPPORTED_LANGUAGES } from './data/translations';
import {
  apiCreateJob,
  apiDeleteCV,
  apiDeleteJob,
  apiGetMe,
  apiGetProfile,
  apiGetSavedJobs,
  apiListApplications,
  apiListConversations,
  apiListJobs,
  apiListNotifications,
  apiListSavedCVs,
  apiLogout,
  apiMarkConversationRead,
  apiOpenConversation,
  apiRemoveSavedJob,
  apiSaveCV,
  apiSaveProfile,
  apiSendMessage,
  apiSubmitApplication,
  apiToggleSavedJob,
  apiUpdateApplicationStatus,
  apiUpdateJobStatus,
  clearStoredToken,
  getStoredToken,
} from './services/api';
import { MobileTopBar } from './components/MobileTopBar';
import { BottomNav, MobileTab } from './components/BottomNav';
import { MobileHomeView } from './components/MobileHomeView';
import { MobileSearchView } from './components/MobileSearchView';
import { MobileJobDetail } from './components/MobileJobDetail';
import { ProfileView } from './components/ProfileView';
import { ProfileSidebar } from './components/ProfileSidebar';
import { MobileAuthModal } from './components/MobileAuthModal';
import { MobileJobCard } from './components/MobileJobCard';
import { EmployerDashboard } from './components/EmployerDashboard';
import { ChatView } from './components/ChatView';
import { AICvBuilderView } from './components/AICvBuilderView';
import { QuickApplyModal } from './components/QuickApplyModal';

function getAppStatusBadgeClass(status: ApplicationStatus): string {
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

export default function App() {
  const [lang, setLang] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('jobshub_lang');
      const isValid = SUPPORTED_LANGUAGES.some((l) => l.code === saved);
      return isValid ? (saved as Language) : 'vi';
    } catch {
      return 'vi';
    }
  });

  const t = useTranslation(lang);

  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Real Server-Synced State (no fake default saved IDs, no mock conversations)
  const [jobs, setJobs] = useState<Job[]>(INITIAL_JOBS);
  const [savedJobIds, setSavedJobIds] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [profile, setProfile] = useState<StudentProfile>(EMPTY_STUDENT_PROFILE);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [savedCVs, setSavedCVs] = useState<SavedCVRecord[]>([]);
  const [, setNotifications] = useState<AppNotification[]>([]);

  // Modals & Drawers
  const [quickApplyJob, setQuickApplyJob] = useState<Job | null>(null);
  const [quickApplyOpen, setQuickApplyOpen] = useState(false);
  const [isProfileSidebarOpen, setIsProfileSidebarOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [searchFilters, setSearchFilters] = useState<SearchFilterState>({
    keyword: '',
    location: 'Tất cả địa điểm',
    jobType: 'Tất cả loại hình',
    salaryCategory: 'Tất cả mức lương',
    experience: 'Tất cả kinh nghiệm',
    major: 'Tất cả ngành học',
    workMode: 'Tất cả hình thức',
    shift: 'Tất cả ca làm',
  });

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3400);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('jobshub_lang', lang);
    } catch {}
  }, [lang]);

  const loadJobs = useCallback(async () => {
    try {
      const res = await apiListJobs();
      setJobs(res.jobs);
    } catch {
      // ignore transient error
    }
  }, []);

  const loadAuthenticatedData = useCallback(async () => {
    try {
      const [profRes, savedRes, appsRes, convsRes, cvsRes, notifRes] = await Promise.all([
        apiGetProfile(),
        apiGetSavedJobs(),
        apiListApplications(),
        apiListConversations(),
        apiListSavedCVs(),
        apiListNotifications(),
      ]);
      setProfile(profRes.profile);
      setSavedJobIds(savedRes.savedJobIds);
      setApplications(appsRes.applications);
      setConversations(convsRes.conversations);
      setSavedCVs(cvsRes.cvs);
      setNotifications(notifRes.notifications);
    } catch {
      // ignore if session expired
    }
  }, []);

  // Restore user session & load jobs on initial mount
  useEffect(() => {
    let active = true;
    (async () => {
      await loadJobs();
      try {
        const me = await apiGetMe();
        if (!active) return;
        if (me.user) {
          setCurrentUser(me.user);
          await loadAuthenticatedData();
        } else {
          clearStoredToken();
        }
      } catch {
        clearStoredToken();
      } finally {
        if (active) setAuthChecked(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadJobs, loadAuthenticatedData]);

  // Real-time SSE listener when logged in
  useEffect(() => {
    if (!currentUser) return;
    const token = getStoredToken();
    const sseUrl = token
      ? `/api/events?token=${encodeURIComponent(token)}`
      : '/api/events';

    const es = new EventSource(sseUrl, { withCredentials: true });

    es.onmessage = async (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'jobs_updated') {
          await loadJobs();
        } else if (payload.type === 'message') {
          const [convsRes, notifRes] = await Promise.all([
            apiListConversations(),
            apiListNotifications(),
          ]);
          setConversations(convsRes.conversations);
          setNotifications(notifRes.notifications);
          if (
            activeTab !== 'messages' ||
            (payload.conversationId && payload.conversationId !== activeConvId)
          ) {
            const targetConv = convsRes.conversations.find(
              (c) => c.id === payload.conversationId
            );
            if (targetConv && targetConv.unreadCount > 0) {
              showToast(`Tin nhắn mới từ ${targetConv.participantName}`);
            }
          }
        } else if (payload.type === 'conversation_read') {
          const convsRes = await apiListConversations();
          setConversations(convsRes.conversations);
        } else if (
          payload.type === 'application_created' ||
          payload.type === 'application_updated'
        ) {
          const [appsRes, notifRes] = await Promise.all([
            apiListApplications(),
            apiListNotifications(),
          ]);
          setApplications(appsRes.applications);
          setNotifications(notifRes.notifications);
          if (payload.type === 'application_created' && currentUser.role === 'employer') {
            showToast('Bạn có đơn ứng tuyển mới từ ứng viên!');
          } else if (
            payload.type === 'application_updated' &&
            currentUser.role === 'candidate'
          ) {
            showToast(`Nhà tuyển dụng đã cập nhật trạng thái hồ sơ: ${payload.status}`);
          }
        }
      } catch {
        // ignore parse errors
      }
    };

    return () => {
      es.close();
    };
  }, [currentUser, activeTab, activeConvId, loadJobs, showToast]);

  const requireAuth = useCallback(
    (msg: string) => {
      showToast(msg);
      setAuthMode('login');
      setAuthModalOpen(true);
    },
    [showToast]
  );

  const handleSelectLang = (newLang: Language) => {
    setLang(newLang);
    const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === newLang);
    showToast(langObj ? `Đã chuyển sang ${langObj.name} (${langObj.flag})` : 'Language updated');
  };

  const handleToggleSaveJob = async (jobId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentUser) {
      requireAuth('Vui lòng đăng nhập để lưu bài đăng yêu thích');
      return;
    }

    try {
      const res = await apiToggleSavedJob(jobId);
      setSavedJobIds(res.savedJobIds);
      const targetJob = jobs.find((j) => j.id === jobId);
      const title = targetJob ? targetJob.title : 'bài đăng';
      if (res.saved) {
        showToast(`Đã lưu "${title}" vào danh sách yêu thích`);
      } else {
        showToast(`Đã bỏ lưu "${title}"`);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể cập nhật bài đăng đã lưu.');
    }
  };

  const handleRemoveDeletedSavedJob = async (jobId: string) => {
    if (!currentUser) return;
    try {
      const res = await apiRemoveSavedJob(jobId);
      setSavedJobIds(res.savedJobIds);
      showToast('Đã xóa bài đăng khỏi danh sách đã lưu.');
    } catch {
      showToast('Không thể xóa bài đăng khỏi danh sách đã lưu.');
    }
  };

  const handleSelectJob = (job: Job) => {
    setSelectedJob(job);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleChangeTab = (tab: MobileTab) => {
    setSelectedJob(null);
    setActiveTab(tab);
    if (tab === 'profile') {
      setIsProfileSidebarOpen(true);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuickApply = (job: Job, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentUser) {
      requireAuth('Vui lòng đăng nhập để ứng tuyển vào bài đăng này');
      return;
    }
    if (currentUser.role === 'employer') {
      showToast('Tài khoản Nhà tuyển dụng không thể nộp đơn ứng tuyển.');
      return;
    }
    if (applications.some((a) => a.jobId === job.id)) {
      showToast('Bạn đã ứng tuyển vào vị trí này rồi.');
      return;
    }
    setQuickApplyJob(job);
    setQuickApplyOpen(true);
  };

  const handleSubmitApplication = async (data: {
    jobId: string;
    fullName: string;
    email: string;
    phone: string;
    university: string;
    major: string;
    availableShifts: string;
    note: string;
    cvId?: string;
  }): Promise<boolean> => {
    if (!currentUser) {
      requireAuth('Vui lòng đăng nhập trước khi ứng tuyển');
      return false;
    }
    try {
      const res = await apiSubmitApplication(data);
      setApplications((prev) => [res.application, ...prev]);
      showToast('Ứng tuyển thành công');
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể gửi đơn ứng tuyển.');
      return false;
    }
  };

  const handleSaveProfile = async (
    updatedProfile: StudentProfile
  ): Promise<boolean> => {
    if (!currentUser) {
      requireAuth('Vui lòng đăng nhập hoặc đăng ký để lưu hồ sơ cá nhân!');
      return false;
    }
    try {
      const res = await apiSaveProfile(updatedProfile);
      setProfile(res.profile);
      setCurrentUser(res.user);
      showToast('Đã lưu thông tin cá nhân vào tài khoản thành công!');
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể lưu hồ sơ cá nhân.');
      return false;
    }
  };

  const handleSaveProfilePartial = async (
    partial: Partial<StudentProfile>
  ): Promise<boolean> => {
    return handleSaveProfile({ ...profile, ...partial });
  };

  const handleAuthSuccess = async (user: UserAccount, message: string) => {
    setCurrentUser(user);
    await loadAuthenticatedData();
    await loadJobs();
    showToast(message);
    if (user.role === 'employer') {
      setActiveTab('employer');
    }
  };

  const handleLogout = async () => {
    await apiLogout();
    setCurrentUser(null);
    setProfile(EMPTY_STUDENT_PROFILE);
    setSavedJobIds([]);
    setApplications([]);
    setConversations([]);
    setSavedCVs([]);
    setNotifications([]);
    setActiveConvId(null);
    setIsProfileSidebarOpen(false);
    setActiveTab('home');
    showToast('Đã đăng xuất tài khoản an toàn.');
  };

  // Employer Actions
  const handleAddJob = async (jobPayload: Omit<Job, 'id' | 'employerId'>) => {
    try {
      const res = await apiCreateJob(jobPayload);
      setJobs((prev) => [res.job, ...prev]);
      showToast('Đã đăng bài tuyển dụng thành công!');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể đăng bài tuyển dụng.');
    }
  };

  const handleUpdateJobStatus = async (
    jobId: string,
    status: 'published' | 'pending' | 'closed'
  ) => {
    try {
      const res = await apiUpdateJobStatus(jobId, status);
      setJobs((prev) => prev.map((j) => (j.id === jobId ? res.job : j)));
      showToast(
        status === 'published'
          ? 'Đã công khai bài tuyển dụng!'
          : status === 'closed'
          ? 'Đã tạm đóng bài tuyển dụng'
          : 'Đã chuyển sang trạng thái chờ duyệt'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái bài đăng.');
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      await apiDeleteJob(jobId);
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
      showToast('Đã xóa bài tuyển dụng');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể xóa bài tuyển dụng.');
    }
  };

  const handleUpdateAppStatus = async (appId: string, status: ApplicationStatus) => {
    try {
      const res = await apiUpdateApplicationStatus(appId, status);
      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? res.application : a))
      );
      showToast(`Đã cập nhật trạng thái hồ sơ: ${status}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái hồ sơ.');
    }
  };

  // Real 2-Way Chat Actions
  const upsertConversation = (conv: ChatConversation) => {
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === conv.id);
      if (idx === -1) return [conv, ...prev];
      const next = [...prev];
      next[idx] = conv;
      return next;
    });
  };

  const handleOpenChatWithEmployer = async (job: Job, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentUser) {
      requireAuth('Vui lòng đăng nhập để nhắn tin với nhà tuyển dụng');
      return;
    }
    try {
      const res = await apiOpenConversation({ jobId: job.id });
      upsertConversation(res.conversation);
      setActiveConvId(res.conversation.id);
      setSelectedJob(null);
      setActiveTab('messages');
      if (res.conversation.unreadCount > 0) {
        await apiMarkConversationRead(res.conversation.id);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể mở cuộc trò chuyện.');
    }
  };

  const handleOpenChatWithCandidate = async (
    candidateId: string,
    candidateName: string,
    jobId: string,
    jobTitle: string
  ) => {
    if (!currentUser) {
      requireAuth('Vui lòng đăng nhập để nhắn tin với ứng viên');
      return;
    }
    try {
      const res = await apiOpenConversation({
        targetUserId: candidateId,
        targetName: candidateName,
        jobId,
        jobTitle,
        companyName: currentUser.companyName || currentUser.fullName,
      });
      upsertConversation(res.conversation);
      setActiveConvId(res.conversation.id);
      setSelectedJob(null);
      setActiveTab('messages');
      if (res.conversation.unreadCount > 0) {
        await apiMarkConversationRead(res.conversation.id);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể mở cuộc trò chuyện.');
    }
  };

  const handleSelectConversation = async (convId: string) => {
    setActiveConvId(convId);
    const target = conversations.find((c) => c.id === convId);
    if (target && target.unreadCount > 0) {
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
      );
      try {
        await apiMarkConversationRead(convId);
      } catch {
        // ignore
      }
    }
  };

  const handleSendMessage = async (convId: string, text: string) => {
    if (!currentUser) {
      requireAuth('Vui lòng đăng nhập để gửi tin nhắn');
      return;
    }
    try {
      const res = await apiSendMessage(convId, text);
      upsertConversation(res.conversation);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể gửi tin nhắn.');
    }
  };

  // Saved AI CV Actions
  const handleSaveCV = async (payload: {
    id?: string;
    name: string;
    targetJob: string;
    language: CVLanguage;
    template: CVTemplateId;
    accentColor: string;
    layout: 'single' | 'two-column';
    data: AICVData;
  }): Promise<SavedCVRecord | null> => {
    try {
      const res = await apiSaveCV(payload);
      setSavedCVs((prev) => {
        const idx = prev.findIndex((c) => c.id === res.cv.id);
        if (idx === -1) return [res.cv, ...prev];
        const next = [...prev];
        next[idx] = res.cv;
        return next;
      });
      showToast(`Đã lưu CV "${res.cv.name}" vào tài khoản!`);
      return res.cv;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể lưu CV.');
      return null;
    }
  };

  const handleDeleteCV = async (cvId: string) => {
    try {
      await apiDeleteCV(cvId);
      setSavedCVs((prev) => prev.filter((c) => c.id !== cvId));
      showToast('Đã xóa CV.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể xóa CV.');
    }
  };

  const appliedJobIds = applications.map((a) => a.jobId);
  const unreadMessagesCount = conversations.reduce(
    (acc, c) => acc + (c.unreadCount || 0),
    0
  );

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-stone-900 flex flex-col antialiased relative">
      {/* Top Bar */}
      <MobileTopBar
        lang={lang}
        onSelectLang={handleSelectLang}
        currentUser={currentUser}
        onOpenAuth={() => {
          setAuthMode('login');
          setAuthModalOpen(true);
        }}
        onOpenProfileSidebar={() => setIsProfileSidebarOpen(true)}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="no-print fixed top-16 left-1/2 -translate-x-1/2 z-[90] w-auto max-w-[90vw] bg-[#1E3821]/95 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-fadeIn border border-white/15">
          <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto">
        {!authChecked ? (
          <div className="p-8 text-center text-xs text-stone-600">
            Đang đồng bộ dữ liệu tài khoản...
          </div>
        ) : selectedJob ? (
          <MobileJobDetail
            job={selectedJob}
            isSaved={savedJobIds.includes(selectedJob.id)}
            hasApplied={appliedJobIds.includes(selectedJob.id)}
            profile={profile}
            currentUser={currentUser}
            savedCVs={savedCVs}
            lang={lang}
            onBack={() => setSelectedJob(null)}
            onToggleSave={(id) => handleToggleSaveJob(id)}
            onOpenChat={(job) => handleOpenChatWithEmployer(job)}
            onRequireAuth={requireAuth}
            onSubmitApplication={handleSubmitApplication}
          />
        ) : activeTab === 'home' ? (
          <MobileHomeView
            jobs={jobs}
            savedJobIds={savedJobIds}
            appliedJobIds={appliedJobIds}
            profile={profile}
            lang={lang}
            onSelectJob={handleSelectJob}
            onToggleSave={handleToggleSaveJob}
            onApplyQuick={handleQuickApply}
            onOpenMessage={handleOpenChatWithEmployer}
            onNavigateToSearch={(q) => {
              setSearchFilters((prev) => ({ ...prev, keyword: q }));
              handleChangeTab('search');
            }}
            onNavigateToTab={(tab) => handleChangeTab(tab as MobileTab)}
          />
        ) : activeTab === 'search' ? (
          <MobileSearchView
            jobs={jobs}
            filters={searchFilters}
            setFilters={setSearchFilters}
            savedJobIds={savedJobIds}
            appliedJobIds={appliedJobIds}
            lang={lang}
            onSelectJob={handleSelectJob}
            onToggleSave={handleToggleSaveJob}
            onApplyQuick={handleQuickApply}
            onOpenMessage={handleOpenChatWithEmployer}
          />
        ) : activeTab === 'messages' ? (
          <ChatView
            currentUser={currentUser}
            conversations={conversations}
            activeConvId={activeConvId}
            jobs={jobs}
            lang={lang}
            onSelectConversation={handleSelectConversation}
            onSendMessage={handleSendMessage}
            onBackToList={() => setActiveConvId(null)}
            onViewJobDetail={handleSelectJob}
            onNavigateToHome={() => handleChangeTab('home')}
            onOpenAuth={() => {
              setAuthMode('login');
              setAuthModalOpen(true);
            }}
          />
        ) : activeTab === 'ai-cv' ? (
          <AICvBuilderView
            profile={profile}
            currentUser={currentUser}
            savedCVs={savedCVs}
            lang={lang}
            onSaveToProfile={handleSaveProfilePartial}
            onSaveCV={handleSaveCV}
            onDeleteCV={handleDeleteCV}
            onRequireAuth={requireAuth}
            showToast={showToast}
          />
        ) : activeTab === 'employer' ? (
          <EmployerDashboard
            currentUser={currentUser}
            jobs={jobs}
            applications={applications}
            lang={lang}
            onAddJob={handleAddJob}
            onUpdateJobStatus={handleUpdateJobStatus}
            onDeleteJob={handleDeleteJob}
            onUpdateAppStatus={handleUpdateAppStatus}
            onOpenChatWithCandidate={handleOpenChatWithCandidate}
            onViewJobDetail={handleSelectJob}
            onSwitchToCandidate={() => handleChangeTab('home')}
            onOpenAuth={() => {
              setAuthMode('login');
              setAuthModalOpen(true);
            }}
          />
        ) : activeTab === 'saved' ? (
          /* SAVED JOBS PAGE */
          <div className="w-full px-3 sm:px-6 py-4 pb-28 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg sm:text-xl font-black text-stone-900 font-display flex items-center gap-2">
                  <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
                  <span>Bài đăng đã lưu</span>
                </h1>
                <p className="text-xs text-stone-600 mt-0.5">
                  {currentUser
                    ? `${savedJobIds.length} bài đăng yêu thích trong tài khoản của bạn`
                    : 'Đăng nhập để lưu và quản lý các bài tuyển dụng yêu thích'}
                </p>
              </div>
            </div>

            {!currentUser ? (
              <div className="bg-white border border-[#E8E2D5] rounded-3xl p-8 text-center shadow-xs mt-4">
                <Heart className="w-10 h-10 text-rose-300 mx-auto mb-2" />
                <h2 className="text-sm font-bold text-stone-900">
                  Vui lòng đăng nhập để lưu bài đăng yêu thích
                </h2>
                <p className="text-xs text-stone-600 mt-1 max-w-md mx-auto">
                  Các bài đăng bạn lưu sẽ được đồng bộ theo tài khoản để bạn xem lại, ứng tuyển và nhắn tin với nhà tuyển dụng bất kỳ lúc nào.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthModalOpen(true);
                  }}
                  className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#2F5233] hover:bg-[#244127] text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Đăng nhập ngay</span>
                </button>
              </div>
            ) : savedJobIds.length === 0 ? (
              <div className="bg-white border border-[#E8E2D5] rounded-3xl p-8 text-center shadow-xs mt-4">
                <Heart className="w-10 h-10 text-stone-300 mx-auto mb-2" />
                <h2 className="text-sm font-bold text-stone-900">
                  Bạn chưa lưu bài đăng nào
                </h2>
                <p className="text-xs text-stone-600 mt-1">
                  Nhấn biểu tượng trái tim trên các bài tuyển dụng để lưu lại và xem nhanh tại đây.
                </p>
                <button
                  type="button"
                  onClick={() => handleChangeTab('home')}
                  className="mt-4 px-5 py-2.5 bg-[#2F5233] hover:bg-[#244127] text-white rounded-xl text-xs font-bold"
                >
                  Khám phá việc làm ngay
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {savedJobIds.map((savedId) => {
                  const job = jobs.find((j) => j.id === savedId);
                  if (!job) {
                    return (
                      <div
                        key={savedId}
                        className="bg-white border border-[#E8E2D5] rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3"
                      >
                        <div className="flex items-start gap-2.5 text-xs text-stone-600">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-stone-800">
                              Bài đăng không còn khả dụng
                            </p>
                            <p className="text-[11px] mt-0.5">
                              Tin tuyển dụng này đã bị nhà tuyển dụng xóa hoặc gỡ khỏi hệ thống.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveDeletedSavedJob(savedId)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa khỏi danh sách đã lưu</span>
                        </button>
                      </div>
                    );
                  }

                  return (
                    <MobileJobCard
                      key={job.id}
                      job={job}
                      isSaved={true}
                      hasApplied={appliedJobIds.includes(job.id)}
                      lang={lang}
                      onSelect={handleSelectJob}
                      onToggleSave={handleToggleSaveJob}
                      onApplyQuick={handleQuickApply}
                      onOpenMessage={handleOpenChatWithEmployer}
                    />
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === 'applications' ? (
          /* APPLICATIONS HISTORY FOR CANDIDATE */
          <div className="w-full px-3 sm:px-6 py-4 pb-28 space-y-3.5">
            <div>
              <h1 className="text-lg sm:text-xl font-black text-stone-900 font-display">
                {t.applicationsTab}
              </h1>
              <p className="text-xs text-stone-600">
                {currentUser ? `${applications.length} đơn đã nộp` : 'Đăng nhập để theo dõi đơn ứng tuyển'}
              </p>
            </div>

            {!currentUser ? (
              <div className="bg-white border border-[#E8E2D5] rounded-3xl p-8 text-center shadow-xs mt-4">
                <FileText className="w-10 h-10 text-stone-300 mx-auto mb-2" />
                <h2 className="text-sm font-bold text-stone-900">
                  Đăng nhập để xem lịch sử ứng tuyển
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthModalOpen(true);
                  }}
                  className="mt-4 px-5 py-2.5 bg-[#2F5233] text-white rounded-xl text-xs font-bold"
                >
                  Đăng nhập ngay
                </button>
              </div>
            ) : applications.length === 0 ? (
              <div className="bg-white border border-[#E8E2D5] rounded-3xl p-8 text-center shadow-xs mt-4">
                <FileText className="w-10 h-10 text-stone-300 mx-auto mb-2" />
                <h2 className="text-sm font-bold text-stone-900">
                  {t.noAppliedJobs}
                </h2>
                <p className="text-xs text-stone-600 mt-1">
                  {t.noAppliedJobsDesc}
                </p>
                <button
                  type="button"
                  onClick={() => handleChangeTab('home')}
                  className="mt-4 px-5 py-2.5 bg-[#2F5233] text-white rounded-xl text-xs font-bold"
                >
                  {t.homeTab}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {applications.map((app) => {
                  const targetJob = jobs.find((j) => j.id === app.jobId);
                  return (
                    <div
                      key={app.id}
                      className="bg-white border border-[#E8E2D5] rounded-2xl p-4 shadow-xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${getAppStatusBadgeClass(
                            app.status
                          )}`}
                        >
                          {app.status}
                        </span>
                        <span className="text-xs text-stone-500 tabular-nums">
                          {app.appliedAt}
                        </span>
                      </div>

                      <div>
                        <h2 className="text-sm font-bold text-stone-900">{app.jobTitle}</h2>
                        <p className="text-xs text-[#2F5233] font-semibold">
                          {app.companyName}
                        </p>
                      </div>

                      {app.cvSnapshot && (
                        <div className="text-[11px] text-[#2F5233] bg-[#EBF2EB] px-2.5 py-1 rounded-lg inline-flex items-center gap-1 font-medium">
                          <FileText className="w-3 h-3" />
                          <span>CV đính kèm: {app.cvSnapshot.name}</span>
                        </div>
                      )}

                      <div className="text-xs text-stone-600 pt-2 border-t border-[#E8E2D5] flex items-center justify-between gap-2">
                        <span className="truncate">Ứng viên: {app.fullName}</span>
                        <div className="flex items-center gap-2.5 shrink-0">
                          {targetJob && (
                            <button
                              type="button"
                              onClick={() => handleOpenChatWithEmployer(targetJob)}
                              className="text-[#2F5233] font-bold flex items-center gap-1 hover:underline text-xs"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>Nhắn tin</span>
                            </button>
                          )}
                          {targetJob && (
                            <button
                              type="button"
                              onClick={() => handleSelectJob(targetJob)}
                              className="text-stone-700 font-bold flex items-center gap-0.5 hover:text-stone-900"
                            >
                              <span>Xem tin</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* PROFILE VIEW */
          <ProfileView
            profile={profile}
            onSaveProfile={handleSaveProfile}
            currentUser={currentUser}
            onLogout={handleLogout}
            onNavigateToAiCv={() => handleChangeTab('ai-cv')}
            lang={lang}
          />
        )}
      </main>

      {/* Quick Apply Modal */}
      <QuickApplyModal
        job={quickApplyJob}
        isOpen={quickApplyOpen}
        profile={profile}
        currentUser={currentUser}
        savedCVs={savedCVs}
        lang={lang}
        onClose={() => {
          setQuickApplyOpen(false);
          setQuickApplyJob(null);
        }}
        onSubmit={handleSubmitApplication}
      />

      {/* Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={handleChangeTab}
        savedCount={savedJobIds.length}
        applicationsCount={applications.length}
        unreadMessagesCount={unreadMessagesCount}
        currentUser={currentUser}
        lang={lang}
      />

      {/* Slide bar hồ sơ cá nhân */}
      <ProfileSidebar
        isOpen={isProfileSidebarOpen}
        onClose={() => setIsProfileSidebarOpen(false)}
        profile={profile}
        currentUser={currentUser}
        onSaveProfile={handleSaveProfile}
        onLogout={handleLogout}
        onNavigateToAiCv={() => handleChangeTab('ai-cv')}
        lang={lang}
      />

      {/* Auth Modal */}
      <MobileAuthModal
        isOpen={authModalOpen}
        initialMode={authMode}
        lang={lang}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}

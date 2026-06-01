import React, { useState, useEffect } from "react";
import { Resident, Household, WorkSchedule, DocumentTemplate, GeneratedDocument, ActivityLog, UserRole } from "./types";
import Dashboard from "./components/Dashboard";
import ResidentsManager from "./components/ResidentsManager";
import Organizations from "./components/Organizations";
import CalendarSchedule from "./components/CalendarSchedule";
import AiComposer from "./components/AiComposer";
import RoleAndLogs from "./components/RoleAndLogs";
import BusinessesManager from "./components/BusinessesManager";
import AuthScreen from "./components/AuthScreen";
import OfficialDocumentsManager from "./components/OfficialDocumentsManager";
import GisAddressManager from "./components/GisAddressManager";
import { LayoutDashboard, Users, HeartHandshake, CalendarClock, PenTool, ShieldAlert, CheckCircle, RefreshCw, Clock, Building2, LogOut, Key, Check, Eye, EyeOff, FileDown, FileUp, Map } from "lucide-react";
import { formatTime } from "./utils/dateTimeUtils";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  
  // Current user state for secure administrator access
  const [currentUser, setCurrentUser] = useState<any | null>(() => {
    const saved = localStorage.getItem("kp3_admin_user");
    return saved ? JSON.parse(saved) : null;
  });

  const [activeRole, setActiveRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem("kp3_admin_user");
    if (saved) {
      const u = JSON.parse(saved);
      return u.role;
    }
    return "Trưởng Ban điều hành";
  });

  // Password Change state variables
  const [showChangePass, setShowChangePass] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changePassError, setChangePassError] = useState("");
  const [changePassSuccess, setChangePassSuccess] = useState("");
  const [changePassLoading, setChangePassLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // AI Configuration state variables
  const [showAiConfig, setShowAiConfig] = useState(false);
  const [aiKey, setAiKey] = useState("");
  const [maskedAiKey, setMaskedAiKey] = useState("");
  const [aiConfigError, setAiConfigError] = useState("");
  const [aiConfigSuccess, setAiConfigSuccess] = useState("");
  const [aiConfigLoading, setAiConfigLoading] = useState(false);

  // Calculate secure effective role based on explicit authorization approval status
  // If canEdit flag is false on the account, force their effective role to "Người xem báo cáo" (Read-only)
  const effectiveRole = (currentUser && currentUser.canEdit !== false) ? activeRole : "Người xem báo cáo";

  const ALLOWED_ROLES_FOR_LOGS = ["Super Admin", "Super Mod", "Bí thư Chi bộ", "Trưởng Khu phố", "Trưởng ban công tác Mặt trận"];

  useEffect(() => {
    if (activeTab === "roles" && !ALLOWED_ROLES_FOR_LOGS.includes(effectiveRole)) {
      setActiveTab("dashboard");
    }
  }, [activeTab, effectiveRole]);

  // State arrays populated from API
  const [residents, setResidents] = useState<Resident[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [errorString, setErrorString] = useState("");
  const [liveTime, setLiveTime] = useState("");

  const fetchDatabaseState = async () => {
    setIsLoading(true);
    setErrorString("");
    try {
      const res = await fetch("/api/db", {
        headers: {
          "x-user-email": encodeURIComponent(currentUser?.email || ""),
          "x-user-role": encodeURIComponent(effectiveRole || ""),
          "x-user-name": encodeURIComponent(currentUser?.fullName || "")
        }
      });
      if (!res.ok) {
        throw new Error("Không thể liên kết cổng dữ liệu.");
      }
      const data = await res.json();
      setResidents(data.residents || []);
      setHouseholds(data.households || []);
      setSchedules(data.schedules || []);
      setTemplates(data.templates || []);
      setDocuments(data.documents || []);
      setLogs(data.logs || []);
    } catch (err: any) {
      setErrorString("Đã xảy ra sự cố nạp dữ liệu. Hãy khởi động lại Dev Server.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDatabaseState();
  }, [currentUser?.email]);

  useEffect(() => {
    // Live clock ticks
    const updateClock = () => {
      const now = new Date();
      setLiveTime(formatTime(now));
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLoginSuccess = (user: any) => {
    setCurrentUser(user);
    setActiveRole(user.role);
    localStorage.setItem("kp3_admin_user", JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("kp3_admin_user");
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePassError("");
    setChangePassSuccess("");

    if (!newPassword) {
      setChangePassError("Mật khẩu mới không được để trống!");
      return;
    }

    if (newPassword !== confirmPassword) {
      setChangePassError("Mật khẩu xác nhận không trùng khớp!");
      return;
    }

    if (newPassword.length < 4) {
      setChangePassError("Mật khẩu phải từ 4 ký tự trở lên để đảm bảo an toàn!");
      return;
    }

    setChangePassLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: currentUser?.email,
          currentPassword,
          newPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setChangePassError(data.error || "Không thể thực hiện đổi mật khẩu.");
      } else {
        setChangePassSuccess("Thay đổi mật khẩu cán bộ thành công!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        
        // Push an explicit system log locally to indicate change
        setLogs(prev => [
          {
            id: `log_loc_${Date.now()}`,
            userName: currentUser?.fullName || "Cán bộ",
            userRole: currentUser?.role || "Cán bộ",
            action: `Đổi mật khẩu tài khoản`,
            timestamp: new Date().toISOString(),
            details: `Thực hiện cấp lại mật khẩu mới cho tài khoản ${currentUser?.email}.`
          },
          ...prev
        ]);

        setTimeout(() => {
          setShowChangePass(false);
          setChangePassSuccess("");
        }, 1500);
      }
    } catch {
      setChangePassError("Lỗi kết nối máy chủ xác thực.");
    } finally {
      setChangePassLoading(false);
    }
  };

  const fetchAiConfig = async () => {
    if (!currentUser || !ALLOWED_ROLES_FOR_LOGS.includes(effectiveRole)) return;
    try {
      const res = await fetch("/api/config/gemini-key", {
        headers: {
          "x-user-email": encodeURIComponent(currentUser.email),
          "x-user-role": encodeURIComponent(effectiveRole)
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.hasKey) {
          setMaskedAiKey(data.maskedKey);
        } else {
          setMaskedAiKey("");
        }
      }
    } catch (err) {
      console.error("Failed to load Gemini API key config:", err);
    }
  };

  useEffect(() => {
    fetchAiConfig();
  }, [currentUser, effectiveRole, showAiConfig]);

  const handleSaveAiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setAiConfigError("");
    setAiConfigSuccess("");
    setAiConfigLoading(true);

    try {
      const res = await fetch("/api/config/gemini-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": encodeURIComponent(currentUser.email),
          "x-user-role": encodeURIComponent(effectiveRole)
        },
        body: JSON.stringify({ apiKey: aiKey })
      });

      const data = await res.json();
      if (!res.ok) {
        setAiConfigError(data.error || "Không thể lưu cấu hình API Key.");
      } else {
        setAiConfigSuccess("Cấu hình Google AI Studio API Key thành công!");
        setAiKey("");
        fetchDatabaseState(); // refresh audit logs
        setTimeout(() => {
          setShowAiConfig(false);
          setAiConfigSuccess("");
        }, 1500);
      }
    } catch {
      setAiConfigError("Lỗi kết nối máy chủ cấu hình.");
    } finally {
      setAiConfigLoading(false);
    }
  };

  if (!currentUser) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f8fafc]">
      {/* 1. SIDEBAR NAVIGATION PANEL */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col justify-between border-r border-slate-800 shrink-0 no-print">
        <div>
          {/* Brand header */}
          <div className="p-5 border-b border-slate-800 flex items-center gap-3">
            <span className="p-2 bg-emerald-600 text-white rounded-xl shadow-md">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-sm font-extrabold text-white tracking-wide">Smart Khu Phố 3</h1>
              <p className="text-[10px] text-emerald-400 font-semibold uppercase">Hệ Thống Số Hóa</p>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="p-4 space-y-1">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`w-full py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-2.5 cursor-pointer transition ${activeTab === "dashboard" ? "bg-emerald-600 text-white shadow" : "hover:bg-slate-800 text-slate-400 hover:text-white"}`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Tổng Quan Khu Phố
            </button>

            <button
              onClick={() => setActiveTab("residents")}
              className={`w-full py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-2.5 cursor-pointer transition ${activeTab === "residents" ? "bg-emerald-600 text-white shadow" : "hover:bg-slate-800 text-slate-400 hover:text-white"}`}
            >
              <Users className="h-4 w-4" />
              Dân Cư & Hộ Khẩu
            </button>

            <button
              onClick={() => setActiveTab("businesses")}
              className={`w-full py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-2.5 cursor-pointer transition ${activeTab === "businesses" ? "bg-emerald-600 text-white shadow" : "hover:bg-slate-800 text-slate-400 hover:text-white"}`}
            >
              <Building2 className="h-4 w-4" />
              Cơ Sở Kinh Doanh
            </button>

            <button
              onClick={() => setActiveTab("organizations")}
              className={`w-full py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-2.5 cursor-pointer transition ${activeTab === "organizations" ? "bg-emerald-600 text-white shadow" : "hover:bg-slate-800 text-slate-400 hover:text-white"}`}
            >
              <HeartHandshake className="h-4 w-4" />
              Đoàn Thể & Đối Tượng
            </button>

            <button
              onClick={() => setActiveTab("calendar")}
              className={`w-full py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-2.5 cursor-pointer transition ${activeTab === "calendar" ? "bg-emerald-600 text-white shadow" : "hover:bg-slate-800 text-slate-400 hover:text-white"}`}
            >
              <CalendarClock className="h-4 w-4" />
              Lịch họp & Kế Hoạch
            </button>

            <button
              onClick={() => setActiveTab("ai-composer")}
              className={`w-full py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-2.5 cursor-pointer transition ${activeTab === "ai-composer" ? "bg-emerald-600 text-white shadow" : "hover:bg-slate-800 text-slate-400 hover:text-white"}`}
            >
              <PenTool className="h-4 w-4" />
              AI Soạn Thảo Văn Bản
            </button>

            <button
              onClick={() => setActiveTab("doc-incoming")}
              id="nav_doc_incoming"
              className={`w-full py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-2.5 cursor-pointer transition ${activeTab === "doc-incoming" ? "bg-emerald-600 text-white shadow" : "hover:bg-slate-800 text-slate-400 hover:text-white"}`}
            >
              <FileDown className="h-4 w-4 text-amber-500" />
              Văn Bản Đến
            </button>

            <button
              onClick={() => setActiveTab("doc-outgoing")}
              id="nav_doc_outgoing"
              className={`w-full py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-2.5 cursor-pointer transition ${activeTab === "doc-outgoing" ? "bg-emerald-600 text-white shadow" : "hover:bg-slate-800 text-slate-400 hover:text-white"}`}
            >
              <FileUp className="h-4 w-4 text-teal-500" />
              Văn Bản Gửi Đi
            </button>

            <button
              onClick={() => setActiveTab("gis-address")}
              id="nav_gis_address"
              className={`w-full py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-2.5 cursor-pointer transition ${activeTab === "gis-address" ? "bg-emerald-600 text-white shadow" : "hover:bg-slate-800 text-slate-400 hover:text-white"}`}
            >
              <Map className="h-4 w-4 text-emerald-400" />
              Địa Chỉ Số (GIS)
            </button>

            {ALLOWED_ROLES_FOR_LOGS.includes(effectiveRole) && (
              <button
                onClick={() => setActiveTab("roles")}
                className={`w-full py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-2.5 cursor-pointer transition ${activeTab === "roles" ? "bg-emerald-600 text-white shadow" : "hover:bg-slate-800 text-slate-400 hover:text-white"}`}
              >
                <ShieldAlert className="h-4 w-4" />
                Phân Quyền & Nhật Ký
              </button>
            )}
          </nav>
        </div>

        {/* Sidebar Footer detailing session parameters */}
        <div className="p-4 border-t border-slate-800 space-y-2 text-[11px] text-slate-400">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-emerald-500" /> {liveTime}</span>
            <span className="text-gray-500 font-mono">UTC +7</span>
          </div>
          <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/40 text-[10px] space-y-1.5">
            <div className="flex justify-between items-start">
              <div className="truncate max-w-[155px]">
                <span className="block text-slate-500 font-bold uppercase text-[8px] tracking-wider">Cơ sở đăng nhập:</span>
                <p className="font-extrabold text-white leading-tight truncate">{currentUser.fullName}</p>
                <p className="text-[9px] text-slate-400 font-mono truncate">{currentUser.email}</p>
              </div>
              <button
                onClick={handleLogout}
                id="logout_btn"
                className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-500/20 rounded-lg cursor-pointer transition select-none"
                title="Đăng xuất khỏi hệ thống"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
            
            <div className="flex items-center justify-between border-t border-slate-800 pt-1.5 mt-1 gap-1 flex-wrap">
              <div className="bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded text-emerald-400 font-bold text-[8px] truncate">
                {currentUser.canEdit === false ? "Chỉ Xem" : activeRole}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setChangePassError("");
                    setChangePassSuccess("");
                    setShowChangePass(true);
                  }}
                  className="text-[9px] text-emerald-400 hover:text-emerald-300 font-bold hover:underline cursor-pointer flex items-center gap-0.5 transition select-none"
                  title="Thay đổi mật khẩu đăng nhập"
                >
                  <Key className="h-2.5 w-2.5" /> Đổi MK
                </button>
                {ALLOWED_ROLES_FOR_LOGS.includes(effectiveRole) && (
                  <button
                    type="button"
                    onClick={() => {
                      setAiConfigError("");
                      setAiConfigSuccess("");
                      setAiKey("");
                      setShowAiConfig(true);
                    }}
                    className="text-[9px] text-emerald-400 hover:text-emerald-300 font-bold hover:underline cursor-pointer flex items-center gap-0.5 transition select-none"
                    title="Cấu hình Google AI Studio API Key"
                  >
                    <PenTool className="h-2.5 w-2.5" /> Cài đặt AI
                  </button>
                )}
              </div>
            </div>

            {currentUser.canEdit === false && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-1.5 rounded text-[8px] leading-tight font-semibold">
                ⚠️ Tài khoản chưa được cấp quyền xử lý hệ thống. Vui lòng liên hệ Admin của Khu phố để duyệt!
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* 2. MAIN USER WORKSPACE */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar (Session parameters & fast triggers) */}
        <header className="bg-white border-b border-gray-150 py-3.5 px-6 flex justify-between items-center shrink-0 no-print">
          <div className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            <span className="font-semibold text-gray-600">Ban Điều Hành KP3, Phường An Phú, TP. Hồ Chí Minh</span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={fetchDatabaseState}
              disabled={isLoading}
              className="p-1.5 text-gray-400 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg cursor-pointer transition disabled:opacity-5 w-8 h-8 flex items-center justify-center border border-gray-100"
              title="Đồng bộ dữ liệu"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-full text-emerald-800 font-bold border border-emerald-100 animate-pulse">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
              <span>Cán bộ: {effectiveRole}</span>
            </div>
          </div>
        </header>

        {/* Screen Canvas area */}
        <article className="flex-1 p-6 overflow-y-auto max-w-[1550px] w-full mx-auto">
          {isLoading && residents.length === 0 ? (
            <div className="h-80 flex flex-col items-center justify-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent"></div>
              <p className="text-xs font-semibold text-slate-500 animate-pulse">Đang định vị dữ liệu khu phố bảo mật...</p>
            </div>
          ) : errorString ? (
            <div className="bg-rose-50 border border-rose-100 text-rose-800 rounded-xl p-4 text-xs font-semibold max-w-md mx-auto text-center space-y-2">
              <p>{errorString}</p>
              <button onClick={fetchDatabaseState} className="bg-rose-600 text-white px-3 py-1.5 rounded-lg">Thử lại</button>
            </div>
          ) : (
            <>
              {activeTab === "dashboard" && (
                <Dashboard
                  residents={residents}
                  households={households}
                  schedules={schedules}
                  logs={logs}
                  onNavigate={(tab) => setActiveTab(tab)}
                  activeRole={effectiveRole}
                />
              )}

              {activeTab === "residents" && (
                <ResidentsManager
                  residents={residents}
                  households={households}
                  activeRole={effectiveRole}
                  onRefresh={fetchDatabaseState}
                  currentUser={currentUser}
                />
              )}

              {activeTab === "businesses" && (
                <BusinessesManager
                  activeRole={effectiveRole}
                  onRefresh={fetchDatabaseState}
                  currentUser={currentUser}
                />
              )}

              {activeTab === "organizations" && (
                <Organizations
                  residents={residents}
                  activeRole={effectiveRole}
                  onRefresh={fetchDatabaseState}
                  currentUser={currentUser}
                />
              )}

              {activeTab === "calendar" && (
                <CalendarSchedule
                  schedules={schedules}
                  activeRole={effectiveRole}
                  onRefresh={fetchDatabaseState}
                />
              )}

              {activeTab === "ai-composer" && (
                <AiComposer
                  templates={templates}
                  documents={documents}
                  activeRole={effectiveRole}
                  onRefresh={fetchDatabaseState}
                />
              )}

              {activeTab === "doc-incoming" && (
                <OfficialDocumentsManager
                  type="incoming"
                  activeRole={effectiveRole}
                  onRefresh={fetchDatabaseState}
                  currentUser={currentUser}
                />
              )}

              {activeTab === "doc-outgoing" && (
                <OfficialDocumentsManager
                  type="outgoing"
                  activeRole={effectiveRole}
                  onRefresh={fetchDatabaseState}
                  currentUser={currentUser}
                />
              )}

              {activeTab === "gis-address" && (
                <GisAddressManager
                  activeRole={activeRole}
                  currentUser={currentUser}
                  onRefresh={fetchDatabaseState}
                />
              )}

              {activeTab === "roles" && ALLOWED_ROLES_FOR_LOGS.includes(effectiveRole) && (
                <RoleAndLogs
                  logs={logs}
                  activeRole={activeRole}
                  currentUser={currentUser}
                  onSelectRole={(r) => {
                    setActiveRole(r);
                    if (currentUser) {
                      const updated = { 
                        ...currentUser, 
                        role: r,
                        associationGroup: r === "Chi hội trưởng" ? (currentUser.associationGroup || "CCB") : currentUser.associationGroup
                      };
                      setCurrentUser(updated);
                      localStorage.setItem("kp3_admin_user", JSON.stringify(updated));
                    }
                  }}
                />
              )}
            </>
          )}
        </article>
      </main>

      {/* RENDER DYNAMIC CHANGE PASSWORD OVERLAY MODAL */}
      {showChangePass && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-sm w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header banner */}
            <div className="bg-slate-900 text-white p-5 flex items-center gap-3">
              <span className="p-2 bg-emerald-600 rounded-lg text-white">
                <Key className="h-5 w-5" />
              </span>
              <div>
                <h4 className="text-xs font-extrabold uppercase text-emerald-400 tracking-wider">Cập nhật tài khoản</h4>
                <p className="text-sm font-bold text-white leading-tight">Thay đổi mật khẩu cán bộ</p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="p-5 space-y-4">
              <div className="text-[11px] text-gray-500 leading-relaxed font-medium">
                Cán bộ quản trị: <strong className="text-gray-800">{currentUser.fullName} ({currentUser.email})</strong>.
                Bảo vệ tài khoản bằng mật khẩu có độ bảo mật cao.
              </div>

              {changePassError && (
                <div className="bg-rose-50 border border-rose-100 p-2.5 rounded-lg text-[11px] text-rose-700 font-bold">
                  ⚠️ {changePassError}
                </div>
              )}

              {changePassSuccess && (
                <div className="bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg text-[11px] text-emerald-700 font-bold flex items-center gap-1.5 animate-bounce">
                  <Check className="h-4 w-4 text-emerald-600" /> {changePassSuccess}
                </div>
              )}

              {currentUser.provider === "local" && currentUser.email !== "admin" && (
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase">Mật khẩu hiện tại</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      placeholder="Mật khẩu cũ"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded-lg py-2 pl-3 pr-10 focus:outline-emerald-600 focus:ring-0 text-gray-800 bg-slate-50/50"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-slate-650 cursor-pointer active:scale-95"
                      title={showCurrentPassword ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-400 uppercase">Mật khẩu mới</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Nhập ít nhất 4 ký tự"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded-lg py-2 pl-3 pr-10 focus:outline-emerald-600 focus:ring-0 text-gray-800"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-slate-650 cursor-pointer active:scale-95"
                    title={showNewPassword ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-400 uppercase">Xác nhận mật khẩu mới</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Xác nhận mật khẩu trùng khớp"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded-lg py-2 pl-3 pr-10 focus:outline-emerald-600 focus:ring-0 text-gray-800"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-slate-650 cursor-pointer active:scale-95"
                    title={showConfirmPassword ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowChangePass(false)}
                  className="flex-1 py-2 text-center rounded-lg border border-gray-250 text-gray-500 font-semibold hover:bg-gray-50 transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={changePassLoading}
                  className="flex-1 py-2 text-center rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
                >
                  {changePassLoading ? "Đang xử lý..." : "Lưu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENDER DYNAMIC GEMINI CONFIG OVERLAY MODAL */}
      {showAiConfig && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-sm w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header banner */}
            <div className="bg-slate-900 text-white p-5 flex items-center gap-3">
              <span className="p-2 bg-emerald-600 rounded-lg text-white">
                <PenTool className="h-5 w-5" />
              </span>
              <div>
                <h4 className="text-xs font-extrabold uppercase text-emerald-400 tracking-wider">Cấu hình Hệ thống</h4>
                <p className="text-sm font-bold text-white leading-tight">Google AI Studio API Key</p>
              </div>
            </div>

            <form onSubmit={handleSaveAiKey} className="p-5 space-y-4">
              <div className="text-[11px] text-gray-500 leading-relaxed font-medium">
                Cấu hình API Key của bạn để vận hành các dịch vụ thông minh (AI Auto-Align Address, AI Composer).
                {maskedAiKey && (
                  <p className="mt-1 text-emerald-600 font-bold">
                    Trạng thái hiện tại: Đã cấu hình (Mã khóa: {maskedAiKey})
                  </p>
                )}
              </div>

              {aiConfigError && (
                <div className="bg-rose-50 border border-rose-100 p-2.5 rounded-lg text-[11px] text-rose-700 font-bold">
                  ⚠️ {aiConfigError}
                </div>
              )}

              {aiConfigSuccess && (
                <div className="bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg text-[11px] text-emerald-700 font-bold flex items-center gap-1.5 animate-bounce">
                  <Check className="h-4 w-4 text-emerald-600" /> {aiConfigSuccess}
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-400 uppercase">API Key (Google Studio / Gemini)</label>
                <input
                  type="text"
                  placeholder="Dán mã khóa AIzaSy..."
                  required
                  value={aiKey}
                  onChange={(e) => setAiKey(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-emerald-600 focus:ring-0 text-gray-800"
                />
              </div>

              <div className="flex gap-2 pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowAiConfig(false)}
                  className="flex-1 py-2 text-center rounded-lg border border-gray-250 text-gray-500 font-semibold hover:bg-gray-50 transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={aiConfigLoading}
                  className="flex-1 py-2 text-center rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
                >
                  {aiConfigLoading ? "Đang lưu..." : "Lưu cấu hình"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

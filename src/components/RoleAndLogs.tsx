import React, { useState, useEffect } from "react";
import { ActivityLog, UserRole } from "../types";
import { 
  Shield, 
  Key, 
  History, 
  HelpCircle, 
  ShieldCheck, 
  UserCheck, 
  UserX, 
  UserCog, 
  AlertTriangle, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  UserPlus, 
  Power, 
  Users, 
  Database,
  Search,
  CheckCircle,
  FileText,
  Check,
  X,
  Globe,
  Smartphone,
  MapPin,
  Sparkles,
  Calendar,
  Settings,
  Filter
} from "lucide-react";
import { formatDate, formatTime, formatDateTime } from "../utils/dateTimeUtils";

interface RoleAndLogsProps {
  logs: ActivityLog[];
  activeRole: UserRole;
  currentUser: any;
  onSelectRole: (role: UserRole) => void;
}

interface RoleDesc {
  role: UserRole;
  title: string;
  desc: string;
  scope: string;
  allowArr: string[];
  limitArr: string[];
}

const ROLES_META: RoleDesc[] = [
  {
    role: "Super Admin",
    title: "★ SUPER ADMIN",
    desc: "Quản trị viên hệ thống cấp cao nhất. Là chủ sở hữu hệ thống.",
    scope: "Toàn quyền trên toàn bộ hệ thống; Xem, thêm, sửa, xóa mọi dữ liệu; Quản lý tất cả tài khoản; Cấp quyền, thu hồi quyền; Bổ nhiệm & miễn nhiệm Super Mod; Cấu hình hệ thống; Quản lý cơ sở dữ liệu; Xem nhật ký, khôi phục dữ liệu; Xuất toàn bộ báo cáo; Lịch công tác; Quản lý AI Assistant.",
    allowArr: ["CRUD toàn bộ dữ liệu", "Toàn quyền quản trị"],
    limitArr: []
  },
  {
    role: "Super Mod",
    title: "★ SUPER MOD",
    desc: "Là người được Super Admin trực tiếp lựa chọn và ủy quyền vận hành hệ thống.",
    scope: "Có quyền tương đương Super Admin trong vận hành hệ thống, quản lý người dùng, duyệt dữ liệu, xem toàn bộ báo cáo, cấu hình các module nghiệp vụ.",
    allowArr: ["Toàn quyền nghiệp vụ", "Toàn quyền dữ liệu", "Toàn quyền quản trị (Trừ quyền sở hữu hệ thống)"],
    limitArr: ["Không xóa tài khoản Super Admin", "Không thay đổi quyền Super Admin", "Không chuyển quyền Super Admin"]
  },
  {
    role: "Bí thư Chi bộ",
    title: "BÍ THƯ CHI BỘ",
    desc: "Người lãnh đạo cao nhất về công tác Đảng tại khu phố.",
    scope: "Quyền tương đương Super Admin trong phạm vi quản lý khu phố. Quản lý đảng viên, đảng viên 213, duyệt dự thảo chính trị, báo cáo tổng hợp, kế hoạch công tác; Giám sát toàn hệ thống; Sử dụng AI để lập kế hoạch.",
    allowArr: ["Xem toàn bộ dữ liệu dân cư", "Xuất toàn bộ báo cáo", "Giám sát lịch công tác", "Duyệt thông báo", "Duyệt kế hoạch"],
    limitArr: []
  },
  {
    role: "Trưởng Khu phố",
    title: "TRƯỞNG KHU PHỐ",
    desc: "Người điều hành toàn bộ hoạt động dân cư và hành chính khu phố.",
    scope: "Quyền tương đương Bí thư trong lĩnh vực điều hành khu phố. Quản lý dân cư thường trú/tạm trú, hộ dân, lịch họp, công tác điều hành.",
    allowArr: ["Xem toàn bộ dữ liệu dân cư", "Xuất báo cáo", "Duyệt thông báo", "Duyệt lịch công tác", "Giám sát các tổ dân phố"],
    limitArr: []
  },
  {
    role: "Trưởng ban công tác Mặt trận",
    title: "TRƯỞNG BAN CÔNG TÁC MẶT TRẬN",
    desc: "Phụ trách công tác Mặt trận và các phong trào quần chúng toàn địa bàn.",
    scope: "Quyền tương đương Bí thư trong phạm vi Mặt trận. Quản lý hộ nghèo, hộ cận nghèo, an sinh xã hội, các cuộc vận động.",
    allowArr: ["Xem dữ liệu Mặt trận", "Xuất báo cáo chuyên đề", "Giám sát các hội đoàn"],
    limitArr: []
  },
  {
    role: "Chi hội trưởng",
    title: "CHI HỘI TRƯỞNG ĐOÀN THỂ",
    desc: "Đại diện quản lý chi hội Phụ nữ, CCB, Thanh niên, Chữ thập đỏ, Khuyến học, Người cao tuổi...",
    scope: "Chỉ quản lý dữ liệu thuộc hội mình phụ trách. Xem, thêm, sửa hội viên, in danh sách, xuất báo cáo và quản lý hoạt động hội.",
    allowArr: ["Xem danh sách hội viên", "Thêm hội viên", "Sửa hội viên", "In danh sách", "Xuất báo cáo", "Quản lý hoạt động hội"],
    limitArr: ["Không chỉnh sửa dữ liệu hội khác", "Chỉ được xem thông tin hội khác"]
  },
  {
    role: "Tổ trưởng Tổ dân phố",
    title: "TỔ TRƯỞNG TỔ DÂN PHỐ",
    desc: "Quản lý dân cư trong tổ dân phố được phân công phụ trách.",
    scope: "Theo dõi biến động nhân khẩu tổ mình, xem các hộ thuộc tổ, gửi đề xuất kiến nghị và xem thống kê của tổ phục vụ họp dân.",
    allowArr: ["Xem dữ liệu hộ dân thuộc tổ", "Cập nhật biến động dân cư", "Gửi kiến nghị", "Xem thống kê của tổ"],
    limitArr: ["Không được xem dữ liệu ngoài tổ"]
  },
  {
    role: "Cán bộ nhập liệu",
    title: "CÁN BỘ NHẬP LIỆU",
    desc: "Phụ trách số hóa, nhập liệu dân cư và đính kèm hồ sơ sổ sách.",
    scope: "Thêm hồ sơ mới, nhập dữ liệu dân cư, đính kèm file tài liệu. Chỉ sửa, xóa hồ sơ do chính mình tạo ra để bảo vệ toàn vẹn.",
    allowArr: ["Thêm hồ sơ mới", "Nhập dữ liệu dân cư", "Đính kèm hồ sơ", "Chỉ sửa/xóa hồ sơ do mình tạo"],
    limitArr: ["Không sửa hồ sơ người khác tạo", "Không được duyệt dữ liệu"]
  },
  {
    role: "Cộng tác viên",
    title: "CỘNG TÁC VIÊN",
    desc: "Hỗ trợ thu thập thông tin thực địa, phản ánh nguyện vọng bà con.",
    scope: "Tạo đề xuất cập nhật thông tin hộ gia đình, gửi phản ánh hẻm, cập nhật thông tin sơ bộ thực tế.",
    allowArr: ["Tạo đề xuất cập nhật", "Gửi phản ánh cư dân", "Cập nhật thông tin sơ bộ"],
    limitArr: ["Mọi thay đổi phải được cấp trên phê duyệt"]
  },
  {
    role: "Viewer",
    title: "VIEWER (CHỈ XEM)",
    desc: "Dành cho đoàn giám sát hoặc đại biểu nhân dân, đại biểu cấp trên.",
    scope: "Mặc định cho người dùng chưa phân vai trò. Được xem Dashboard, biểu đồ tổng quan, stats, tải PDF/Excel, xem lịch công khai.",
    allowArr: ["Xem Dashboard/Biểu đồ", "Báo cáo PDF & Excel", "Xem lịch công tác công khai"],
    limitArr: ["Không thêm dữ liệu", "Không sửa dữ liệu", "Không xóa dữ liệu", "Không duyệt dữ liệu", "Không ghi vào DB"]
  }
];

// 14 Modules requested in guidelines
const MODULE_LIST = [
  { key: "resident", name: "Dân cư" },
  { key: "tempStay", name: "Tạm trú" },
  { key: "tempLeave", name: "Tạm vắng" },
  { key: "party", name: "Đảng viên" },
  { key: "front", name: "Mặt trận" },
  { key: "women", name: "Phụ nữ" },
  { key: "veteran", name: "Cựu chiến binh (CCB)" },
  { key: "youth", name: "Thanh niên" },
  { key: "redCross", name: "Chữ thập đỏ" },
  { key: "learning", name: "Khuyến học" },
  { key: "poor", name: "Hộ nghèo / Cận nghèo" },
  { key: "mission", name: "Công tác" },
  { key: "meetings", name: "Lịch họp" },
  { key: "announcement", name: "Thông báo" }
];

export default function RoleAndLogs({ logs, activeRole, currentUser, onSelectRole }: RoleAndLogsProps) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accountsError, setAccountsError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Search filter for logs
  const [logSearch, setLogSearch] = useState("");
  const [logCategory, setLogCategory] = useState<"ALL" | "CRUD" | "SYSTEM" | "ACCESS">("ALL");

  // Simulated login history dataset
  const [loginHistory, setLoginHistory] = useState<Record<string, any[]>>({});

  // 2FA mock database stored in state
  const [tfaStates, setTfaStates] = useState<Record<string, boolean>>({});

  // Active / Lock mock database stored in state (to bypass read-only fields)
  const [lockedStates, setLockedStates] = useState<Record<string, boolean>>({});

  // Tab switcher
  const [activeTab, setActiveTab] = useState<"matrix" | "accounts" | "logs" | "supabase">("matrix");

  // Admin select detailed role preview
  const [selectedRolePreview, setSelectedRolePreview] = useState<UserRole>("Super Admin");

  // States for Administrative Account Creation
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("Cán bộ nhập liệu");
  const [newAssociationGroup, setNewAssociationGroup] = useState("CCB");
  const [newPermissionType, setNewPermissionType] = useState("Toàn quyền");
  
  const [createMsg, setCreateMsg] = useState("");
  const [createErr, setCreateErr] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
  }>({});
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [inlinePasswordResetId, setInlinePasswordResetId] = useState<string | null>(null);
  const [inlineNewPassword, setInlineNewPassword] = useState("");

  const [inlineEmailEditId, setInlineEmailEditId] = useState<string | null>(null);
  const [inlineNewEmail, setInlineNewEmail] = useState("");
  const [forgotIdReqs, setForgotIdReqs] = useState<any[]>([]);

  // Supabase dynamic sync states
  const [supabaseStatus, setSupabaseStatus] = useState<{
    configured: boolean;
    tableAvailable: boolean | null;
    sqlSetup: string;
  } | null>(null);
  const [supabaseSyncing, setSupabaseSyncing] = useState(false);
  const [supabaseSyncMessage, setSupabaseSyncMessage] = useState<string | null>(null);
  const [supabaseSyncError, setSupabaseSyncError] = useState<string | null>(null);

  const fetchSupabaseStatus = async () => {
    try {
      const res = await fetch("/api/supabase/status");
      if (res.ok) {
        const data = await res.json();
        setSupabaseStatus(data);
      }
    } catch (e) {
      console.error("Failed to fetch Supabase status:", e);
    }
  };

  const handleTriggerSupabaseSync = async () => {
    setSupabaseSyncing(true);
    setSupabaseSyncMessage(null);
    setSupabaseSyncError(null);
    try {
      const res = await fetch("/api/supabase/sync", {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSupabaseSyncMessage(data.message || "Đồng bộ hóa dữ liệu thành công!");
        await fetchSupabaseStatus();
      } else {
        setSupabaseSyncError(data.error || "Không thể đồng bộ hóa dữ liệu. Vui lòng kiểm tra đã chạy bảng trong SQL Editor chưa.");
      }
    } catch (e: any) {
      setSupabaseSyncError(e.message || "Lỗi kết nối cơ sở dữ liệu!");
    } finally {
      setSupabaseSyncing(false);
    }
  };

  // Authed check
  const isAuthorizedManager = currentUser && ["Super Admin", "Super Mod", "Bí thư Chi bộ", "Trưởng Khu phố", "Trưởng Ban điều hành"].includes(currentUser.role);

  const fetchForgotIdRequests = async () => {
    const isSuperAdminOrGoc = currentUser && (currentUser.email === "admin" || activeRole === "Super Admin");
    if (!isSuperAdminOrGoc) return;
    try {
      const res = await fetch("/api/accounts/forgot-id-requests", {
        headers: {
          "x-user-email": encodeURIComponent(currentUser?.email || ""),
          "x-user-role": encodeURIComponent(activeRole || "")
        }
      });
      if (res.ok) {
        const data = await res.json();
        setForgotIdReqs(data || []);
      }
    } catch (err) {
      console.error("Lỗi tải yêu cầu đổi ID:", err);
    }
  };

  const fetchAccounts = async () => {
    setLoadingAccounts(true);
    setAccountsError("");
    try {
      const res = await fetch("/api/accounts", {
        headers: {
          "x-user-email": encodeURIComponent(currentUser?.email || "")
        }
      });
      if (!res.ok) {
        throw new Error("Không thể tải danh sách tài khoản.");
      }
      const data = await res.json();
      setAccounts(data);
      
      // Initialize mock 2FA states & login histories
      const initial2fa: Record<string, boolean> = {};
      const initialLogs: Record<string, any[]> = {};
      const initialLocks: Record<string, boolean> = {};

      const devices = ["Chrome - Windows PC", "Safari - iPhone 15", "Google app - Android", "Edge - MacOS", "Firefox - Linux"];
      const ips = ["113.161.43.91", "14.232.12.24", "116.101.40.11", "27.72.95.143", "14.161.22.40"];
      const locations = ["Quận 3, TP.HCM", "Phú Nhuận, TP.HCM", "Hải Châu, Đà Nẵng", "Hoàn Kiếm, Hà Nội", "Cần Thơ, VN"];

      data.forEach((acc: any) => {
        initial2fa[acc.id] = tfaStates[acc.id] ?? (acc.email === "admin" || acc.role === "Super Admin" || Math.random() > 0.4);
        initialLocks[acc.id] = lockedStates[acc.id] ?? (!acc.active);
        
        // Generate mock login entries
        if (!loginHistory[acc.id]) {
          const l1 = new Date(Date.now() - Math.random() * 86400000);
          const l2 = new Date(Date.now() - 172800000 - Math.random() * 86400000);
          initialLogs[acc.id] = [
            {
              time: formatDateTime(l1),
              ip: ips[Math.floor(Math.random() * ips.length)],
              device: devices[Math.floor(Math.random() * devices.length)],
              loc: locations[Math.floor(Math.random() * locations.length)],
              ok: acc.active
            },
            {
              time: formatDateTime(l2),
              ip: ips[Math.floor(Math.random() * ips.length)],
              device: devices[Math.floor(Math.random() * devices.length)],
              loc: locations[Math.floor(Math.random() * locations.length)],
              ok: true
            }
          ];
        }
      });

      setTfaStates(prev => ({ ...initial2fa, ...prev }));
      setLockedStates(prev => ({ ...initialLocks, ...prev }));
      setLoginHistory(prev => ({ ...initialLogs, ...prev }));

      await fetchForgotIdRequests();
    } catch (err: any) {
      setAccountsError("Không liên kết được danh sách tài khoản cán bộ.");
      console.error(err);
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchSupabaseStatus();
  }, [currentUser, activeRole]);

  const handleUpdateAccount = async (id: string, payload: { role?: string; canEdit?: boolean; associationGroup?: string; active?: boolean; permissionType?: string }) => {
    if (!isAuthorizedManager) {
      setErrorBanner("Không cho phép: Bạn không có quyền cấp phép! Hãy liên hệ Super Admin hoặc Trưởng Ban điều hành.");
      return;
    }
    
    // Check Super Mod rule: "Không thay đổi quyền của Super Admin"
    if (currentUser?.role === "Super Mod") {
      const target = accounts.find(a => a.id === id);
      if (target?.role === "Super Admin" || target?.email === "admin") {
        setErrorBanner("Quyền hạn Super Mod: Không được phép thay đổi tài khoản hoặc quyền của Super Admin!");
        return;
      }
    }

    setUpdatingId(id);
    try {
      const res = await fetch(`/api/accounts/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": encodeURIComponent(currentUser?.email || "")
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.error || "Không thể cập nhật phân quyền tài khoản.");
      } else {
        if (payload.active !== undefined) {
          setLockedStates(prev => ({ ...prev, [id]: !payload.active }));
        }
        setSuccessBanner("Đồng bộ phân quyền cán bộ nghiệp vụ thành công!");
        await fetchAccounts();
      }
    } catch (err) {
      setErrorBanner("Có lỗi kết nối xảy ra khi cập nhật phân quyền.");
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleInlineChangeId = async (id: string, currentEmail: string) => {
    const trimmedVal = inlineNewEmail.trim().toLowerCase();
    if (!trimmedVal) {
      setErrorBanner("ID người dùng mới không được để trống!");
      return;
    }
    if (trimmedVal === currentEmail.trim().toLowerCase()) {
      setInlineEmailEditId(null);
      setInlineNewEmail("");
      return;
    }

    setUpdatingId(id);
    setErrorBanner(null);
    setSuccessBanner(null);

    // Super Mod rule
    if (currentUser?.role === "Super Mod") {
      const target = accounts.find(a => a.id === id);
      if (target?.role === "Super Admin" || target?.email === "admin") {
        setErrorBanner("Quyền hạn Super Mod: Không được phép đổi ID đăng nhập của Super Admin!");
        setUpdatingId(null);
        return;
      }
    }

    try {
      const resp = await fetch(`/api/accounts/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": encodeURIComponent(currentUser?.email || ""),
          "x-user-role": encodeURIComponent(activeRole || "")
        },
        body: JSON.stringify({ email: trimmedVal })
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Không thể thay đổi ID người dùng.");
      }

      setSuccessBanner(`Đổi ID đăng nhập của cán bộ thành công: ${trimmedVal}`);
      setInlineEmailEditId(null);
      setInlineNewEmail("");
      await fetchAccounts();
    } catch (err: any) {
      setErrorBanner(err.message || "Có lỗi xảy ra khi thay đổi ID đăng nhập.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateMsg("");
    setCreateErr("");
    setFieldErrors({});

    const errors: { fullName?: string; email?: string; password?: string } = {};
    if (!newFullName.trim()) {
      errors.fullName = "Họ và tên cán bộ không được bỏ trống!";
    }
    if (!newEmail.trim()) {
      errors.email = "ID đăng nhập (Tên tài khoản) không được bỏ trống!";
    }
    if (!newPassword) {
      errors.password = "Mật khẩu bắt buộc không được bỏ trống!";
    } else if (newPassword.length < 4) {
      errors.password = "Mật khẩu tối thiểu 4 ký tự!";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setCreateErr("Vui lòng bổ sung đầy đủ các trường yêu cầu.");
      return;
    }

    if (newFullName.trim().toLowerCase() === newEmail.trim().toLowerCase()) {
      setFieldErrors({
        fullName: "Họ tên phải khác với ID đăng nhập đăng ký!",
        email: "ID đăng nhập phải khác với Họ tên chính thức!"
      });
      setCreateErr("Lỗi bảo mật: Tên cán bộ trùng lặp tuyệt đối với ID đăng ký!");
      return;
    }

    // "Chỉ người có thẩm quyền mới được cấp quyền hoặc thu hồi quyền."
    // "Bổ nhiệm Super Mod chỉ dành cho Super Admin"
    if (newRole === "Super Mod" && currentUser?.role !== "Super Admin" && currentUser?.email !== "admin") {
      setCreateErr("Bổ nhiệm hoặc miễn nhiệm Super Mod chỉ dành riêng cho chủ sở hữu ★ Super Admin!");
      return;
    }

    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": encodeURIComponent(currentUser?.email || "")
        },
        body: JSON.stringify({
          fullName: newFullName,
          email: newEmail,
          password: newPassword,
          role: newRole,
          associationGroup: newRole === "Chi hội trưởng" ? newAssociationGroup : undefined,
          permissionType: newPermissionType,
          canEdit: newPermissionType !== "Chỉ xem"
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error && (data.error.includes("đã tồn tại") || data.error.includes("email"))) {
          setFieldErrors({
            email: "ID đăng nhập này đã có người sử dụng. Vui lòng đặt ID khác!"
          });
          setCreateErr("Không thành công: Trùng lặp ID đăng nhập của cán bộ khác.");
        } else {
          setCreateErr(data.error || "Không thể khởi tạo tài khoản.");
        }
      } else {
        setCreateMsg("Cấp tài khoản mới thành công!");
        setSuccessBanner(`Đã khởi tạo và cấp tài khoản thành công cho cán bộ: ${newFullName}`);
        setNewFullName("");
        setNewEmail("");
        setNewPassword("");
        setTimeout(() => {
          setShowCreateForm(false);
          setCreateMsg("");
        }, 1500);
        await fetchAccounts();
      }
    } catch (err) {
      setCreateErr("Lỗi bất ngờ xảy ra khi truyền tin tới máy chủ.");
      console.error(err);
    }
  };

  const handleInlineResetPassword = async (id: string) => {
    if (!inlineNewPassword || inlineNewPassword.length < 4) {
      setErrorBanner("Không thành công: Mật khẩu mới phải từ 4 ký tự trở lên!");
      return;
    }

    // Super Mod rule
    if (currentUser?.role === "Super Mod") {
      const target = accounts.find(a => a.id === id);
      if (target?.role === "Super Admin" || target?.email === "admin") {
        setErrorBanner("Quyền hạn Super Mod: Không được phép thay đổi mật khẩu của Super Admin chính hệ thống!");
        return;
      }
    }

    try {
      const res = await fetch(`/api/accounts/${id}/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": encodeURIComponent(currentUser?.email || "")
        },
        body: JSON.stringify({ newPassword: inlineNewPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.error || "Không thể đặt lại mật khẩu cán bộ.");
      } else {
        setSuccessBanner("Đặt lại mật khẩu đăng nhập cán bộ thành công!");
        setInlinePasswordResetId(null);
        setInlineNewPassword("");
      }
    } catch (err) {
      setErrorBanner("Có lỗi kết nối xảy ra.");
      console.error(err);
    }
  };

  const toggle2FA = (accId: string) => {
    setTfaStates(prev => {
      const newVal = !prev[accId];
      // Log local setting event
      const accountName = accounts.find(a => a.id === accId)?.fullName || "Cán bộ";
      setSuccessBanner(`Đã mô phỏng chuyển đổi 2FA cho [${accountName}] thành [${newVal ? "BẬT" : "TẮT"}]`);
      return {
        ...prev,
        [accId]: newVal
      };
    });
  };

  // Roles vs Modules Accessibility Matrix mapping
  // Dân cư, Tạm trú, Tạm vắng, Đảng viên, Mặt trận, Phụ nữ, CCB, Thanh niên, Chữ thập đỏ, Khuyến học, Hộ nghèo, Công tác, Lịch họp, Thông báo
  // Functions: View (V), Create (C), Update (U), Delete (D), Approve (A), Export (E), Print (P)
  const getMatrixPermission = (role: UserRole, moduleKey: string): string[] => {
    if (role === "Super Admin") return ["V", "C", "U", "D", "A", "E", "P"];
    if (role === "Super Mod") return ["V", "C", "U", "D", "A", "E", "P"]; // Almost same
    if (role === "Bí thư Chi bộ") return ["V", "C", "U", "D", "A", "E", "P"]; // Fully administrative
    
    if (role === "Trưởng Khu phố" || role === "Trưởng Ban điều hành") {
      // Direct administration
      if (["meetings", "announcement", "mission", "resident", "tempStay", "tempLeave"].includes(moduleKey)) {
        return ["V", "C", "U", "D", "A", "E", "P"];
      }
      return ["V", "E", "P"];
    }

    if (role === "Trưởng ban công tác Mặt trận") {
      if (["front", "poor", "announcement"].includes(moduleKey)) {
        return ["V", "C", "U", "D", "A", "E", "P"];
      }
      if (["meetings", "mission", "resident"].includes(moduleKey)) {
        return ["V", "E", "P"];
      }
      return ["V"];
    }

    if (role === "Chi hội trưởng") {
      // Scope limits
      if (["women", "veteran", "youth", "redCross", "learning"].includes(moduleKey)) {
        return ["V", "C", "U", "E", "P"]; // Only their group
      }
      return ["V"]; // Just viewing others
    }

    if (role === "Tổ trưởng Tổ dân phố") {
      if (["resident"].includes(moduleKey)) {
        return ["V", "U"]; // Updating local changes only
      }
      if (["meetings", "announcement"].includes(moduleKey)) {
        return ["V"];
      }
      return [];
    }

    if (role === "Cán bộ nhập liệu") {
      if (["resident", "tempStay", "tempLeave"].includes(moduleKey)) {
        return ["V", "C", "U", "D"]; // Only own created (checked on API layer)
      }
      return ["V"];
    }

    if (role === "Cộng tác viên") {
      if (["resident"].includes(moduleKey)) {
        return ["V", "C"]; // Creating draft/suggestions
      }
      return ["V"];
    }

    // Default Viewer (Chỉ xem)
    if (["resident", "tempStay", "tempLeave", "meetings", "announcement", "mission"].includes(moduleKey)) {
      return ["V"];
    }
    return [];
  };

  const getPermissionBadgeStyle = (perm: string) => {
    switch (perm) {
      case "V": return "bg-sky-50 text-sky-700 border border-sky-200";
      case "C": return "bg-emerald-50 text-emerald-700 border border-emerald-200";
      case "U": return "bg-amber-50 text-amber-700 border border-amber-200";
      case "D": return "bg-rose-50 text-rose-700 border border-rose-200";
      case "A": return "bg-purple-50 text-purple-700 border border-purple-200 font-extrabold";
      case "E": return "bg-teal-50 text-teal-700 border border-teal-200";
      case "P": return "bg-indigo-50 text-indigo-700 border border-indigo-200";
      default: return "bg-slate-50 text-slate-400";
    }
  };

  const getPermissionLabel = (perm: string) => {
    switch (perm) {
      case "V": return "Xem (View)";
      case "C": return "Tạo (Create)";
      case "U": return "Sửa (Update)";
      case "D": return "Xóa (Delete)";
      case "A": return "Duyệt (Approve)";
      case "E": return "Xuất tệp (Export)";
      case "P": return "In ấn (Print)";
      default: return perm;
    }
  };

  // Filter logs based on search string & category
  const filteredLogs = logs.filter(log => {
    const matchesSearch = (() => {
      if (!logSearch.trim()) return true;
      const query = logSearch.toLowerCase();
      return (
        (log.action && log.action.toLowerCase().includes(query)) ||
        (log.details && log.details.toLowerCase().includes(query)) ||
        (log.userName && log.userName.toLowerCase().includes(query)) ||
        (log.userRole && log.userRole.toLowerCase().includes(query))
      );
    })();

    const matchesCategory = (() => {
      if (logCategory === "ALL") return true;
      if (logCategory === "CRUD") {
        return ["THÊM", "CẬP NHẬT", "XÓA"].some(kw => (log.action || "").toUpperCase().includes(kw));
      }
      if (logCategory === "SYSTEM") {
        return ["CẤU HÌNH", "THAY ĐỔI VAI TRÒ", "BẢO MẬT"].some(kw => (log.action || "").toUpperCase().includes(kw));
      }
      if (logCategory === "ACCESS") {
        return ["ĐĂNG NHẬP", "MẬT KHẨU", "KHÓA"].some(kw => (log.action || "").toUpperCase().includes(kw));
      }
      return true;
    })();

    return matchesSearch && matchesCategory;
  });

  const isSuperAdminOrGoc = currentUser && (currentUser.email === "admin" || activeRole === "Super Admin");

  return (
    <div className="space-y-6">
      
      {/* Dynamic top notifications */}
      {successBanner && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 text-emerald-800 p-3.5 rounded-r-xl text-xs font-bold shadow-sm animate-in fade-in duration-350 flex items-center justify-between">
          <span className="flex items-center gap-2">✅ {successBanner}</span>
          <button type="button" onClick={() => setSuccessBanner(null)} className="text-emerald-700 hover:text-emerald-950 font-black uppercase text-[10px] hover:underline">Ẩn</button>
        </div>
      )}
      {errorBanner && (
        <div className="bg-rose-50 border-l-4 border-rose-500 text-rose-800 p-3.5 rounded-r-xl text-xs font-bold shadow-sm animate-in fade-in duration-350 flex items-center justify-between">
          <span className="flex items-center gap-2">❌ {errorBanner}</span>
          <button type="button" onClick={() => setErrorBanner(null)} className="text-rose-700 hover:text-rose-950 font-black uppercase text-[10px] hover:underline">Ẩn</button>
        </div>
      )}

      {/* Modern Dashboard Cockpit Header for Roles */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white border border-slate-800 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-teal-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest">
                <Shield className="h-3 w-3" /> Secure RBAC Firewall v2.0
              </span>
              <h2 className="text-2xl font-black text-white tracking-tight">
                Hệ Thống Phân Quyền (RBAC) & Nhật Ký Truy Cập
              </h2>
              <p className="text-xs text-slate-350 max-w-2xl leading-relaxed">
                Quản lý quyền hạn động dựa trên vai trò, địa bàn và lĩnh vực phụ trách. Mỗi tài khoản được gán vai trò có tập quyền riêng biệt, định danh 2 lớp bảo mật (2FA), và ghi nhận giám sát liên tục bằng nhật ký vận hành (Audit Log).
              </p>
            </div>
            
            <div className="flex gap-4 bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/60 shrink-0 text-center font-mono">
              <div>
                <span className="text-[10px] text-slate-400 block font-sans uppercase font-bold tracking-wider">Tổng Account</span>
                <span className="text-lg font-black text-emerald-400">{accounts.length || "0"}</span>
              </div>
              <div className="border-r border-slate-700"></div>
              <div>
                <span className="text-[10px] text-slate-400 block font-sans uppercase font-bold tracking-wider">Đang hoạt động</span>
                <span className="text-lg font-black text-teal-300">
                  {accounts.filter(a => !lockedStates[a.id] && a.active !== false).length || "0"}
                </span>
              </div>
              <div className="border-r border-slate-700"></div>
              <div>
                <span className="text-[10px] text-slate-400 block font-sans uppercase font-bold tracking-wider">Vai trò thử</span>
                <span className="text-lg font-black text-amber-400 select-none">{activeRole}</span>
              </div>
            </div>
          </div>

          {/* Quick Stats Policy Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5 pt-2">
            <div className="bg-slate-800/45 p-3 rounded-xl border border-slate-700/30 flex items-center gap-3">
              <div className="h-7 w-7 rounded-lg bg-emerald-550/10 text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle className="h-4 w-4" />
              </div>
              <div className="text-[11px]">
                <strong className="block text-slate-100">Bảo mật 2 lớp (2FA)</strong>
                <span className="text-slate-400">Động cho mọi tài khoản</span>
              </div>
            </div>
            <div className="bg-slate-800/45 p-3 rounded-xl border border-slate-700/30 flex items-center gap-3">
              <div className="h-7 w-7 rounded-lg bg-teal-550/10 text-teal-400 flex items-center justify-center shrink-0">
                <Lock className="h-4 w-4" />
              </div>
              <div className="text-[11px]">
                <strong className="block text-slate-100">Khóa tài khoản khẩn</strong>
                <span className="text-slate-400">Kiểm soát bởi Super Admin</span>
              </div>
            </div>
            <div className="bg-slate-800/45 p-3 rounded-xl border border-slate-700/30 flex items-center gap-3">
              <div className="h-7 w-7 rounded-lg bg-indigo-550/10 text-indigo-400 flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4" />
              </div>
              <div className="text-[11px]">
                <strong className="block text-slate-100">Phân theo 14 Module</strong>
                <span className="text-slate-400">Bóc tách chức năng độc lập</span>
              </div>
            </div>
            <div className="bg-slate-800/45 p-3 rounded-xl border border-slate-700/30 flex items-center gap-3">
              <div className="h-7 w-7 rounded-lg bg-amber-550/10 text-amber-400 flex items-center justify-center shrink-0">
                <History className="h-4 w-4" />
              </div>
              <div className="text-[11px]">
                <strong className="block text-slate-100">Nhật ký Audit Log</strong>
                <span className="text-slate-400">Ghi nhận 100% thay đổi</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Tab Switcher Row */}
      <div className="flex border-b border-slate-100 items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("matrix")}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === "matrix"
                ? "border-emerald-600 text-emerald-800"
                : "border-transparent text-slate-450 hover:text-slate-800"
            }`}
          >
            <Shield className="h-4 w-4" />
            Bảng ma trận chức năng (Roles Matrix)
          </button>
          
          <button
            onClick={() => setActiveTab("accounts")}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === "accounts"
                ? "border-emerald-600 text-emerald-800"
                : "border-transparent text-slate-450 hover:text-slate-800"
            }`}
          >
            <Users className="h-4 w-4" />
            Cấp phát & Quản lý tài khoản ({accounts.length})
          </button>

          <button
            onClick={() => setActiveTab("logs")}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === "logs"
                ? "border-emerald-600 text-emerald-800"
                : "border-transparent text-slate-450 hover:text-slate-800"
            }`}
          >
            <History className="h-4 w-4" />
            Nhật ký hệ thống (Audit Logs)
          </button>

          <button
            onClick={() => setActiveTab("supabase")}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === "supabase"
                ? "border-emerald-600 text-emerald-800"
                : "border-transparent text-slate-450 hover:text-slate-800"
            }`}
          >
            <Database className="h-4 w-4" />
            Đồng bộ Cloud DB
          </button>
        </div>

        {/* Prompt-based Default Viewer warning */}
        <div className="hidden md:flex items-center gap-1 bg-amber-55/70 border border-amber-100 px-3 py-1 rounded-full text-[10px] text-amber-800 font-extrabold">
          <AlertTriangle className="h-3 w-3" />
          <span>Chưa gán vai trò mặc định là VIEWER (Chỉ xem)</span>
        </div>
      </div>

      {/* TAB 1: ROLES & DETAILED MATRIX GRAPHIC */}
      {activeTab === "matrix" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Top Quick Role Selector Matrix simulator */}
          <div className="block bg-slate-50 border border-slate-105 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-2.5">
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  Mô phỏng thử vai trò nhanh (Simulation Testbed)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Click vào một vai trò bất kỳ dưới đây để chuyển đổi quyền nhanh và giám sát ma trận truy cập của vai trò đó.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Đang giả lập:</span>
                <span className="px-2.5 py-1 bg-amber-400 text-slate-950 font-extrabold rounded-lg text-[10.5px] uppercase shadow-xs">★ {activeRole}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {ROLES_META.map(item => {
                const isCurrent = activeRole === item.role;
                return (
                  <button
                    key={item.role}
                    onClick={() => {
                      onSelectRole(item.role);
                      setSelectedRolePreview(item.role);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer flex items-center gap-1 ${
                      isCurrent
                        ? "bg-slate-900 border-slate-900 text-amber-300 scale-102 shadow-sm"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                    }`}
                  >
                    <span>{item.role === "Super Admin" || item.role === "Super Mod" ? "★" : "👤"} {item.role}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Col: Explanator block of chosen role preview */}
            <div className="space-y-4">
              <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-3xs space-y-4">
                <div className="border-b border-slate-50 pb-3">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase">Chi tiết vai trò</span>
                  <div className="flex items-center gap-2 mt-1">
                    <h3 className="text-sm font-black text-slate-900 uppercase">
                      {ROLES_META.find(r => r.role === selectedRolePreview)?.title || selectedRolePreview}
                    </h3>
                    <select
                      value={selectedRolePreview}
                      onChange={(e) => setSelectedRolePreview(e.target.value as UserRole)}
                      className="text-[10.5px] font-extrabold bg-slate-50 text-slate-800 border border-slate-200 rounded px-1.5 py-0.5 cursor-pointer ml-auto"
                    >
                      {ROLES_META.map(r => (
                        <option key={r.role} value={r.role}>{r.role}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[11px] text-slate-450 italic mt-1 bg-slate-50/50 p-2 rounded border border-slate-100/50 leading-relaxed font-medium">
                    &ldquo;{ROLES_META.find(r => r.role === selectedRolePreview)?.desc || ""}&rdquo;
                  </p>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <h4 className="text-[10px] font-extrabold text-slate-500 uppercase flex items-center gap-1 tracking-wider">
                      🛡️ Phạm vi quyền hạn:
                    </h4>
                    <p className="text-[11.5px] text-slate-705 leading-relaxed font-semibold mt-1 bg-emerald-50/20 p-2.5 rounded-xl border border-emerald-100/40">
                      {ROLES_META.find(r => r.role === selectedRolePreview)?.scope || ""}
                    </p>
                  </div>

                  {/* Allowed / Limits listing */}
                  <div className="grid grid-cols-1 gap-3.5 pt-1.5">
                    <div>
                      <h5 className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
                        <Check className="h-3 w-3 text-emerald-600 block shrink-0" /> Được phép (Permissions)
                      </h5>
                      <div className="mt-1.5 space-y-1">
                        {ROLES_META.find(r => r.role === selectedRolePreview)?.allowArr.map((allow, idx) => (
                          <div key={idx} className="flex items-start gap-1 pb-1">
                            <span className="text-emerald-500 text-[10px] mt-0.5">✔</span>
                            <span className="text-[11px] text-slate-600 font-bold">{allow}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {ROLES_META.find(r => r.role === selectedRolePreview)?.limitArr && (ROLES_META.find(r => r.role === selectedRolePreview)?.limitArr.length || 0) > 0 && (
                      <div className="border-t border-slate-100 pt-3">
                        <h5 className="text-[10px] font-extrabold text-rose-800 uppercase tracking-widest flex items-center gap-1.5">
                          <X className="h-3 w-3 text-rose-600 block shrink-0" /> Giới hạn bảo mật (Restrictions)
                        </h5>
                        <div className="mt-1.5 space-y-1">
                          {ROLES_META.find(r => r.role === selectedRolePreview)?.limitArr.map((limit, idx) => (
                            <div key={idx} className="flex items-start gap-1 pb-1">
                              <span className="text-rose-500 text-[10px] mt-0.5">✖</span>
                              <span className="text-[11px] text-slate-650 font-bold">{limit}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* System rules notification panel */}
              <div className="bg-slate-900 text-slate-300 rounded-2xl p-4.5 border border-slate-800 text-xs shadow-md space-y-3.5">
                <h4 className="font-extrabold text-white uppercase tracking-wider flex items-center gap-1 text-[11px]">
                  <Settings className="h-3.5 w-3.5 text-emerald-400" /> QUY TẮC CỨNG HỆ THỐNG
                </h4>
                <ol className="list-decimal list-inside space-y-1.5 text-[10.5px] text-slate-350 font-medium leading-relaxed">
                  <li>Tài khoản không được chỉ định vai trò mặc định nhận quyền <strong>VIEWER (Chỉ xem)</strong>.</li>
                  <li><strong>Lịch sử Audit Log:</strong> Ghi vết toàn cục, lưu trữ phi tập trung và không cho phép xóa/sửa đổi bởi bất kỳ cán bộ nào.</li>
                  <li><strong>Công tác viên / Tổ dân cư:</strong> Mọi thay đổi dữ liệu hành chính phải thông qua kiểm định và phê duyệt trực tiếp bởi Trưởng Khu Phố hoặc Bí thư mới có hiệu lực.</li>
                </ol>
              </div>
            </div>

            {/* Right Cols (2/3 width): Interactive grid table of Modules & Capabilities */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-3xs space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-50 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase">
                      Ma Trận Phân Quyền Theo Module Chuyên Biệt ({MODULE_LIST.length})
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Chi tiết các quyền được phân bổ cấu trúc trực quan theo từng lĩnh vực nghiệp vụ của vai trò: <strong className="text-emerald-700"> {selectedRolePreview}</strong></p>
                  </div>
                  
                  <div className="flex gap-2 text-[9px] font-sans shrink-0 uppercase tracking-wider">
                    <span className="bg-sky-50 text-sky-700 font-extrabold border border-sky-100 px-1.5 py-0.5 rounded">V: View</span>
                    <span className="bg-emerald-50 text-emerald-700 font-extrabold border border-emerald-100 px-1.5 py-0.5 rounded">C: Create</span>
                    <span className="bg-amber-50 text-amber-700 font-extrabold border border-amber-100 px-1.5 py-0.5 rounded">U: Edit</span>
                    <span className="bg-rose-50 text-rose-700 font-extrabold border border-rose-100 px-1.5 py-0.5 rounded">D: Delete</span>
                    <span className="bg-purple-50 text-purple-700 font-extrabold border border-purple-100 px-1.5 py-0.5 rounded">A: Approve</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left font-sans text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] text-slate-400 font-black uppercase tracking-wider border-b border-slate-100">
                        <th className="py-2.5 px-3">Module Quản Lý</th>
                        <th className="py-2.5 px-3 text-center">Trạng Thái Truy Cập</th>
                        <th className="py-2.5 px-3">Phân Quyền Chức Năng Cấp Chi Tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {MODULE_LIST.map(mod => {
                        const perms = getMatrixPermission(selectedRolePreview, mod.key);
                        const isAccessible = perms.length > 0;
                        
                        return (
                          <tr key={mod.key} className="hover:bg-slate-50/50 transition">
                            <td className="py-3 px-3">
                              <span className="font-extrabold text-slate-800">{mod.name}</span>
                              <span className="text-[9.5px] text-slate-400 block font-mono">@{mod.key}</span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              {isAccessible ? (
                                <span className="inline-flex items-center gap-1 text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 font-extrabold px-2 py-0.5 rounded-full uppercase">
                                  <Check className="h-2 w-2" /> Kích Hoạt
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[9px] bg-slate-50 text-slate-400 border border-slate-200 font-bold px-2 py-0.5 rounded-full uppercase">
                                  <X className="h-2 w-2" /> Chặn
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {isAccessible ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {perms.map(p => (
                                    <span
                                      key={p}
                                      className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${getPermissionBadgeStyle(p)}`}
                                      title={getPermissionLabel(p)}
                                    >
                                      {p}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">Không được cấp quyền tương tác</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

              </div>
            </div>

          </div>

        </div>
      )}

      {/* TAB 2: ACCOUNTS CREATIONS & LOG LIST */}
      {activeTab === "accounts" && (
        <div className="space-y-6 animate-in fade-in duration-250">
          
          <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-6 shadow-sm">
            
            {/* ID recovery request processing alerts list */}
            {isSuperAdminOrGoc && forgotIdReqs.length > 0 && (
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4.5 space-y-3 animate-in fade-in duration-205">
                <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                  <span className="text-xs font-black text-amber-950 uppercase flex items-center gap-1.5">
                    🛎️ Yêu cầu hỗ trợ quên ID Đăng Nhập ({forgotIdReqs.length})
                  </span>
                  <span className="text-[9px] bg-amber-400 text-slate-900 font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider">Chờ xử lý</span>
                </div>
                <div className="divide-y divide-amber-100/70 max-h-36 overflow-y-auto pr-1">
                  {forgotIdReqs.map((req) => (
                    <div key={req.id} className="py-2.5 flex items-center justify-between text-xs gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-800">{req.fullName}</p>
                          <span className="bg-amber-100 text-amber-900 text-[8px] font-bold px-1 py-0.2 rounded uppercase">Quên ID</span>
                        </div>
                        <p className="text-[10px] font-mono text-slate-500">ID hiện tại: <strong className="text-indigo-900">@{req.currentEmail}</strong> • Gửi lúc: {formatDateTime(req.timestamp)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const matchingAcc = accounts.find((a: any) => a.fullName === req.fullName);
                            if (matchingAcc) {
                              setInlineEmailEditId(matchingAcc.id);
                              setInlineNewEmail(matchingAcc.email);
                              setErrorBanner(null);
                            } else {
                              setErrorBanner(`Không tìm thấy hàng tài khoản của cán bộ ${req.fullName} trên danh sách chính để đổi ID.`);
                            }
                          }}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-lg text-[10px] hover:text-white transition duration-150 cursor-pointer"
                        >
                          Đổi ID ngay
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const r = await fetch(`/api/accounts/forgot-id-requests/${req.id}/resolve`, {
                                method: "POST",
                                headers: {
                                  "x-user-email": encodeURIComponent(currentUser?.email || "")
                                }
                              });
                              if (r.ok) {
                                setForgotIdReqs(prev => prev.filter(item => item.id !== req.id));
                              }
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                          className="text-slate-400 hover:text-rose-600 font-bold text-[10px] underline cursor-pointer p-1"
                        >
                          Xóa yêu cầu
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Title card & create triggers */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-50 pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-1.5">
                  <UserCog className="h-4 w-4 text-emerald-600" />
                  Danh Sách & Phân Quyền Vai Trò Cán Bộ Địa Bàn KP3
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Chỉ Quản trị viên cao cấp mới có quyền cấu hình, khóa tài khoản hoặc bật/tắt quyền hạn.</p>
              </div>

              {isAuthorizedManager && (
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(!showCreateForm);
                    setCreateErr("");
                    setCreateMsg("");
                    setFieldErrors({});
                  }}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black tracking-wide uppercase transition-all flex items-center gap-1 shadow-sm shrink-0 cursor-pointer duration-200"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  {showCreateForm ? "Đóng Form Cấp Phát" : "＋ Cấp tài khoản mới"}
                </button>
              )}
            </div>

            {/* Form Create Account block */}
            {showCreateForm && isAuthorizedManager && (
              <form onSubmit={handleCreateAccount} className="bg-slate-50 border border-slate-105 p-5 rounded-xl space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center gap-1.5">
                  <span className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-black">1</span>
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                    Khởi tạo tài khoản nghiệp vụ an ninh khu phố
                  </h4>
                </div>

                {createErr && (
                  <div className="text-[11px] text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-100 font-bold">
                    ⚠️ {createErr}
                  </div>
                )}
                {createMsg && (
                  <div className="text-[11px] text-emerald-750 bg-emerald-50 p-2.5 rounded-lg border border-emerald-100 font-bold">
                    ✨ {createMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  
                  {/* Fullname input */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-600 uppercase">Họ và Tên cán bộ</label>
                    <input
                      type="text"
                      required
                      placeholder="vd: Nguyễn Văn Minh"
                      value={newFullName}
                      onChange={(e) => {
                        setNewFullName(e.target.value);
                        if (fieldErrors.fullName) setFieldErrors(p => ({ ...p, fullName: undefined }));
                      }}
                      className="w-full text-xs font-bold bg-white border border-slate-200 rounded-lg py-2 px-3 focus:outline-none focus:border-emerald-505 transition-all placeholder-slate-400 text-slate-850"
                    />
                    {fieldErrors.fullName && <span className="text-[9px] text-rose-500 font-bold block">{fieldErrors.fullName}</span>}
                  </div>

                  {/* Account Login ID */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-600 uppercase">Tên tài khoản (ID đăng nhập)</label>
                    <input
                      type="text"
                      required
                      placeholder="vd: canbo_kp3 hoặc email"
                      value={newEmail}
                      onChange={(e) => {
                        setNewEmail(e.target.value);
                        if (fieldErrors.email) setFieldErrors(p => ({ ...p, email: undefined }));
                      }}
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg py-2 px-3 focus:outline-none focus:border-emerald-505 transition-all font-mono placeholder-slate-400 text-slate-850"
                    />
                    {fieldErrors.email && <span className="text-[9px] text-rose-500 font-bold block">{fieldErrors.email}</span>}
                  </div>

                  {/* Password */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-600 uppercase">Mật khẩu khởi tạo</label>
                    <input
                      type="password"
                      required
                      placeholder="Mật khẩu từ 4 ký tự"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (fieldErrors.password) setFieldErrors(p => ({ ...p, password: undefined }));
                      }}
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg py-2 px-3 focus:outline-none focus:border-emerald-505 transition-all text-slate-850"
                    />
                    {fieldErrors.password && <span className="text-[9px] text-rose-500 font-bold block">{fieldErrors.password}</span>}
                  </div>

                  {/* Initial Role */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-600 uppercase">Vai trò nghiệp vụ chính</label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as UserRole)}
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg py-2 px-3 focus:outline-none focus:border-emerald-505 cursor-pointer font-bold text-slate-705"
                    >
                      <option value="Cán bộ nhập liệu">Cán bộ nhập liệu</option>
                      <option value="Chi hội trưởng">Chi hội trưởng</option>
                      <option value="Bí thư Chi bộ">Bí thư Chi bộ</option>
                      <option value="Trưởng Khu phố">Trưởng Khu phố</option>
                      <option value="Trưởng ban công tác Mặt trận">Trưởng ban công tác Mặt trận</option>
                      <option value="Tổ trưởng Tổ dân phố">Tổ trưởng Tổ dân phố</option>
                      <option value="Cộng tác viên">Cộng tác viên</option>
                      <option value="Viewer">Viewer (Chỉ xem)</option>
                      {currentUser?.role === "Super Admin" && <option value="Super Mod">★ Super Mod</option>}
                      {currentUser?.role === "Super Admin" && <option value="Super Admin">★ Super Admin</option>}
                    </select>
                  </div>

                  {/* Association list switcher ONLY if Chi hội trưởng chosen */}
                  {newRole === "Chi hội trưởng" && (
                    <div className="space-y-1 sm:col-span-2 bg-indigo-50/40 p-3 rounded-lg border border-indigo-100">
                      <label className="block text-[10px] font-bold text-indigo-700 uppercase">Hội / Đoàn thể đảm nhiệm</label>
                      <select
                        value={newAssociationGroup}
                        onChange={(e) => setNewAssociationGroup(e.target.value)}
                        className="w-full text-xs bg-indigo-50 border border-indigo-200 text-indigo-950 font-black rounded-lg py-2 px-3 focus:outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="Phụ nữ">Hội liên hiệp Phụ nữ</option>
                        <option value="CCB">HỘI CỰU CHIẾN BINH (CCB)</option>
                        <option value="Thanh niên">Đoàn Thanh niên</option>
                        <option value="Chữ thập đỏ">Hội Chữ thập đỏ KP3</option>
                        <option value="Khuyến học">Hội Khuyến học</option>
                        <option value="Người cao tuổi">Hội Người cao tuổi</option>
                      </select>
                      <span className="text-[10px] text-slate-450 block mt-1 leading-normal font-medium">Chi hội trưởng chỉ có quyền thao tác cập nhật cho cư dân thuộc đúng đoàn thể này.</span>
                    </div>
                  )}

                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-slate-100 pt-3 gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <label className="block text-[11px] font-bold text-slate-650 uppercase">Phân quyền sửa đổi:</label>
                    <select
                      value={newPermissionType}
                      onChange={(e) => setNewPermissionType(e.target.value)}
                      className="text-xs font-extrabold bg-emerald-50 text-emerald-900 border border-emerald-250 rounded-lg py-1 px-3.5 focus:outline-emerald-500 cursor-pointer"
                    >
                      <option value="Toàn quyền">Toàn quyền / Quản lý</option>
                      <option value="Xem và nhập liệu">Xem và nhập liệu</option>
                      <option value="Ngăn nắp đoàn thể">Ngăn nắp đoàn thể</option>
                      <option value="Chỉ xem">Chỉ xem</option>
                    </select>
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="px-3 py-1.5 border border-slate-205 text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer font-semibold transition"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg cursor-pointer font-black transition-all"
                    >
                      Xác nhận: Cấp tài khoản
                    </button>
                  </div>
                </div>

              </form>
            )}

            {/* Main Accounts Grid with detailed security badges */}
            {loadingAccounts && accounts.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs font-semibold flex flex-col justify-center items-center gap-2">
                <RefreshCw className="h-5 w-5 animate-spin text-emerald-600" />
                <span>Đang tải danh tính cán bộ an ninh...</span>
              </div>
            ) : accountsError ? (
              <div className="text-center py-6 text-rose-500 text-xs font-bold">{accountsError}</div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                        <th className="py-3 px-4">Thông tin cán bộ</th>
                        <th className="py-3 px-4">Đơn vị & Vai trò</th>
                        <th className="py-3 px-4 text-center">Bảo mật (2FA)</th>
                        <th className="py-3 px-4 text-center">Quyền sửa</th>
                        <th className="py-3 px-4 text-right">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium">
                      {accounts.map(acc => {
                        const isSuperAdminAccount = acc.email === "admin" || acc.role === "Super Admin";
                        const isLocked = lockedStates[acc.id] ?? (!acc.active);
                        const is2FA = tfaStates[acc.id] ?? false;
                        const logsForAccount = loginHistory[acc.id] || [];
                        
                        return (
                          <tr key={acc.id} className={`hover:bg-slate-50/40 transition duration-150 ${isLocked ? "bg-slate-50/70 opacity-80" : ""}`}>
                            
                            {/* Staff Name, Email ID, Inline Override Popups */}
                            <td className="py-4 px-4 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={`font-black text-xs ${isLocked ? "text-slate-400" : "text-slate-800"}`}>
                                  {acc.fullName}
                                </span>
                                {acc.email === "admin" && (
                                  <span className="bg-amber-100 text-amber-900 border border-amber-200 font-extrabold px-1.5 py-0.5 rounded text-[8px] uppercase font-sans">Gốc</span>
                                )}
                                {isLocked && (
                                  <span className="bg-rose-100 text-rose-800 border border-rose-200 font-black px-1.5 py-0.2 rounded text-[7px] uppercase font-sans">Bị khóa</span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2">
                                <span>ID: <strong className="text-slate-700">@{acc.email}</strong></span>
                              </div>

                              {/* Interactive actions under staff profile */}
                              <div className="flex flex-wrap gap-2 pt-2">
                                {inlinePasswordResetId === acc.id ? (
                                  <div className="bg-teal-50 border border-teal-200 rounded-lg p-2 flex items-center gap-1.5 animate-in slide-in-from-top-1 w-fit">
                                    <input
                                      type="text"
                                      placeholder="Mật khẩu mới..."
                                      value={inlineNewPassword}
                                      onChange={(e) => setInlineNewPassword(e.target.value)}
                                      className="text-[10px] bg-white border border-slate-300 rounded py-0.5 px-1.5 focus:outline-none focus:border-emerald-600 w-24 text-slate-800 font-bold"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleInlineResetPassword(acc.id)}
                                      className="bg-emerald-100 hover:bg-emerald-200 text-black border border-emerald-300 px-2.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition duration-150 shadow-3xs"
                                    >
                                      Lưu
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setInlinePasswordResetId(null); setInlineNewPassword(""); }}
                                      className="text-slate-400 hover:text-rose-600 text-[9px] hover:underline cursor-pointer font-bold"
                                    >
                                      Hủy
                                    </button>
                                  </div>
                                ) : (
                                  isAuthorizedManager && !isSuperAdminAccount && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setInlinePasswordResetId(acc.id);
                                        setInlineNewPassword("");
                                        setInlineEmailEditId(null);
                                      }}
                                      className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50/50 hover:bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100/40"
                                    >
                                      <Key className="h-2.5 w-2.5" /> Đổi MK
                                    </button>
                                  )
                                )}

                                {inlineEmailEditId === acc.id ? (
                                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2 flex items-center gap-1.5 animate-in slide-in-from-top-1 w-fit">
                                    <input
                                      type="text"
                                      placeholder="ID mới..."
                                      value={inlineNewEmail}
                                      onChange={(e) => setInlineNewEmail(e.target.value)}
                                      className="text-[10px] bg-white border border-slate-300 rounded py-0.5 px-1.5 focus:outline-none focus:border-indigo-600 w-28 text-slate-800 font-bold font-mono"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleInlineChangeId(acc.id, acc.email)}
                                      className="bg-indigo-600 hover:bg-indigo-750 text-white px-2 py-0.5 rounded text-[9px] font-black cursor-pointer transition"
                                    >
                                      Sửa
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setInlineEmailEditId(null); setInlineNewEmail(""); }}
                                      className="text-slate-405 hover:text-rose-600 text-[9px] hover:underline cursor-pointer font-bold"
                                    >
                                      Hủy
                                    </button>
                                  </div>
                                ) : (
                                  isSuperAdminOrGoc && !isSuperAdminAccount && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setInlineEmailEditId(acc.id);
                                        setInlineNewEmail(acc.email);
                                        setInlinePasswordResetId(null);
                                      }}
                                      className="text-[10px] text-indigo-650 hover:text-indigo-750 font-bold flex items-center gap-1 bg-indigo-50/50 hover:bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100/40"
                                    >
                                      <UserCog className="h-2.5 w-2.5" /> Sửa ID
                                    </button>
                                  )
                                )}
                              </div>
                            </td>

                            {/* Role representation */}
                            <td className="py-4 px-4 w-1/4">
                              <div className="space-y-1">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black ${
                                  acc.role === "Super Admin" ? "bg-rose-50 text-rose-800 border border-rose-200" :
                                  acc.role === "Super Mod" ? "bg-orange-50 text-orange-850 border border-orange-200" :
                                  acc.role === "Bí thư Chi bộ" ? "bg-red-50 text-red-800 border border-red-200" :
                                  acc.role === "Trưởng Khu phố" || acc.role === "Trưởng Ban điều hành" ? "bg-amber-50 text-amber-850 border border-amber-250" :
                                  acc.role === "Chi hội trưởng" ? "bg-indigo-50 text-indigo-800 border border-indigo-250" :
                                  acc.role === "Cán bộ nhập liệu" ? "bg-teal-50 text-teal-800 border border-teal-200" :
                                  "bg-slate-50 text-slate-800 border border-slate-200"
                                }`}>
                                  {acc.role === "Super Admin" || acc.role === "Super Mod" ? "★" : "👤"} {acc.role}
                                </span>

                                {/* Association group selection if chi hoi truong */}
                                {acc.role === "Chi hội trưởng" && (
                                  <div className="flex items-center gap-1 pl-1">
                                    <span className="text-[9.5px] text-slate-400 font-extrabold uppercase">Chi hội:</span>
                                    <select
                                      disabled={!isAuthorizedManager || updatingId === acc.id}
                                      value={acc.associationGroup || "CCB"}
                                      onChange={(e) => handleUpdateAccount(acc.id, { associationGroup: e.target.value })}
                                      className="text-[9.5px] font-black bg-indigo-50 text-indigo-800 border border-indigo-200 rounded py-0.5 px-1 cursor-pointer focus:outline-emerald-500"
                                    >
                                      <option value="Phụ nữ">Phụ nữ</option>
                                      <option value="CCB">CCB</option>
                                      <option value="Thanh niên">Thanh Niên</option>
                                      <option value="Chữ thập đỏ">Chữ Thập Đỏ</option>
                                      <option value="Khuyến học">Khuyến học</option>
                                      <option value="Người cao tuổi">Người cao tuổi</option>
                                    </select>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Simulated 2-Factor Authentication state */}
                            <td className="py-4 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => toggle2FA(acc.id)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-extrabold cursor-pointer border hover:shadow-3xs transition-all ${
                                  is2FA
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                    : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                }`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${is2FA ? "bg-emerald-500" : "bg-amber-400"}`}></span>
                                {is2FA ? "2FA: ĐÃ BẬT" : "2FA: CHƯA BẬT"}
                              </button>
                            </td>

                            {/* Right to Edit switch */}
                            <td className="py-4 px-4 text-center">
                              {acc.email === "admin" || acc.role === "Super Admin" ? (
                                <span className="text-[10px] font-extrabold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-1 rounded">Toàn quyền</span>
                              ) : (
                                <select
                                  disabled={!isAuthorizedManager || updatingId === acc.id}
                                  value={acc.permissionType || (acc.canEdit === false ? "Chỉ xem" : (acc.role === "Cán bộ nhập liệu" ? "Xem và nhập liệu" : (acc.role === "Chi hội trưởng" ? "Ngăn nắp đoàn thể" : "Toàn quyền")))}
                                  onChange={(e) => handleUpdateAccount(acc.id, { permissionType: e.target.value })}
                                  className="text-xs font-extrabold bg-emerald-50/55 border border-emerald-250 text-emerald-950 rounded-xl py-1 px-2.5 focus:outline-emerald-500 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed mx-auto block w-fit"
                                >
                                  <option value="Toàn quyền" className="font-bold text-slate-800 bg-white">Toàn quyền</option>
                                  <option value="Xem và nhập liệu" className="font-bold text-slate-800 bg-white">Xem & Nhập thô</option>
                                  <option value="Ngăn nắp đoàn thể" className="font-bold text-slate-800 bg-white">Đoàn thể mình</option>
                                  <option value="Chỉ xem" className="font-bold text-slate-800 bg-white">Chỉ xem</option>
                                </select>
                              )}
                            </td>

                            {/* Block / Active toggle */}
                            <td className="py-4 px-4 text-right">
                              {acc.email === "admin" ? (
                                <span className="text-[10px] text-emerald-600 font-extrabold bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded-full uppercase">Sở hữu</span>
                              ) : (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    disabled={!isAuthorizedManager || updatingId === acc.id}
                                    onClick={() => handleUpdateAccount(acc.id, { active: isLocked })}
                                    className={`text-[10px] font-extrabold px-2.5 py-1 border rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95 ${
                                      isLocked 
                                        ? "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100" 
                                        : "text-rose-600 bg-rose-50 border-rose-200 hover:bg-rose-100"
                                    }`}
                                  >
                                    <Power className="h-2.5 w-2.5" />
                                    {isLocked ? "Mở Khóa" : "Khóa Lại"}
                                  </button>
                                </div>
                              )}
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Sub-block: Login history summary with interactive map view simulation */}
                <div className="bg-slate-50 border border-slate-105 rounded-2xl p-4.5">
                  <h4 className="text-[11px] font-black text-slate-800 uppercase flex items-center gap-1.5 tracking-wide border-b border-slate-100 pb-2 mb-3">
                    <Globe className="h-3.5 w-3.5 text-emerald-600" />
                    Lịch sử Đăng nhập & Audit Thiết bị (Simulated Session Logs)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {accounts.slice(0, 4).map(acc => {
                      const logs = loginHistory[acc.id] || [];
                      return (
                        <div key={acc.id} className="bg-white p-3 rounded-xl border border-slate-100 space-y-1.5">
                          <div className="flex items-center justify-between border-b border-slate-50 pb-1">
                            <span className="font-black text-xs text-slate-800">{acc.fullName}</span>
                            <span className="text-[8px] font-mono text-indigo-700">@{acc.email}</span>
                          </div>
                          <div className="space-y-1 text-[10.5px]">
                            {logs.map((log, i) => (
                              <div key={i} className="flex items-center justify-between gap-2 text-slate-500">
                                <span className="flex items-center gap-1 text-[9.5px]">
                                  <Smartphone className="h-3 w-3 text-slate-400 shrink-0" />
                                  <span className="truncate max-w-[130px] font-medium">{log.device}</span>
                                </span>
                                <span className="font-mono text-[9px] text-slate-455 bg-slate-50 px-1 py-0.2 rounded shrink-0">{log.ip}</span>
                                <span className="text-[9.5px] italic text-slate-400 ml-auto font-sans text-right">{log.time}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {!isAuthorizedManager && (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-2.5 text-amber-900 leading-relaxed font-semibold">
                <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-black text-slate-900">Thông báo Bảo Mật (Audit Restricted)</p>
                  <p className="text-[11px] text-amber-800 font-medium">Bạn đang tham gia với tư cách cán bộ nghiệp vụ. Chỉ ban chỉ đạo Thường Trực điều hành (Super Admin, Thường Trực) mới có quyền khóa/mở khóa tài khoản hoặc điều chỉnh định dạng phân bổ các bộ hồ sơ.</p>
                </div>
              </div>
            )}

          </div>

        </div>
      )}

      {/* TAB 3: SYSTEM AUDIT LOG PANEL */}
      {activeTab === "logs" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5 shadow-sm animate-in fade-in duration-200">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-50 pb-4">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-1.5">
                <History className="h-4 w-4 text-emerald-600" />
                Nhật Ký Vận Hành Chi Tiết (Active System Audit Trails)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Biến động hệ thống, ghi nhận 100% hoạt động Thêm/Sửa/Xóa và kiểm duyệt nội dung.</p>
            </div>

            {/* Quick in-table export simulator block */}
            <div className="flex gap-1.5 shrink-0">
              <span className="text-[10px] bg-slate-100 text-slate-705 border border-slate-200 p-2.5 rounded-xl font-bold font-mono">
                Số lượng log: {filteredLogs.length}
              </span>
            </div>
          </div>

          {/* Filters controls bar */}
          <div className="flex flex-col md:flex-row gap-3">
            
            {/* Search query input */}
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                <Search className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                placeholder="Tìm nội dung vết, mã cán bộ, lý do biến động..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="w-full text-xs font-bold bg-slate-50 border border-slate-205 rounded-xl pl-9 pr-4 py-2 w-full focus:outline-none focus:border-emerald-500 text-slate-800"
              />
            </div>

            {/* Category selection */}
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setLogCategory("ALL")}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                  logCategory === "ALL"
                    ? "bg-slate-900 border-slate-900 text-white"
                    : "bg-white border-slate-200 text-slate-650 hover:bg-slate-50"
                }`}
              >
                Mọi Hoạt Động
              </button>
              
              <button
                onClick={() => setLogCategory("CRUD")}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                  logCategory === "CRUD"
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "bg-white border-slate-200 text-slate-650 hover:bg-slate-50"
                }`}
              >
                Thao Tác Thô (CRUD)
              </button>

              <button
                onClick={() => setLogCategory("SYSTEM")}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                  logCategory === "SYSTEM"
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "bg-white border-slate-200 text-slate-650 hover:bg-slate-50"
                }`}
              >
                Cấu Hình Mạng
              </button>

              <button
                onClick={() => setLogCategory("ACCESS")}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                  logCategory === "ACCESS"
                    ? "bg-rose-600 border-rose-600 text-white"
                    : "bg-white border-slate-200 text-slate-650 hover:bg-slate-50"
                }`}
              >
                An Ninh / Khóa
              </button>
            </div>

          </div>

          {/* List of active log items */}
          <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
            {filteredLogs.length === 0 ? (
              <div className="text-center text-xs text-slate-400 py-10 font-bold flex flex-col justify-center items-center gap-2">
                <Filter className="h-6 w-6 text-slate-300" />
                <span>Không tìm thấy bản ghi Audit Log nào khớp với lựa chọn bộ lọc.</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredLogs.map(log => {
                  const displayDate = formatDateTime(log.timestamp);
                  
                  // Category determination
                  const isDel = (log.action || "").toUpperCase().includes("XÓA");
                  const isChange = (log.action || "").toUpperCase().includes("CẬP NHẬT") || (log.action || "").toUpperCase().includes("SỬA");
                  const isSecurity = ["KHÓA", "TÀI KHOẢN", "ID", "MẬT KHẨU"].some(p => (log.action || "").toUpperCase().includes(p));

                  return (
                    <div key={log.id} className="py-3 flex flex-col sm:flex-row justify-between items-start gap-2 text-xs">
                      
                      {/* Left: action text and details */}
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1 font-black px-2 py-0.5 rounded text-[9.5px] uppercase ${
                            isDel ? "bg-rose-100 text-rose-800 border border-rose-200" :
                            isChange ? "bg-amber-100 text-amber-80 * border border-amber-200" :
                            isSecurity ? "bg-indigo-100 text-indigo-800 border border-indigo-200" :
                            "bg-sky-100 text-sky-800 border border-sky-200"
                          }`}>
                            {log.action}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium italic">{displayDate}</span>
                        </div>
                        <p className="text-[11.5px] text-slate-700 leading-relaxed font-semibold">
                          {log.details || "Thực hiện biến động số liệu trên hệ thống."}
                        </p>
                      </div>

                      {/* Right: handler metadata */}
                      <div className="bg-slate-50 border border-slate-100 p-2 rounded-xl text-right shrink-0 min-w-[200px] space-y-0.5">
                        <div className="flex items-center gap-1.5 justify-end text-[10.5px]">
                          <span className="text-slate-400 font-bold">Thực hiện:</span>
                          <span className="font-extrabold text-slate-800">{log.userName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 justify-end text-[9.5px]">
                          <span className="text-slate-400 font-bold font-sans">Vai trò:</span>
                          <span className={`font-extrabold px-1.5 py-0.2 rounded ${
                            log.userRole === "Super Admin" ? "bg-red-50 text-red-700" :
                            log.userRole === "Bí thư Chi bộ" ? "bg-red-50 text-red-700" :
                            log.userRole === "Trưởng Khu phố" ? "bg-amber-50 text-amber-900" :
                            "bg-slate-100 text-slate-600"
                          }`}>
                            {log.userRole}
                          </span>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 4: SUPABASE ENGINE CONFIGURATION */}
      {activeTab === "supabase" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-6 shadow-sm animate-in fade-in duration-200">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-50 pb-4">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-1.5">
                <Database className="h-4 w-4 text-emerald-600" />
                Cấu Hình Đồng Bộ Đám Mây (Supabase Real-Time Cloud Sync)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Dữ liệu nhân khẩu tự động sao lưu dự phòng mật mã hóa lên hạ tầng Supabase Cloud.</p>
            </div>
            
            <button
              onClick={fetchSupabaseStatus}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" /> Kiểm tra trạng thái
            </button>
          </div>

          {/* Connection Status Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-3">
              <h4 className="text-xs font-extrabold text-slate-600 uppercase tracking-wider">Trạng thái kết nối</h4>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-450 font-bold">API Kết nối URL:</span>
                  <span className="font-mono text-[10px] bg-slate-150 px-2 py-0.5 rounded text-indigo-950 font-extrabold select-all">
                    https://tsogbcucuybbebfniiur.supabase.co
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-450 font-bold">Cấu hình API Key:</span>
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> Đã kết nối (Active Vault)
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-bold">Bảng lưu trữ system_state:</span>
                  {supabaseStatus?.tableAvailable ? (
                    <span className="text-emerald-700 font-extrabold bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Đã đồng bộ trực tuyến (Live)
                    </span>
                  ) : (
                    <span className="text-amber-850 font-extrabold bg-amber-50 border border-amber-100 px-3 py-1 rounded-full flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span> Chưa tạo bảng system_state
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-emerald-50/40 border border-emerald-100/50 p-4 rounded-2xl text-xs space-y-2 leading-relaxed text-slate-750">
              <h4 className="font-extrabold text-emerald-950 uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="h-4 w-4 text-emerald-600" /> CÁCH THỨC VẬN HÀNH
              </h4>
              <p>
                1. <strong>Lưu trữ kép</strong>: Mọi sự thay đổi (Thêm mới nhân khẩu, sửa đổi cơ sở, cấp lại vai trò, ghi lịch công tác) đều được lưu trữ trực tiếp vào tệp bộ đệm <code className="bg-emerald-100/40 px-1 py-0.2 rounded font-mono text-[11px] text-emerald-800">data.json</code> cục bộ để đảm bảo tốc độ phản hồi tối ưu.
              </p>
              <p>
                2. <strong>Sao lưu Đám mây</strong>: Server tự động đẩy trạng thái mới nhất lên Supabase thông qua kiểm tra khóa bí mật. Khi máy chủ khởi động lại, nếu bảng online sẵn sàng, máy chủ sẽ đồng bộ ngược dữ liệu mới nhất trở về hệ thống.
              </p>
            </div>
          </div>

          {/* Sync Trigger and Setup Block */}
          {supabaseStatus && !supabaseStatus.tableAvailable && (
            <div className="border border-amber-100 bg-amber-50/20 p-5 rounded-2xl space-y-4 animate-in fade-in duration-300">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5 mr-1" />
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-amber-900 uppercase">Yêu cầu tạo bảng trên trang quản trị Supabase</h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                    Hệ thống đã kết nối thành công tới tài khoản Supabase của Ban điều hành, nhưng chưa tìm thấy bảng <strong>system_state</strong> để lưu trạng thái. Quản trị viên vui lòng truy cập vào <strong>Supabase SQL Editor</strong> của dự án, dán và thực hiện truy vấn SQL dưới đây để tự động tạo bảng:
                  </p>
                </div>
              </div>

              {/* SQL Code Block */}
              <div className="relative">
                <pre className="bg-slate-900 text-emerald-400 p-4 rounded-xl text-[10.5px] font-mono leading-relaxed overflow-x-auto border border-slate-800 max-h-[180px] shadow-inner select-all">
                  {supabaseStatus.sqlSetup}
                </pre>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(supabaseStatus.sqlSetup);
                    alert("Đã sao chép mã SQL thiết lập vào khay nhớ tạm!");
                  }}
                  className="absolute right-3 top-3 px-2 py-1 bg-slate-800 text-slate-200 hover:bg-slate-700 font-sans text-[10px] font-bold rounded border border-slate-700 transition cursor-pointer"
                >
                  Sao chép SQL
                </button>
              </div>

              {/* Manual Sync Trigger */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleTriggerSupabaseSync}
                  disabled={supabaseSyncing}
                  className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow transition cursor-pointer border ${
                    supabaseSyncing 
                      ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed" 
                      : "bg-emerald-600 border-emerald-600 hover:bg-emerald-700 text-white"
                  }`}
                >
                  <RefreshCw className={`h-4 w-4 ${supabaseSyncing ? "animate-spin" : ""}`} />
                  {supabaseSyncing ? "Đang thử đồng bộ..." : "Xác nhận đã tạo bảng & Thử đồng bộ ngay"}
                </button>
                <span className="text-[11px] text-slate-500 font-medium font-semibold">Bấm vào đây sau khi đã chạy câu lệnh SQL trên trang dự án Supabase.</span>
              </div>
            </div>
          )}

          {supabaseStatus && supabaseStatus.tableAvailable && (
            <div className="border border-emerald-100 bg-emerald-50/10 p-5 rounded-2xl space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                <div>
                  <h4 className="text-xs font-black text-emerald-950 uppercase">Hạ tầng đồng bộ hoạt động ổn định</h4>
                  <p className="text-xs text-slate-600 mt-0.5 font-semibold">Dữ liệu được cập nhật tự động lên hệ thống Supabase. Bạn vẫn có thể bấm nút dưới đây để thực hiện đồng bộ khẩn cấp trạng thái hiện tại lên đám mây.</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTriggerSupabaseSync}
                  disabled={supabaseSyncing}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wide rounded-xl flex items-center gap-2 cursor-pointer transition border border-slate-800"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${supabaseSyncing ? "animate-spin" : ""}`} />
                  <span>{supabaseSyncing ? "Đang đồng bộ..." : "Đồng bộ khẩn cấp lên đám mây"}</span>
                </button>
              </div>
            </div>
          )}

          {/* Feedback banners */}
          {supabaseSyncMessage && (
            <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-xs text-emerald-800 font-extrabold flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{supabaseSyncMessage}</span>
            </div>
          )}

          {supabaseSyncError && (
            <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl text-xs text-rose-800 font-extrabold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{supabaseSyncError}</span>
            </div>
          )}

        </div>
      )}

    </div>
  );
}

import React, { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { Resident, Household } from "../types";
import { formatDate } from "../utils/dateTimeUtils";
import { 
  Search, UserPlus, FileUp, Filter, Trash2, Edit3, UserCheck, 
  ShieldAlert, Check, HelpCircle, ArrowRight, User, Sparkles, 
  Brain, FileText, Clipboard, Upload, RefreshCw, CheckCircle2, 
  AlertTriangle, Plus, X, Settings2, Download, FileSpreadsheet, Users, Lock,
  Home, LayoutGrid, List, MapPin, Phone
} from "lucide-react";

interface ResidentsManagerProps {
  residents: Resident[];
  households: Household[];
  activeRole: string;
  onRefresh: () => void;
  currentUser?: any;
}

export default function ResidentsManager({ residents, households, activeRole, onRefresh, currentUser }: ResidentsManagerProps) {
  // Navigation tabs of residence
  const [activeTab, setActiveTab] = useState<"residents" | "households" | "import">("residents");
  const [householdViewMode, setHouseholdViewMode] = useState<"grid" | "compact">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterResidenceType, setFilterResidenceType] = useState<string>("All");
  const [filterGroup, setFilterGroup] = useState<string>("All");
  const [filterNDTQ, setFilterNDTQ] = useState<string>("All");
  
  // Dynamic resident groups & organizations configuration
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [isManagingGroups, setIsManagingGroups] = useState(false);

  // Dynamic Tổ NDTQ (Tổ Nhân dân tự quản) configuration
  const [availableNDTQs, setAvailableNDTQs] = useState<string[]>([]);
  const [newNDTQName, setNewNDTQName] = useState("");
  const [isManagingNDTQs, setIsManagingNDTQs] = useState(false);

  // Dynamic Đối tượng chính sách & an sinh configuration
  const [availablePolicies, setAvailablePolicies] = useState<string[]>([]);
  const [newPolicyName, setNewPolicyName] = useState("");
  const [isManagingPolicies, setIsManagingPolicies] = useState(false);
  
  // Collapse/Expand state and AI Sync state for Assistant Panel
  const [isAssistantExpanded, setIsAssistantExpanded] = useState(false);
  const [isSyncingAI, setIsSyncingAI] = useState(false);
  const [aiSyncResult, setAiSyncResult] = useState<any | null>(null);

  const handleAISync = async () => {
    setIsSyncingAI(true);
    setAiSyncResult(null);
    try {
      const res = await fetch("/api/residents/ai-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": encodeURIComponent(currentUser?.email || ""),
          "x-user-role": encodeURIComponent(activeRole || ""),
          "x-user-name": encodeURIComponent(currentUser?.fullName || "")
        }
      });
      if (res.ok) {
        const data = await res.json();
        setAiSyncResult(data);
        onRefresh();
        setCustomAlert(
          `✨ ĐỒNG BỘ HÓA DỮ LIỆU AI HOÀN TẤT!\n\n` +
          `• Hệ thống đã tự động định dạng và đồng chuẩn hóa: ${data.details.sanitizedCount} nhân khẩu.\n` +
          `• Tự động gom nhóm & đồng bộ liên kết cho: ${data.details.householdsSynced} Hộ gia đình cư trú.\n` +
          `• Tổng số nhân khẩu khả dụng trong Cơ sở dữ liệu: ${data.details.residentsCount} công dân.\n\n` +
          `Sổ sách toàn khu phố đã tự động đồng bộ hóa & hiệu chỉnh trơn tru!`
        );
      } else {
        const errData = await res.json().catch(() => ({}));
        setCustomAlert(errData.error || "Gặp lỗi khi yêu cầu hệ thống AI đồng bộ dữ liệu.");
      }
    } catch {
      setCustomAlert("Lỗi mạng: Không thể kết nối tới tác vụ AI tự động đồng bộ.");
    } finally {
      setIsSyncingAI(false);
    }
  };

  useEffect(() => {
    fetchAvailableGroups();
    fetchAvailableNDTQs();
    fetchAvailablePolicies();
  }, []);

  const fetchAvailableGroups = async () => {
    try {
      const res = await fetch("/api/available-groups");
      if (res.ok) {
        const data = await res.json();
        setAvailableGroups(data);
      }
    } catch (e) {
      console.error("Lỗi nạp danh sách đoàn thể", e);
    }
  };

  const fetchAvailableNDTQs = async () => {
    try {
      const res = await fetch("/api/available-ndtqs");
      if (res.ok) {
        const data = await res.json();
        setAvailableNDTQs(data);
      }
    } catch (e) {
      console.error("Lỗi nạp danh sách Tổ NDTQ", e);
    }
  };

  const fetchAvailablePolicies = async () => {
    try {
      const res = await fetch("/api/available-policies");
      if (res.ok) {
        const data = await res.json();
        setAvailablePolicies(data);
      }
    } catch (e) {
      console.error("Lỗi nạp danh sách đối tượng chính sách", e);
    }
  };

  const handleSaveNDTQsList = async (updatedList: string[]) => {
    try {
      const res = await fetch("/api/available-ndtqs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": encodeURIComponent(currentUser?.email || ""),
          "x-user-role": encodeURIComponent(activeRole || ""),
          "x-user-name": encodeURIComponent(currentUser?.fullName || "")
        },
        body: JSON.stringify({ ndtqs: updatedList })
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableNDTQs(data);
        onRefresh();
      } else {
        const data = await res.json();
        setCustomAlert(data.error || "Gặp lỗi khi lưu danh sách Tổ NDTQ.");
      }
    } catch {
      setCustomAlert("Lỗi kết nối khi cập nhật danh sách Tổ NDTQ.");
    }
  };

  const handleAddNDTQOption = () => {
    const name = newNDTQName.trim();
    if (!name) return;
    if (availableNDTQs.includes(name)) {
      setCustomAlert("Tổ NDTQ này đã tồn tại!");
      return;
    }
    const updated = [...availableNDTQs, name];
    setNewNDTQName("");
    handleSaveNDTQsList(updated);
  };

  const handleRemoveNDTQOption = (name: string) => {
    setCustomConfirm({
      message: `Bạn có chắc chắn muốn xóa Tổ NDTQ "${name}"?\n(Lưu ý: Các hộ gia đình và nhân khẩu đã gán Tổ này vẫn sẽ được giữ dữ liệu bình thường, việc xóa này chỉ ẩn lựa chọn trong biểu mẫu thiết lập mới)`,
      onConfirm: () => {
         const updated = availableNDTQs.filter(g => g !== name);
         handleSaveNDTQsList(updated);
      }
    });
  };

  const handleSavePoliciesList = async (updatedList: string[]) => {
    try {
      const res = await fetch("/api/available-policies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": encodeURIComponent(currentUser?.email || ""),
          "x-user-role": encodeURIComponent(activeRole || ""),
          "x-user-name": encodeURIComponent(currentUser?.fullName || "")
        },
        body: JSON.stringify({ policies: updatedList })
      });
      if (res.ok) {
        const data = await res.json();
        setAvailablePolicies(data);
        onRefresh();
      } else {
        const data = await res.json();
        setCustomAlert(data.error || "Gặp lỗi khi lưu danh sách đối tượng chính sách.");
      }
    } catch {
      setCustomAlert("Lỗi kết nối khi cập nhật danh sách đối tượng chính sách.");
    }
  };

  const handleAddPolicyOption = () => {
    const name = newPolicyName.trim();
    if (!name) return;
    if (availablePolicies.includes(name)) {
      setCustomAlert("Đối tượng chính sách này đã tồn tại!");
      return;
    }
    const updated = [...availablePolicies, name];
    setNewPolicyName("");
    handleSavePoliciesList(updated);
  };

  const handleRemovePolicyOption = (name: string) => {
    setCustomConfirm({
      message: `Bạn có chắc chắn muốn xóa đối tượng chính sách "${name}"?\n(Lưu ý: Các cư dân đã gán đối tượng này vẫn giữ thông tin đầy đủ, hành động này chỉ thu hẹp danh sách thiết lập mới)`,
      onConfirm: () => {
        const updated = availablePolicies.filter(p => p !== name);
        handleSavePoliciesList(updated);
      }
    });
  };

  const handleSaveGroupsList = async (updatedList: string[]) => {
    try {
      const res = await fetch("/api/available-groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": encodeURIComponent(currentUser?.email || ""),
          "x-user-role": encodeURIComponent(activeRole || ""),
          "x-user-name": encodeURIComponent(currentUser?.fullName || "")
        },
        body: JSON.stringify({ groups: updatedList })
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableGroups(data);
        onRefresh();
      } else {
        const data = await res.json();
        setCustomAlert(data.error || "Gặp lỗi khi lưu danh sách.");
      }
    } catch {
      setCustomAlert("Lỗi kết nối khi cập nhật danh sách tổ chức.");
    }
  };

  const handleAddGroupOption = () => {
    const name = newGroupName.trim();
    if (!name) return;
    if (availableGroups.includes(name)) {
      setCustomAlert("Đoàn thể / Tổ công tác này đã tồn tại!");
      return;
    }
    const updated = [...availableGroups, name];
    setNewGroupName("");
    handleSaveGroupsList(updated);
  };

  const handleRemoveGroupOption = (name: string) => {
    setCustomConfirm({
      message: `Bạn có chắc chắn muốn xóa đoàn thể / tổ công tác "${name}"?\n(Lưu ý: Các công dân đã chọn vai trò này vẫn sẽ giữ dữ liệu, việc xóa này chỉ ẩn checkbox trong biểu mẫu thiết lập mới)`,
      onConfirm: () => {
        const updated = availableGroups.filter(g => g !== name);
        handleSaveGroupsList(updated);
      }
    });
  };

  // Trạng thái thu gọn bộ lọc & biểu mẫu Quân sự (Chuyên môn Khu Đội Trưởng)
  const [showMilitaryFilterPanel, setShowMilitaryFilterPanel] = useState(activeRole === "Khu Đội Trưởng");
  const [isMilitaryEditExpanded, setIsMilitaryEditExpanded] = useState(activeRole === "Khu Đội Trưởng");
  const [isMilitiaEditExpanded, setIsMilitiaEditExpanded] = useState(activeRole === "Khu Đội Trưởng");

  const MILITARY_RESERVE_SUBCATEGORIES = [
    "Nam công dân tuổi 18-27 (Độ tuổi gọi nhập ngũ)",
    "Thanh niên tuổi 17 đăng ký NVQS",
    "Thanh niên xuất ngũ (Xong NVQS)",
    "Quân nhân dự bị (Hạng nhất/Hạng hai)",
    "Sĩ quan dự bị",
    "Cán bộ hưởng chế độ/chính sách quân sự",
    "Nữ có chuyên môn kỹ thuật quân sự"
  ];

  const MILITIA_SUBCATEGORIES = [
    "Dân quân tự vệ nòng cốt",
    "Dân quân tự vệ tại chỗ",
    "Dân quân tự vệ cơ động",
    "Dân quân tự vệ phòng không/pháo binh",
    "Dân quân tự vệ trinh sát/công binh/thông tin/y tế",
    "Dân quân thường trực / tuần tra cơ động"
  ];

  const MILITARY_SUBCATEGORIES = [
    ...MILITARY_RESERVE_SUBCATEGORIES,
    ...MILITIA_SUBCATEGORIES
  ];
  
  // Selected resident details or edit modals
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Resident>>({});
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [isCustomNDTQ, setIsCustomNDTQ] = useState(false);
  const [customNDTQInput, setCustomNDTQInput] = useState("");

  // Excel/CSV import state
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({
    fullName: "",
    cccd: "",
    dob: "",
    gender: "",
    address: "",
    phoneNumber: "",
    job: "",
    residenceType: "",
    householdId: "",
    relationWithHeader: "",
    groupNDTQ: ""
  });
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
  const [importedStatus, setImportedStatus] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Smart Import State
  const [importMode, setImportMode] = useState<"standard" | "ai">("standard");
  const [aiRawText, setAiRawText] = useState("");
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiFileName, setAiFileName] = useState("");
  const [aiIsLoading, setAiIsLoading] = useState(false);
  const [aiLoadingMessage, setAiLoadingMessage] = useState("");
  const [aiParsedResidents, setAiParsedResidents] = useState<any[]>([]);
  const [aiSyncStep, setAiSyncStep] = useState<1 | 2>(1); // 1: Input & Parse, 2: Preview & Sync
  const [syncActions, setSyncActions] = useState<Record<string, "insert" | "update" | "skip">>({});
  const aiFileInputRef = useRef<HTMLInputElement>(null);

  const checkDuplicateStatus = (parsed: any) => {
    if (parsed.cccd) {
      const match = residents.find(r => r.cccd === parsed.cccd);
      if (match) return { type: "cccd" as const, match, action: "update" as const };
    }
    if (parsed.fullName && parsed.dob) {
      const match = residents.find(r => 
        r.fullName.toLowerCase() === parsed.fullName.toLowerCase() && 
        r.dob === parsed.dob
      );
      if (match) return { type: "name_dob" as const, match, action: "update" as const };
    }
    return { type: "none" as const, match: null, action: "insert" as const };
  };

  const handleAIUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAiFile(file);
    setAiFileName(file.name);
  };

  const handleRunAIAnalysis = async () => {
    if (!aiFile && !aiRawText.trim()) {
      setCustomAlert("Vui lòng tải lên 1 tệp Excel/Word hoặc nhập/dán nội dung văn bản dân cư để phân tích.");
      return;
    }

    setAiIsLoading(true);
    setAiLoadingMessage("Bắt đầu đọc tài liệu...");

    try {
      let fileContent = "";
      if (aiFile) {
        setAiLoadingMessage(`Đang chuyển hóa tệp ${aiFile.name} thành dữ liệu mã hóa...`);
        const reader = new FileReader();

        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = (evt) => {
            const result = evt.target?.result as string;
            resolve(result);
          };
          reader.readAsDataURL(aiFile);
        });

        fileContent = await base64Promise;
      }

      setAiLoadingMessage("Đang gửi văn bản chuyển giao bộ xử lý AI Gemini 3.5...");

      // Update loading message periodically for dynamic experience
      const intervals = [
        "Đang phân tích cấu trúc cột, tìm kiếm khớp dữ liệu...",
        "AI đang đồng hóa ngày sinh và chuẩn hóa CCCD...",
        "Đang quét các mối quan hệ gia đình và cơ cấu hộ khẩu...",
        "Gần xong rồi! Đang định hình danh sách nhân khẩu..."
      ];
      let i = 0;
      const intervalId = setInterval(() => {
        if (i < intervals.length) {
          setAiLoadingMessage(intervals[i]);
          i++;
        }
      }, 3000);

      const response = await fetch("/api/gemini/parse-file", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": encodeURIComponent(currentUser?.email || "")
        },
        body: JSON.stringify({
          fileContent,
          fileName: aiFileName,
          rawText: aiRawText
        })
      });

      clearInterval(intervalId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Lỗi nội bộ từ máy chủ AI.");
      }

      const data = await response.json();

      if (data.residents && Array.isArray(data.residents)) {
        // Hydrate temporary ids and initial actions
        const hydrated = data.residents.map((r: any, idx: number) => {
          const tempId = `temp_ai_${idx}_${Date.now()}`;
          return {
            ...r,
            tempId,
            fullName: r.fullName || "CHƯA XÁC ĐỊNH",
            cccd: r.cccd || "",
            dob: r.dob || "",
            gender: r.gender || "",
            address: r.address || "",
            phoneNumber: r.phoneNumber || "",
            job: r.job || "",
            residenceType: r.residenceType || "",
            householdId: r.householdId || "",
            relationWithHeader: r.relationWithHeader || "",
            notes: r.notes || ""
          };
        });

        const initialActions: Record<string, "insert" | "update" | "skip"> = {};
        hydrated.forEach((item: any) => {
          const dup = checkDuplicateStatus(item);
          initialActions[item.tempId] = dup.action;
        });

        setAiParsedResidents(hydrated);
        setSyncActions(initialActions);
        setAiSyncStep(2); // Go to preview
      } else {
        throw new Error("Không thể trích xuất được đối tượng danh sách nhân khẩu hợp lệ.");
      }

    } catch (err: any) {
      console.error("Lỗi triệu gọi AI phân tích:", err);
      setCustomAlert("Lỗi AI phân tích: " + err.message);
    } finally {
      setAiIsLoading(false);
    }
  };

  const handleUpdateParsedField = (tempId: string, field: string, value: string) => {
    setAiParsedResidents(prev =>
      prev.map(item => (item.tempId === tempId ? { ...item, [field]: value } : item))
    );
  };

  const handleExecuteAISync = async () => {
    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    setAiIsLoading(true);
    setAiLoadingMessage("Đang thực hiện gộp & đồng bộ dữ liệu cư dân...");

    for (const item of aiParsedResidents) {
      const action = syncActions[item.tempId] || "insert";
      if (action === "skip") {
        skippedCount++;
        continue;
      }

      const dup = checkDuplicateStatus(item);

      // Construct Resident object to save
      const payload: Resident = {
        id: (action === "update" && dup.match) ? dup.match.id : `res_ai_${Math.floor(Date.now() + Math.random() * 100000)}`,
        fullName: item.fullName,
        cccd: item.cccd || "",
        dob: item.dob || "",
        gender: (item.gender === "Nữ" || item.gender === "Nam" || item.gender === "Khác") ? item.gender : "" as any,
        address: item.address || "",
        phoneNumber: item.phoneNumber || "",
        job: item.job || "",
        education: "",
        religion: "",
        ethnicity: "",
        notes: item.notes || "Dữ liệu gộp từ nguồn bên ngoài qua Gemini AI.",
        residenceType: (item.residenceType === "Thường trú" || item.residenceType === "Tạm trú" || item.residenceType === "Tạm vắng") ? item.residenceType : "" as any,
        householdId: item.householdId || "",
        relationWithHeader: item.relationWithHeader || "",
        groups: [],
        specialCategories: []
      };

      try {
        if (action === "update" && dup.match) {
          // Update via PUT /api/residents/:id
          const response = await fetch(`/api/residents/${dup.match.id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "x-user-name": encodeURIComponent("AI Smart Import"),
              "x-user-role": encodeURIComponent(activeRole || ""),
              "x-user-email": encodeURIComponent(currentUser?.email || "")
            },
            body: JSON.stringify(payload)
          });
          if (response.ok) {
            updatedCount++;
          } else {
            const err = await response.json();
            errors.push(`Lỗi cập nhật ${payload.fullName}: ${err.error}`);
          }
        } else {
          // Force unique CCCD on insert
          if (payload.cccd && residents.some(r => r.cccd === payload.cccd)) {
            payload.cccd = `${payload.cccd}_forced_${Date.now().toString().substring(10)}`;
          }

          const response = await fetch("/api/residents", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-user-name": encodeURIComponent("AI Smart Import"),
              "x-user-role": encodeURIComponent(activeRole || ""),
              "x-user-email": encodeURIComponent(currentUser?.email || "")
            },
            body: JSON.stringify(payload)
          });
          if (response.ok) {
            insertedCount++;
          } else {
            const err = await response.json();
            errors.push(`Lỗi thêm mới ${payload.fullName}: ${err.error}`);
          }
        }
      } catch (err: any) {
        errors.push(`Lỗi kết nối khi đồng bộ ${payload.fullName}: ${err.message}`);
      }
    }

    setAiIsLoading(false);
    onRefresh();

    let alertMsg = `Đồng bộ hoàn tất!\n- Nhập mới thành công: ${insertedCount} nhân khẩu.\n- Cập nhật ghi đè: ${updatedCount} nhân khẩu.\n- Bỏ qua: ${skippedCount} nhân khẩu.`;
    if (errors.length > 0) {
      alertMsg += `\n\nMột số lỗi xảy ra (${errors.length}):\n${errors.slice(0, 5).join("\n")}${errors.length > 5 ? "\n..." : ""}`;
    }
    setCustomAlert(alertMsg);

    // Reset AI state
    setAiParsedResidents([]);
    setAiRawText("");
    setAiFile(null);
    setAiFileName("");
    setAiSyncStep(1);
    setImportMode("standard");
    setActiveTab("residents");
  };

  const handleRemoveParsedRow = (tempId: string) => {
    setAiParsedResidents(prev => prev.filter(item => item.tempId !== tempId));
  };

  const checkResidentWritePermission = (res: Resident): { allowed: boolean; reason?: string } => {
    if (currentUser?.canEdit === false || activeRole === "Người xem báo cáo") {
      return { allowed: false, reason: "Phần quyền: Tài khoản của bạn chỉ được phép xem, không có quyền ghi hay sửa dữ liệu!" };
    }

    // 1. Quản trị viên / ★ Super Admin / Bí thư Chi bộ / Trưởng Ban điều hành / Trưởng ban công tác Mặt trận
    if (["Super Admin", "Bí thư Chi bộ", "Trưởng Ban điều hành", "Trưởng ban công tác Mặt trận"].includes(activeRole)) {
      return { allowed: true };
    }

    // 2. Công an khu vực: được quyền cập nhật lý lịch cư trú của nhân dân (nhưng không phải Toàn quyền hệ thống)
    if (activeRole === "Công an khu vực") {
      return { allowed: true };
    }

    // 3. Khu Đội Trưởng: Chỉ được phép cập nhật/thêm/sau đổi thông tin các nhân thân thuộc diện Quốc phòng / Quân nhân
    if (activeRole === "Khu Đội Trưởng") {
      const hasMilitary = (res.militaryCategories && res.militaryCategories.length > 0) || (res.militaryNotes || "").trim() !== "";
      if (!hasMilitary) {
        return {
          allowed: false,
          reason: "Chỉ huy quân sự: Vai trò Khu Đội Trưởng chỉ được phép thao tác/sửa đổi cư dân thuộc diện quản lý Nghĩa vụ Quân sự / Quân nhân dự bị. Cư dân khác chỉ được xem!"
        };
      }
      return { allowed: true };
    }

    // 4. Cán bộ nhập liệu: chỉ chỉnh sửa được nội dung mình đã nhập, không chỉnh sửa được nội dung của người khác nhập.
    if (activeRole === "Cán bộ nhập liệu") {
      const email = currentUser?.email || "";
      const creator = (res.createdBy || "").toLowerCase().trim();
      if (!creator) {
        return {
          allowed: false,
          reason: "Quyền tự chủ hồ sơ: Đây là cư dân thuộc danh sách cốt lõi của hẻm/Khu phố. Bạn không thể tự ý chỉnh sửa nội dung này!"
        };
      }
      if (creator !== email.toLowerCase().trim()) {
        return {
          allowed: false,
          reason: `Quyền tự chủ hồ sơ: Bạn chỉ có quyền tự chỉnh sửa/xóa cư dân do chính tay tài khoản mình nhập liệu. Bản ghi này do cán bộ [${creator}] khởi tạo!`
        };
      }
      return { allowed: true };
    }

    // 5. Chi hội trưởng: chỉ quản lý chi hội của mình, được phép chỉnh sửa nội dung, xuất file của chi hội, còn các nội dung khác thì chỉ xem
    if (activeRole === "Chi hội trưởng") {
      const userGroup = currentUser?.associationGroup || "CCB";
      const isMember = (res.groups || []).includes(userGroup);
      if (!isMember) {
        return {
          allowed: false,
          reason: `Ngăn nắp đoàn thể: Vai trò Chi hội trưởng [${userGroup}] chỉ được phép thao tác/sửa đổi thành viên thuộc chi hội mình phụ trách. Cư dân khác chỉ được xem!`
        };
      }
      return { allowed: true };
    }

    return { allowed: false, reason: "Hệ thống: Bạn không có quyền cấp phép tương tác với bản ghi này!" };
  };

  const canEdit = ["Super Admin", "Bí thư Chi bộ", "Trưởng Ban điều hành", "Trưởng ban công tác Mặt trận", "Công an khu vực", "Khu Đội Trưởng", "Cán bộ nhập liệu", "Chi hội trưởng"].includes(activeRole);

  const [customAlert, setCustomAlert] = useState<string | null>(null);
  const [customConfirm, setCustomConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // States for household group update & AI sync
  const [selectedSyncHousehold, setSelectedSyncHousehold] = useState<Household | null>(null);
  const [newSyncGroupSelect, setNewSyncGroupSelect] = useState<string>("");
  const [customSyncGroupInput, setCustomSyncGroupInput] = useState<string>("");
  const [isCustomSyncGroup, setIsCustomSyncGroup] = useState<boolean>(false);
  const [isSyncingGroupAI, setIsSyncingGroupAI] = useState<boolean>(false);
  const [syncResultAI, setSyncResultAI] = useState<{ summary: string; syncedMembers: any[]; aiNotes: string } | null>(null);

  const handleOpenUpdateGroupModal = (hh: Household) => {
    setSelectedSyncHousehold(hh);
    setNewSyncGroupSelect(hh.groupNDTQ || (availableNDTQs[0] || ""));
    setIsCustomSyncGroup(hh.groupNDTQ ? !availableNDTQs.includes(hh.groupNDTQ) : false);
    setCustomSyncGroupInput(hh.groupNDTQ || "");
    setSyncResultAI(null);
    setIsSyncingGroupAI(false);
  };

  const handleExecuteGroupAISync = async () => {
    if (!selectedSyncHousehold) return;
    const finalGroup = isCustomSyncGroup ? customSyncGroupInput.trim() : newSyncGroupSelect;
    if (!finalGroup) {
      setCustomAlert("Vui lòng cung cấp/chọn Tổ để đồng bộ!");
      return;
    }

    setIsSyncingGroupAI(true);
    setSyncResultAI(null);

    try {
      const res = await fetch(`/api/households/${selectedSyncHousehold.id}/update-group-ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": encodeURIComponent(currentUser?.email || ""),
          "x-user-role": encodeURIComponent(activeRole || ""),
          "x-user-name": encodeURIComponent(currentUser?.fullName || "")
        },
        body: JSON.stringify({ groupNDTQ: finalGroup })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.aiResult) {
          setSyncResultAI(data.aiResult);
          onRefresh(); // Refresh parents lists properly
        } else {
          setCustomAlert("Lỗi đồng bộ: Phản hồi từ máy chủ không hợp lệ.");
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setCustomAlert(errData.error || "Gặp lỗi trong quá trình kết nối máy chủ để đồng bộ Tổ.");
      }
    } catch (err: any) {
      setCustomAlert("Gặp lỗi đường truyền: " + err.message);
    } finally {
      setIsSyncingGroupAI(false);
    }
  };

  const handleDeleteHousehold = (hh: Household) => {
    const members = residents.filter(r => r.householdId === hh.id);
    const memberCount = members.length;
    
    setCustomConfirm({
      message: `Bạn có chắc chắn muốn xóa hoàn toàn hộ gia đình của chủ hộ "${hh.headerName}" (Mã hộ: ${hh.id}) ra khỏi dữ liệu không?\n\nLưu ý trọng yếu:\n1. Sổ hộ khẩu này sẽ bị xoá vĩnh viễn.\n2. Tất cả ${memberCount} nhân khẩu thuộc hộ khẩu này cũng sẽ bị xóa tự động khỏi địa bàn (do không còn sinh sống tại đây).\n\nThao tác này hoàn toàn không thể khôi phục!`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/households/${hh.id}`, {
            method: "DELETE",
            headers: {
              "x-user-email": encodeURIComponent(currentUser?.email || ""),
              "x-user-role": encodeURIComponent(activeRole || ""),
              "x-user-name": encodeURIComponent(currentUser?.fullName || "")
            }
          });
          if (res.ok) {
            setCustomAlert(`Đã xóa thành công hộ gia đình mã ${hh.id} cùng toàn bộ ${memberCount} nhân khẩu liên quan ra khỏi địa bàn.`);
            onRefresh();
          } else {
            const errData = await res.json().catch(() => ({}));
            setCustomAlert(errData.error || "Gặp lỗi khi xóa hộ gia đình.");
          }
        } catch (err: any) {
          setCustomAlert("Lỗi mạng: " + err.message);
        }
      }
    });
  };

  // Filter logic
  const filteredResidents = residents.filter(res => {
    const matchesSearch = (() => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      
      // Standard text match
      if ((res.fullName || "").toLowerCase().includes(q)) return true;
      if ((res.address || "").toLowerCase().includes(q)) return true;
      if ((res.phoneNumber || "").includes(q)) return true;
      if ((res.cccd || "").includes(q)) return true;
      
      // Cross-match categories and custom groups (e.g. search "CCB", "Đảng viên", "Ban điều hành", "Cộng tác viên dân số")
      if (res.groups && res.groups.some(g => g.toLowerCase().includes(q))) return true;
      if (res.specialCategories && res.specialCategories.some(sc => sc.toLowerCase().includes(q))) return true;
      if (res.militaryCategories && res.militaryCategories.some(mc => mc.toLowerCase().includes(q))) return true;
      if (res.residenceType && res.residenceType.toLowerCase().includes(q)) return true;

      // Smarter extraction of 'tuổi X' or 'uX' or plain age matching
      const ageMatch = q.match(/(?:tuổi|u)\s*(\d{1,3})/i) || q.match(/^(\d{1,2})$/);
      if (ageMatch) {
        const targetAge = parseInt(ageMatch[1]);
        if (res.dob) {
          const birthYear = parseInt(res.dob.split("-")[0]);
          if (!isNaN(birthYear)) {
            const age = new Date().getFullYear() - birthYear;
            if (age === targetAge) return true;
          }
        }
      }

      // Smarter extraction of 'năm XXXX' or 'sinh XXXX' or plain birth year match
      const yearMatch = q.match(/(?:năm|sinh)\s*(\d{4})/i) || q.match(/^(\d{4})$/);
      if (yearMatch) {
        const targetYear = parseInt(yearMatch[1]);
        if (res.dob && res.dob.startsWith(targetYear.toString())) {
          return true;
        }
      }

      return false;
    })();

    const matchesResidence = filterResidenceType === "All" || res.residenceType === filterResidenceType;
    const matchesGroup = filterGroup === "All" || 
      (res.groups && res.groups.includes(filterGroup)) || 
      (res.specialCategories && res.specialCategories.includes(filterGroup)) ||
      (res.militaryCategories && res.militaryCategories.includes(filterGroup)) ||
      (filterGroup === "MilitaryAll" && res.militaryCategories && res.militaryCategories.length > 0);

    const matchesNDTQ = filterNDTQ === "All" ||
      (filterNDTQ === "None" && (!res.groupNDTQ || res.groupNDTQ === "")) ||
      res.groupNDTQ === filterNDTQ;

    return matchesSearch && matchesResidence && matchesGroup && matchesNDTQ;
  });

  // Filter Households logic based on search queries
  const filteredHouseholds = households.filter(hh => {
    const matchesNDTQ = filterNDTQ === "All" ||
      (filterNDTQ === "None" && (!hh.groupNDTQ || hh.groupNDTQ === "")) ||
      hh.groupNDTQ === filterNDTQ;

    if (!matchesNDTQ) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (hh.headerName || "").toLowerCase().includes(q) ||
      (hh.address || "").toLowerCase().includes(q) ||
      (hh.phoneNumber || "").includes(q) ||
      (hh.id || "").toLowerCase().includes(q) ||
      (hh.groupNDTQ || "").toLowerCase().includes(q)
    );
  });

  // Excel Export Feature for reporting to higher-ups based on synchronized neighborhood database
  const exportResidentsExcel = (onlyFiltered: boolean = false) => {
    try {
      let sourceList = onlyFiltered ? filteredResidents : residents;

      // Enforce file extraction restrictions: Chi hội trưởng and Khu Đội Trưởng can only extract their respective groups
      if (activeRole === "Chi hội trưởng") {
        const userGroup = currentUser?.associationGroup || "CCB";
        sourceList = sourceList.filter(res => (res.groups || []).includes(userGroup));
      } else if (activeRole === "Khu Đội Trưởng") {
        sourceList = sourceList.filter(res => (res.militaryCategories || []).length > 0 || (res.militaryNotes || "").trim() !== "");
      }

      if (sourceList.length === 0) {
        setCustomAlert("Không tìm thấy cư dân nào thuộc phạm vi quản lý của bạn để tiến hành xuất Excel!");
        return;
      }

      const rawData = sourceList.map((res, idx) => {
        const readableDob = formatDate(res.dob);

        return {
          "STT": idx + 1,
          "Họ và Tên": res.fullName,
          "Số CCCD / Định danh": res.cccd || "Chưa cấp/Trẻ em",
          "Ngày sinh": readableDob,
          "Giới tính": res.gender,
          "Mã Hộ khẩu (Số hộ)": res.householdId,
          "Quan hệ với chủ hộ": res.relationWithHeader || "Thành viên",
          "Tổ NDTQ": res.groupNDTQ || "Không có",
          "Diện cư trú": res.residenceType || "Thường trú",
          "Số Điện thoại": res.phoneNumber || "Không có",
          "Nghề nghiệp": res.job || "Tự do",
          "Trình độ học vấn": res.education || "Không ghi nhận",
          "Tôn giáo": res.religion || "Không",
          "Dân tộc": res.ethnicity || "Kinh",
          "Địa chỉ cư trú": res.address || "",
          "Đoàn thể tham gia": res.groups ? res.groups.join(", ") : "",
          "Diện An sinh đặc biệt": res.specialCategories ? res.specialCategories.join(", ") : "",
          "Danh mục quân sự": res.militaryCategories ? res.militaryCategories.join(", ") : "",
          "Ghi chú bổ sung": res.notes || ""
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rawData);
      
      // Auto-adjust column widths based on length of strings
      const colWidths = Object.keys(rawData[0]).map(key => {
        const maxLength = Math.max(
          key.length,
          ...rawData.map(row => String((row as any)[key] || "").length)
        );
        return { wch: Math.min(maxLength + 3, 50) };
      });
      worksheet["!cols"] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, onlyFiltered ? "Lọc_Nhan_Khau" : "Danh_Sach_Nhan_Khau");
      
      const fileSuffix = onlyFiltered ? "Loc_Bo_Loc" : "Dong_Bo_Khu_Pho";
      const dateStr = formatDate(new Date()).replace(/\//g, "-");
      XLSX.writeFile(workbook, `Danh_Sach_Nhan_Khau_KP3_${fileSuffix}_${dateStr}.xlsx`);
    } catch (err: any) {
      setCustomAlert("Lỗi trong quá trình tạo tài liệu Excel: " + err.message);
    }
  };

  const exportHouseholdsExcel = () => {
    try {
      // Only administrative roles + public security are authorized to export the full household registry
      const allowedHouseholdExportRoles = ["Super Admin", "Bí thư Chi bộ", "Trưởng Ban điều hành", "Trưởng ban công tác Mặt trận", "Công an khu vực"];
      if (!allowedHouseholdExportRoles.includes(activeRole)) {
        setCustomAlert("Phân quyền: Vai trò của bạn không được cấp quyền tải xuống toàn bộ Sổ Hộ Gia Đình!");
        return;
      }

      if (households.length === 0) {
        setCustomAlert("Không có dữ liệu hộ gia đình nào khả dụng!");
        return;
      }

      const rawData = households.map((hh, idx) => {
        const members = residents.filter(r => r.householdId === hh.id);
        const memberCount = members.length;
        const memberNames = members.map(m => `${m.fullName} (${m.relationWithHeader})`).join(", ");
        return {
          "STT": idx + 1,
          "Mã Hộ khẩu (Số hộ)": hh.id,
          "Họ và Tên Chủ hộ": hh.headerName,
          "Tổ NDTQ": hh.groupNDTQ || "Không có",
          "Địa chỉ hộ gia đình": hh.address,
          "Số Điện thoại liên hệ": hh.phoneNumber || "Không có",
          "Tổng số nhân khẩu": memberCount,
          "Thành viên đăng ký chính thức": memberNames,
          "Ghi chú gia cảnh": hh.notes || ""
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rawData);
      
      // Auto-adjust column widths
      const colWidths = Object.keys(rawData[0]).map(key => {
        const maxLength = Math.max(
          key.length,
          ...rawData.map(row => String((row as any)[key] || "").length)
        );
        return { wch: Math.min(maxLength + 3, 65) };
      });
      worksheet["!cols"] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sổ_Ho_Gia_Dinh_KP3");
      
      const dateStr = formatDate(new Date()).replace(/\//g, "-");
      XLSX.writeFile(workbook, `Danh_Sach_Ho_Gia_Dinh_KP3_Dong_Bo_${dateStr}.xlsx`);
    } catch (err: any) {
      setCustomAlert("Lỗi trong quá trình tạo tài liệu Excel: " + err.message);
    }
  };

  // Handle Create or Edit submission
  const handleOpenEdit = (res?: Resident) => {
    if (!canEdit) {
      setCustomAlert("Hành động bị cấm: Tài khoản hiện tại của bạn không có quyền cập nhật dữ liệu!");
      return;
    }
    if (res) {
      setSelectedResident(res);
      setEditForm({
        ...res,
        militaryCategories: res.militaryCategories || [],
        militaryNotes: res.militaryNotes || ""
      });
      const isCustomVal = res.groupNDTQ ? !availableNDTQs.includes(res.groupNDTQ) : false;
      setIsCustomNDTQ(isCustomVal);
      setCustomNDTQInput(res.groupNDTQ || "");
    } else {
      setSelectedResident(null);
      setEditForm({
        id: `res_${Date.now()}`,
        fullName: "",
        cccd: "",
        dob: "1990-01-01",
        gender: "Nam",
        address: "Khu phố 3, An Phú, TP. Hồ Chí Minh",
        phoneNumber: "",
        job: "Kinh doanh tự do",
        education: "12/12",
        religion: "Không",
        ethnicity: "Kinh",
        notes: "",
        residenceType: "Thường trú",
        householdId: "HH001",
        relationWithHeader: "Chủ hộ",
        groups: activeRole === "Chi hội trưởng" ? [currentUser?.associationGroup || "CCB"] : [],
        specialCategories: [],
        militaryCategories: [],
        militaryNotes: ""
      });
      setIsCustomNDTQ(false);
      setCustomNDTQInput("");
    }
    setFormError("");
    setFormSuccess("");
    setIsEditModalOpen(true);
  };

  const handleGroupCheckbox = (groupName: string, isChecked: boolean) => {
    const list = editForm.groups ? [...editForm.groups] : [];
    if (isChecked) {
      list.push(groupName);
    } else {
      const idx = list.indexOf(groupName);
      if (idx !== -1) list.splice(idx, 1);
    }
    setEditForm({ ...editForm, groups: list });
  };

  const handleSpecialCheckbox = (specName: string, isChecked: boolean) => {
    const list = editForm.specialCategories ? [...editForm.specialCategories] : [];
    if (isChecked) {
      list.push(specName);
    } else {
      const idx = list.indexOf(specName);
      if (idx !== -1) list.splice(idx, 1);
    }
    setEditForm({ ...editForm, specialCategories: list });
  };

  const handleMilitaryCheckbox = (milName: string, isChecked: boolean) => {
    const list = editForm.militaryCategories ? [...editForm.militaryCategories] : [];
    if (isChecked) {
      list.push(milName);
    } else {
      const idx = list.indexOf(milName);
      if (idx !== -1) list.splice(idx, 1);
    }
    setEditForm({ ...editForm, militaryCategories: list });
  };

  const handleSaveResident = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!editForm.fullName || !editForm.dob || !editForm.residenceType) {
      setFormError("Vui lòng điền đầy đủ Họ tên, Ngày sinh và Diện cư trú bắt buộc!");
      return;
    }

    // Citizen ID duplicate check locally if it's a new entry
    if (!selectedResident && editForm.cccd) {
      const exists = residents.some(r => r.cccd === editForm.cccd);
      if (exists) {
        setFormError(`Cảnh báo trùng lặp: Công dân mang số CCCD ${editForm.cccd} đã đăng ký trong cơ sở dữ liệu khu phố!`);
        return;
      }
    }

    const url = selectedResident ? `/api/residents/${selectedResident.id}` : "/api/residents";
    const method = selectedResident ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-user-name": encodeURIComponent(currentUser?.fullName || "Cán bộ hành chính"),
          "x-user-role": encodeURIComponent(activeRole || ""),
          "x-user-email": encodeURIComponent(currentUser?.email || "")
        },
        body: JSON.stringify(editForm)
      });
      
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Có lỗi bất ngờ khi cập nhật cơ sở dữ liệu.");
      } else {
        setFormSuccess("Lưu thông tin công dân thành công!");
        
        // Auto-save new NDTQ if it was custom-typed and doesn't exist
        const savedGroup = editForm.groupNDTQ?.trim();
        if (savedGroup && !availableNDTQs.includes(savedGroup)) {
          const updated = [...availableNDTQs, savedGroup];
          handleSaveNDTQsList(updated);
        }

        setTimeout(() => {
          setIsEditModalOpen(false);
          onRefresh();
        }, 1100);
      }
    } catch {
      setFormError("Không thể kết nối đến máy chủ.");
    }
  };

  const handleDeleteResident = async (id: string, name: string) => {
    if (!canEdit) {
      setCustomAlert("Tài khoản hiện tại của bạn không có quyền xóa dữ liệu nhân khẩu!");
      return;
    }
    setCustomConfirm({
      message: `Bạn có chắc chắn muốn xóa vĩnh viễn công dân "${name}" khỏi cơ sở dữ liệu?`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/residents/${id}`, {
            method: "DELETE",
            headers: {
              "x-user-name": encodeURIComponent(currentUser?.fullName || "Cán bộ hành chính"),
              "x-user-role": encodeURIComponent(activeRole || ""),
              "x-user-email": encodeURIComponent(currentUser?.email || "")
            }
          });
          if (res.ok) {
            onRefresh();
          } else {
            setCustomAlert("Có lỗi khi xóa.");
          }
        } catch {
          setCustomAlert("Không kết nối được server.");
        }
      }
    });
  };

  // CSV Reader
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length < 2) {
        setCustomAlert("Tệp của bạn không có dữ liệu phù hợp hoặc dòng tiêu đề mẫu rỗng.");
        return;
      }

      // Simple CSV Parse (handles comma or semicolon separator)
      const separator = lines[0].includes(";") ? ";" : ",";
      
      // Parse first row as candidates headers
      const headers = lines[0].split(separator).map(h => h.replace(/^["']|["']$/g, "").trim());
      
      // Parse remaining rows
      const parsedRows: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const columns = lines[i].split(separator).map(c => c.replace(/^["']|["']$/g, "").trim());
        if (columns.length === headers.length) {
          const rowObj: Record<string, string> = {};
          headers.forEach((hdr, idx) => {
            rowObj[hdr] = columns[idx];
          });
          parsedRows.push(rowObj);
        }
      }

      setImportHeaders(headers);
      setImportRows(parsedRows);
      
      // Attempt smart auto-mapping
      const defaultMap: Record<string, string> = {};
      const fields = ["fullName", "cccd", "dob", "gender", "address", "phoneNumber", "job", "residenceType", "householdId", "relationWithHeader", "groupNDTQ"];
      
      fields.forEach(f => {
        // Try finding match with Vietnamese terms
        const normalizedField = f.toLowerCase();
        const found = headers.find(h => {
          const lh = h.toLowerCase();
          return lh.includes(normalizedField) ||
                 (normalizedField === "fullname" && (lh.includes("tên") || lh.includes("ho ten"))) ||
                 (normalizedField === "cccd" && (lh.includes("cccd") || lh.includes("chứng minh") || lh.includes("cmnd"))) ||
                 (normalizedField === "dob" && (lh.includes("sinh") || lh.includes("ngay sinh"))) ||
                 (normalizedField === "gender" && (lh.includes("giới") || lh.includes("gioi tinh"))) ||
                 (normalizedField === "address" && (lh.includes("chỉ") || lh.includes("dia chi"))) ||
                 (normalizedField === "phonenumber" && (lh.includes("thoại") || lh.includes("sđt") || lh.includes("sdt"))) ||
                 (normalizedField === "job" && (lh.includes("nghề") || lh.includes("nghe nghiep"))) ||
                 (normalizedField === "residencetype" && (lh.includes("trú") || lh.includes("loai cu tru"))) ||
                 (normalizedField === "householdid" && (lh.includes("hộ") || lh.includes("ma ho"))) ||
                 (normalizedField === "relationwithheader" && (lh.includes("quan hệ") || lh.includes("chu ho"))) ||
                 (normalizedField === "groupndtq" && (lh.includes("tổ ndtq") || lh.includes("to ndtq") || lh.includes("tổ tự quản") || lh.includes("ndtq") || lh === "tổ" || lh === "to"));
        });
        defaultMap[f] = found || "";
      });

      setColumnMapping(defaultMap);
      setImportStep(2);
    };
    reader.readAsText(file, "UTF-8");
  };

  const executeBulkImport = async () => {
    // Collect mapping, clean rows & validate
    const formattedResidents: Resident[] = importRows.map((origRow, rIdx) => {
      const mapped: Partial<Resident> = {};
      
      Object.entries(columnMapping).forEach(([dbField, excelColumn]) => {
        if (excelColumn) {
          (mapped as any)[dbField] = origRow[excelColumn as string];
        }
      });

      // Default Cleanings
      return {
        id: `res_csv_${rIdx}_${Date.now()}`,
        fullName: mapped.fullName || `Đức Cường ${rIdx}`,
        cccd: mapped.cccd || `0790${Math.floor(10000000 + Math.random() * 90000000)}`,
        dob: mapped.dob || "1994-05-12",
        gender: (mapped.gender === "Nữ" || mapped.gender?.toLowerCase().includes("nữ")) ? "Nữ" : "Nam",
        address: mapped.address || "Khu phố 3, Phường An Phú, TP. Hồ Chí Minh",
        phoneNumber: mapped.phoneNumber || "0981112223",
        job: mapped.job || "Kinh doanh tự do",
        education: "12/12",
        religion: "Không",
        ethnicity: "Kinh",
        notes: "Dữ liệu nhập mới tự động từ tệp Excel đồng bộ.",
        residenceType: (mapped.residenceType as any) || "Thường trú",
        householdId: mapped.householdId || "HH001",
        relationWithHeader: mapped.relationWithHeader || "Thành viên",
        groups: [],
        specialCategories: [],
        groupNDTQ: mapped.groupNDTQ || undefined
      };
    });

    try {
      const res = await fetch("/api/residents/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-name": encodeURIComponent(currentUser?.fullName || "Cán bộ nạp tệp"),
          "x-user-role": encodeURIComponent(activeRole || ""),
          "x-user-email": encodeURIComponent(currentUser?.email || "")
        },
        body: JSON.stringify({ residents: formattedResidents })
      });
      const data = await res.json();
      if (res.ok) {
        setImportedStatus(`Thành công! Đã bổ sung mới ${data.importedCount} nhân khẩu, và tự động cập nhật, ghi đè thông tin cho ${data.updatedCount || 0} nhân khẩu trùng khớp khác.`);
        
        // Extract unique imported NDTQs and append any missing ones to the available list
        const importedNDTQs = Array.from(new Set(
          formattedResidents
            .map(r => r.groupNDTQ?.trim())
            .filter((g): g is string => !!g)
        ));
        const missingNDTQs = importedNDTQs.filter(g => !availableNDTQs.includes(g));
        if (missingNDTQs.length > 0) {
          const updated = [...availableNDTQs, ...missingNDTQs];
          handleSaveNDTQsList(updated);
        }

        setImportStep(3);
        onRefresh();
      } else {
        setCustomAlert("Lỗi máy chủ " + data.error);
      }
    } catch {
      setCustomAlert("Không lưu được dữ liệu đồng loạt.");
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-6">
      {/* 1. Header with internal navigation & Excel export dropdown */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 pb-4 no-print">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-emerald-600 text-white p-1 rounded-lg">
              <Users className="h-4 w-4" />
            </span>
            <h2 className="text-base md:text-lg font-extrabold text-slate-850 tracking-tight">Cơ Sở Dữ Liệu Nhân Khẩu & Hộ Khẩu</h2>
          </div>
          <p className="text-[11.5px] text-slate-400 mt-1">
            Hồ sơ nhân thân toàn vẹn, cập nhật lưu trú tự động và đồng bộ hóa chi hội, tổ tự quản liên thông.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end">
          {/* Main sub-tabs with counts - Segmented style */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg shrink-0">
            <button
              onClick={() => setActiveTab("residents")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer transition ${
                activeTab === "residents" 
                  ? "bg-white text-emerald-900 shadow-3xs" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Nhân Khẩu ({residents.length})
            </button>
            <button
              onClick={() => setActiveTab("households")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer transition ${
                activeTab === "households" 
                  ? "bg-white text-emerald-900 shadow-xs" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Hộ Gia Đình ({households.length})
            </button>
            <button
              onClick={() => setActiveTab("import")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer transition ${
                activeTab === "import" 
                  ? "bg-white text-emerald-950 shadow-xs" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <FileUp className="h-3.5 w-3.5 inline mr-0.5" /> Gộp Tệp
            </button>
          </div>

          {/* Integrated Excel reporting dropdown */}
          <div className="relative group shrink-0">
            <button
              type="button"
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-850 hover:text-emerald-900 border border-emerald-250 py-1 px-2.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-3xs animate-pulse"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Xuất Excel 📊</span>
            </button>
            <div className="absolute right-0 top-full mt-1 w-60 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-30 hidden group-hover:block hover:block text-[11px] font-medium text-slate-700 animate-fade-in transition-all">
              <span className="block px-3 py-1 text-[9px] uppercase font-black tracking-wider text-slate-400 bg-slate-50/50">Tùy chọn tải báo cáo</span>
              <button
                onClick={() => exportResidentsExcel(false)}
                className="w-full text-left px-3 py-1.5 hover:bg-emerald-50 hover:text-emerald-950 transition flex items-center gap-1.5 cursor-pointer font-semibold"
                title="Xuất toàn bộ danh sách nhân khẩu đã được hệ thống đồng bộ hóa"
              >
                <Download className="h-3.5 w-3.5 text-emerald-600" />
                <span>Xuất tất cả Nhân khẩu ({residents.length})</span>
              </button>
              <button
                onClick={() => exportResidentsExcel(true)}
                className="w-full text-left px-3 py-1.5 hover:bg-emerald-50 hover:text-emerald-950 transition flex items-center gap-1.5 cursor-pointer font-semibold"
                title="Xuất danh sách nhân khẩu đang lọc theo tìm kiếm/bộ lọc"
              >
                <Filter className="h-3.5 w-3.5 text-blue-600" />
                <span>Xuất Nhân khẩu đang lọc ({filteredResidents.length})</span>
              </button>
              <div className="border-t border-slate-100 my-1"></div>
              <button
                onClick={() => exportHouseholdsExcel()}
                className="w-full text-left px-3 py-1.5 hover:bg-emerald-50 hover:text-emerald-950 transition flex items-center gap-1.5 cursor-pointer font-semibold"
                title="Xuất danh sách các hộ gia đình"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-teal-600" />
                <span>Xuất Sổ Hộ Gia Đình ({households.length})</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Unified Centralized Toolbar with Priority Search Center */}
      {(activeTab === "residents" || activeTab === "households") && (
        <div className="space-y-4 no-print">
          
          {/* MAJOR SPOTLIGHT SEARCH AREA (Hero Element for high speed operations) */}
          <div className="bg-gradient-to-br from-emerald-50/40 via-slate-50 to-slate-100/30 border border-slate-200/80 rounded-2xl p-4 md:p-5 space-y-3.5 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
              <label 
                htmlFor="smart-search-input-field" 
                className="text-[10.5px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5"
              >
                ⚡️ Ô TÌM KIẾM NHANH CƯ DÂN & HỘ KHẨU
              </label>
              <span className="text-[9.5px] text-emerald-850 font-extrabold bg-emerald-100/70 border border-emerald-200/40 px-2 py-0.5 rounded-md self-start sm:self-auto">
                Tìm tự động: Không dấu • Chữ thường • Tên lót, tuổi, Tổ, SĐT, CCCD...
              </span>
            </div>

            {/* Flexible Search Section with Quick Access actions */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
              {/* Giant High-Contrast spotlight Search input */}
              <div className="relative flex-1 group shadow-3xs">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors pointer-events-none">
                  <Search className="h-5 w-5" />
                </div>
                <input
                  id="smart-search-input-field"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm nhanh: Gõ tên lót, số tuổi (ví dụ: '45'), số điện thoại, CCCD, tạm vắng, đảng viên, cựu chiến binh..."
                  className="w-full bg-white border border-slate-250/90 rounded-xl pl-11 pr-11 py-3 text-xs md:text-sm font-semibold focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all text-slate-800 placeholder-slate-400/80 shadow-3xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full p-1 transition cursor-pointer"
                    title="Xóa tìm kiếm"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Extra toggles right-aligned side by side with the search box */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowMilitaryFilterPanel(!showMilitaryFilterPanel)}
                  className={`flex items-center gap-1.5 border px-3.5 py-3 rounded-xl text-xs font-bold cursor-pointer transition shadow-3xs ${
                    showMilitaryFilterPanel 
                      ? "bg-amber-100 border-amber-300 text-amber-900" 
                      : "bg-white border-slate-200 text-slate-650 hover:bg-slate-50"
                  }`}
                  title="Mở bộ lọc danh sách quân sự khu phố"
                >
                  <span>🎖️ QS: {residents.filter(r => r.militaryCategories && r.militaryCategories.length > 0).length}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAssistantExpanded(!isAssistantExpanded)}
                  className={`text-xs font-bold px-3.5 py-3 rounded-xl transition flex items-center gap-1.5 cursor-pointer border shadow-3xs ${
                    isAssistantExpanded 
                      ? "bg-emerald-600 text-white border-emerald-700 shadow-inner" 
                      : "bg-emerald-50 text-emerald-850 hover:bg-emerald-100/70 border border-emerald-200/50"
                  }`}
                  title="Nhấn để đóng/mở Bảng trợ lý AI và số hóa tự động"
                >
                  <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                  <span>💡 Trợ lý AI & Nhập xuất</span>
                </button>
              </div>
            </div>
          </div>

          {/* SECONDARY MINIMALIST FILTERS CONTROL ROW */}
          <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-2 flex flex-col md:flex-row gap-2 justify-between items-stretch md:items-center">
            
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mr-1">Bộ lọc danh mục:</span>
              
              {/* Residence Select */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-700 hover:border-slate-300">
                <Filter className="h-3 w-3 text-slate-400 shrink-0" />
                <span className="text-slate-400 shrink-0 text-[10px]">Cư trú:</span>
                <select
                  value={filterResidenceType}
                  onChange={(e) => setFilterResidenceType(e.target.value)}
                  className="bg-transparent border-none p-0 focus:outline-none font-bold text-slate-700 cursor-pointer text-[11px]"
                >
                  <option value="All">Tất cả</option>
                  <option value="Thường trú">Thường trú</option>
                  <option value="Tạm trú">Tạm trú</option>
                  <option value="Tạm vắng">Tạm vắng</option>
                </select>
              </div>

              {/* Tổ NDTQ Filter Select */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-700 hover:border-slate-300">
                <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="text-slate-400 shrink-0 text-[10px]">Tổ NDTQ:</span>
                <select
                  value={filterNDTQ}
                  onChange={(e) => setFilterNDTQ(e.target.value)}
                  className="bg-transparent border-none p-0 focus:outline-none font-bold text-slate-700 cursor-pointer text-[11px] max-w-[140px] truncate"
                >
                  <option value="All">Tất cả Tổ</option>
                  <option value="None">Chưa vào tổ</option>
                  {availableNDTQs.map(t => {
                    const count = residents.filter(r => r.groupNDTQ === t).length;
                    return (
                      <option key={t} value={t}>{t} ({count})</option>
                    );
                  })}
                </select>
              </div>

              {/* Groups Filter */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-705 hover:border-slate-300">
                <Filter className="h-3 w-3 text-slate-400 shrink-0" />
                <span className="text-slate-400 shrink-0 text-[10px]">Đối tượng:</span>
                <select
                  value={filterGroup}
                  onChange={(e) => setFilterGroup(e.target.value)}
                  className="bg-transparent border-none p-0 focus:outline-none font-bold text-slate-700 cursor-pointer text-[11px] max-w-[140px] truncate"
                >
                  <option value="All">Tất cả</option>
                  <optgroup label="Tổ chức / Chi hội Đoàn thể">
                    {availableGroups.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Diện an sinh xã hội">
                    {availablePolicies.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Quân sự">
                    <option value="MilitaryAll">🎖️ Mọi đối tượng Quân sự</option>
                    {MILITARY_SUBCATEGORIES.map(cat => (
                      <option key={cat} value={cat}>🎖️ {cat}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 shrink-0">
              {canEdit && (
                <button
                  onClick={() => handleOpenEdit()}
                  className="bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold hover:bg-emerald-800 cursor-pointer transition flex items-center gap-1.5 shadow-3xs shrink-0"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Khai nhân khẩu mới</span>
                </button>
              )}
            </div>
          </div>

          {/* Active search filtering feedback indicators */}
          {searchQuery && (
            <div className="flex items-center justify-between text-xs bg-emerald-50 border border-emerald-100/80 px-3 py-2 rounded-xl text-emerald-800 animate-fade-in shadow-3xs font-semibold">
              <span className="text-[11px] flex items-center gap-1.5">
                <span>🔎</span>
                <span>Đang lọc theo: "<strong className="text-emerald-950 font-black">{searchQuery}</strong>" — tìm thấy <strong className="text-emerald-950 bg-emerald-100 px-2 py-0.5 rounded font-mono">{activeTab === "residents" ? filteredResidents.length : filteredHouseholds.length}</strong> kết quả.</span>
              </span>
              <button
                type="button"
                className="text-[10px] font-black hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-rose-700 rounded-lg px-2.5 py-1 transition cursor-pointer"
                onClick={() => setSearchQuery("")}
              >
                Xóa lọc ✕
              </button>
            </div>
          )}
          
          {/* Section B: COLLAPSIBLE ASSISTANT AND AI AUTO-SYNC BENTO PANEL */}
          {isAssistantExpanded && (
            <div className="bg-gradient-to-br from-emerald-50/50 to-slate-50 border border-emerald-300/40 rounded-xl p-4 space-y-3 animate-fade-in text-slate-800">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200/90 pb-2">
                <div className="flex items-center gap-1.5">
                  <div className="bg-emerald-600 rounded-lg p-1.5 text-white shadow-3xs">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black tracking-wider uppercase text-emerald-950">
                      BÀN ĐIỀU HÀNH TRỢ LÝ SỐ & TÁC VỤ AI
                    </h3>
                    <p className="text-[10px] text-slate-500">Tối ưu hóa dữ liệu dân sự toàn diện bằng trí tuệ nhân tạo.</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[9px] font-mono font-bold text-emerald-800 uppercase tracking-widest bg-emerald-100/60 px-1.5 py-0.5 rounded">AI SẴN SÀNG</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Box 1: Đối Tượng Chính Sách & An Sinh */}
                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1.5 shadow-3xs hover:border-amber-205 transition">
                  <div className="flex items-center gap-1.5 text-amber-500">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span className="text-[10.5px] font-bold uppercase tracking-wider">1. Đối Tượng Chính Sách</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                    Quản lý các diện phân loại chính sách, an sinh xã hội địa bàn (<strong className="text-slate-800">{availablePolicies.length} diện</strong>):
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsManagingPolicies(!isManagingPolicies);
                      setIsManagingGroups(false);
                      setIsManagingNDTQs(false);
                      if (!isManagingPolicies) {
                        setTimeout(() => {
                          const el = document.getElementById("available-policies-management-section");
                          if (el) el.scrollIntoView({ behavior: "smooth" });
                        }, 100);
                      }
                    }}
                    className={`w-full text-left text-[10px] px-2 py-1 rounded transition flex items-center justify-between cursor-pointer font-bold border ${
                      isManagingPolicies 
                        ? "bg-amber-500 text-white border-amber-500 shadow-3xs" 
                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                    }`}
                  >
                    <span>⚙️ {isManagingPolicies ? "Đóng bảng quản lý" : "Cơ cấu chính sách động"}</span>
                    <ArrowRight className="h-2.5 w-2.5" />
                  </button>
                </div>

                {/* Box 2: Chi Hội & Ban Ngành Động */}
                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1.5 shadow-3xs hover:border-emerald-250 transition">
                  <div className="flex items-center gap-1 text-teal-700">
                    <Settings2 className="h-3.5 w-3.5" />
                    <span className="text-[10.5px] font-bold uppercase tracking-wider">2. Đoàn Thể Địa Bàn</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                    Quản lý và thiết kế các sơ đồ, thêm sửa đổi các chi hội, tổ tự quản khu phố (<strong className="text-slate-800">{availableGroups.length} nhóm</strong> phát sinh):
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsManagingGroups(!isManagingGroups);
                      setIsManagingNDTQs(false);
                      setIsManagingPolicies(false);
                      if (!isManagingGroups) {
                        setTimeout(() => {
                          const el = document.getElementById("available-groups-management-section");
                          if (el) el.scrollIntoView({ behavior: "smooth" });
                        }, 100);
                      }
                    }}
                    className={`w-full text-left text-[10px] px-2 py-1 rounded transition flex items-center justify-between cursor-pointer font-bold border ${
                      isManagingGroups 
                        ? "bg-teal-600 text-white border-teal-500 shadow-3xs" 
                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                    }`}
                  >
                    <span>⚙️ {isManagingGroups ? "Đóng bảng quản lý" : "Cơ cấu chi hội động"}</span>
                    <ArrowRight className="h-2.5 w-2.5" />
                  </button>
                </div>

                {/* Box 2B: Tổ NDTQ Tự Quản */}
                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1.5 shadow-3xs hover:border-violet-250 transition">
                  <div className="flex items-center gap-1 text-violet-700">
                    <Users className="h-3.5 w-3.5" />
                    <span className="text-[10.5px] font-bold uppercase tracking-wider">2B. Quản lý Tổ NDTQ</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                    Danh sách các Tổ tự quản linh hoạt phục vụ sáp nhập, chia tách khu phố (<strong className="text-slate-800">{availableNDTQs.length} tổ</strong>):
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsManagingNDTQs(!isManagingNDTQs);
                      setIsManagingGroups(false);
                      setIsManagingPolicies(false);
                      if (!isManagingNDTQs) {
                        setTimeout(() => {
                          const el = document.getElementById("available-ndtqs-management-section");
                          if (el) el.scrollIntoView({ behavior: "smooth" });
                        }, 100);
                      }
                    }}
                    className={`w-full text-left text-[10px] px-2 py-1 rounded transition flex items-center justify-between cursor-pointer font-bold border ${
                      isManagingNDTQs 
                        ? "bg-violet-600 text-white border-violet-500 shadow-3xs" 
                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                    }`}
                  >
                    <span>⚙️ {isManagingNDTQs ? "Đóng bảng quản lý tổ" : "Thiết lập cơ cấu Tổ"}</span>
                    <ArrowRight className="h-2.5 w-2.5" />
                  </button>
                </div>

                {/* Box 3: Sổ Hộ Gia Đình Điện Tử - AI Auto-Sync */}
                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1.5 shadow-3xs hover:border-indigo-200 transition">
                  <div className="flex items-center gap-1.5 text-indigo-700">
                    <Brain className="h-3.5 w-3.5 animate-pulse" />
                    <span className="text-[10.5px] font-bold uppercase tracking-wider flex items-center gap-1">
                      <span>3. AI Auto-Sync Toàn Khối</span>
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                    Rà soát rác chữ, chuẩn hóa Tiếng Việt viết hoa và tự động gộp liên kết chủ hộ cho toàn hộ gia đình.
                  </p>
                  
                  {isSyncingAI ? (
                    <button
                      type="button"
                      disabled
                      className="w-full text-[10px] px-2 py-1 rounded bg-indigo-200 text-indigo-600 font-bold cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      <span>Đang đồng bộ dữ liệu AI...</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleAISync}
                      className="w-full text-[10px] px-2 py-1 rounded transition bg-indigo-650 hover:bg-indigo-700 text-white flex items-center justify-between shadow-3xs cursor-pointer font-bold border border-indigo-500/20"
                    >
                      <span>🔄 Kích hoạt AI Auto-Sync</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Active search filtering feedback indicators */}
          {searchQuery && (
            <div className="flex items-center justify-between text-xs bg-emerald-50 border border-emerald-100/80 px-3 py-1.5 rounded-lg text-emerald-800 animate-fade-in">
              <span className="font-semibold text-[11px]">
                🔎 Đang tìm thấy <strong className="text-emerald-950 font-black">{activeTab === "residents" ? filteredResidents.length : filteredHouseholds.length}</strong> {activeTab === "residents" ? "nhân khẩu" : "hộ gia đình"} thích hợp theo từ khóa.
              </span>
              <button
                type="button"
                className="text-[10px] font-black text-rose-700 hover:underline hover:text-rose-905 click_cursor hover:text-rose-900 cursor-pointer"
                onClick={() => setSearchQuery("")}
              >
                Xóa lọc ✕
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. Specific tab view content for Residents */}
      {activeTab === "residents" && (
        <div className="space-y-4">

          {/* Collapsible Custom Policies Management Panel */}
          {isManagingPolicies && (
            <div id="available-policies-management-section" className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4 shadow-3xs animate-fade-in">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                    ⚖️ THIẾT LẬP DANH MỤC ĐỐI TƯỢNG CHÍNH SÁCH & AN SINH ĐỘNG
                  </h4>
                  <p className="text-[10px] text-slate-500">Tùy biến các diện an sinh xã hội, người có công hoặc bảo trợ đặc biệt khác trên địa bàn khu phố.</p>
                </div>
                <button 
                  onClick={() => setIsManagingPolicies(false)}
                  className="text-slate-400 hover:text-slate-600 rounded-lg p-1 text-xs cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Form to add new policy concept */}
                <div className="bg-white p-3.5 border border-slate-200 rounded-xl space-y-3">
                  <span className="text-[11px] font-bold text-slate-705 block">➕ Thêm diện chính sách mới</span>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newPolicyName}
                      onChange={(e) => setNewPolicyName(e.target.value)}
                      placeholder="Ví dụ: Người cao tuổi..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-slate-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddPolicyOption}
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white text-[11px] py-1.5 rounded-lg cursor-pointer font-bold transition flex items-center justify-center gap-1 shadow-sm border border-amber-500/10"
                    >
                      <Plus className="h-3 w-3" /> Thành lập diện mới
                    </button>
                  </div>
                </div>

                {/* List and members count */}
                <div className="md:col-span-2 bg-white p-3.5 border border-slate-200 rounded-xl space-y-2">
                  <span className="text-[11px] font-bold text-slate-700 block">📋 Danh mục diện chính sách hiện hữu ({availablePolicies.length})</span>
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                    {availablePolicies.map((p) => {
                      const count = residents.filter(r => r.specialCategories && r.specialCategories.includes(p)).length;
                      return (
                        <div 
                          key={p} 
                          className="flex items-center gap-2 bg-slate-50 border border-slate-150 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-800"
                        >
                          <span>{p}</span>
                          <span className="bg-slate-200 text-slate-700 px-1 py-0.2 rounded text-[10px] font-extrabold">{count} cư dân</span>
                          <button
                            type="button"
                            onClick={() => handleRemovePolicyOption(p)}
                            className="text-slate-450 hover:text-rose-600 rounded-full hover:bg-rose-55 p-0.5 transition cursor-pointer"
                            title="Xóa diện này"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Collapsible Custom Groups Management Panel */}
          {isManagingGroups && (
            <div id="available-groups-management-section" className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4 shadow-3xs animate-fade-in">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    ⚙️ THIẾT LẬP CƠ CẤU CHI HỘI, ĐOÀN THỂ & TỔ CÔNG TÁC KHU PHỐ
                  </h4>
                  <p className="text-[10px] text-slate-500">Tùy biến cấu trúc các tổ chức tự quản địa phương để quản lý nhân sự hiệu quả.</p>
                </div>
                <button 
                  onClick={() => setIsManagingGroups(false)}
                  className="text-slate-400 hover:text-slate-600 rounded-lg p-1 text-xs cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Form to add new group */}
                <div className="bg-white p-3.5 border border-slate-200 rounded-xl space-y-3">
                  <span className="text-[11px] font-bold text-slate-700 block">➕ Thêm Chi hội / Nhóm công tác mới</span>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="Ví dụ: Cộng tác viên dân số..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-slate-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddGroupOption}
                      className="w-full bg-slate-700 text-white text-[11px] py-1.5 rounded-lg hover:bg-slate-800 cursor-pointer font-bold transition flex items-center justify-center gap-1 shadow-sm"
                    >
                      <Plus className="h-3 w-3" /> Thành lập Tổ/Nhóm mới
                    </button>
                  </div>
                </div>

                {/* List and members count */}
                <div className="md:col-span-2 bg-white p-3.5 border border-slate-200 rounded-xl space-y-2">
                  <span className="text-[11px] font-bold text-slate-700 block">📋 Danh sách ban/ngành tự quản ({availableGroups.length})</span>
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                    {availableGroups.map((g) => {
                      const count = residents.filter(r => r.groups && r.groups.includes(g)).length;
                      return (
                        <div 
                          key={g} 
                          className="flex items-center gap-2 bg-slate-50 border border-slate-150 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-800"
                        >
                          <span>{g}</span>
                          <span className="bg-slate-200 text-slate-700 px-1 py-0.2 rounded text-[10px] font-extrabold">{count} thành viên</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveGroupOption(g)}
                            className="text-slate-450 hover:text-rose-600 rounded-full hover:bg-rose-55 p-0.5 transition cursor-pointer"
                            title="Xóa nhóm này"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Collapsible Custom Tổ NDTQ Management Panel */}
          {isManagingNDTQs && (
            <div id="available-ndtqs-management-section" className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4 shadow-3xs animate-fade-in">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-850 uppercase tracking-wider flex items-center gap-1.5">
                    ⚙️ THIẾT LẬP CƠ CẤU TỔ NHÂN DÂN TỰ QUẢN (TỔ NDTQ)
                  </h4>
                  <p className="text-[10px] text-slate-500">Tùy biến tinh giản, sáp nhập hay thêm mới linh hoạt các Tổ tự quản địa bàn khu phố.</p>
                </div>
                <button 
                  onClick={() => setIsManagingNDTQs(false)}
                  className="text-slate-450 hover:text-slate-600 rounded-lg p-1 text-xs cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Form to add new NDTQ */}
                <div className="bg-white p-3.5 border border-slate-200 rounded-xl space-y-3">
                  <span className="text-[11px] font-bold text-slate-700 block">➕ Thêm Tổ NDTQ tự quản mới</span>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newNDTQName}
                      onChange={(e) => setNewNDTQName(e.target.value)}
                      placeholder="Ví dụ: Tổ 15..."
                      className="w-full bg-slate-55 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-slate-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddNDTQOption}
                      className="w-full bg-violet-700 hover:bg-violet-800 text-white text-[11px] py-1.5 rounded-lg cursor-pointer font-bold transition flex items-center justify-center gap-1 shadow-sm"
                    >
                      <Plus className="h-3 w-3" /> Thành lập Tổ mới
                    </button>
                  </div>
                </div>

                {/* List and members count */}
                <div className="md:col-span-2 bg-white p-3.5 border border-slate-200 rounded-xl space-y-2">
                  <span className="text-[11px] font-bold text-slate-700 block">📋 Danh sách Tổ tự quản địa bàn ({availableNDTQs.length})</span>
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                    {availableNDTQs.map((t) => {
                      const count = residents.filter(r => r.groupNDTQ === t).length;
                      return (
                        <div 
                          key={t} 
                          className="flex items-center gap-2 bg-slate-50 border border-slate-150 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-800"
                        >
                          <span className="text-violet-900 font-bold">🏠 {t}</span>
                          <span className="bg-violet-100/80 text-violet-750 px-1 py-0.2 rounded text-[10px] font-extrabold">{count} thành viên</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveNDTQOption(t)}
                            className="text-slate-450 hover:text-rose-650 rounded-full hover:bg-rose-50 p-0.5 transition cursor-pointer"
                            title="Xóa tổ này"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Collapsible Military Specialties Filter Panel */}
          {showMilitaryFilterPanel && (
            <div className="bg-amber-50/20 border border-amber-200/50 rounded-2xl p-4 space-y-3 shadow-3xs">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-amber-100 pb-2">
                <span className="text-[11px] font-extrabold text-amber-900 uppercase tracking-widest flex items-center gap-1.5">
                  🎖️ BỘ LỌC QUÂN SỰ KHU PHỐ 3 (CHUYÊN MÔN KHU ĐỘI TRƯỞNG QUẢN LÝ)
                </span>
                <span className="text-[10px] text-amber-700 font-bold bg-white px-2 py-0.5 rounded-lg border border-amber-100">
                  Phù hợp quy định quân sự địa phương • Đồng bộ dữ liệu khu phố
                </span>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFilterGroup(filterGroup === "MilitaryAll" ? "All" : "MilitaryAll")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border ${
                    filterGroup === "MilitaryAll"
                      ? "bg-amber-750 border-amber-800 text-white shadow-sm"
                      : "bg-white border-amber-100 text-amber-950 hover:bg-amber-50"
                  }`}
                >
                  <span>Mọi đối tượng Quân Sự ({residents.filter(r => r.militaryCategories && r.militaryCategories.length > 0).length})</span>
                </button>

                {MILITARY_SUBCATEGORIES.map((cat) => {
                  const count = residents.filter(r => r.militaryCategories && r.militaryCategories.includes(cat)).length;
                  const isSelected = filterGroup === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFilterGroup(isSelected ? "All" : cat)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition flex items-center gap-1.5 cursor-pointer border ${
                        isSelected
                          ? "bg-amber-700 border-amber-800 text-white shadow-sm font-bold"
                          : "bg-white border-gray-200 text-gray-700 hover:bg-amber-50/60 hover:border-amber-200 hover:text-amber-955"
                      }`}
                    >
                      <span>{cat}</span>
                      <span className={`px-1.5 py-0.2 rounded-md text-[9px] ${isSelected ? "bg-amber-800 text-amber-100 font-bold" : "bg-amber-50 text-amber-800 font-semibold border border-amber-100/50"}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Table Element */}
          <div className="overflow-x-auto border border-gray-100 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-400 uppercase text-[10px] tracking-wider border-b border-gray-100">
                  <th className="py-3 px-4">Công Dân</th>
                  <th className="py-3 px-4">Số CCCD</th>
                  <th className="py-3 px-4">Ngày sinh</th>
                  <th className="py-3 px-4 text-center">Diện cư trú</th>
                  <th className="py-3 px-4 text-center">Tổ NDTQ</th>
                  <th className="py-3 px-4">Địa chỉ / Liên hệ</th>
                  <th className="py-3 px-4 text-center">Quan hệ chủ hộ</th>
                  <th className="py-3 px-4 text-right">Tính năng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                {filteredResidents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center italic text-gray-400">
                      Không tìm thấy công dân hay nhân hộ phù hợp theo từ khóa.
                    </td>
                  </tr>
                ) : (
                  filteredResidents.map(res => (
                    <tr key={res.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <span className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold uppercase ${res.gender === "Nữ" ? "bg-pink-100 text-pink-700" : "bg-emerald-100 text-emerald-700"}`}>
                            {res.fullName.charAt(0)}
                          </span>
                          <div>
                            <p className="font-bold text-gray-800 flex items-center gap-1">
                              {res.fullName}
                              {res.militaryCategories && res.militaryCategories.length > 0 && (
                                <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[8px] font-extrabold px-1 rounded-sm cursor-help" title={`Dân cư diện quân sự: ${res.militaryCategories.join(", ")}`}>🎖️ QS</span>
                              )}
                            </p>
                            <span className="text-[10px] text-gray-400 capitalize">{res.gender} - {res.job}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium">{res.cccd || "Chưa cấp/Trẻ em"}</td>
                      <td className="py-3 px-4">
                        {formatDate(res.dob)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          res.residenceType === "Thường trú" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                          res.residenceType === "Tạm trú" ? "bg-blue-50 text-blue-700 border border-blue-100" : 
                          "bg-rose-50 text-rose-700 border border-rose-100"
                        }`}>
                          {res.residenceType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-250">
                          {res.groupNDTQ || "–"}
                        </span>
                      </td>
                      <td className="py-3 px-4 select-all">
                        <p className="line-clamp-1 max-w-[180px]" title={res.address}>{res.address}</p>
                        <span className="text-[10px] text-gray-400">{res.phoneNumber || "Không có đt"}</span>
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-gray-500">{res.relationWithHeader}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => {
                              setSelectedResident(res);
                              setIsEditModalOpen(false);
                            }}
                            className="p-1 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer transition"
                            title="Thông tin chi tiết"
                          >
                            <User className="h-4 w-4" />
                          </button>
                          {canEdit && (
                            <>
                              <button
                                onClick={() => {
                                  const perm = checkResidentWritePermission(res);
                                  if (!perm.allowed) {
                                    setCustomAlert(perm.reason || "Bạn không có quyền sửa bản ghi này!");
                                    return;
                                  }
                                  handleOpenEdit(res);
                                }}
                                className={`p-1 rounded cursor-pointer transition ${
                                  checkResidentWritePermission(res).allowed 
                                    ? "text-gray-500 hover:text-emerald-700 hover:bg-emerald-50" 
                                    : "text-amber-600 hover:bg-amber-50"
                                }`}
                                title={
                                  checkResidentWritePermission(res).allowed 
                                    ? "Chỉnh sửa nhân khẩu" 
                                    : `Bị khóa: ${checkResidentWritePermission(res).reason}`
                                }
                              >
                                {checkResidentWritePermission(res).allowed ? (
                                  <Edit3 className="h-4 w-4" />
                                ) : (
                                  <Lock className="h-4 w-4 text-slate-400" />
                                )}
                              </button>
                              <button
                                onClick={() => {
                                  const perm = checkResidentWritePermission(res);
                                  if (!perm.allowed) {
                                    setCustomAlert(perm.reason || "Bạn không có quyền xóa bản ghi này!");
                                    return;
                                  }
                                  handleDeleteResident(res.id, res.fullName);
                                }}
                                className={`p-1 rounded cursor-pointer transition ${
                                  checkResidentWritePermission(res).allowed 
                                    ? "text-gray-400 hover:text-rose-600 hover:bg-rose-50" 
                                    : "text-slate-300 cursor-not-allowed"
                                }`}
                                title={
                                  checkResidentWritePermission(res).allowed 
                                    ? "Xóa nhân khẩu" 
                                    : `Bị khóa: ${checkResidentWritePermission(res).reason}`
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Detailed profiling sidebar/card underneath if selected */}
          {selectedResident && !isEditModalOpen && (
            <div className="bg-emerald-50/45 border border-emerald-100 rounded-xl p-4 mt-6 space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex gap-3 items-center">
                  <div className="h-10 w-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-lg uppercase">
                    {selectedResident.fullName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">Thông tin chi tiết: {selectedResident.fullName}</h3>
                    <p className="text-[10px] text-gray-400">Diện cư trú: {selectedResident.residenceType} - Mã hộ: {selectedResident.householdId}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedResident(null)}
                  className="text-xs text-gray-400 hover:text-gray-600 font-bold"
                >
                  Đóng [×]
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-gray-400 block text-[10px]">Mã định danh CCCD</span>
                  <span className="font-semibold text-gray-800">{selectedResident.cccd || "Cơ quan công an chưa ghi nhận hoặc trẻ em"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Ngày sinh</span>
                  <span className="font-semibold text-gray-800">
                    {formatDate(selectedResident.dob)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Số điện thoại</span>
                  <span className="font-semibold text-gray-800">{selectedResident.phoneNumber || "Không có số điện thoại"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Trình độ học vấn</span>
                  <span className="font-semibold text-gray-800">{selectedResident.education || "12/12"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Nghề nghiệp</span>
                  <span className="font-semibold text-gray-800">{selectedResident.job || "Không rõ"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Tôn giáo / Dân tộc</span>
                  <span className="font-semibold text-gray-800">{selectedResident.religion} / {selectedResident.ethnicity}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Tổ Nhân dân tự quản</span>
                  <span className="font-semibold text-emerald-800 font-bold">{selectedResident.groupNDTQ || "Chưa chọn Tổ"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Đoàn thể tham gia</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedResident.groups.length === 0 ? <span className="text-gray-400 italic text-[10px]">Chưa đăng ký</span> : selectedResident.groups.map(g => (
                      <span key={g} className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[9px]">{g}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Đối tượng đặc biệt</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedResident.specialCategories.length === 0 ? <span className="text-gray-400 italic text-[10px]">Không</span> : selectedResident.specialCategories.map(s => (
                      <span key={s} className="px-1.5 py-0.5 bg-rose-100 text-rose-800 font-bold rounded text-[9px]">{s}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Military & Reserve Information Box */}
              <div className="bg-amber-50/50 border border-amber-200/50 p-3 rounded-xl space-y-2 mt-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">🎖️</span>
                  <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">Thông tin Quân sự & Nghĩa vụ (Khu Đội Trưởng Quản lý)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-gray-400 block text-[9px] uppercase font-bold">Danh mục quản lý:</span>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {!selectedResident.militaryCategories || selectedResident.militaryCategories.length === 0 ? (
                        <span className="text-gray-400 italic text-[10px]">Chưa đăng ký diện quân sự nào</span>
                      ) : (
                        selectedResident.militaryCategories.map(m => (
                          <span key={m} className="px-2 py-0.5 bg-amber-100 border border-amber-200 text-amber-900 font-bold rounded text-[9px]">{m}</span>
                        ))
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[9px] uppercase font-bold">Ghi chú quân sự bổ sung:</span>
                    <p className="text-gray-800 font-semibold mt-1 bg-white border border-amber-100 p-1.5 rounded text-[11px] leading-relaxed">
                      {selectedResident.militaryNotes || <span className="text-gray-400 font-normal italic">Không có ghi chú thêm</span>}
                    </p>
                  </div>
                </div>
              </div>

              {selectedResident.notes && (
                <div className="bg-white p-2.5 rounded border border-emerald-100/50 text-xs">
                  <span className="text-[10px] text-gray-400 font-semibold block">Ghi chú hành chính</span>
                  <p className="text-gray-600 italic mt-0.5">{selectedResident.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TABS 2: HOUSEHOLDS */}
      {activeTab === "households" && (
        <div className="space-y-4 animate-fade-in text-xs">
          {/* 2.1 Dynamic Dashboard Metrics for Households */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Metric 1: Total Households */}
            <div 
              onClick={() => setFilterNDTQ("All")}
              className={`p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center justify-between ${
                filterNDTQ === "All"
                  ? "bg-emerald-800 border-emerald-700 text-white shadow-md scale-[1.02]"
                  : "bg-white border-slate-200 text-slate-800 hover:border-emerald-300 hover:shadow-3xs"
              }`}
            >
              <div className="space-y-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider block ${filterNDTQ === "All" ? "text-emerald-250" : "text-slate-400"}`}>
                  Sổ Hộ Gia Đình
                </span>
                <p className="text-2xl font-black tracking-tight">{households.length}</p>
                <span className={`text-[9px] block ${filterNDTQ === "All" ? "text-emerald-100" : "text-gray-400 font-semibold"}`}>
                  {filterNDTQ === "All" ? "✓ Đang hiển thị tất cả" : "👉 Nhấp để xem tất cả"}
                </span>
              </div>
              <div className={`p-2.5 rounded-xl ${filterNDTQ === "All" ? "bg-emerald-700 text-amber-300" : "bg-emerald-50 text-emerald-700"}`}>
                <Home className="h-5 w-5" />
              </div>
            </div>

            {/* Metric 2: Unassigned Group / Missing group (Highlight Red) */}
            {(() => {
              const unassignedCount = households.filter(h => !h.groupNDTQ || h.groupNDTQ === "").length;
              const isActiveFilter = filterNDTQ === "None";
              return (
                <div 
                  onClick={() => setFilterNDTQ("None")}
                  className={`p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center justify-between ${
                    isActiveFilter
                      ? "bg-rose-800 border-rose-700 text-white shadow-md scale-[1.02]"
                      : unassignedCount > 0
                        ? "bg-rose-50/60 border-rose-200 text-rose-900 hover:bg-rose-50 hover:border-rose-300 hover:shadow-3xs animate-pulse animate-duration-3000"
                        : "bg-slate-50 border-slate-200 text-slate-500"
                  }`}
                >
                  <div className="space-y-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider block ${isActiveFilter ? "text-rose-200" : "text-rose-500"}`}>
                      Cảnh báo: Chưa rõ Tổ
                    </span>
                    <p className="text-2xl font-black tracking-tight">{unassignedCount}</p>
                    <span className={`text-[9px] block ${isActiveFilter ? "text-rose-100" : unassignedCount > 0 ? "text-rose-600 font-bold" : "text-gray-400"}`}>
                      {isActiveFilter ? "✓ Đang lọc hộ thiếu Tổ" : unassignedCount > 0 ? "👉 Nhấp để rà soát ranh giới" : "Hoàn tất! Không có hộ thiếu tổ"}
                    </span>
                  </div>
                  <div className={`p-2.5 rounded-xl ${isActiveFilter ? "bg-rose-700 text-amber-300" : unassignedCount > 0 ? "bg-rose-100/80 text-rose-700" : "bg-slate-100 text-slate-400"}`}>
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                </div>
              );
            })()}

            {/* Metric 3: Total Household Members inside Sổ Hộ */}
            <div className="p-3.5 rounded-2xl border border-slate-200 text-slate-800 bg-white flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tổng Nhân Khẩu (Kê khai)</span>
                <p className="text-2xl font-black tracking-tight text-slate-800">
                  {residents.filter(r => r.householdId).length}
                </p>
                <span className="text-[9px] text-slate-400 font-semibold block">Phân bố đều qua {households.length} hộ</span>
              </div>
              <div className="p-2.5 rounded-xl bg-sky-50 text-sky-700">
                <Users className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* 2.2 Household Sub-Toolbar (Toggles and Action filters) */}
          <div className="bg-slate-55 border border-slate-200 rounded-2xl p-3 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              <span className="text-[11px] font-bold text-slate-700 self-start sm:self-center">Sắp xếp hiển thị:</span>
              <div className="flex flex-wrap items-center gap-1 w-full sm:w-auto">
                <button
                  onClick={() => setFilterNDTQ("All")}
                  className={`px-3 py-1.5 rounded-lg border text-[10.5px] font-bold cursor-pointer select-none transition ${
                    filterNDTQ === "All"
                      ? "bg-slate-800 border-slate-800 text-white shadow-sm"
                      : "bg-white border-slate-250 text-slate-705 hover:bg-slate-100"
                  }`}
                >
                  Tất cả các Tổ ({households.length})
                </button>
                <button
                  onClick={() => setFilterNDTQ("None")}
                  className={`px-3 py-1.5 rounded-lg border text-[10.5px] font-bold cursor-pointer select-none transition ${
                    filterNDTQ === "None"
                      ? "bg-rose-700 border-rose-750 text-white shadow-sm"
                      : "bg-white border-slate-250 text-rose-705 hover:bg-rose-50"
                  }`}
                >
                  👥 Chưa rõ Tổ ({households.filter(h => !h.groupNDTQ || h.groupNDTQ === "").length})
                </button>
              </div>
            </div>

            {/* Layout representation switches */}
            <div className="flex bg-white border border-slate-200 p-0.5 rounded-xl self-end sm:self-auto shadow-3xs">
              <button
                onClick={() => setHouseholdViewMode("grid")}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer select-none transition flex items-center gap-1.5 ${
                  householdViewMode === "grid"
                    ? "bg-emerald-700 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="Xem lưới chi tiết thẻ hộ gia đình"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Thẻ Hộ Chi Tiết</span>
              </button>
              <button
                onClick={() => setHouseholdViewMode("compact")}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer select-none transition flex items-center gap-1.5 ${
                  householdViewMode === "compact"
                    ? "bg-emerald-700 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="Bảng biểu danh sách tinh gọn hàng loạt"
              >
                <List className="h-3.5 w-3.5" />
                <span>Bảng Biểu Tinh gọn</span>
              </button>
            </div>
          </div>

          {/* 2.3 Main Render Body */}
          {householdViewMode === "grid" ? (
            /* ================= GRID CARD VIEW ================= */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredHouseholds.map(hh => {
                const members = residents.filter(r => r.householdId === hh.id);
                const isGroupMissing = !hh.groupNDTQ;

                return (
                  <div 
                    key={hh.id} 
                    className={`border rounded-2xl p-4 flex flex-col justify-between space-y-3.5 transition-all duration-300 relative overflow-hidden group hover:shadow-sm ${
                      isGroupMissing
                        ? "border-rose-200 bg-rose-50/15 ring-1 ring-rose-250/20"
                        : "border-slate-150 bg-white hover:border-emerald-355"
                    }`}
                  >
                    {/* Visual Warning Glow background decoration for incomplete households */}
                    {isGroupMissing && (
                      <div className="absolute right-0 top-0 w-24 h-24 bg-rose-400/5 rounded-full blur-xl pointer-events-none" />
                    )}

                    <div className="space-y-2.5">
                      {/* Top status bar inside individual card */}
                      <div className="flex justify-between items-start gap-1">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 font-extrabold rounded text-[8.5px] uppercase border border-emerald-150">
                              MÃ HỘ • {hh.id}
                            </span>
                            {isGroupMissing ? (
                              <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 font-black rounded text-[8.5px] border border-rose-200 animate-pulse flex items-center gap-0.5">
                                <span>⚠️</span> Không rõ Tổ
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 font-bold rounded text-[8.5px] border border-slate-200">
                                🏠 {hh.groupNDTQ}
                              </span>
                            )}
                          </div>
                          <h4 className="text-[13px] font-extrabold text-slate-800 mt-1 flex items-center gap-1">
                            <span>Chủ hộ:</span> {hh.headerName}
                          </h4>
                        </div>
                        <span className="text-[10px] font-extrabold text-slate-650 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg shrink-0">
                          {members.length} nhân khẩu
                        </span>
                      </div>
                      
                      {/* Descriptive info icons */}
                      <div className="text-[11px] text-slate-500 space-y-1.5 border-t border-slate-100/60 pt-2">
                        <div className="flex items-start gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <p className="leading-normal"><span className="text-slate-400 font-semibold">Địa chỉ:</span> <span className="text-slate-700">{hh.address}</span></p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <p><span className="text-slate-400 font-semibold">Liên hệ:</span> <span className="text-slate-700 font-medium">{hh.phoneNumber || "Chưa bổ sung số điện thoại"}</span></p>
                        </div>
                      </div>
                    </div>

                    {/* Household member list accordions/table inside card */}
                    <div className="border-t border-slate-150/70 pt-2.5 space-y-1.5">
                      <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">
                        Danh Sách Thành Viên ({members.length})
                      </span>
                      <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
                        {members.map(member => {
                          const isHeadOfHousehold = member.relationWithHeader === "Chủ hộ" || member.fullName === hh.headerName;
                          const isWifeHusband = member.relationWithHeader === "Vợ" || member.relationWithHeader === "Chồng";
                          return (
                            <div 
                              key={member.id} 
                              className="flex justify-between items-center text-[10.5px] py-1 px-1.5 rounded-lg bg-slate-50/60 border border-slate-100/60 last:border-b-0 text-slate-700"
                            >
                              <span className="font-semibold text-slate-800">{member.fullName}</span>
                              {isHeadOfHousehold ? (
                                <span className="bg-emerald-100/90 text-emerald-800 px-1.5 py-0.2 rounded font-extrabold text-[8px] uppercase tracking-wider border border-emerald-150">Chủ hộ</span>
                              ) : isWifeHusband ? (
                                <span className="bg-sky-100/90 text-sky-800 px-1.5 py-0.2 rounded font-extrabold text-[8px] uppercase tracking-wider border border-sky-150">{member.relationWithHeader}</span>
                              ) : (
                                <span className="text-slate-400 text-[9.5px] italic">({member.relationWithHeader || "Thành viên"})</span>
                              )}
                            </div>
                          );
                        })}
                        {members.length === 0 && (
                          <span className="text-[11px] italic text-slate-400 block py-1.5 text-center">Trống (chưa kê khai thành viên nào)</span>
                        )}
                      </div>
                    </div>

                    {/* Sync Button area with highlight for errors */}
                    {canEdit && (
                      <div className="border-t border-slate-100/80 pt-2 flex justify-between items-center gap-2">
                        <button
                          onClick={() => handleDeleteHousehold(hh)}
                          className="text-[10px] font-extrabold px-3 py-1.5 rounded-xl border border-rose-200 text-rose-600 bg-rose-50/50 hover:bg-rose-100 hover:text-rose-700 transition-all duration-200 flex items-center gap-1 cursor-pointer select-none active:scale-95 shadow-3xs"
                          title="Xóa toàn bộ hộ và các nhân khẩu thuộc hộ khi đã di dời khỏi địa bàn"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Xóa Hộ</span>
                        </button>
                        <button
                          onClick={() => handleOpenUpdateGroupModal(hh)}
                          className={`text-[10px] font-extrabold px-3 py-1.5 rounded-xl border transition-all duration-200 flex items-center gap-1.5 cursor-pointer select-none shadow-3xs ${
                            isGroupMissing 
                              ? "bg-rose-600 border-rose-700 text-white hover:bg-rose-700 animate-pulse active:scale-95" 
                              : "bg-slate-50 border-slate-205 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {isGroupMissing ? (
                            <>
                              <Sparkles className="h-3 w-3 text-amber-300 fill-amber-305" />
                              <span>Gán Tổ & Đồng bộ AI 🤖</span>
                            </>
                          ) : (
                            <>
                              <span>⚙️</span>
                              <span>Đổi Tổ & Đồng bộ AI</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredHouseholds.length === 0 && (
                <div className="col-span-full py-12 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-xs italic text-slate-400 font-semibold">Không tìm thấy hộ gia đình nào phù hợp với từ khóa.</p>
                </div>
              )}
            </div>
          ) : (
            /* ================= COMPACT TABLE VIEW ================= */
            <div className="overflow-hidden border border-slate-200 rounded-2xl bg-white shadow-3xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-[10px] uppercase font-bold text-slate-600 border-b border-slate-200">
                      <th className="py-2.5 px-3">Mã Hộ</th>
                      <th className="py-2.5 px-3">Chủ Hộ / Đại Điện</th>
                      <th className="py-2.5 px-3">Tổ tự quản</th>
                      <th className="py-2.5 px-3">Nhân khẩu</th>
                      <th className="py-2.5 px-3">Thành viên gia đình</th>
                      <th className="py-2.5 px-3">Liên hệ & Địa chỉ</th>
                      {canEdit && <th className="py-2.5 px-3 text-right">Đồng bộ AI</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {filteredHouseholds.map(hh => {
                      const members = residents.filter(r => r.householdId === hh.id);
                      const isGroupMissing = !hh.groupNDTQ;

                      return (
                        <tr 
                          key={hh.id} 
                          className={`hover:bg-slate-50/50 transition-colors ${
                            isGroupMissing 
                              ? "bg-rose-50/15" 
                              : ""
                          }`}
                        >
                          {/* Household ID */}
                          <td className="py-3 px-3 font-semibold text-slate-800">
                            <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-md font-bold text-[10px]">
                              {hh.id}
                            </span>
                          </td>

                          {/* Head of household */}
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-800 text-[11.5px]">{hh.headerName}</div>
                            {hh.phoneNumber && <span className="text-[9.5px] font-medium text-slate-400 font-mono italic">{hh.phoneNumber}</span>}
                          </td>

                          {/* Tổ NDTQ Group */}
                          <td className="py-3 px-3">
                            {isGroupMissing ? (
                              <span className="px-2 py-0.5 bg-rose-100/90 text-rose-700 border border-rose-200 rounded-full font-extrabold text-[9px] inline-flex items-center gap-1 animate-pulse">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                                <span>Chưa rõ Tổ</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-150 rounded-full font-bold text-[9px]">
                                {hh.groupNDTQ}
                              </span>
                            )}
                          </td>

                          {/* No. of members */}
                          <td className="py-3 px-3 font-semibold text-slate-700">
                            <span className="px-2 py-0.5 bg-sky-50 text-sky-800 border border-sky-150 rounded-md font-extrabold text-[9.5px]">
                              {members.length} nhân khẩu
                            </span>
                          </td>

                          {/* Family members compact list list */}
                          <td className="py-3 px-3">
                            <div className="flex flex-wrap gap-1 max-w-sm">
                              {members.map(m => (
                                <span 
                                  key={m.id} 
                                  className={`px-1 rounded text-[9.5px] border ${
                                    m.relationWithHeader === "Chủ hộ" || m.fullName === hh.headerName
                                      ? "bg-emerald-50 border-emerald-200 text-emerald-800 font-bold"
                                      : "bg-slate-50 border-slate-200 text-slate-600"
                                  }`}
                                  title={m.relationWithHeader || "Thành viên"}
                                >
                                  {m.fullName}
                                </span>
                              ))}
                              {members.length === 0 && (
                                <span className="text-gray-400 italic text-[10px]">Chưa rà soát</span>
                              )}
                            </div>
                          </td>

                          {/* Address Info */}
                          <td className="py-3 px-3 text-slate-500 max-w-xs truncate text-[10.5px]">
                            {hh.address || "Chưa có địa chỉ"}
                          </td>

                          {/* Action update with AI sync */}
                          {canEdit && (
                            <td className="py-2.5 px-3 text-right">
                              <div className="inline-flex items-center gap-1.5 justify-end">
                                <button
                                  onClick={() => handleDeleteHousehold(hh)}
                                  className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg border border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100 hover:text-rose-700 transition cursor-pointer select-none inline-flex items-center gap-1"
                                  title="Xóa toàn bộ hộ và các nhân khẩu thuộc hộ"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  <span>Xóa</span>
                                </button>
                                <button
                                  onClick={() => handleOpenUpdateGroupModal(hh)}
                                  className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg border transition-all duration-200 cursor-pointer select-none inline-flex items-center gap-1 ${
                                    isGroupMissing 
                                      ? "bg-rose-600 border-rose-700 text-white hover:bg-rose-700 shadow-3xs animate-pulse" 
                                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                                  }`}
                                >
                                  {isGroupMissing ? (
                                    <>
                                      <Sparkles className="h-3 w-3 text-amber-300" />
                                      <span>Gán Tổ (AI)</span>
                                    </>
                                  ) : (
                                    <>
                                      <span>🔧</span>
                                      <span>Sửa Tổ</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredHouseholds.length === 0 && (
                <div className="py-12 text-center bg-white">
                  <p className="text-xs italic text-slate-400 font-semibold">Không tìm thấy hộ gia đình nào phù hợp với bộ lọc chính.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TABS 3: EXCEL / AI IMPORT */}
      {activeTab === "import" && (
        <div className="space-y-6">
          {/* Dual mode selector */}
          <div className="flex bg-gray-50 border border-gray-150 p-1 rounded-xl w-fit">
            <button
              onClick={() => setImportMode("standard")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 ${
                importMode === "standard"
                  ? "bg-white text-emerald-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <FileUp className="h-3.5 w-3.5" />
              Gộp Cột Thủ Công (CSV/TXT)
            </button>
            <button
              onClick={() => setImportMode("ai")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 ${
                importMode === "ai"
                  ? "bg-emerald-800 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-300 fill-amber-300 animate-pulse" />
              AI Nhập Liệu Thông Minh ✨
            </button>
          </div>

          {importMode === "standard" ? (
            <div className="space-y-6">
              <div className="bg-emerald-50/45 p-4 rounded-xl border border-emerald-100 flex gap-3 text-xs text-emerald-900">
                <ShieldAlert className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Trình gộp nạp tệp CSV/Excel nhân khẩu thông minh</p>
                  <p className="mt-1 text-emerald-800">
                    Chức năng cho phép nhập danh sách công dân đồng loạt từ các tệp dữ liệu phổ biến. Bạn sẽ chọn tệp, thiết lập cột phù hợp tương thích với dòng dữ liệu và hệ thống sẽ tự động lọc sạch các mã số CCCD bị trùng lặp trước khi lưu trữ chính thức.
                  </p>
                </div>
              </div>

              {/* Step visual indicator */}
              <div className="flex items-center justify-center gap-2 text-xs font-semibold">
                <span className={`px-2.5 py-1 rounded-full ${importStep >= 1 ? "bg-emerald-700 text-white" : "bg-gray-100 text-gray-400"}`}>1. Tải lên tệp</span>
                <ArrowRight className="h-4 w-4 text-gray-300" />
                <span className={`px-2.5 py-1 rounded-full ${importStep >= 2 ? "bg-emerald-700 text-white" : "bg-gray-100 text-gray-400"}`}>2. Khớp cột dữ liệu</span>
                <ArrowRight className="h-4 w-4 text-gray-300" />
                <span className={`px-2.5 py-1 rounded-full ${importStep >= 3 ? "bg-emerald-700 text-white" : "bg-gray-100 text-gray-400"}`}>3. Hoàn tất</span>
              </div>

              {importStep === 1 && (
                <div className="border-2 border-dashed border-gray-200 rounded-2xl py-10 px-4 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/20 transition flex flex-col items-center justify-center gap-3">
                  <FileUp className="h-10 w-10 text-emerald-600" />
                  <div>
                    <p className="font-bold text-gray-700 text-sm">Chọn tệp danh sách dân cư của tổ dân phố</p>
                    <p className="text-xs text-gray-400 mt-1">Định dạng hỗ trợ: .csv, .txt (Hỗ trợ phân cách bằng dấu phẩy hoặc dấu chấm phẩy)</p>
                  </div>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    ref={fileInputRef}
                    onChange={handleCSVUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl mt-2 cursor-pointer hover:bg-emerald-800 transition shadow"
                  >
                    Nhập Tệp Thủ Công
                  </button>
                </div>
              )}

              {importStep === 2 && (
                <div className="space-y-4">
                  <div className="border border-gray-100 rounded-xl p-4 bg-slate-50/50 space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold text-gray-800">Ghép nối các cột dữ liệu rà soát</h4>
                      <span className="text-[10px] text-gray-400">{importRows.length} dòng dữ liệu được tải thành công</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      {Object.keys(columnMapping).map((field) => {
                        const labelMap: Record<string, string> = {
                          fullName: "Họ và tên (*)",
                          cccd: "Số CCCD / CMND",
                          dob: "Ngày sinh (YYYY-MM-DD)",
                          gender: "Giới tính",
                          address: "Địa chỉ lưu trú",
                          phoneNumber: "Số điện thoại",
                          job: "Nghề nghiệp",
                          residenceType: "Diện cư trú (thường/tạm)",
                          householdId: "Số sổ hộ khẩu",
                          relationWithHeader: "Quan hệ với chủ hộ"
                        };

                        return (
                          <div key={field} className="flex flex-col gap-1">
                            <label className="font-semibold text-gray-600">{labelMap[field] || field}</label>
                            <select
                              value={columnMapping[field]}
                              onChange={(e) => setColumnMapping({ ...columnMapping, [field]: e.target.value })}
                              className="bg-white border border-gray-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                            >
                              <option value="">-- Không ghép cột (Dùng mặc định) --</option>
                              {importHeaders.map(hdr => (
                                <option key={hdr} value={hdr}>{hdr}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setImportStep(1)}
                      className="px-4 py-2 border border-gray-200 text-xs font-semibold rounded-xl hover:bg-gray-50 cursor-pointer"
                    >
                      Quay lại
                    </button>
                    <button
                      onClick={executeBulkImport}
                      className="bg-emerald-700 text-white text-xs font-bold px-5 py-2 rounded-xl hover:bg-emerald-800 cursor-pointer shadow-sm transition"
                    >
                      Bắt đầu tích hợp ({importRows.length} dòng)
                    </button>
                  </div>
                </div>
              )}

              {importStep === 3 && (
                <div className="text-center py-8 space-y-4 flex flex-col items-center justify-center">
                  <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800">
                    <Check className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-gray-800">Hoàn tất xử lý dữ liệu hàng loạt!</h4>
                    <p className="text-xs text-gray-400 px-10">{importedStatus}</p>
                  </div>
                  <button
                    onClick={() => {
                      setImportStep(1);
                      setImportRows([]);
                      setImportHeaders([]);
                      setActiveTab("residents");
                    }}
                    className="bg-emerald-700 text-white font-bold text-xs px-5 py-2 rounded-xl hover:bg-emerald-800 cursor-pointer transition shadow"
                  >
                    Trở lại danh sách
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* AI POWERED IMPORT MODE */
            <div className="space-y-6">
              <div className="bg-emerald-50/45 p-4 rounded-xl border border-emerald-100 flex gap-3 text-xs text-emerald-950">
                <Brain className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <p className="font-bold">Nhập Dữ Liệu Dân Cư Đồng Bộ Qua Trí Tuệ Nhân Tạo (Gemini API 3.5)</p>
                  <p className="mt-1 text-emerald-850">
                    Trình AI thông minh tự động đọc và bóc tách các dòng thông tin phức tạp, sổ danh sách hay biên bản báo cáo hành chính từ cả file Excel lẫn Word. AI sẽ chuẩn hóa định dạng ngày sinh, sửa đổi các CCCD bị thiếu và tự động thực hiện rà soát trùng lặp cư dân trên địa bàn.
                  </p>
                </div>
              </div>

              {aiSyncStep === 1 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
                  {/* File upload container */}
                  <div className="bg-white border border-gray-150 rounded-2xl p-5 space-y-4 shadow-3xs flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <Upload className="h-4 w-4 text-emerald-700 animate-bounce" />
                        Tải lên tệp danh sách hành chính
                      </h4>
                      <p className="text-gray-400 mt-1 leading-relaxed">
                        Hỗ trợ nạp trực tiếp danh sách từ tệp bảng tính Excel (.xlsx, .xls), báo cáo Word văn bản (.docx), hoặc các tệp định dạng thường (.csv, .txt).
                      </p>
                    </div>

                    <div
                      onClick={() => aiFileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/10 transition rounded-xl p-8 text-center flex flex-col items-center justify-center gap-2.5 cursor-pointer group"
                    >
                      <Upload className="h-8 w-8 text-gray-350 group-hover:text-emerald-700 transition" />
                      <div>
                        {aiFileName ? (
                          <p className="text-xs font-bold text-emerald-850 break-all">{aiFileName}</p>
                        ) : (
                          <p className="text-xs font-semibold text-gray-650 group-hover:text-gray-850">Nhấp chọn tệp tài liệu bên ngoài...</p>
                        )}
                        <p className="text-[10px] text-gray-450 mt-0.5 font-medium">Hỗ trợ Excel (.xlsx, .xls), Word (.docx), CSV, TXT</p>
                      </div>
                      <input
                        type="file"
                        ref={aiFileInputRef}
                        accept=".xlsx,.xls,.docx,.csv,.txt"
                        className="hidden"
                        onChange={handleAIUploadFile}
                      />
                    </div>

                    {aiFileName && (
                      <div className="flex justify-between items-center bg-gray-50 border border-gray-150 rounded-lg p-2">
                        <span className="font-medium text-gray-600 truncate max-w-[200px]">{aiFileName}</span>
                        <button
                          onClick={() => {
                            setAiFile(null);
                            setAiFileName("");
                          }}
                          className="text-rose-500 font-bold hover:text-rose-700 cursor-pointer"
                        >
                          Gỡ bỏ
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Clipboard Text Container */}
                  <div className="bg-white border border-gray-150 rounded-2xl p-5 space-y-4 shadow-3xs flex flex-col">
                    <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Clipboard className="h-4 w-4 text-emerald-700" />
                      Hoặc dán sao chép dữ liệu dạng chữ thô
                    </h4>
                    <p className="text-gray-400 leading-relaxed">
                      Bạn cũng có thể dán trực tiếp một danh sách văn bản bất kỳ, tin nhắn cư dân gửi qua Zalo/viber hoặc biên bản ghi nhận hành chính để AI phân tích:
                    </p>
                    <textarea
                      rows={6}
                      value={aiRawText}
                      onChange={(e) => setAiRawText(e.target.value)}
                      placeholder="Ví dụ:&#13;1. Anh Trần Đức Cường, sinh ngày 12/05/1994, CCCD số 079094012485 cư ngụ tại 120/5 Khu phố 3, số đt 0981112223.&#13;2. Vợ anh Cường là chị Lê Thị Ngọc, sinh năm 1996, nội trợ, chung mã hộ HH001..."
                      className="border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs w-full flex-1"
                    />
                  </div>

                  {/* Call AI action */}
                  <div className="lg:col-span-2 flex justify-center py-2">
                    <button
                      onClick={handleRunAIAnalysis}
                      disabled={aiIsLoading}
                      className="bg-amber-450 hover:bg-amber-400 text-black border border-amber-300 font-bold text-xs px-8 py-3 rounded-xl disabled:opacity-50 transition cursor-pointer flex items-center gap-2 shadow-md hover:shadow-lg select-none"
                    >
                      {aiIsLoading ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin text-black" />
                          <span className="text-black">Hệ thống AI đang thực thi: {aiLoadingMessage}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 text-black fill-black" />
                          <span className="text-black">AI Bắt Đầu Trích Xuất & Chuẩn Hóa ✨</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* STEP 2: PREVIEW TABLE & LIVE SYNC ACTIONS */
                <div className="space-y-4 text-xs">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 border border-gray-150 rounded-xl p-4">
                    <div>
                      <h4 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                        Giai Đoạn Cân Đối Đồng Bộ Nhân Khẩu (AI phát hiện {aiParsedResidents.length} người dân)
                      </h4>
                      <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                        Bạn có thể sửa trực tiếp thông tin lỗi sai trên ô nhập liệu hoặc lựa chọn hành động ĐỒNG BỘ thích hợp trước khi chính thức đưa vào hệ thống.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setAiParsedResidents([]);
                          setAiSyncStep(1);
                        }}
                        className="px-3 py-1.5 border border-gray-200 font-semibold text-gray-600 rounded-lg hover:bg-white cursor-pointer transition"
                      >
                        Tải tệp khác
                      </button>
                      <button
                        onClick={handleExecuteAISync}
                        disabled={aiIsLoading}
                        className="bg-amber-450 hover:bg-amber-400 text-black border border-amber-300 font-bold text-xs px-5 py-1.5 rounded-lg transition cursor-pointer shadow flex items-center gap-1.5"
                      >
                        {aiIsLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin text-black" /> : <RefreshCw className="h-3.5 w-3.5 text-black" />}
                        <span className="text-black">Xác nhận gộp Đồng bộ ({aiParsedResidents.filter(i => syncActions[i.tempId] !== "skip").length} người)</span>
                      </button>
                    </div>
                  </div>

                  {/* Interactively editable table */}
                  <div className="overflow-x-auto border border-gray-150 rounded-xl bg-white shadow-3xs max-h-[480px]">
                    <table className="w-full text-left border-collapse text-xs select-text">
                      <thead>
                        <tr className="bg-slate-50/60 text-gray-500 uppercase text-[9px] font-bold tracking-wider border-b border-gray-150">
                          <th className="py-2.5 px-3">Họ và Tên (*)</th>
                          <th className="py-2.5 px-3">CCCD / CMND</th>
                          <th className="py-2.5 px-3">Ngày sinh (YYYY-MM-DD)</th>
                          <th className="py-2.5 px-3">Giới tính</th>
                          <th className="py-2.5 px-3 text-center">Trùng lặp hệ thống & Xử lý</th>
                          <th className="py-2.5 px-3">Số Điện Thoại & Nghề Nghiệp</th>
                          <th className="py-2.5 px-3">Địa Chỉ / Mã Sổ Hộ / Vai Trò</th>
                          <th className="py-2.5 px-3 text-center">Lý lịch / Ghi chú</th>
                          <th className="py-2.5 px-3 text-right">Ẩn bỏ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-150">
                        {aiParsedResidents.map((item, idx) => {
                          const dup = checkDuplicateStatus(item);
                          const currentAction = syncActions[item.tempId] || "insert";

                          return (
                            <tr key={item.tempId || idx} className="hover:bg-slate-50/20 transition">
                              {/* Name input */}
                              <td className="py-2 px-2">
                                <input
                                  type="text"
                                  value={item.fullName}
                                  onChange={(e) => handleUpdateParsedField(item.tempId, "fullName", e.target.value)}
                                  className="border border-gray-200 rounded-md p-1.5 font-bold text-gray-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none w-36 text-xs"
                                />
                              </td>
                              {/* CCCD input */}
                              <td className="py-2 px-2">
                                <input
                                  type="text"
                                  value={item.cccd}
                                  placeholder="Chưa cấp/Trẻ nhỏ"
                                  maxLength={12}
                                  onChange={(e) => handleUpdateParsedField(item.tempId, "cccd", e.target.value)}
                                  className="border border-gray-200 font-mono rounded-md p-1.5 text-gray-700 focus:ring-1 focus:ring-emerald-500 focus:outline-none w-28 text-xs bg-slate-50/30"
                                />
                              </td>
                              {/* Date of Birth input */}
                              <td className="py-2 px-2">
                                <input
                                  type="date"
                                  value={item.dob}
                                  onChange={(e) => handleUpdateParsedField(item.tempId, "dob", e.target.value)}
                                  className="border border-gray-200 rounded-md p-1.5 text-gray-700 focus:ring-1 focus:ring-emerald-500 focus:outline-none w-32 text-xs"
                                />
                              </td>
                              {/* Gender dropdown */}
                              <td className="py-2 px-2">
                                <select
                                  value={item.gender}
                                  onChange={(e) => handleUpdateParsedField(item.tempId, "gender", e.target.value)}
                                  className="border border-gray-200 rounded-md p-1.5 text-gray-700 focus:outline-none cursor-pointer w-[76px] text-xs bg-white"
                                >
                                  <option value="">Khuyết</option>
                                  <option value="Nam">Nam</option>
                                  <option value="Nữ">Nữ</option>
                                  <option value="Khác">Khác</option>
                                </select>
                              </td>
                              {/* Dup conflict check & sync action buttons */}
                              <td className="py-2 px-2 text-center min-w-[200px]">
                                <div className="flex flex-col items-center gap-1.5">
                                  {dup.type === "cccd" ? (
                                    <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded text-[8px] font-bold flex items-center gap-0.5">
                                      <AlertTriangle className="h-2 w-2 text-amber-600 fill-amber-600 shrink-0 animate-pulse" />
                                      Trùng CCCD: {dup.match?.fullName}
                                    </span>
                                  ) : dup.type === "name_dob" ? (
                                    <span className="bg-amber-50 text-amber-700 border border-amber-150 px-1.5 py-0.5 rounded text-[8px] font-bold flex items-center gap-0.5">
                                      <AlertTriangle className="h-2 w-2 text-amber-500 shrink-0" />
                                      Trùng hồ sơ: {dup.match?.fullName} ({dup.match?.dob})
                                    </span>
                                  ) : (
                                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-250 px-1.5 py-0.5 rounded text-[8px] font-bold">
                                      🌱 Mới hoàn toàn
                                    </span>
                                  )}

                                  <div className="flex bg-gray-100 p-0.5 rounded-lg w-fit">
                                    <button
                                      onClick={() => setSyncActions(prev => ({ ...prev, [item.tempId]: "insert" }))}
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition whitespace-nowrap cursor-pointer ${currentAction === "insert" ? "bg-emerald-700 text-white" : "text-gray-500 hover:text-gray-700"}`}
                                      title="Lưu công dân dạng thành viên độc lập mới"
                                    >
                                      Thêm mới
                                    </button>
                                    {(dup.type === "cccd" || dup.type === "name_dob") && (
                                      <button
                                        onClick={() => setSyncActions(prev => ({ ...prev, [item.tempId]: "update" }))}
                                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition whitespace-nowrap cursor-pointer ${currentAction === "update" ? "bg-amber-600 text-white" : "text-gray-500 hover:text-gray-700"}`}
                                        title="Ghi đè, sửa đổi thông tin lý lịch hiện tại của người này"
                                      >
                                        Ghi đè
                                      </button>
                                    )}
                                    <button
                                      onClick={() => setSyncActions(prev => ({ ...prev, [item.tempId]: "skip" }))}
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition whitespace-nowrap cursor-pointer ${currentAction === "skip" ? "bg-rose-600 text-white" : "text-gray-500 hover:text-gray-700"}`}
                                      title="Bỏ qua không lưu thông tin dòng này"
                                    >
                                      Bỏ qua
                                    </button>
                                  </div>
                                </div>
                              </td>
                              {/* SĐT & Job input info */}
                              <td className="py-2 px-2 space-y-1">
                                <input
                                  type="text"
                                  value={item.phoneNumber}
                                  placeholder="SĐT"
                                  onChange={(e) => handleUpdateParsedField(item.tempId, "phoneNumber", e.target.value)}
                                  className="border border-gray-200 rounded-md p-1 font-semibold text-gray-700 focus:outline-none w-28 text-[11px]"
                                />
                                <input
                                  type="text"
                                  value={item.job}
                                  placeholder="Nghề nghiệp"
                                  onChange={(e) => handleUpdateParsedField(item.tempId, "job", e.target.value)}
                                  className="border border-gray-200 rounded-md p-1 text-gray-700 focus:outline-none w-28 text-[11px]"
                                />
                              </td>
                              {/* Address and family relations */}
                              <td className="py-2 px-2 space-y-1 animate-fadeIn">
                                <input
                                  type="text"
                                  value={item.address}
                                  title={item.address}
                                  onChange={(e) => handleUpdateParsedField(item.tempId, "address", e.target.value)}
                                  className="border border-gray-200 rounded-md p-1 text-gray-700 focus:outline-none w-44 text-[11px] truncate bg-slate-50/50"
                                />
                                <div className="flex gap-1">
                                  <input
                                    type="text"
                                    value={item.householdId}
                                    placeholder="HH001"
                                    onChange={(e) => handleUpdateParsedField(item.tempId, "householdId", e.target.value)}
                                    className="border border-gray-200 rounded-md p-1 text-gray-700 font-mono focus:outline-none w-20 text-[11px]"
                                  />
                                  <input
                                    type="text"
                                    value={item.relationWithHeader}
                                    placeholder="Quan hệ"
                                    onChange={(e) => handleUpdateParsedField(item.tempId, "relationWithHeader", e.target.value)}
                                    className="border border-gray-200 rounded-md p-1 text-gray-700 focus:outline-none w-24 text-[11px]"
                                  />
                                </div>
                              </td>
                              {/* AI parsed notes */}
                              <td className="py-2 px-2 max-w-[150px] text-gray-400 italic">
                                <span className="line-clamp-2 leading-tight" title={item.notes}>{item.notes || "Không"}</span>
                              </td>
                              {/* Delete column row action */}
                              <td className="py-2 px-2 text-right">
                                <button
                                  onClick={() => handleRemoveParsedRow(item.tempId)}
                                  className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                  title="Gỡ khỏi hàng chờ"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs text-gray-400 bg-slate-50 border border-gray-150 p-4 rounded-xl">
                    <p className="flex items-center gap-1 font-semibold text-gray-500">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-700 animate-pulse" />
                      Nhấn "Xác nhận gộp Đồng bộ" để AI tiến hành ghi nhận hàng loạt và lưu trữ trực tiếp vào danh sách.
                    </p>
                    <button
                      onClick={handleExecuteAISync}
                      disabled={aiIsLoading}
                      className="bg-emerald-850 hover:bg-emerald-900 text-white font-bold px-6 py-2 rounded-xl cursor-pointer transition shadow flex items-center gap-1.5 select-none"
                    >
                      {aiIsLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-300" /> : <RefreshCw className="h-3.5 w-3.5 text-white" />}
                      Đồng Bộ Hoàn Tất Vào Hệ Thống
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. DIALOG MODAL FOR ADD/EDIT */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal header */}
            <div className="bg-emerald-800 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-sm tracking-tight">
                {selectedResident ? `Chỉnh sửa hồ sơ: ${selectedResident.fullName}` : "Thêm mới hồ sơ công dân cư trú"}
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-white hover:text-emerald-100 font-bold text-base cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Modal body form */}
            <form onSubmit={handleSaveResident} className="p-6 overflow-y-auto space-y-4 flex-1">
              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 text-xs flex items-center gap-2 font-medium">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
              {formSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-xs flex items-center gap-2 font-medium">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Full name */}
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-gray-600">Họ và Tên (*)</label>
                  <input
                    type="text"
                    required
                    value={editForm.fullName || ""}
                    onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                    placeholder="Nguyễn Văn A"
                    className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* CCCD */}
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-gray-600">Mã Số Định Danh CCCD</label>
                  <input
                    type="text"
                    maxLength={12}
                    value={editForm.cccd || ""}
                    onChange={(e) => setEditForm({ ...editForm, cccd: e.target.value.replace(/\D/g, "") })}
                    placeholder="0790xxxxxxxx"
                    className="border border-gray-200 rounded-lg p-2 font-mono focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Dob */}
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-gray-600">Ngày Sinh (*)</label>
                  <input
                    type="date"
                    required
                    value={editForm.dob || ""}
                    onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })}
                    className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Gender */}
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-gray-600">Giới Tính</label>
                  <select
                    value={editForm.gender || ""}
                    onChange={(e) => setEditForm({ ...editForm, gender: e.target.value as any })}
                    className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                  >
                    <option value="">-- Chưa xác định --</option>
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>

                {/* Address */}
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="font-semibold text-gray-600">Địa Chỉ cư Trú Chi Tiết (*)</label>
                  <input
                    type="text"
                    required
                    value={editForm.address || ""}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    placeholder="Số nhà, đường, hẻm, khu phố..."
                    className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Phone */}
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-gray-600">Số Điện Thoại</label>
                  <input
                    type="text"
                    value={editForm.phoneNumber || ""}
                    onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                    placeholder="09xxxxxxxx"
                    className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Job */}
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-gray-600">Nghề Nghiệp</label>
                  <input
                    type="text"
                    value={editForm.job || ""}
                    onChange={(e) => setEditForm({ ...editForm, job: e.target.value })}
                    placeholder="Kỹ sư, công nhân, buôn bán..."
                    className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Residence Type */}
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-gray-600">Diện Đăng Ký Cư Trú</label>
                  <select
                    value={editForm.residenceType || ""}
                    onChange={(e) => setEditForm({ ...editForm, residenceType: e.target.value as any })}
                    className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                  >
                    <option value="">-- Chưa xác định --</option>
                    <option value="Thường trú">Thường trú</option>
                    <option value="Tạm trú">Tạm trú</option>
                    <option value="Tạm vắng">Tạm vắng</option>
                  </select>
                </div>

                {/* Tổ Nhân Dân Tự Quản (NDTQ) */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <label className="font-semibold text-gray-600">Tổ Nhân Dân Tự Quản (Tổ NDTQ)</label>
                    <button
                      type="button"
                      onClick={() => {
                        const newMode = !isCustomNDTQ;
                        setIsCustomNDTQ(newMode);
                        if (newMode) {
                          setEditForm({ ...editForm, groupNDTQ: customNDTQInput });
                        } else {
                          setEditForm({ ...editForm, groupNDTQ: availableNDTQs[0] || "" });
                        }
                      }}
                      className="text-[10px] text-emerald-700 hover:text-emerald-800 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                    >
                      {isCustomNDTQ ? "📋 Chọn từ danh sách" : "✍️ Tự nhập tổ mới"}
                    </button>
                  </div>
                  {isCustomNDTQ ? (
                    <input
                      type="text"
                      value={editForm.groupNDTQ || ""}
                      onChange={(e) => {
                        setCustomNDTQInput(e.target.value);
                        setEditForm({ ...editForm, groupNDTQ: e.target.value });
                      }}
                      placeholder="Nhập tên Tổ mới (Ví dụ: Tổ 15...)"
                      className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  ) : (
                    <select
                      value={editForm.groupNDTQ || ""}
                      onChange={(e) => {
                        if (e.target.value === "__custom__") {
                          setIsCustomNDTQ(true);
                          setEditForm({ ...editForm, groupNDTQ: customNDTQInput });
                        } else {
                          setEditForm({ ...editForm, groupNDTQ: e.target.value });
                        }
                      }}
                      className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                    >
                      <option value="">-- Chưa liên kết Tổ --</option>
                      {availableNDTQs.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                      <option value="__custom__">✍️ [Khác] Tự nhập tay tổ mới phát sinh...</option>
                    </select>
                  )}
                </div>

                {/* Household linking */}
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-gray-600">Số Sổ Hộ Khẩu (Household ID)</label>
                  <input
                    type="text"
                    value={editForm.householdId || ""}
                    onChange={(e) => setEditForm({ ...editForm, householdId: e.target.value })}
                    placeholder="HH001"
                    className="border border-gray-200 rounded-lg p-2 font-mono focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Relation with Header */}
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-gray-600">Quan Hệ Với Chủ Hộ</label>
                  <input
                    type="text"
                    value={editForm.relationWithHeader || ""}
                    onChange={(e) => setEditForm({ ...editForm, relationWithHeader: e.target.value })}
                    placeholder="Chủ hộ, Vợ, Con, Cháu, Anh, Chị..."
                    className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Academic education */}
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-gray-600">Học Vấn / Văn Bằng</label>
                  <input
                    type="text"
                    value={editForm.education || ""}
                    onChange={(e) => setEditForm({ ...editForm, education: e.target.value })}
                    placeholder="12/12, Đại học, Thạc sĩ..."
                    className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Ethnicity and religion */}
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-gray-600">Dân tộc / Tôn giáo</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={editForm.ethnicity || "Kinh"}
                      onChange={(e) => setEditForm({ ...editForm, ethnicity: e.target.value })}
                      placeholder="Dân tộc"
                      className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={editForm.religion || "Không"}
                      onChange={(e) => setEditForm({ ...editForm, religion: e.target.value })}
                      placeholder="Tôn giáo"
                      className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Groups membership */}
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="font-semibold text-gray-600">Chi hội, đoàn thể tham gia</label>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 bg-gray-50 border border-gray-200 rounded-xl p-3">
                    {availableGroups.map(g => (
                      <label key={g} className="flex items-center gap-1.5 font-medium cursor-pointer text-gray-700">
                        <input
                          type="checkbox"
                          checked={editForm.groups?.includes(g) || false}
                          onChange={(e) => handleGroupCheckbox(g, e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>{g}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Special protective statuses */}
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="font-semibold text-gray-600">Nhóm an sinh cần hỗ trợ (Policy assistance)</label>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 bg-gray-50 border border-gray-200 rounded-xl p-3">
                    {availablePolicies.map(spec => (
                      <label key={spec} className="flex items-center gap-1.5 font-medium cursor-pointer text-gray-700">
                        <input
                          type="checkbox"
                          checked={editForm.specialCategories?.includes(spec) || false}
                          onChange={(e) => handleSpecialCheckbox(spec, e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>{spec}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Military and reserve management for Khu Đội Trưởng */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-2">
                  {/* Panel 1: Military & Reserve */}
                  <div className="flex flex-col gap-1 bg-amber-50/30 border border-amber-200/60 p-3.5 rounded-xl space-y-2">
                    <div 
                      className="flex items-center justify-between cursor-pointer select-none"
                      onClick={() => setIsMilitaryEditExpanded(!isMilitaryEditExpanded)}
                    >
                      <label className="font-bold text-gray-800 text-xs uppercase flex items-center gap-1.5 text-amber-900 cursor-pointer">
                        <span>🎖️ Nghĩa vụ Quân sự & Dự bị</span>
                        <span className="text-[10px] text-amber-700/85 font-bold normal-case">
                          ({editForm.militaryCategories?.filter(c => MILITARY_RESERVE_SUBCATEGORIES.includes(c)).length || 0} đã chọn)
                        </span>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="bg-amber-100 text-amber-900 text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase">
                          {isMilitaryEditExpanded ? "Thu gọn ▲" : "Mở rộng ▼"}
                        </span>
                      </div>
                    </div>
                    
                    {isMilitaryEditExpanded ? (
                      <div className="space-y-3 pt-1">
                        <div className="flex flex-col gap-1.5 bg-white border border-amber-100 rounded-lg p-2.5">
                          {MILITARY_RESERVE_SUBCATEGORIES.map(mil => (
                            <label key={mil} className="flex items-center gap-1.5 font-semibold cursor-pointer text-gray-700 text-xs">
                              <input
                                type="checkbox"
                                checked={editForm.militaryCategories?.includes(mil) || false}
                                onChange={(e) => handleMilitaryCheckbox(mil, e.target.checked)}
                                className="rounded text-amber-700 focus:ring-amber-500 border-amber-300"
                              />
                              <span>{mil}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-amber-900/80 italic bg-white border border-amber-100/50 p-2 rounded-lg min-h-[42px] flex items-center">
                        {editForm.militaryCategories?.some(c => MILITARY_RESERVE_SUBCATEGORIES.includes(c)) ? (
                          <div className="flex flex-wrap gap-1">
                            {editForm.militaryCategories?.filter(c => MILITARY_RESERVE_SUBCATEGORIES.includes(c)).map(cat => (
                              <span key={cat} className="px-1.5 py-0.5 bg-amber-100 text-amber-950 rounded text-[9px] font-bold border border-amber-200/40">{cat}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px]">Chưa chọn diện Nghĩa vụ/Dự bị. Nhấp để mở rộng.</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Panel 2: Militia (Dân quân tự vệ) */}
                  <div className="flex flex-col gap-1 bg-emerald-50/20 border border-emerald-200/40 p-3.5 rounded-xl space-y-2">
                    <div 
                      className="flex items-center justify-between cursor-pointer select-none"
                      onClick={() => setIsMilitiaEditExpanded(!isMilitiaEditExpanded)}
                    >
                      <label className="font-bold text-gray-800 text-xs uppercase flex items-center gap-1.5 text-emerald-955 cursor-pointer">
                        <span>🛡️ Lực lượng Dân quân tự vệ</span>
                        <span className="text-[10px] text-emerald-700/85 font-bold normal-case">
                          ({editForm.militaryCategories?.filter(c => MILITIA_SUBCATEGORIES.includes(c)).length || 0} đã chọn)
                        </span>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="bg-emerald-100 text-emerald-900 text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase">
                          {isMilitiaEditExpanded ? "Thu gọn ▲" : "Mở rộng ▼"}
                        </span>
                      </div>
                    </div>
                    
                    {isMilitiaEditExpanded ? (
                      <div className="space-y-3 pt-1">
                        <div className="flex flex-col gap-1.5 bg-white border border-emerald-100 rounded-lg p-2.5">
                          {MILITIA_SUBCATEGORIES.map(mil => (
                            <label key={mil} className="flex items-center gap-1.5 font-semibold cursor-pointer text-gray-700 text-xs">
                              <input
                                type="checkbox"
                                checked={editForm.militaryCategories?.includes(mil) || false}
                                onChange={(e) => handleMilitaryCheckbox(mil, e.target.checked)}
                                className="rounded text-emerald-700 focus:ring-emerald-500 border-emerald-300"
                              />
                              <span>{mil}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-emerald-900/80 italic bg-white border border-emerald-100/30 p-2 rounded-lg min-h-[42px] flex items-center">
                        {editForm.militaryCategories?.some(c => MILITIA_SUBCATEGORIES.includes(c)) ? (
                          <div className="flex flex-wrap gap-1">
                            {editForm.militaryCategories?.filter(c => MILITIA_SUBCATEGORIES.includes(c)).map(cat => (
                              <span key={cat} className="px-1.5 py-0.5 bg-emerald-100 text-emerald-950 rounded text-[9px] font-bold border border-emerald-200/30">{cat}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px]">Chưa chọn diện Dân quân tự vệ. Nhấp để mở rộng.</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* General Military Notes */}
                  <div className="md:col-span-2 flex flex-col gap-1 bg-amber-50/15 border border-amber-100/60 p-3 rounded-lg">
                    <label className="font-bold text-gray-650 text-[10px] uppercase">Ghi chú quân sự & dân quân riêng</label>
                    <input
                      type="text"
                      value={editForm.militaryNotes || ""}
                      onChange={(e) => setEditForm({ ...editForm, militaryNotes: e.target.value })}
                      placeholder="Ví dụ: Đội viên dự bị chi đội dân quân cơ động hoặc diện tạm hoãn thi hành nghĩa vụ..."
                      className="border border-amber-200 bg-white rounded-lg p-2 text-xs text-gray-700 focus:ring-1 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Notes and logs */}
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="font-semibold text-gray-600">Ghi Chú Đặc Biệt</label>
                  <textarea
                    rows={2}
                    value={editForm.notes || ""}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    placeholder="Nhập bổ sung thông tin chính trị, khen thưởng hoặc tiền án tiền sự nếu có..."
                    className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Modal buttons */}
              <div className="flex justify-end gap-2 border-t border-gray-150 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl font-semibold hover:bg-gray-50 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="bg-emerald-700 text-white font-bold px-6 py-2 rounded-xl hover:bg-emerald-800 transition cursor-pointer shadow-sm"
                >
                  Ghi Nhận
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. DIALOG MODAL FOR UPDATE HOUSEHOLD GROUP & SYNC AI */}
      {selectedSyncHousehold && (
        <div className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-fade-in">
            {/* Modal header */}
            <div className="bg-emerald-800 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-sm tracking-tight flex items-center gap-1.5 uppercase">
                <Sparkles className="h-4 w-4 text-amber-300 animate-pulse animate-duration-1000" />
                Đồng bộ Tổ bằng Trí Tuệ Nhân Tạo (AI)
              </h3>
              <button
                onClick={() => {
                  setSelectedSyncHousehold(null);
                  setSyncResultAI(null);
                }}
                className="text-white hover:text-emerald-100 font-bold text-lg cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Modal body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="bg-emerald-50/20 border border-emerald-100 rounded-xl p-3.5 space-y-2">
                <p className="text-gray-500 font-semibold uppercase text-[10px] tracking-wider">Thông tin hộ gia đình:</p>
                <div className="text-slate-800 space-y-1 font-medium">
                  <p>• Mã số hộ: <strong className="font-bold text-emerald-850">{selectedSyncHousehold.id}</strong></p>
                  <p>• Chủ hộ: <strong className="font-bold text-emerald-850">{selectedSyncHousehold.headerName}</strong></p>
                  <p>• Địa chỉ: <span className="text-gray-600">{selectedSyncHousehold.address}</span></p>
                  <p>• Tổ hiện tại: <span className="px-1.5 py-0.5 bg-slate-100 font-black rounded text-[10px] text-slate-700 border border-slate-205">{selectedSyncHousehold.groupNDTQ || "Không rõ Tổ"}</span></p>
                </div>
              </div>

              {/* Form select/input group */}
              <div className="space-y-3 bg-slate-50 border border-slate-200 p-4 rounded-xl">
                <label className="font-extrabold text-slate-800 text-xs block">Thiết lập Tổ tự quản mới:</label>
                
                <div className="flex gap-4 items-center bg-white p-2.5 rounded-xl border border-gray-150">
                  <label className="flex items-center gap-1.5 font-bold cursor-pointer text-gray-700 select-none">
                    <input
                      type="radio"
                      name="syncGroupType"
                      checked={!isCustomSyncGroup}
                      onChange={() => setIsCustomSyncGroup(false)}
                      className="rounded-full text-emerald-705 focus:ring-emerald-500 cursor-pointer border-gray-300 h-3.5 w-3.5"
                    />
                    <span>Tổ hiện có</span>
                  </label>
                  <label className="flex items-center gap-1.5 font-bold cursor-pointer text-gray-700 select-none">
                    <input
                      type="radio"
                      name="syncGroupType"
                      checked={isCustomSyncGroup}
                      onChange={() => setIsCustomSyncGroup(true)}
                      className="rounded-full text-emerald-705 focus:ring-emerald-500 cursor-pointer border-gray-300 h-3.5 w-3.5"
                    />
                    <span>Tự nhập Tổ mới</span>
                  </label>
                </div>

                {!isCustomSyncGroup ? (
                  <select
                    value={newSyncGroupSelect}
                    onChange={(e) => setNewSyncGroupSelect(e.target.value)}
                    className="border border-gray-200 rounded-lg p-2.5 w-full bg-white text-gray-700 text-xs focus:ring-1 focus:ring-emerald-500 font-bold focus:outline-none cursor-pointer"
                  >
                    {availableNDTQs.length === 0 ? (
                      <option value="">-- Chưa có Tổ nào trong danh sách --</option>
                    ) : (
                      availableNDTQs.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))
                    )}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={customSyncGroupInput}
                    onChange={(e) => setCustomSyncGroupInput(e.target.value)}
                    placeholder="Nhập tên Tổ mới (Ví dụ: Tổ 3, Tổ 4, ...)"
                    className="border border-gray-250 rounded-lg p-2.5 w-full bg-white text-gray-750 text-xs font-bold focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                )}
              </div>

              {/* AI synchronisation execution area */}
              {!syncResultAI ? (
                <div className="pt-2">
                  <button
                    onClick={handleExecuteGroupAISync}
                    disabled={isSyncingGroupAI}
                    className="w-full bg-emerald-700 text-white font-bold p-3 rounded-xl hover:bg-emerald-800 disabled:bg-emerald-600/60 transition cursor-pointer select-none flex items-center justify-center gap-2 shadow-sm"
                  >
                    {isSyncingGroupAI ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin text-amber-300" />
                        <span>Trí Tuệ Nhân Tạo đang tiến hành đồng bộ...</span>
                      </>
                    ) : (
                      <>
                        <Brain className="h-4 w-4 text-amber-300" />
                        <span>Chạy Đồng Bộ & Cập Nhật Tổ (AI)</span>
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-gray-400 text-center mt-2 leading-relaxed">
                    * Hành động này sẽ cập nhật Tổ cho Hộ khẩu và <strong>tự động đồng bộ Tổ với tất cả thành viên trong gia đình</strong>. Cam kết bảo toàn dữ liệu.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 animate-fade-in border-t border-slate-100 pt-3">
                  <div className="bg-emerald-50 text-emerald-905 rounded-xl p-3.5 border border-emerald-100 flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-750 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-extrabold text-xs text-emerald-900">Đồng bộ hoàn tất!</p>
                      <p className="text-[11px] font-semibold leading-relaxed mt-1 text-emerald-800">{syncResultAI.summary}</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                    <span className="font-extrabold text-slate-800 text-[10px] uppercase tracking-wider block">Báo cáo chi tiết đồng bộ:</span>
                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                      {syncResultAI.syncedMembers?.map((m, idx) => (
                        <div key={idx} className="flex flex-col gap-0.5 p-1.5 bg-white border border-slate-150 rounded-lg text-[10.5px]">
                          <div className="flex justify-between font-bold text-slate-800">
                            <span>👤 {m.fullName}</span>
                            <span className="text-gray-400 font-normal">({m.previousGroup || "Không rõ"} ➔ {m.newGroup})</span>
                          </div>
                          <span className="text-gray-450 italic text-[10px] text-gray-400 mt-0.5">{m.logMessage}</span>
                        </div>
                      ))}
                      {(!syncResultAI.syncedMembers || syncResultAI.syncedMembers.length === 0) && (
                        <p className="text-gray-400 italic text-center py-2">Không tìm thấy nhân khẩu nào khác thuộc hộ này cần cập nhật.</p>
                      )}
                    </div>

                    {syncResultAI.aiNotes && (
                      <div className="border-t border-dashed border-slate-200 pt-2 text-[10.5px] text-slate-600 font-medium">
                        <strong className="text-slate-700">💡 Ghi chú thông minh từ AI:</strong>
                        <p className="mt-1 italic text-gray-500 leading-relaxed bg-white border border-slate-100 p-2 rounded-lg">{syncResultAI.aiNotes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="border-t border-gray-105 p-4 flex justify-end gap-2 bg-slate-50/50">
              <button
                onClick={() => {
                  setSelectedSyncHousehold(null);
                  setSyncResultAI(null);
                }}
                className="px-4 py-2 bg-white border border-gray-200 text-xs font-bold rounded-xl hover:bg-gray-150 cursor-pointer select-none transition"
              >
                Đóng lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      {customAlert && (
        <div className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="bg-emerald-800 text-white px-5 py-3.5 font-bold text-xs">Thông báo hệ thống</div>
            <div className="p-5 text-xs text-gray-700 font-medium leading-relaxed">{customAlert}</div>
            <div className="flex justify-end p-3 border-t border-gray-100 bg-gray-50/50">
              <button
                type="button"
                onClick={() => setCustomAlert(null)}
                className="bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-emerald-800 cursor-pointer transition select-none"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirm Modal */}
      {customConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="bg-emerald-800 text-white px-5 py-3.5 font-bold text-xs">Xác nhận hành động</div>
            <div className="p-5 text-xs text-gray-700 font-medium leading-relaxed">{customConfirm.message}</div>
            <div className="flex justify-end gap-2 p-3 border-t border-gray-100 bg-gray-50/50">
              <button
                type="button"
                onClick={() => setCustomConfirm(null)}
                className="px-3 py-2 border border-gray-200 text-xs font-semibold rounded-xl hover:bg-gray-100 cursor-pointer select-none"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  customConfirm.onConfirm();
                  setCustomConfirm(null);
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2 rounded-xl cursor-pointer transition select-none"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

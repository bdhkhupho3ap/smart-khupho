import React, { useState, useEffect } from "react";
import { WorkSchedule, TaskAssignment } from "../types";
import { formatDate, formatDateTime, formatTimeHM } from "../utils/dateTimeUtils";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  MessageSquareCode, 
  Printer, 
  PlusCircle, 
  Bell, 
  ArrowLeft, 
  Sparkles, 
  UserCheck, 
  AlertTriangle, 
  CheckCircle, 
  FileText, 
  Check, 
  Trash2, 
  Plus, 
  TrendingUp, 
  RefreshCw,
  FolderOpen,
  CalendarDays,
  Upload,
  Paperclip
} from "lucide-react";

interface CalendarScheduleProps {
  schedules: WorkSchedule[];
  activeRole: string;
  onRefresh: () => void;
}

interface AccountItem {
  id: string;
  fullName: string;
  role: string;
}

export default function CalendarSchedule({ schedules, activeRole, onRefresh }: CalendarScheduleProps) {
  const [viewType, setViewType] = useState<"agenda" | "grid" | "week">("agenda");
  const [weekStartDate, setWeekStartDate] = useState<Date>(() => {
    const d = new Date(2026, 4, 28); // default based on 2026-05-28
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });
  const [selectedSch, setSelectedSch] = useState<WorkSchedule | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [simMessage, setSimMessage] = useState("");
  const [showInvitation, setShowInvitation] = useState(false);
  const [customAlert, setCustomAlert] = useState<string | null>(null);
  const [customConfirm, setCustomConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // Advanced Filters
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"priority" | "dueDate" | "dateTime">("priority");
  const [selectedMonth, setSelectedMonth] = useState<number>(5); // default to May (as default time is 2026-05-28)
  const [selectedYear, setSelectedYear] = useState<number>(2026); // default to 2026

  // Layout view toggle ("meetings" shows Calendar/Select Month and Table 1; "plans" shows Job Filters and Table 2)
  const [activeSection, setActiveSection] = useState<"meetings" | "plans">("meetings");

  // Form states for editing selected schedule
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDateTime, setEditDateTime] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editAttendees, setEditAttendees] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPriority, setEditPriority] = useState<'Khẩn cấp' | 'Quan trọng' | 'Thông thường'>('Thông thường');
  const [editOrganizer, setEditOrganizer] = useState("");
  const [editDueDate, setEditDueDate] = useState("");

  // Form states for creating schedule
  const [newTitle, setNewTitle] = useState("");
  const [newDateTime, setNewDateTime] = useState("2026-05-28T19:30");
  const [newLocation, setNewLocation] = useState("Văn phòng Khu phố 3 (Số 12 Đường Thảo Điền)");
  const [newAttendees, setNewAttendees] = useState("Thành phần: Ban điều hành, Ban công tác Mặt trận, Tổ trưởng TDP");
  const [newDesc, setNewDesc] = useState("");
  const [newIsMeeting, setNewIsMeeting] = useState(true);
  const [newPriority, setNewPriority] = useState<'Khẩn cấp' | 'Quan trọng' | 'Thông thường'>('Thông thường');
  const [newOrganizer, setNewOrganizer] = useState<string>("Ban điều hành"); // Đầu mối chính / Người phụ trách / Người tham gia đích danh
  
  // Advanced Form states
  const [newDueDate, setNewDueDate] = useState("");
  const [newExternalDocName, setNewExternalDocName] = useState("");
  const [newExternalDocContent, setNewExternalDocContent] = useState("");
  const [newExternalDocFileBase64, setNewExternalDocFileBase64] = useState("");
  const [newExternalDocFileType, setNewExternalDocFileType] = useState("");
  const [newExternalDocFileSize, setNewExternalDocFileSize] = useState("");
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Sub-task assignment form inside SELECTED schedule
  const [newAssigneeName, setNewAssigneeName] = useState("");
  const [newAssigneeRole, setNewAssigneeRole] = useState("");
  const [newAssignTask, setNewAssignTask] = useState("");
  const [newAssignStatus, setNewAssignStatus] = useState<'Cần làm' | 'Đang làm' | 'Đã hoàn thành' | 'Trễ hạn'>('Cần làm');
  const [newAssignNote, setNewAssignNote] = useState("");

  // AI features state
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [loadingAiReport, setLoadingAiReport] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{ task: string; proposedAssigneeRole: string }[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingParseContent, setLoadingParseContent] = useState(false);

  const currentUser = (() => {
    try {
      const raw = localStorage.getItem("kp3_admin_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  const canEdit = ["Super Admin", "Bí thư Chi bộ", "Trưởng Ban điều hành", "Trưởng ban công tác Mặt trận"].includes(activeRole) && (currentUser?.canEdit !== false);

  // Fallback managers list for assignment if api fails or is empty
  const defaultManagers = [
    { fullName: "Nguyễn Lâm Hùng", role: "Trưởng Ban điều hành" },
    { fullName: "Lê Sĩ Hoàng", role: "Bí thư Chi bộ" },
    { fullName: "Trần Anh Quốc", role: "Công an khu vực" },
    { fullName: "Phạm Minh Chiến", role: "Khu Đội Trưởng" },
    { fullName: "Trần Thị Mai", role: "Chi hội trưởng Phụ nữ" },
    { fullName: "Vương Minh", role: "Tổ trưởng TDP" },
  ];

  // Load managers/accounts on mount
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await fetch("/api/accounts");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setAccounts(data);
            // Default select the first manager
            setNewAssigneeName(data[0].fullName);
            setNewAssigneeRole(data[0].role);
          } else {
            setNewAssigneeName(defaultManagers[0].fullName);
            setNewAssigneeRole(defaultManagers[0].role);
          }
        } else {
          setNewAssigneeName(defaultManagers[0].fullName);
          setNewAssigneeRole(defaultManagers[0].role);
        }
      } catch {
        setNewAssigneeName(defaultManagers[0].fullName);
        setNewAssigneeRole(defaultManagers[0].role);
      }
    };
    fetchAccounts();
  }, []);

  // Update role dynamically based on assignee name selection
  const handleAssigneeChange = (name: string) => {
    setNewAssigneeName(name);
    const matched = accounts.find(a => a.fullName === name) || defaultManagers.find(m => m.fullName === name);
    if (matched) {
      setNewAssigneeRole(matched.role);
    }
  };

  // Sync selected Sch when schedules is refreshed
  useEffect(() => {
    if (selectedSch) {
      const updated = schedules.find(s => s.id === selectedSch.id);
      if (updated) {
        setSelectedSch(updated);
      }
    }
  }, [schedules]);

  // File upload processing helpers
  const processFile = (file: File) => {
    if (!file) return;

    setNewExternalDocName(file.name);
    const sizeStr = (file.size / (1024 * 1024)).toFixed(2) + " MB";
    setNewExternalDocFileSize(sizeStr);
    
    // Resolve standard readable MIME type if empty
    let fileType = file.type;
    if (!fileType) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'pdf') fileType = 'application/pdf';
      else if (ext === 'docx') fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      else if (ext === 'doc') fileType = 'application/msword';
      else if (ext === 'xlsx') fileType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      else if (ext === 'xls') fileType = 'application/vnd.ms-excel';
      else fileType = 'application/octet-stream';
    }
    setNewExternalDocFileType(fileType);

    // Convert file to Base64
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result && typeof e.target.result === "string") {
        setNewExternalDocFileBase64(e.target.result);
      }
    };
    reader.readAsDataURL(file);

    // Read as plain text if it's text, json, doc, log or similar text-based format
    if (
      file.type.startsWith("text/") || 
      file.name.endsWith(".txt") || 
      file.name.endsWith(".json") || 
      file.name.endsWith(".csv") || 
      file.name.endsWith(".xml") ||
      file.name.endsWith(".log")
    ) {
      const textReader = new FileReader();
      textReader.onload = (e) => {
        if (e.target?.result && typeof e.target.result === "string") {
          setNewExternalDocContent(e.target.result);
        }
      };
      textReader.readAsText(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveAttachedFile = () => {
    setNewExternalDocName("");
    setNewExternalDocContent("");
    setNewExternalDocFileBase64("");
    setNewExternalDocFileType("");
    setNewExternalDocFileSize("");
  };

  const handleDownloadAttachment = (schedule: WorkSchedule) => {
    if (!schedule.externalDocFileBase64) return;
    const link = document.createElement("a");
    link.href = schedule.externalDocFileBase64;
    link.download = schedule.externalDocName || "tai_lieu_dinh_kem";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Create general schedule
  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newDateTime) {
      setCustomAlert("Vui lòng điền đủ Tiêu đề và Thời gian triệu tập.");
      return;
    }

    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-name": encodeURIComponent("Hệ thống"),
          "x-user-role": encodeURIComponent(activeRole || "")
        },
        body: JSON.stringify({
          title: newTitle,
          dateTime: newDateTime,
          location: newLocation,
          attendees: newAttendees,
          description: newDesc,
          isMeeting: newIsMeeting,
          smsNotificationSimulated: false,
          dueDate: newDueDate || undefined,
          externalDocName: newExternalDocName || undefined,
          externalDocContent: newExternalDocContent || undefined,
          externalDocFileBase64: newExternalDocFileBase64 || undefined,
          externalDocFileType: newExternalDocFileType || undefined,
          externalDocFileSize: newExternalDocFileSize || undefined,
          priority: newPriority,
          organizer: newOrganizer || "Ban điều hành",
          assignments: []
        })
      });

      if (res.ok) {
        setIsAdding(false);
        setNewTitle("");
        setNewDesc("");
        setNewDueDate("");
        setNewExternalDocName("");
        setNewExternalDocContent("");
        setNewExternalDocFileBase64("");
        setNewExternalDocFileType("");
        setNewExternalDocFileSize("");
        setNewPriority("Thông thường");
        setNewOrganizer("Ban điều hành");
        onRefresh();
        setCustomAlert("Lên chương trình hành chính và bảo quản tài liệu nguồn thành công!");
      } else {
        setCustomAlert("Có lỗi xảy ra khi tạo lịch họp.");
      }
    } catch {
      setCustomAlert("Lỗi kết nối.");
    }
  };

  // Update schedule via PUT endpoint
  const saveScheduleUpdate = async (updatedSch: WorkSchedule) => {
    try {
      const res = await fetch(`/api/schedules/${updatedSch.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-name": encodeURIComponent("Cán bộ quản trị"),
          "x-user-role": encodeURIComponent(activeRole || "")
        },
        body: JSON.stringify(updatedSch)
      });
      if (res.ok) {
        onRefresh();
      } else {
        setCustomAlert("Máy chủ từ chối sao lưu bản cập nhật.");
      }
    } catch {
      setCustomAlert("Lỗi mạng, kiểm tra thiết bị.");
    }
  };

  // Submit updated schedule details to server
  const handleSaveEditSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSch) return;
    if (!editTitle.trim() || !editDateTime) {
      setCustomAlert("Vui lòng điền đủ Tiêu đề và Thời gian triệu tập.");
      return;
    }

    const updatedSch: WorkSchedule = {
      ...selectedSch,
      title: editTitle.trim(),
      dateTime: editDateTime,
      location: editLocation,
      attendees: editAttendees,
      description: editDesc,
      priority: editPriority,
      organizer: editOrganizer || "Ban điều hành",
      dueDate: editDueDate || undefined
    };

    try {
      const res = await fetch(`/api/schedules/${selectedSch.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-name": encodeURIComponent("Cán bộ quản trị"),
          "x-user-role": encodeURIComponent(activeRole || "")
        },
        body: JSON.stringify(updatedSch)
      });
      if (res.ok) {
        setIsEditing(false);
        setSelectedSch(updatedSch);
        onRefresh();
        setCustomAlert("Cập nhật thay đổi từ cấp trên thành công!");
      } else {
        setCustomAlert("Có lỗi xảy ra khi cập nhật lịch công tác.");
      }
    } catch {
      setCustomAlert("Lỗi mạng, vui lòng thử lại.");
    }
  };

  // Add sub-task assignment to the selected schedule
  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSch) return;
    if (!newAssignTask.trim()) {
      setCustomAlert("Vui lòng nhập chi tiết công việc phân công.");
      return;
    }

    const newAssign: TaskAssignment = {
      id: `task_${Date.now()}`,
      assigneeName: newAssigneeName || "Cán bộ",
      assigneeRole: newAssigneeRole || "Cơ quan",
      task: newAssignTask.trim(),
      status: newAssignStatus,
      note: newAssignNote.trim() || undefined,
      updatedAt: new Date().toISOString()
    };

    const updatedSch: WorkSchedule = {
      ...selectedSch,
      assignments: [...(selectedSch.assignments || []), newAssign]
    };

    setSelectedSch(updatedSch);
    setNewAssignTask("");
    setNewAssignNote("");
    await saveScheduleUpdate(updatedSch);
  };

  // Remove specific assignment from selected schedule
  const handleRemoveAssignment = async (taskID: string) => {
    if (!selectedSch) return;
    
    setCustomConfirm({
      message: "Bạn có chắc muốn xóa phân công nhiệm vụ này?",
      onConfirm: async () => {
        const updatedSch: WorkSchedule = {
          ...selectedSch,
          assignments: (selectedSch.assignments || []).filter(a => a.id !== taskID)
        };
        setSelectedSch(updatedSch);
        await saveScheduleUpdate(updatedSch);
      }
    });
  };

  // Update status of a specific assignment
  const handleToggleAssignmentStatus = async (taskID: string, currentStatus: any) => {
    if (!selectedSch) return;

    const statuses: ('Cần làm' | 'Đang làm' | 'Đã hoàn thành' | 'Trễ hạn')[] = ['Cần làm', 'Đang làm', 'Đã hoàn thành', 'Trễ hạn'];
    const nextIdx = (statuses.indexOf(currentStatus) + 1) % statuses.length;
    const nextStatus = statuses[nextIdx];

    const updatedSch: WorkSchedule = {
      ...selectedSch,
      assignments: (selectedSch.assignments || []).map(a => {
        if (a.id === taskID) {
          return { ...a, status: nextStatus, updatedAt: new Date().toISOString() };
        }
        return a;
      })
    };

    setSelectedSch(updatedSch);
    await saveScheduleUpdate(updatedSch);
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!canEdit) {
      setCustomAlert("Chỉ cán bộ có quyền mới được xóa xóa lịch công tác!");
      return;
    }
    setCustomConfirm({
      message: "Bạn muốn xóa bỏ lịch hẹn công vụ này?",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/schedules/${id}`, {
            method: "DELETE"
          });
          if (res.ok) {
            onRefresh();
            setSelectedSch(null);
          } else {
            setCustomAlert("Lỗi máy chủ.");
          }
        } catch {
          setCustomAlert("Không kết nối được.");
        }
      }
    });
  };

  // AI-powered: Parse external pasted document to extract bullet points and fill form
  const handleAiParseExternalText = async () => {
    if (!newExternalDocContent.trim()) {
      setCustomAlert("Vui lòng dán văn bản thô vào trước khi yêu cầu trợ lý AI trích xuất.");
      return;
    }
    setLoadingParseContent(true);
    try {
      const res = await fetch("/api/gemini/summarize-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: newExternalDocContent,
          summaryType: "Khái quát cực ngắn gọn khoảng 3 dòng để đưa vào phần Mô tả chi tiết chỉ tiêu."
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.summary) {
          setNewDesc(data.summary);
          setCustomAlert("AI đã phân tích tài liệu và tự động điền tóm tắt vào phần Mô tả chi tiết!");
        } else {
          setCustomAlert("AI không nhận diện được nội dung phù hợp.");
        }
      } else {
        setCustomAlert("Yêu cầu AI phân tích thất bại.");
      }
    } catch (err: any) {
      setCustomAlert("Lỗi kết nối AI: " + err.message);
    } finally {
      setLoadingParseContent(false);
    }
  };

  // AI-powered: Trigger the overall Task reporting action (Việc cần làm, Đang làm, Quá hạn nộp)
  const handleSimulateAiTaskReport = async () => {
    setLoadingAiReport(true);
    setAiReport(null);
    try {
      const res = await fetch("/api/gemini/report-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedules })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.report) {
          setAiReport(data.report);
        } else {
          setCustomAlert("Không nhận được dữ liệu báo cáo biên sở hữu.");
        }
      } else {
        setCustomAlert("Hệ thống AI bận. Vui lòng kiểm tra API key.");
      }
    } catch (err: any) {
      setCustomAlert("Có lỗi xảy ra: " + err.message);
    } finally {
      setLoadingAiReport(false);
    }
  };

  // AI-powered: Get suggested actions to assign directly based on the schedule or document content
  const handleAiGetSuggestions = async () => {
    if (!selectedSch) return;
    setLoadingSuggestions(true);
    setAiSuggestions([]);
    try {
      const res = await fetch("/api/gemini/suggest-tasks-from-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: selectedSch.title,
          description: selectedSch.description,
          externalDocContent: selectedSch.externalDocContent
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.suggestions)) {
          setAiSuggestions(data.suggestions);
        } else {
          setCustomAlert("AI không đưa ra được gợi ý thích hợp.");
        }
      } else {
        setCustomAlert("Yêu cầu AI gợi ý thất bại.");
      }
    } catch (err: any) {
      setCustomAlert("Không thể lấy ý định AI: " + err.message);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Quick apply AI suggestion task into active schedule assignments
  const handleApplyAiSuggestion = async (sugTask: string, sugRole: string) => {
    if (!selectedSch) return;

    // Resolve an actual staff name for the proposed role if possible
    const resolvedStaff = accounts.find(a => a.role === sugRole) || defaultManagers.find(m => m.role === sugRole);
    const staffName = resolvedStaff ? resolvedStaff.fullName : `Người phụ trách ${sugRole}`;

    const newAssign: TaskAssignment = {
      id: `task_${Date.now()}`,
      assigneeName: staffName,
      assigneeRole: sugRole,
      task: sugTask,
      status: "Cần làm",
      note: "Phân công đề xuất bởi AI",
      updatedAt: new Date().toISOString()
    };

    const updatedSch: WorkSchedule = {
      ...selectedSch,
      assignments: [...(selectedSch.assignments || []), newAssign]
    };

    setSelectedSch(updatedSch);
    // Remove suggestion from list
    setAiSuggestions(prev => prev.filter(s => s.task !== sugTask));
    await saveScheduleUpdate(updatedSch);
  };

  // Simulate alert delivery
  const handleSimulateAlerts = async (sch: WorkSchedule, type: "Zalo" | "SMS" | "Email") => {
    setSimMessage(`Bắt đầu chạy truyền dẫn tự động cho lịch: "${sch.title}"...`);
    setTimeout(() => {
      setSimMessage(
        `[${type} TRUYỀN THÀNH CÔNG]\nTới: các cán bộ quản lý chịu trách nhiệm.\n\nNội dung công tác: "${sch.title}" vào lúc ${formatDateTime(sch.dateTime)} ở ${sch.location}.\nSchedules/Tài liệu đính kèm: [${sch.externalDocName || "Không có đính kèm"}].\nVui lòng hoàn thành công tác trước hạn nộp YYYY-MM-DD: ${sch.dueDate || "Chưa thiết lập"}.`
      );
    }, 1000);
  };

  // Scan and identify due/expired schedules in overall database
  const todayStr = new Date().toISOString().split('T')[0];
  const dueWarningSchedules = schedules.filter(s => {
    if (s.isCompleted) return false;
    if (!s.dueDate) return false;
    // Overdue if due date is reached or passed, and has assignments not completed
    const hasIncomplete = s.assignments && s.assignments.some(a => a.status !== "Đã hoàn thành");
    return s.dueDate <= todayStr && (hasIncomplete || !s.assignments || s.assignments.length === 0);
  });

  // Helper local markdown display parser for beautiful text
  const parseSimpleMarkdown = (text: string) => {
    return text.split("\n").map((line, idx) => {
      let content = line.trim();
      if (!content) return <div key={idx} className="h-2"></div>;

      // Handle main title markers as bold green blocks
      if (content.startsWith("###")) {
        return <h4 key={idx} className="text-emerald-800 font-bold text-xs mt-3 mb-1.5 uppercase flex items-center gap-1">✦ {content.replace("###", "").trim()}</h4>;
      }
      if (content.startsWith("##") || content.startsWith("#")) {
        return <h3 key={idx} className="text-emerald-900 font-extrabold text-sm mt-4 mb-2 border-b border-dashed border-emerald-100 pb-1 flex items-center gap-1.5">🪪 {content.replace("##", "").replace("#", "").trim()}</h3>;
      }
      
      // Highlight lists and emoji bullets
      if (content.startsWith("-") || content.startsWith("*")) {
        const item = content.substring(1).trim();
        return (
          <li key={idx} className="ml-4 pl-1 list-disc text-gray-700 leading-relaxed font-sans text-[11.5px] py-0.5">
            {item}
          </li>
        );
      }

      // Handle numbers
      if (/^\d+\./.test(content)) {
        return <p key={idx} className="font-semibold text-gray-800 mt-2 text-[11.5px]">{parseBoldText(content)}</p>;
      }

      return <p key={idx} className="text-[11.5px] text-gray-600 leading-relaxed">{parseBoldText(content)}</p>;
    });
  };

  const parseBoldText = (text: string) => {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="text-gray-950 font-bold">{part}</strong> : part);
  };

  // Filter application to schedules list
  const filteredSchedules = schedules.filter(s => {
    // 1. Filter by assignee
    if (filterAssignee !== "all") {
      const hasAssignee = s.assignments && s.assignments.some(a => a.assigneeName === filterAssignee);
      if (!hasAssignee) return false;
    }
    // 2. Filter by status
    if (filterStatus !== "all") {
      if (filterStatus === "overdue") {
        // Schedule is overdue if design due date has passed
        if (s.isCompleted) return false;
        if (!s.dueDate) return false;
        return s.dueDate < todayStr && (s.assignments?.some(a => a.status !== "Đã hoàn thành") || !s.assignments || s.assignments.length === 0);
      } else {
        const hasMatchingStatus = s.assignments && s.assignments.some(a => a.status === filterStatus);
        if (!hasMatchingStatus) return false;
      }
    }
    return true;
  });

  // Sort by selected criteria (Priority Weight: Khẩn cấp = 3, Quan trọng = 2, Thông thường = 1)
  const sortedSchedules = [...filteredSchedules].sort((a, b) => {
    if (sortBy === "priority") {
      const weightA = a.priority === "Khẩn cấp" ? 3 : (a.priority === "Quan trọng" ? 2 : 1);
      const weightB = b.priority === "Khẩn cấp" ? 3 : (b.priority === "Quan trọng" ? 2 : 1);
      if (weightA !== weightB) return weightB - weightA; // Highest priority weight first
      // If priorities are equivalent, sort near-term chronological dates first
      return new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime();
    } else if (sortBy === "dueDate") {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    } else {
      // chronological
      return new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime();
    }
  });

  return (
    <div className="space-y-6">
      {/* ⚠️ RED CRITICAL WARNING BANNER FOR EXPIRING DOCUMENTS/SCHEDULES ("nhắc văn bản đã đến hạn") */}
      {dueWarningSchedules.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition shadow-xs animate-pulse">
          <div className="flex gap-3 items-start">
            <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-rose-900 uppercase">Cảnh Báo Đơn Thư & Văn Bản Đến Hạn ({dueWarningSchedules.length})</h4>
              <p className="text-[11px] text-rose-700 mt-0.5">Có công tác hành sự hoặc văn bản ngoài đã tích lũy vượt quá thời hạn quy định nhưng chưa báo hoàn thành!</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {dueWarningSchedules.map(s => (
                  <span 
                    key={s.id} 
                    onClick={() => setSelectedSch(s)}
                    className="cursor-pointer px-2 py-0.5 bg-rose-200 hover:bg-rose-300 transition text-[10px] rounded-lg font-bold text-rose-900 flex items-center gap-1 text-slate-900 border border-rose-300"
                  >
                    🚀 {s.title} (Hạn: {s.dueDate})
                  </span>
                ))}
              </div>
            </div>
          </div>
          <button 
            onClick={handleSimulateAiTaskReport}
            className="px-4 py-2 bg-rose-800 text-white font-bold rounded-xl text-xs hover:bg-rose-950 cursor-pointer shadow-xs transition shrink-0"
          >
            Chạy AI Phân Tích Khẩn Cấp
          </button>
        </div>
      )}

      {/* 🤖 MAIN AI TASK REPORTER AND ASSISTANT CARD */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-2xl p-5 text-white shadow relative overflow-hidden">
        <div className="absolute top-0 right-0 opacity-10 pointer-events-none transform translate-x-4 -translate-y-4">
          <Sparkles className="h-44 w-44" />
        </div>
        
        <div className="max-w-xl space-y-2.5">
          <span className="px-2.5 py-1 bg-white/20 backdrop-blur-md rounded-full text-[9px] font-extrabold uppercase tracking-widest text-emerald-200 flex items-center gap-1 w-max">
            <Sparkles className="h-3 w-3 fill-emerald-200" /> TRỢ LÝ GIÁM SÁT AI TỔ DÂN PHỐ
          </span>
          <h2 className="text-sm font-extrabold tracking-tight">Tự Động Báo Việc Cần Làm, Đang Làm, Sắp Đến Hạn Nộp 2026</h2>
          <p className="text-xs text-emerald-100 leading-relaxed font-normal">
            Bấm nút phân tích để kích hoạt AI rà soát toàn bộ lịch làm việc và bảng phân công, từ đó lập báo cáo đốc thúc tiến độ các bộ phận quản lý không chậm trễ giấy tờ hỏa tốc.
          </p>
          
          <div className="pt-2 flex flex-wrap gap-2">
            <button
              onClick={handleSimulateAiTaskReport}
              disabled={loadingAiReport}
              className="bg-white hover:bg-emerald-50 text-emerald-900 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow"
            >
              {loadingAiReport ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Đang lập báo cáo...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-emerald-700 fill-emerald-100" />
                  Lập Báo Cáo Tiến Độ AI
                </>
              )}
            </button>
            {aiReport && (
              <button
                onClick={() => setAiReport(null)}
                className="bg-emerald-700/50 hover:bg-emerald-700 text-white border border-emerald-600 px-3 py-2 rounded-xl text-xs transition font-semibold"
              >
                Ẩn báo cáo ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* DISPLAY BOX FOR GENERATED AI REPORT */}
      {aiReport && (
        <div className="bg-white rounded-2xl border border-gray-150 p-6 shadow-sm relative animate-fadeIn">
          <div className="absolute top-4 right-4 text-[10px] font-mono font-bold text-gray-400 uppercase bg-gray-50 px-2 py-0.5 rounded-md border">
            Bản Thuyết Trình AI
          </div>
          <div className="space-y-3 prose max-w-full select-text">
            {parseSimpleMarkdown(aiReport)}
          </div>
          <div className="border-t border-gray-100 pt-4 mt-5 flex justify-end">
            <button
              onClick={() => {
                const blob = new Blob([aiReport], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `Bao_cao_AI_Khu_Pho_3_${new Date().toISOString().split('T')[0]}.txt`;
                link.click();
              }}
              className="px-3.5 py-1.5 border border-gray-200 text-gray-600 bg-gray-50 text-xs font-bold rounded-lg hover:bg-gray-100 transition flex items-center gap-1 cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5" /> Xuất Văn Bản Báo Cáo
            </button>
          </div>
        </div>
      )}

      {/* Visual invitation screen overlay when triggered */}
      {showInvitation && selectedSch && (
        <div className="bg-white rounded-xl border border-gray-150 p-8 shadow max-w-2xl mx-auto space-y-6 print:shadow-none print:p-0">
          <div className="flex justify-between items-center border-b border-gray-100 pb-4 no-print border-b-emerald-800">
            <button
              onClick={() => setShowInvitation(false)}
              className="text-xs font-semibold text-gray-500 hover:text-gray-800 flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="h-3 w-3" /> Trở lại Lịch
            </button>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-emerald-800 text-white rounded-lg text-xs font-bold hover:bg-emerald-900 cursor-pointer transition flex items-center gap-1 shadow-sm"
            >
              <Printer className="h-3.5 w-3.5" /> In Giấy Mời Này
            </button>
          </div>

          {/* Actual template layout matching standard Việt Nam administrative paperwork style */}
          <div className="text-center space-y-1 select-text">
            <div className="flex justify-between text-[11px] font-bold text-gray-700">
              <div className="text-center uppercase">
                <p>UBND PHƯỜNG AN PHÚ</p>
                <p className="font-bold underline">BAN ĐIỀU HÀNH KHU PHỐ 3</p>
              </div>
              <div className="text-center uppercase font-bold">
                <p>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                <p className="font-bold underline">Độc lập - Tự do - Hạnh phúc</p>
              </div>
            </div>

            <div className="pt-8 text-center space-y-2">
              <h1 className="text-lg font-extrabold tracking-tight text-gray-900 uppercase">GIẤY MỜI HỌP DÂN</h1>
              <p className="text-xs italic text-gray-400">Về việc: {selectedSch.title}</p>
            </div>

            <div className="pt-6 text-left text-xs space-y-3.5 text-gray-800 max-w-lg mx-auto">
              <p className="font-semibold text-gray-900">Ban Điều Hành Khu Phố 3 kính gửi:</p>
              <p className="pl-4 italic text-gray-600">- Đồng chí có tên đại diện các ban ngành chi hội,</p>
              <p className="pl-4 italic text-gray-600">- Đại diện hộ gia đình cư trú Tổ dân phố khu phố 3.</p>

              <div className="space-y-2 pt-2 border-t border-dashed border-gray-100">
                <p><span className="font-bold">Nội dung họp:</span> {selectedSch.description || "Thảo luận công tác vệ sinh, trật tự trị an, bảo hộ dân số quận."}</p>
                <p><span className="font-bold">Thời gian:</span> {`${formatTimeHM(selectedSch.dateTime)} ngày ${formatDate(selectedSch.dateTime)}`}</p>
                <p><span className="font-bold">Địa điểm:</span> {selectedSch.location}</p>
                <p><span className="font-bold">Yêu cầu tham dự:</span> {selectedSch.attendees}</p>
                {selectedSch.dueDate && (
                  <p><span className="font-bold text-rose-850">Hạn chót xử lý văn bản đính kèm:</span> <span className="underline font-bold text-slate-800">{selectedSch.dueDate}</span></p>
                )}
                {selectedSch.externalDocName && (
                  <p><span className="font-bold">Tài liệu tham chiếu ngoài:</span> {selectedSch.externalDocName}</p>
                )}
              </div>

              <p className="pt-3">Rất kính mong các đồng chí và quý bà con có mặt đúng giờ để buổi họp hội đồng đạt kết quả phục vụ dân cư chu toàn nhất.</p>
            </div>

            <div className="pt-10 flex justify-end">
              <div className="text-center text-xs space-y-1">
                <p className="italic text-gray-400">An Phú, ngày {new Date().getDate()} tháng {new Date().getMonth()+1} năm {new Date().getFullYear()}</p>
                <p className="font-bold text-gray-800 uppercase">TM. BAN ĐIỀU HÀNH KHU PHỐ</p>
                <p className="font-bold text-emerald-800 underline">TRƯỞNG KHU PHỐ</p>
                <div className="h-16"></div>
                <p className="font-bold text-gray-700">Nguyễn Lâm Hùng</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main working view */}
      {!showInvitation && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Calendar visual month component (Grid) & Filter center */}
          <div className="lg:col-span-1 space-y-4">
            
            {/* 📅 COLLAPSIBLE BOX 1: CHỌN THÁNG & NĂM CÔNG TÁC (Connected with Meetings) */}
            <div 
              onClick={() => {
                if (activeSection !== "meetings") {
                  setActiveSection("meetings");
                }
              }}
              className={`rounded-2xl border p-4 transition-all duration-300 shadow-xs cursor-pointer ${
                activeSection === "meetings" 
                  ? "bg-gradient-to-br from-white to-rose-50/20 border-rose-300 ring-4 ring-rose-500/5" 
                  : "bg-white border-gray-150 hover:bg-slate-50 opacity-90"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-extrabold text-[11.5px] uppercase text-rose-950">
                  <Calendar className="h-4 w-4 text-rose-700" />
                  <span>📅 LỊCH HỌP</span>
                </div>
                {activeSection === "meetings" ? (
                  <span className="text-[9px] font-extrabold bg-rose-105 bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    ĐANG XEM HỌP
                  </span>
                ) : (
                  <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full uppercase">
                    ẨN • NHẤP ĐỂ XEM
                  </span>
                )}
              </div>
              
              {activeSection === "meetings" && (
                <div className="mt-3.5 space-y-3.5 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                  <p className="text-[10px] text-gray-500 font-medium">Bấm chuyển tháng truy cứu tài liệu họp hành & kế hoạch thực hiện của kì họp năm:</p>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-rose-800 font-bold">Tháng</label>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="border border-rose-200 rounded-lg p-2 focus:ring-1 focus:ring-rose-500 bg-white font-bold text-xs text-rose-950"
                      >
                        {Array.from({ length: 12 }).map((_, i) => (
                          <option key={i} value={i + 1}>Tháng {i + 1}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-rose-800 font-bold">Năm lưu trữ</label>
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="border border-rose-200 rounded-lg p-2 focus:ring-1 focus:ring-rose-500 bg-white font-bold text-xs text-rose-950"
                      >
                        {[2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032].map(y => (
                          <option key={y} value={y}>Năm {y}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 select-none">
                    <button 
                      type="button"
                      onClick={() => {
                        if (selectedMonth === 1) {
                          setSelectedMonth(12);
                          setSelectedYear(prev => prev - 1);
                        } else {
                          setSelectedMonth(prev => prev - 1);
                        }
                      }}
                      className="p-2 hover:bg-rose-50 hover:text-rose-900 border border-rose-100 rounded-lg transition font-extrabold text-[10px] text-center text-rose-800 bg-white cursor-pointer"
                    >
                      « Tháng Trước
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        if (selectedMonth === 12) {
                          setSelectedMonth(1);
                          setSelectedYear(prev => prev + 1);
                        } else {
                          setSelectedMonth(prev => prev + 1);
                        }
                      }}
                      className="p-2 hover:bg-rose-50 hover:text-rose-900 border border-rose-100 rounded-lg transition font-extrabold text-[10px] text-center text-rose-800 bg-white cursor-pointer"
                    >
                      Tháng Sau »
                    </button>
                  </div>

                  {/* 3. Sort picker (Khẩn cấp / Hạn chót / Triệu tập) */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-rose-800 font-bold">Thứ tự Sắp xếp (Thứ ưu tiên)</label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="border border-rose-200 rounded-lg p-2 focus:ring-1 focus:ring-rose-500 bg-rose-50/50 font-bold text-rose-950 text-xs focus:outline-none"
                    >
                      <option value="priority">🔥 Độ Khẩn Cấp (Hỏa tốc làm trước)</option>
                      <option value="dueDate">⏰ Hạn Ngoài Gần Nhất (Sắp trễ trước)</option>
                      <option value="dateTime">🕒 Thời Gian Triệu Tập (Hội họp tuần tự)</option>
                    </select>
                  </div>

                  {/* MINI CALENDAR FOR HIGH VISIBILITY ON SENSITIVE MEETING DATES */}
                  <div className="bg-rose-50/20 border border-rose-100/30 rounded-xl p-3 space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="text-[10px] font-extrabold text-rose-900 uppercase">Lịch trực quan {selectedMonth}/{selectedYear}</h3>
                      <div className="flex gap-1 bg-white/80 p-0.5 rounded-md border border-gray-150 select-none">
                        <button type="button" onClick={() => setViewType("agenda")} className={`px-1.5 py-0.5 text-[8.5px] rounded cursor-pointer ${viewType === "agenda" ? "bg-rose-150 bg-rose-200 text-rose-900 font-bold" : "text-gray-400 font-medium"}`}>Hôm nay</button>
                        <button type="button" onClick={() => setViewType("week")} className={`px-1.5 py-0.5 text-[8.5px] rounded cursor-pointer ${viewType === "week" ? "bg-rose-150 bg-rose-200 text-rose-900 font-bold" : "text-gray-400 font-medium"}`}>Lịch tuần</button>
                        <button type="button" onClick={() => setViewType("grid")} className={`px-1.5 py-0.5 text-[8.5px] rounded cursor-pointer ${viewType === "grid" ? "bg-rose-150 bg-rose-200 text-rose-900 font-bold" : "text-gray-400 font-medium"}`}>Lịch ô</button>
                      </div>
                    </div>

                    {viewType === "grid" ? (
                      <div className="grid grid-cols-7 gap-1 text-[9px] text-center font-semibold">
                        {["Hai", "Ba", "Tư", "Năm", "Sáu", "Bảy", "CN"].map(d => (
                          <span key={d} className="text-gray-400 text-[8px] font-bold py-0.5">{d.substring(0, 3)}</span>
                        ))}
                        {(() => {
                          const firstDayRaw = new Date(selectedYear, selectedMonth - 1, 1).getDay();
                          const emptyCount = firstDayRaw === 0 ? 6 : firstDayRaw - 1;
                          return Array.from({ length: emptyCount }).map((_, idx) => (
                            <span key={`empty_${idx}`} className="text-transparent py-0.5">.</span>
                          ));
                        })()}
                        {(() => {
                          const daysCount = new Date(selectedYear, selectedMonth, 0).getDate();
                          return Array.from({ length: daysCount }).map((_, idx) => {
                            const dayNum = idx + 1;
                            const hasEvent = schedules.some(s => {
                              const d = new Date(s.dateTime);
                              return s.isMeeting && d.getDate() === dayNum && (d.getMonth() + 1) === selectedMonth && d.getFullYear() === selectedYear;
                            });
                            const today = new Date();
                            const isToday = today.getDate() === dayNum && (today.getMonth() + 1) === selectedMonth && today.getFullYear() === selectedYear;
                            return (
                              <span
                                key={`day_${dayNum}`}
                                className={`py-1 rounded-md flex flex-col items-center justify-center relative ${isToday ? "bg-rose-600 font-bold text-white shadow-xs" : "text-gray-600 hover:bg-rose-50/50"} ${hasEvent ? "ring-1 ring-rose-300 font-extrabold" : ""}`}
                              >
                                {dayNum}
                                {hasEvent && <span className={`h-1 w-1 rounded-full absolute bottom-0.5 ${isToday ? "bg-white" : "bg-rose-600"}`}></span>}
                              </span>
                            );
                          });
                        })()}
                      </div>
                    ) : viewType === "week" ? (
                      <div className="space-y-3.5 text-xs animate-fadeIn">
                        {/* Weekly navigation controls */}
                        <div className="flex justify-between items-center bg-white/50 border border-slate-100 rounded-lg p-1.5 select-none">
                          <button
                            type="button"
                            onClick={() => {
                              setWeekStartDate(prev => {
                                const nextWeek = new Date(prev);
                                nextWeek.setDate(prev.getDate() - 7);
                                return nextWeek;
                              });
                            }}
                            className="bg-white hover:bg-slate-50 border border-gray-200 text-gray-700 font-bold text-[8px] px-1.5 py-0.5 rounded cursor-pointer transition"
                          >
                            « Trước
                          </button>
                          <span className="font-extrabold text-[8.5px] text-rose-900 font-mono">
                            {(() => {
                              const endWeek = new Date(weekStartDate);
                              endWeek.setDate(weekStartDate.getDate() + 6);
                              return `${String(weekStartDate.getDate()).padStart(2, '0')}/${String(weekStartDate.getMonth() + 1).padStart(2, '0')} - ${String(endWeek.getDate()).padStart(2, '0')}/${String(endWeek.getMonth() + 1).padStart(2, '0')}`;
                            })()}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setWeekStartDate(prev => {
                                const nextWeek = new Date(prev);
                                nextWeek.setDate(prev.getDate() + 7);
                                return nextWeek;
                              });
                            }}
                            className="bg-white hover:bg-slate-50 border border-gray-200 text-gray-700 font-bold text-[8px] px-1.5 py-0.5 rounded cursor-pointer transition"
                          >
                            Sau »
                          </button>
                        </div>

                        {/* List of 7 days in week */}
                        <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-0.5 scrollbar-thin">
                          {(() => {
                            const days = [];
                            for (let i = 0; i < 7; i++) {
                              const day = new Date(weekStartDate);
                              day.setDate(weekStartDate.getDate() + i);
                              days.push(day);
                            }

                            const weekDayNames = ["T2 (Hai)", "T3 (Ba)", "T4 (Tư)", "T5 (Năm)", "T6 (Sáu)", "T7 (Bảy)", "CN (Chủ Nhật)"];

                            return days.map((day, idx) => {
                              const dNum = day.getDate();
                              const mNum = day.getMonth() + 1;
                              const yNum = day.getFullYear();

                              // Meetings occurring on this day
                              const dayMeetings = schedules.filter(s => {
                                const d = new Date(s.dateTime);
                                return s.isMeeting && d.getDate() === dNum && (d.getMonth() + 1) === mNum && d.getFullYear() === yNum;
                              });

                              const today = new Date();
                              const isToday = today.getDate() === dNum && (today.getMonth() + 1) === mNum && today.getFullYear() === yNum;

                              return (
                                <div
                                  key={`week_day_${idx}`}
                                  className={`rounded-lg p-2 border text-[10px] transition ${
                                    isToday
                                      ? "bg-rose-50/70 border-rose-250 ring-1 ring-rose-300"
                                      : "bg-white/80 border-gray-100 hover:border-rose-100"
                                  }`}
                                >
                                  <div className="flex justify-between items-center border-b border-gray-50 pb-1 mb-1">
                                    <span className={`font-extrabold text-[9.5px] ${isToday ? "text-rose-700" : "text-gray-700"}`}>
                                      {weekDayNames[idx]} - {dNum}/{mNum}
                                    </span>
                                    {isToday && (
                                      <span className="bg-rose-600 text-[7px] text-white px-1 rounded-sm select-none font-black uppercase">Nay</span>
                                    )}
                                  </div>

                                  {dayMeetings.length === 0 ? (
                                    <p className="text-[8.5px] text-gray-400 italic font-medium">Không họp</p>
                                  ) : (
                                    <div className="space-y-1">
                                      {dayMeetings.map(sch => {
                                        const t = new Date(sch.dateTime);
                                        const timeStr = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
                                        return (
                                          <div
                                            key={sch.id}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedSch(sch);
                                            }}
                                            className={`p-1.5 rounded border text-[8.5px] cursor-pointer transition select-none flex items-center justify-between ${
                                              sch.priority === "Khẩn cấp"
                                                ? "bg-rose-50 border-rose-150 hover:bg-rose-100/60 text-rose-950 font-bold"
                                                : sch.priority === "Quan trọng"
                                                ? "bg-amber-50 border-amber-150 hover:bg-amber-100/60 text-amber-950 font-bold"
                                                : "bg-slate-50 border-slate-150 hover:bg-slate-100/60 text-slate-800 font-medium"
                                            }`}
                                          >
                                            <span className="truncate max-w-[130px] font-semibold">⏰ {timeStr} - {sch.title}</span>
                                            <span className="text-[7.5px] text-rose-850 shrink-0 font-bold bg-white/80 px-1 border rounded-md">Xem »</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 text-xs animate-fadeIn">
                        {/* Title showing today's date */}
                        <div className="flex justify-between items-center bg-rose-50/50 border border-rose-100 rounded-lg p-1.5 select-none">
                          <span className="font-extrabold text-[8.5px] text-rose-950 font-sans uppercase">
                            📅 Lịch họp hôm nay ({(() => {
                              const today = new Date();
                              return `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
                            })()})
                          </span>
                        </div>

                        {/* List of today's meetings inside mini-box */}
                        <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-0.5 scrollbar-thin">
                          {(() => {
                            const today = new Date();
                            const todayMeetings = schedules.filter(s => {
                              const d = new Date(s.dateTime);
                              return s.isMeeting && d.getDate() === today.getDate() && (d.getMonth() + 1) === (today.getMonth() + 1) && d.getFullYear() === today.getFullYear();
                            });

                            if (todayMeetings.length === 0) {
                              return <p className="text-[8.5px] text-gray-400 italic font-medium p-2 text-center bg-gray-50/50 rounded-lg border border-gray-100">Không có lịch họp nào hôm nay</p>;
                            }

                            return todayMeetings.map(sch => {
                              const t = new Date(sch.dateTime);
                              const timeStr = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
                              return (
                                <div
                                  key={sch.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedSch(sch);
                                  }}
                                  className={`p-1.5 rounded-lg border text-[8.5px] cursor-pointer transition select-none flex items-center justify-between ${
                                    sch.priority === "Khẩn cấp"
                                      ? "bg-rose-50 border-rose-150 hover:bg-rose-100/60 text-rose-950 font-bold"
                                      : sch.priority === "Quan trọng"
                                      ? "bg-amber-50 border-amber-150 hover:bg-amber-100/60 text-amber-950 font-bold"
                                      : "bg-slate-50 border-slate-150 hover:bg-slate-100/60 text-slate-800 font-medium"
                                  }`}
                                >
                                  <span className="truncate max-w-[130px] font-semibold">⏰ {timeStr} - {sch.title}</span>
                                  <span className="text-[7.5px] text-rose-850 shrink-0 font-bold bg-white/85 px-1.5 py-0.5 border rounded-md">Xem »</span>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 🔍 COLLAPSIBLE BOX 2: BỘ LỌC CÔNG VIỆC CHI TIẾT (Connected with Plans) */}
            <div 
              onClick={() => {
                if (activeSection !== "plans") {
                  setActiveSection("plans");
                }
              }}
              className={`rounded-2xl border p-4 transition-all duration-300 shadow-xs cursor-pointer ${
                activeSection === "plans" 
                  ? "bg-gradient-to-br from-white to-sky-50/20 border-sky-300 ring-4 ring-sky-500/5" 
                  : "bg-white border-gray-150 hover:bg-slate-50 opacity-90"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-extrabold text-[11px] uppercase text-sky-950">
                  <CalendarDays className="h-4 w-4 text-sky-700" />
                  <span>🔍 BỘ LỌC CÔNG VIỆC</span>
                </div>
                {activeSection === "plans" ? (
                  <span className="text-[9px] font-extrabold bg-sky-105 bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    ĐANG XEM KẾ HOẠCH
                  </span>
                ) : (
                  <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full uppercase">
                    ẨN • NHẤP ĐỂ XEM
                  </span>
                )}
              </div>

              {activeSection === "plans" && (
                <div className="mt-3.5 space-y-3.5 text-xs animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                  <p className="text-[10px] text-gray-500 font-medium font-sans">Sử dụng bộ lọc phân phối công việc dưới đây để tra cứu chi tiết danh mục kế hoạch điểm:</p>
                  
                  {/* Month/Year selector for Plans */}
                  <div className="bg-sky-50/30 border border-sky-100/50 rounded-xl p-2.5 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-sky-800 font-bold">Tháng kế hoạch</label>
                        <select
                          value={selectedMonth}
                          onChange={(e) => setSelectedMonth(Number(e.target.value))}
                          className="border border-sky-200 rounded-lg p-1.5 focus:ring-1 focus:ring-sky-500 bg-white font-bold text-xs text-sky-950 focus:outline-none"
                        >
                          {Array.from({ length: 12 }).map((_, i) => (
                            <option key={i} value={i + 1}>Tháng {i + 1}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-sky-800 font-bold">Năm lưu trữ</label>
                        <select
                          value={selectedYear}
                          onChange={(e) => setSelectedYear(Number(e.target.value))}
                          className="border border-sky-200 rounded-lg p-1.5 focus:ring-1 focus:ring-sky-500 bg-white font-bold text-xs text-sky-950 focus:outline-none"
                        >
                          {[2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032].map(y => (
                            <option key={y} value={y}>Năm {y}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 select-none">
                      <button 
                        type="button"
                        onClick={() => {
                          if (selectedMonth === 1) {
                            setSelectedMonth(12);
                            setSelectedYear(prev => prev - 1);
                          } else {
                            setSelectedMonth(prev => prev - 1);
                          }
                        }}
                        className="p-1.5 hover:bg-sky-100 hover:text-sky-900 border border-sky-200 rounded-lg transition font-extrabold text-[10px] text-center text-sky-800 bg-white cursor-pointer"
                      >
                        « Tháng Trước
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          if (selectedMonth === 12) {
                            setSelectedMonth(1);
                            setSelectedYear(prev => prev + 1);
                          } else {
                            setSelectedMonth(prev => prev + 1);
                          }
                        }}
                        className="p-1.5 hover:bg-sky-100 hover:text-sky-900 border border-sky-200 rounded-lg transition font-extrabold text-[10px] text-center text-sky-800 bg-white cursor-pointer"
                      >
                        Tháng Sau »
                      </button>
                    </div>
                  </div>

                  {/* 1. Filter by assignee name */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-sky-800 font-bold">Lọc theo Cán bộ Phụ trách</label>
                    <select
                      value={filterAssignee}
                      onChange={(e) => setFilterAssignee(e.target.value)}
                      className="border border-sky-200 rounded-lg p-2 focus:ring-1 focus:ring-sky-500 bg-white font-semibold text-gray-800 text-xs"
                    >
                      <option value="all">-- Tất cả cán bộ --</option>
                      {defaultManagers.map((m, i) => (
                        <option key={i} value={m.fullName}>{m.fullName} ({m.role})</option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Filter by status */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-sky-800 font-bold">Trạng thái Phân công</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="border border-sky-200 rounded-lg p-2 focus:ring-1 focus:ring-sky-500 bg-white font-semibold text-gray-800 text-xs shadow-none"
                    >
                      <option value="all">-- Tất cả trạng thái --</option>
                      <option value="overdue">🚨 Quá hạn nộp / Trễ hạn</option>
                      <option value="Đang làm">🔵 Đang làm việc</option>
                      <option value="Cần làm">🟡 Việc cần làm</option>
                      <option value="Đã hoàn thành">✅ Đã hoàn thành</option>
                    </select>
                  </div>

                  {/* 3. Sort picker (Khẩn cấp / Hạn chót / Triệu tập) */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-sky-800 font-bold">Thứ tự Sắp xếp (Thứ ưu tiên)</label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="border border-sky-200 rounded-lg p-2 focus:ring-1 focus:ring-sky-500 bg-sky-55 bg-sky-50 font-bold text-sky-950 text-xs"
                    >
                      <option value="priority">🔥 Độ Khẩn Cấp (Hỏa tốc làm trước)</option>
                      <option value="dueDate">⏰ Hạn Ngoài Gần Nhất (Sắp trễ trước)</option>
                      <option value="dateTime">🕒 Thời Gian Triệu Tập (Hội họp tuần tự)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* QUICK ACTIONS DOCK */}
            {canEdit && !isAdding && (
              <div className="grid grid-cols-2 gap-2 w-full p-2 bg-slate-50 rounded-xl border border-gray-150">
                <button
                  onClick={() => {
                    setIsAdding(true);
                    setNewIsMeeting(true);
                    setActiveSection("meetings");
                  }}
                  className="py-2.5 px-3 border border-rose-200 bg-rose-50/40 hover:bg-rose-50 text-rose-900 rounded-xl text-[11px] font-extrabold cursor-pointer transition flex flex-col items-center justify-center gap-1 shadow-2xs"
                >
                  <PlusCircle className="h-4 w-4 text-rose-700 animate-pulse" />
                  <span>🏛️ Tạo Lịch Họp</span>
                </button>
                <button
                  onClick={() => {
                    setIsAdding(true);
                    setNewIsMeeting(false);
                    setActiveSection("plans");
                  }}
                  className="py-2.5 px-3 border border-sky-200 bg-sky-50/40 hover:bg-sky-50 text-sky-900 rounded-xl text-[11px] font-extrabold cursor-pointer transition flex flex-col items-center justify-center gap-1 shadow-2xs"
                >
                  <PlusCircle className="h-4 w-4 text-sky-700 animate-pulse" />
                  <span>📝 Lập Kế Hoạch</span>
                </button>
              </div>
            )}

            {/* Creating panel - Separate Forms for visual distinctiveness */}
            {isAdding && newIsMeeting && (
              <form onSubmit={handleCreateSchedule} className="bg-white rounded-xl border-t-4 border-t-red-500 border-x border-b border-gray-150 p-4 space-y-3.5 text-xs select-none shadow-md">
                <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <span className="font-extrabold text-red-800 text-[11.5px] uppercase flex items-center gap-1">
                    🏛️ Lên Lịch Họp Hành Chính Mới
                  </span>
                  <button type="button" onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-950 font-bold text-sm bg-gray-50 rounded-full h-5 w-5 flex items-center justify-center cursor-pointer select-none border-0">[×]</button>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700">Tiêu đề cuộc họp (*)</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ví dụ: Họp chi bộ Khu Phố 3 triển khai công tác quý II"
                    className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-red-500 focus:outline-none focus:border-red-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700">Thời gian triệu tập cuộc họp (*)</label>
                  <input
                    type="datetime-local"
                    required
                    value={newDateTime}
                    onChange={(e) => setNewDateTime(e.target.value)}
                    className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-red-500 focus:outline-none focus:border-red-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block font-mono">Định dạng hiển thị: dd/mm/yyyy, thời gian: HH:mm</span>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700">Địa điểm họp</label>
                  <input
                    type="text"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="Ví dụ: Văn phòng Ban điều hành Khu Phố 3"
                    className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-red-500 focus:outline-none focus:border-red-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700">Thành phần mời họp / Tham dự chính</label>
                  <input
                    type="text"
                    value={newAttendees}
                    onChange={(e) => setNewAttendees(e.target.value)}
                    placeholder="Ví dụ: Các Thường trực, Trưởng Ban, Bí thư các Chi bộ bộ phận"
                    className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-red-500 focus:outline-none focus:border-red-500"
                  />
                </div>

                <div className="flex flex-col gap-1 bg-red-50/30 p-2.5 rounded-lg border border-red-100">
                  <label className="font-bold text-red-900 flex items-center gap-1.5">
                    🎯 Đầu mối / Đơn vị tổ chức cuộc họp (*)
                  </label>
                  <select
                    value={newOrganizer}
                    onChange={(e) => setNewOrganizer(e.target.value)}
                    className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-red-500 bg-white text-xs font-bold text-gray-800 focus:outline-none"
                  >
                    <option value="Ban điều hành">Ban điều hành Khu Phố</option>
                    <option value="Chi bộ">Chi bộ Khu Phố 3</option>
                    <option value="Ban công tác Mặt trận">Ban công tác Mặt trận</option>
                    <option value="Chi hội Phụ nữ">Chi hội Phụ nữ</option>
                    <option value="Chi hội Cựu chiến binh">Chi hội Cựu chiến binh</option>
                    <option value="Đoàn Thanh niên">Đoàn Thanh niên</option>
                    <option value="Hội Chữ thập đỏ">Hội Chữ thập đỏ</option>
                    <option value="Công an khu vực">Công an khu vực</option>
                    <option value="Tổ trưởng TDP">Cử đích danh Tổ trưởng TDP</option>
                    <option value="Nguyễn Lâm Hùng (Trưởng Ban điều hành)">Đích danh Nguyễn Lâm Hùng (Trưởng Ban điều hành)</option>
                    <option value="Lê Sĩ Hoàng (Bí thư Chi bộ)">Đích danh Lê Sĩ Hoàng (Bí thư Chi bộ)</option>
                    <option value="Trần Anh Quốc (Công an khu vực)">Đích danh Trần Anh Quốc (Công an khu vực)</option>
                  </select>
                  <input 
                    type="text"
                    placeholder="Hoặc tự nhập đầu mối triệu tập tự do khác..."
                    value={newOrganizer}
                    onChange={(e) => setNewOrganizer(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg p-1.5 mt-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-bold bg-white text-red-950"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    🔥 Mức độ ưu tiên cuộc họp
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-red-500 bg-white font-bold text-xs focus:outline-none"
                  >
                    <option value="Thông thường" className="text-gray-700">📌 Thông thường (Thực hiện tuần tự)</option>
                    <option value="Quan trọng" className="text-amber-700 font-bold">⭐ Quan trọng (Cần báo cáo tham gia đầy đủ)</option>
                    <option value="Khẩn cấp" className="text-rose-700 font-extrabold">🚨 HỎA TỐC / HỌP KHẨN</option>
                  </select>
                </div>

                {/* ADVANCED FIELDS: DEADLINE AND EXTERNAL REFERENCE FILE INFO */}
                <div className="bg-red-50/20 p-3.5 rounded-xl border border-red-100/50 space-y-3.5">
                  <div className="flex items-center gap-1 text-red-800 font-bold text-[10.5px] uppercase">
                    <FolderOpen className="h-4 w-4 text-red-700" /> Tài liệu họp / Công văn hướng dẫn
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-slate-750 text-[11px]">🗓️ Hạn chót xử lý tài liệu liên quan họp (nếu có)</label>
                    <input
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-red-500 bg-white text-xs text-gray-700 focus:outline-none"
                    />
                  </div>

                  {/* 📂 Giao diện tải File từ máy tính / Drag and Drop File Zone */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-[11px] flex items-center gap-1 text-slate-705">
                      <Paperclip className="h-3.5 w-3.5 text-red-700" /> Tải tệp tài liệu họp liên quan lên
                    </label>
                    
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => document.getElementById("meeting-file-input")?.click()}
                      className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 select-none ${
                        isDraggingFile 
                          ? "border-red-600 bg-red-100/10" 
                          : "border-gray-200 hover:border-red-500 bg-white"
                      }`}
                    >
                      <input
                        id="meeting-file-input"
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            processFile(e.target.files[0]);
                          }
                        }}
                      />
                      <Upload className="h-6 w-6 text-red-700 stroke-[1.5]" />
                      <div className="space-y-0.5">
                        <p className="font-bold text-gray-800 text-[11px]">Kéo & thả tập tin hoặc bấm để chọn tệp lý lịch cuộc họp</p>
                        <p className="text-[9.5px] text-gray-400 font-medium">Sao lưu sâu hồ sơ: .txt, .json, .csv, .log...</p>
                      </div>
                    </div>

                    {newExternalDocFileBase64 && (
                      <div className="bg-red-50/50 p-2.5 rounded-lg border border-red-200/50 flex justify-between items-center gap-4 text-[11px] animate-fadeIn">
                        <div className="flex gap-2 items-center min-w-0">
                          <FileText className="h-4 w-4 text-red-800 shrink-0" />
                          <div className="min-w-0 text-left">
                            <p className="font-bold text-red-950 truncate">{newExternalDocName}</p>
                            <p className="text-[10px] text-red-700 font-medium">{newExternalDocFileSize} • {newExternalDocFileType.split('/').pop()?.toUpperCase()}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveAttachedFile}
                          className="px-2 py-1 text-[10px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition cursor-pointer"
                        >
                          Xóa ×
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-slate-705 text-[11px]">📁 Tên / Số kí hiệu văn bản mời họp</label>
                    <input
                      type="text"
                      value={newExternalDocName}
                      onChange={(e) => setNewExternalDocName(e.target.value)}
                      placeholder="Ví dụ: Công văn số 452-UBND về hiếu học"
                      className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-red-500 bg-white text-xs focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center bg-transparent">
                      <label className="font-semibold text-slate-705 text-[11px]">📝 Nội dung tệp đính kèm cuộc họp</label>
                      <button
                        type="button"
                        onClick={handleAiParseExternalText}
                        disabled={loadingParseContent}
                        className="text-[9px] bg-red-800 text-white font-extrabold px-2 py-0.5 rounded-lg hover:bg-red-950 flex items-center gap-0.5 transition"
                      >
                        {loadingParseContent ? "AI..." : "⚡ AI tóm tắt sơ bộ"}
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={newExternalDocContent}
                      onChange={(e) => setNewExternalDocContent(e.target.value)}
                      placeholder="Nội dung họp nguồn..."
                      className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-red-500 focus:outline-none bg-white font-mono text-[10px]"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700">Mô tả chương trình cuộc họp (Agenda)</label>
                  <textarea
                    rows={2}
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Ví dụ: 1. Phát biểu khai mạc; 2. Đóng góp ý kiến của nhân dân; 3. Thảo luận các mục tiêu tổ chức..."
                    className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-red-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 bg-red-50 p-2.5 rounded-lg border border-red-200/50 animate-fadeIn">
                  <input
                    type="checkbox"
                    id="meetingCheckActive"
                    checked={true}
                    readOnly
                    className="rounded text-red-600 focus:ring-red-500 h-3.5 w-3.5 accent-red-600 cursor-not-allowed"
                  />
                  <label htmlFor="meetingCheckActive" className="font-extrabold text-red-900 cursor-pointer text-[10px]">
                    Hệ thống sẽ tự động phát hành mẫu Giấy mời họp chính thức dân phố
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-lg font-bold text-xs cursor-pointer transition flex items-center justify-center gap-1 shadow-sm"
                >
                  🏛️ HOÀN TẤT LÊN LỊCH & TRIỆU TẬP HỌP
                </button>
              </form>
            )}

            {isAdding && !newIsMeeting && (
              <form onSubmit={handleCreateSchedule} className="bg-white rounded-xl border-t-4 border-t-sky-500 border-x border-b border-gray-150 p-4 space-y-3.5 text-xs select-none shadow-sm">
                <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <span className="font-extrabold text-sky-800 text-[11.5px] uppercase flex items-center gap-1">
                    📝 Lập Kế Hoạch Tổ Chức Công Tác
                  </span>
                  <button type="button" onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-950 font-bold text-sm bg-gray-50 rounded-full h-5 w-5 flex items-center justify-center cursor-pointer select-none border-0">[×]</button>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700">Tiêu đề kế hoạch công tác (*)</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ví dụ: Kế hoạch phối hợp dọn dẹp vệ sinh phòng chống sốt xuất huyết"
                    className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-sky-500 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700">Thời gian triệu tập / triển khai (*)</label>
                  <input
                    type="datetime-local"
                    required
                    value={newDateTime}
                    onChange={(e) => setNewDateTime(e.target.value)}
                    className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-sky-500 focus:outline-none focus:border-sky-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block font-mono">Định dạng hiển thị: dd/mm/yyyy, thời gian: HH:mm</span>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700">Vị trí thực địa / Đơn vị triển khai</label>
                  <input
                    type="text"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="Ví dụ: Địa bàn Tổ dân phố 10, 11 và 12 Khu Phố 3"
                    className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-sky-500 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700">Lực lượng tham gia / Bên phối hợp</label>
                  <input
                    type="text"
                    value={newAttendees}
                    onChange={(e) => setNewAttendees(e.target.value)}
                    placeholder="Ví dụ: Ban điều hành, chi hội Phụ nữ, Đoàn thanh niên tự quản"
                    className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-sky-500 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="flex flex-col gap-1 bg-sky-50/30 p-2.5 rounded-lg border border-sky-100">
                  <label className="font-bold text-sky-900 flex items-center gap-1.5">
                    🎯 Đơn vị chủ trì / Người chịu trách nhiệm chính (*)
                  </label>
                  <select
                    value={newOrganizer}
                    onChange={(e) => setNewOrganizer(e.target.value)}
                    className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-sky-500 bg-white text-xs font-bold text-gray-800 focus:outline-none"
                  >
                    <option value="Ban điều hành">Ban điều hành Khu Phố</option>
                    <option value="Chi bộ">Chi bộ Khu Phố 3</option>
                    <option value="Ban công tác Mặt trận">Ban công tác Mặt trận</option>
                    <option value="Chi hội Phụ nữ">Chi hội Phụ nữ</option>
                    <option value="Chi hội Cựu chiến binh">Chi hội Cựu chiến binh</option>
                    <option value="Đoàn Thanh niên">Đoàn Thanh niên</option>
                    <option value="Hội Chữ thập đỏ">Hội Chữ thập đỏ</option>
                    <option value="Công an khu vực">Công an khu vực</option>
                    <option value="Tổ trưởng TDP">Cử đích danh Tổ trưởng TDP</option>
                    <option value="Nguyễn Lâm Hùng (Trưởng Ban điều hành)">Đích danh Nguyễn Lâm Hùng (Trưởng Ban điều hành)</option>
                    <option value="Lê Sĩ Hoàng (Bí thư Chi bộ)">Đích danh Lê Sĩ Hoàng (Bí thư Chi bộ)</option>
                    <option value="Trần Anh Quốc (Công an khu vực)">Đích danh Trần Anh Quốc (Công an khu vực)</option>
                  </select>
                  <input 
                    type="text"
                    placeholder="Hoặc gõ chi tiết người xử lý / phụ trách..."
                    value={newOrganizer}
                    onChange={(e) => setNewOrganizer(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg p-1.5 mt-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 font-bold bg-white text-sky-950"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    🔥 Chỉ tiêu khẩn cấp & Độ ưu tiên công tác
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-sky-500 bg-white font-bold text-xs focus:outline-none"
                  >
                    <option value="Thông thường" className="text-gray-700">📌 Thông thường (Thực hiện tuần tự)</option>
                    <option value="Quan trọng" className="text-amber-700 font-bold">⭐ Quan trọng (Đẩy mạnh giám sát sát sao)</option>
                    <option value="Khẩn cấp" className="text-rose-700 font-extrabold">🚨 QUYẾT LIỆT / LÀM NGAY</option>
                  </select>
                </div>

                {/* ADVANCED FIELDS: DEADLINE AND EXTERNAL REFERENCE FILE INFO */}
                <div className="bg-sky-50/20 p-3.5 rounded-xl border border-sky-100/50 space-y-3.5">
                  <div className="flex items-center gap-1 text-sky-800 font-bold text-[10.5px] uppercase">
                    <FolderOpen className="h-4 w-4 text-sky-700" /> Văn bản chỉ thị / Quyết định liên quan
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-slate-700 text-[11px]">🗓️ Thời hạn hoàn tất kế hoạch (dueDate) (*)</label>
                    <input
                      type="date"
                      required
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-sky-500 bg-white text-xs text-gray-700 focus:outline-none"
                    />
                  </div>

                  {/* 📂 Giao diện tải File từ máy tính / Drag and Drop File Zone */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-[11px] flex items-center gap-1 text-slate-705">
                      <Paperclip className="h-3.5 w-3.5 text-sky-700" /> Tải tệp tài liệu kế hoạch gốc lên
                    </label>
                    
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => document.getElementById("plan-file-input")?.click()}
                      className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 select-none ${
                        isDraggingFile 
                          ? "border-sky-600 bg-sky-100/10" 
                          : "border-gray-200 hover:border-sky-500 bg-white"
                      }`}
                    >
                      <input
                        id="plan-file-input"
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            processFile(e.target.files[0]);
                          }
                        }}
                      />
                      <Upload className="h-6 w-6 text-sky-700 stroke-[1.5]" />
                      <div className="space-y-0.5">
                        <p className="font-bold text-gray-800 text-[11px]">Kéo & thả tập tin hoặc bấm để chọn tệp chỉ đạo</p>
                        <p className="text-[9.5px] text-gray-400 font-medium">Sao lưu sâu hồ sơ: .txt, .json, .csv, tuyển tập kế hoạch...</p>
                      </div>
                    </div>

                    {newExternalDocFileBase64 && (
                      <div className="bg-sky-50/50 p-2.5 rounded-lg border border-sky-200/50 flex justify-between items-center gap-4 text-[11px] animate-fadeIn">
                        <div className="flex gap-2 items-center min-w-0">
                          <FileText className="h-4 w-4 text-sky-800 shrink-0" />
                          <div className="min-w-0 text-left">
                            <p className="font-bold text-sky-950 truncate">{newExternalDocName}</p>
                            <p className="text-[10px] text-sky-700 font-medium">{newExternalDocFileSize} • {newExternalDocFileType.split('/').pop()?.toUpperCase()}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveAttachedFile}
                          className="px-2 py-1 text-[10px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition cursor-pointer"
                        >
                          Xóa ×
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-slate-705 text-[11px]">📁 Tên / Số hiệu văn bản quy định của Phường</label>
                    <input
                      type="text"
                      value={newExternalDocName}
                      onChange={(e) => setNewExternalDocName(e.target.value)}
                      placeholder="Ví dụ: Công văn số 452-UBND về hiếu học"
                      className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-sky-500 bg-white text-xs focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center bg-transparent">
                      <label className="font-semibold text-slate-705 text-[11px]">📝 Nội dung quyết định, văn bản nguồn</label>
                      <button
                        type="button"
                        onClick={handleAiParseExternalText}
                        disabled={loadingParseContent}
                        className="text-[9px] bg-sky-800 text-white font-extrabold px-2 py-0.5 rounded-lg hover:bg-sky-950 flex items-center gap-0.5 transition"
                      >
                        {loadingParseContent ? "AI..." : "⚡ AI tóm tắt sơ bộ"}
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={newExternalDocContent}
                      onChange={(e) => setNewExternalDocContent(e.target.value)}
                      placeholder="Tóm lược kế hoạch..."
                      className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-sky-500 focus:outline-none bg-white font-mono text-[10px]"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700">Các chỉ tiêu hoặc mục tiêu kế hoạch chi tiết</label>
                  <textarea
                    rows={2}
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Ví dụ: Đạt chỉ tiêu dọn dẹp khai thông tuyến thoát nước chống bùng dịch sốt xuất huyết..."
                    className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold text-xs cursor-pointer transition flex items-center justify-center gap-1 shadow-sm"
                >
                  📝 ĐĂNG KÝ PHÊ DUYỆT KẾ HOẠCH HÀNH SỰ
                </button>
              </form>
            )}
          </div>

          {/* List of schedules & action center */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* 🏛️ TABLE 1: MEETING SCHEDULES OF THE SELECTED MONTH */}
            {activeSection === "meetings" && (
              <div className="bg-white rounded-2xl border border-slate-150 p-5 space-y-4 shadow-sm">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-red-50 text-red-700 rounded-lg">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-gray-850 tracking-tight uppercase flex items-center gap-1.5">
                      🏛️ Bảng Lịch Họp Tổ Chức Hành Chính
                    </h3>
                    <p className="text-[10px] text-gray-400 font-medium font-sans">
                      {viewType === "agenda" 
                        ? `Lịch họp trong ngày hôm nay (${(() => {
                            const today = new Date();
                            return `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
                          })()})` 
                        : viewType === "week" 
                        ? `Lịch họp trong tuần (${(() => {
                            const endWeek = new Date(weekStartDate);
                            endWeek.setDate(weekStartDate.getDate() + 6);
                            return `${String(weekStartDate.getDate()).padStart(2, '0')}/${String(weekStartDate.getMonth() + 1).padStart(2, '0')} - ${String(endWeek.getDate()).padStart(2, '0')}/${String(endWeek.getMonth() + 1).padStart(2, '0')}`;
                          })()})`
                        : `Lịch họp riêng phân chia theo đầu mối, đại diện tham dự (Tháng ${selectedMonth}/${selectedYear})`
                      }
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-red-800 px-2.5 py-1 bg-red-50 rounded-xl">
                  {(() => {
                    const monthlyMeetings = sortedSchedules.filter(s => {
                      if (!s.isMeeting) return false;
                      if (viewType === "agenda") {
                        const today = new Date();
                        const d = new Date(s.dateTime);
                        return d.getDate() === today.getDate() && (d.getMonth() + 1) === (today.getMonth() + 1) && d.getFullYear() === today.getFullYear();
                      } else if (viewType === "week") {
                        const d = new Date(s.dateTime);
                        const start = new Date(weekStartDate);
                        start.setHours(0, 0, 0, 0);
                        const end = new Date(start);
                        end.setDate(start.getDate() + 7);
                        return d >= start && d < end;
                      } else {
                        const d = new Date(s.dateTime);
                        return (d.getMonth() + 1) === selectedMonth && d.getFullYear() === selectedYear;
                      }
                    });
                    return `${monthlyMeetings.length} lịch họp`;
                  })()}
                </span>
              </div>
              
              <div className="space-y-4 text-xs">
                {(() => {
                  const monthlyMeetings = sortedSchedules.filter(s => {
                    if (!s.isMeeting) return false;
                    if (viewType === "agenda") {
                      const today = new Date();
                      const d = new Date(s.dateTime);
                      return d.getDate() === today.getDate() && (d.getMonth() + 1) === (today.getMonth() + 1) && d.getFullYear() === today.getFullYear();
                    } else if (viewType === "week") {
                      const d = new Date(s.dateTime);
                      const start = new Date(weekStartDate);
                      start.setHours(0, 0, 0, 0);
                      const end = new Date(start);
                      end.setDate(start.getDate() + 7);
                      return d >= start && d < end;
                    } else {
                      const d = new Date(s.dateTime);
                      return (d.getMonth() + 1) === selectedMonth && d.getFullYear() === selectedYear;
                    }
                  });

                  if (monthlyMeetings.length === 0) {
                    return (
                      <div className="py-8 text-center text-gray-400 border border-dashed rounded-xl flex flex-col items-center justify-center p-4">
                        <Users className="h-6 w-6 text-gray-350 mb-1" />
                        <p className="font-bold text-[11px] text-gray-400">
                          {viewType === "agenda"
                            ? "Không có lịch họp hành chính nào diễn ra trong hôm nay."
                            : viewType === "week"
                            ? "Không có lịch họp hành chính nào diễn ra trong tuần này."
                            : `Chưa phát sinh lịch họp hành chính nào trong tháng ${selectedMonth}/${selectedYear}.`
                          }
                        </p>
                        {canEdit && (
                          <button 
                            type="button"
                            onClick={() => { setIsAdding(true); setNewIsMeeting(true); }}
                            className="mt-2 text-[10px] text-emerald-700 font-bold hover:underline bg-transparent border-0 cursor-pointer"
                          >
                            + Lên lịch họp hành phát sinh ngay »
                          </button>
                        )}
                      </div>
                    );
                  }

                  return monthlyMeetings.map(sch => {
                    const dateObj = new Date(sch.dateTime);
                    const displayTime = `${formatDate(sch.dateTime)} - ${formatTimeHM(sch.dateTime)}`;
                    const isPast = dateObj.getTime() < Date.now();
                    const pendingTasksCount = (sch.assignments || []).filter(a => a.status !== "Đã hoàn thành").length;
                    
                    const isOverdue = !sch.isCompleted && sch.dueDate ? sch.dueDate < todayStr && (sch.assignments?.some(a => a.status !== "Đã hoàn thành") || !sch.assignments || sch.assignments.length === 0) : false;

                    // Smart resolve primary organizer
                    const displayOrganizer = sch.organizer || (sch.attendees?.includes("Chi bộ") ? "Chi bộ Khu Phố 3" : (sch.attendees?.includes("Mặt trận") ? "Ban công tác Mặt trận" : "Ban điều hành Khu Phố"));

                    let priorityBorder = sch.isCompleted 
                      ? "border-l-4 border-l-emerald-650 bg-emerald-50/10 hover:bg-emerald-50/20"
                      : "border-l-4 border-l-emerald-500 bg-white hover:bg-emerald-50/5";
                    if (!sch.isCompleted) {
                      if (sch.priority === "Khẩn cấp") {
                        priorityBorder = "border-l-4 border-l-rose-600 bg-rose-50/5 hover:bg-rose-50/10 ring-1 ring-rose-900/5";
                      } else if (sch.priority === "Quan trọng") {
                        priorityBorder = "border-l-4 border-l-amber-500 bg-amber-50/5 hover:bg-amber-50/10 ring-1 ring-amber-900/5";
                      }
                    }

                    return (
                      <div
                        key={sch.id}
                        onClick={() => {
                          setSelectedSch(sch);
                          setSimMessage("");
                          setAiSuggestions([]);
                        }}
                        className={`border p-4 rounded-xl cursor-pointer transition flex flex-col md:flex-row justify-between items-start gap-4 ${selectedSch?.id === sch.id ? "border-emerald-500 bg-emerald-50/15 ring-2 ring-emerald-500/10-custom" : priorityBorder}`}
                      >
                        <div className="space-y-3 flex-1 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* PRIORITY INDICATION BADGES */}
                            <span className="px-2 py-0.5 bg-indigo-600 text-white text-[8.5px] font-extrabold rounded-md flex items-center gap-1 shadow-xs">
                              📍 ĐẦU MỐI: {displayOrganizer}
                            </span>

                            {sch.isCompleted ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const updated = { ...sch, isCompleted: false };
                                  saveScheduleUpdate(updated);
                                  setSelectedSch(updated);
                                }}
                                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[8px] font-extrabold rounded-md inline-flex items-center gap-0.5 transition cursor-pointer select-none"
                                title="Bấm để chuyển về Chưa hoàn tất"
                              >
                                ✅ ĐÃ HOÀN THÀNH (HỦY)
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const updated = { ...sch, isCompleted: true };
                                  saveScheduleUpdate(updated);
                                  setSelectedSch(updated);
                                }}
                                className="px-2 py-0.5 bg-slate-150 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-300 text-slate-700 text-[8px] font-bold rounded-md inline-flex items-center gap-0.5 transition cursor-pointer select-none"
                                title="Báo cáo hoàn tất lịch họp này"
                              >
                                ⬜ BÁO HOÀN THÀNH
                              </button>
                            )}

                            {sch.priority === "Khẩn cấp" && !sch.isCompleted && (
                              <span className="px-2 py-0.5 bg-rose-600 text-white text-[8.5px] font-extrabold rounded-md flex items-center gap-0.5 animate-pulse shadow-xs">
                                🔥 KHẨN CẤP / LÀM NGAY
                              </span>
                            )}
                            {sch.priority === "Quan trọng" && !sch.isCompleted && (
                              <span className="px-2 py-0.5 bg-amber-500 text-white text-[8.5px] font-bold rounded-md flex items-center gap-0.5">
                                ⭐ QUAN TRỌNG
                              </span>
                            )}
                            {(!sch.priority || sch.priority === "Thông thường") && !sch.isCompleted && (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[8.5px] font-medium rounded-md">
                                📌 Thường nhật
                              </span>
                            )}

                            {isOverdue && (
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-700 border border-rose-200 text-[8.5px] font-extrabold rounded uppercase flex items-center gap-0.5 animate-pulse">
                                <AlertTriangle className="h-2.5 w-2.5" /> Quá hạn xử lý!
                              </span>
                            )}

                            {sch.dueDate && !isOverdue && (
                              <span className="px-2 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 text-[8.5px] font-bold rounded">
                                Hạn xử lý: {sch.dueDate}
                              </span>
                            )}

                            {isPast && (
                              <span className="text-[8.5px] font-semibold text-gray-400">Đã diễn ra kì trước</span>
                            )}

                            {sch.externalDocName && (
                              <span className="px-1.5 py-0.5 bg-emerald-50/60 border border-emerald-100 text-[8.5px] text-emerald-800 font-bold rounded flex items-center gap-0.5">
                                <FileText className="h-2.5 w-2.5" /> Có Công Văn ngoài
                              </span>
                            )}
                          </div>

                          <h4 className="text-[12.5px] font-extrabold text-gray-900 leading-tight flex flex-wrap items-center gap-1.5">
                            {sch.priority === "Khẩn cấp" && <span className="text-rose-600 font-extrabold">🚨</span>}
                            <span className="text-red-800 bg-red-100/60 px-1.5 py-0.5 rounded text-[9.5px] font-extrabold tracking-tight uppercase border border-red-200 shrink-0">Lịch họp:</span>
                            <span>{sch.title}</span>
                          </h4>
                          
                          <div className="text-[11px] text-gray-500 space-y-1">
                            <p className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-gray-400" /> <span className="text-gray-700 font-medium">{displayTime}</span></p>
                            <p className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-gray-400" /> {sch.location}</p>
                            <p className="flex items-center gap-1"><Users className="h-3.5 w-3.5 text-gray-400" /> <span className="text-slate-900 font-bold">Thành phần tham dự:</span> {sch.attendees}</p>
                          </div>
                        </div>

                        {canEdit && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDeleteSchedule(sch.id); }}
                            className="text-gray-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-100 transition shrink-0 self-end md:self-start cursor-pointer bg-transparent border-0"
                            title="Xóa lịch họp phát sinh"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

            {/* 📝 TABLE 2: ACTION PLANS OF THE SELECTED MONTH */}
            {activeSection === "plans" && (
              <div className="bg-white rounded-2xl border border-slate-150 p-5 space-y-4 shadow-sm">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-sky-50 text-sky-700 rounded-lg">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-gray-801 tracking-tight uppercase flex items-center gap-1.5">
                      📝 Kế Hoạch Tổ Chức Công Tác Điểm
                    </h3>
                    <p className="text-[10px] text-gray-400 font-medium">Bảng kế hoạch hành sự, chỉ tiêu người xử lý đích danh (Tháng {`${selectedMonth}/${selectedYear}`})</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-sky-800 px-2.5 py-1 bg-sky-50 rounded-xl">
                  {(() => {
                    const monthlyPlans = sortedSchedules.filter(s => {
                      const d = new Date(s.dateTime);
                      return !s.isMeeting && (d.getMonth() + 1) === selectedMonth && d.getFullYear() === selectedYear;
                    });
                    return `${monthlyPlans.length} kế hoạch`;
                  })()}
                </span>
              </div>

              {/* Integrated Filters bar directly inside the Plans list to keep it extremely intuitive */}
              <div className="bg-sky-50/50 border border-sky-100/50 rounded-xl p-3 flex flex-wrap gap-3 items-center justify-between text-xs select-none">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse"></span>
                  <span className="font-extrabold text-sky-950 text-[10px] uppercase tracking-wider">Bộ lọc tích hợp:</span>
                </div>
                
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-sky-900 font-extrabold uppercase">Cán bộ:</span>
                    <select
                      value={filterAssignee}
                      onChange={(e) => setFilterAssignee(e.target.value)}
                      className="border border-sky-200 rounded-lg p-1.5 focus:ring-1 focus:ring-sky-500 bg-white font-bold text-gray-850 text-[11px] focus:outline-none focus:outline-0 cursor-pointer"
                    >
                      <option value="all">-- Tất cả cán bộ --</option>
                      {defaultManagers.map((m, i) => (
                        <option key={i} value={m.fullName}>{m.fullName} ({m.role})</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-sky-900 font-extrabold uppercase">Trạng thái:</span>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="border border-sky-200 rounded-lg p-1.5 focus:ring-1 focus:ring-sky-500 bg-white font-bold text-gray-850 text-[11px] focus:outline-none focus:outline-0 cursor-pointer"
                    >
                      <option value="all">-- Tất cả trạng thái --</option>
                      <option value="overdue">🚨 Quá hạn nộp / Trễ hạn</option>
                      <option value="Đang làm">🔵 Đang làm việc</option>
                      <option value="Cần làm">🟡 Việc cần làm</option>
                      <option value="Đã hoàn thành">✅ Đã hoàn thành</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-4 text-xs">
                {(() => {
                  const monthlyPlans = sortedSchedules.filter(s => {
                    const d = new Date(s.dateTime);
                    return !s.isMeeting && (d.getMonth() + 1) === selectedMonth && d.getFullYear() === selectedYear;
                  });

                  if (monthlyPlans.length === 0) {
                    return (
                      <div className="py-8 text-center text-gray-400 border border-dashed rounded-xl flex flex-col items-center justify-center p-4">
                        <FileText className="h-6 w-6 text-gray-300 mb-1" />
                        <p className="font-bold text-[11px] text-gray-400">Chưa phát sinh kế hoạch công tác nào trong tháng {`${selectedMonth}/${selectedYear}`}.</p>
                        {canEdit && (
                          <button 
                            type="button"
                            onClick={() => { setIsAdding(true); setNewIsMeeting(false); }}
                            className="mt-2 text-[10px] text-emerald-700 font-bold hover:underline bg-transparent border-0 cursor-pointer"
                          >
                            + Lên kế hoạch phát sinh mới »
                          </button>
                        )}
                      </div>
                    );
                  }

                  return monthlyPlans.map(sch => {
                    const dateObj = new Date(sch.dateTime);
                    const displayTime = `${formatDate(sch.dateTime)} - ${formatTimeHM(sch.dateTime)}`;
                    const isPast = dateObj.getTime() < Date.now();
                    const isOverdue = !sch.isCompleted && sch.dueDate ? sch.dueDate < todayStr && (sch.assignments?.some(a => a.status !== "Đã hoàn thành") || !sch.assignments || sch.assignments.length === 0) : false;

                    // Smart resolve primary organizer
                    const displayOrganizer = sch.organizer || (sch.attendees?.includes("Chi bộ") ? "Chi bộ Khu Phố 3" : (sch.attendees?.includes("Mặt trận") ? "Ban công tác Mặt trận" : "Ban điều hành Khu Phố"));

                    let priorityBorder = sch.isCompleted 
                      ? "border-l-4 border-l-emerald-650 bg-emerald-50/10 hover:bg-emerald-50/20"
                      : "border-l-4 border-l-emerald-500 bg-white hover:bg-emerald-50/5";
                    if (!sch.isCompleted) {
                      if (sch.priority === "Khẩn cấp") {
                        priorityBorder = "border-l-4 border-l-rose-600 bg-rose-50/5 hover:bg-rose-50/10 ring-1 ring-rose-900/5";
                      } else if (sch.priority === "Quan trọng") {
                        priorityBorder = "border-l-4 border-l-amber-500 bg-amber-50/5 hover:bg-amber-50/10 ring-1 ring-amber-900/5";
                      }
                    }

                    const totalTasks = sch.assignments?.length || 0;
                    const doneTasks = sch.assignments?.filter(a => a.status === "Đã hoàn thành").length || 0;
                    const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

                    return (
                      <div
                        key={sch.id}
                        onClick={() => {
                          setSelectedSch(sch);
                          setSimMessage("");
                          setAiSuggestions([]);
                        }}
                        className={`border p-4 rounded-xl cursor-pointer transition flex flex-col md:flex-row justify-between items-start gap-4 ${selectedSch?.id === sch.id ? "border-emerald-500 bg-emerald-50/15 ring-2 ring-emerald-500/10-custom" : priorityBorder}`}
                      >
                        <div className="space-y-3 flex-1 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 bg-emerald-700 text-white text-[8.5px] font-extrabold rounded-md shadow-xs">
                              🎯 NGƯỜI XỬ LÝ CHÍNH: {displayOrganizer}
                            </span>

                            {sch.isCompleted ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const updated = { ...sch, isCompleted: false };
                                  saveScheduleUpdate(updated);
                                  setSelectedSch(updated);
                                }}
                                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[8px] font-extrabold rounded-md inline-flex items-center gap-0.5 transition cursor-pointer select-none"
                                title="Bấm để chuyển về Chưa hoàn tất"
                              >
                                ✅ ĐÃ HOÀN THÀNH (HỦY)
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const updated = { ...sch, isCompleted: true };
                                  saveScheduleUpdate(updated);
                                  setSelectedSch(updated);
                                }}
                                className="px-2 py-0.5 bg-slate-150 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-300 text-slate-700 text-[8px] font-bold rounded-md inline-flex items-center gap-0.5 transition cursor-pointer select-none"
                                title="Báo cáo hoàn tất kế hoạch công tác này"
                              >
                                ⬜ BÁO HOÀN THÀNH
                              </button>
                            )}

                            {sch.priority === "Khẩn cấp" && !sch.isCompleted && (
                              <span className="px-2 py-0.5 bg-rose-600 text-white text-[8.5px] font-extrabold rounded-md flex items-center gap-0.5 animate-pulse shadow-xs">
                                🔥 KHẨN CẤP / LÀM NGAY
                              </span>
                            )}
                            {sch.priority === "Quan trọng" && !sch.isCompleted && (
                              <span className="px-2 py-0.5 bg-amber-500 text-white text-[8.5px] font-bold rounded-md flex items-center gap-0.5">
                                ⭐ QUAN TRỌNG
                              </span>
                            )}
                            {(!sch.priority || sch.priority === "Thông thường") && !sch.isCompleted && (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[8.5px] font-medium rounded-md">
                                📌 Thường nhật
                              </span>
                            )}

                            {isOverdue && (
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-700 border border-rose-200 text-[8.5px] font-extrabold rounded uppercase flex items-center gap-0.5 animate-pulse">
                                <AlertTriangle className="h-2.5 w-2.5" /> Quá hạn xử lý!
                              </span>
                            )}

                            {sch.dueDate && !isOverdue && (
                              <span className="px-2 py-0.5 bg-teal-50 text-teal-850 border border-teal-200 text-[8.5px] font-bold rounded">
                                Hạn xử lý: {sch.dueDate}
                              </span>
                            )}

                            {isPast && (
                              <span className="text-[8.5px] font-semibold text-gray-400">Đã diễn ra kì trước</span>
                            )}

                            {sch.externalDocName && (
                              <span className="px-1.5 py-0.5 bg-emerald-50/60 border border-emerald-100 text-[8.5px] text-emerald-800 font-bold rounded flex items-center gap-0.5">
                                <FileText className="h-2.5 w-2.5" /> Có Công Văn ngoài
                              </span>
                            )}
                          </div>

                          <h4 className="text-[12.5px] font-extrabold text-gray-900 leading-tight flex flex-wrap items-center gap-1.5">
                            {sch.priority === "Khẩn cấp" && <span className="text-rose-600 font-extrabold">🚨</span>}
                            <span className="text-sky-800 bg-sky-100/60 px-1.5 py-0.5 rounded text-[9.5px] font-extrabold tracking-tight uppercase border border-sky-200 shrink-0">Kế hoạch:</span>
                            <span>{sch.title}</span>
                          </h4>
                          
                          <div className="text-[11px] text-gray-500 space-y-1">
                            <p className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-gray-400" /> <span className="text-gray-700 font-medium">{displayTime}</span></p>
                            <p className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-gray-400" /> {sch.location}</p>
                          </div>

                          {/* MICRO PROGRESS BAR TRACKER FOR DELEGATED ACTIONS */}
                          {totalTasks > 0 && (
                            <div className="pt-2.5 border-t border-gray-100 space-y-1.5">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="font-bold text-gray-700 uppercase tracking-wider">Tiến trình phân việc:</span>
                                <span className="font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded-md">{`${doneTasks}/${totalTasks}`} đã hoàn thành ({progressPct}%)</span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    progressPct === 100 ? "bg-emerald-600" : (progressPct >= 50 ? "bg-blue-600" : "bg-amber-500")
                                  }`}
                                  style={{ width: `${progressPct}%` }}
                                ></div>
                              </div>
                            </div>
                          )}

                          {/* MINI ASSIGNMENT TRACKER SHOWN IN CARD */}
                          {sch.assignments && sch.assignments.length > 0 && (
                            <div className="pt-2 border-t border-dashed border-gray-100 flex flex-wrap gap-2">
                              {sch.assignments.map(asg => {
                                let badgeColor = "bg-amber-50 text-amber-700 border-amber-200";
                                if (asg.status === "Đang làm") badgeColor = "bg-blue-50 text-blue-700 border-blue-200";
                                if (asg.status === "Đã hoàn thành") badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
                                if (asg.status === "Trễ hạn") badgeColor = "bg-rose-50 text-rose-700 border-rose-205";

                                return (
                                  <span key={asg.id} className={`px-2 py-0.5 rounded-lg border text-[9.5px] font-semibold flex items-center gap-1 ${badgeColor}`}>
                                    <span className="font-extrabold">{asg.assigneeName}:</span> {asg.task.length > 22 ? asg.task.substring(0, 22) + "..." : asg.task} ({asg.status})
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {canEdit && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDeleteSchedule(sch.id); }}
                            className="text-gray-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-100 transition shrink-0 self-end md:self-start cursor-pointer bg-transparent border-0"
                            title="Xóa kế hoạch phát sinh"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}


            {/* DETAILED ACTION AND ASSIGNMENT CONTROL BOARD FOR SELECTED SCHEDULE */}
            {selectedSch && (
              <div className="bg-white rounded-xl border border-emerald-100 p-5 space-y-5 shadow-xs select-text">
                {isEditing ? (
                  // CHẾ ĐỘ SỬA ĐỐI VỚI THAY ĐỔI TỪ CẤP TRÊN
                  <form onSubmit={handleSaveEditSchedule} className="space-y-4 text-xs select-none">
                    <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                      <div>
                        <span className="px-2 py-0.5 bg-blue-105 bg-blue-100 text-blue-800 rounded font-bold text-[9px] uppercase">
                          Chế độ Chỉnh sửa Thay đổi từ Cấp Trên
                        </span>
                        <h4 className="text-[12.5px] font-extrabold text-blue-900 mt-1 uppercase">SỬA SỰ VỤ: {selectedSch.title}</h4>
                      </div>
                      <button type="button" onClick={() => setIsEditing(false)} className="text-[10px] bg-slate-50 hover:bg-slate-100 border text-gray-500 font-bold px-2 py-1 rounded-md cursor-pointer">Hủy ×</button>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-bold text-slate-705">Tiêu đề lịch/kế hoạch (*)</label>
                      <input
                        type="text"
                        required
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="border border-gray-250 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 bg-white font-bold text-gray-800 text-xs focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-slate-755">Thời gian triển khai (*)</label>
                        <input
                          type="datetime-local"
                          required
                          value={editDateTime}
                          onChange={(e) => setEditDateTime(e.target.value)}
                          className="border border-gray-250 bg-white rounded-lg p-2 focus:ring-1 focus:ring-blue-500 text-xs focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-500 mt-0.5 block font-mono">Định dạng hiển thị: dd/mm/yyyy, thời gian: HH:mm</span>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-slate-705">Thời hạn xử lý (dueDate)</label>
                        <input
                          type="date"
                          value={editDueDate}
                          onChange={(e) => setEditDueDate(e.target.value)}
                          className="border border-gray-250 bg-white rounded-lg p-2 focus:ring-1 focus:ring-blue-500 text-xs text-gray-700 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-bold text-slate-705">Địa điểm / Vị trí thực chiến</label>
                      <input
                        type="text"
                        value={editLocation}
                        onChange={(e) => setEditLocation(e.target.value)}
                        className="border border-gray-250 bg-white rounded-lg p-2 focus:ring-1 focus:ring-blue-500 text-xs focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-bold text-slate-705 col-span-2">Thành phần tham dự / Lực lượng phối hợp</label>
                      <input
                        type="text"
                        value={editAttendees}
                        onChange={(e) => setEditAttendees(e.target.value)}
                        className="border border-gray-250 bg-white rounded-lg p-2 focus:ring-1 focus:ring-blue-500 text-xs focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-slate-705">Độ khẩn & Thứ tự ưu tiên</label>
                        <select
                          value={editPriority}
                          onChange={(e) => setEditPriority(e.target.value as any)}
                          className="border border-gray-250 bg-white rounded-lg p-2 focus:ring-1 focus:ring-blue-500 text-xs font-bold text-slate-800 focus:outline-none"
                        >
                          <option value="Thông thường">📌 Thông thường (Làm tuần tự)</option>
                          <option value="Quan trọng">⭐ Quan trọng (Giám sát sát sao)</option>
                          <option value="Khẩn cấp">🚨 QUYẾT LIỆT / LÀM NGAY</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-slate-705">Đơn vị chủ trì / Người phụ trách chính</label>
                        <select
                          value={editOrganizer}
                          onChange={(e) => setEditOrganizer(e.target.value)}
                          className="border border-gray-250 bg-white rounded-lg p-2 focus:ring-1 focus:ring-blue-500 text-xs font-bold text-slate-800 focus:outline-none"
                        >
                          <option value="Ban điều hành">Ban điều hành Khu Phố</option>
                          <option value="Chi bộ">Chi bộ Khu Phố 3</option>
                          <option value="Ban công tác Mặt trận">Ban công tác Mặt trận</option>
                          <option value="Chi hội Phụ nữ">Chi hội Phụ nữ</option>
                          <option value="Chi hội Cựu chiến binh">Chi hội Cựu chiến binh</option>
                          <option value="Đoàn Thanh niên">Đoàn Thanh niên</option>
                          <option value="Hội Chữ thập đỏ">Hội Chữ thập đỏ</option>
                          <option value="Công an khu vực">Công an khu vực</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-bold text-slate-705">Nội dung / Chỉ tiêu cốt lõi</label>
                      <textarea
                        rows={3}
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        className="border border-gray-250 bg-white rounded-lg p-2 focus:ring-1 focus:ring-blue-500 text-xs font-sans focus:outline-none"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="w-1/2 py-2.5 border border-gray-200 hover:bg-slate-50 rounded-xl text-gray-500 font-bold transition text-center select-none cursor-pointer"
                      >
                        HỦY THAY ĐỔI
                      </button>
                      <button
                        type="submit"
                        className="w-1/2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition text-center select-none cursor-pointer shadow-sm"
                      >
                        💾 LƯU CẬP NHẬT GẤP
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex justify-between items-start border-b border-gray-100 pb-3">
                      <div>
                        <div className="flex items-center gap-1.5 bg-transparent select-none">
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[9px] uppercase">Bản điều khiển vị trí sự vụ</span>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditTitle(selectedSch.title);
                                setEditDateTime(selectedSch.dateTime);
                                setEditLocation(selectedSch.location || "");
                                setEditAttendees(selectedSch.attendees || "");
                                setEditDesc(selectedSch.description || "");
                                setEditPriority(selectedSch.priority || "Thông thường");
                                setEditOrganizer(selectedSch.organizer || "Ban điều hành");
                                setEditDueDate(selectedSch.dueDate || "");
                                setIsEditing(true);
                              }}
                              className="px-2 py-0.5 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-900 rounded font-extrabold text-[8.5px] uppercase transition cursor-pointer flex items-center gap-0.5"
                            >
                              ✏️ Sửa công tác
                            </button>
                          )}
                        </div>
                        <h4 className="text-[12.5px] font-extrabold text-gray-900 uppercase mt-1 flex flex-wrap items-center gap-1.5">
                          {selectedSch.isMeeting ? (
                            <span className="bg-red-100 text-red-900 border border-red-200 px-1.5 py-0.5 rounded text-[9.5px] font-black uppercase shrink-0">Lịch họp</span>
                          ) : (
                            <span className="bg-sky-100 text-sky-900 border border-sky-200 px-1.5 py-0.5 rounded text-[9.5px] font-black uppercase shrink-0">Kế hoạch</span>
                          )}
                          <span>{selectedSch.title}</span>
                        </h4>
                    {selectedSch.dueDate && (
                      <p className="text-[10.5px] text-gray-500 font-medium mt-0.5">Thời hạn nộp văn bản cấp hành chính: <strong className="text-rose-700 underline">{selectedSch.dueDate}</strong></p>
                    )}
                  </div>
                  <button onClick={() => setSelectedSch(null)} className="text-[10px] bg-gray-50 hover:bg-gray-100 border text-gray-400 hover:text-gray-700 font-bold px-2 py-1 rounded-md cursor-pointer">[×] Đóng</button>
                </div>

                {/* STATUS BAR WITH COMPLETE TRIGGER */}
                <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row justify-between items-center gap-3 ${
                  selectedSch.isCompleted 
                    ? "bg-emerald-50/50 border-emerald-200 text-emerald-950" 
                    : "bg-amber-50/30 border-amber-200 text-amber-950"
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{selectedSch.isCompleted ? "🎉" : "⏳"}</span>
                    <div className="text-left">
                      <p className="font-bold text-[11px] uppercase tracking-wider">
                        Trạng thái: <span className={selectedSch.isCompleted ? "text-emerald-800 font-extrabold" : "text-amber-800 font-extrabold"}>{selectedSch.isCompleted ? "Đã hoàn thành toàn bộ" : "Chưa hoàn thành / Đang làm"}</span>
                      </p>
                      <p className="text-[9.5px] text-gray-400 font-semibold leading-tight mt-0.5">
                        {selectedSch.isCompleted 
                          ? "Sự vụ đã được báo cáo hoàn tất. Sẽ không còn hiển thị cảnh báo trễ hạn." 
                          : "Bất kỳ ai (mọi cán bộ, kể cả người phối hợp hoặc phụ trách trực tiếp) đều có thể ấn xác nhận hoàn thành hộ."}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...selectedSch, isCompleted: !selectedSch.isCompleted };
                      saveScheduleUpdate(updated);
                      setSelectedSch(updated);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[10.5px] font-bold transition flex items-center gap-1.5 cursor-pointer select-none shadow-xs shrink-0 border ${
                      selectedSch.isCompleted
                        ? "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300"
                        : "bg-emerald-600 hover:bg-emerald-755 text-white border-emerald-700"
                    }`}
                  >
                    {selectedSch.isCompleted ? "↩️ Chuyển trạng thái chưa làm" : "✅ Ấn Báo Hoàn Thành Hộ"}
                  </button>
                </div>

                {/* COMPACT DETAIL VALUES AND EXTERNAL DOCUMENT CONTENT VIEW */}
                <div className="bg-gray-50 p-3.5 rounded-xl border space-y-1.5 text-xs text-slate-800 select-text">
                  <p><span className="font-bold text-gray-400">Nội dung cốt lõi:</span> {selectedSch.description || "Chưa thiết lập mô tả..."}</p>
                  {selectedSch.externalDocName && (
                    <div className="pt-2 border-t border-gray-200/50 space-y-2">
                      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
                        <p className="font-bold text-emerald-800 flex items-center gap-0.5">📂 VĂN BẢN NGOÀI LƯU TRỮ: <span className="underline">{selectedSch.externalDocName}</span></p>
                        {selectedSch.externalDocFileBase64 && (
                          <button
                            onClick={() => handleDownloadAttachment(selectedSch)}
                            className="px-2.5 py-1 text-[10.5px] font-bold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 rounded-lg flex items-center gap-1 transition cursor-pointer border border-emerald-300 w-max"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide-download"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                            Tải tệp đính kèm ({selectedSch.externalDocFileSize || "bản gốc"})
                          </button>
                        )}
                      </div>
                      
                      {selectedSch.externalDocFileType && (
                        <p className="text-[10px] text-gray-400 font-medium">
                          Định dạng: {selectedSch.externalDocFileType.split('/').pop()?.toUpperCase() || "Tệp ngoài"} • Dung lượng: {selectedSch.externalDocFileSize || "OK"}
                        </p>
                      )}

                      {selectedSch.externalDocContent && (
                        <div className="p-2 border rounded bg-white font-mono text-[10px] text-gray-500 whitespace-pre-wrap max-h-32 overflow-y-auto">
                          {selectedSch.externalDocContent}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 📋 SECTION: MANAGER WORK ASSIGNMENT TIMELINE & SECTORS */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-transparent">
                    <h5 className="text-[11px] font-extrabold text-gray-800 uppercase flex items-center gap-1">
                      <UserCheck className="h-4 w-4 text-emerald-700" /> Bảng phân chia công tác từng người quản lý
                    </h5>
                    
                    {/* ROBOTIC AI SUGGESTED WORK TRIGGER */}
                    <button
                      type="button"
                      onClick={handleAiGetSuggestions}
                      disabled={loadingSuggestions}
                      className="text-[9.5px] bg-gradient-to-r from-teal-700 to-emerald-800 hover:from-teal-800 hover:to-emerald-900 text-white font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer transition shadow-xs disabled:opacity-50"
                    >
                      {loadingSuggestions ? (
                        <>
                          <RefreshCw className="h-3 w-3 animate-spin" />
                          AI đang nghĩ...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5 fill-emerald-100" />
                          AI Gợi Ý Việc Cần Phân
                        </>
                      )}
                    </button>
                  </div>

                  {/* AI RECOMMENDATION CHECKLIST COMPONENT */}
                  {aiSuggestions.length > 0 && (
                    <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-3 shadow-xs animate-slideDown">
                      <div className="flex justify-between items-center border-b border-teal-100 pb-1">
                        <span className="text-[10px] font-bold text-teal-900 flex items-center gap-1 uppercase">💡 Đề Xuất Phân Việc Tự Động Từ AI</span>
                        <button onClick={() => setAiSuggestions([])} className="text-teal-500 font-bold hover:text-teal-900 text-[10px]">[×] Ẩn</button>
                      </div>
                      <p className="text-[10px] text-teal-800 leading-normal">
                        Dựa trên dữ liệu nội dung công văn và mô tả, AI đề xuất giao các nhiệm vụ tương ứng cho các vị trí nòng cốt. Nhấn "Giao việc" để thêm lập tức:
                      </p>
                      <div className="space-y-2">
                        {aiSuggestions.map((sug, i) => (
                          <div key={i} className="bg-white p-2.5 rounded-lg border border-teal-100/70 flex justify-between items-center gap-4 text-xs">
                            <div className="space-y-1">
                              <p className="font-semibold text-gray-800 leading-snug">{sug.task}</p>
                              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-900 rounded font-bold text-[9px]">Gợi ý vai trò: {sug.proposedAssigneeRole}</span>
                            </div>
                            <button
                              onClick={() => handleApplyAiSuggestion(sug.task, sug.proposedAssigneeRole)}
                              className="px-2.5 py-1 bg-teal-750 hover:bg-teal-850 text-emerald-900 border border-teal-200 font-bold text-[10px] rounded-lg transition shrink-0 cursor-pointer"
                            >
                              + Giao việc
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ASSIGNMENTS DISPLAY MATRIX TABLE */}
                  {(!selectedSch.assignments || selectedSch.assignments.length === 0) ? (
                    <div className="border border-dashed p-4 text-center text-gray-400 text-xs rounded-xl italic">
                      Chưa có phần phân công công việc cụ thể cho cán bộ. Sử dụng form dưới hoặc AI để phân công để tránh trễ chỉ tiêu!
                    </div>
                  ) : (
                    <div className="space-y-2.5 select-all">
                      {selectedSch.assignments.map(asg => {
                        let statusText = asg.status;
                        let colorBadge = "bg-amber-50 text-amber-700 border-amber-200";
                        if (asg.status === "Đang làm") colorBadge = "bg-blue-50 text-blue-700 border-blue-200";
                        if (asg.status === "Đã hoàn thành") colorBadge = "bg-emerald-50 text-emerald-700 border-emerald-200";
                        if (asg.status === "Trễ hạn") colorBadge = "bg-rose-50 text-rose-700 border-rose-200";

                        return (
                          <div key={asg.id} className="p-3 bg-white border border-gray-150 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3 hover:shadow-xs transition">
                            <div className="space-y-1 text-xs">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-extrabold text-gray-900">{asg.assigneeName}</span>
                                <span className="text-[10px] text-gray-400 font-medium">({asg.assigneeRole})</span>
                                <span 
                                  onClick={() => handleToggleAssignmentStatus(asg.id, asg.status)}
                                  className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase cursor-pointer select-none ${colorBadge}`}
                                  title="Bấm để đổi trạng thái nhanh"
                                >
                                  🔄 {statusText}
                                </span>
                              </div>
                              <p className="text-gray-700 font-medium text-[11px]">{asg.task}</p>
                              {asg.note && (
                                <p className="text-[10px] italic text-gray-500">✍️ Ghi chú: {asg.note}</p>
                              )}
                            </div>
                            
                            {/* ACTION AT THE RIGHT */}
                            {canEdit && (
                              <button
                                onClick={() => handleRemoveAssignment(asg.id)}
                                className="p-1 px-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg hover:text-rose-900 transition cursor-pointer self-end md:self-center"
                                title="Hủy phân công"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* FORM TO ADD NEW AD-HOC DIRECT ASSIGNMENT */}
                  {canEdit && (
                    <form onSubmit={handleAddAssignment} className="border border-dashed border-gray-200 p-4 rounded-xl space-y-3.5 bg-slate-50/50 text-[11px] select-none">
                      <div className="font-bold text-gray-700 text-xs flex items-center gap-1 uppercase">✍️ Soạn Bảng Giao Việc Thực Tế</div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="font-semibold text-gray-400">Chọn hoặc nhập Cán bộ đảm nhiệm</label>
                          <select
                            value={newAssigneeName}
                            onChange={(e) => handleAssigneeChange(e.target.value)}
                            className="border border-gray-200 bg-white rounded-lg p-2 focus:ring-1 focus:ring-emerald-500"
                          >
                            <option value="">-- Chọn cán bộ --</option>
                            {accounts.map((a, idx) => (
                              <option key={idx} value={a.fullName}>{a.fullName} ({a.role})</option>
                            ))}
                            {!accounts.some(a => a.fullName === "Nguyễn Lâm Hùng") && defaultManagers.map((m, idx) => (
                              <option key={`def_${idx}`} value={m.fullName}>{m.fullName} ({m.role})</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="font-semibold text-gray-400">Chức vụ vai trò địa phương</label>
                          <input
                            type="text"
                            required
                            value={newAssigneeRole}
                            onChange={(e) => setNewAssigneeRole(e.target.value)}
                            placeholder="Ví dụ: Trưởng Ban điều hành"
                            className="border border-gray-200 bg-white rounded-lg p-2 focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="font-semibold text-gray-400">Công việc chi tiết được giao (*)</label>
                        <input
                          type="text"
                          required
                          value={newAssignTask}
                          onChange={(e) => setNewAssignTask(e.target.value)}
                          placeholder="Nhập phần việc cụ thể cần cán bộ triển khai..."
                          className="border border-gray-200 bg-white rounded-lg p-2 focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="font-semibold text-gray-400">Trạng thái khởi đầu</label>
                          <select
                            value={newAssignStatus}
                            onChange={(e) => setNewAssignStatus(e.target.value as any)}
                            className="border border-gray-200 bg-white rounded-lg p-2 focus:ring-1 focus:ring-emerald-500"
                          >
                            <option value="Cần làm">🟡 Cần làm (To-Do)</option>
                            <option value="Đang làm">🔵 Đang chuẩn bị / Đang làm (In Progress)</option>
                            <option value="Đã hoàn thành">✅ Đã hoàn thành (Done)</option>
                            <option value="Trễ hạn">🚨 Trễ tiến độ (Overdue)</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="font-semibold text-gray-400">Ghi chú chỉ thị nòng cốt</label>
                          <input
                            type="text"
                            value={newAssignNote}
                            onChange={(e) => setNewAssignNote(e.target.value)}
                            placeholder="Mốc thời gian phụ hoặc hướng dẫn..."
                            className="border border-gray-200 bg-white rounded-lg p-2 focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="px-4 py-2 bg-emerald-700 text-white font-bold rounded-xl hover:bg-emerald-800 transition flex items-center justify-center gap-1 shrink-0 cursor-pointer w-full text-xs"
                      >
                        <Plus className="h-4 w-4" /> Ủy Nhiệm & Gửi Giao Việc
                      </button>
                    </form>
                  )}
                </div>

                {/* GENERAL SIMULATION TRANSMIT BUTTONS */}
                <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-2 text-xs">
                  {selectedSch.isMeeting && (
                    <button
                      onClick={() => setShowInvitation(true)}
                      className="p-2 border border-emerald-200 text-emerald-800 font-bold rounded-lg hover:bg-emerald-50 text-center flex flex-col items-center justify-center gap-1 cursor-pointer transition flex-1"
                    >
                      <Printer className="h-4 w-4" />
                      In Giấy Mời Họp
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleSimulateAlerts(selectedSch, "Zalo")}
                    className="p-2 border border-blue-200 text-blue-900 bg-blue-50/25 font-bold rounded-lg hover:bg-blue-50 text-center flex flex-col items-center justify-center gap-1 cursor-pointer transition flex-1"
                  >
                    <MessageSquareCode className="h-4 w-4 text-blue-600" />
                    Báo Zalo nhóm
                  </button>

                  <button
                    onClick={() => handleSimulateAlerts(selectedSch, "SMS")}
                    className="p-2 border border-amber-200 text-amber-900 bg-amber-50/25 font-bold rounded-lg hover:bg-amber-50 text-center flex flex-col items-center justify-center gap-1 cursor-pointer transition flex-1"
                  >
                    <Bell className="h-4 w-4 text-amber-600" />
                    SMS thông báo
                  </button>

                  {canEdit && (
                    <button
                      onClick={() => handleDeleteSchedule(selectedSch.id)}
                      className="p-2 border border-rose-100 text-rose-700 font-bold rounded-lg hover:bg-rose-50 text-center flex flex-col items-center justify-center gap-1 cursor-pointer transition flex-1"
                    >
                      <Trash2 className="h-4 w-4 text-rose-500" />
                      Xóa Lịch nọ
                    </button>
                  )}
                </div>

                {simMessage && (
                  <div className="bg-slate-50 rounded-xl p-3 border border-gray-150 text-xs font-mono text-gray-700 whitespace-pre-line leading-relaxed">
                    {simMessage}
                  </div>
                )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      {customAlert && (
        <div className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="bg-emerald-800 text-white px-5 py-3.5 font-bold text-xs">Thông báo hệ thống</div>
            <div className="p-5 text-xs text-gray-755 font-medium leading-relaxed">{customAlert}</div>
            <div className="flex justify-end p-3 border-t border-gray-100 bg-gray-50/50">
              <button
                type="button"
                onClick={() => setCustomAlert(null)}
                className="bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-emerald-800 cursor-pointer transition select-none"
              >
                Đăng ký thành công
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
            <div className="p-5 text-xs text-gray-755 font-medium leading-relaxed">{customConfirm.message}</div>
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

import React, { useState, useEffect } from "react";
import { OfficialDocument, UserRole } from "../types";
import { formatDate } from "../utils/dateTimeUtils";
import { 
  FileText, Plus, Search, Trash2, Download, Calendar, Filter, 
  Building, Briefcase, Shield, Tag, Paperclip, UploadCloud, X, 
  FileDown, FileUp, Info, AlertCircle, FileCheck, Edit3
} from "lucide-react";

interface OfficialDocumentsManagerProps {
  type: "incoming" | "outgoing";
  activeRole: UserRole;
  onRefresh: () => void;
  currentUser: any;
}

export default function OfficialDocumentsManager({ 
  type, 
  activeRole, 
  onRefresh, 
  currentUser 
}: OfficialDocumentsManagerProps) {
  // Database of official documents
  const [documents, setDocuments] = useState<OfficialDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorStr, setErrorStr] = useState<string>("");

  // Filters State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All"); // "All" or "Party", "Gov", "Front"
  const [filterYear, setFilterYear] = useState<string>("All");
  const [filterMonth, setFilterMonth] = useState<string>("All");

  // Form Modal State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>("");
  const [editingDoc, setEditingDoc] = useState<OfficialDocument | null>(null);

  // Custom Delete Modal State
  const [docToDelete, setDocToDelete] = useState<OfficialDocument | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string>("");

  const handleOpenAdd = () => {
    setEditingDoc(null);
    setTitle("");
    setDocNumber("");
    setDateIssued(() => {
      const today = new Date();
      return today.toISOString().split("T")[0];
    });
    setCategory("Chính quyền");
    setSenderOrReceiver("");
    setSummary("");
    removeAttachedFile();
    setFormError("");
    setShowAddModal(true);
  };

  const handleOpenEdit = (doc: OfficialDocument) => {
    setEditingDoc(doc);
    setTitle(doc.title || "");
    setDocNumber(doc.docNumber || "");
    setDateIssued(doc.dateIssued || "");
    setCategory(doc.category || "Chính quyền");
    setSenderOrReceiver(doc.senderOrReceiver || "");
    setSummary(doc.summary || "");
    
    if (doc.externalFileBase64) {
      setFileBase64(doc.externalFileBase64);
      setFileName(doc.externalFileName || "van_ban_dinh_kem");
      setFileType(doc.externalFileType || "");
      setFileSizeStr(doc.externalFileSize || "");
    } else {
      removeAttachedFile();
    }
    
    setFormError("");
    setShowAddModal(true);
  };

  // Input Forms
  const [title, setTitle] = useState<string>("");
  const [docNumber, setDocNumber] = useState<string>("");
  const [dateIssued, setDateIssued] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [category, setCategory] = useState<"Đảng" | "Chính quyền" | "Mặt trận và các đoàn thể">("Chính quyền");
  const [senderOrReceiver, setSenderOrReceiver] = useState<string>("");
  const [summary, setSummary] = useState<string>("");

  // File Upload State
  const [fileBase64, setFileBase64] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [fileType, setFileType] = useState<string>("");
  const [fileSizeStr, setFileSizeStr] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const canEdit = ["Super Admin", "Bí thư Chi bộ", "Trưởng Ban điều hành", "Trưởng ban công tác Mặt trận", "Công an khu vực", "Cán bộ nhập liệu"].includes(activeRole) && currentUser?.canEdit !== false;

  const fetchDocuments = async () => {
    setLoading(true);
    setErrorStr("");
    try {
      const res = await fetch("/api/official-documents", {
        headers: {
          "x-user-email": encodeURIComponent(currentUser?.email || ""),
          "x-user-role": encodeURIComponent(activeRole || "")
        }
      });
      if (!res.ok) {
        throw new Error("Không thể tải danh sách tài liệu.");
      }
      const data = await res.json();
      setDocuments(data || []);
    } catch (err: any) {
      console.error(err);
      setErrorStr("Lỗi nạp dữ liệu lưu trữ văn bản.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [type, currentUser?.email, activeRole]);

  // Handle file conversion to Base64
  const handleFileChangeHelper = (file: File) => {
    if (file.size > 15 * 1024 * 1024) {
      alert("Tệp của bạn quá lớn! Vui lòng chọn tệp dưới 15MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFileBase64(reader.result as string);
      setFileName(file.name);
      setFileType(file.type);
      
      // Format file size
      const sizeInMB = file.size / (1024 * 1024);
      if (sizeInMB >= 1) {
        setFileSizeStr(`${sizeInMB.toFixed(2)} MB`);
      } else {
        setFileSizeStr(`${(file.size / 1024).toFixed(1)} KB`);
      }
    };
    reader.onerror = () => {
      alert("Không thể đọc tệp tin.");
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileChangeHelper(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChangeHelper(e.dataTransfer.files[0]);
    }
  };

  const removeAttachedFile = () => {
    setFileBase64("");
    setFileName("");
    setFileType("");
    setFileSizeStr("");
  };

  // Submit new document handler (supports Add & Edit)
  const handleSubmitDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!title.trim()) {
      setFormError("Tiêu đề văn bản không được bỏ trống!");
      return;
    }
    if (!docNumber.trim()) {
      setFormError("Số/Ký hiệu văn bản bắt buộc phải có để đối chiếu hành pháp!");
      return;
    }
    if (!senderOrReceiver.trim()) {
      setFormError(
        type === "incoming" 
          ? "Vui lòng nhập Cơ quan ban hành văn bản!" 
          : "Vui lòng nhập Nơi nhận văn bản gửi đi!"
      );
      return;
    }

    setSubmitting(true);

    const docDate = new Date(dateIssued);
    const docYear = isNaN(docDate.getFullYear()) ? new Date().getFullYear() : docDate.getFullYear();
    const docMonth = isNaN(docDate.getMonth()) ? new Date().getMonth() + 1 : docDate.getMonth() + 1;

    const payload: Partial<OfficialDocument> = {
      title: title.trim(),
      docNumber: docNumber.trim(),
      dateIssued,
      senderOrReceiver: senderOrReceiver.trim(),
      type,
      category,
      year: docYear,
      month: docMonth,
      summary: summary.trim(),
      externalFileBase64: fileBase64 || undefined,
      externalFileName: fileName || undefined,
      externalFileType: fileType || undefined,
      externalFileSize: fileSizeStr || undefined
    };

    try {
      const url = editingDoc 
        ? `/api/official-documents/${editingDoc.id}` 
        : "/api/official-documents";
      const method = editingDoc ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-user-email": encodeURIComponent(currentUser?.email || ""),
          "x-user-role": encodeURIComponent(activeRole || ""),
          "x-user-name": encodeURIComponent(currentUser?.fullName || "")
        },
        body: JSON.stringify(payload)
      });

      const responseData = await res.json();
      if (!res.ok) {
        setFormError(responseData.error || `Gặp lỗi khi ${editingDoc ? "cập nhật" : "tạo mới"} lưu trữ văn bản.`);
      } else {
        // Success
        setShowAddModal(false);
        setEditingDoc(null);
        // Clear forms
        setTitle("");
        setDocNumber("");
        setSenderOrReceiver("");
        setSummary("");
        removeAttachedFile();
        
        // Refresh local list and main db state for logs
        fetchDocuments();
        onRefresh();
      }
    } catch {
      setFormError("Lỗi kết nối máy chủ không dây.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Document Deletion
  const handleDeleteDocument = (id: string, docTitle: string) => {
    const doc = documents.find(d => d.id === id);
    if (doc) {
      setDocToDelete(doc);
      setDeleteError("");
    }
  };

  const confirmDeleteDocument = async () => {
    if (!docToDelete) return;
    setDeleting(true);
    setDeleteError("");

    try {
      const res = await fetch(`/api/official-documents/${docToDelete.id}`, {
        method: "DELETE",
        headers: {
          "x-user-email": encodeURIComponent(currentUser?.email || ""),
          "x-user-role": encodeURIComponent(activeRole || "")
        }
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error || "Lỗi xóa văn bản lưu trữ.");
      } else {
        setDocToDelete(null);
        fetchDocuments();
        onRefresh();
      }
    } catch {
      setDeleteError("Lỗi kết nối khi xóa văn bản.");
    } finally {
      setDeleting(false);
    }
  };

  // Downloader for binary storage base64
  const triggerFileDownload = (doc: OfficialDocument) => {
    if (!doc.externalFileBase64) return;
    
    const link = document.createElement("a");
    link.href = doc.externalFileBase64;
    link.download = doc.externalFileName || "van_ban_dinh_kem";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper filters
  const filteredDocs = documents.filter(doc => {
    // Basic type match
    if (doc.type !== type) return false;

    // Subcategory matches (Party, Gov, Front)
    if (selectedCategory !== "All") {
      if (selectedCategory === "Party" && doc.category !== "Đảng") return false;
      if (selectedCategory === "Gov" && doc.category !== "Chính quyền") return false;
      if (selectedCategory === "Front" && doc.category !== "Mặt trận và các đoàn thể") return false;
    }

    // Year selection match
    if (filterYear !== "All" && doc.year.toString() !== filterYear) return false;

    // Month selection match
    if (filterMonth !== "All" && doc.month.toString() !== filterMonth) return false;

    // Search query match
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = doc.title.toLowerCase().includes(q);
      const matchNum = doc.docNumber.toLowerCase().includes(q);
      const matchAgency = doc.senderOrReceiver.toLowerCase().includes(q);
      const matchSummary = doc.summary && doc.summary.toLowerCase().includes(q);
      return matchTitle || matchNum || matchAgency || matchSummary;
    }

    return true;
  });

  // Calculate stats for pill counters
  const partyCount = documents.filter(d => d.type === type && d.category === "Đảng").length;
  const govtCount = documents.filter(d => d.type === type && d.category === "Chính quyền").length;
  const frontCount = documents.filter(d => d.type === type && d.category === "Mặt trận và các đoàn thể").length;
  const totalCount = partyCount + govtCount + frontCount;

  // Multi-year dropdown population (Find unique years from current database)
  const availableYearsList = Array.from(
    new Set([2023, 2024, 2025, 2026, ...documents.filter(d => d.type === type).map(d => d.year)])
  ).sort((a, b) => b - a);

  return (
    <div className="space-y-6" id={`official_doc_manager_${type}`}>
      {/* HEADER BANNER */}
      <div className="bg-white rounded-2xl border border-slate-150 p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`p-2.5 rounded-xl ${type === "incoming" ? "bg-amber-100 text-amber-800" : "bg-teal-100 text-teal-800"}`}>
              {type === "incoming" ? <FileDown className="h-5 w-5" /> : <FileUp className="h-5 w-5" />}
            </span>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 uppercase">
                {type === "incoming" ? "Hộp Lưu Trữ Văn Bản Đến" : "Khu Lưu Trữ Văn Bản Đi"}
              </h2>
              <p className="text-xs text-gray-400 font-medium">
                {type === "incoming" 
                  ? "Quản bản văn bản chỉ đạo của Đảng ủy, chính quyền địa phương gửi đến Khu phố 3"
                  : "Quản lý và tra cứu văn bản hành chính gửi đi cơ quan cấp trên, báo cáo công việc"}
              </p>
            </div>
          </div>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={handleOpenAdd}
            id={`btn_add_doc_${type}`}
            className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white rounded-xl shadow transition active:scale-95 ${
              type === "incoming" 
                ? "bg-amber-600 hover:bg-amber-700 shadow-amber-200" 
                : "bg-teal-600 hover:bg-teal-700 shadow-teal-200"
            }`}
          >
            <Plus className="h-4 w-4" />
            {type === "incoming" ? "Tiếp nhận văn bản mới" : "Đăng ký văn bản đi"}
          </button>
        )}
      </div>

      {/* QUICK SUB-CATEGORY TAB SWITCHER PILLS */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100 p-1.5 rounded-xl border border-slate-200 select-none">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedCategory("All")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              selectedCategory === "All"
                ? "bg-white text-slate-800 shadow-sm border border-slate-200"
                : "text-slate-500 hover:bg-slate-200/50"
            }`}
          >
            📋 Tất cả ({totalCount})
          </button>
          <button
            onClick={() => setSelectedCategory("Party")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              selectedCategory === "Party"
                ? "bg-rose-50 border border-rose-200 text-rose-800 shadow-sm font-extrabold"
                : "text-slate-500 hover:bg-slate-200/50"
            }`}
          >
            <Shield className="h-3.5 w-3.5 text-rose-600" />
            Đảng ({partyCount})
          </button>
          <button
            onClick={() => setSelectedCategory("Gov")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              selectedCategory === "Gov"
                ? "bg-blue-50 border border-blue-200 text-blue-800 shadow-sm font-extrabold"
                : "text-slate-500 hover:bg-slate-200/50"
            }`}
          >
            <Building className="h-3.5 w-3.5 text-blue-600" />
            Chính quyền ({govtCount})
          </button>
          <button
            onClick={() => setSelectedCategory("Front")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              selectedCategory === "Front"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800 shadow-sm font-extrabold"
                : "text-slate-500 hover:bg-slate-200/50"
            }`}
          >
            <Briefcase className="h-3.5 w-3.5 text-emerald-600" />
            Mặt trận & Đoàn thể ({frontCount})
          </button>
        </div>

        <div className="text-[11px] font-semibold text-gray-500 px-3 py-1 bg-white/60 border border-slate-150/40 rounded-lg">
          Lưu trữ nhiều năm & Bảo mật không gian mạng
        </div>
      </div>

      {/* ADVANCED MULTI-OPTIONS SEARCH & MONTH-YEAR FILTER GRID */}
      <div className="bg-white rounded-2xl border border-slate-150 p-4 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Search Input */}
        <div className="relative group col-span-1 md:col-span-2">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 group-focus-within:text-slate-700 transition" />
          <input
            type="text"
            placeholder="Tìm theo quyết định, tiêu đề, số ký hiệu hoặc người gửi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 focus:ring-0 focus:outline-none focus:bg-white focus:border-slate-400 text-gray-800 placeholder:text-gray-400 transition"
          />
        </div>

        {/* Year Filter */}
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold text-gray-400 uppercase whitespace-nowrap">Năm:</label>
          <div className="relative flex-1">
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 focus:ring-0 focus:outline-none text-gray-700"
            >
              <option value="All">📅 Tất cả các năm</option>
              {availableYearsList.map(y => (
                <option key={y} value={y.toString()}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Month Filter */}
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold text-gray-400 uppercase whitespace-nowrap">Tháng:</label>
          <div className="relative flex-1">
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 focus:ring-0 focus:outline-none text-gray-700"
            >
              <option value="All">🌙 Tất cả tháng</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m.toString()}>Tháng {m}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ARCHIVE RECORDS LIST GRID / DATA TABLE */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-150 p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-600 border-t-transparent mx-auto mb-3"></div>
          <p className="text-xs text-gray-500 font-bold animate-pulse">Đang nạp ngăn lưu trữ tài liệu...</p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-150 p-12 text-center space-y-2">
          <FileText className="h-10 w-10 text-gray-300 mx-auto" />
          <p className="text-xs text-gray-500 font-extrabold font-sans">
            Không tìm thấy văn bản {type === "incoming" ? "đến" : "đi"} nào phù hợp với bộ lọc lọc của bạn.
          </p>
          <p className="text-[10px] text-gray-400">
            Bạn có thể đổi bộ lọc tháng/năm hoặc nhấp &quot;Tiếp nhận&quot; trên nút để nạp bổ sung.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-150 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-xs text-gray-700">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[9px] tracking-wider select-none">
                <tr>
                  <th className="py-4 px-4 w-[110px]">Ký Hiệu / Số</th>
                  <th className="py-4 px-4">Tên Văn Bản / Trích Yêu</th>
                  <th className="py-4 px-4 w-[140px]">Chuyên Mục</th>
                  <th className="py-4 px-4 w-[150px]">{type === "incoming" ? "Nơi Ban Hành" : "Nơi Nhận"}</th>
                  <th className="py-4 px-4 w-[100px]">Ngày Nhận/Gửi</th>
                  <th className="py-4 px-4 w-[140px]">Tệp Gốc</th>
                  {canEdit && <th className="py-4 px-4 w-[60px] text-center">Tác Vụ</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredDocs.map((doc) => {
                  const tagColors = 
                    doc.category === "Đảng" 
                      ? "bg-rose-50 text-rose-800 border-rose-100 text-rose-950 font-bold" 
                      : doc.category === "Chính quyền"
                      ? "bg-blue-50 text-blue-800 border-blue-100 text-blue-950 font-bold"
                      : "bg-emerald-50 text-emerald-800 border-emerald-100 text-emerald-950 font-bold";

                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/75 transition-all text-xs font-medium">
                      {/* Doc number */}
                      <td className="py-3.5 px-4 font-bold text-slate-900 border-r border-slate-50 font-mono">
                        {doc.docNumber}
                        <span className="block text-[8px] text-slate-400 font-sans font-semibold mt-0.5 uppercase tracking-wide">
                          Năm KP: {doc.year}
                        </span>
                      </td>

                      {/* Title & Summary */}
                      <td className="py-4 px-4 max-w-[340px]">
                        <div className="font-extrabold text-slate-850 font-sans leading-relaxed text-xs">{doc.title}</div>
                        {doc.summary && (
                          <p className="text-[10px] text-gray-500 mt-1 italic line-clamp-2 leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-100">
                            {doc.summary}
                          </p>
                        )}
                      </td>

                      {/* Category Pill */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[9px] uppercase ${tagColors}`}>
                          {doc.category === "Đảng" && <Shield className="h-2.5 w-2.5" />}
                          {doc.category === "Chính quyền" && <Building className="h-2.5 w-2.5" />}
                          {doc.category === "Mặt trận và các đoàn thể" && <Briefcase className="h-2.5 w-2.5" />}
                          {doc.category}
                        </span>
                      </td>

                      {/* Sender / Receiver */}
                      <td className="py-3.5 px-4 font-semibold text-slate-700 leading-snug">
                        {doc.senderOrReceiver}
                      </td>

                      {/* Issue Date */}
                      <td className="py-3.5 px-4 text-[10px] text-slate-500 font-mono">
                        {formatDate(doc.dateIssued)}
                      </td>

                      {/* External attachment file block */}
                      <td className="py-3.5 px-4">
                        {doc.externalFileBase64 ? (
                          <div className="flex flex-col gap-1 items-start">
                            <button
                              type="button"
                              onClick={() => triggerFileDownload(doc)}
                              className="inline-flex items-center gap-1.5 px-2 py-1 text-[8.5px] font-bold text-slate-700 hover:text-white bg-slate-100 hover:bg-slate-800 rounded-md border border-slate-250 transition"
                              title={`Tải xuống: ${doc.externalFileName}`}
                            >
                              <Paperclip className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[100px]">{doc.externalFileName}</span>
                              <Download className="h-2.5 w-2.5 shrink-0 ml-0.5" />
                            </button>
                            {doc.externalFileSize && (
                              <span className="text-[7.5px] font-mono text-gray-400 ml-1.5">{doc.externalFileSize}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-400 italic font-medium p-1 bg-slate-55 rounded">Không đính kèm</span>
                        )}
                      </td>

                      {/* Actions */}
                      {canEdit && (
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(doc)}
                              className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer transition"
                              title="Sửa thông tin văn bản"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDocument(doc.id, doc.title)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition"
                              title="Xóa văn bản khỏi tàng thư"
                            >
                              <Trash2 className="h-4 w-4" />
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
        </div>
      )}

      {/* FORM MODAL AREA: ADD NEW RECORD */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-150 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header Dialog */}
            <div className={`p-5 text-white flex justify-between items-center ${type === "incoming" ? "bg-amber-700" : "bg-teal-700"}`}>
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-white/20 rounded-lg text-white">
                  {type === "incoming" ? <FileDown className="h-5 w-5" /> : <FileUp className="h-5 w-5" />}
                </span>
                <div>
                  <h4 className="text-[10px] font-extrabold uppercase text-white/80 tracking-wider">Lưu Trữ Văn Bản KP3</h4>
                  <p className="text-sm font-extrabold">
                    {editingDoc 
                      ? (type === "incoming" ? "Chỉnh Sửa Thông Tin Văn Bản Đến" : "Chỉnh Sửa Thông Tin Văn Bản Đi")
                      : (type === "incoming" ? "Tiếp Nhận & Lưu Trữ Văn Bản Đến" : "Khai Báo & Đăng Ký Văn Bản Đi")
                    }
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAddModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleSubmitDocument} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="bg-rose-50 border border-rose-100 p-3 rounded-lg text-xs text-rose-700 font-extrabold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Title Input */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Tiêu đề văn bản <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  placeholder="Ví dụ: Chỉ đạo tổng vệ sinh phòng dịch, báo cáo an ninh trật tự hè..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-slate-500 text-gray-800 font-medium"
                  required
                />
              </div>

              {/* Two Column details */}
              <div className="grid grid-cols-2 gap-3">
                {/* Doc Number code */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase">Số / Ký hiệu văn bản <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    placeholder="Ví dụ: 124-KH/UBND, 02-NQ..."
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-slate-500 text-gray-800 font-semibold font-mono"
                    required
                  />
                </div>

                {/* Date issued */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase">Ngày ban hành/nhận <span className="text-rose-500">*</span></label>
                  <input
                    type="date"
                    value={dateIssued}
                    onChange={(e) => setDateIssued(e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-slate-500 text-gray-800 font-semibold font-mono"
                    required
                  />
                </div>
              </div>

              {/* Category selector & Sender/Receiver */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Category selector */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase">Thuộc phân mục con <span className="text-rose-500">*</span></label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full text-xs border border-gray-200 rounded-lg py-1.5 px-3 focus:outline-none focus:border-slate-500 text-gray-800 font-bold bg-white"
                  >
                    <option value="Đảng">🚩 Văn bản của Đảng</option>
                    <option value="Chính quyền">🏛️ Văn bản chính quyền</option>
                    <option value="Mặt trận và các đoàn thể">🤝 Văn bản Mặt trận & Đoàn thể</option>
                  </select>
                </div>

                {/* Sender or Receiver agency */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase">
                    {type === "incoming" ? "Cơ quan ban hành *" : "Nơi nhận / Gửi đến *"}
                  </label>
                  <input
                    type="text"
                    placeholder={type === "incoming" ? "Ví dụ: Đảng ủy / UBND Phường" : "Ví dụ: Đảng ủy Phường An Phú"}
                    value={senderOrReceiver}
                    onChange={(e) => setSenderOrReceiver(e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-slate-500 text-gray-800"
                    required
                  />
                </div>
              </div>

              {/* Brief summary text-area */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Tóm tắt nội dung chính (Trích yếu)</label>
                <textarea
                  rows={2}
                  placeholder="Ghi vắn tắt nội dung văn bản để dễ dàng tìm kiếm về sau..."
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-slate-500 text-gray-800 resize-none font-medium"
                ></textarea>
              </div>

              {/* DRAG AND DROP FILE UPLOAD CONTAINER */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Đính kèm tài liệu từ nguồn bên ngoài</label>
                
                {fileBase64 ? (
                  <div className="p-3 bg-slate-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
                        <FileCheck className="h-4 w-4" />
                      </span>
                      <div className="max-w-[280px]">
                        <p className="text-xs font-bold text-slate-800 truncate leading-tight">{fileName}</p>
                        <p className="text-[9px] font-mono text-gray-400">{fileSizeStr}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={removeAttachedFile}
                      className="p-1 text-slate-400 hover:text-red-650 hover:bg-slate-200/50 rounded-full cursor-pointer transition select-none"
                      title="Gỡ bỏ tệp để chọn lại"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-5 text-center transition cursor-pointer select-none relative ${
                      isDragOver 
                        ? "border-emerald-500 bg-emerald-50/50" 
                        : "border-slate-200 hover:border-slate-450 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="file"
                      onChange={handleFileSelect}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      id="doc_file_selector"
                    />
                    <UploadCloud className={`h-8 w-8 mx-auto mb-1.5 transition ${isDragOver ? "text-emerald-600 animate-bounce" : "text-gray-400"}`} />
                    <p className="text-xs font-bold text-slate-700">Kéo & thả tệp tin vào đây</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Hoặc nhấn vào đây để duyệt file (pdf, word, scan, ảnh...) dưới 15MB</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-3 text-xs select-none">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 text-center rounded-lg border border-slate-250 text-slate-500 font-semibold hover:bg-slate-50 transition cursor-pointer"
                >
                  Đóng lại
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`flex-1 py-2 text-center text-white font-semibold rounded-lg transition cursor-pointer disabled:opacity-50 ${
                    type === "incoming" 
                      ? "bg-amber-600 hover:bg-amber-700" 
                      : "bg-teal-600 hover:bg-teal-700"
                  }`}
                >
                  {submitting 
                    ? "Đang xử lý thiết lập..." 
                    : (editingDoc ? "Cập nhật thay đổi" : "Lưu trữ tệp thành công")
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM DELETE CONFIRMATION MODAL */}
      {docToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-150 max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="p-4 bg-rose-700 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                <span className="text-xs font-black tracking-wider uppercase">XÁC NHẬN XÓA LƯU TRỮ CHUYÊN SÂU</span>
              </div>
              <button 
                type="button"
                onClick={() => setDocToDelete(null)}
                className="text-white hover:bg-white/10 rounded-lg p-1.5 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="bg-rose-100 rounded-full p-2.5 text-rose-700 shrink-0">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-rose-950">Bạn thực sự muốn gỡ bỏ văn bản này?</h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    Hành động này <strong className="text-rose-700">không thể phục hồi</strong>. Hồ sơ, nội dung tóm tắt và tất cả các tệp tin đính kèm của văn bản sẽ bị xóa vĩnh viễn khỏi cơ sở dữ liệu.
                  </p>
                </div>
              </div>

              {/* Document details box */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="grid grid-cols-3 text-[10.5px]">
                  <span className="text-slate-400 font-bold">Số hiệu:</span>
                  <span className="col-span-2 text-slate-800 font-extrabold">{docToDelete.docNumber || "Không rõ số hiệu"}</span>
                </div>
                <div className="grid grid-cols-3 text-[10.5px]">
                  <span className="text-slate-400 font-bold">Tiêu đề:</span>
                  <span className="col-span-2 text-slate-800 font-extrabold line-clamp-2">{docToDelete.title}</span>
                </div>
                <div className="grid grid-cols-3 text-[10.5px]">
                  <span className="text-slate-400 font-bold">Nơi nhận/gửi:</span>
                  <span className="col-span-2 text-slate-800 font-extrabold">{docToDelete.senderOrReceiver || "N/A"}</span>
                </div>
              </div>

              {deleteError && (
                <div className="bg-rose-50 border border-rose-100 p-3 rounded-lg text-xs text-rose-700 font-black flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-1 text-xs font-bold">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setDocToDelete(null)}
                  className="flex-1 py-2.5 text-center text-slate-500 border border-slate-250 bg-white hover:bg-slate-50 rounded-xl transition cursor-pointer"
                >
                  Bỏ qua
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={confirmDeleteDocument}
                  className="flex-1 py-2.5 text-center text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-3xs transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {deleting ? (
                    <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  <span>{deleting ? "Đang xóa..." : "Xác nhận xóa"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

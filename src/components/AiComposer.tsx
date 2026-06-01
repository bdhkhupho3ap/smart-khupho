import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { DocumentTemplate, GeneratedDocument } from "../types";
import { formatDate } from "../utils/dateTimeUtils";
import { 
  Award, 
  FileText, 
  Sparkles, 
  Check, 
  Download, 
  History, 
  PlusSquare, 
  BookOpen, 
  AlertCircle, 
  FileUp, 
  Briefcase, 
  Trash2, 
  Layers, 
  FileCheck, 
  Sliders, 
  ClipboardCopy 
} from "lucide-react";

interface AiComposerProps {
  templates: DocumentTemplate[];
  documents: GeneratedDocument[];
  activeRole: string;
  onRefresh: () => void;
}

export default function AiComposer({ templates, documents, activeRole, onRefresh }: AiComposerProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"draft" | "fill" | "summarize">("draft");

  // Tab 1: Soạn thảo mới (Gemini-style Conversational Workspace)
  const [draftPrompt, setDraftPrompt] = useState("");
  const [draftFile, setDraftFile] = useState<{ content: string; name: string } | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  
  // Tab 2: Hoàn thiện mẫu đơn (Template filling)
  const [fillTemplateId, setFillTemplateId] = useState("");
  const [customTemplateContent, setCustomTemplateContent] = useState("");
  const [fillFile, setFillFile] = useState<{ content: string; name: string } | null>(null);
  const [fillRawInputs, setFillRawInputs] = useState("");
  
  // Tab 3: Tóm tắt văn bản (Summarization workspace)
  const [summaryFile, setSummaryFile] = useState<{ content: string; name: string } | null>(null);
  const [summaryRawText, setSummaryRawText] = useState("");
  const [summaryType, setSummaryType] = useState("Ngắn gọn và đầy đủ nội dung");
  const [summaryInstructions, setSummaryInstructions] = useState("");

  // AI progress triggers
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentGenerationPhase, setCurrentGenerationPhase] = useState("");
  const [aiDraft, setAiDraft] = useState("");
  const [editorSuccess, setEditorSuccess] = useState("");
  const [editorError, setEditorError] = useState("");

  // Custom templates management (same as original)
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [newTempName, setNewTempName] = useState("");
  const [newTempType, setNewTempType] = useState("Thông báo");
  const [newTempDesc, setNewTempDesc] = useState("");
  const [newTempStructure, setNewTempStructure] = useState("");

  const currentTemplate = templates.find(t => t.id === selectedTemplateId);

  useEffect(() => {
    if (activeTab === "draft" && currentTemplate) {
      setDocumentTitle(currentTemplate.name);
    }
  }, [selectedTemplateId, templates, activeTab]);

  // Synchronize custom structure input when selected template changes for T2
  useEffect(() => {
    if (fillTemplateId === "custom") {
      setCustomTemplateContent("");
    } else {
      const selected = templates.find(t => t.id === fillTemplateId);
      if (selected) {
        setCustomTemplateContent(selected.structure);
      }
    }
  }, [fillTemplateId, templates]);

  // Handle files conversion to base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, target: "fill" | "summary" | "draft") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setEditorError("Hệ thống chỉ phê duyệt tệp đính kèm có cỡ tối đa 15MB!");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      if (target === "fill") {
        setFillFile({ content: base64, name: file.name });
      } else if (target === "summary") {
        setSummaryFile({ content: base64, name: file.name });
      } else {
        setDraftFile({ content: base64, name: file.name });
      }
    };
    reader.readAsDataURL(file);
  };

  // 1. Soạn thảo mới (Draft From Topic Inputs - conversational like Gemini)
  const triggerAiDrafting = async () => {
    setEditorError("");
    if (!draftPrompt.trim()) {
      setEditorError("Vui lòng nhập câu lệnh hoặc yêu cầu soạn thảo văn bản!");
      return;
    }

    setIsGenerating(true);
    setAiDraft("");
    
    const phases = [
      "Đang kết nối hệ thống trí tuệ nhân tạo Gemini 2.5-flash...",
      "Đang phân tích ý định và câu lệnh của cán bộ...",
      "Đang đọc và khai thác tệp tin đính kèm (nếu có)...",
      "Đang định dạng bài viết chuẩn Nghị định 30/2020/NĐ-CP...",
      "Hoàn thiện câu chữ hành chính tinh gọn, trang nghiêm nhất..."
    ];

    let currentPhaseIdx = 0;
    setCurrentGenerationPhase(phases[0]);
    const interval = setInterval(() => {
      currentPhaseIdx++;
      if (currentPhaseIdx < phases.length) {
        setCurrentGenerationPhase(phases[currentPhaseIdx]);
      }
    }, 1200);

    try {
      const res = await fetch("/api/gemini/generate-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: draftPrompt,
          fileContent: draftFile?.content || null,
          fileName: draftFile?.name || null,
          templateType: currentTemplate ? currentTemplate.type : null,
          structure: currentTemplate ? currentTemplate.structure : null
        })
      });

      const data = await res.json();
      clearInterval(interval);

      if (res.ok) {
        setAiDraft(data.content);
        
        // Dynamically guess a clean title from the generated content for save/downloads
        let guessedTitle = "";
        const lines = data.content.split("\n");
        const headerLine = lines.find((l: string) => {
          const u = l.toUpperCase();
          return l.startsWith("#") || u.includes("THÔNG BÁO") || u.includes("GIẤY MỜI") || u.includes("KẾ HOẠCH") || u.includes("TỜ TRÌNH") || u.includes("BIÊN BẢN") || u.includes("BÁO CÁO");
        });
        
        if (headerLine) {
          guessedTitle = headerLine.replace(/[#*]/g, "").trim();
        } else {
          guessedTitle = draftPrompt.length > 40 ? draftPrompt.substring(0, 40) + "..." : draftPrompt;
        }
        setDocumentTitle(guessedTitle);

        setEditorSuccess("Gemini đã soạn thảo xong tài liệu hoàn tất!");
        setTimeout(() => setEditorSuccess(""), 4000);
      } else {
        setEditorError(data.error || "Không thể khởi động dịch vụ AI Gemini.");
      }
    } catch (err: any) {
      clearInterval(interval);
      setEditorError("Lỗi kết nối máy chủ soạn thảo: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // 2. Điền mẫu đơn hành chính (Form template filling)
  const triggerAiFilling = async () => {
    setEditorError("");
    if (!customTemplateContent && !fillFile) {
      setEditorError("Vui lòng cung cấp văn bản mẫu hành chính rỗng hoặc tải lên một tệp tin mẫu đơn trống!");
      return;
    }

    setIsGenerating(true);
    setAiDraft("");

    const phases = [
      "Đang phân tích cấu trúc các chỗ khuyết trống [...] trong mẫu đơn...",
      "Đang đọc dữ liệu thông tin cư dân hoặc phụ đính bổ sung của bạn...",
      "Đang khớp nối số liệu, họ tên, CCCD và địa bàn cư trú...",
      "Đang loại bỏ hoàn toàn các thẻ trống và ghi chú khuyết...",
      "Đang xuất bản mẫu thư hoàn thiện định dạng văn kiện hành chính sạch đẹp..."
    ];

    let currentPhaseIdx = 0;
    setCurrentGenerationPhase(phases[0]);
    const interval = setInterval(() => {
      currentPhaseIdx++;
      if (currentPhaseIdx < phases.length) {
        setCurrentGenerationPhase(phases[currentPhaseIdx]);
      }
    }, 1200);

    try {
      const res = await fetch("/api/gemini/fill-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateContent: customTemplateContent,
          fileContent: fillFile?.content || null,
          fileName: fillFile?.name || null,
          rawInputs: fillRawInputs
        })
      });

      const data = await res.json();
      clearInterval(interval);

      if (res.ok) {
        setAiDraft(data.filledContent);
        setEditorSuccess("AI Hoàn thiện văn bản mẫu thành công!");
        setTimeout(() => setEditorSuccess(""), 4000);
      } else {
        setEditorError(data.error || "Có lỗi từ máy chủ AI.");
      }
    } catch (err: any) {
      clearInterval(interval);
      setEditorError("Trục trặc đường truyền hoàn thiện đơn: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // 3. Tóm tắt đa định dạng (Universal Summarizer)
  const triggerAiSummarizing = async () => {
    setEditorError("");
    if (!summaryFile && !summaryRawText) {
      setEditorError("Vui lòng tải lên tệp tin (PDF, Word, Excel, Ảnh, CSV) hoặc dán văn bản trực tiếp để tóm tắt!");
      return;
    }

    setIsGenerating(true);
    setAiDraft("");

    const phases = [
      "Đang tiếp nhận tệp tin đa định dạng...",
      "Đang giải mã cấu trúc tệp tin (trích xuất ký tự thô)...",
      "Đang định dạng phân dữ liệu bằng hệ tư duy Gemini 2.5...",
      "Sắp xếp thứ tự thời gian, sự kiện và nhân sự được đề cập lịch trình...",
      "Đang đúc kết báo cáo tổng hòa, phân cực ý chính tổ dân bàn..."
    ];

    let currentPhaseIdx = 0;
    setCurrentGenerationPhase(phases[0]);
    const interval = setInterval(() => {
      currentPhaseIdx++;
      if (currentPhaseIdx < phases.length) {
        setCurrentGenerationPhase(phases[currentPhaseIdx]);
      }
    }, 1200);

    try {
      const res = await fetch("/api/gemini/summarize-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileContent: summaryFile?.content || null,
          fileName: summaryFile?.name || null,
          rawText: summaryRawText,
          summaryType: summaryType,
          promptInstructions: summaryInstructions
        })
      });

      const data = await res.json();
      clearInterval(interval);

      if (res.ok) {
        setAiDraft(data.summary);
        setEditorSuccess("AI Tóm tắt văn bản thành công!");
        setTimeout(() => setEditorSuccess(""), 4000);
      } else {
        setEditorError(data.error || "Gặp sự cố khi kết nối hệ thống tóm lược.");
      }
    } catch (err: any) {
      clearInterval(interval);
      setEditorError("Gặp sự cố đường truyền tóm lược: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Save drafts to databases
  const saveAiDraftToArchives = async () => {
    if (!aiDraft) return;

    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: documentTitle || "Văn bản số hành chính tổng hợp",
          templateType: activeTab === "summarize" ? "Tóm tắt tài liệu" : (activeTab === "fill" ? "Bản mẫu hoàn thiện" : currentTemplate.type),
          content: aiDraft,
          createdAt: new Date().toISOString()
        })
      });

      if (res.ok) {
        setEditorSuccess("Văn bản đã được lưu vĩnh viễn vào Kho lưu trữ khu phố!");
        onRefresh();
        setTimeout(() => setEditorSuccess(""), 5000);
      } else {
        setEditorError("Lỗi máy chủ khi ghi nhận lưu kho.");
      }
    } catch {
      setEditorError("Lỗi kết nối máy chủ cơ sở dữ liệu.");
    }
  };

  // Custom original template creation submit
  const handleCreateCustomTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditorError("");
    if (!newTempName || !newTempStructure) {
      setEditorError("Vui lòng điền tên mẫu văn bản và cấu trúc mẫu.");
      return;
    }

    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTempName,
          type: newTempType,
          description: newTempDesc || "Mẫu văn bản đặc thù do tổ dân phố tự tạo lập.",
          structure: newTempStructure
        })
      });

      if (res.ok) {
        const data = await res.json();
        setIsCreatingTemplate(false);
        setNewTempName("");
        setNewTempStructure("");
        onRefresh();
        setSelectedTemplateId(data.id || "");
        setEditorSuccess("Đã lưu trữ mẫu định dạng mới thành công vào hệ thống chung!");
        setTimeout(() => setEditorSuccess(""), 4000);
      } else {
        setEditorError("Không thể tạo mẫu mới.");
      }
    } catch {
      setEditorError("Lỗi kết nối máy chủ lưu trữ.");
    }
  };

  const downloadTextAsExcel = () => {
    if (!aiDraft) return;

    // Smart parsing of markdown paragraphs, bullet lists, and key-value lines
    const lines = aiDraft.split("\n");
    const docMeta: Array<[string, string]> = [
      ["THÔNG TIN PHÂN TÍCH VĂN BẢN (TRÍ CHUẨN HOÀN TOÀN TỰ ĐỘNG BỞI AI)", ""],
      ["Tiêu đề tài liệu:", documentTitle || "Văn bản phân tích hệ thống"],
      ["Phương thức xử lý:", activeTab === "draft" ? "Soạn mẫu mới từ chủ đề" : activeTab === "fill" ? "Tự điền hoàn thiện đơn mẫu khuyết" : "Tóm lược tài liệu & Lên kế hoạch"],
      ["Ngày chuyển đổi từ hệ thống:", formatDate(new Date())]
    ];

    const extractedDetails: Array<[string, string]> = [];
    const mainActionPlan: Array<[number, string]> = [];
    let bulletIndex = 1;

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Detect list/bullet points
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ")) {
        const item = trimmed.replace(/^[-*•]\s*/, "").replace(/\*\*/g, "").trim();
        if (item) {
          mainActionPlan.push([bulletIndex++, item]);
        }
      } else if (/^\d+\.\s/.test(trimmed)) {
        const item = trimmed.replace(/^\d+\.\s/, "").replace(/\*\*/g, "").trim();
        if (item) {
          mainActionPlan.push([bulletIndex++, item]);
        }
      }

      // Detect field names / key-value lines
      const firstColon = trimmed.indexOf(":");
      if (firstColon > 0 && firstColon < 45 && !trimmed.startsWith("http")) {
        const key = trimmed.substring(0, firstColon).replace(/^[-*•]\s*/, "").replace(/^[\d+.]\s*/, "").replace(/[#*_]/g, "").trim();
        const value = trimmed.substring(firstColon + 1).replace(/[#*_]/g, "").trim();
        if (key && value && value.length > 0 && key.length > 2) {
          extractedDetails.push([key, value]);
        }
      }
    });

    const finalAoa: any[][] = [];

    // Section 1: Header info
    docMeta.forEach(row => finalAoa.push(row));
    finalAoa.push([]);

    // Section 2: Form fields
    if (extractedDetails.length > 0) {
      finalAoa.push(["DANH SÁCH CÁC TRƯỜNG THÔNG TIN ĐÃ ĐIỀN CHUẨN HOÁ", ""]);
      finalAoa.push(["Tên mục / Mục khuyết", "Nội dung điền chi tiết"]);
      extractedDetails.forEach(row => finalAoa.push(row));
      finalAoa.push([]);
    }

    // Section 3: Summarized bullet items
    if (mainActionPlan.length > 0) {
      finalAoa.push(["CÁC Ý CHÍNH / KẾ HOẠCH HÀNH ĐỘNG TRIỂN KHAI", ""]);
      finalAoa.push(["STT", "Nội dung công tác trọng điểm"]);
      mainActionPlan.forEach(row => finalAoa.push(row));
      finalAoa.push([]);
    }

    // Section 4: Raw text lines
    finalAoa.push(["CHI TIẾT TOÀN VĂN BẢN TRÌNH BÀY (BẢN THÔ)", ""]);
    lines.forEach(line => {
      finalAoa.push([line]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(finalAoa);

    // Style sheet container columns
    ws["!cols"] = [
      { wch: 35 },
      { wch: 80 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Bao_Cao_AI");
    
    const nameStr = documentTitle || (activeTab === "summarize" ? "Summary_Report" : "Filled_Form");
    const filename = `${nameStr.replace(/\s+/g, "_")}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const downloadTextAsWordDoc = () => {
    if (!aiDraft) return;
    const blob = new Blob([aiDraft], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const title = documentTitle || (activeTab === "summarize" ? "Tom_tat_tai_lieu" : "Van_ban_hoan_thien");
    link.download = `${title.replace(/\s+/g, "_")}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* 1. Left Controls Area (Col spans 5) */}
      <div className="lg:col-span-5 space-y-4">
        
        {/* Navigation Tabs Header */}
        <div className="bg-slate-150 p-1.5 rounded-xl flex gap-1 border border-gray-200">
          <button
            type="button"
            onClick={() => {
              setActiveTab("draft");
              setIsCreatingTemplate(false);
            }}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1 ${
              activeTab === "draft" 
                ? "bg-white text-emerald-800 shadow-sm border border-emerald-100" 
                : "text-gray-500 hover:text-gray-800 hover:bg-white/40"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Soạn mẫu mới
          </button>
          
          <button
            type="button"
            onClick={() => {
              setActiveTab("fill");
              setIsCreatingTemplate(false);
              if (!fillTemplateId && templates.length > 0) {
                setFillTemplateId(templates[0].id);
              }
            }}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1 ${
              activeTab === "fill" 
                ? "bg-white text-emerald-800 shadow-sm border border-emerald-100" 
                : "text-gray-500 hover:text-gray-800 hover:bg-white/40"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            Điền mẫu đơn
          </button>
          
          <button
            type="button"
            onClick={() => {
              setActiveTab("summarize");
              setIsCreatingTemplate(false);
            }}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1 ${
              activeTab === "summarize" 
                ? "bg-white text-emerald-800 shadow-sm border border-emerald-100" 
                : "text-gray-500 hover:text-gray-800 hover:bg-white/40"
            }`}
          >
            <ClipboardCopy className="h-3.5 w-3.5" />
            Tóm tắt tài liệu
          </button>
        </div>

        {/* Dynamic Controls based on selected tab */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4 shadow-3xs">
          
          {/* TAB 1: SOẠN THẢO MỚI THEO CHỦ ĐỀ CHUNG - REDESIGNED EXACTLY LIKE GEMINI */}
          {activeTab === "draft" && (
            <>
              <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                <h3 className="text-xs font-bold text-gray-800 uppercase flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-emerald-600 animate-pulse" />
                  Soạn văn bản AI (Dạng Gemini)
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCreatingTemplate(!isCreatingTemplate)}
                  className="text-xs text-emerald-700 hover:underline font-semibold cursor-pointer"
                >
                  {isCreatingTemplate ? "Quay lại" : "+ Biên soạn mẫu chuẩn"}
                </button>
              </div>

              {!isCreatingTemplate ? (
                <div className="space-y-4 text-xs">
                  {/* Greeting like Gemini */}
                  <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/5 p-4 rounded-xl border border-emerald-100/50 space-y-2 relative overflow-hidden">
                    <div className="flex items-center gap-2">
                      <div className="p-1 px-2.5 rounded-full bg-emerald-600 text-white text-[9px] font-extrabold shadow-xs flex items-center gap-1 animate-pulse">
                        <Sparkles className="h-3 w-3" /> Gemini 2.5 Sẵn sàng
                      </div>
                      <span className="text-[9px] text-emerald-700 font-bold uppercase tracking-wider">Trợ lý Cán bộ Khu phố</span>
                    </div>
                    <h3 className="text-xs font-bold text-gray-800 leading-tight">
                      Tôi có thể hỗ trợ gì cho công tác soạn thảo hành chính của Khu phố hôm nay?
                    </h3>
                    <p className="text-[10px] text-gray-500 leading-relaxed">
                      Hãy nhập trực tiếp yêu cầu của cán bộ, chọn kèm mẫu định dạng (nếu muốn) hoặc tải lên tài liệu tham chiếu (PDF, Ảnh, Word, Excel) để tối ưu hóa văn bản nháp.
                    </p>
                  </div>

                  {/* Suggested Prompts Grid like Gemini */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Gợi ý chủ đề nhanh:</span>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        {
                          title: "✉️ Giấy mời họp",
                          desc: "Họp Tổ dân phố định kỳ",
                          prompt: "Soạn thảo một giấy mời họp ban điều hành Tổ dân phố định kỳ để thảo luận kế hoạch giữ gìn vệ sinh môi trường đô thị và xây dựng tuyến phố văn minh hè 2026."
                        },
                        {
                          title: "📢 Thông báo khẩn",
                          desc: "Lịch ngắt điện trữ nước",
                          prompt: "Soạn thông báo khẩn gửi nhân dân về lịch tạm ngắt nguồn điện cấp nước sinh hoạt vào thứ Bảy tuần này và đề xuất giải pháp trữ nước dự phòng."
                        },
                        {
                          title: "📝 Tờ trình đề xuất",
                          desc: "Trang bị camera an ninh",
                          prompt: "Viết tờ trình kính gửi Thường trực Đảng ủy và UBND Phường xét duyệt cấp ngân sách hỗ trợ trang bị hệ thống loa phát thanh mới cho KP3."
                        },
                        {
                          title: "📋 Biên bản họp",
                          desc: "Giải quyết bất đồng Tổ dân",
                          prompt: "Soạn thảo một biên bản họp giải quyết thắc mắc về tranh chấp ranh giới thoát nước giữa các hộ dân một cách khách quan và đúng pháp luật."
                        }
                      ].map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setDraftPrompt(item.prompt)}
                          className="p-2 border border-gray-100 hover:border-emerald-300 bg-slate-50/50 hover:bg-emerald-50/30 rounded-lg cursor-pointer text-left transition-all space-y-0.5 group shrink-0"
                        >
                          <div className="font-bold text-gray-750 text-[10px] group-hover:text-emerald-700 flex items-center gap-1">
                            {item.title}
                          </div>
                          <p className="text-[8.5px] text-gray-400 line-clamp-1 font-normal">{item.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Optional formatting selection */}
                  <div className="flex flex-col gap-1 select-none">
                    <label className="font-semibold text-gray-600 flex items-center gap-1">
                      <Sliders className="h-3 w-3 text-emerald-700" />
                      Áp dụng cấu trúc mẫu chuẩn (Tùy chọn)
                    </label>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      className="bg-white border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none cursor-pointer text-xs"
                    >
                      <option value="">⚙️ Bố cục thông minh tự động (Khuyên dùng)</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>Chuẩn mẫu: {t.name} ({t.type})</option>
                      ))}
                    </select>
                    {currentTemplate && (
                      <span className="text-[9px] text-emerald-700 italic font-medium mt-0.5">
                        💡 Gemini sẽ đồng bộ cấu trúc với mẫu "{currentTemplate.name}"
                      </span>
                    )}
                  </div>

                  {/* Attachment indicator if a draft file is uploaded */}
                  {draftFile && (
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-2 flex items-center justify-between text-[11px] font-medium text-emerald-800 font-sans">
                      <span className="flex items-center gap-1.5 truncate">
                        <FileText className="h-3.5 w-3.5 text-emerald-600" />
                        Đính kèm: <span className="font-bold truncate max-w-[180px]">{draftFile.name}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setDraftFile(null)}
                        className="text-red-650 hover:text-red-800 text-[10px] font-bold"
                      >
                        Xóa
                      </button>
                    </div>
                  )}

                  {/* Interactive Prompts Container like Gemini */}
                  <div className="relative border border-slate-200 rounded-xl bg-slate-50/40 focus-within:ring-1 focus-within:ring-emerald-500 focus-within:border-emerald-500 overflow-hidden flex flex-col p-2.5 space-y-1.5">
                    
                    {/* Prompt input area */}
                    <textarea
                      rows={4}
                      value={draftPrompt}
                      onChange={(e) => setDraftPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          triggerAiDrafting();
                        }
                      }}
                      placeholder="Hỏi Gemini hoặc ra lệnh soạn hành văn thảo luận... (Nhấn Enter để gửi)"
                      className="w-full bg-transparent resize-none border-0 p-0 text-xs focus:ring-0 focus:outline-none focus:border-0 leading-relaxed text-gray-800 placeholder-gray-400"
                    />

                    {/* Footer bar of prompt input with file and execute trigger */}
                    <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                      
                      {/* Paperclip upload trigger */}
                      <div className="relative">
                        <input
                          type="file"
                          id="gemini-draft-upload"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          accept=".xlsx,.xls,.csv,.docx,.pdf,.png,.jpg,.jpeg,.webp,.txt"
                          onChange={(e) => handleFileChange(e, "draft")}
                        />
                        <button
                          type="button"
                          className="p-1 px-2 border border-gray-200 hover:bg-slate-100 hover:border-gray-300/80 rounded-lg text-gray-500 text-[10px] font-semibold flex items-center gap-1 transition"
                        >
                          <FileUp className="h-3.5 w-3.5 text-slate-500" />
                          <span>Tải tệp nguồn</span>
                        </button>
                      </div>

                      {/* Sparking dynamic send button */}
                      <button
                        type="button"
                        onClick={triggerAiDrafting}
                        disabled={isGenerating || !draftPrompt.trim()}
                        className="bg-emerald-700 hover:bg-emerald-800 disabled:bg-gray-200 text-white rounded-lg px-3.5 py-1.5 font-bold transition flex items-center gap-1 text-[11px] cursor-pointer"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Gửi Gemini
                      </button>

                    </div>
                  </div>

                </div>
              ) : (
                /* Original form to add standard template formatting */
                <form onSubmit={handleCreateCustomTemplate} className="space-y-3.5 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-gray-500 text-[10px] space-y-1">
                    <p className="font-bold text-gray-700">Tự thiết kế kho mẫu riêng cho Tổ/Khu phố</p>
                    <p>Cung cấp sơ tuyển quốc hiệu, định dạng thể thức chuẩn của văn bản, AI sẽ ghi nhớ cấu trúc mẫu này để đồng bộ hóa cho các cán bộ dùng sau này.</p>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-gray-600">Tên mẫu văn bản mới</label>
                    <input
                      type="text"
                      required
                      value={newTempName}
                      onChange={(e) => setNewTempName(e.target.value)}
                      placeholder="Mẫu: Bản tự kiểm điểm đảng viên..."
                      className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none text-xs"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-gray-600">Thể loại biên mục</label>
                    <select
                      value={newTempType}
                      onChange={(e) => setNewTempType(e.target.value)}
                      className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none cursor-pointer text-xs"
                    >
                      <option value="Thông báo">Thông báo</option>
                      <option value="Biên bản họp">Biên bản họp</option>
                      <option value="Báo cáo tháng">Báo cáo tháng</option>
                      <option value="Kế hoạch">Kế hoạch</option>
                      <option value="Giấy mời">Giấy mời</option>
                      <option value="Nghị quyết">Nghị quyết</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-gray-600">Mô tả định hướng cán bộ</label>
                    <input
                      type="text"
                      value={newTempDesc}
                      onChange={(e) => setNewTempDesc(e.target.value)}
                      placeholder="Dùng khi lập biên bản tuần tra hoặc sinh hoạt tổ dân..."
                      className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none text-xs"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-gray-600">Khung bài mẫu / Cấu trúc sườn chuẩn hành chính </label>
                    <textarea
                      rows={5}
                      required
                      value={newTempStructure}
                      onChange={(e) => setNewTempStructure(e.target.value)}
                      placeholder="CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM... &#10;BAN ĐIỀU HÀNH KHU PHỐ 3... &#10;BIÊN BẢN VỀ VIỆC..."
                      className="border border-gray-200 rounded-lg p-2 font-mono text-[10px] focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-emerald-700 text-white font-bold py-2 rounded-xl hover:bg-emerald-800 transition shadow text-xs"
                  >
                    Lưu trữ & Ghi nhớ mẫu mới
                  </button>
                </form>
              )}
            </>
          )}

          {/* TAB 2: ĐIỀN THÔNG TIN CÒN THIẾU VÀO MẪU ĐƠN (TEMPLATE FILLER) */}
          {activeTab === "fill" && (
            <div className="space-y-3.5 text-xs">
              <div className="border-b border-gray-50 pb-2">
                <h3 className="text-xs font-bold text-gray-800 uppercase flex items-center gap-1.5">
                  <FileCheck className="h-4 w-4 text-amber-600" />
                  AI Tự động điền hoàn thiện đơn mẫu
                </h3>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-gray-600">Chọn mẫu đơn hành chính</label>
                <select
                  value={fillTemplateId}
                  onChange={(e) => setFillTemplateId(e.target.value)}
                  className="bg-white border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none cursor-pointer text-xs"
                >
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name} (Chuẩn của Khu)</option>
                  ))}
                  <option value="custom">✍️ Tự sao chép/Nhập mẫu đơn tự chọn</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-gray-600">Xem/Sửa sườn nội dung mẫu đơn gốc (Sẽ điền các ô trống)</label>
                <textarea
                  rows={4}
                  value={customTemplateContent}
                  onChange={(e) => setCustomTemplateContent(e.target.value)}
                  placeholder="Mẫu đơn này có chứa các thông tư, chỗ trống dạng 'Họ tên: ......' hoặc 'Ngày sinh: [Ngày sinh]' để AI điền vào..."
                  className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none text-[10px] font-mono leading-relaxed"
                />
              </div>

              {/* Upload source data file (excel lists, word documents, resident images, notes) */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-gray-600">Tải tệp tin nguồn để trích thông tin (Hồ sơ, Excel, Ảnh ghi chú...)</label>
                <div className="relative border border-dashed border-gray-300 rounded-lg p-3 hover:bg-slate-50 transition text-center cursor-pointer">
                  <input
                    type="file"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    accept=".xlsx,.xls,.csv,.docx,.pdf,.png,.jpg,.jpeg,.webp,.txt"
                    onChange={(e) => handleFileChange(e, "fill")}
                  />
                  <div className="space-y-1">
                    <FileUp className="mx-auto h-5 w-5 text-gray-400" />
                    <p className="text-[10px] font-bold text-gray-600">
                      {fillFile ? `✅ ${fillFile.name}` : "Chọn hoặc kéo thả tệp tại đây"}
                    </p>
                    <p className="text-[8px] text-gray-400">Hỗ trợ Excel, Word, PDF, Hình ảnh, Txt</p>
                  </div>
                </div>
                {fillFile && (
                  <button 
                    type="button" 
                    onClick={() => setFillFile(null)} 
                    className="text-[9px] text-red-650 hover:underline flex items-center gap-0.5 justify-end"
                  >
                    <Trash2 className="h-3 w-3" /> Gỡ bỏ tệp này
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-gray-600">Ghi chú bổ sung thủ công (Ý kiến điền)</label>
                <input
                  type="text"
                  value={fillRawInputs}
                  onChange={(e) => setFillRawInputs(e.target.value)}
                  placeholder="Ví dụ: Họ tên Nguyễn Văn Hải, CCCD 079... Chức vụ Khu Đội Trưởng"
                  className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none text-xs"
                />
              </div>

              <button
                type="button"
                onClick={triggerAiFilling}
                disabled={isGenerating}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-xl transition flex items-center justify-center gap-1.5 shadow cursor-pointer disabled:opacity-50"
              >
                <FileCheck className="h-4 w-4" />
                {isGenerating ? "AI Đang phân tích điền mẫu..." : "AI Tự động xử lý & Điền vào đơn"}
              </button>
            </div>
          )}

          {/* TAB 3: TÓM TẮT ĐA PHƯƠNG TIỆN (UNIVERSAL SUMMARIZER) */}
          {activeTab === "summarize" && (
            <div className="space-y-3.5 text-xs">
              <div className="border-b border-gray-50 pb-2">
                <h3 className="text-xs font-bold text-gray-800 uppercase flex items-center gap-1.5">
                  <ClipboardCopy className="h-4 w-4 text-emerald-600" />
                  AI Tóm tắt văn bản thông minh (Tất cả định dạng)
                </h3>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-gray-600">Kiểu phong cách nội dung đúc kết</label>
                <select
                  value={summaryType}
                  onChange={(e) => setSummaryType(e.target.value)}
                  className="bg-white border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none cursor-pointer text-xs"
                >
                  <option value="Ngắn gọn và đầy đủ nội dung">Ngắn gọn và đầy đủ nội dung (Khuyên dùng)</option>
                  <option value="Toàn diện, đầy đủ ý chính cốt lõi">Toàn diện đầy đủ (Đồng bộ mọi tình tiết)</option>
                  <option value="Ý chính trọng điểm & Lập kế hoạch hành động">Dạng đề cương & Kế hoạch hành động</option>
                  <option value="Số liệu thống kê, tên người và mốc thời gian">Trích lục số liệu, tên nhân khẩu & mốc vụ việc</option>
                  <option value="Lời khuyên chính sách và đề nghị hành chính tổ dân">Tóm tắt ngắn gọn & Tư vấn giải pháp</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-gray-600">Tải lên tệp tin cần tóm lược (PDF, Word, Excel, Hình ảnh...)</label>
                <div className="relative border border-dashed border-emerald-300 rounded-lg p-3 hover:bg-emerald-50/20 transition text-center cursor-pointer">
                  <input
                    type="file"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    accept=".pdf,.docx,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp,.txt"
                    onChange={(e) => handleFileChange(e, "summary")}
                  />
                  <div className="space-y-1">
                    <FileUp className="mx-auto h-5 w-5 text-emerald-600" />
                    <p className="text-[10px] font-bold text-gray-600">
                      {summaryFile ? `✅ ${summaryFile.name}` : "Chọn hoặc kéo tệp của bạn tại đây"}
                    </p>
                    <p className="text-[8px] text-gray-400">PDF, Word, Excel, CSV, Định dạng Ảnh...</p>
                  </div>
                </div>
                {summaryFile && (
                  <button 
                    type="button" 
                    onClick={() => setSummaryFile(null)} 
                    className="text-[9px] text-red-650 hover:underline flex items-center gap-0.5 justify-end"
                  >
                    <Trash2 className="h-3 w-3" /> Gỡ bỏ tệp này
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-gray-600">Hoặc dán văn bản trực tiếp vào đây (Nếu không dùng tệp)</label>
                <textarea
                  rows={4}
                  value={summaryRawText}
                  onChange={(e) => setSummaryRawText(e.target.value)}
                  placeholder="Dán hoặc sao chép nội dung báo cáo cuộc họp Phường, nghị quyết thảo luận, hoặc thắc mắc người dân vào đây..."
                  className="border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none text-[11px] leading-relaxed"
                />
              </div>

              <button
                type="button"
                onClick={triggerAiSummarizing}
                disabled={isGenerating}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2 px-4 rounded-xl transition flex items-center justify-center gap-1.5 shadow cursor-pointer disabled:opacity-50"
              >
                <ClipboardCopy className="h-4 w-4" />
                {isGenerating ? "AI Đang tóm tắt xử lý..." : "Bắt đầu AI Chạy Tóm Tắt"}
              </button>
            </div>
          )}

        </div>
      </div>

      {/* 2. Middle Editor & Output Space (Col spans 7) */}
      <div className="lg:col-span-7 space-y-4">
        
        {/* Loading State Animation with high fidelity details */}
        {isGenerating && (
          <div className="bg-white rounded-xl border border-gray-150 p-10 text-center space-y-4 flex flex-col items-center justify-center min-h-[420px] shadow-3xs animate-pulse">
            <div className="relative">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-emerald-500 border-t-transparent"></div>
              <Sparkles className="absolute inset-0 m-auto h-4 w-4 text-emerald-600 animate-bounce" />
            </div>
            <div className="space-y-2.5 max-w-sm">
              <h4 className="text-xs font-extrabold text-gray-800 uppercase tracking-widest flex items-center justify-center gap-1">
                🤖 Trợ lý Trí tuệ Nhân tạo Gemini 2.5
              </h4>
              <p className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-100 italic">
                {currentGenerationPhase}
              </p>
              <div className="p-3 bg-slate-50 rounded-lg text-[9px] text-gray-400 text-center border font-medium leading-relaxed">
                Hệ thống đang tích hợp thông tin và định dạng cấu trúc theo sơ đồ chuẩn hóa nhà nước Việt Nam, loại bỏ sự rườm rà và lặp từ ngữ hành luật.
              </div>
            </div>
          </div>
        )}

        {/* Regular Editable Preview Workspace */}
        {!isGenerating && (
          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4 min-h-[420px] flex flex-col justify-between shadow-3xs">
            <div className="space-y-3 flex-1 flex flex-col">
              
              <div className="flex justify-between items-center border-b border-gray-100 pb-2 bg-slate-50/50 p-2 rounded-lg">
                <span className="text-xs font-bold text-gray-800 uppercase flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-emerald-600" />
                  Không gian biên tập hành chính & AI tự sinh
                </span>
                
                {aiDraft && (
                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={downloadTextAsWordDoc}
                      className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 cursor-pointer flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition"
                    >
                      <Download className="h-3.5 w-3.5" /> Word (.doc)
                    </button>
                    <button
                      type="button"
                      onClick={downloadTextAsExcel}
                      className="text-[11px] font-bold text-blue-800 hover:text-blue-950 cursor-pointer flex items-center gap-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition"
                    >
                      <Layers className="h-3.5 w-3.5" /> Excel (.xlsx)
                    </button>
                    <button
                      type="button"
                      onClick={saveAiDraftToArchives}
                      className="text-[11px] font-bold text-amber-800 hover:text-amber-950 cursor-pointer flex items-center gap-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg transition"
                    >
                      <Check className="h-3.5 w-3.5" /> Lưu kho
                    </button>
                  </div>
                )}
              </div>

              {editorError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-800 p-3 rounded-lg text-xs font-bold flex items-center gap-1.5 animate-bounce">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{editorError}</span>
                </div>
              )}

              {editorSuccess && (
                <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 p-3 rounded-lg text-xs font-bold flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{editorSuccess}</span>
                </div>
              )}

              {/* Editable drafting textarea */}
              <div className="flex-1 flex flex-col min-h-[280px] mt-1">
                <textarea
                  value={aiDraft}
                  onChange={(e) => setAiDraft(e.target.value)}
                  placeholder="Bản nháp văn bản sẽ xuất hiện ở đây sau khi bạn nhấn nút kích hoạt trí tuệ nhân tạo Gemini ở bảng điều khiển bên trái. Bạn hoàn toàn có thể tự soạn thảo, sửa đổi, bổ sung trực tiếp vào đây cực kỳ linh hoạt..."
                  className="w-full flex-1 bg-gray-50/50 p-4 rounded-xl border border-gray-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 font-normal leading-relaxed text-gray-800 overflow-y-auto resize-none min-h-[300px]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Saved Archives list (Always visible below workspace for easy loading) */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
          <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-gray-50 pb-2">
            <History className="h-4 w-4 text-emerald-600" />
            Nhật ký lưu chứa văn bản khu phố gần đây ({documents.length})
          </h4>

          {documents.length === 0 ? (
            <p className="text-xs italic text-gray-400 text-center py-5">Hệ thống chưa ghi nhận tệp lưu hành nào từ cán bộ.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {documents.slice(0, 4).map(doc => {
                const display = formatDate(doc.createdAt);
                
                return (
                  <div
                    key={doc.id}
                    onClick={() => {
                      setAiDraft(doc.content);
                      setDocumentTitle(doc.title);
                      setEditorSuccess(`Đã nạp văn bản "${doc.title}" thành công vào khung soạn thảo!`);
                      setTimeout(() => setEditorSuccess(""), 3000);
                    }}
                    className="p-3 border border-gray-100 rounded-xl bg-slate-50/60 hover:bg-emerald-50/30 hover:border-emerald-300 cursor-pointer transition text-xs space-y-1.5"
                  >
                    <div className="flex justify-between text-[10px]">
                      <span className="font-bold text-emerald-800 uppercase text-[9px] bg-emerald-50 px-1 py-0.5 rounded">{doc.templateType}</span>
                      <span className="text-gray-400 italic">{display}</span>
                    </div>
                    <p className="font-bold text-gray-800 line-clamp-1">{doc.title}</p>
                    <p className="text-[9px] text-gray-400 flex items-center gap-1">
                      <BookOpen className="h-3 w-3 text-gray-300" /> Nạp nhanh vào khung biên dịch chỉnh sửa
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

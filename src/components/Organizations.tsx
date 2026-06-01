import React, { useState, useEffect } from "react";
import { Resident } from "../types";
import { ShieldCheck, HeartPulse, Sparkles, Footprints, Flame, HelpCircle, GraduationCap, Printer, FolderDot, PiggyBank, FileDown, BadgeCheck, UserCheck, Trash2, History, CalendarRange, Pencil, Gift, Users } from "lucide-react";
import { formatDate } from "../utils/dateTimeUtils";

const removeVietnameseTones = (str: string): string => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
};

interface AiSummaryTextProps {
  text: string;
}

export function AiSummaryText({ text }: AiSummaryTextProps) {
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [isSummarized, setIsSummarized] = useState<boolean>(false);

  const trimmedText = text ? text.trim() : "";
  const isSimple = !trimmedText || trimmedText === "Sức khỏe tốt" || trimmedText === "Trống" || trimmedText.length < 15;

  const handleSummarize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSimple) return;
    
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/gemini/summarize-notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ notes: trimmedText })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.summary) {
          setSummary(data.summary);
          setIsSummarized(true);
        } else {
          setError("Không thể tóm tắt.");
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        setError(errorData.error || "Lỗi máy chủ.");
      }
    } catch (err) {
      setError("Lỗi kết nối.");
    } finally {
      setLoading(false);
    }
  };

  if (isSimple) {
    return <span className="font-normal text-slate-600">{trimmedText || "Sức khỏe tốt"}</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1 w-full max-w-[280px]">
      <div 
        className="text-[11px] leading-normal font-medium text-slate-700 break-words w-full text-left" 
        title={trimmedText}
      >
        {isSummarized ? (
          <div className="bg-emerald-50/80 border border-emerald-100 p-2 rounded-lg text-[10px] text-emerald-900 leading-normal text-left shadow-2xs font-medium relative pr-8">
            <span className="absolute right-1.5 top-1.5 text-[8px] text-emerald-700 font-extrabold flex items-center gap-0.5 select-none bg-white border border-emerald-100 px-1 py-0.2 rounded">
              <Sparkles className="h-2 w-2" /> AI
            </span>
            <span className="font-bold text-emerald-800 text-[9px] block mb-0.5">Tóm tắt bởi AI:</span>
            {summary}
          </div>
        ) : (
          <span className="line-clamp-2" title={trimmedText}>{trimmedText}</span>
        )}
      </div>

      {!isSummarized && (
        <button
          type="button"
          onClick={handleSummarize}
          disabled={loading}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-750 hover:text-blue-800 text-[9px] font-bold rounded cursor-pointer transition border border-blue-100/50 outline-none select-none disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-2xs no-print"
        >
          <Sparkles className="h-2.5 w-2.5 text-blue-600 animate-pulse" />
          {loading ? "Đang tóm tắt..." : "Tóm tắt AI"}
        </button>
      )}

      {error && (
        <span className="text-[9px] text-rose-500 italic mt-0.5 leading-none">{error}</span>
      )}
    </div>
  );
}

export interface Appointment {
  residentId: string;
  fullName: string;
  groupKey: string;
  title: string;
  task: string;
  dateStr: string;
  year: number;
  isKiemNhiem: boolean;
  rawLine: string;
}

interface OrganizationsProps {
  residents: Resident[];
  activeRole: string;
  onRefresh: () => void;
  currentUser?: any;
}

interface GroupConfig {
  key: string;
  name: string;
  type: "group" | "special" | "military";
  icon: any;
  color: string;
  desc: string;
  policies: string[];
}

const GROUPS_META: GroupConfig[] = [
  {
    key: "CCB",
    name: "Chi hội Cựu Chiến Binh",
    type: "group",
    icon: Flame,
    color: "bg-emerald-700 text-white",
    desc: "Đoàn thể tập hợp cựu chiến binh cách mạng, phát huy bản chất bộ đội Cụ Hồ, gương sáng cho địa phương.",
    policies: ["Trợ cấp thương binh", "Thăm viếng dịp 27/7", "Khuyến học Con em CCB"]
  },
  {
    key: "Phụ nữ",
    name: "Chi hội Phụ Nữ",
    type: "group",
    icon: Sparkles,
    color: "bg-pink-600 text-white",
    desc: "Tổ chức bảo vệ và phát huy quyền công bằng, chăm lo sức khỏe sinh sản, phát triển kinh tế hộ gia đình.",
    policies: ["Quỹ tiết kiệm tương hỗ", "Phát động gia đình 5 không 3 sạch", "Tặng quà kỷ niệm 20/10"]
  },
  {
    key: "Thanh niên",
    name: "Chi đoàn Thanh Niên",
    type: "group",
    icon: GraduationCap,
    color: "bg-blue-600 text-white",
    desc: "Lực lượng xung kích đi đầu trong chuyển đổi số, dọn dẹp vệ sinh hè phố, phòng chống bão lụt.",
    policies: ["Chiến dịch Mùa hè xanh", "Phong trào kỹ năng công nghệ", "Hỗ trợ học phí khó khăn"]
  },
  {
    key: "Chữ thập đỏ",
    name: "Hội Chữ Thập Đỏ",
    type: "group",
    icon: HeartPulse,
    color: "bg-red-600 text-white",
    desc: "Chi hội chữ thập đỏ phụ trách các công tác hiến máu cứu người, chăm lo y tế cơ động, phòng chống dịch bệnh.",
    policies: ["Hỗ trợ hiến máu nhân đạo", "Khám bệnh phát thuốc từ thiện", "Cứu hộ khẩn cấp tai nạn"]
  },
  {
    key: "Đảng viên",
    name: "Đảng viên Chi bộ Khu phố",
    type: "group",
    icon: ShieldCheck,
    color: "bg-red-700 text-white",
    desc: "Đảng viên sinh hoạt Đảng chính thức tại Chi bộ Khu phố 3, giữ vai trò tiền phong gương mẫu và nòng cốt chính trị địa phương.",
    policies: ["Trợ cấp sinh hoạt Chi ủy", "Tặng huy hiệu tuổi Đảng", "Chăm lo tết Nguyên Đán cán bộ hưu trí"]
  },
  {
    key: "Đảng viên 213",
    name: "Đảng viên Quy định 213",
    type: "group",
    icon: ShieldCheck,
    color: "bg-red-750 text-white border border-red-500",
    desc: "Tập hợp đảng viên sinh hoạt tại cơ quan làm việc nhưng lưu giữ liên lạc, tham gia biểu quyết tại địa bàn cư trú.",
    policies: ["Ghi nhận đóng góp xây dựng", "Họp liên hiệp tri kỷ 2 lần/năm", "Ủng hộ quỹ khu phố"]
  },
  {
    key: "Hộ nghèo",
    name: "Gia đình Diệu Nghèo / Khó khăn",
    type: "special",
    icon: PiggyBank,
    color: "bg-orange-600 text-white",
    desc: "Các hộ gia đình nghèo, khó khăn đặc biệt thuộc diện ưu tiên nhận lương thực, thẻ y tế miễn phí.",
    policies: ["Cấp phát gạo chính sách", "Vay vốn xóa đói giảm nghèo", "Chăm lo quà tết Nguyên Đán"]
  },
  {
    key: "Hộ cận nghèo",
    name: "Hộ Cận Nghèo Địa Bàn",
    type: "special",
    icon: PiggyBank,
    color: "bg-amber-600 text-white",
    desc: "Các hộ gia đình cận nghèo có thu nhập cận chuẩn nghèo của thành phố, được quan tâm trợ cấp bảo trợ y tế, giáo dục.",
    policies: ["Hỗ trợ mua thẻ bảo hiểm y tế", "Giảm học phí học sinh nghèo hiếu học", "Nhận quà từ thiện Tết cận nghèo"]
  },
  {
    key: "Người khuyết tật",
    name: "Người Khuyết Tật",
    type: "special",
    icon: Footprints,
    color: "bg-indigo-600 text-white",
    desc: "Theo dõi số lượng công dân khiếm khuyết vận động, giác quan trên địa bàn, kết nối trung tâm bảo trợ xã hội.",
    policies: ["Trợ cấp tàn tật hàng tháng", "Cấp xe lăn phục hồi chức năng", "Kiểm tra y đức tại nhà"]
  },
  {
    key: "Trẻ em",
    name: "Trẻ em (Dưới 16 tuổi)",
    type: "special",
    icon: Sparkles,
    color: "bg-amber-500 text-white",
    desc: "Theo dõi tiêm chủng định kỳ, học tập tiểu học, chăm lo ngày thiếu nhi 1/6, Tết trung thu.",
    policies: ["Tặng quà quốc tế thiếu nhi", "Tiêm chủng mở rộng phòng lao, bại liệt", "Quỹ lồng đèn trung thu"]
  },
  {
    key: "Ban điều hành",
    name: "Ban điều hành Khu phố",
    type: "group",
    icon: FolderDot,
    color: "bg-slate-700 text-white",
    desc: "Các cán bộ cốt cán chịu trách nhiệm ký duyệt giấy tờ, quản lý chính quyền Tổ dân phố 3.",
    policies: ["Họp giao ban UBND Phường", "Phân phối phụ cấp công vụ", "Tuần tra an ninh cơ sở"]
  },
  {
    key: "Ban công tác Mặt trận",
    name: "Ban công tác Mặt Trận",
    type: "group",
    icon: ShieldCheck,
    color: "bg-cyan-700 text-white",
    desc: "Ủy ban đoàn kết kết nối khối đại đoàn kết toàn dân tộc, làm cầu nối giữa chính quyền và nhân dân.",
    policies: ["Hòa giải mâu thuẫn xóm làng", "Ngày hội Đại đoàn kết 18/11", "Vận động Quỹ Vì người nghèo"]
  },
  {
    key: "NCT",
    name: "Người Cao Tuổi & Bảo Thọ",
    type: "special",
    icon: HeartPulse,
    color: "bg-teal-600 text-white",
    desc: "Danh mục quản lý người cao tuổi địa bàn. Hỗ trợ tra chiếu các mốc mừng thọ (≥ 70 tuổi) và hưởng thẻ bảo hiểm y tế miễn phí (≥ 60 tuổi) theo quy định HCMC.",
    policies: ["Mừng thọ Khánh Vàng tuổi chẵn", "Cấp thẻ BHYT ưu đãi HCMC", "Quyên góp thuốc men lão khoa"]
  },
  {
    key: "Người có công",
    name: "Hồ sơ chính sách Người có công với Cách mạng",
    type: "special",
    icon: Flame,
    color: "bg-red-800/90 text-white",
    desc: "Quản lý diện chính sách ưu đãi Người có công với Cách mạng: Thương binh, Bệnh binh, Thân nhân liệt sĩ, Bà mẹ VN anh hùng, và gia đình có công truyền thống.",
    policies: ["Trợ cấp tuất / Thương tật hàng tháng", "Quà tặng lễ Tết / Ngày 27/7 tri ân", "Hỗ trợ học phí / Đóng bảo hiểm y tế"]
  },
  {
    key: "Nghĩa vụ & Dự bị",
    name: "Hồ sơ Nghĩa vụ Quân sự & Dự bị động viên (Chuyên môn Khu Đội Trưởng)",
    type: "military",
    icon: Flame,
    color: "bg-amber-800 text-white",
    desc: "Danh sách công dân nam trong độ tuổi gọi nhập ngũ (18-27 tuổi), thanh niên tuổi 17 đăng ký NVQS, quân nhân dự bị và sĩ quan dự bị trên địa bàn khu phố 3.",
    policies: ["Hỗ trợ thanh niên lên đường nhập ngũ", "Trợ cấp huấn luyện dân cư dự bị", "Bồi dưỡng chính sách hậu phương quân đội"]
  },
  {
    key: "Dân quân tự vệ",
    name: "Lực lượng Dân quân Tự vệ (Chuyên môn Khu Đội Trưởng)",
    type: "military",
    icon: ShieldCheck,
    color: "bg-emerald-800/90 text-white",
    desc: "Quản lý lực lượng dân quân tự vệ nòng cốt địa bàn khu phố 3: gồm Dân quân tại chỗ, Dân quân cơ động, Dân quân thường trực và các đội tuần tra kết hợp an ninh địa bàn.",
    policies: ["Hỗ trợ huấn luyện dân quân nòng cốt", "Trợ cấp ngày công tuần tra liên phường", "Sắm trang bị, công cụ hỗ trợ phòng vệ địa phương"]
  },
  {
    key: "An ninh trật tự cơ sở",
    name: "An ninh trật tự cơ sở",
    type: "group",
    icon: ShieldCheck,
    color: "bg-blue-800 text-white border-l-4 border-blue-500",
    desc: "Lực lượng tham gia bảo vệ an ninh, trật tự ở cơ sở địa bàn khu phố 3, do công an khu vực trực tiếp phụ trách và quản lý.",
    policies: ["Trợ cấp tuần tra đêm bồi dưỡng", "Khen thưởng bảo đảm an ninh trật tự xuất sắc", "Hỗ trợ trang thiết bị, công cụ hỗ trợ phòng chống tội phạm"]
  }
];

export default function Organizations({ residents, activeRole, onRefresh, currentUser }: OrganizationsProps) {
  const [selectedGroupKey, setSelectedGroupKey] = useState("CCB");
  const [specialSubView, setSpecialSubView] = useState<"list" | "distribute">("list");
  
  // NCT state filters
  const [nctSubTab, setNctSubTab] = useState<"mung-tho" | "bhyt">("mung-tho");
  const [mungThoMilestone, setMungThoMilestone] = useState<string>("All");

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

  const [expandedMilSubcats, setExpandedMilSubcats] = useState<Record<string, boolean>>({
    "Nam công dân tuổi 18-27 (Độ tuổi gọi nhập ngũ)": true,
    "Thanh niên tuổi 17 đăng ký NVQS": true,
    "Dân quân tự vệ nòng cốt": true,
    "Dân quân tự vệ tại chỗ": true,
    "Dân quân tự vệ cơ động": true
  });

  const toggleSubcat = (subcat: string) => {
    setExpandedMilSubcats(prev => ({
      ...prev,
      [subcat]: prev[subcat] === false ? true : false
    }));
  };

  // Helper to calculate age from DOB string
  const getAge = (dobString: string): number => {
    if (!dobString) return 0;
    const birth = new Date(dobString);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const getResidentMilestoneKey = (age: number): string => {
    if (age >= 100) return "100";
    if (age >= 95) return "95";
    if (age >= 90) return "90";
    if (age >= 85) return "85";
    if (age >= 80) return "80";
    if (age >= 75) return "75";
    if (age >= 70) return "70";
    return "none";
  };

  const getMungThoMilestoneLabel = (age: number): string => {
    if (age >= 100) return "Khánh thọ (≥ 100 tuổi)";
    if (age >= 95) return "Đại thọ (Tròn 95 tuổi)";
    if (age >= 90) return "Thượng thọ (Tròn 90 tuổi)";
    if (age >= 85) return "Thượng thọ (Tròn 85 tuổi)";
    if (age >= 80) return "Thượng thọ (Tròn 80 tuổi)";
    if (age >= 75) return "Mừng thọ (Tròn 75 tuổi)";
    if (age >= 70) return "Mừng thọ (Tròn 70 tuổi)";
    return "Không đạt mốc năm chẵn";
  };
  
  // Specific support distribution record logging state (Simulation)
  const [targetResidentId, setTargetResidentId] = useState("");
  const [selectedPolicy, setSelectedPolicy] = useState("");
  const [supportValue, setSupportValue] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [actionError, setActionError] = useState("");

  // Role & Duty assignment state
  const [recipientSearchQuery, setRecipientSearchQuery] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [assignedTitle, setAssignedTitle] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [assignedTask, setAssignedTask] = useState("");
  const [appointmentDate, setAppointmentDate] = useState(new Date().toISOString().substring(0, 10));
  const [assignSuccess, setAssignSuccess] = useState("");
  const [assignError, setAssignError] = useState("");
  const [isKiemNhiem, setIsKiemNhiem] = useState(true);
  const [historyYearFilter, setHistoryYearFilter] = useState("all");

  // Editing active appointment states
  const [editingApp, setEditingApp] = useState<Appointment | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editTask, setEditTask] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editIsKiemNhiem, setEditIsKiemNhiem] = useState(false);

  const [customConfirm, setCustomConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [customAlert, setCustomAlert] = useState<string | null>(null);

  // Welfare anti-duplicate distribution dashboard states
  const [welfareGiftToSelect, setWelfareGiftToSelect] = useState("");
  const [customWelfareGift, setCustomWelfareGift] = useState("");
  const [welfareYear, setWelfareYear] = useState(new Date().getFullYear());
  const [welfareFilterStatus, setWelfareFilterStatus] = useState<"All" | "Received" | "Pending">("All");
  const [welfareSearchQuery, setWelfareSearchQuery] = useState("");

  useEffect(() => {
    const titles = getPresetTitlesForGroup(selectedGroupKey);
    if (titles && titles.length > 0) {
      setWelfareGiftToSelect(titles[0]);
    } else {
      setWelfareGiftToSelect("");
    }
    setCustomWelfareGift("");
  }, [selectedGroupKey]);

  const PRESET_TASKS = [
    "Phụ trách phong trào thi đua, vận động tham gia hoạt động khu phố",
    "Quản lý thu chi, quỹ tương trợ và hậu cần của chi hội/đoàn thể",
    "Chủ trì hòa giải các mâu thuẫn, tranh chấp nội bộ địa bàn dân cư",
    "Tổ chức, thường trực tuần tra kiểm soát bảo đảm an ninh trật tự cơ sở",
    "Chăm lo đời sống an sinh xã hội cho hộ nghèo, cận nghèo và gia đình chính sách",
    "Phụ trách lực lượng xung kích phòng chống lụt bão, cứu nạn cứu hộ",
    "Theo dõi, quản lý hồ sơ đăng ký NVQS thanh niên và huấn luyện quân sự địa phương",
    "Điều hành kết nối hoạt động Ngày hội Đại đoàn kết toàn dân tộc",
    "Lãnh đạo, triển khai phong trào Chuyển đổi số và phổ biến công nghệ cộng đồng"
  ];

  const PRESET_SPECIAL_TASKS = [
    "Nhận 10kg gạo sạch và gói nhu yếu phẩm (mì tôm, nước tương, đường, bột ngọt)",
    "Hỗ trợ quà Tết Nguyên Đán trị giá 500,000đ từ quỹ tương thân tương ái",
    "Bảo trợ thẻ Bảo hiểm y tế miễn phí thời hạn 1 năm do ngân sách hỗ trợ",
    "Hỗ trợ đột xuất gia cảnh khó khăn trị giá 1,000,000đ tiền mặt",
    "Tặng học bổng vượt khó hiếu học Nguyễn Hữu Thọ trị giá 1,500,000đ đầu năm học mới",
    "Nhận quà Trung Thu (lồng đèn, sữa tết thiếu nhi và bánh nướng)",
    "Trao tặng Khánh Vàng và tiền mặt mừng thọ cấp của UBND",
    "Hỗ trợ sửa xe lăn phục hồi chức năng hoặc phương tiện di chuyển ưu đãi",
    "Trợ giúp y tế thường kỳ và cấp phát tủ thuốc nam tại nhà"
  ];

  const getPresetTitlesForGroup = (groupKey: string): string[] => {
    switch (groupKey) {
      case "Hộ nghèo":
      case "Hộ cận nghèo":
        return [
          "Quà tặng Tết Nguyên Đán",
          "Gạo cứu trợ chính sách",
          "Thẻ BHYT hoàn toàn miễn phí",
          "Trợ cấp tiền mặt ưu đãi",
          "Gói bảo trợ nhu yếu phẩm tháng",
          "Học bổng vượt khó học tập",
          "Vay vốn xóa đói giảm nghèo"
        ];
      case "Người khuyết tật":
        return [
          "Trợ cấp khuyết tật hàng tháng",
          "Xe lăn phục hồi chức năng",
          "Thẻ BHYT diện bảo trợ xã hội",
          "Quà tặng lễ Tết tình thương",
          "Suất y đức bác sĩ gia đình"
        ];
      case "Trẻ em":
        return [
          "Quà Quốc tế Thiếu nhi (1/6)",
          "Quà Trung thu niên khóa",
          "Học bổng hiếu học chi hội",
          "Bộ tập vở dụng cụ học tập mới",
          "Gói sữa hỗ trợ dinh dưỡng"
        ];
      case "NCT":
        return [
          "Khánh vàng Chúc thọ tuổi chẵn",
          "Quà mừng thọ UBND Phường An Phú",
          "Thẻ BHYT miễn phí tuổi 60+",
          "Quà tặng ngày Quốc tế Người cao tuổi",
          "Suất kiểm tra sức khỏe lão khoa miễn phí"
        ];
      case "Người có công":
        return [
          "Quà tặng tri ân Ngày Thương binh Liệt sĩ (27/7)",
          "Trợ cấp tuất liệt sĩ hàng tháng",
          "Sổ tiết nghiệm nghĩa tình tri ân",
          "Quà tặng Quốc khánh 2/9",
          "Quà Tết chính sách người có công"
        ];
      case "CCB":
        return ["Chi hội trưởng", "Chi hội phó", "Phân hội trưởng", "Phân hội phó", "Ủy viên Ban chấp hành Chi hội", "Hội viên nòng cốt"];
      case "Phụ nữ":
        return ["Chi hội trưởng", "Chi hội phó", "Tổ trưởng Thừa hành phụ nữ", "Tổ phó Thừa hành phụ nữ", "Ủy viên Ban chấp hành", "Hội viên tích cực"];
      case "Thanh niên":
        return ["Bí thư Chi đoàn", "Phó Bí thư Chi đoàn", "Ủy viên Ban chấp hành Chi đoàn", "Đoàn viên nòng cốt", "Đội trưởng xung kích"];
      case "Chữ thập đỏ":
        return ["Chi hội trưởng Chi hội CTĐ", "Chi hội phó Chi hội CTĐ", "Ủy viên Ban chấp hành CTĐ", "Tuyên truyền viên nòng cốt", "Tình nguyện viên chữ thập đỏ"];
      case "Đảng viên":
      case "Đảng viên 213":
        return ["Bí thư Chi bộ", "Phó Bí thư Chi bộ", "Chi ủy viên Chi bộ", "Tổ trưởng Tổ Đảng", "Đảng viên sinh hoạt nòng cốt"];
      case "Ban điều hành":
        return ["Trưởng ban điều hành KP3", "Phó ban điều hành KP3", "Tổ trưởng Tổ dân phố", "Tổ phó Tổ dân phố", "Trưởng ban liên sinh hoạt", "Cán bộ an sinh xã hội"];
      case "Ban công tác Mặt trận":
        return ["Trưởng ban công tác Mặt trận", "Phó ban công tác Mặt trận", "Ủy viên Mặt trận nòng cốt"];
      case "Nghĩa vụ & Dự bị":
        return ["Khu Đội Trưởng", "Quân nhân dự bị nòng cốt", "Sĩ quan chỉ huy liên chi", "Trung đội trưởng Thử thách", "Tiểu đội trưởng Dự bị động viên"];
      case "Dân quân tự vệ":
        return ["Trung đội trưởng Dân quân", "Tiểu đội trưởng Dân quân", "Chi đội trưởng tuần tra", "Đội viên dân quân thường trực", "Dân quân tại chỗ cơ sở"];
      case "An ninh trật tự cơ sở":
        return [
          "Tổ trưởng Tổ Bảo vệ ANTT",
          "Tổ phó Tổ Bảo vệ ANTT",
          "Tổ viên Tổ Bảo vệ ANTT",
          "Chi đội trưởng tự quản tuần tra",
          "Công an viên phụ trách",
          "Cán bộ liên tổ dự phòng"
        ];
      default:
        return ["Trưởng nhóm đại diện", "Phó nhóm đại diện", "Thành viên nòng cốt phụ trách", "Cán bộ điều hành hành chính"];
    }
  };

  const handleAssignRoleAndDuty = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssignSuccess("");
    setAssignError("");

    if (!assigneeId) {
      setAssignError("Vui lòng chọn nhân sự để phân công!");
      return;
    }

    const finalTitle = assignedTitle === "Khác" ? customTitle : assignedTitle;
    if (!finalTitle) {
      setAssignError(currentGroup.type === "special" ? "Vui lòng chỉ định loại quà tặng/hỗ trợ!" : "Vui lòng chỉ định chức danh đảm nhiệm!");
      return;
    }

    if (!assignedTask) {
      setAssignError(currentGroup.type === "special" ? "Vui lòng nhập chi tiết quà tặng & ghi chú!" : "Vui lòng lựa chọn hoặc nhập nhiệm vụ phân công!");
      return;
    }

    const resObj = residents.find(r => r.id && r.id.toString().trim() === assigneeId.toString().trim());
    if (!resObj) return;

    // Formatting date
    const dateParts = appointmentDate.split("-");
    const dateFormatted = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : appointmentDate;
    
    // Normalize existing notes and replace if not cumulative/kiêm nhiệm
    const isSpecial = currentGroup.type === "special";
    let cleanNotes = resObj.notes || "";
    if (!isKiemNhiem) {
      if (isSpecial) {
        cleanNotes = cleanNotes
          .split(/\r?\n/)
          .filter(line => !line.includes(`[An sinh xã hội - Hỗ trợ: ${currentGroup.key}]`))
          .join("\n");
      } else {
        cleanNotes = cleanNotes
          .split(/\r?\n/)
          .filter(line => !line.includes(`[Biên chế quản lý - Đoàn thể: ${currentGroup.key}]`))
          .join("\n");
      }
    }

    const formattedNote = isSpecial
      ? `[An sinh xã hội - Hỗ trợ: ${currentGroup.key}] Đã nhận: [${finalTitle}] - Nội dung hỗ trợ: [${assignedTask}] vào ngày ${dateFormatted}.`
      : `[Biên chế quản lý - Đoàn thể: ${currentGroup.key}] Bổ nhiệm: [${finalTitle}] - Nhiệm vụ: [${assignedTask}] kể từ ngày ${dateFormatted}${isKiemNhiem ? " (Kiêm nhiệm)" : ""}.`;

    const updatedNotes = cleanNotes.trim() ? `${cleanNotes.trim()}\n${formattedNote}` : formattedNote;

    // Synchronize membership dynamically
    let updatedGroups = [...(resObj.groups || [])];
    let updatedSpecials = [...(resObj.specialCategories || [])];
    let updatedMilitaries = [...(resObj.militaryCategories || [])];

    if (currentGroup.type === "group") {
      if (!updatedGroups.includes(currentGroup.key)) {
        updatedGroups.push(currentGroup.key);
      }
    } else if (currentGroup.type === "special") {
      if (!updatedSpecials.includes(currentGroup.key)) {
        updatedSpecials.push(currentGroup.key);
      }
    } else if (currentGroup.type === "military") {
      if (selectedGroupKey === "Dân quân tự vệ") {
        if (!updatedMilitaries.includes("Dân quân tự vệ nòng cốt") && !updatedMilitaries.some(cat => MILITIA_SUBCATEGORIES.includes(cat))) {
          updatedMilitaries.push("Dân quân tự vệ nòng cốt");
        }
      } else {
        if (!updatedMilitaries.includes("Quân nhân dự bị (Hạng nhất/Hạng hai)") && !updatedMilitaries.some(cat => MILITARY_RESERVE_SUBCATEGORIES.includes(cat))) {
          updatedMilitaries.push("Quân nhân dự bị (Hạng nhất/Hạng hai)");
        }
      }
    }

    try {
      const res = await fetch(`/api/residents/${resObj.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-name": encodeURIComponent(currentUser?.fullName || "Ban cán sự khu phố"),
          "x-user-role": encodeURIComponent(activeRole || ""),
          "x-user-email": encodeURIComponent(currentUser?.email || "")
        },
        body: JSON.stringify({ 
          ...resObj, 
          notes: updatedNotes,
          groups: updatedGroups,
          specialCategories: updatedSpecials,
          militaryCategories: updatedMilitaries
        })
      });

      if (res.ok) {
        setAssignSuccess(isSpecial 
          ? `Ghi nhận thành công khoản hỗ trợ cho người dân ${resObj.fullName}!`
          : `Bổ nhiệm thành công chức vụ cho cán bộ ${resObj.fullName}!`
        );
        setAssigneeId("");
        setAssignedTitle("");
        setCustomTitle("");
        setAssignedTask("");
        onRefresh();
        setTimeout(() => setAssignSuccess(""), 5000);
      } else {
        setAssignError(isSpecial ? "Có lỗi xảy ra khi lưu thông tin hỗ trợ." : "Có lỗi xảy ra khi lưu biên chế bổ nhiệm.");
      }
    } catch {
      setAssignError("Kết nối máy chủ bị lỗi.");
    }
  };

  const getAllAppointments = (): Appointment[] => {
    const list: Appointment[] = [];
    residents.forEach(res => {
      if (!res.notes) return;
      const lines = res.notes.split(/\r?\n/).map(l => l.replace(/\r/g, "").trim()).filter(Boolean);
      lines.forEach(line => {
        let match = line.match(/\[Biên chế quản lý - Đoàn thể:\s*([^\]]+)\]\s*Bổ nhiệm:\s*\[([^\]]+)\]\s*-\s*Nhiệm vụ:\s*\[([^\]]+)\]\s*kể từ ngày\s*([\d/]+)(?:\s*\(([^)]+)\))?/);
        if (match) {
          const groupKey = match[1].trim();
          const title = match[2].trim();
          const task = match[3].trim();
          const dateStr = match[4].trim();
          const extra = match[5] || "";
          const isKiem = extra.includes("Kiêm nhiệm") || line.includes("Kiêm nhiệm");
          let year = new Date().getFullYear();
          const dateParts = dateStr.split("/");
          if (dateParts.length === 3) {
            const parsedY = parseInt(dateParts[2], 10);
            if (!isNaN(parsedY)) year = parsedY;
          }
          list.push({
            residentId: res.id,
            fullName: res.fullName,
            groupKey,
            title,
            task,
            dateStr,
            year,
            isKiemNhiem: isKiem,
            rawLine: line
          });
        } else {
          let welfMatch = line.match(/\[An sinh xã hội - Hỗ trợ:\s*([^\]]+)\]\s*Đã nhận:\s*\[([^\]]+)\]\s*-\s*Nội dung hỗ trợ:\s*\[([^\]]+)\]\s*vào ngày\s*([\d/]+)/);
          if (welfMatch) {
            const groupKey = welfMatch[1].trim();
            const title = welfMatch[2].trim();
            const task = welfMatch[3].trim();
            const dateStr = welfMatch[4].trim();
            let year = new Date().getFullYear();
            const dateParts = dateStr.split("/");
            if (dateParts.length === 3) {
              const parsedY = parseInt(dateParts[2], 10);
              if (!isNaN(parsedY)) year = parsedY;
            }
            list.push({
              residentId: res.id,
              fullName: res.fullName,
              groupKey,
              title,
              task,
              dateStr,
              year,
              isKiemNhiem: false,
              rawLine: line
            });
          } else {
            const oldMatch = line.match(/\[Biên chế quản lý\]\s*Bổ nhiệm\s*\[([^\]]+)\]\s*-\s*Phân công nhiệm vụ:\s*\[([^\]]+)\]\s*kể từ ngày\s*([\d/]+)/);
            if (oldMatch) {
              const title = oldMatch[1].trim();
              const task = oldMatch[2].trim();
              const dateStr = oldMatch[3].trim();
              let year = new Date().getFullYear();
              const dateParts = dateStr.split("/");
              if (dateParts.length === 3) {
                const parsedY = parseInt(dateParts[2], 10);
                if (!isNaN(parsedY)) year = parsedY;
              }
              list.push({
                residentId: res.id,
                fullName: res.fullName,
                groupKey: selectedGroupKey,
                title,
                task,
                dateStr,
                year,
                isKiemNhiem: line.includes("Kiêm nhiệm"),
                rawLine: line
              });
            }
          }
        }
      });
    });
    return list;
  };

  const handleExportAppointmentsCSV = (yearVal: string) => {
    const isSpecial = currentGroup.type === "special";
    
    const headers = isSpecial 
      ? "STT,Danh mục an sinh,Họ và tên người nhận,Quà tặng / Vật phẩm đã nhận,Chi tiết quà & Ghi chú,Ngày nhận quà/hỗ trợ,Năm"
      : "STT,Ban điều hành / Chi hội / Đoàn thể,Họ và tên nhân sự,Chức danh bổ nhiệm,Nhiệm vụ quản lý phân công,Ngày bổ nhiệm,Trạng thái";

    const csvRows = [
      "\uFEFF" + headers
    ];

    let filteredApps = getAllAppointments().filter(app => app.groupKey === selectedGroupKey);
    if (yearVal !== "all") {
      filteredApps = filteredApps.filter(app => app.year === parseInt(yearVal, 10));
    }

    filteredApps.forEach((app, idx) => {
      const gName = GROUPS_META.find(g => g.key === app.groupKey)?.name || app.groupKey;
      const titleEsc = `"${app.title.replace(/"/g, '""')}"`;
      const taskEsc = `"${app.task.replace(/"/g, '""')}"`;
      
      if (isSpecial) {
        csvRows.push(
          `${idx + 1},"${gName}","${app.fullName}",${titleEsc},${taskEsc},${app.dateStr},${app.year}`
        );
      } else {
        const statusStr = app.isKiemNhiem ? "Kiêm nhiệm" : "Chính thức";
        csvRows.push(
          `${idx + 1},"${gName}","${app.fullName}",${titleEsc},${taskEsc},${app.dateStr},${statusStr}`
        );
      }
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const yearLabel = yearVal === "all" ? "Moi_Nam" : `Nam_${yearVal}`;
    const filename = isSpecial 
      ? `Danh_Sach_An_Sinh_Nhan_Qua_${selectedGroupKey}_${yearLabel}.csv`
      : `Danh_Sach_Bien_Che_Bo_Nhiem_${selectedGroupKey}_${yearLabel}.csv`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseDateToInputFormat = (dateStr: string): string => {
    if (!dateStr) return new Date().toISOString().substring(0, 10);
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const day = parts[0].padStart(2, "0");
      const month = parts[1].padStart(2, "0");
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    return dateStr;
  };

  const handleRevokeAppointment = (app: Appointment) => {
    const isSpecialTarget = GROUPS_META.find(g => g.key === app.groupKey)?.type === "special";
    const actionLabel = isSpecialTarget ? "thông tin nhận hỗ trợ/quà tặng" : "quyết định bổ nhiệm chức vụ";
    
    setCustomConfirm({
      message: `Bạn có chắc chắn muốn hủy ${actionLabel} [${app.title}] của ông/bà [${app.fullName}] không?`,
      onConfirm: async () => {
        const resObj = residents.find(r => r.id && r.id.toString().trim() === app.residentId.toString().trim());
        if (!resObj) return;

        const currentNotes = resObj.notes || "";
        const cleanRawLine = app.rawLine.replace(/\r/g, "").trim();
        const updatedNotes = currentNotes
          .split(/\r?\n/)
          .map(line => line.replace(/\r/g, "").trim())
          .filter(line => {
            if (!line) return false;
            if (line === cleanRawLine) return false;
            
            // Fallback matching to guarantee successful deletion is not bypassed by character formatting bugs
            const hasTitle = line.includes(app.title);
            const hasTask = line.includes(app.task);
            if (hasTitle && hasTask) {
              return false;
            }
            return true;
          })
          .join("\n");

        try {
          const res = await fetch(`/api/residents/${resObj.id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "x-user-name": encodeURIComponent(currentUser?.fullName || "Ban cán sự khu phố"),
              "x-user-role": encodeURIComponent(activeRole || ""),
              "x-user-email": encodeURIComponent(currentUser?.email || "")
            },
            body: JSON.stringify({ ...resObj, notes: updatedNotes })
          });

          if (res.ok) {
            setAssignSuccess(isSpecialTarget 
              ? `Đã thu hồi lịch sử hỗ trợ/nhận quà của ông/bà ${resObj.fullName} thành công!`
              : `Đã thu hồi quyết định bổ nhiệm chức vụ của ông/bà ${resObj.fullName} thành công!`
            );
            onRefresh();
            setTimeout(() => setAssignSuccess(""), 5000);
          } else {
            const errData = await res.json().catch(() => ({}));
            setAssignError(errData.error || "Thất bại khi lưu cập nhật.");
          }
        } catch {
          setAssignError("Không kết nối được đến máy chủ.");
        }
      }
    });
  };

  const handleSaveEditAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingApp) return;

    const resObj = residents.find(r => r.id && r.id.toString().trim() === editingApp.residentId.toString().trim());
    if (!resObj) return;

    const dateParts = editDate.split("-");
    const dateFormatted = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : editDate;

    const isSpecialTarget = GROUPS_META.find(g => g.key === editingApp.groupKey)?.type === "special";

    const newFormattedNote = isSpecialTarget
      ? `[An sinh xã hội - Hỗ trợ: ${editingApp.groupKey}] Đã nhận: [${editTitle}] - Nội dung hỗ trợ: [${editTask}] vào ngày ${dateFormatted}.`
      : `[Biên chế quản lý - Đoàn thể: ${editingApp.groupKey}] Bổ nhiệm: [${editTitle}] - Nhiệm vụ: [${editTask}] kể từ ngày ${dateFormatted}${editIsKiemNhiem ? " (Kiêm nhiệm)" : ""}.`;

    const currentNotes = resObj.notes || "";
    const cleanRawLine = editingApp.rawLine.replace(/\r/g, "").trim();
    const updatedNotes = currentNotes
      .split(/\r?\n/)
      .map(line => {
        const cleanLine = line.replace(/\r/g, "").trim();
        if (cleanLine === cleanRawLine) {
          return newFormattedNote;
        }
        // Fallback match to edit
        const hasTitle = cleanLine.includes(editingApp.title);
        const hasTask = cleanLine.includes(editingApp.task);
        if (hasTitle && hasTask) {
          return newFormattedNote;
        }
        return line;
      })
      .join("\n");

    try {
      const res = await fetch(`/api/residents/${resObj.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-name": encodeURIComponent(currentUser?.fullName || "Ban cán sự khu phố"),
          "x-user-role": encodeURIComponent(activeRole || ""),
          "x-user-email": encodeURIComponent(currentUser?.email || "")
        },
        body: JSON.stringify({ ...resObj, notes: updatedNotes })
      });

      if (res.ok) {
        setAssignSuccess("Cập nhật thông tin thành công!");
        setEditingApp(null);
        onRefresh();
        setTimeout(() => setAssignSuccess(""), 5000);
      } else {
        setAssignError("Lỗi khi lưu cập nhật thay đổi bổ nhiệm.");
      }
    } catch {
      setAssignError("Kết nối máy chủ bị gián đoạn.");
    }
  };

  const currentGroup = GROUPS_META.find(g => g.key === selectedGroupKey) || GROUPS_META[0];

  // Retrieve members belonging to the current selected category/group
  const groupMembers = residents.filter(res => {
    if (selectedGroupKey === "NCT") {
      const age = getAge(res.dob);
      if (nctSubTab === "mung-tho") {
        if (age < 70) return false;
        if (mungThoMilestone !== "All") {
          return getResidentMilestoneKey(age) === mungThoMilestone;
        }
        return true;
      } else {
        // bhyt
        return age >= 60;
      }
    }
    if (currentGroup.type === "military") {
      if (selectedGroupKey === "Nghĩa vụ & Dự bị") {
        return res.militaryCategories?.some(cat => MILITARY_RESERVE_SUBCATEGORIES.includes(cat)) || false;
      }
      if (selectedGroupKey === "Dân quân tự vệ") {
        return res.militaryCategories?.some(cat => MILITIA_SUBCATEGORIES.includes(cat)) || false;
      }
      return false;
    }
    if (currentGroup.type === "group") {
      return res.groups.includes(currentGroup.key);
    } else {
      return res.specialCategories.includes(currentGroup.key);
    }
  });

  // Handle recorded policy aid assignment
  const handleAwardPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionSuccess("");
    setActionError("");

    if (!targetResidentId || !selectedPolicy || !supportValue) {
      setActionError("Vui lòng nhập đầy đủ thông tin hỗ trợ!");
      return;
    }

    const resObj = residents.find(r => r.id && r.id.toString().trim() === targetResidentId.toString().trim());
    if (!resObj) return;

    // We simulate logging this as a historic update by modifying resident's administrator notes
    const formattedNote = `[Chính sách hỗ trợ] Đã cấp phát [${selectedPolicy}] trị giá [${supportValue}] vào ngày ${formatDate(new Date())}.`;
    const updatedNotes = resObj.notes ? `${resObj.notes}\n${formattedNote}` : formattedNote;

    try {
      const res = await fetch(`/api/residents/${resObj.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-name": encodeURIComponent(currentUser?.fullName || "Cán bộ chính sách"),
          "x-user-role": encodeURIComponent(activeRole || ""),
          "x-user-email": encodeURIComponent(currentUser?.email || "")
        },
        body: JSON.stringify({ ...resObj, notes: updatedNotes })
      });

      if (res.ok) {
        setActionSuccess(`Hệ thống ghi nhận thành công gói đóng góp cho công dân ${resObj.fullName}!`);
        setTargetResidentId("");
        setSelectedPolicy("");
        setSupportValue("");
        onRefresh();
        setTimeout(() => setActionSuccess(""), 5000);
      } else {
        setActionError("Có lỗi xảy ra trong quá trình ghi nhận.");
      }
    } catch {
      setActionError("Kết nối máy chủ bị lỗi.");
    }
  };

  const checkReceivedWelfare = (member: Resident, giftName: string, year: number) => {
    if (!member.notes) return null;
    const lines = member.notes.split(/\r?\n/);
    const targetGift = giftName.trim().toLowerCase();
    
    for (const line of lines) {
      const cleanLine = line.trim();
      if (cleanLine.includes("[An sinh xã hội - Hỗ trợ") || cleanLine.toLowerCase().includes("hỗ trợ chính sách")) {
        const lowerLine = cleanLine.toLowerCase();
        if (lowerLine.includes(targetGift)) {
          // Double-check correct year
          const yearMatch = cleanLine.match(/(\d{4})/);
          const dateMatch = cleanLine.match(/vào ngày\s*([\d/]+)/);
          
          if (dateMatch) {
            const dateStr = dateMatch[1];
            if (dateStr.endsWith(`/${year}`)) {
              return { line: cleanLine, dateStr };
            }
          } else if (yearMatch && yearMatch[1] === year.toString()) {
            return { line: cleanLine, dateStr: `Năm ${year}` };
          } else if (cleanLine.includes(year.toString())) {
            return { line: cleanLine, dateStr: year.toString() };
          }
        }
      }
    }
    return null;
  };

  const handleInstantIssueWelfare = async (member: Resident, giftName: string) => {
    if (!giftName || !giftName.trim()) {
      setAssignError("Vui lòng nhập hoặc chọn tên vật phẩm quà tặng hỗ trợ!");
      return;
    }
    const dateFormatted = `${String(new Date().getDate()).padStart(2, '0')}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${welfareYear}`;
    const defaultTask = `Đã nhận quà ${giftName} nhân dịp hỗ trợ an sinh xã hội địa bàn trong năm ${welfareYear}.`;
    const formattedNote = `[An sinh xã hội - Hỗ trợ: ${selectedGroupKey}] Đã nhận: [${giftName.trim()}] - Nội dung hỗ trợ: [${defaultTask}] vào ngày ${dateFormatted}.`;
    
    // Check local prevent duplicates
    const checkRes = checkReceivedWelfare(member, giftName, welfareYear);
    if (checkRes) {
      setCustomAlert(`Cảnh báo trùng lặp: Cư dân ${member.fullName} đã ghi danh nhận hỗ trợ "${giftName}" cho năm ${welfareYear} rồi (vào ngày ${checkRes.dateStr})! Tránh phát hai lần.`);
      return;
    }

    const cleanNotes = (member.notes || "").trim();
    const updatedNotes = cleanNotes ? `${cleanNotes}\n${formattedNote}` : formattedNote;

    try {
      const res = await fetch(`/api/residents/${member.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-name": encodeURIComponent(currentUser?.fullName || "Ban cán sự khu phố"),
          "x-user-role": encodeURIComponent(activeRole || ""),
          "x-user-email": encodeURIComponent(currentUser?.email || "")
        },
        body: JSON.stringify({ ...member, notes: updatedNotes })
      });

      if (res.ok) {
        setAssignSuccess(`Ghi nhận cấp phát quà "${giftName}" cho ${member.fullName} thành công!`);
        onRefresh();
        setTimeout(() => setAssignSuccess(""), 4000);
      } else {
        setAssignError("Không thể kết nối máy chủ để cập nhật hồ sơ.");
      }
    } catch {
      setAssignError("Hệ thống bị gián đoạn, vui lòng thử lại sau.");
    }
  };

  const handlePrintReport = () => {
    window.print();
  };

  const handleExportCSV = (membersToExport: Resident[], categoryTitle: string) => {
    // CSV Header with BOM for Vietnamese characters
    const csvRows = [
      "\uFEFF" + "STT,Họ và tên,Ngày sinh,Tuổi,Số CCCD,Địa chỉ,Số điện thoại,Tổ dân phố,Phân loại,Chi tiết chế độ,Ghi chú hồ sơ"
    ];

    membersToExport.forEach((m, idx) => {
      const age = getAge(m.dob);
      const dobFormatted = formatDate(m.dob);
      const addressEscaped = `"${m.address.replace(/"/g, '""')}"`;
      const noteEscaped = m.notes ? `"${m.notes.replace(/"/g, '""')}"` : '""';
      
      const categoryLabel = categoryTitle === "mung-tho" 
        ? "Mừng thọ lão khoa" 
        : "Ưu đãi BHYT miễn phí";
        
      const detailLabel = categoryTitle === "mung-tho"
        ? getMungThoMilestoneLabel(age)
        : `Người cao tuổi được miễn phí BHYT (Tuổi: ${age})`;

      csvRows.push(
        `${idx + 1},"${m.fullName}",${dobFormatted},${age},'${m.cccd},${addressEscaped},${m.phoneNumber || ""},TDP ${m.householdId || ""},"${categoryLabel}","${detailLabel}",${noteEscaped}`
      );
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const filename = categoryTitle === "mung-tho" 
      ? `Danh_Sach_Mung_Tho_KP3_${new Date().getFullYear()}.csv` 
      : `Danh_Sach_BHYT_Mien_Phi_NCT_KP3_${new Date().getFullYear()}.csv`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportMilitaryCSV = (groupKey: string) => {
    const csvRows = [
      "\uFEFF" + "STT,Họ và tên,Ngày sinh,Tuổi,CCCD,Địa chỉ,Số điện thoại,Tổ dân phố,Các diện Quân sự/Dân quân đăng ký,Ghi chú quân sự riêng"
    ];

    const targetSubcats = groupKey === "Nghĩa vụ & Dự bị" ? MILITARY_RESERVE_SUBCATEGORIES : MILITIA_SUBCATEGORIES;
    const membersToExport = residents.filter(r => r.militaryCategories?.some(cat => targetSubcats.includes(cat)));

    membersToExport.forEach((m, idx) => {
      const age = getAge(m.dob);
      const dobFormatted = formatDate(m.dob);
      const addressEscaped = `"${m.address.replace(/"/g, '""')}"`;
      const milCatsEscaped = `"${(m.militaryCategories || []).filter(c => targetSubcats.includes(c)).join("; ")}"`;
      const milNotesEscaped = m.militaryNotes ? `"${m.militaryNotes.replace(/"/g, '""')}"` : '""';

      csvRows.push(
        `${idx + 1},"${m.fullName}",${dobFormatted},${age},'${m.cccd},${addressEscaped},${m.phoneNumber || ""},TDP ${m.householdId || ""},${milCatsEscaped},${milNotesEscaped}`
      );
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const filename = groupKey === "Nghĩa vụ & Dự bị"
      ? `Danh_Sach_Nghia_Vu_Quan_Su_Du_Bi_KP3_${new Date().getFullYear()}.csv`
      : `Danh_Sach_Dan_Quan_Tu_Ve_KP3_${new Date().getFullYear()}.csv`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportGeneralGroupCSV = (membersToExport: Resident[], groupKey: string) => {
    const csvRows = [
      "\uFEFF" + "STT,Họ và tên,Ngày sinh,Tuổi,Số CCCD,Địa chỉ,Số điện thoại,Tổ dân phố,Đoàn thể / Diện phân loại,Ghi chú quản lý & Bổ nhiệm"
    ];

    const groupMetaObj = GROUPS_META.find(g => g.key === groupKey);
    const groupName = groupMetaObj ? groupMetaObj.name : groupKey;

    membersToExport.forEach((m, idx) => {
      const age = getAge(m.dob);
      const dobFormatted = formatDate(m.dob);
      const addressEscaped = `"${m.address.replace(/"/g, '""')}"`;
      const noteEscaped = m.notes ? `"${m.notes.replace(/"/g, '""')}"` : '""';

      csvRows.push(
        `${idx + 1},"${m.fullName}",${dobFormatted},${age},'${m.cccd},${addressEscaped},${m.phoneNumber || ""},TDP ${m.householdId || ""},"${groupName}",${noteEscaped}`
      );
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const sanitizedGroupKey = groupKey.replace(/[^a-zA-Z0-9À-ỹ]+/g, "_");
    const filename = `Danh_Sach_${sanitizedGroupKey}_KP3_${new Date().getFullYear()}.csv`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Derived active category based on active group
  const activeCategory = currentGroup.type;

  const countGroupType = (type: "group" | "special" | "military") => {
    if (type === "group") {
      return GROUPS_META.filter(g => g.type === "group")
        .reduce((sum, g) => sum + residents.filter(r => r.groups.includes(g.key)).length, 0);
    } else if (type === "special") {
      return GROUPS_META.filter(g => g.type === "special")
        .reduce((sum, g) => {
          const count = g.key === "NCT"
            ? residents.filter(r => getAge(r.dob) >= 60).length
            : residents.filter(r => r.specialCategories.includes(g.key)).length;
          return sum + count;
        }, 0);
    } else {
      return GROUPS_META.filter(g => g.type === "military")
        .reduce((sum, g) => {
          const count = g.key === "Nghĩa vụ & Dự bị"
            ? residents.filter(r => r.militaryCategories?.some(cat => MILITARY_RESERVE_SUBCATEGORIES.includes(cat))).length
            : residents.filter(r => r.militaryCategories?.some(cat => MILITIA_SUBCATEGORIES.includes(cat))).length;
          return sum + count;
        }, 0);
    }
  };

  const handleCategoryChange = (category: "group" | "special" | "military") => {
    const firstOfCat = GROUPS_META.find(g => g.type === category);
    if (firstOfCat) {
      setSelectedGroupKey(firstOfCat.key);
    }
  };

  return (
    <div className="space-y-6">
      {/* SECTION 1: HEADER CONTROLS - RE-ENGINEERED HORIZONTAL GRID SELECTOR */}
      <div className="bg-slate-50/50 rounded-2xl border border-gray-250/20 p-5 shadow-xs space-y-5 no-print">
        <div>
          <h2 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider flex items-center gap-2">
            📊 Tổ chức Đoàn thể & Diện An sinh Xã hội - Quốc phòng KP3
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Chọn một trong 3 mảng trọng tâm dưới đây để tra cứu danh sách cư dân thuộc diện quản lý, thực hiện bổ nhiệm nhiệm kỳ hoặc ghi nhận lịch sử hỗ trợ:
          </p>
        </div>

        {/* 3 Major Categories as descriptive visual card-buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Groups */}
          <button
            type="button"
            onClick={() => handleCategoryChange("group")}
            className={`text-left p-4 rounded-xl border transition-all duration-205 cursor-pointer flex flex-col justify-between h-full min-h-[142px] space-y-3 group relative overflow-hidden ${
              activeCategory === "group"
                ? "bg-white border-emerald-500 shadow-md ring-2 ring-emerald-500/20"
                : "bg-white/60 border-gray-200 hover:border-gray-300 hover:bg-white"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className={`p-2 rounded-lg transition-colors ${activeCategory === "group" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100"}`}>
                <Users className="h-5 w-5" />
              </div>
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${activeCategory === "group" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                {GROUPS_META.filter(g => g.type === "group").length} đoàn thể
              </span>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1">
                Đoàn thể & Ban điều hành
              </h4>
              <p className="text-[10.5px] text-gray-500 mt-0.5 leading-tight">
                Mặt trận, Ban điều hành, Chi hội Phụ nữ, CCB, Thanh niên, Đảng viên...
              </p>
            </div>
            <div className="pt-2 border-t border-gray-100 w-full flex justify-between items-center text-[10px] font-semibold">
              <span className="text-gray-400">Thành viên tham gia:</span>
              <span className="text-emerald-700 font-mono font-bold text-xs">{countGroupType("group")} người</span>
            </div>
          </button>

          {/* Card 2: Special (Social Welfare) */}
          <button
            type="button"
            onClick={() => handleCategoryChange("special")}
            className={`text-left p-4 rounded-xl border transition-all duration-205 cursor-pointer flex flex-col justify-between h-full min-h-[142px] space-y-3 group relative overflow-hidden ${
              activeCategory === "special"
                ? "bg-white border-amber-500 shadow-md ring-2 ring-amber-500/20"
                : "bg-white/60 border-gray-200 hover:border-gray-300 hover:bg-white"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className={`p-2 rounded-lg transition-colors ${activeCategory === "special" ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-700 group-hover:bg-amber-100"}`}>
                <HeartPulse className="h-5 w-5" />
              </div>
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${activeCategory === "special" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
                {GROUPS_META.filter(g => g.type === "special").length} chính sách
              </span>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1">
                Chính sách & An sinh xã hội
              </h4>
              <p className="text-[10.5px] text-gray-500 mt-0.5 leading-tight">
                Người cao tuổi, thương binh liệt sĩ, diện nghèo, khuyết tật, thiếu nhi...
              </p>
            </div>
            <div className="pt-2 border-t border-gray-100 w-full flex justify-between items-center text-[10px] font-semibold">
              <span className="text-gray-400">Công dân thuộc diện:</span>
              <span className="text-amber-700 font-mono font-bold text-xs">{countGroupType("special")} diện</span>
            </div>
          </button>

          {/* Card 3: Military */}
          <button
            type="button"
            onClick={() => handleCategoryChange("military")}
            className={`text-left p-4 rounded-xl border transition-all duration-205 cursor-pointer flex flex-col justify-between h-full min-h-[142px] space-y-3 group relative overflow-hidden ${
              activeCategory === "military"
                ? "bg-white border-indigo-600 shadow-md ring-2 ring-indigo-600/20"
                : "bg-white/60 border-gray-200 hover:border-gray-300 hover:bg-white"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className={`p-2 rounded-lg transition-colors ${activeCategory === "military" ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-700 group-hover:bg-indigo-100"}`}>
                <ShieldCheck className="h-5 w-5" />
              </div>
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${activeCategory === "military" ? "bg-indigo-100 text-indigo-800" : "bg-slate-100 text-slate-600"}`}>
                {GROUPS_META.filter(g => g.type === "military").length} lực lượng
              </span>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1">
                Quốc phòng & An ninh local
              </h4>
              <p className="text-[10.5px] text-gray-500 mt-0.5 leading-tight">
                Nghĩa vụ quân sự, dự bị động viên, lực lượng Dân quân tự vệ của KP3...
              </p>
            </div>
            <div className="pt-2 border-t border-gray-100 w-full flex justify-between items-center text-[10px] font-semibold">
              <span className="text-gray-400">Biên chế nòng cốt:</span>
              <span className="text-indigo-700 font-mono font-bold text-xs">{countGroupType("military")} người</span>
            </div>
          </button>
        </div>

        {/* Dynamic coloured buttons for detailed category selection */}
        <div className="pt-4 border-t border-gray-200">
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block mb-2.5">
            Lựa chọn {activeCategory === "group" ? "Đoàn thể" : activeCategory === "special" ? "Diện chính sách" : "Lực lượng quốc phòng"} cụ thể:
          </span>
          <div className="flex flex-wrap gap-2">
            {GROUPS_META.filter(g => {
              if (activeCategory === "group") return g.type === "group";
              if (activeCategory === "special") return g.type === "special";
              return g.type === "military";
            }).map((g) => {
              const IconComp = g.icon;
              const isSelected = selectedGroupKey === g.key;
              
              let count = 0;
              if (g.key === "NCT") {
                count = residents.filter(r => getAge(r.dob) >= 60).length;
              } else if (g.type === "military") {
                count = g.key === "Nghĩa vụ & Dự bị"
                  ? residents.filter(r => r.militaryCategories?.some(cat => MILITARY_RESERVE_SUBCATEGORIES.includes(cat))).length
                  : residents.filter(r => r.militaryCategories?.some(cat => MILITIA_SUBCATEGORIES.includes(cat))).length;
              } else if (g.type === "special") {
                count = residents.filter(r => r.specialCategories.includes(g.key)).length;
              } else {
                count = residents.filter(r => r.groups.includes(g.key)).length;
              }

              // Custom highlight styling depending on major category
              let btnClass = "bg-white text-slate-600 border border-gray-250/60 hover:bg-slate-50";
              if (isSelected) {
                if (g.type === "group") {
                  btnClass = "bg-emerald-600 text-white border-emerald-600 shadow-sm font-semibold";
                } else if (g.type === "special") {
                  btnClass = "bg-amber-500 text-white border-amber-500 shadow-sm font-semibold";
                } else {
                  btnClass = "bg-indigo-600 text-white border-indigo-600 shadow-sm font-semibold";
                }
              }

              return (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setSelectedGroupKey(g.key)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition duration-155 cursor-pointer ${btnClass}`}
                >
                  <IconComp className="h-3.5 w-3.5" />
                  <span>{g.key}</span>
                  <span className={`px-1.5 py-0.5 text-[9.5px] rounded-md font-mono font-bold ${
                    isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 2: DATALIST PANEL - EXPANDED TO FULL WIDTH */}
      <div className="w-full space-y-6">
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-6 print:p-0 print:border-none">
          {/* Header */}
          <div className="flex justify-between items-start border-b border-gray-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 tracking-tight">{currentGroup.name}</h3>
              <p className="text-xs text-gray-400 mt-0.5 italic">{currentGroup.desc}</p>
            </div>
            
             <div className="flex gap-2">
              {selectedGroupKey === "NCT" && (
                <button
                  onClick={() => handleExportCSV(groupMembers, nctSubTab)}
                  className="px-3 py-1.5 bg-teal-605 text-white bg-teal-600 hover:bg-teal-700 border border-teal-600 rounded-xl text-xs font-bold cursor-pointer transition flex items-center gap-1.5 no-print shadow-2xs"
                  title="Xuất file danh sách nộp lên phường"
                >
                  <FileDown className="h-3.5 w-3.5" /> Xuất Excel nộp Phường
                </button>
              )}
              {currentGroup.type === "military" && (
                <button
                  onClick={() => handleExportMilitaryCSV(selectedGroupKey)}
                  className={`px-3 py-1.5 text-white rounded-xl text-xs font-bold cursor-pointer transition flex items-center gap-1.5 no-print shadow-2xs ${
                    selectedGroupKey === "Dân quân tự vệ"
                      ? "bg-emerald-600 hover:bg-emerald-700 border border-emerald-600"
                      : "bg-amber-700 hover:bg-amber-800 border border-amber-700"
                  }`}
                  title="Xuất file danh sách quân lực nộp lên Phường"
                >
                  <FileDown className="h-3.5 w-3.5" /> Xuất Excel nộp Phường
                </button>
              )}
              {selectedGroupKey !== "NCT" && currentGroup.type !== "military" && (
                <button
                  onClick={() => handleExportGeneralGroupCSV(groupMembers, selectedGroupKey)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600 rounded-xl text-xs font-bold cursor-pointer transition flex items-center gap-1.5 no-print shadow-2xs"
                  title="Xuất file danh sách thành viên Excel"
                >
                  <FileDown className="h-3.5 w-3.5" /> Xuất Excel Danh Sách
                </button>
              )}
              <button
                onClick={handlePrintReport}
                className="px-3 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 rounded-xl text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 no-print"
              >
                <Printer className="h-3.5 w-3.5" /> Xuất Báo Cáo In
              </button>
            </div>
          </div>

          {/* Custom controls for senior citizens */}
          {selectedGroupKey === "NCT" && (
            <div className="bg-slate-55 p-4 rounded-xl space-y-4 border border-slate-200 bg-slate-55/60 no-print">
              <div className="flex flex-col md:flex-row justify-between gap-4">
                {/* 2 sub options tabs */}
                <div className="flex rounded-lg bg-slate-100 p-1 self-start border border-gray-100">
                  <button
                    onClick={() => {
                      setNctSubTab("mung-tho");
                    }}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition duration-200 cursor-pointer ${nctSubTab === "mung-tho" ? "bg-white text-teal-800 shadow-xs" : "text-gray-500 hover:text-gray-900"}`}
                  >
                    1. Mừng Thọ Người Cao Tuổi (Tuổi ≥ 70)
                  </button>
                  <button
                    onClick={() => {
                      setNctSubTab("bhyt");
                    }}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition duration-200 cursor-pointer ${nctSubTab === "bhyt" ? "bg-white text-teal-800 shadow-xs" : "text-gray-500 hover:text-gray-900"}`}
                  >
                    2. Hưởng Thẻ BHYT Miễn Phí (Tuổi ≥ 60)
                  </button>
                </div>

                {/* Filter for milestone if in mừng thọ category */}
                {nctSubTab === "mung-tho" && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-505">Mốc mừng thọ:</span>
                    <select
                      value={mungThoMilestone}
                      onChange={(e) => setMungThoMilestone(e.target.value)}
                      className="bg-white border border-gray-200 text-xs rounded-lg px-2.5 py-1.5 font-bold text-gray-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-teal-500 shadow-4xs"
                    >
                      <option value="All">Tất cả các mốc (≥ 70 tuổi)</option>
                      <option value="70">Mừng thọ tròn 70 tuổi</option>
                      <option value="75">Mừng thọ tròn 75 tuổi</option>
                      <option value="80">Thượng thọ tròn 80 tuổi</option>
                      <option value="85">Thượng thọ tròn 85 tuổi</option>
                      <option value="90">Đại thượng thọ tròn 90 tuổi</option>
                      <option value="95">Đại thượng thọ tròn 95 tuổi</option>
                      <option value="100">Đại thượng thọ tròn 100 tuổi trở lên</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Informative banners about regulations */}
              {nctSubTab === "mung-tho" ? (
                <div className="text-[11px] text-teal-800 leading-relaxed bg-teal-50 border border-teal-100 p-3 rounded-lg">
                  💡 <strong>Quy định Mừng Thọ Nhà nước:</strong> Khảo sát định kỳ, tổ chức mừng chúc và tặng quà thọ vàng cho các độ tuổi tròn niên chẵn cách 5 năm gồm: 70, 75, 80, 85, 90, 95, 100 và trên 100 tuổi theo Luật người cao tuổi. Trích xuất file để chuẩn bị hồ sơ báo nộp UBND Phường An Phú chuẩn bị quà cấp.
                </div>
              ) : (
                <div className="text-[11px] text-emerald-800 leading-relaxed bg-emerald-50 border border-emerald-100 p-3 rounded-lg">
                  💡 <strong>Chính sách BHYT Miễn Phí TP.HCM:</strong> Tất cả người cao tuổi có hộ khẩu hoặc cư ngụ thực tế từ đủ 60 tuổi trở lên thuộc diện đặc cách an sinh của Thành phố sẽ được cấp thẻ Bảo hiểm y tế miễn phí theo chương trình chăm lo sức khỏe toàn diện của Sở Y tế TP.HCM.
                </div>
              )}
            </div>
          )}

          {/* Members Table */}
          <div className="space-y-3">
            {currentGroup.type === "military" ? (
              <div className="space-y-4 no-print">
                <div className="flex justify-between items-center bg-slate-50 border border-gray-150 p-3 rounded-xl">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                    🛡️ Phân hệ CSDL quân lực mục con (Chuyên trách Khu Đội Trưởng)
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">Nhấp vào từng thanh tiêu đề bên dưới để thu gọn hoặc mở rộng danh sách chi tiết</span>
                </div>
                {(selectedGroupKey === "Nghĩa vụ & Dự bị" ? MILITARY_RESERVE_SUBCATEGORIES : MILITIA_SUBCATEGORIES).map((subcat) => {
                  const subcatMembers = residents.filter(r => r.militaryCategories?.includes(subcat));
                  const isExpanded = expandedMilSubcats[subcat] !== false;
                  return (
                    <div key={subcat} className="border border-slate-150 rounded-xl overflow-hidden bg-white shadow-3xs">
                      {/* Collapsible header */}
                      <div 
                        onClick={() => toggleSubcat(subcat)}
                        className={`flex items-center justify-between p-3.5 cursor-pointer select-none border-b border-gray-150 transition ${
                          selectedGroupKey === "Nghĩa vụ & Dự bị" 
                            ? "bg-amber-50/45 hover:bg-amber-100/40 text-amber-950" 
                            : "bg-emerald-50/20 hover:bg-emerald-100/20 text-emerald-950"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold flex items-center gap-1.5 uppercase tracking-wide">
                            {selectedGroupKey === "Nghĩa vụ & Dự bị" ? "🎖️" : "🛡️"} {subcat}
                          </span>
                          <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
                            selectedGroupKey === "Nghĩa vụ & Dự bị" 
                              ? "bg-amber-100 border-amber-200 text-amber-900" 
                              : "bg-emerald-100 border-emerald-200 text-emerald-900"
                          }`}>
                            {subcatMembers.length} nhân sự
                          </span>
                        </div>
                        <span className="text-xs font-bold text-gray-400">
                          {isExpanded ? "Thu gọn ▲" : "Mở rộng ▼"}
                        </span>
                      </div>

                      {/* Subcategory table content */}
                      {isExpanded && (
                        <div className="p-1">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-50 text-gray-400 font-bold border-b border-gray-150 text-[9px] uppercase">
                                  <th className="py-2.5 px-4 w-1/4">Họ và tên</th>
                                  <th className="py-2.5 px-4">Số CCCD</th>
                                  <th className="py-2.5 px-4">Ngày sinh (Tuổi)</th>
                                  <th className="py-2.5 px-4">TDP / Địa chỉ</th>
                                  <th className="py-2.5 px-4 text-right">Lịch sử ghi chú quân sự</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 text-gray-700">
                                {subcatMembers.length === 0 ? (
                                  <tr>
                                    <td colSpan={5} className="py-6 text-center italic text-gray-400">
                                      Chưa ghi nhận nhân sự trong diện này.
                                    </td>
                                  </tr>
                                ) : (
                                  subcatMembers.map(member => (
                                    <tr key={member.id} className="hover:bg-slate-50/50">
                                      <td className="py-3 px-4 font-bold text-gray-800">{member.fullName}</td>
                                      <td className="py-3 px-4 font-mono">{member.cccd || "Chưa cấp"}</td>
                                      <td className="py-3 px-4">
                                        {member.dob ? `${formatDate(member.dob)} (${getAge(member.dob)} tuổi)` : ""}
                                      </td>
                                      <td className="py-3 px-4 truncate max-w-[200px]">{member.address}</td>
                                      <td className="py-3 px-4 text-right min-w-[200px] max-w-[280px]">
                                        <AiSummaryText text={member.militaryNotes || member.notes || ""} />
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                {currentGroup.type === "special" && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-3 mb-4 gap-2 no-print">
                    <div className="flex rounded-lg bg-slate-100 p-0.5 border border-gray-200">
                      <button
                        type="button"
                        onClick={() => setSpecialSubView("list")}
                        className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                          specialSubView === "list"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        <Users className="h-3.5 w-3.5" /> Thống Kê Danh Sách ({groupMembers.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSpecialSubView("distribute")}
                        className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                          specialSubView === "distribute"
                            ? "bg-amber-500 text-white shadow-sm"
                            : "text-slate-500 hover:text-slate-950"
                        }`}
                      >
                        <Gift className="h-3.5 w-3.5" /> Cấp Phát Quà & Chống Trùng Lặp 🛡️
                      </button>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      Chế độ an sinh: {specialSubView === "list" ? "Bản đối soát thông tin" : "Phát quà không trùng lặp"}
                    </span>
                  </div>
                )}

                {currentGroup.type === "special" && specialSubView === "distribute" ? (
                  // Gorgeous duplicate-free gift distribution command center!
                  <div className="space-y-4 no-print">
                    {/* Command Inputs Grid */}
                    <div className="bg-amber-50/20 border border-amber-250/60 rounded-xl p-4 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        <div className="flex flex-col gap-1 md:col-span-5">
                          <label className="font-bold text-[11px] text-amber-950 uppercase tracking-wide">
                            🎁 Đợt Quà / Vật Phẩm Cấp Phát Đang Rà Soát
                          </label>
                          <select
                            value={welfareGiftToSelect}
                            onChange={(e) => {
                              setWelfareGiftToSelect(e.target.value);
                              if (e.target.value !== "Khác") {
                                setCustomWelfareGift("");
                              }
                            }}
                            className="bg-white border border-gray-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none cursor-pointer"
                          >
                            <option value="">-- Chọn đợt quà tiêu chuẩn --</option>
                            {getPresetTitlesForGroup(selectedGroupKey).map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                            <option value="Khác">Khác (Nhập thủ công...)</option>
                          </select>
                        </div>

                        {welfareGiftToSelect === "Khác" && (
                          <div className="flex flex-col gap-1 md:col-span-3">
                            <label className="font-bold text-[11px] text-gray-500">
                              Nhập tên quà tặng khác:
                            </label>
                            <input
                              type="text"
                              value={customWelfareGift}
                              onChange={(e) => setCustomWelfareGift(e.target.value)}
                              placeholder="Ví dụ: Quà đại hội Hội Chữ Thập Đỏ..."
                              className="border border-gray-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                            />
                          </div>
                        )}

                        <div className="flex flex-col gap-1 md:col-span-2">
                          <label className="font-bold text-[11px] text-amber-950 uppercase tracking-wide">
                            📅 Năm Cấp Phát
                          </label>
                          <select
                            value={welfareYear}
                            onChange={(e) => setWelfareYear(parseInt(e.target.value, 10))}
                            className="bg-white border border-gray-200 rounded-lg p-2 text-xs cursor-pointer focus:ring-1 focus:ring-amber-500 focus:outline-none shrink-0"
                          >
                            <option value={2026}>2026</option>
                            <option value={2025}>2025</option>
                            <option value={2024}>2024</option>
                            <option value={2023}>2023</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1 md:col-span-3">
                          <label className="font-bold text-[11px] text-amber-950 uppercase tracking-wide">
                            🔍 Tìm Kiếm Cư Dân
                          </label>
                          <input
                            type="text"
                            value={welfareSearchQuery}
                            onChange={(e) => setWelfareSearchQuery(e.target.value)}
                            placeholder="Nhập tên, địa chỉ hoặc số CCCD..."
                            className="bg-white border border-gray-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                          />
                        </div>

                        <div className="flex flex-col gap-1 md:col-span-2">
                          <label className="font-bold text-[11px] text-amber-950 uppercase tracking-wide">
                            🏷️ Lọc Trạng Thái
                          </label>
                          <select
                            value={welfareFilterStatus}
                            onChange={(e) => setWelfareFilterStatus(e.target.value as any)}
                            className="bg-white border border-gray-200 rounded-lg p-2 text-xs cursor-pointer focus:ring-1 focus:ring-amber-500 focus:outline-none"
                          >
                            <option value="All">Tất cả ({groupMembers.length})</option>
                            <option value="Received">Đã nhận 🟢</option>
                            <option value="Pending">Chưa nhận 🔴</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Statistics Counter Row */}
                    {(() => {
                      const activeGiftName = welfareGiftToSelect === "Khác" ? customWelfareGift : welfareGiftToSelect;
                      
                      // Global counting across categories (independent of search)
                      const totalSpecialMembers = groupMembers.length;
                      const globalReceivedList = groupMembers.filter(m => checkReceivedWelfare(m, activeGiftName, welfareYear) !== null);
                      const totalReceivedCount = globalReceivedList.length;
                      const totalPendingCount = totalSpecialMembers - totalReceivedCount;
                      const coverageRate = totalSpecialMembers > 0 ? Math.round((totalReceivedCount / totalSpecialMembers) * 100) : 0;

                      // Filter display list by search
                      const filteredMembersBySearch = groupMembers.filter(m => {
                        if (!welfareSearchQuery.trim()) return true;
                        const q = welfareSearchQuery.toLowerCase();
                        return m.fullName.toLowerCase().includes(q) || (m.cccd && m.cccd.includes(q)) || (m.address && m.address.toLowerCase().includes(q));
                      });

                      const checkedMembersList = filteredMembersBySearch.map(m => {
                        const receivedInfo = checkReceivedWelfare(m, activeGiftName, welfareYear);
                        return { member: m, receivedInfo };
                      });

                      const finalCheckedDisplay = checkedMembersList.filter(item => {
                        if (welfareFilterStatus === "Received") return item.receivedInfo !== null;
                        if (welfareFilterStatus === "Pending") return item.receivedInfo === null;
                        return true;
                      });

                      return (
                        <div className="space-y-4">
                          {/* Progress indicators */}
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200/60 p-4 rounded-xl">
                            <div className="bg-white p-3 rounded-lg border border-gray-150 flex flex-col justify-between">
                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Tổng đối tượng quản lý</span>
                              <span className="text-base font-black text-slate-850 mt-1 font-mono">{totalSpecialMembers} công dân</span>
                              <span className="text-[10px] text-gray-500 italic mt-0.5">Phân hệ: {currentGroup.name}</span>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-gray-150 flex flex-col justify-between">
                              <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Đã nhận quà an sinh</span>
                              <span className="text-base font-black text-emerald-700 mt-1 font-mono">{totalReceivedCount} suất</span>
                              <span className="text-[10px] text-emerald-600 mt-0.5 flex items-center gap-1">🟢 Bảo đảm chống phát trùng</span>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-gray-150 flex flex-col justify-between">
                              <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider">Chưa nhận (Chờ phát)</span>
                              <span className="text-base font-black text-amber-700 mt-1 font-mono">{totalPendingCount} người</span>
                              <span className="text-[10px] text-amber-600 mt-0.5">🔴 Đang kiểm soát danh sách</span>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-gray-150 flex flex-col justify-between">
                              <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider">Hoàn thành đợt phát</span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-base font-black text-blue-700 font-mono">{coverageRate}%</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-1 mt-1">
                                <div className="bg-emerald-500 h-1 rounded-full transition-all duration-300" style={{ width: `${coverageRate}%` }}></div>
                              </div>
                            </div>
                          </div>

                          {/* Instant checklist list card / table */}
                          <div className="overflow-x-auto border border-gray-100 rounded-xl bg-white shadow-xs">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-50 text-gray-400 font-bold border-b border-gray-150 text-[10px] uppercase">
                                  <th className="py-2.5 px-4 w-[50px] text-center font-bold">STT</th>
                                  <th className="py-2.5 px-4 font-bold">Công Dân Thụ Hưởng</th>
                                  <th className="py-2.5 px-4 font-bold">Số CCCD</th>
                                  <th className="py-2.5 px-4 font-bold">Tuổi & Ngày Sinh</th>
                                  <th className="py-2.5 px-4 font-bold">TDP / Địa Chỉ Cư Ngụ</th>
                                  <th className="py-2.5 px-3 w-[150px] text-center font-bold">Trạng Thái Phát Trùng</th>
                                  <th className="py-2.5 px-4 w-[160px] text-center font-bold">Thao Tác Cấp Phát</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-105 text-gray-750">
                                {finalCheckedDisplay.length === 0 ? (
                                  <tr>
                                    <td colSpan={7} className="py-8 text-center italic text-gray-400">
                                      Trong diện chính sách này chưa có ai khớp bộ lọc rà soát của bạn.
                                    </td>
                                  </tr>
                                ) : (
                                  finalCheckedDisplay.map((item, index) => {
                                    const m = item.member;
                                    const dobFormatted = formatDate(m.dob);
                                    const age = getAge(m.dob);
                                    
                                    return (
                                      <tr key={m.id} className="hover:bg-slate-50/40 transition-colors">
                                        <td className="py-3 px-4 text-center font-mono text-gray-400">{index + 1}</td>
                                        <td className="py-3 px-4 font-bold text-gray-800">{m.fullName}</td>
                                        <td className="py-3 px-4 font-mono text-gray-500">{m.cccd || "Chưa cấp / Trẻ em"}</td>
                                        <td className="py-3 px-4 text-gray-650">
                                          {dobFormatted ? `${dobFormatted} (${age} tuổi)` : "N/A"}
                                        </td>
                                        <td className="py-3 px-4 font-medium text-gray-500 truncate max-w-[180px]" title={m.address}>
                                          {m.address}
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                          {item.receivedInfo ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-200 uppercase tracking-wider">
                                              🟢 ĐÃ NHẬN
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wider">
                                              🔴 CHƯA NHẬN
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                          {item.receivedInfo ? (
                                            <div className="text-[10px] text-emerald-600 font-bold italic py-1">
                                              Đã cấp ngày: {item.receivedInfo.dateStr}
                                            </div>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => handleInstantIssueWelfare(m, activeGiftName)}
                                              className="w-full py-1 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-[10px] transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs hover:scale-[1.02] transform duration-100"
                                            >
                                              <Gift className="h-3 w-3" /> Cấp quà tức thì
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  // STANDARD TRA CUU TABLE
                  <>
                    <div className="flex justify-between items-center mb-2.5">
                      <span className="text-xs font-bold text-gray-700">
                        {selectedGroupKey === "NCT"
                          ? `${nctSubTab === "mung-tho" ? "Danh sách người cao tuổi mừng thọ năm nay" : "Danh sách hưởng bảo hiểm y tế miễn phí TP.HCM"} (${groupMembers.length} công dân)`
                          : `Danh Sách Thành Viên Hiện Hành (${groupMembers.length})`}
                      </span>
                    </div>

                    <div className="overflow-x-auto border border-gray-100 rounded-xl mb-6 bg-white shadow-xs">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-gray-400 font-bold border-b border-gray-100 text-[10px] uppercase">
                            <th className="py-2.5 px-4 font-bold">Tên Hội Viên</th>
                            <th className="py-2.5 px-4 font-bold">Số CCCD</th>
                            <th className="py-2.5 px-4 font-bold">Ngày sinh</th>
                            {selectedGroupKey === "NCT" && <th className="py-2.5 px-4 font-bold">Tuổi</th>}
                            {selectedGroupKey === "NCT" && <th className="py-2.5 px-4 font-bold">Phân mốc chính sách</th>}
                            <th className="py-2.5 px-4 font-bold">TDP / Địa chỉ</th>
                            <th className="py-2.5 px-4 text-right font-bold">Lịch sử ghi chú</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-700">
                      {groupMembers.length === 0 ? (
                        <tr>
                          <td colSpan={selectedGroupKey === "NCT" ? 7 : 5} className="py-6 text-center italic text-gray-400">
                            Chưa ghi nhận ai sinh hoạt đoàn thể trong phân mục này hoặc không khớp với mốc lọc tuổi.
                          </td>
                        </tr>
                      ) : (
                        groupMembers.map(member => (
                          <tr key={member.id} className="hover:bg-slate-50/50">
                            <td className="py-3 px-4 font-bold text-gray-800">{member.fullName}</td>
                            <td className="py-3 px-4 font-mono">{member.cccd || "Chưa cấp/Trẻ em"}</td>
                            <td className="py-3 px-4">
                              {formatDate(member.dob)}
                            </td>
                            {selectedGroupKey === "NCT" && (
                              <td className="py-3 px-4 font-bold text-teal-700">{getAge(member.dob)} tuổi</td>
                            )}
                            {selectedGroupKey === "NCT" && (
                              <td className="py-3 px-4 font-medium">
                                {nctSubTab === "mung-tho" ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-100">
                                    {getMungThoMilestoneLabel(getAge(member.dob))}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-100">
                                    Miễn Phí BHYT Hoạt Chất 60+
                                  </span>
                                )}
                              </td>
                            )}
                            <td className="py-3 px-4 truncate max-w-[200px]">{member.address}</td>
                            <td className="py-3 px-4 text-right min-w-[200px] max-w-[280px]">
                              <AiSummaryText text={member.notes || ""} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
          </div>

          {/* Officer & Task Assignment Panel */}
          <div className="bg-slate-50/60 p-4 rounded-xl border border-gray-150 space-y-4 no-print mt-6">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
                <BadgeCheck className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  {currentGroup.type === "special" ? "Công cụ Ghi nhận Hỗ trợ & Quà tặng An sinh Xã hội" : "Công cụ Phân bổ chức danh / nhiệm vụ Quản lý"}
                </h4>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {currentGroup.type === "special" 
                    ? `Ghi chép các đợt phát quà, hỗ trợ hiện kim, trợ cấp y tế hoặc các đợt chăm lo cho cư dân thuộc diện ${currentGroup.name} (Lưu nhiều năm).`
                    : `Phân công tổ chức, bổ nhiệm chức danh đoàn thể hoặc giao nhiệm vụ quản lý, quản trị địa bàn cho nhân sự thuộc ${currentGroup.name}.`
                  }
                </p>
              </div>
            </div>

            {assignError && (
              <div className="bg-rose-100 text-rose-800 p-2.5 rounded-lg text-xs font-medium">
                ⚠️ {assignError}
              </div>
            )}

            {assignSuccess && (
              <div className="bg-emerald-100 text-emerald-800 p-2.5 rounded-lg text-xs font-medium">
                ✅ {assignSuccess}
              </div>
            )}

             <form onSubmit={handleAssignRoleAndDuty} className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              {/* Select member of this group */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-gray-600 flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-blue-600" /> 
                  {currentGroup.type === "special" ? "Chọn người nhận hỗ trợ/quà" : "Chọn nhân sự nhiệm sở"}
                </label>
                
                {/* Search query input field */}
                <div className="relative">
                  <input
                    type="text"
                    value={recipientSearchQuery}
                    onChange={(e) => setRecipientSearchQuery(e.target.value)}
                    placeholder="🔍 Tìm nhanh theo tên/CCCD..."
                    className="w-full bg-white border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                  {recipientSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setRecipientSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-450 hover:text-gray-600 text-sm font-semibold transition cursor-pointer"
                      title="Xóa tìm kiếm"
                    >
                      ×
                    </button>
                  )}
                </div>

                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="bg-white border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer mt-1"
                >
                  <option value="">-- Chọn thành viên --</option>
                  <optgroup label={`Thành viên hiện tại (${
                    groupMembers.filter(m => {
                      if (!recipientSearchQuery) return true;
                      const label = m.fullName.toLowerCase() + " " + (m.cccd || "");
                      const query = recipientSearchQuery.toLowerCase();
                      return label.includes(query) || removeVietnameseTones(label).includes(removeVietnameseTones(query));
                    }).length
                  } người khớp)`}>
                    {groupMembers
                      .filter(m => {
                        if (!recipientSearchQuery) return true;
                        const label = m.fullName.toLowerCase() + " " + (m.cccd || "");
                        const query = recipientSearchQuery.toLowerCase();
                        return label.includes(query) || removeVietnameseTones(label).includes(removeVietnameseTones(query));
                      })
                      .map(m => (
                        <option key={m.id} value={m.id}>
                          {m.fullName} (CCCD: {m.cccd || "Không CCCD"})
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label={`Cư dân khác trong Khu phố 3 (Khợp: ${
                    residents
                      .filter(r => !groupMembers.some(gm => gm.id === r.id))
                      .filter(r => {
                        if (!recipientSearchQuery) return true;
                        const label = r.fullName.toLowerCase() + " " + (r.cccd || "");
                        const query = recipientSearchQuery.toLowerCase();
                        return label.includes(query) || removeVietnameseTones(label).includes(removeVietnameseTones(query));
                      }).length
                  } người)`}>
                    {residents
                      .filter(r => !groupMembers.some(gm => gm.id === r.id))
                      .filter(r => {
                        if (!recipientSearchQuery) return true;
                        const label = r.fullName.toLowerCase() + " " + (r.cccd || "");
                        const query = recipientSearchQuery.toLowerCase();
                        return label.includes(query) || removeVietnameseTones(label).includes(removeVietnameseTones(query));
                      })
                      .sort((a, b) => a.fullName.localeCompare(b.fullName, "vi"))
                      .map(r => (
                        <option key={r.id} value={r.id}>
                          {r.fullName} (CCCD: {r.cccd || "Không CCCD"})
                        </option>
                      ))
                    }
                  </optgroup>
                </select>
                {(() => {
                  const targetRes = residents.find(r => r.id && r.id.toString().trim() === assigneeId.toString().trim());
                  const previousAssignations = targetRes?.notes
                    ?.split("\n")
                    ?.filter(line => line.includes("[Biên chế quản lý") || line.includes("[An sinh xã hội - Hỗ trợ")) || [];

                  if (!assigneeId) return null;
                  return (
                    <div className="mt-1.5 p-2 bg-slate-100 rounded-lg space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">
                        {currentGroup.type === "special" ? "Hạt nhân lịch sử hỗ trợ đã nhận:" : "Danh sách chức danh đang kiêm nhiệm:"}
                      </span>
                      {previousAssignations.length === 0 ? (
                        <p className="text-[10px] text-gray-400 italic">
                          {currentGroup.type === "special" ? "Mới hoàn toàn, chưa nhận gì năm nay." : "Chưa đảm nhận chức danh nào."}
                        </p>
                      ) : (
                        <div className="max-h-[85px] overflow-y-auto space-y-1">
                          {previousAssignations.map((roleLine, idx) => (
                            <div key={idx} className="text-[10px] text-gray-700 bg-white p-1 rounded border border-gray-200 leading-tight">
                              {roleLine}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Assigned Title */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-gray-600">
                  {currentGroup.type === "special" ? "Quà tặng / Nội dung nhận" : `Chức danh đảm nhiệm (${currentGroup.key})`}
                </label>
                <select
                  value={assignedTitle}
                  onChange={(e) => {
                    setAssignedTitle(e.target.value);
                    if (e.target.value !== "Khác") {
                      setCustomTitle("");
                    }
                  }}
                  className="bg-white border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="">
                    {currentGroup.type === "special" ? "-- Chọn quà hỗ trợ tiêu biểu --" : "-- Chọn chức danh --"}
                  </option>
                  {getPresetTitlesForGroup(selectedGroupKey).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  <option value="Khác">Khác (Nhập thủ công...)</option>
                </select>
                {assignedTitle === "Khác" && (
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder={currentGroup.type === "special" ? "Nhập vật phẩm quà khác..." : "Nhập chức danh thủ công..."}
                    className="mt-1 border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                )}
              </div>

              {/* Assigned Task */}
              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="font-semibold text-gray-600">
                  {currentGroup.type === "special" ? "Chi tiết nội dung nhận & Ghi chú hỗ trợ" : "Phân công nhiệm vụ quản lý"}
                </label>
                <select
                  value={assignedTask}
                  onChange={(e) => {
                    if (e.target.value !== "custom") {
                      setAssignedTask(e.target.value);
                    } else {
                      setAssignedTask("");
                    }
                  }}
                  className="bg-white border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Chọn nội dung mẫu hoặc tự nhập bên dưới --</option>
                  {(currentGroup.type === "special" ? PRESET_SPECIAL_TASKS : PRESET_TASKS).map(task => (
                    <option key={task} value={task}>{task}</option>
                  ))}
                  <option value="custom">-- Nhập thủ công mô tả khác --</option>
                </select>
                <input
                  type="text"
                  value={assignedTask}
                  onChange={(e) => setAssignedTask(e.target.value)}
                  placeholder={currentGroup.type === "special" ? "Ví dụ: Đã nhận quà tết Nguyên Đán 10kg gạo + bánh chưng trị giá 400..." : "Xác nhận hoặc nhập chi tiết nhiệm vụ tại đây..."}
                  className="mt-1 border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Appointment Date */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-gray-600">
                  {currentGroup.type === "special" ? "Ngày nhận hỗ trợ / quà" : "Ngày bổ nhiệm / biên chế"}
                </label>
                <input
                  type="date"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className="bg-white border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block font-mono">Định dạng hiển thị: dd/mm/yyyy</span>
              </div>

              {/* Concurrency Switch & Group Designation Info */}
              <div className="flex flex-col gap-1 md:col-span-3 bg-orange-50/70 p-3 rounded-lg border border-orange-100/90 leading-tight">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isKiemNhiem}
                    onChange={(e) => setIsKiemNhiem(e.target.checked)}
                    className="rounded text-orange-600 focus:ring-orange-500 border-orange-300 mt-0.5 h-4 w-4 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-orange-950 text-xs block text-left">
                      {currentGroup.type === "special" ? "Bảo lưu cộng dồn nhiều dòng hỗ trợ" : "Thiết lập bổ nhiệm kiêm nhiệm nhiều chức danh"}
                    </span>
                    <p className="text-[10px] text-orange-800 font-normal leading-relaxed mt-0.5">
                      {currentGroup.type === "special" ? (
                        <>Đánh dấu tùy chọn này để <strong>lưu lũy kế song song nhiều dòng hỗ trợ</strong> cho người thụ hưởng trong nhiều năm. Tắt đi nếu muốn thay thế bằng dòng mới nhất đối với danh mục <strong>{currentGroup.name}</strong>.</>
                      ) : (
                        <>Đánh dấu tùy chọn này để <strong>lưu kiêm nhiệm song song</strong> chức vụ mới bên cạnh các chức danh cũ khác. Tự động hỗ trợ quản lý chức vụ độc lập cho đoàn thể <strong>{currentGroup.name}</strong>. Tắt đi nếu muốn thay thế các chức danh cũ cùng đoàn thể này.</>
                      )}
                    </p>
                  </div>
                </label>
              </div>

              {/* Submit button */}
              <div className="flex items-end justify-end">
                <button
                  type="submit"
                  className={`w-full text-white font-bold h-[35px] rounded-lg transition cursor-pointer shadow-xs text-xs flex items-center justify-center gap-1.5 ${
                    currentGroup.type === "special" ? "bg-amber-600 hover:bg-amber-700" : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {currentGroup.type === "special" ? (
                    <><Gift className="h-4 w-4" /> Ghi nhận Nhận Hỗ trợ</>
                  ) : (
                    <><BadgeCheck className="h-4 w-4" /> Ban hành Bổ nhiệm</>
                  )}
                </button>
              </div>
            </form>

            {/* Lịch sử và Xuất báo cáo liên kết */}
            <div className="border-t border-slate-200 pt-5 mt-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-emerald-50 text-emerald-700 rounded">
                    <History className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                      {currentGroup.type === "special" 
                        ? `Lịch sử Trợ cấp & Nhận Quà An sinh Xã hội (${currentGroup.name})`
                        : `Lịch sử Nhân sự & Quyết định Bổ nhiệm (${currentGroup.name})`
                      }
                    </h5>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {currentGroup.type === "special" 
                        ? "Sổ tay an sinh lưu trữ tất cả các gói hỗ trợ, hoạt động phát quà đã nhận qua các năm của công dân thuộc nhóm ưu tiên."
                        : "Sổ biên chế lưu trữ các chức vụ nhiệm kỳ qua nhiều năm của từng thành viên trong đoàn thể."
                      }
                    </p>
                  </div>
                </div>

                {/* Filters and export button */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-gray-500 font-medium whitespace-nowrap">
                      {currentGroup.type === "special" ? "Bộ lọc năm nhận hỗ trợ:" : "Năm nhiệm kỳ:"}
                    </span>
                    <select
                      value={historyYearFilter}
                      onChange={(e) => setHistoryYearFilter(e.target.value)}
                      className="bg-white border border-gray-200 rounded px-2 py-1 text-[11px] focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer font-medium"
                    >
                      <option value="all">-- Tất cả các năm --</option>
                      {Array.from(new Set(getAllAppointments().filter(app => app.groupKey === selectedGroupKey).map(app => app.year)))
                        .sort((a, b) => b - a)
                        .map(yr => (
                          <option key={yr} value={yr}>Năm {yr}</option>
                        ))
                      }
                      {/* Always show current year option if not present */}
                      {!Array.from(new Set(getAllAppointments().filter(app => app.groupKey === selectedGroupKey).map(app => app.year))).includes(new Date().getFullYear()) && (
                        <option value={new Date().getFullYear()}>Năm {new Date().getFullYear()}</option>
                      )}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleExportAppointmentsCSV(historyYearFilter)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    <FileDown className="h-3.5 w-3.5" /> 
                    {currentGroup.type === "special" 
                      ? `Xuất Excel nhận quà năm (${historyYearFilter === "all" ? "Tất cả" : `${historyYearFilter}`})`
                      : `Xuất Danh sách năm (${historyYearFilter === "all" ? "Tất cả" : `${historyYearFilter}`})`
                    }
                  </button>
                </div>
              </div>

              {/* Table list */}
              {(() => {
                let filteredHistory = getAllAppointments().filter(app => app.groupKey === selectedGroupKey);
                if (historyYearFilter !== "all") {
                  filteredHistory = filteredHistory.filter(app => app.year === parseInt(historyYearFilter, 10));
                }

                if (filteredHistory.length === 0) {
                  return (
                    <div className="text-center py-8 bg-white border border-dashed border-gray-200 rounded-xl">
                      <CalendarRange className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-400 text-[11px] italic">
                        {currentGroup.type === "special" 
                          ? `Chưa ghi nhận hoạt động nhận trợ cấp/quà an sinh nào trong năm ${historyYearFilter}.`
                          : `Không tìm thấy quyết định biên chế/bổ nhiệm nào trong năm ${historyYearFilter} cho nhóm này.`
                        }
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto bg-white border border-gray-200 rounded-xl shadow-xs">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-100/80 text-slate-700 border-b border-gray-200 font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-2 px-3 w-[50px] text-center">STT</th>
                          <th className="py-2 px-3 w-[155px]">
                            {currentGroup.type === "special" ? "Đối tượng thụ hưởng" : "Cán bộ nhân sự"}
                          </th>
                          <th className="py-2 px-3 w-[170px]">
                            {currentGroup.type === "special" ? "Quà tặng / Trợ cấp" : "Chức danh bổ nhiệm"}
                          </th>
                          <th className="py-2 px-3 min-w-[220px]">
                            {currentGroup.type === "special" ? "Nội dung & Trị giá hỗ trợ" : "Nhiệm vụ được giao"}
                          </th>
                          <th className="py-2 px-3 w-[115px] text-center">
                            {currentGroup.type === "special" ? "Ngày cấp phát" : "Ngày bổ nhiệm"}
                          </th>
                          <th className="py-2 px-3 w-[100px] text-center">
                            {currentGroup.type === "special" ? "Năm nhận" : "Hình thức"}
                          </th>
                          <th className="py-2 px-3 w-[100px] text-center no-print text-[10px] text-blue-750">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredHistory.map((app, index) => (
                          <tr key={index} className="hover:bg-slate-50/50 transition">
                            <td className="py-2 px-3 text-center text-gray-400 font-mono">{index + 1}</td>
                            <td className="py-2 px-3 font-semibold text-slate-800">{app.fullName}</td>
                            <td className="py-2 px-3">
                              <span className={`border rounded px-1.5 py-0.5 text-[10px] font-bold inline-block ${
                                currentGroup.type === "special" ? "bg-amber-50 text-amber-800 border-amber-100" : "bg-blue-50 text-blue-800 border-blue-100"
                              }`}>
                                {app.title}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-gray-600 leading-normal min-w-[200px] max-w-[280px]">
                              <AiSummaryText text={app.task} />
                            </td>
                            <td className="py-2 px-3 text-center text-gray-500 font-mono">{app.dateStr}</td>
                            <td className="py-2 px-3 text-center font-semibold text-slate-700 font-mono">
                              {currentGroup.type === "special" ? (
                                `Năm ${app.year}`
                              ) : (
                                app.isKiemNhiem ? (
                                  <span className="bg-amber-50 text-amber-800 border border-amber-100/80 rounded px-1.5 py-0.2 text-[9px] uppercase font-bold">
                                    Kiêm nhiệm
                                  </span>
                                ) : (
                                  <span className="bg-slate-100 text-slate-800 border border-slate-200 rounded px-1.5 py-0.2 text-[9px] uppercase font-bold">
                                    Chính nhiệm
                                  </span>
                                )
                              )}
                            </td>
                            <td className="py-2 px-3 text-center no-print">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingApp(app);
                                    setEditTitle(app.title);
                                    setEditTask(app.task);
                                    setEditDate(parseDateToInputFormat(app.dateStr));
                                    setEditIsKiemNhiem(app.isKiemNhiem);
                                  }}
                                  className="text-blue-500 hover:text-blue-700 p-1 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                  title={currentGroup.type === "special" ? "Sửa lịch sử hỗ trợ" : "Sửa thông tin bổ nhiệm"}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRevokeAppointment(app)}
                                  className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title={currentGroup.type === "special" ? "Hủy nhận hỗ trợ / quà này" : "Hủy / Thu hồi bổ nhiệm"}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Appointment Edit Dialog Modal Overlay */}
      {editingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 transition-opacity no-print">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
                  <BadgeCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {GROUPS_META.find(g => g.key === editingApp.groupKey)?.type === "special" ? "Chỉnh sửa hỗ trợ / quà an sinh" : "Chỉnh sửa Quyết định bổ nhiệm"}
                  </h3>
                  <p className="text-[10px] text-gray-500">
                    {GROUPS_META.find(g => g.key === editingApp.groupKey)?.type === "special" ? "Đang điều chỉnh lịch sử hỗ trợ cho cư dân" : "Đang điều chỉnh chức danh đoàn thể cho Đ/c"} {editingApp.fullName}
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setEditingApp(null)}
                className="text-gray-400 hover:text-gray-600 font-extrabold text-sm p-1 select-none outline-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditAppointment} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-500 font-bold mb-1">Thành viên đảm nhiệm (Cố định):</label>
                <input 
                  type="text" 
                  value={editingApp.fullName} 
                  disabled 
                  className="w-full bg-slate-100 border border-slate-200 text-gray-600 rounded-lg p-2 font-medium cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">Chức danh bổ nhiệm:</label>
                <select
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-white border border-gray-250 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
                >
                  {getPresetTitlesForGroup(editingApp.groupKey).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  <option value={editTitle}>{editTitle} (Hiện tại)</option>
                </select>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Nhập chức danh thủ công nếu khác mẫu..."
                  className="mt-1.5 w-full border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">Nhiệm vụ phân công cụ thể:</label>
                <textarea
                  value={editTask}
                  onChange={(e) => setEditTask(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-250 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none font-medium text-slate-900 leading-normal"
                  placeholder="Nhập chi tiết nhiệm vụ quản lý, điều phối hoạt động..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    {GROUPS_META.find(g => g.key === editingApp.groupKey)?.type === "special" ? "Ngày nhận hỗ trợ / quà:" : "Ngày bổ nhiệm / biên chế:"}
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full border border-gray-250 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer font-medium"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block font-mono">Định dạng hiển thị: dd/mm/yyyy</span>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editIsKiemNhiem}
                      onChange={(e) => setEditIsKiemNhiem(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 border-gray-300 h-4 w-4 cursor-pointer"
                    />
                    <span className="font-bold text-slate-700 text-[11px]">Chức vụ kiêm nhiệm</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 mt-5">
                <button
                  type="button"
                  onClick={() => setEditingApp(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-250 text-gray-700 rounded-lg font-bold transition cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
                >
                  <BadgeCheck className="h-4 w-4" /> Lưu thông tin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      {customAlert && (
        <div className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 no-print">
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
        <div className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 no-print">
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

import fs from "fs";
import path from "path";
import { Resident, Household, WorkSchedule, DocumentTemplate, GeneratedDocument, ActivityLog, BusinessEstablishment, OfficialDocument, GisHousehold, GisStreet, GisSubzone, GisFeature } from "./src/types";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const rawSupabaseUrl = process.env.SUPABASE_URL || "https://tsogbcucuybbebfniiur.supabase.co";
const rawSupabaseKey = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzb2diY3VjdXliYmViZm5paXVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNTM5NjEsImV4cCI6MjA5NTgyOTk2MX0.OQGut7H37GJG8qVQ5FIKD36_cvxggcuwYWSXOKmCLh4";

// Clean leading/trailing quotes (essential if wrapped in double quotes in .env)
const SUPABASE_URL = rawSupabaseUrl.trim().replace(/^["']|["']$/g, "");
const SUPABASE_ANON_KEY = rawSupabaseKey.trim().replace(/^["']|["']$/g, "");

let supabaseInstance: any = null;
try {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (error: any) {
  console.error("Supabase client critical initialization failed:", error.message || error);
}

export const supabase = supabaseInstance;

const DATA_FILE = path.join(process.cwd(), "data.json");

let dbCache: DatabaseState | null = null;


export interface DatabaseState {
  residents: Resident[];
  households: Household[];
  schedules: WorkSchedule[];
  templates: DocumentTemplate[];
  documents: GeneratedDocument[];
  logs: ActivityLog[];
  businesses: BusinessEstablishment[];
  accounts?: any[];
  forgotIdRequests?: any[];
  officialDocuments?: OfficialDocument[];
  availableGroups?: string[];
  availableNDTQs?: string[];
  availablePolicies?: string[];
  gisHouseholds?: GisHousehold[];
  gisStreets?: GisStreet[];
  gisSubzones?: GisSubzone[];
  gisFeatures?: GisFeature[];
  geminiApiKey?: string;
}

const DEFAULT_TEMPLATES: DocumentTemplate[] = [
  {
    id: "temp_1",
    name: "Thông báo Hành chính",
    type: "Thông báo",
    description: "Mẫu thông báo về các vấn đề dân cư, sinh hoạt, thu phí dự phòng, phòng chống dịch bệnh.",
    structure: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n\nỦY BAN NHÂN DÂN PHƯỜNG AN PHÚ\nBAN ĐIỀU HÀNH KHU PHỐ 3\n\nTHÔNG BÁO\nVề việc: [Nội dung thông báo]\n\nKính gửi: Toàn thể nhân dân Tổ dân phố ... thuộc Khu phố 3.\n\n[Nội dung chi tiết]\n\nNơi nhận:\n- Như trên;\n- UBND Phường (báo cáo);\n- Lưu: Trưởng KP.\n\nTM. BAN ĐIỀU HÀNH KHU PHỐ\nTRƯỞNG KHU PHỐ"
  },
  {
    id: "temp_2",
    name: "Biên bản cuộc họp Chi bộ / Khu phố",
    type: "Biên bản họp",
    description: "Dùng để lập biên bản các cuộc họp dân phố định kỳ, họp Chi bộ, họp Đội tuần tra nhân dân.",
    structure: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n\nBAN ĐIỀU HÀNH KHU PHỐ 3\n\nBIÊN BẢN CUỘC HỌP\nVề việc: [Tên cuộc họp]\n\nHôm nay, lúc [Giờ] ngày [Ngày] tháng [Tháng] năm [Năm]\nTại địa điểm: [Địa điểm học]\nChúng tôi gồm:\nI. Thành phần tham dự:\n- Chủ trì: [Người chủ trì] - Chức vụ: [Chức vụ]\n- Thư ký: [Thư ký]\n- Đại biểu tham dự: [Số lượng/Thành phần]\n\nII. Nội dung cuộc họp:\n[Nội dung bàn bạc, lấy ý kiến]\n\nIII. Quyết nghị cuộc họp:\n[Các ý kiến thống nhất và biểu quyết]\n\nBiên bản kết thúc vào lúc [Giờ] cùng ngày, đã được đọc lại cho mọi người cùng nghe và thống nhất ký tên.\n\nCHỦ TRÌ                                    THƯ KÝ"
  },
  {
    id: "temp_3",
    name: "Báo cáo Tình hình tháng",
    type: "Báo cáo tháng",
    description: "Mẫu báo cáo tiến độ hoạt động địa phương, dân số biến động, phong trào đoàn thể định kỳ.",
    structure: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n\nBAN ĐIỀU HÀNH KHU PHỐ 3\n\nBÁO CÁO TÌNH HÌNH HOẠT ĐỘNG THÁNG\nTháng [Số tháng] năm [Năm]\n\nKính gửi: Đảng ủy - UBND Phường An Phú\n\nBan điều hành Khu phố 3 xin báo cáo tình hình hoạt động tháng qua như sau:\n1. Tình hình an ninh chính trị, trật tự an toàn xã hội:\n[Nội dung ANTT]\n2. Công tác quản lý dân số, cư trú:\n[Nội dung dân cư, quản lý tạm trú tạm vắng]\n3. Hoạt động của các hội đoàn thể (CCB, Phụ nữ, Thanh niên, Chữ thập đỏ):\n[Nội dung hoạt động hoạt động đoàn thể]\n4. Công tác an sinh xã hội, chăm lo đối tượng khó khăn:\n[Nội dung an sinh xã hội]\n\nNơi nhận:\n- Như trên;\n- Lưu văn phòng.\n\nTM. BAN ĐIỀU HÀNH KHU PHỐ\nTRƯỞNG KHU PHỐ"
  },
  {
    id: "temp_4",
    name: "Giấy mời họp dân, đoàn thể",
    type: "Giấy mời",
    description: "Mẫu giấy mời họp dân phố, họp chi hội chính thức có đóng dấu giáp lai ảo.",
    structure: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n\nBAN ĐIỀU HÀNH KHU PHỐ 3\n\nGIẤY MỜI\nBan điều hành Khu phố 3 kính mời:\nÔng/Bà: [Họ tên khách mời]\nĐịa chỉ: [Địa chỉ]\n\nTới tham dự cuộc họp: [Nội dung cuộc họp]\nThời gian: lúc [Giờ] ngày [Ngày]\nĐịa điểm: Văn phòng Khu phố 3 (Số 12 Đường Thảo Điền)\n\nRất mong Ông/Bà sắp xếp thời gian đến tham dự đúng giờ để cuộc họp đạt kết quả tốt.\n\nTM. BAN ĐIỀU HÀNH KHU PHỐ\nTRƯỞNG KHU PHỐ"
  },
  {
    id: "temp_5",
    name: "Kế hoạch ra quân, phong trào",
    type: "Kế hoạch",
    description: "Mẫu kế hoạch tổ chức phong trào địa phương, tổng vệ sinh, hiến máu nhân đạo, tuyên truyền pháp luật.",
    structure: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n\nBAN ĐIỀU HÀNH KHU PHỐ 3\n\nKẾ HOẠCH\nVề việc: Tổ chức [Tên phong trào/hoạt động]\n\nI. MỤC ĐÍCH, YÊU CẦU:\n[Nêu mục đích ý nghĩa chương trình]\n\nII. THỜI GIAN, ĐỊA ĐIỂM:\n- Thời gian:\n- Địa điểm:\n\nIII. NỘI DUNG VÀ BIỆN PHÁP THỰC HIỆN:\n[Phân công công việc cụ thể cho từng khối đoàn thể Phụ nữ, Đoàn thanh niên, Cựu chiến binh]\n\nTM. BAN ĐIỀU HÀNH KHU PHỐ\nTRƯỞNG KHU PHỐ"
  },
  {
    id: "temp_6",
    name: "Quy ước văn hóa Khu phố 3",
    type: "Tuyển tập quy ước",
    description: "Bản quy ước chuẩn mực nếp sống văn minh, quy tắc an ninh, bảo vệ môi trường chung.",
    structure: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n\nỦY BAN NHÂN DÂN PHƯỜNG AN PHÚ\nBAN ĐIỀU HÀNH KHU PHỐ 3\n\nQUY ƯỚC NẾP SỐNG VĂN MINH đô thị\n(Ban hành kèm theo Nghị quyết hội nghị cử tri Khu phố 3)\n\nChương I: Quy tắc giữ gìn vệ sinh môi trường chung\n- Mỗi hộ gia đình tự phân loại rác thải tại nguồn.\n- Không xả rác bừa bãi ra lòng lề đường, ngõ hẻm.\n\nChương II: Đảm bảo văn minh trật tự đô thị\n- Không xây dựng lấn chiếm lòng đường, vỉa hè.\n- Để xe đúng nơi quy định, có người trông coi.\n\nChương III: Ứng xử văn minh tại cộng đồng cư dân\n- Giữ gìn an ninh trật tự sau 22:00 đêm.\n- Hòa giải các tranh chấp nhỏ trong tình làng nghĩa xóm."
  }
];

const SEED_RESIDENTS: Resident[] = [
  {
    id: "res_1",
    fullName: "Nguyễn Lâm Hùng",
    cccd: "079085012345",
    dob: "1960-08-15",
    gender: "Nam",
    address: "12 Thảo Điền, An Phú, TP. Thủ Đức, TP.HCM",
    phoneNumber: "0908123456",
    job: "Hưu trí / Đại tá Quân đội về hưu",
    education: "Đại học quân sự",
    religion: "Không",
    ethnicity: "Kinh",
    notes: "Đảng viên kỳ cựu, Trưởng ban Điều hành Khu phố kiêm Phó bí thư Chi bộ.",
    residenceType: "Thường trú",
    householdId: "HH001",
    relationWithHeader: "Chủ hộ",
    groups: ["CCB", "Ban điều hành", "Đảng viên"],
    specialCategories: ["Viên chức"],
    groupNDTQ: "Tổ 3"
  },
  {
    id: "res_2",
    fullName: "Nguyễn Lâm Tuấn",
    cccd: "079203001234",
    dob: "1998-11-22",
    gender: "Nam",
    address: "12 Thảo Điền, An Phú, TP. Thủ Đức, TP.HCM",
    phoneNumber: "0912345678",
    job: "Lập trình viên phần mềm",
    education: "Thạc sĩ Công nghệ",
    religion: "Không",
    ethnicity: "Kinh",
    notes: "Đoàn viên năng nổ, hỗ trợ kỹ thuật số cho Ban điều hành khu phố.",
    residenceType: "Thường trú",
    householdId: "HH001",
    relationWithHeader: "Con",
    groups: ["Thanh niên"],
    specialCategories: [],
    groupNDTQ: "Tổ 3"
  },
  {
    id: "res_3",
    fullName: "Trần Thị Mai",
    cccd: "079184001238",
    dob: "1967-05-18",
    gender: "Nữ",
    address: "45/2 Đường 5, An Phú, TP. Thủ Đức, TP.HCM",
    phoneNumber: "0967888999",
    job: "Kinh doanh tự do cửa hàng bách hóa",
    education: "12/12",
    religion: "Phật giáo",
    ethnicity: "Kinh",
    notes: "Chi hội trưởng Chi hội Phụ nữ, năng nổ trong các việc thiện nguyện xã hội.",
    residenceType: "Thường trú",
    householdId: "HH002",
    relationWithHeader: "Chủ hộ",
    groups: ["Phụ nữ", "Chữ thập đỏ", "Ban công tác Mặt trận"],
    specialCategories: [],
    groupNDTQ: "Tổ 4"
  },
  {
    id: "res_4",
    fullName: "Phạm Ngọc Anh",
    cccd: "079092003456",
    dob: "1992-02-14",
    gender: "Nữ",
    address: "Căn hộ 12.04 CC The Vista, An Phú, TP. Thủ Đức, TP.HCM",
    phoneNumber: "0934112233",
    job: "Trưởng phòng Nhân sự",
    education: "Đại học Luật",
    religion: "Không",
    ethnicity: "Kinh",
    notes: "Sinh hoạt Đảng theo Quy định 213 tại địa phương. Ủy viên hội Chữ thập đỏ phường.",
    residenceType: "Tạm trú",
    householdId: "HH003",
    relationWithHeader: "Chủ hộ",
    groups: ["Đảng viên 213", "Chữ thập đỏ"],
    specialCategories: ["Viên chức"],
    groupNDTQ: "Tổ 4"
  },
  {
    id: "res_5",
    fullName: "Vương Đình Bằng",
    cccd: "079056001245",
    dob: "1975-04-12",
    gender: "Nam",
    address: "89/10 Đường Quốc Hương, An Phú, TP. Thủ Đức, TP.HCM",
    phoneNumber: "0909555222",
    job: "Gia công mỹ nghệ tại nhà",
    education: "9/12",
    religion: "Không",
    ethnicity: "Kinh",
    notes: "Bị thương tật chi nhẹ, thuộc đối tượng chính sách khuyết tật cần được hỗ trợ định kỳ.",
    residenceType: "Thường trú",
    householdId: "HH004",
    relationWithHeader: "Chủ hộ",
    groups: [],
    specialCategories: ["Người khuyết tật"],
    groupNDTQ: "Tổ 10"
  },
  {
    id: "res_6",
    fullName: "Vương Chí Hải",
    cccd: "079315005511",
    dob: "2018-09-02",
    gender: "Nam",
    address: "89/10 Đường Quốc Hương, An Phú, TP. Thủ Đức, TP.HCM",
    phoneNumber: "Không có",
    job: "Học sinh tiểu học",
    education: "Chưa",
    religion: "Không",
    ethnicity: "Kinh",
    notes: "Trẻ em dưới 16 tuổi trong gia đình chính sách khó khăn.",
    residenceType: "Thường trú",
    householdId: "HH004",
    relationWithHeader: "Con",
    groups: [],
    specialCategories: ["Trẻ em"],
    groupNDTQ: "Tổ 10"
  },
  {
    id: "res_7",
    fullName: "Lê Sĩ Hoàng",
    cccd: "079077002341",
    dob: "1965-01-30",
    gender: "Nam",
    address: "15 Ba Son, An Phú, TP. Thủ Đức, TP.HCM",
    phoneNumber: "0903998877",
    job: "Cán bộ kiểm lâm về hưu",
    education: "Đại học Lâm nghiệp",
    religion: "Không",
    ethnicity: "Kinh",
    notes: "Bí thư Chi bộ Khu phố 3 trực thuộc Phường An Phú, phụ trách chung.",
    residenceType: "Thường trú",
    householdId: "HH005",
    relationWithHeader: "Chủ hộ",
    groups: ["CCB", "Ban công tác Mặt trận", "Đảng viên"],
    specialCategories: [],
    groupNDTQ: "Tổ 3"
  },
  {
    id: "res_8",
    fullName: "Trần Anh Quốc",
    cccd: "079045012589",
    dob: "1988-06-25",
    gender: "Nam",
    address: "7 Lương Định Của, An Phú, TP. Thủ Đức, TP.HCM",
    phoneNumber: "0977223344",
    job: "Cảnh sát Phường / Công an phụ trách địa bàn",
    education: "Đại học Cảnh sát",
    religion: "Không",
    ethnicity: "Kinh",
    notes: "Công an phụ trách hộ khẩu và tạm trú của Tổ dân phố 8, 9, 10, Khu phố 3.",
    residenceType: "Tạm trú",
    householdId: "HH006",
    relationWithHeader: "Chủ hộ",
    groups: ["Ban điều hành"],
    specialCategories: ["Viên chức"],
    groupNDTQ: "Tổ 8"
  }
];

export const SEED_BUSINESSES: BusinessEstablishment[] = [
  {
    id: "biz_1",
    name: "Cơm Tấm Ba Ghiền Chi Nhánh Khang",
    businessType: "Cửa hàng ăn uống",
    ownerName: "Nguyễn Văn Đạt",
    cccd: "079085002412",
    address: "12/2 Đường Thảo Điền, An Phú, TP. Hồ Chí Minh",
    phoneNumber: "0963124567",
    registrationNumber: "GPKD-03158941",
    employeesCount: 4,
    safetyInspectionDate: "2026-03-15",
    status: "Đang hoạt động",
    notes: "Đạt chuẩn an toàn vệ sinh thực phẩm và chứng nhận phòng cháy chữa cháy năm 2026."
  },
  {
    id: "biz_2",
    name: "Siêu thị Bách Hóa Xanh Thảo Điền",
    businessType: "Cửa hàng tiện lợi",
    ownerName: "Phạm Quốc Doanh",
    cccd: "079072005431",
    address: "24 Đường Thảo Điền, An Phú, TP. Hồ Chí Minh",
    phoneNumber: "0901235432",
    registrationNumber: "GPKD-03102456",
    employeesCount: 8,
    safetyInspectionDate: "2026-04-10",
    status: "Đang hoạt động",
    notes: "Điểm cung ứng nhu yếu phẩm chính cho hẻm Thảo Điền."
  },
  {
    id: "biz_3",
    name: "Nhà thuốc An Phú Khang",
    businessType: "Quầy dược phẩm / Y tế",
    ownerName: "Trần Thị Vân",
    cccd: "079069002138",
    address: "89 Đường Quốc Hương, An Phú, TP. Hồ Chí Minh",
    phoneNumber: "0912384752",
    registrationNumber: "GPKD-03144892",
    employeesCount: 2,
    safetyInspectionDate: "2026-05-02",
    status: "Đang hoạt động",
    notes: "Hỗ trợ cung cấp bông băng, tủ thuốc sơ cấp cứu cho Đội Tuần tra nhân dân khu phố."
  }
];

const SEED_HOUSEHOLDS: Household[] = [
  {
    id: "HH001",
    headerName: "Nguyễn Lâm Hùng",
    address: "12 Thảo Điền, An Phú, TP. Thủ Đức, TP.HCM",
    phoneNumber: "0908123456",
    notes: "Hộ gia đình cách mạng tiêu biểu tại khu phố."
  },
  {
    id: "HH002",
    headerName: "Trần Thị Mai",
    address: "45/2 Đường 5, An Phú, TP. Thủ Đức, TP.HCM",
    phoneNumber: "0967888999",
    notes: "Hộ gia đình hoạt động tích cực, làm nòng cốt công tác phụ nữ hẻm."
  },
  {
    id: "HH003",
    headerName: "Phạm Ngọc Anh",
    address: "Căn hộ 12.04 CC The Vista, An Phú, TP. Thủ Đức, TP.HCM",
    phoneNumber: "0934112233",
    notes: "Cư dân trẻ văn minh, Đảng viên về giữ liên lạc 213."
  },
  {
    id: "HH004",
    headerName: "Vương Đình Bằng",
    address: "89/10 Đường Quốc Hương, An Phú, TP. Thủ Đức, TP.HCM",
    phoneNumber: "0909555222",
    notes: "Gia cảnh khó khăn, cần theo dõi chế độ chính sách người khuyết tật và trẻ em."
  },
  {
    id: "HH005",
    headerName: "Lê Sĩ Hoàng",
    address: "15 Ba Son, An Phú, TP. Thủ Đức, TP.HCM",
    phoneNumber: "0903998877",
    notes: "Gia đình đảng viên gương mẫu tiêu biểu."
  },
  {
    id: "HH006",
    headerName: "Trần Anh Quốc",
    address: "7 Lương Định Của, An Phú, TP. Thủ Đức, TP.HCM",
    phoneNumber: "0977223344",
    notes: "Cán bộ công an khu vực lưu trú."
  }
];

const SEED_SCHEDULES: WorkSchedule[] = [
  {
    id: "sch_1",
    title: "Họp Định Kỳ Ban Điều Hành & Mặt Trận Khu Phố",
    dateTime: "2026-05-28T19:30",
    location: "Văn phòng Khu phố 3 (Hẻm 12 Thảo Điền)",
    attendees: "Toàn thể thành viên Ban điều hành, Trưởng ban công tác Mặt trận, Tổ trưởng 10 TDP.",
    description: "Nội dung cuộc họp bao gồm: Rà soát đóng góp các loại Quỹ an sinh xã hội, Triển khai phương án phòng chống Sốt xuất huyết mùa mưa cực đoan, Chuẩn bị kế hoạch Quốc tế Thiếu nhi 1/6 cho các cháu thiếu nhi nghèo và chăm ngoan.",
    isMeeting: true
  },
  {
    id: "sch_2",
    title: "Đại Hội Chi Bộ Khu Phố 3 Nhiệm Kỳ",
    dateTime: "2026-05-30T08:00",
    location: "Hội trường Ủy ban nhân dân Phường An Phú",
    attendees: "Toàn thể Đảng viên đang sinh hoạt tại chi bộ (32 đồng chí chính thức, 12 đồng chí liên lạc 213).",
    description: "Kiểm điểm công tác nhiệm kỳ qua, bầu nhân sự Chi ủy khóa mới, đề ra chiến lược xây dựng Khu phố xanh văn hóa, tích hợp số hóa dữ liệu quản trị.",
    isMeeting: true
  },
  {
    id: "sch_3",
    title: "Ra Quân Ngày Chủ Nhật Xanh - Dọn Dẹp Hẻm Văn Hóa",
    dateTime: "2026-06-01T07:00",
    location: "Trục đường Quốc Hương và các hẻm nội bộ TDP 8,9",
    attendees: "Chi đoàn Thanh niên làm nòng cốt, Hội phụ nữ, Cựu chiến binh và vận động nhân dân toàn hẻm.",
    description: "Tổng vệ sinh, xóa bỏ các điểm nóng rác tự phát, cạo xóa quảng cáo bẩn trên cột điện, khơi thông một số đoạn cống nghẹt nhỏ phòng ngừa ngập cục bộ.",
    isMeeting: false
  },
  {
    id: "sch_4",
    title: "Phát Thưởng Khuyến Học Gương Sáng Hiếu Học Hè 2026",
    dateTime: "2026-06-02T16:00",
    location: "Văn phòng điều hành Khu phố 3",
    attendees: "Chi hội trưởng hội khuyến học, các cháu đạt học sinh giỏi năm học 2025-2026, các cháu gia cảnh khó khăn hiếu học.",
    description: "Tặng 45 phần quà gồm vở, bút và học bổng cho các em nhỏ vượt khó nuôi chí học tập xuất sắc.",
    isMeeting: false
  }
];

const SEED_LOGS: ActivityLog[] = [
  {
    id: "log_1",
    userName: "Trưởng ban Nguyễn Lâm Hùng",
    userRole: "Trưởng Ban điều hành",
    action: "Khởi tạo hệ thống Smart Khu Phố",
    timestamp: "2026-05-26T09:00:00Z",
    details: "Khởi chạy ban đầu và rà soát đồng bộ hóa 8 nhân khẩu nòng cốt khu phố."
  },
  {
    id: "log_2",
    userName: "Bí thư Lê Sĩ Hoàng",
    userRole: "Bí thư Chi bộ",
    action: "Soạn thảo văn bản Kế hoạch",
    timestamp: "2026-05-26T14:20:00Z",
    details: "Điều chỉnh Kế hoạch ra quân Ngày chủ nhật xanh hè 2026 qua AI và lưu trữ."
  },
  {
    id: "log_3",
    userName: "Công án Trần Anh Quốc",
    userRole: "Công an khu vực",
    action: "Thêm nhân khẩu Phạm Ngọc Anh",
    timestamp: "2026-05-26T16:45:00Z",
    details: "Nhập mới hồ sơ tạm trú cho công dân Phạm Ngọc Anh tại căn hộ CC The Vista."
  }
];

export const SEED_OFFICIAL_DOCUMENTS: OfficialDocument[] = [
  {
    id: "doc_1",
    title: "Nghị quyết Đại hội Đảng bộ Phường An Phú nhiệm kỳ 2025 - 2030",
    docNumber: "02-NQ/ĐU",
    dateIssued: "2025-06-15",
    senderOrReceiver: "Đảng ủy Phường An Phú",
    type: "incoming",
    category: "Đảng",
    year: 2025,
    month: 6,
    summary: "Nghị quyết chỉ đạo tập trung nâng cao chất lượng cuộc sống dân cư và hiện đại hóa quản lý tại các khu phố trực thuộc.",
    externalFileName: "Nghi_quyet_ĐU_Phuong_2025.pdf",
    externalFileType: "application/pdf",
    externalFileSize: "2.4 MB"
  },
  {
    id: "doc_2",
    title: "Chỉ thị số 05-CT/TW về Đẩy mạnh học tập và làm theo tư tưởng đạo đức Hồ Chí Minh",
    docNumber: "05-CT/TW",
    dateIssued: "2026-02-10",
    senderOrReceiver: "Ban Chấp hành Trung ương",
    type: "incoming",
    category: "Đảng",
    year: 2026,
    month: 2,
    summary: "Văn bản hướng dẫn tăng cường triển khai các phong trào thi đua gương mẫu đạo đức lối sống trong Đảng viên hẻm khu phố.",
    externalFileName: "Chi_thi_05_TW_2026.docx",
    externalFileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    externalFileSize: "1.1 MB"
  },
  {
    id: "doc_3",
    title: "Quyết định phê duyệt chỉ tiêu giảm nghèo bền vững phường An Phú năm 2026",
    docNumber: "88/QĐ-UBND",
    dateIssued: "2026-01-18",
    senderOrReceiver: "Ủy ban nhân dân Phường An Phú",
    type: "incoming",
    category: "Chính quyền",
    year: 2026,
    month: 1,
    summary: "Giao chỉ tiêu rà soát và hỗ trợ hộ cận nghèo, hộ khuyết tật tại Khu phố 3, hỗ trợ đào tạo nghề và an sinh xã hội.",
    externalFileName: "Quyet_dinh_88_QĐ_UBND.pdf",
    externalFileType: "application/pdf",
    externalFileSize: "1.5 MB"
  },
  {
    id: "doc_4",
    title: "Kế hoạch phối hợp tuyên truyền Luật Nghĩa vụ Quân sự năm 2026",
    docNumber: "14/KH-UBND",
    dateIssued: "2026-03-05",
    senderOrReceiver: "Ủy ban nhân dân Phường An Phú",
    type: "incoming",
    category: "Chính quyền",
    year: 2026,
    month: 3,
    summary: "Phối hợp giữa chính quyền địa bàn, khu đội trưởng và gia đình rà soát vận động thanh niên tuổi 17 tham gia khám sơ tuyển.",
    externalFileName: "Ke_hoach_14_KH_UBND.pdf",
    externalFileType: "application/pdf",
    externalFileSize: "980 KB"
  },
  {
    id: "doc_5",
    title: "Thông tri hướng dẫn tổ chức Ngày hội Đại đoàn kết toàn dân tộc năm 2025",
    docNumber: "12-TT/MTTQ",
    dateIssued: "2025-10-12",
    senderOrReceiver: "Ủy ban Mặt trận Tổ quốc Quận 2 cũ",
    type: "incoming",
    category: "Mặt trận và các đoàn thể",
    year: 2025,
    month: 10,
    summary: "Nội dung chuẩn bị văn nghệ, tuyên dương gia đình văn hóa tiêu biểu và đóng góp quỹ vì người nghèo tại văn phòng Khu phố.",
    externalFileName: "Thong_tri_12_MTTQ.pdf",
    externalFileType: "application/pdf",
    externalFileSize: "1.8 MB"
  },
  {
    id: "doc_6",
    title: "Báo cáo sơ kết hoạt động phong trào hiến máu nhân đạo năm 2026",
    docNumber: "04-BC/HCTĐ",
    dateIssued: "2026-05-15",
    senderOrReceiver: "Hội Chữ thập đỏ Phường An Phú",
    type: "incoming",
    category: "Mặt trận và các đoàn thể",
    year: 2026,
    month: 5,
    summary: "Ghi nhận và biểu dương khen thưởng các hộ gia đình văn hóa tại khu phố 3 tham gia hiến máu vượt chỉ tiêu giao.",
    externalFileName: "Bao_cao_04_BC_HCTĐ.docx",
    externalFileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    externalFileSize: "650 KB"
  },
  {
    id: "doc_7",
    title: "Báo cáo chính trị xây dựng Chi bộ Khu phố 3 trong sạch vững mạnh năm 2026",
    docNumber: "09-BC/CB",
    dateIssued: "2026-05-20",
    senderOrReceiver: "Đảng bộ Phường An Phú",
    type: "outgoing",
    category: "Đảng",
    year: 2026,
    month: 5,
    summary: "Báo cáo phân tích chất lượng Đảng viên đang sinh hoạt 76 và Đảng viên 213 hoạt động cư trú tại hẻm, định hướng quý 3.",
    externalFileName: "Bao_cao_xay_dung_chi_bo_KP3.docx",
    externalFileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    externalFileSize: "1.3 MB"
  },
  {
    id: "doc_8",
    title: "Tờ trình xin hỗ trợ kinh phí sửa chữa Văn phòng điều hành Khu phố 3",
    docNumber: "03-TTr/BDH",
    dateIssued: "2026-04-02",
    senderOrReceiver: "Ủy ban nhân dân Phường An Phú",
    type: "outgoing",
    category: "Chính quyền",
    year: 2026,
    month: 4,
    summary: "Đề xuất tháo dỡ lớp mái tôn cũ bị dột, thay mới hệ thống bảng hiệu khu phố văn hóa 3 và trang bị thêm bàn ghế hội họp.",
    externalFileName: "To_trinh_sua_chua_van_phong.docx",
    externalFileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    externalFileSize: "750 KB"
  },
  {
    id: "doc_9",
    title: "Kế hoạch tổ chức tết thiếu nhi 1/6 cho trẻ em có hoàn cảnh đặc biệt",
    docNumber: "02-KH/MT",
    dateIssued: "2026-05-22",
    senderOrReceiver: "Đảng ủy - Ủy ban Mặt trận Tổ quốc",
    type: "outgoing",
    category: "Mặt trận và các đoàn thể",
    year: 2026,
    month: 5,
    summary: "Phối hợp với Chi hội phụ nữ và Đoàn thanh niên chuẩn bị quà bánh, trao học bổng gương sáng khuyến học cho các em nhỏ khó khăn.",
    externalFileName: "Ke_hoach_quoc_te_thieu_nhi_1_6.docx",
    externalFileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    externalFileSize: "1.1 MB"
  }
];

const SEED_ACCOUNTS: any[] = [
  {
    id: "acc_admin",
    fullName: "Quản trị viên Hệ thống",
    email: "admin",
    role: "Super Admin",
    active: true,
    canEdit: true,
    password: "Trunghuy741",
    provider: "local",
    createdAt: new Date().toISOString()
  },
  {
    id: "acc_1",
    fullName: "Nguyễn Lâm Hùng",
    email: "bdhkhupho3.ap@gmail.com",
    role: "Super Admin",
    active: true,
    canEdit: true,
    password: "Trunghuy741",
    provider: "local",
    createdAt: new Date().toISOString()
  },
  {
    id: "acc_2",
    fullName: "Trần Anh Quốc",
    email: "congan.anphu@gmail.com",
    role: "Công an khu vực",
    active: true,
    canEdit: true,
    password: "123",
    provider: "local",
    createdAt: new Date().toISOString()
  },
  {
    id: "acc_3",
    fullName: "Lê Sĩ Hoàng",
    email: "bitu.kp3@gmail.com",
    role: "Bí thư Chi bộ",
    active: true,
    canEdit: true,
    password: "123",
    provider: "local",
    createdAt: new Date().toISOString()
  },
  {
    id: "acc_kd",
    fullName: "Phạm Minh Chiến",
    email: "khu_doi_truong",
    role: "Khu Đội Trưởng",
    active: true,
    canEdit: true,
    password: "123",
    provider: "local",
    createdAt: new Date().toISOString()
  }
];

export const SEED_GIS_HOUSEHOLDS: GisHousehold[] = [
  {
    id: "HH001",
    headerName: "Nguyễn Lâm Hùng",
    address: "12 Thảo Điền, Phường An Phú, TP. Hồ Chí Minh",
    phoneNumber: "0908123456",
    notes: "Hộ gia đình cách mạng tiêu biểu tại khu phố.",
    groupNDTQ: "Tổ 3",
    lat: 10.802105,
    lng: 106.721543,
    geom: "POINT(106.721543 10.802105)",
    gisCode: "KP3-HH001"
  },
  {
    id: "HH002",
    headerName: "Trần Thị Mai",
    address: "45/2 Đường 5, Phường An Phú, TP. Hồ Chí Minh",
    phoneNumber: "0967888999",
    notes: "Hộ gia đình hoạt động tích cực, làm nòng cốt công tác phụ nữ hẻm.",
    groupNDTQ: "Tổ 4",
    lat: 10.803241,
    lng: 106.725892,
    geom: "POINT(106.725892 10.803241)",
    gisCode: "KP3-HH002"
  },
  {
    id: "HH003",
    headerName: "Phạm Ngọc Anh",
    address: "Căn hộ 12.04 CC The Vista, Phường An Phú, TP. Hồ Chí Minh",
    phoneNumber: "0934112233",
    notes: "Cư dân trẻ văn minh, Đảng viên về giữ liên lạc 213.",
    groupNDTQ: "Tổ 4",
    lat: 10.805123,
    lng: 106.728905,
    geom: "POINT(106.728905 10.805123)",
    gisCode: "KP3-HH003"
  },
  {
    id: "HH004",
    headerName: "Vương Đình Bằng",
    address: "89/10 Đường Quốc Hương, Phường An Phú, TP. Hồ Chí Minh",
    phoneNumber: "0909555222",
    notes: "Gia cảnh khó khăn, cần theo dõi chế độ chính sách người khuyết tật và trẻ em.",
    groupNDTQ: "Tổ 10",
    lat: 10.801567,
    lng: 106.723145,
    geom: "POINT(106.723145 10.801567)",
    gisCode: "KP3-HH004"
  },
  {
    id: "HH005",
    headerName: "Lê Sĩ Hoàng",
    address: "15 Ba Son, Phường An Phú, TP. Hồ Chí Minh",
    phoneNumber: "0903998877",
    notes: "Gia đình đảng viên gương mẫu tiêu biểu.",
    groupNDTQ: "Tổ 3",
    lat: 10.804198,
    lng: 106.727102,
    geom: "POINT(106.727102 10.804198)",
    gisCode: "KP3-HH005"
  },
  {
    id: "HH006",
    headerName: "Trần Anh Quốc",
    address: "7 Lương Định Của, Phường An Phú, TP. Hồ Chí Minh",
    phoneNumber: "0977223344",
    notes: "Cán bộ công an khu vực lưu trú.",
    groupNDTQ: "Tổ 8",
    lat: 10.802890,
    lng: 106.724891,
    geom: "POINT(106.724891 10.802890)",
    gisCode: "KP3-HH006"
  }
];

export const SEED_GIS_STREETS: GisStreet[] = [
  {
    id: "ST001",
    name: "Đường Thảo Điền",
    description: "Trục đường chính xuyên qua trung tâm Thảo Điền - An Phú.",
    geom: "LINESTRING(106.7215 10.7985, 106.7225 10.8015, 106.7235 10.8045, 106.7245 10.8075)"
  },
  {
    id: "ST002",
    name: "Đường Quốc Hương",
    description: "Tuyến đường huyết mạch nối Thảo Điền với khu chung cư An Phú.",
    geom: "LINESTRING(106.7205 10.8015, 106.7235 10.8025, 106.7265 10.8035, 106.7295 10.8045)"
  },
  {
    id: "ST003",
    name: "Đường Lương Định Của",
    description: "Đoạn đường kết nối thương mại của khu cư dân.",
    geom: "LINESTRING(106.7230 10.7980, 106.7260 10.8010, 106.7290 10.8040)"
  },
  {
    id: "ST004",
    name: "Đường Ba Son",
    description: "Tuyến đường ven sông kết nối đô thị mới.",
    geom: "LINESTRING(106.7265 10.8035, 106.7275 10.8055, 106.7285 10.8075)"
  }
];

export const SEED_GIS_SUBZONES: GisSubzone[] = [
  {
    id: "SZ003",
    name: "Tổ dân phố 3",
    leaderName: "Nguyễn Lâm Hùng",
    color: "#10b981",
    geom: "POLYGON((106.720 10.800, 106.723 10.800, 106.723 10.803, 106.720 10.803, 106.720 10.800))"
  },
  {
    id: "SZ004",
    name: "Tổ dân phố 4",
    leaderName: "Trần Thị Mai",
    color: "#3b82f6",
    geom: "POLYGON((106.723 10.800, 106.726 10.800, 106.726 10.803, 106.723 10.803, 106.723 10.800))"
  },
  {
    id: "SZ008",
    name: "Tổ dân phố 8",
    leaderName: "Lê Sĩ Hoàng",
    color: "#f59e0b",
    geom: "POLYGON((106.726 10.803, 106.730 10.803, 106.730 10.807, 106.726 10.807, 106.726 10.803))"
  },
  {
    id: "SZ010",
    name: "Tổ dân phố 10",
    leaderName: "Vương Đình Bằng",
    color: "#ec4899",
    geom: "POLYGON((106.720 10.803, 106.724 10.803, 106.724 10.807, 106.720 10.807, 106.720 10.803))"
  }
];

export const SEED_GIS_FEATURES: GisFeature[] = [
  {
    id: "F001",
    name: "Trụ sở Ban Điều Hành KP3",
    type: "headquarters",
    lat: 10.8020,
    lng: 106.7250,
    geom: "POINT(106.7250 10.8020)"
  },
  {
    id: "F002",
    name: "Camera AI An Ninh 1 - Ngã 4 Thảo Điền",
    type: "camera",
    lat: 10.8015,
    lng: 106.7225,
    geom: "POINT(106.7225 10.8015)"
  },
  {
    id: "F003",
    name: "Camera AI An Ninh 2 - Đầu hẻm Quốc Hương",
    type: "camera",
    lat: 10.8035,
    lng: 106.7265,
    geom: "POINT(106.7265 10.8035)"
  },
  {
    id: "F004",
    name: "Nhà Văn hóa Thể thao Khu phố 3",
    type: "culture_house",
    lat: 10.8055,
    lng: 106.7245,
    geom: "POINT(106.7245 10.8055)"
  },
  {
    id: "F005",
    name: "Điểm có nguy cơ mất ATTT Hẻm Bách Hóa",
    type: "hotspot",
    lat: 10.8040,
    lng: 106.7235,
    geom: "POINT(106.7235 10.8040)"
  },
  {
    id: "F006",
    name: "Trạm y tế lưu động Phường An Phú",
    type: "medical",
    lat: 10.8030,
    lng: 106.7285,
    geom: "POINT(106.7285 10.8030)"
  },
  {
    id: "F007",
    name: "Trường Tiểu Học Thảo Điền",
    type: "school",
    lat: 10.8065,
    lng: 106.7215,
    geom: "POINT(106.7215 10.8065)"
  }
];

export function loadDatabase(): DatabaseState {
  if (dbCache) {
    return dbCache;
  }
  const DEFAULT_GROUPS = [
    "Đảng viên", 
    "Đảng viên 213", 
    "CCB", 
    "Phụ nữ", 
    "Thanh niên", 
    "Chữ thập đỏ", 
    "Ban điều hành", 
    "Ban công tác Mặt trận", 
    "An ninh trật tự cơ sở", 
    "Cộng tác viên dân số", 
    "Tổ công nghệ số cộng đồng"
  ];
  
  const DEFAULT_NDTQS = Array.from({ length: 14 }, (_, i) => `Tổ ${i + 1}`);

  if (!fs.existsSync(DATA_FILE)) {
    const initialState: DatabaseState = {
      residents: SEED_RESIDENTS,
      households: SEED_HOUSEHOLDS,
      schedules: SEED_SCHEDULES,
      templates: DEFAULT_TEMPLATES,
      documents: [],
      logs: SEED_LOGS,
      businesses: SEED_BUSINESSES,
      accounts: SEED_ACCOUNTS,
      officialDocuments: SEED_OFFICIAL_DOCUMENTS,
      availableGroups: DEFAULT_GROUPS,
      availableNDTQs: DEFAULT_NDTQS,
      availablePolicies: [
        "Hộ nghèo",
        "Hộ cận nghèo",
        "Người khuyết tật",
        "Trẻ em",
        "Thương binh",
        "Bệnh binh",
        "Thân nhân liệt sĩ",
        "Người có công"
      ],
      gisHouseholds: SEED_GIS_HOUSEHOLDS,
      gisStreets: SEED_GIS_STREETS,
      gisSubzones: SEED_GIS_SUBZONES,
      gisFeatures: SEED_GIS_FEATURES
    };
    saveDatabase(initialState);
    return initialState;
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const sanitizedRaw = raw.replace(/An Phú, TP\. Thủ Đức, TP\.HCM/gi, "Phường An Phú, TP. Hồ Chí Minh");
    const parsed = JSON.parse(sanitizedRaw);
    if (!parsed.availableGroups) {
      parsed.availableGroups = DEFAULT_GROUPS;
      saveDatabase(parsed);
    }
    if (!parsed.availableNDTQs) {
      parsed.availableNDTQs = DEFAULT_NDTQS;
      saveDatabase(parsed);
    }
    if (!parsed.availablePolicies) {
      parsed.availablePolicies = [
        "Hộ nghèo",
        "Hộ cận nghèo",
        "Người khuyết tật",
        "Trẻ em",
        "Thương binh",
        "Bệnh binh",
        "Thân nhân liệt sĩ",
        "Người có công"
      ];
      saveDatabase(parsed);
    }
    if (!parsed.businesses) {
      parsed.businesses = SEED_BUSINESSES;
    }
    if (!parsed.officialDocuments) {
      parsed.officialDocuments = SEED_OFFICIAL_DOCUMENTS;
      saveDatabase(parsed);
    }
    
    // Core spatial integrations
    let hasGisUpdates = false;
    if (!parsed.gisHouseholds) {
      parsed.gisHouseholds = SEED_GIS_HOUSEHOLDS;
      hasGisUpdates = true;
    }
    if (!parsed.gisStreets) {
      parsed.gisStreets = SEED_GIS_STREETS;
      hasGisUpdates = true;
    }
    if (!parsed.gisSubzones) {
      parsed.gisSubzones = SEED_GIS_SUBZONES;
      hasGisUpdates = true;
    }
    if (!parsed.gisFeatures) {
      parsed.gisFeatures = SEED_GIS_FEATURES;
      hasGisUpdates = true;
    }
    if (hasGisUpdates) {
      saveDatabase(parsed);
    }
    if (!parsed.accounts) {
      parsed.accounts = SEED_ACCOUNTS;
      saveDatabase(parsed);
    } else {
      // Ensure the master admin account exists
      const hasAdmin = parsed.accounts.some((acc: any) => acc.email && acc.email.toLowerCase().trim() === "admin");
      if (!hasAdmin) {
        parsed.accounts.unshift({
          id: "acc_admin",
          fullName: "Quản trị viên Hệ thống",
          email: "admin",
          role: "Super Admin",
          active: true,
          canEdit: true,
          password: "Trunghuy741",
          provider: "local",
          createdAt: new Date().toISOString()
        });
        saveDatabase(parsed);
      } else {
        // Enforce the requested password and role correct for master admin
        const adminAcc = parsed.accounts.find((acc: any) => acc.email && acc.email.toLowerCase().trim() === "admin");
        if (adminAcc) {
          adminAcc.password = "Trunghuy741";
          adminAcc.role = "Super Admin";
          adminAcc.canEdit = true;
        }

        // Enforce Super Admin and correct authorization status for the developer account
        const userAcc = parsed.accounts.find((acc: any) => acc.email && acc.email.toLowerCase().trim() === "bdhkhupho3.ap@gmail.com");
        if (userAcc) {
          userAcc.role = "Super Admin";
          userAcc.canEdit = true;
          userAcc.active = true;
          if (userAcc.password !== "123" && userAcc.password !== "Trunghuy741" && userAcc.password) {
            // Keep their custom customized password
          } else {
            userAcc.password = "Trunghuy741";
          }
        } else {
          parsed.accounts.push({
            id: "acc_1",
            fullName: "Nguyễn Lâm Hùng",
            email: "bdhkhupho3.ap@gmail.com",
            role: "Super Admin",
            active: true,
            canEdit: true,
            password: "Trunghuy741",
            provider: "local",
            createdAt: new Date().toISOString()
          });
        }
        saveDatabase(parsed);
      }
    }
    return parsed;
  } catch (err) {
    console.error("Database reading error, resetting with seeds:", err);
    const initialState: DatabaseState = {
      residents: SEED_RESIDENTS,
      households: SEED_HOUSEHOLDS,
      schedules: SEED_SCHEDULES,
      templates: DEFAULT_TEMPLATES,
      documents: [],
      logs: SEED_LOGS,
      businesses: SEED_BUSINESSES,
      accounts: SEED_ACCOUNTS,
      officialDocuments: SEED_OFFICIAL_DOCUMENTS
    };
    saveDatabase(initialState);
    return initialState;
  }
}

export let isSupabaseTableAvailable: boolean | null = null;

export function setSupabaseTableAvailable(val: boolean | null) {
  isSupabaseTableAvailable = val;
}

export async function syncToSupabase(dbState: DatabaseState): Promise<void> {
  if (!supabase) {
    console.warn("Supabase backup sync bypassed: client not initialized.");
    isSupabaseTableAvailable = false;
    return;
  }

  if (isSupabaseTableAvailable === false) {
    return; // Bypass calls to avoid spamming the logs when the table is not initialized yet
  }

  try {
    const { error } = await supabase
      .from("system_state")
      .upsert({
        id: "default_db",
        data: dbState,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    
    if (error) {
      const isMissingTable = error.code === "PGRST116" || error.code === "PGRST204" || error.message.includes("relation") || error.code === "42P01" || error.message.includes("Could not find the table");
      if (isMissingTable) {
        isSupabaseTableAvailable = false;
        console.warn("Table 'system_state' is not initialized in your Supabase database. Local state is saved securely. Sync is suspended until table setup.");
      } else {
        console.warn("Supabase sync notice:", error.message);
      }
    } else {
      isSupabaseTableAvailable = true;
      console.log("Successfully backup synchronized to Supabase!");
    }
  } catch (err: any) {
    console.warn("Unexpected exception during Supabase sync:", err.message || err);
  }
}

export async function preloadDatabaseFromSupabase(): Promise<void> {
  console.log("Checking and preloading database state from Supabase...");
  if (!supabase) {
    console.warn("Supabase client is not initialized. Using local JSON database (offline-first mode).");
    isSupabaseTableAvailable = false;
    return;
  }

  try {
    const { data, error } = await supabase
      .from("system_state")
      .select("data")
      .eq("id", "default_db")
      .maybeSingle();

    if (error) {
      const isMissingTable = error.code === "PGRST116" || error.code === "PGRST204" || error.message.includes("relation") || error.code === "42P01" || error.message.includes("Could not find the table");
      if (isMissingTable) {
        isSupabaseTableAvailable = false;
        console.warn("Table 'system_state' does not exist yet. Running local database state data.json.");
      } else {
        console.warn("Could not preload database from Supabase:", error.message);
      }
      return;
    }

    isSupabaseTableAvailable = true;
    if (data && data.data) {
      const dbState = data.data as DatabaseState;
      dbCache = dbState; // Cache in memory
      console.log("Database successfully synchronized from Supabase! Updating local data.json...");
      try {
        let str = JSON.stringify(dbState, null, 2);
        str = str.replace(/An Phú, TP\. Thủ Đức, TP\.HCM/gi, "Phường An Phú, TP. Hồ Chí Minh");
        fs.writeFileSync(DATA_FILE, str, "utf-8");
        console.log("Local data.json cache updated successfully from Supabase.");
      } catch (writeErr: any) {
        console.warn("Failed to write updated database to local data.json cache (expected in serverless):", writeErr.message || writeErr);
      }
    } else {
      console.log("No existing database state found on Supabase. Uploading the initial local seed state...");
      const localState = loadDatabase();
      await syncToSupabase(localState);
    }
  } catch (err: any) {
    isSupabaseTableAvailable = false;
    console.warn("Notice in preloadDatabaseFromSupabase:", err.message || err);
  }
}

export function saveDatabase(data: DatabaseState) {
  dbCache = data; // Update in-memory cache
  try {
    let str = JSON.stringify(data, null, 2);
    str = str.replace(/An Phú, TP\. Thủ Đức, TP\.HCM/gi, "Phường An Phú, TP. Hồ Chí Minh");
    
    // Attempt local file write, but ignore read-only failures in serverless environments
    try {
      fs.writeFileSync(DATA_FILE, str, "utf-8");
    } catch (writeErr: any) {
      console.warn("Local filesystem write bypassed (expected in read-only serverless environment):", writeErr.message || writeErr);
    }
    
    // Background async sync to Supabase (always runs)
    syncToSupabase(data).catch(err => {
      console.warn("Async Supabase backup sync bypassed or failed:", err);
    });
  } catch (err) {
    console.error("Database saving error:", err);
  }
}


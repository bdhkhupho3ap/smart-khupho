export interface Resident {
  id: string;
  fullName: string;
  cccd: string;
  dob: string; // YYYY-MM-DD
  gender: 'Nam' | 'Nữ' | 'Khác';
  address: string;
  phoneNumber: string;
  job: string;
  education: string;
  religion: string;
  ethnicity: string;
  avatar?: string;
  notes: string;
  residenceType: 'Thường trú' | 'Tạm trú' | 'Tạm vắng';
  householdId: string; // Sổ hộ khẩu / Mã hộ gia đình
  relationWithHeader: string; // "Chủ hộ", "Vợ", "Con", etc.
  groups: string[]; // ['Đảng viên', 'Đảng viên 213', 'CCB', 'Chữ thập đỏ', 'Phụ nữ', 'Thanh niên', 'Ban điều hành', 'Ban công tác Mặt trận']
  specialCategories: string[]; // ['Hộ nghèo', 'Hộ cận nghèo', 'Người khuyết tật', 'Trẻ em', 'Viên chức']
  militaryCategories?: string[]; // ['Thanh niên đã hoàn thành nghĩa vụ quân sự', 'Quân nhân dự bị hạng nhất', 'Sĩ quan dự bị', 'Thanh niên tuổi 17', 'Cán bộ hưởng chế độ của quân sự']
  militaryNotes?: string;
  updatedAt?: string;
  groupNDTQ?: string; // Tổ NDTQ (Tổ Nhân dân tự quản)
  createdBy?: string; // Tài khoản cán bộ đã tạo
}

export interface Household {
  id: string; // Mã hộ khẩu / Số nhà
  headerName: string;
  address: string;
  phoneNumber: string;
  notes?: string;
  groupNDTQ?: string; // Tổ NDTQ (Tổ Nhân dân tự quản)
}

export interface TaskAssignment {
  id: string;
  assigneeName: string;
  assigneeRole: string;
  task: string;
  status: 'Cần làm' | 'Đang làm' | 'Đã hoàn thành' | 'Trễ hạn';
  note?: string;
  updatedAt?: string;
}

export interface WorkSchedule {
  id: string;
  title: string;
  dateTime: string; // YYYY-MM-DDTHH:mm
  location: string;
  attendees: string;
  description: string;
  isMeeting: boolean;
  smsNotificationSimulated?: boolean;
  dueDate?: string; // Hạn chót xử lý văn bản / kế hoạch
  externalDocName?: string; // Tên văn bản nguồn bên ngoài
  externalDocContent?: string; // Nội dung văn bản ngoài lưu trữ
  externalDocFileBase64?: string; // Tệp đính kèm mã hóa base64 phục vụ lưu trữ
  externalDocFileType?: string; // Định dạng file đính kèm
  externalDocFileSize?: string; // Dung lượng file đính kèm
  priority?: 'Khẩn cấp' | 'Quan trọng' | 'Thông thường'; // Độ khẩn cấp & thứ tự ưu tiên làm trước sau
  organizer?: string; // Đầu mối chính / Người phụ trách / Người tham gia xử lý đích danh
  assignments?: TaskAssignment[]; // Lịch phân công công việc chi tiết
  isCompleted?: boolean; // Đánh dấu hoàn tất toàn bộ để không bị cảnh báo trễ hạn
}

export interface DocumentTemplate {
  id: string;
  name: string;
  type: string; // "Thông báo" | "Biên bản họp" | "Báo cáo tháng" | "Kế hoạch" | "Giấy mời" | "Công văn" | "Tuyển tập quy ước" | "Nghị quyết" | "Báo cáo ANTT"
  description: string;
  structure: string;
}

export interface GeneratedDocument {
  id: string;
  title: string;
  templateType: string;
  content: string; // AI generated markdown / HTML
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  userName: string;
  userRole: string;
  action: string;
  timestamp: string;
  details?: string;
}

export type UserRole =
  | 'Super Admin'
  | 'Super Mod'
  | 'Bí thư Chi bộ'
  | 'Trưởng Khu phố'
  | 'Trưởng Ban điều hành'
  | 'Trưởng ban công tác Mặt trận'
  | 'Chi hội trưởng'
  | 'Tổ trưởng Tổ dân phố'
  | 'Cán bộ nhập liệu'
  | 'Cộng tác viên'
  | 'Người xem báo cáo'
  | 'Viewer';

export interface UserAccount {
  id: string;
  fullName: string;
  role: UserRole;
  email: string;
  active: boolean;
  canEdit?: boolean;
  permissionType?: string;
  associationGroup?: string;
}

export interface BusinessEstablishment {
  id: string;
  name: string;
  businessType: string;
  ownerName: string;
  cccd: string;
  address: string;
  phoneNumber: string;
  registrationNumber?: string;
  employeesCount: number;
  safetyInspectionDate?: string; // YYYY-MM-DD
  status: 'Đang hoạt động' | 'Tạm ngừng' | 'Ngừng hoạt động';
  notes?: string;
}

export interface OfficialDocument {
  id: string;
  title: string;
  docNumber: string; // Số/Ký hiệu văn bản
  dateIssued: string; // Ngày ban hành / Ngày nhận (YYYY-MM-DD)
  senderOrReceiver: string; // Cơ quan ban hành (cho văn bản đến) hoặc Nơi nhận (cho văn bản đi)
  type: 'incoming' | 'outgoing'; // Loại văn bản: 'incoming' (Văn bản đến) hoặc 'outgoing' (Văn bản đi)
  category: 'Đảng' | 'Chính quyền' | 'Mặt trận và các đoàn thể'; // 3 mục con
  year: number; // Lưu trữ nhiều năm
  month: number; // Lọc theo tháng
  externalFileBase64?: string; // Sửa đổi lưu tệp đính kèm mã hóa base64
  externalFileName?: string; // Tên tệp gốc
  externalFileType?: string; // Loại tệp (pdf, doc, png, v.v)
  externalFileSize?: string; // Dung lượng tệp
  summary?: string; // Tóm tắt nội dung văn bản
  updatedAt?: string;
}

// GIS Spatial Data Types representing PostGIS schema requirements
export interface GisHousehold extends Household {
  lat: number;
  lng: number;
  geom: string; // WKT - "POINT(long lat)"
  gisCode: string; // e.g. KP3-HH-001
}

export interface GisStreet {
  id: string;
  name: string;
  description: string;
  geom: string; // WKT - "LINESTRING(long lat, long lat, ...)"
}

export interface GisSubzone {
  id: string;
  name: string;
  leaderName: string;
  color?: string;
  geom: string; // WKT - "POLYGON((long lat, long lat, ...))"
}

export interface GisFeature {
  id: string;
  name: string;
  type: 'camera' | 'lodging' | 'headquarters' | 'hotspot' | 'culture_house' | 'medical' | 'school';
  lat: number;
  lng: number;
  geom: string; // WKT - "POINT(long lat)"
}

export interface GisQueryResult {
  query: string;
  sqlCommand: string;
  executionTimeMs: number;
  returnedCount: number;
  data: any;
}



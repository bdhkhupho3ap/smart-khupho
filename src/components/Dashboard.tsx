import React from "react";
import { Resident, Household, WorkSchedule, ActivityLog } from "../types";
import { Users, Home, Calendar, ShieldCheck, HeartHandshake, Award } from "lucide-react";
import { formatDateTime, formatDateTimeHM } from "../utils/dateTimeUtils";

interface DashboardProps {
  residents: Resident[];
  households: Household[];
  schedules: WorkSchedule[];
  logs: ActivityLog[];
  onNavigate: (tab: string) => void;
  activeRole?: string;
}

export default function Dashboard({ residents, households, schedules, logs, onNavigate, activeRole }: DashboardProps) {
  // 1. Calculate statistics
  const totalRes = residents.length;
  const thuongTru = residents.filter(r => r.residenceType === "Thường trú").length;
  const tamTru = residents.filter(r => r.residenceType === "Tạm trú").length;
  const tamVang = residents.filter(r => r.residenceType === "Tạm vắng").length;
  
  const hoNgheo = residents.filter(r => r.specialCategories.includes("Hộ nghèo")).length;
  const hoCanNgheo = residents.filter(r => r.specialCategories.includes("Hộ cận nghèo")).length;
  const khuyetTat = residents.filter(r => r.specialCategories.includes("Người khuyết tật")).length;
  const treEm = residents.filter(r => r.specialCategories.includes("Trẻ em")).length;
  const dacBietCount = hoNgheo + hoCanNgheo + khuyetTat;

  const dangVien = residents.filter(r => r.groups.includes("Đảng viên 213")).length;
  const dangVienChinhThuc = residents.filter(r => r.groups.includes("Đảng viên")).length;
  const thanhNien = residents.filter(r => r.groups.includes("Thanh niên")).length;
  const ccb = residents.filter(r => r.groups.includes("CCB")).length;
  const phuNu = residents.filter(r => r.groups.includes("Phụ nữ")).length;

  // 2. Demographic age calculations
  const calculateAge = (dobString: string) => {
    try {
      const birth = new Date(dobString);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age;
    } catch {
      return 30; // fallback default
    }
  };

  const ageGroups = {
    children: 0,   // Under 16
    youth: 0,      // 16 to 30
    middle: 0,     // 31 to 60
    elderly: 0     // Over 60
  };

  residents.forEach(r => {
    const age = calculateAge(r.dob);
    if (age < 16) ageGroups.children++;
    else if (age <= 30) ageGroups.youth++;
    else if (age <= 60) ageGroups.middle++;
    else ageGroups.elderly++;
  });

  // Today's schedules
  const upcomingSchedules = [...schedules]
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
    .slice(0, 3);

  // Quick activity logs
  const quickLogs = logs.slice(0, 4);

  // SVG Chart Computations
  // Circular donut representation for age groups
  const ageTotal = totalRes || 1;
  const pChildren = (ageGroups.children / ageTotal) * 100;
  const pYouth = (ageGroups.youth / ageTotal) * 100;
  const pMiddle = (ageGroups.middle / ageTotal) * 100;
  const pElderly = (ageGroups.elderly / ageTotal) * 100;

  // Horizontal bar charts calculations
  const maxGroupValue = Math.max(ccb, phuNu, thanhNien, dangVien, dangVienChinhThuc, 1);

  return (
    <div className="space-y-6">
      {/* 1. Header Hero section */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-700 text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Chào mừng đến với Smart Khu Phố 3</h2>
          <p className="text-emerald-100 mt-1 max-w-xl text-sm">
            Hệ thống quản lý thống nhất dân cư, đoàn thể, lịch công tác và soạn thảo văn bản hỗ trợ bởi AI vinh dự đồng hành cùng Ban Điều hành Khu phố 3, Phường An Phú, TP. Hồ Chí Minh.
          </p>
        </div>
        <button
          onClick={() => onNavigate("ai-composer")}
          className="bg-white text-emerald-800 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-50 transition cursor-pointer flex items-center gap-2 shadow"
        >
          <Award className="h-4 w-4 text-emerald-600" />
          AI Soạn Văn Bản Hành Chính
        </button>
      </div>

      {/* 2. Numerical Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-xs border border-gray-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tổng Nhân Khẩu</span>
            <span className="p-1 bg-blue-50 text-blue-600 rounded-lg"><Users className="h-5 w-5" /></span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-gray-900">{totalRes}</h3>
            <span className="text-[10px] text-gray-400">công dân lưu trú</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-xs border border-gray-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Hộ Gia Đình</span>
            <span className="p-1 bg-emerald-50 text-emerald-600 rounded-lg"><Home className="h-5 w-5" /></span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-gray-900">{households.length}</h3>
            <span className="text-[10px] text-gray-400">sổ hộ khẩu ghi nhận</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-xs border border-gray-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Thường Trú</span>
            <span className="p-1 bg-teal-50 text-teal-600 rounded-lg"><Home className="h-5 w-5" /></span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-gray-900">{thuongTru}</h3>
            <span className="text-xs text-teal-600 font-medium">{((thuongTru/ageTotal)*100).toFixed(0)}% dân số</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-xs border border-gray-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tạm Trú</span>
            <span className="p-1 bg-orange-50 text-orange-600 rounded-lg"><Users className="h-5 w-5" /></span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-gray-900">{tamTru}</h3>
            <span className="text-xs text-orange-600 font-medium">Lưu trú ngắn hạn</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-xs border border-gray-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Đối Tượng Hỗ Trợ</span>
            <span className="p-1 bg-rose-50 text-rose-600 rounded-lg"><HeartHandshake className="h-5 w-5" /></span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-gray-900">{dacBietCount}</h3>
            <span className="text-[10px] text-gray-400">Nghèo: {hoNgheo} | Cận nghèo: {hoCanNgheo} | Khuyết tật: {khuyetTat}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-xs border border-gray-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tổng số Đảng Viên</span>
            <span className="p-1 bg-red-50 text-red-600 rounded-lg"><ShieldCheck className="h-5 w-5" /></span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-gray-900">{dangVienChinhThuc + dangVien}</h3>
            <span className="text-[10px] text-gray-400">Chi bộ: {dangVienChinhThuc} | Quy định 213: {dangVien}</span>
          </div>
        </div>
      </div>

      {/* 3. Interactive SVG Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart A: Demographics (Donut) */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-xs">
          <h3 className="text-sm font-semibold text-gray-800 tracking-tight mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            Biểu Đồ Thống Kê Theo Độ Tuổi
          </h3>
          <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
            {/* Visual Donut representation */}
            <div className="relative w-44 h-44 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                {/* Gray neutral background ring */}
                <circle cx="88" cy="88" r="65" stroke="#f1f5f9" strokeWidth="24" fill="transparent" />
                
                {/* Segments calculation */}
                {/* Children: Yellow */}
                <circle
                  cx="88" cy="88" r="65"
                  stroke="#fbbf24"
                  strokeWidth="24"
                  strokeDasharray={`${2 * Math.PI * 65}`}
                  strokeDashoffset={`${2 * Math.PI * 65 * (1 - pChildren / 100)}`}
                  fill="transparent"
                />
                
                {/* Youth: Green */}
                <circle
                  cx="88" cy="88" r="65"
                  stroke="#10b981"
                  strokeWidth="24"
                  strokeDasharray={`${2 * Math.PI * 65}`}
                  strokeDashoffset={`${2 * Math.PI * 65 * (1 - pYouth / 100)}`}
                  transform={`rotate(${(pChildren / 100) * 360} 88 88)`}
                  fill="transparent"
                />

                {/* Middle worker: Blue */}
                <circle
                  cx="88" cy="88" r="65"
                  stroke="#3b82f6"
                  strokeWidth="24"
                  strokeDasharray={`${2 * Math.PI * 65}`}
                  strokeDashoffset={`${2 * Math.PI * 65 * (1 - pMiddle / 100)}`}
                  transform={`rotate(${((pChildren + pYouth) / 100) * 360} 88 88)`}
                  fill="transparent"
                />

                {/* Elder: Crimson */}
                <circle
                  cx="88" cy="88" r="65"
                  stroke="#ef4444"
                  strokeWidth="24"
                  strokeDasharray={`${2 * Math.PI * 65}`}
                  strokeDashoffset={`${2 * Math.PI * 65 * (1 - pElderly / 100)}`}
                  transform={`rotate(${((pChildren + pYouth + pMiddle) / 100) * 360} 88 88)`}
                  fill="transparent"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-xs text-gray-400 font-medium">Trung bình</span>
                <span className="text-base font-bold text-gray-800">Cơ cấu</span>
              </div>
            </div>

            {/* Legends & Numbers */}
            <div className="space-y-2.5 w-full sm:w-1/2">
              <div className="flex justify-between items-center text-xs">
                <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-md bg-[#fbbf24]"></span>Trẻ em (Dưới 16t)</span>
                <span className="font-semibold text-gray-700">{ageGroups.children} người ({pChildren.toFixed(0)}%)</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-md bg-[#10b981]"></span>Thanh niên (16-30t)</span>
                <span className="font-semibold text-gray-700">{ageGroups.youth} người ({pYouth.toFixed(0)}%)</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-md bg-[#3b82f6]"></span>Lao động (31-60t)</span>
                <span className="font-semibold text-gray-700">{ageGroups.middle} người ({pMiddle.toFixed(0)}%)</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-md bg-[#ef4444]"></span>Cao tuổi (Trên 60t)</span>
                <span className="font-semibold text-gray-700">{ageGroups.elderly} người ({pElderly.toFixed(0)}%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chart B: Group Memberships (Bar metrics) */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-xs">
          <h3 className="text-sm font-semibold text-gray-800 tracking-tight mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            Số Lượng Thành Viên Các Đoàn Thể
          </h3>
          <div className="space-y-4 pt-1">
            {/* 1. CCB */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-gray-600">Chi hội Cựu chiến binh (CCB)</span>
                <span className="font-bold text-gray-800">{ccb} hội viên</span>
              </div>
              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${(ccb / maxGroupValue) * 100}%` }}></div>
              </div>
            </div>

            {/* 2. Phu Nu */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-gray-600">Chi hội Phụ nữ</span>
                <span className="font-bold text-gray-800">{phuNu} hội viên</span>
              </div>
              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-pink-500 h-full rounded-full" style={{ width: `${(phuNu / maxGroupValue) * 100}%` }}></div>
              </div>
            </div>

            {/* 3. Thanh nien */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-gray-600">Chi đoàn Thanh niên</span>
                <span className="font-bold text-gray-800">{thanhNien} đoàn viên</span>
              </div>
              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full" style={{ width: `${(thanhNien / maxGroupValue) * 100}%` }}></div>
              </div>
            </div>

            {/* 4. Dang Vien Chinh Thuc */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-gray-600">Đảng viên Chi bộ</span>
                <span className="font-bold text-gray-800">{dangVienChinhThuc} đảng viên</span>
              </div>
              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-red-600 h-full rounded-full" style={{ width: `${(dangVienChinhThuc / maxGroupValue) * 100}%` }}></div>
              </div>
            </div>

            {/* 5. Dang Vien 213 */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-gray-600">Đảng viên Quy định 213 (Đảng viên liên lạc)</span>
                <span className="font-bold text-gray-800">{dangVien} đảng viên</span>
              </div>
              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-red-400 h-full rounded-full" style={{ width: `${(dangVien / maxGroupValue) * 100}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Schedules & Logs footer board */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's agenda work schedule */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-600" />
                Lịch Công Tác & Sự Kiện Sắp Tới
              </h3>
              <button
                onClick={() => onNavigate("calendar")}
                className="text-xs text-emerald-700 hover:underline hover:text-emerald-800 font-medium cursor-pointer"
              >
                Xem chi tiết
              </button>
            </div>

            {upcomingSchedules.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-6">Chưa ghi nhận lịch tuần mới.</p>
            ) : (
              <div className="space-y-3">
                {upcomingSchedules.map(sch => {
                  const displayTime = formatDateTimeHM(sch.dateTime);
                  
                  return (
                    <div key={sch.id} className="border-l-4 border-emerald-500 bg-emerald-50/45 p-3 rounded-r-lg space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-xs font-bold text-gray-800 line-clamp-1">{sch.title}</h4>
                        <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100 px-1.5 py-0.5 rounded shrink-0">
                          {displayTime}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 line-clamp-1">Địa điểm: {sch.location}</p>
                      <p className="text-[11px] text-gray-400 line-clamp-1 italic">TP: {sch.attendees}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Activity Logs history */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Nhật Ký Công Việc & Thay Đổi
              </h3>
              {activeRole && ["Super Admin", "Super Mod", "Bí thư Chi bộ", "Trưởng Khu phố", "Trưởng ban công tác Mặt trận"].includes(activeRole) && (
                <button
                  onClick={() => onNavigate("roles")}
                  className="text-xs text-emerald-600 hover:underline hover:text-emerald-700 font-medium cursor-pointer"
                >
                  Nhật ký rà soát
                </button>
              )}
            </div>

            <div className="space-y-3">
              {quickLogs.map(log => {
                const displayTime = formatDateTime(log.timestamp);
                
                return (
                  <div key={log.id} className="flex gap-3 justify-between text-xs border-b border-gray-50 pb-2 last:border-none">
                    <div className="space-y-0.5">
                      <p className="font-bold text-gray-800">{log.action}</p>
                      <p className="text-[10px] text-gray-400">Do **{log.userName}** thực hiện ({log.userRole})</p>
                    </div>
                    <span className="text-[10px] text-gray-400 italic shrink-0 whitespace-nowrap">{displayTime}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

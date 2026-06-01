import React, { useState, useEffect } from "react";
import { BusinessEstablishment, UserRole } from "../types";
import { formatDate as globalFormatDate } from "../utils/dateTimeUtils";
import { 
  Building2, 
  Plus, 
  Search, 
  Filter, 
  Edit3, 
  Trash2, 
  Phone, 
  MapPin, 
  ShieldAlert, 
  Briefcase, 
  User, 
  Users, 
  Calendar, 
  CheckCircle, 
  FileText, 
  AlertCircle,
  XCircle
} from "lucide-react";

interface BusinessesManagerProps {
  activeRole: UserRole;
  onRefresh: () => void;
  currentUser?: any;
}

export default function BusinessesManager({ activeRole, onRefresh, currentUser }: BusinessesManagerProps) {
  const [businesses, setBusinesses] = useState<BusinessEstablishment[]>([]);
  const [filterType, setFilterType] = useState<string>("All");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("All"); // actually initialized to ""
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorText, setErrorText] = useState<string>("");

  // Search logic and actual initialization
  const [searchVal, setSearchVal] = useState<string>("");

  // Modal control
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [selectedBiz, setSelectedBiz] = useState<BusinessEstablishment | null>(null);

  const [customAlert, setCustomAlert] = useState<string | null>(null);
  const [customConfirm, setCustomConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // Form State
  const [formState, setFormState] = useState<Partial<BusinessEstablishment>>({
    name: "",
    businessType: "Cửa hàng ăn uống",
    ownerName: "",
    cccd: "",
    address: "Khu phố 3, Phường An Phú, TP. Hồ Chí Minh",
    phoneNumber: "",
    registrationNumber: "",
    employeesCount: 1,
    safetyInspectionDate: "",
    status: "Đang hoạt động",
    notes: ""
  });

  const canEdit = ["Super Admin", "Bí thư Chi bộ", "Trưởng Ban điều hành", "Trưởng ban công tác Mặt trận", "Công an khu vực", "Cán bộ nhập liệu"].includes(activeRole) && (currentUser?.canEdit !== false);

  // Load Businesses from server
  const fetchBusinesses = async () => {
    setIsLoading(true);
    setErrorText("");
    try {
      const res = await fetch("/api/businesses", {
        headers: {
          "x-user-email": encodeURIComponent(currentUser?.email || "")
        }
      });
      if (!res.ok) {
        throw new Error("Không thể tải danh sách cơ sở kinh doanh.");
      }
      const data = await res.json();
      setBusinesses(data || []);
    } catch (err: any) {
      setErrorText(err.message || "Lỗi nạp dữ liệu từ hệ thống.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinesses();
  }, []);

  // Format Helper for YYYY-MM-DD -> dd/mm/yyyy
  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return "Chưa cập nhật";
    return globalFormatDate(dateStr);
  };

  // Safe submission of new/updated business
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name || !formState.ownerName || !formState.address) {
      setCustomAlert("Hành chính khu phố yêu cầu bổ sung tên cơ sở, người đại diện và địa chỉ.");
      return;
    }

    try {
      const url = modalMode === "add" ? "/api/businesses" : `/api/businesses/${selectedBiz?.id}`;
      const method = modalMode === "add" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-user-name": encodeURIComponent(currentUser?.fullName || ("Cán bộ " + activeRole)),
          "x-user-role": encodeURIComponent(activeRole || ""),
          "x-user-email": encodeURIComponent(currentUser?.email || "")
        },
        body: JSON.stringify({
          ...formState,
          employeesCount: Number(formState.employeesCount || 1)
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gặp sự cố khi lưu trữ thông tin cơ sở.");
      }

      setIsModalOpen(false);
      fetchBusinesses();
      onRefresh(); // Refresh logs on parent App
    } catch (err: any) {
      setCustomAlert(err.message);
    }
  };

  // Handle opening creation / edit modally
  const handleOpenAdd = () => {
    setModalMode("add");
    setSelectedBiz(null);
    setFormState({
      name: "",
      businessType: "Cửa hàng ăn uống",
      ownerName: "",
      cccd: "",
      address: "Khu phố 3, Phường An Phú, TP. Hồ Chí Minh",
      phoneNumber: "",
      registrationNumber: "",
      employeesCount: 1,
      safetyInspectionDate: new Date().toISOString().split("T")[0],
      status: "Đang hoạt động",
      notes: ""
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (biz: BusinessEstablishment) => {
    setModalMode("edit");
    setSelectedBiz(biz);
    setFormState({ ...biz });
    setIsModalOpen(true);
  };

  // Safe removal
  const handleDelete = (id: string, name: string) => {
    setCustomConfirm({
      message: `Xác nhận xóa vĩnh viễn dữ liệu cơ sở kinh doanh: "${name}" khỏi địa bàn khu phố 3?`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/businesses/${id}`, {
            method: "DELETE",
            headers: {
              "x-user-name": encodeURIComponent(currentUser?.fullName || ("Cán bộ " + activeRole)),
              "x-user-role": encodeURIComponent(activeRole || ""),
              "x-user-email": encodeURIComponent(currentUser?.email || "")
            }
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || "Lỗi trục xuất cơ sở.");
          }

          fetchBusinesses();
          onRefresh();
        } catch (err: any) {
          setCustomAlert(err.message);
        }
      }
    });
  };

  // Filtering calculation
  const filteredBusinesses = businesses.filter(biz => {
    const matchesSearch = 
      biz.name.toLowerCase().includes(searchVal.toLowerCase()) ||
      biz.ownerName.toLowerCase().includes(searchVal.toLowerCase()) ||
      biz.address.toLowerCase().includes(searchVal.toLowerCase()) ||
      (biz.registrationNumber && biz.registrationNumber.toLowerCase().includes(searchVal.toLowerCase()));

    const matchesType = filterType === "All" || biz.businessType === filterType;
    const matchesStatus = filterStatus === "All" || biz.status === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  // Calculate statistics metrics
  const totalBiz = businesses.length;
  const activeBiz = businesses.filter(b => b.status === "Đang hoạt động").length;
  const totalEmployees = businesses.reduce((sum, b) => sum + (b.employeesCount || 0), 0);
  const pendingInspections = businesses.filter(b => {
    if (!b.safetyInspectionDate) return true;
    // Over 6 months is considered "needs inspection"
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    return new Date(b.safetyInspectionDate) < sixMonthsAgo;
  }).length;

  return (
    <div className="space-y-6">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
        <div>
          <h2 className="text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <Building2 className="h-5 w-5 text-emerald-600" />
            Quản Lý Cơ Sở Kinh Doanh Địa Bàn KP3
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Giám sát, phân loại bách hóa, cửa hàng, công ty tư nhân, phòng chống kiểm tra an toàn PCCC, ATTP tại khu dân cư.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 cursor-pointer transition flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="h-4 w-4" /> Kê khai cơ sở mới
          </button>
        )}
      </div>

      {/* STATS TILES BANNER */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-2xs border border-gray-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tổng các Cơ sở</span>
            <span className="p-1 bg-slate-100 text-slate-600 rounded-lg"><Building2 className="h-4 w-4" /></span>
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-black text-gray-800">{totalBiz}</h3>
            <span className="text-[10px] text-gray-400">doanh nghiệp & hộ cá thể</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-2xs border border-gray-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Đang hoạt động</span>
            <span className="p-1 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle className="h-4 w-4" /></span>
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-black text-emerald-700">{activeBiz}</h3>
            <span className="text-[10px] text-emerald-400">hoạt động bình thường</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-2xs border border-gray-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Lao động đăng ký</span>
            <span className="p-1 bg-blue-50 text-blue-600 rounded-lg"><Users className="h-4 w-4" /></span>
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-black text-blue-800">{totalEmployees}</h3>
            <span className="text-[10px] text-blue-400">nhân viên khu dân cư</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-2xs border border-gray-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Trễ Kiểm Tra PCCC</span>
            <span className="p-1 bg-rose-50 text-rose-600 rounded-lg"><ShieldAlert className="h-4 w-4" /></span>
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-black text-rose-700">{pendingInspections}</h3>
            <span className="text-[10px] text-rose-400">quá 6 tháng chưa sát hạch lại</span>
          </div>
        </div>
      </div>

      {/* FILTER PANEL */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            placeholder="Tìm theo tên cơ sở, chủ sở hữu, địa chỉ, GPKD..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl text-xs">
            <Filter className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-gray-500">Loại hình:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-transparent border-none p-0 focus:outline-none font-bold text-gray-700 cursor-pointer"
            >
              <option value="All">Tất cả</option>
              <option value="Cửa hàng ăn uống">Cửa hàng ăn uống</option>
              <option value="Cửa hàng tiện lợi">Bách hóa / Tiện lợi</option>
              <option value="Quầy dược phẩm / Y tế">Dược phẩm / Y tế</option>
              <option value="Dịch vụ đời sống">Dịch vụ đời sống (Giặt ủi, Spa,...)</option>
              <option value="Công ty tư nhân / Văn phòng">Doanh nghiệp / Văn phòng</option>
              <option value="Cơ sở sản xuất">Cơ sở sản xuất nhỏ</option>
              <option value="Cơ sở trọ">Cơ sở trọ</option>
              <option value="Khác">Khác</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl text-xs">
            <Filter className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-gray-500">Trạng thái:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-transparent border-none p-0 focus:outline-none font-bold text-gray-700 cursor-pointer"
            >
              <option value="All">Tất cả</option>
              <option value="Đang hoạt động">Đang hoạt động</option>
              <option value="Tạm ngừng">Tạm ngừng</option>
              <option value="Ngừng hoạt động">Ngừng hoạt động</option>
            </select>
          </div>
        </div>
      </div>

      {/* CORE DATA TABLE DISPLAY */}
      <div className="bg-white rounded-2xl border border-gray-150 overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="h-44 flex flex-col items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-600 border-t-transparent"></div>
            <p className="text-xs text-gray-400 font-semibold">Đang liên tài liệu kiểm kê...</p>
          </div>
        ) : errorText ? (
          <div className="py-12 text-center text-xs text-rose-600 font-bold space-y-2">
            <p>{errorText}</p>
            <button onClick={fetchBusinesses} className="bg-rose-50 border border-rose-100 text-rose-700 px-3 py-1.5 rounded-lg active:scale-95 transition">Tải lại</button>
          </div>
        ) : filteredBusinesses.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-400 italic font-medium">Không tìm thấy cơ sở kinh doanh nào khớp điều kiện lọc.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600 border-collapse">
              <thead>
                <tr className="bg-slate-50 text-gray-400 border-b border-gray-150 text-[10px] uppercase font-black">
                  <th className="py-3 px-4">Tên cơ sở kinh doanh / Loại hình</th>
                  <th className="py-3 px-4">Chủ cơ sở (Đại diện)</th>
                  <th className="py-3 px-4">Số Đăng Ký (GPKD)</th>
                  <th className="py-3 px-4">Số Lao Động</th>
                  <th className="py-3 px-4">Kiểm duyệt PCCC</th>
                  <th className="py-3 px-4 text-center">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Tùy chọn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredBusinesses.map(biz => {
                  const isRecentInspection = () => {
                    if (!biz.safetyInspectionDate) return false;
                    const sixMonthsAgo = new Date();
                    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                    return new Date(biz.safetyInspectionDate) >= sixMonthsAgo;
                  };

                  return (
                    <tr key={biz.id} className="hover:bg-slate-50/40 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-50 rounded-xl text-emerald-700 shrink-0">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-bold text-gray-800 leading-snug">{biz.name}</p>
                            <span className="text-[10px] font-semibold text-gray-400 block mt-0.5">{biz.businessType}</span>
                            <span className="text-[10px] max-w-sm text-gray-400 font-normal mt-0.5 flex items-center gap-0.5"><MapPin className="h-3 w-3 shrink-0" /> {biz.address}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-normal">
                        <div className="space-y-0.5">
                          <p className="font-bold text-gray-700">{biz.ownerName}</p>
                          <p className="text-[10px] text-gray-400 font-mono">CCCD: {biz.cccd || "Chưa bổ sung"}</p>
                          {biz.phoneNumber && <p className="text-[10px] text-gray-400 flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" /> {biz.phoneNumber}</p>}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-gray-500">{biz.registrationNumber || "N/A - Hộ lẻ"}</td>
                      <td className="py-3.5 px-4 font-bold text-gray-800">{biz.employeesCount || 0} người</td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold inline-block border ${
                            isRecentInspection() 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                            : "bg-rose-50 text-rose-700 border-rose-100"
                          }`}>
                            {formatDate(biz.safetyInspectionDate)}
                          </span>
                          <span className="text-[9px] text-gray-400 block">
                            {isRecentInspection() ? "✓ Đạt chuẩn an toàn" : "⚠ Cần đặt lịch kiểm tra PCCC"}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] inline-block font-bold ${
                          biz.status === "Đang hoạt động" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                          biz.status === "Tạm ngừng" ? "bg-amber-50 text-amber-700 border border-amber-100" :
                          "bg-rose-50 text-rose-700 border border-rose-100"
                        }`}>
                          {biz.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex justify-end gap-1 select-all">
                          {canEdit ? (
                            <>
                              <button
                                onClick={() => handleOpenEdit(biz)}
                                className="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer transition"
                                title="Sửa lý lịch kinh doanh"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(biz.id, biz.name)}
                                className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition"
                                title="Xóa cơ sở"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <span className="text-gray-400 italic text-[10px]">Chỉ xem</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CORE DECLARATION CREATION/EDIT DIALOG MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 print:hidden overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-150 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100 my-8">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider">{modalMode === "add" ? "Khai báo cơ sở mới" : "Chỉnh sửa hồ sơ cơ sở"}</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white font-extrabold text-base cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs text-gray-700">
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-gray-600">Tên cơ sở kinh doanh, chi nhánh *</label>
                <input
                  type="text"
                  required
                  value={formState.name}
                  onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                  placeholder="Ví dụ: Siêu thị bách hóa tiện lợi Coop Food"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-gray-600">Loại hình kinh doanh</label>
                  <select
                    value={formState.businessType}
                    onChange={(e) => setFormState({ ...formState, businessType: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Cửa hàng ăn uống">Cửa hàng ăn uống</option>
                    <option value="Cửa hàng tiện lợi">Bách hóa / Tiện lợi</option>
                    <option value="Quầy dược phẩm / Y tế">Dược phẩm / Y tế</option>
                    <option value="Dịch vụ đời sống">Dịch vụ đời sống (Giặt ủi, Spa,...)</option>
                    <option value="Công ty tư nhân / Văn phòng">Doanh nghiệp / Văn phòng</option>
                    <option value="Cơ sở sản xuất">Cơ sở sản xuất nhỏ</option>
                    <option value="Cơ sở trọ">Cơ sở trọ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-gray-600">Trạng thái địa bàn</label>
                  <select
                    value={formState.status}
                    onChange={(e) => setFormState({ ...formState, status: e.target.value as any })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="Đang hoạt động">Đang hoạt động</option>
                    <option value="Tạm ngừng">Tạm ngừng</option>
                    <option value="Ngừng hoạt động">Ngừng hoạt động</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-gray-600">Họ tên chủ doanh nghiệp, đại diện *</label>
                  <input
                    type="text"
                    required
                    value={formState.ownerName}
                    onChange={(e) => setFormState({ ...formState, ownerName: e.target.value })}
                    placeholder="Nguyễn Văn A"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-gray-600">CCCD chủ cơ sở</label>
                  <input
                    type="text"
                    value={formState.cccd}
                    onChange={(e) => setFormState({ ...formState, cccd: e.target.value })}
                    placeholder="Nhập 12 số CCCD"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 font-mono focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-gray-600">Số ĐKKD / Mã số doanh nghiệp</label>
                  <input
                    type="text"
                    value={formState.registrationNumber}
                    onChange={(e) => setFormState({ ...formState, registrationNumber: e.target.value })}
                    placeholder="Mã số GPKD"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 font-mono focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-gray-600">Số lượng lao động làm việc</label>
                  <input
                    type="number"
                    min="1"
                    value={formState.employeesCount}
                    onChange={(e) => setFormState({ ...formState, employeesCount: Number(e.target.value) })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 font-bold focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-gray-600">Số điện thoại liên lạc</label>
                  <input
                    type="text"
                    value={formState.phoneNumber}
                    onChange={(e) => setFormState({ ...formState, phoneNumber: e.target.value })}
                    placeholder="Số liên lạc khẩn cấp"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-gray-600">Kiểm duyệt an toàn PCCC gần nhất</label>
                  <input
                    type="date"
                    value={formState.safetyInspectionDate}
                    onChange={(e) => setFormState({ ...formState, safetyInspectionDate: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 font-bold"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-gray-600">Địa chỉ hoạt động tại khu phố *</label>
                <input
                  type="text"
                  required
                  value={formState.address}
                  onChange={(e) => setFormState({ ...formState, address: e.target.value })}
                  placeholder="Số nhà, hẻm, tên đường..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-gray-600">Ghi chú lưu trữ đặc biệt</label>
                <textarea
                  value={formState.notes}
                  onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                  placeholder="Ghi nhận về phòng chống vệ sinh thực phẩm, an toàn lao động, tạng trữ gas, v.v."
                  rows={2}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-gray-100 no-print">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 cursor-pointer transition font-bold"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 cursor-pointer font-bold transition flex items-center gap-1 shadow-sm"
                >
                  {modalMode === "add" ? "Tạo ghi nhận" : "Cập nhật đóng"}
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
                className="bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-emerald-800 cursor-pointer transition select-none animate-none"
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
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2 rounded-xl cursor-pointer transition select-none animate-none"
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

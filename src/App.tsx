import React, { useState, useEffect, useMemo, useRef } from 'react';
import { formatDateTime } from './utils/dateUtils';
import {
  Tab,
  Resident,
  DocumentHistory,
  Business,
  Organization,
  OrgCategory,
  PolicyBeneficiary,
  Meeting,
  Plan,
  OfficialDocument,
  UserAccount,
  AuditLog
} from './types';
import LoginScreen from './components/LoginScreen';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import OverviewDashboard from './components/OverviewDashboard';
import PopulationManagement from './components/PopulationManagement';
import DocumentComposer from './components/DocumentComposer';
import AIChatDrawer from './components/AIChatDrawer';

// High-fidelity active components
import BusinessManagement from './components/BusinessManagement';
import MeetingManagement from './components/MeetingManagement';
import PlanManagement from './components/PlanManagement';
import OfficialArchive from './components/OfficialArchive';
import GISManagement from './components/GISManagement';
import PermissionLogger from './components/PermissionLogger';
import PolicyManagement from './components/PolicyManagement';



export default function App() {
  // Force click-once clean slate migration for existing browser cache sessions
  if (typeof window !== 'undefined' && !localStorage.getItem('kp_reset_clean_slate_v4')) {
    const keysToClean = [
      'kp_residents',
      'kp_business_establishments',
      'kp_meetings',
      'kp_plans',
      'kp_official_docs',
      'kp_audit_logs',
      'kp_households',
      'kp_temporary_households',
      'kp_deleted_records'
    ];
    keysToClean.forEach(key => localStorage.removeItem(key));
    localStorage.setItem('kp_reset_clean_slate_v4', 'true');
  }

  const [currentTab, setCurrentTab] = useState<Tab>(() => {
    const saved = localStorage.getItem('kp_current_tab');
    if (saved && saved !== 'login') {
      return saved as Tab;
    }
    return 'login';
  });
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    return localStorage.getItem('kp_user') || null;
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      const isMobileOrTablet = window.innerWidth < 1024 || 
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobileOrTablet) {
        return 'card';
      }
    }
    const saved = localStorage.getItem('kp_view_mode');
    if (saved === 'card' || saved === 'list') return saved;
    return 'list';
  });
  const [isQuickAiOpen, setIsQuickAiOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [focusedResidentId, setFocusedResidentId] = useState<string | null>(null);
  const [populationSubfilter, setPopulationSubfilter] = useState<string>(() => {
    return localStorage.getItem('kp_population_subfilter') || 'nhan_khau';
  });
  const [policySubfilter, setPolicySubfilter] = useState<string>(() => {
    return localStorage.getItem('kp_policy_subfilter') || 'dang_vien';
  });
  const [activePolicyFolder, setActivePolicyFolder] = useState<string>(() => {
    return localStorage.getItem('kp_policy_active_folder') || 'chi_bo';
  });
  const [inboxSubfilter, setInboxSubfilter] = useState<'Tất cả' | 'Đảng' | 'Chính quyền' | 'Mặt trận' | 'Đoàn thể'>(() => {
    return (localStorage.getItem('kp_inbox_subfilter') as any) || 'Tất cả';
  });
  const [outboxSubfilter, setOutboxSubfilter] = useState<'Tất cả' | 'Đảng' | 'Chính quyền' | 'Mặt trận' | 'Đoàn thể'>(() => {
    return (localStorage.getItem('kp_outbox_subfilter') as any) || 'Tất cả';
  });
  const [permissionsActiveTab, setPermissionsActiveTab] = useState<'accounts' | 'rights' | 'audit' | 'backup' | 'apikey'>(() => {
    return (localStorage.getItem('kp_permissions_active_tab') as any) || 'accounts';
  });

  // ----------------- Core Database States -----------------
  // 1. Residents
  const [residents, setResidents] = useState<Resident[]>(() => {
    const saved = localStorage.getItem('kp_residents');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Auto-purge old mock test data if present to prevent polluting the database
          if (parsed.some((r: any) => r && r.name && r.name.startsWith('Cư Dân Số'))) {
            console.log('Purging mock residents from localStorage...');
            localStorage.removeItem('kp_residents');
            localStorage.removeItem('kp_households');
            localStorage.removeItem('kp_temporary_households');
            return [];
          }
          let residentsMigrated = false;
          const updatedResidents = parsed.map((res: any) => {
            let updatedRes = { ...res };
            let rowMigrated = false;

            // Auto-heal missing householdId:
            if (!updatedRes.householdId) {
              let hhList: any[] = [];
              try {
                const hhSaved = localStorage.getItem('kp_households');
                const thhSaved = localStorage.getItem('kp_temporary_households');
                if (hhSaved) hhList = hhList.concat(JSON.parse(hhSaved));
                if (thhSaved) hhList = hhList.concat(JSON.parse(thhSaved));
              } catch (_) {}
              
              const cleanAddr = (addr: string) => addr ? addr.toLowerCase().replace(/\s+/g, '').trim() : '';
              const matchedH = hhList.find(h => h && cleanAddr(h.address) === cleanAddr(updatedRes.address));
              if (matchedH) {
                updatedRes.householdId = matchedH.id;
              } else {
                updatedRes.householdId = (updatedRes.status === 'Tạm trú' ? 'htt_' : 'h_') + 'healed_' + (updatedRes.idCard || updatedRes.id);
              }
              rowMigrated = true;
            }

            if (updatedRes.classifications) {
              let updatedClasses = [...updatedRes.classifications];
              let classMigrated = false;
              if (updatedClasses.includes('to_trung_pho_pho')) {
                updatedClasses = updatedClasses.filter(c => c !== 'to_trung_pho_pho');
                if (!updatedClasses.includes('antt_co_so')) {
                  updatedClasses.push('antt_co_so');
                }
                classMigrated = true;
              }
              if (updatedClasses.includes('to_trung_pho_truong')) {
                updatedClasses = updatedClasses.filter(c => c !== 'to_trung_pho_truong');
                if (!updatedClasses.includes('khu_doi')) {
                  updatedClasses.push('khu_doi');
                }
                classMigrated = true;
              }
              if (classMigrated) {
                updatedRes.classifications = updatedClasses;
                rowMigrated = true;
              }
            }

            if (rowMigrated) {
              residentsMigrated = true;
            }
            return updatedRes;
          });
          if (residentsMigrated) {
            localStorage.setItem('kp_residents', JSON.stringify(updatedResidents));
            return updatedResidents;
          }
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse kp_residents', e);
      }
    }
    const defaultResidentsList: any[] = [];
    const unusedLegacyList = [
      {
        id: '101',
        name: 'Nguyễn Văn Hùng',
        dob: '15/08/1985',
        gender: 'Nam',
        idCard: '079085012345',
        address: '123/45 An Phú, Phường An Phú, Thành Phố Hồ Chí Minh',
        neighborhoodGroup: 'Tổ dân phố 1',
        status: 'Thường trú',
        phone: '0908111222',
        occupation: 'Kinh doanh tự do',
        note: 'Ủy viên Tổ tự quản bảo vệ tổ công sản',
        classifications: ['dang_vien_213', 'antt_co_so', 'khuyen_hoc'],
        giftHistory: { '2026-05': true }
      },
      {
        id: '102',
        name: 'Lê Thị Mai',
        dob: '23/11/1992',
        gender: 'Nữ',
        idCard: '079192004567',
        address: '45/2 Trần Não, Phường An Phú, Thành Phố Hồ Chí Minh',
        neighborhoodGroup: 'Tổ dân phố 2',
        status: 'Tạm trú',
        phone: '0912444555',
        occupation: 'Giáo viên',
        classifications: ['phu_nu_bch', 'ho_can_ngheo', 'cong_tac_vien'],
        giftHistory: { '2026-05': true, '2026-06': true }
      },
      {
        id: '103',
        name: 'Trần Minh Quang',
        dob: '10/02/1978',
        gender: 'Nam',
        idCard: '079078009876',
        address: '22 Đường số 12, Phường An Phú, Thành Phố Hồ Chí Minh',
        neighborhoodGroup: 'Tổ dân phố 3',
        status: 'Thường trú',
        phone: '0977666111',
        occupation: 'Kỹ sư',
        classifications: ['dang_vien', 'khu_doi']
      },
      {
        id: '104',
        name: 'Phạm Thanh Thảo',
        dob: '05/09/2001',
        gender: 'Nữ',
        idCard: '079201004321',
        address: '88/14 Lương Định Của, Phường An Phú, Thành Phố Hồ Chí Minh',
        neighborhoodGroup: 'Tổ dân phố 5',
        status: 'Tạm trú',
        classifications: ['thanh_nien', 'thanh_nien_bch', 'tre_em'],
        giftHistory: { '2026-05': true }
      },
      {
        id: '105',
        name: 'Đỗ Hoàng Nam',
        dob: '28/06/1965',
        gender: 'Nam',
        idCard: '079065007788',
        address: '102 Song Hành, Phường An Phú, Thành Phố Hồ Chí Minh',
        neighborhoodGroup: 'Tổ dân phố 1',
        status: 'Tạm vắng',
        classifications: ['cuu_chien_binh', 'ban_dieu_hanh', 'nguoi_cao_tuoi']
      },
      {
        id: '106',
        name: 'Nguyễn Văn An',
        dob: '12/03/1960',
        gender: 'Nam',
        idCard: '079060001234',
        address: '12 Đường số 3, Phường An Phú, Thành Phố Hồ Chí Minh',
        neighborhoodGroup: 'Tổ dân phố 1',
        status: 'Thường trú',
        phone: '0903999888',
        occupation: 'Hưu trí',
        classifications: ['dang_vien', 'ban_dieu_hanh', 'nguoi_cao_tuoi']
      },
      {
        id: '107',
        name: 'Trần Thị Thủy',
        dob: '10/05/1972',
        gender: 'Nữ',
        idCard: '079072005678',
        address: '56A Trần Não, Phường An Phú, Thành Phố Hồ Chí Minh',
        neighborhoodGroup: 'Tổ dân phố 2',
        status: 'Thường trú',
        phone: '0903555444',
        occupation: 'Nội trợ',
        classifications: ['ban_cong_tac', 'ban_dieu_hanh', 'phu_nu']
      },
      {
        id: '108',
        name: 'Lê Văn Bình',
        dob: '05/09/1953',
        gender: 'Nam',
        idCard: '079053001122',
        address: '77 Lương Định Của, Phường An Phú, Thành Phố Hồ Chí Minh',
        neighborhoodGroup: 'Tổ dân phố 3',
        status: 'Thường trú',
        phone: '0988666333',
        occupation: 'Hưu trí',
        classifications: ['cuu_chien_binh_bch', 'doi_tuong_chinh_sach', 'nguoi_cao_tuoi']
      },
      {
        id: '109',
        name: 'Hoàng Thị Trúc',
        dob: '12/08/1975',
        gender: 'Nữ',
        idCard: '079075003344',
        address: '12/4 Đường số 5, Phường An Phú, Thành Phố Hồ Chí Minh',
        neighborhoodGroup: 'Tổ dân phố 4',
        status: 'Thường trú',
        phone: '0912333777',
        occupation: 'Nhân viên văn phòng',
        classifications: ['phu_nu', 'ban_cong_tac']
      },
      {
        id: '110',
        name: 'Trịnh Văn Kha',
        dob: '14/07/1947',
        gender: 'Nam',
        idCard: '079047000889',
        address: '88/12 Lương Định Của, Phường An Phú, Thành Phố Hồ Chí Minh',
        neighborhoodGroup: 'Tổ dân phố 5',
        status: 'Thường trú',
        phone: '0977111222',
        occupation: 'Không có',
        classifications: ['nguoi_cao_tuoi', 'cao_tuoi_neo_don', 'bao_tro_xa_hoi'],
        giftHistory: { '2026-05': false, '2026-06': false }
      },
      {
        id: '111',
        name: 'Nguyễn Quốc Huy',
        dob: '14/10/2014',
        gender: 'Nam',
        idCard: '079214008811',
        address: '34 Song Hành, Phường An Phú, Thành Phố Hồ Chí Minh',
        neighborhoodGroup: 'Tổ dân phố 1',
        status: 'Thường trú',
        occupation: 'Học sinh',
        classifications: ['tre_em'],
        giftHistory: { '2026-05': true }
      },
      {
        id: '112',
        name: 'Bà mẹ VNAH Nguyễn Thị Đào',
        dob: '20/09/1932',
        gender: 'Nữ',
        idCard: '079032009876',
        address: '100 Trần Não, Phường An Phú, Thành Phố Hồ Chí Minh',
        neighborhoodGroup: 'Tổ dân phố 2',
        status: 'Thường trú',
        phone: '0903333444',
        occupation: 'Hưu trí',
        classifications: ['doi_tuong_chinh_sach', 'nguoi_cao_tuoi', 'bao_tro_xa_hoi'],
        giftHistory: { '2026-05': true, '2026-06': true }
      },
      {
        id: '113',
        name: 'Đặng Văn Thành',
        dob: '10/05/1945',
        gender: 'Nam',
        idCard: '079045009988',
        address: '44 Đường số 2, Phường An Phú, Thành Phố Hồ Chí Minh',
        neighborhoodGroup: 'Tổ dân phố 3',
        status: 'Thường trú',
        occupation: 'Hưu trí',
        classifications: ['khuyet_tat', 'bao_tro_xa_hoi', 'nguoi_cao_tuoi'],
        giftHistory: { '2026-05': true }
      },
      {
        id: '114',
        name: 'Trần Thị Minh',
        dob: '01/12/2012',
        gender: 'Nữ',
        idCard: '079212004455',
        address: '5 Lương Định Của, Phường An Phú, Thành Phố Hồ Chí Minh',
        neighborhoodGroup: 'Tổ dân phố 4',
        status: 'Thường trú',
        occupation: 'Học sinh',
        classifications: ['tre_em']
      },
      {
        id: '115',
        name: 'Lê Trung Thành',
        dob: '18/06/1967',
        gender: 'Nam',
        idCard: '079067001212',
        address: '15/2 Song Hành, Phường An Phú, Thành Phố Hồ Chí Minh',
        neighborhoodGroup: 'Tổ dân phố 1',
        status: 'Thường trú',
        phone: '0903112233',
        occupation: 'Kinh doanh',
        classifications: ['dang_vien', 'chu_thap_do']
      }
    ];
    localStorage.setItem('kp_residents', JSON.stringify(defaultResidentsList));
    return defaultResidentsList;
  });

  // 2. Businesses
  const [businesses, setBusinesses] = useState<Business[]>(() => {
    const saved = localStorage.getItem('kp_business_establishments');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse businesses', e);
      }
    }
    const defaultBusinessesList: any[] = [];
    const unusedLegacyBusinesses = [
      { id: 'b1', name: 'Tạp hóa cô Lan An Phú', ownerName: 'Lê Thị Mai Lan', field: 'Tạp hóa', address: '45/2 Trần Não, Tổ 2', phone: '0908123456' },
      { id: 'b2', name: 'Ẩm thực nướng Ngói Đêm', ownerName: 'Phạm Huỳnh Đức', field: 'Ẩm thực', address: '12 Đường số 12, Tổ 3', phone: '0912444555' },
      { id: 'b3', name: 'Thời trang Trẻ Em Bibi', ownerName: 'Nguyễn Thị Hải', field: 'Thời trang', address: '88 Lương Định Của, Tổ 5', phone: '0977666111' },
      { id: 'b4', name: 'Gia công Cơ khí Thành Công', ownerName: 'Vũ Văn Hậu', field: 'Sản xuất', address: '102 Song Hành, Tổ 1', phone: '0988555999' }
    ];
    localStorage.setItem('kp_business_establishments', JSON.stringify(defaultBusinessesList));
    return defaultBusinessesList;
  });

  // 3. Dynamic Organizations Categories (organization_categories table)
  const [orgCategories, setOrgCategories] = useState<OrgCategory[]>(() => {
    const version = localStorage.getItem('kp_org_v2_reset');
    if (!version) {
      localStorage.removeItem('kp_org_categories');
      localStorage.removeItem('kp_organizations_dynamic');
      localStorage.setItem('kp_org_v2_reset', 'true');
    }

    const saved = localStorage.getItem('kp_org_categories');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'cat_1', code: 'dang', name: 'Hệ thống Tổ chức Đảng', icon: 'Award', color: '#dc2626', sort_order: 1, is_active: true, created_at: new Date().toISOString() },
      { id: 'cat_2', code: 'chinh_quyen', name: 'Chính quyền', icon: 'Shield', color: '#2563eb', sort_order: 2, is_active: true, created_at: new Date().toISOString() },
      { id: 'cat_3', code: 'mat_tran', name: 'Mặt trận', icon: 'Users', color: '#ea580c', sort_order: 3, is_active: true, created_at: new Date().toISOString() },
      { id: 'cat_4', code: 'cuu_chien_binh', name: 'Hội Cựu chiến binh', icon: 'Award', color: '#16a34a', sort_order: 4, is_active: true, created_at: new Date().toISOString() },
      { id: 'cat_5', code: 'phu_nu', name: 'Hội Phụ nữ', icon: 'Heart', color: '#db2777', sort_order: 5, is_active: true, created_at: new Date().toISOString() },
      { id: 'cat_6', code: 'thanh_nien', name: 'Đoàn Thanh niên', icon: 'TrendingUp', color: '#0284c7', sort_order: 6, is_active: true, created_at: new Date().toISOString() },
      { id: 'cat_7', code: 'chu_thap_do', name: 'Chữ thập đỏ', icon: 'Heart', color: '#e11d48', sort_order: 7, is_active: true, created_at: new Date().toISOString() },
      { id: 'cat_8', code: 'nguoi_cao_tuoi', name: 'Người cao tuổi', icon: 'Users', color: '#7c3aed', sort_order: 8, is_active: true, created_at: new Date().toISOString() },
      { id: 'cat_9', code: 'khuyen_hoc', name: 'Khuyến học', icon: 'BookOpen', color: '#0d9488', sort_order: 9, is_active: true, created_at: new Date().toISOString() },
      { id: 'cat_10', code: 'chinh_sach_xa_hoi', name: 'Chính sách xã hội', icon: 'Heart', color: '#0284c7', sort_order: 10, is_active: true, created_at: new Date().toISOString() },
    ];
  });

  // 3b. Dynamic Organizations (organizations table)
  const [organizations, setOrganizations] = useState<Organization[]>(() => {
    const saved = localStorage.getItem('kp_organizations_dynamic');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          let migrated = false;
          // Filter out legacy "Chi bộ cơ sở" (chi_bo) and duplicate organization keys completely (to_truong, to_pho, chuc_danh_khac)
          const filtered = parsed.filter((org: any) => !['chi_bo', 'to_truong', 'to_pho', 'chuc_danh_khac'].includes(org.code));
          if (filtered.length !== parsed.length) {
            migrated = true;
          }
          
          // Deduplicate item entries by key (org.code || org.id)
          const seen = new Set<string>();
          const unique: any[] = [];
          filtered.forEach((org: any) => {
            const key = org.code || org.id;
            if (key && !seen.has(key)) {
              seen.add(key);
              unique.push(org);
            } else {
              migrated = true;
            }
          });

          let updated = unique.map((org: any) => {
            if (org.category_id === 'cat_2') {
              if (org.code === 'to_trung_pho_truong') {
                org.code = 'khu_doi';
                org.name = 'Khu Đội';
                org.description = 'Lực lượng Khu Đội quân sự địa phương';
                migrated = true;
              }
              if (org.code === 'to_trung_pho_pho') {
                org.code = 'antt_co_so';
                org.name = 'ANTT cơ Sở';
                org.description = 'Lực lượng bảo vệ an ninh trật tự cơ sở';
                migrated = true;
              }
              if (org.code === 'ban_dieu_hanh' && org.name !== 'Bạn Điều Hành') {
                org.name = 'Bạn Điều Hành';
                migrated = true;
              }
              if (org.code === 'cong_tac_vien' && org.name !== 'Cộng Tác Viên') {
                org.name = 'Cộng Tác Viên';
                migrated = true;
              }
            }
            // Ensure proper names for requested Chi Bộ items
            if (org.code === 'dang_vien' && org.name !== 'DS đảng viên') {
              org.name = 'DS đảng viên';
              migrated = true;
            }
            if (org.code === 'dang_vien_213' && org.name !== 'Đảng Viên 213') {
              org.name = 'Đảng Viên 213';
              migrated = true;
            }
            // Ensure proper names for requested Đoàn Thể items
            if (org.code === 'ban_cong_tac' && org.name !== 'Ban CTMT') {
              org.name = 'Ban CTMT';
              migrated = true;
            }
            if (org.code === 'phu_nu' && org.name !== 'Phụ nữ') {
              org.name = 'Phụ nữ';
              migrated = true;
            }
            if (org.code === 'thanh_nien' && org.name !== 'Đoàn Thanh Niên') {
              org.name = 'Đoàn Thanh Niên';
              migrated = true;
            }
            if (org.code === 'cuu_chien_binh' && org.name !== 'Cựu Chiến Binh') {
              org.name = 'Cựu Chiến Binh';
              migrated = true;
            }
            if (org.code === 'chu_thap_do' && org.name !== 'Chữ Thập Đỏ') {
              org.name = 'Chữ Thập Đỏ';
              migrated = true;
            }
            if (org.code === 'khuyet_tat') {
              org.code = 'nguoi_khuyet_tat';
              org.name = 'Người khuyết tật';
              migrated = true;
            }
            if (org.code === 'cao_tuoi_neo_don') {
              org.code = 'nguoi_cao_tuoi_cs';
              org.name = 'Người cao tuổi';
              migrated = true;
            }
            return org;
          });

          // Ensure all 4 requested Chi Bộ subgroups exist
          const requiredChiBo = [
            { id: 'o1', code: 'dang_vien', name: 'DS đảng viên', desc: 'Đảng viên chính thức sinh hoạt thường trú tại địa phương', icon: 'User', leader: 'Nguyễn Văn An', members: 4, decisionField: 'QĐ-12/ĐU', dateField: '15/01/2025', termField: '2025 - 2027' },
            { id: 'o2', code: 'dang_vien_213', name: 'Đảng Viên 213', desc: 'Đảng viên công tác giữ mối liên hệ địa phương', icon: 'Users', leader: 'Trần Minh Quang', members: 1, decisionField: 'QĐ-13/ĐU', dateField: '20/01/2025', termField: '2025 - 2027' },
            { id: 'o_dang_vien_du_bi', code: 'dang_vien_du_bi', name: 'Đảng Viên Dự Bị', desc: 'Đảng viên mới kết nạp trong thời gian dự bị', icon: 'Award', leader: 'Chưa cập nhật', members: 0, decisionField: 'Chưa ban hành', dateField: '-', termField: '2025 - 2027' },
            { id: 'o_cam_tinh_dang', code: 'cam_tinh_dang', name: 'DS Cảm Tình Đảng', desc: 'Quần chúng ưu tú tham gia lớp nhận thức về Đảng', icon: 'Award', leader: 'Chưa cập nhật', members: 0, decisionField: 'Chưa ban hành', dateField: '-', termField: 'Mở rộng' }
          ];

          requiredChiBo.forEach(req => {
            const hasIt = updated.some((org: any) => org.code === req.code);
            if (!hasIt) {
              updated.push({
                id: req.id,
                category_id: 'cat_1',
                code: req.code,
                name: req.name,
                description: req.desc,
                icon: req.icon,
                color: '#dc2626',
                sort_order: updated.filter((o: any) => o.category_id === 'cat_1').length + 1,
                is_active: true,
                leaderName: req.leader,
                memberCount: req.members,
                decisionNumber: req.decisionField,
                appointmentDate: req.dateField,
                term: req.termField,
                created_at: new Date().toISOString()
              });
              migrated = true;
            }
          });

          // Ensure all 9 requested Chính Sách subgroups exist
          const requiredChinhSach = [
            { code: 'nguoi_co_cong', name: 'Người có công', desc: 'Diện người có công với cách mạng, gia đình chính sách' },
            { code: 'gia_dinh_liet_si', name: 'Gia đình liệt sĩ', desc: 'Thân nhân liệt sĩ và gia đình có công' },
            { code: 'ho_ngheo', name: 'Hộ nghèo', desc: 'Hộ nghèo cần nhận trợ cấp hỗ trợ khó khăn' },
            { code: 'ho_can_ngheo', name: 'Hộ cận nghèo', desc: 'Hộ cận nghèo được bảo trợ, hỗ trợ định kỳ' },
            { code: 'nguoi_cao_tuoi_cs', name: 'Người cao tuổi', desc: 'Người cao tuổi diện hưởng chính sách' },
            { code: 'nguoi_khuyet_tat', name: 'Người khuyết tật', desc: 'Đối tượng khuyết tật được bảo trợ xã hội' },
            { code: 'bao_tro_xa_hoi', name: 'Bảo trợ xã hội', desc: 'Cư dân hưởng trợ cấp bảo trợ xã hội hàng tháng' },
            { code: 'tre_em', name: 'Trẻ em', desc: 'Trẻ em hoàn cảnh khó khăn hoặc mồ côi diện chính sách' },
            { code: 'kho_khan', name: 'Khó Khăn', desc: 'Các trường hợp hoàn cảnh khó khăn đột xuất cần hỗ trợ' }
          ];

          requiredChinhSach.forEach(req => {
            const hasIt = updated.some((org: any) => org.code === req.code);
            if (!hasIt) {
              updated.push({
                id: 'o_' + req.code,
                category_id: 'cat_10',
                code: req.code,
                name: req.name,
                description: req.desc,
                icon: 'Heart',
                color: '#0284c7',
                sort_order: updated.filter((o: any) => o.category_id === 'cat_10').length + 1,
                is_active: true,
                leaderName: 'UBND Phường',
                memberCount: 0,
                decisionNumber: 'Chưa ban hành',
                appointmentDate: '-',
                term: '2025 - 2030',
                created_at: new Date().toISOString()
              });
              migrated = true;
            } else {
              const item = updated.find((org: any) => org.code === req.code);
              if (item && item.name !== req.name) {
                item.name = req.name;
                migrated = true;
              }
            }
          });

          // Ensure all 6 requested Chính quyền subgroups exist
          const requiredChinhQuyen = [
            { code: 'ban_dieu_hanh', name: 'Ban Điều Hành', desc: 'Thành viên Ban Điều hành Khu phố', leader: 'Nguyễn Văn An' },
            { code: 'antt_co_so', name: 'ANTT cơ Sở', desc: 'Lực lượng bảo vệ an ninh trật tự cơ sở', leader: 'Nguyễn Văn Hùng' },
            { code: 'khu_doi', name: 'Khu Đội', desc: 'Lực lượng Khu Đội quân sự địa phương', leader: 'Trần Minh Quang' },
            { code: 'to_cong_nghe_so', name: 'Tổ Công Nghệ Số', desc: 'Tổ công nghệ số cộng đồng hỗ trợ chuyển đổi số', leader: 'Chưa cập nhật' },
            { code: 'cong_tac_vien', name: 'Cộng Tác Viên', desc: 'Lực lượng cộng tác viên hỗ trợ các hoạt động khu phố', leader: 'Lê Thị Mai' },
            { code: 'dan_quan_tu_ve', name: 'Dân quân tự vệ', desc: 'Lực lượng dân quân tự vệ tuần tra giữ gìn bình yên', leader: 'Chưa cập nhật' }
          ];

          requiredChinhQuyen.forEach(req => {
            const hasIt = updated.some((org: any) => org.code === req.code);
            if (!hasIt) {
              updated.push({
                id: 'o_' + req.code,
                category_id: 'cat_2',
                code: req.code,
                name: req.name,
                description: req.desc,
                icon: req.code === 'ban_dieu_hanh' ? 'Shield' : 'Users',
                color: '#2563eb',
                sort_order: updated.filter((o: any) => o.category_id === 'cat_2').length + 1,
                is_active: true,
                leaderName: req.leader,
                memberCount: 0,
                decisionNumber: 'Chưa ban hành',
                appointmentDate: '-',
                term: '2025 - 2030',
                created_at: new Date().toISOString()
              });
              migrated = true;
            } else {
              const item = updated.find((org: any) => org.code === req.code);
              if (item && item.name !== req.name) {
                item.name = req.name;
                migrated = true;
              }
              if (item && item.code === 'ban_dieu_hanh' && item.name !== 'Ban Điều Hành') {
                item.name = 'Ban Điều Hành';
                migrated = true;
              }
            }
          });

          // Ensure all 5 requested Đoàn thể subgroups exist
          const requiredDoanThe = [
            { id: 'o8', category_id: 'cat_3', code: 'ban_cong_tac', name: 'Ban CTMT', desc: 'Thành viên Ban Công tác Mặt trận Khu phố', icon: 'Users', color: '#ea580c', leader: 'Trần Thị Thuỷ', decision: 'QĐ-45/MTTQ', date: '10/02/2025', term: '2025 - 2029' },
            { id: 'o11', category_id: 'cat_5', code: 'phu_nu', name: 'Phụ nữ', desc: 'Hội viên Hội Liên hiệp Phụ nữ khu phố', icon: 'Heart', color: '#db2777', leader: 'Hoàng Thị Trúc', decision: 'QĐ-14/PN', date: '15/05/2025', term: '2025 - 2030' },
            { id: 'o13', category_id: 'cat_6', code: 'thanh_nien', name: 'Đoàn Thanh Niên', desc: 'Đoàn viên thanh niên địa bàn cư trú', icon: 'TrendingUp', color: '#0284c7', leader: 'Phạm Thanh Thảo', decision: 'QĐ-15/ĐTN', date: '01/06/2025', term: '2025 - 2028' },
            { id: 'o9', category_id: 'cat_4', code: 'cuu_chien_binh', name: 'Cựu Chiến Binh', desc: 'Hội viên Hội Cựu chiến binh thường cư', icon: 'Award', color: '#16a34a', leader: 'Lê Văn Bình', decision: 'QĐ-88/CCB', date: '20/03/2025', term: '2025 - 2030' },
            { id: 'o15', category_id: 'cat_7', code: 'chu_thap_do', name: 'Chữ Thập Đỏ', desc: 'Hội viên Chữ thập đỏ làm thiện nguyện', icon: 'Heart', color: '#e11d48', leader: 'Lê Trung Thành', decision: 'QĐ-16/CTĐ', date: '12/06/2025', term: '2025 - 2030' },
            { id: 'o_to_hoa_giai', category_id: 'cat_3', code: 'to_hoa_giai', name: 'Tổ hòa giải', desc: 'Tổ hòa giải mâu thuẫn, gắn kết tình làng nghĩa xóm', icon: 'Users', color: '#ea580c', leader: 'Chưa cập nhật', decision: 'Chưa ban hành', date: '-', term: '2025 - 2030' },
            { id: 'o_to_dan_van', category_id: 'cat_3', code: 'to_dan_van', name: 'Tổ dân vận', desc: 'Tổ dân vận khéo vận động quần chúng nhân dân', icon: 'Users', color: '#ea580c', leader: 'Chưa cập nhật', decision: 'Chưa ban hành', date: '-', term: '2025 - 2030' }
          ];

          requiredDoanThe.forEach(req => {
            const hasIt = updated.some((org: any) => org.code === req.code);
            if (!hasIt) {
              updated.push({
                id: req.id,
                category_id: req.category_id,
                code: req.code,
                name: req.name,
                description: req.desc,
                icon: req.icon,
                color: req.color,
                sort_order: updated.filter((o: any) => o.category_id === req.category_id).length + 1,
                is_active: true,
                leaderName: req.leader,
                memberCount: 0,
                decisionNumber: req.decision,
                appointmentDate: req.date,
                term: req.term,
                created_at: new Date().toISOString()
              });
              migrated = true;
            } else {
              const item = updated.find((org: any) => org.code === req.code);
              let changed = false;
              if (item) {
                if (item.name !== req.name) {
                  item.name = req.name;
                  changed = true;
                }
                if (item.category_id !== req.category_id) {
                  item.category_id = req.category_id;
                  changed = true;
                }
                if (changed) migrated = true;
              }
            }
          });

          if (updated.some((org: any) => org.code === 'cb_cc_vc_2779' || org.id === 'o_cb_cc_vc_2779' || org.id === 'cb_cc_vc_2779')) {
            updated = updated.filter((org: any) => org.code !== 'cb_cc_vc_2779' && org.id !== 'o_cb_cc_vc_2779' && org.id !== 'cb_cc_vc_2779');
            migrated = true;
          }

          if (migrated) {
            localStorage.setItem('kp_organizations_dynamic', JSON.stringify(updated));
          }
          return updated;
        }
      } catch (e) {
        console.error('Failed to parse organizations dynamic', e);
      }
    }
    return [
      // Category 1: Đảng
      { id: 'o1', category_id: 'cat_1', code: 'dang_vien', name: 'DS đảng viên', description: 'Đảng viên chính thức sinh hoạt thường trú tại địa phương', icon: 'User', color: '#dc2626', sort_order: 1, is_active: true, leaderName: 'Nguyễn Văn An', memberCount: 4, decisionNumber: 'QĐ-12/ĐU', appointmentDate: '15/01/2025', term: '2025 - 2027', filename: 'quyet_dinh_chi_bo.pdf', created_at: new Date().toISOString() },
      { id: 'o2', category_id: 'cat_1', code: 'dang_vien_213', name: 'Đảng Viên 213', description: 'Đảng viên công tác giữ mối liên hệ địa phương', icon: 'Users', color: '#dc2626', sort_order: 2, is_active: true, leaderName: 'Trần Minh Quang', memberCount: 1, decisionNumber: 'QĐ-13/ĐU', appointmentDate: '20/01/2025', term: '2025 - 2027', created_at: new Date().toISOString() },
      { id: 'o_dang_vien_du_bi', category_id: 'cat_1', code: 'dang_vien_du_bi', name: 'Đảng Viên Dự Bị', description: 'Đảng viên đang trong thời kỳ dự bị thử thách', icon: 'Award', color: '#dc2626', sort_order: 3, is_active: true, leaderName: 'Chưa cập nhật', memberCount: 0, decisionNumber: 'Chưa ban hành', appointmentDate: '-', term: '2025 - 2027', created_at: new Date().toISOString() },
      { id: 'o_cam_tinh_dang', category_id: 'cat_1', code: 'cam_tinh_dang', name: 'DS Cảm Tình Đảng', description: 'Hồ sơ quần chúng ưu tú bồi dưỡng kết nạp vào Đảng', icon: 'Award', color: '#dc2626', sort_order: 4, is_active: true, leaderName: 'Chưa cập nhật', memberCount: 0, decisionNumber: 'Chưa ban hành', appointmentDate: '-', term: 'Mở rộng', created_at: new Date().toISOString() },

      // Category 2: Chính quyền
      { id: 'o4', category_id: 'cat_2', code: 'ban_dieu_hanh', name: 'Bạn Điều Hành', description: 'Thành viên Ban Điều hành Khu phố', icon: 'Shield', color: '#2563eb', sort_order: 1, is_active: true, leaderName: 'Nguyễn Văn An', memberCount: 3, decisionNumber: 'QĐ-88/UBND', appointmentDate: '01/01/2025', term: '2025 - 2030', created_at: new Date().toISOString() },
      { id: 'o6', category_id: 'cat_2', code: 'antt_co_so', name: 'ANTT cơ Sở', description: 'Lực lượng bảo vệ an ninh trật tự cơ sở', icon: 'Users', color: '#2563eb', sort_order: 2, is_active: true, leaderName: 'Nguyễn Văn Hùng', memberCount: 1, decisionNumber: 'QĐ-89/UBND', appointmentDate: '01/01/2025', term: '2025 - 2030', created_at: new Date().toISOString() },
      { id: 'o5', category_id: 'cat_2', code: 'khu_doi', name: 'Khu Đội', description: 'Lực lượng Khu Đội quân sự địa phương', icon: 'Users', color: '#2563eb', sort_order: 3, is_active: true, leaderName: 'Trần Minh Quang', memberCount: 1, decisionNumber: 'QĐ-89/UBND', appointmentDate: '01/01/2025', term: '2025 - 2030', created_at: new Date().toISOString() },
      { id: 'o_to_cong_nghe_so', category_id: 'cat_2', code: 'to_cong_nghe_so', name: 'Tổ Công Nghệ Số', description: 'Tổ công nghệ số cộng đồng hỗ trợ chuyển đổi số', icon: 'Users', color: '#2563eb', sort_order: 4, is_active: true, leaderName: 'Chưa cập nhật', memberCount: 0, decisionNumber: 'Chưa ban hành', appointmentDate: '-', term: '2025 - 2030', created_at: new Date().toISOString() },
      { id: 'o7', category_id: 'cat_2', code: 'cong_tac_vien', name: 'Cộng Tác Viên', description: 'Lực lượng cộng tác viên hỗ trợ các hoạt động khu phố', icon: 'User', color: '#2563eb', sort_order: 5, is_active: true, leaderName: 'Lê Thị Mai', memberCount: 1, decisionNumber: 'QĐ-90/UBND', appointmentDate: '01/01/2025', term: '2025 - 2030', created_at: new Date().toISOString() },

      // Category 3: Mặt trận
      { id: 'o8', category_id: 'cat_3', code: 'ban_cong_tac', name: 'Ban CTMT', description: 'Thành viên Ban Công tác Mặt trận Khu phố', icon: 'Users', color: '#ea580c', sort_order: 1, is_active: true, leaderName: 'Trần Thị Thuỷ', memberCount: 2, decisionNumber: 'QĐ-45/MTTQ', appointmentDate: '10/02/2025', term: '2025 - 2029', filename: 'quyet_dinh_mat_tran.pdf', created_at: new Date().toISOString() },

      // Category 4: Hội Cựu chiến binh
      { id: 'o9', category_id: 'cat_4', code: 'cuu_chien_binh', name: 'Cựu Chiến Binh', description: 'Hội viên Hội Cựu chiến binh thường cư', icon: 'Award', color: '#16a34a', sort_order: 1, is_active: true, leaderName: 'Lê Văn Bình', memberCount: 2, decisionNumber: 'QĐ-88/CCB', appointmentDate: '20/03/2025', term: '2025 - 2030', filename: 'quyet_dinh_ccb.pdf', created_at: new Date().toISOString() },
      { id: 'o10', category_id: 'cat_4', code: 'cuu_chien_binh_bch', name: 'Ban chấp hành', description: 'Ban chấp hành Chi hội Cựu chiến binh', icon: 'Award', color: '#16a34a', sort_order: 2, is_active: true, leaderName: 'Lê Văn Bình', memberCount: 1, decisionNumber: 'QĐ-88/CCB', appointmentDate: '20/03/2025', term: '2025 - 2030', filename: 'quyet_dinh_ccb.pdf', created_at: new Date().toISOString() },

      // Category 5: Hội Phụ nữ
      { id: 'o11', category_id: 'cat_5', code: 'phu_nu', name: 'Phụ nữ', description: 'Hội viên Hội Liên hiệp Phụ nữ', icon: 'Heart', color: '#db2777', sort_order: 1, is_active: true, leaderName: 'Hoàng Thị Trúc', memberCount: 3, decisionNumber: 'QĐ-14/PN', appointmentDate: '15/05/2025', term: '2025 - 2030', created_at: new Date().toISOString() },
      { id: 'o12', category_id: 'cat_5', code: 'phu_nu_bch', name: 'Ban chấp hành', description: 'Ban chấp hành Hội Phụ nữ khu phố', icon: 'Heart', color: '#db2777', sort_order: 2, is_active: true, leaderName: 'Lê Thị Mai', memberCount: 1, decisionNumber: 'QĐ-14/PN', appointmentDate: '15/05/2025', term: '2025 - 2030', created_at: new Date().toISOString() },

      // Category 6: Đoàn Thanh niên
      { id: 'o13', category_id: 'cat_6', code: 'thanh_nien', name: 'Đoàn Thanh Niên', description: 'Đoàn viên thanh niên địa bàn cư trú', icon: 'TrendingUp', color: '#0284c7', sort_order: 1, is_active: true, leaderName: 'Phạm Thanh Thảo', memberCount: 1, decisionNumber: 'QĐ-15/ĐTN', appointmentDate: '01/06/2025', term: '2025 - 2028', created_at: new Date().toISOString() },
      { id: 'o14', category_id: 'cat_6', code: 'thanh_nien_bch', name: 'Ban chấp hành', description: 'Ban Chấp hành Chi đoàn Thanh niên', icon: 'TrendingUp', color: '#0284c7', sort_order: 2, is_active: true, leaderName: 'Phạm Thanh Thảo', memberCount: 1, decisionNumber: 'QĐ-15/ĐTN', appointmentDate: '01/06/2025', term: '2025 - 2028', created_at: new Date().toISOString() },

      // Category 7: Chữ thập đỏ
      { id: 'o15', category_id: 'cat_7', code: 'chu_thap_do', name: 'Chữ Thập Đỏ', description: 'Hội viên Chữ thập đỏ làm thiện nguyện', icon: 'Heart', color: '#e11d48', sort_order: 1, is_active: true, leaderName: 'Lê Trung Thành', memberCount: 1, decisionNumber: 'QĐ-16/CTĐ', appointmentDate: '12/06/2025', term: '2025 - 2030', created_at: new Date().toISOString() },

      // Category 8: Người cao tuổi
      { id: 'o16', category_id: 'cat_8', code: 'nguoi_cao_tuoi', name: 'Hội viên', description: 'Hội viên Hội Người cao tuổi hưu trí', icon: 'Users', color: '#7c3aed', sort_order: 1, is_active: true, leaderName: 'Nguyễn Văn An', memberCount: 6, decisionNumber: 'QĐ-17/NCT', appointmentDate: '10/05/2025', term: '2025 - 2030', created_at: new Date().toISOString() },

      // Category 9: Khuyến học
      { id: 'o17', category_id: 'cat_9', code: 'khuyen_hoc', name: 'Hội viên', description: 'Hội viên Hội Khuyến học thúc đẩy hiếu học', icon: 'BookOpen', color: '#0d9488', sort_order: 1, is_active: true, leaderName: 'Nguyễn Văn Hùng', memberCount: 1, decisionNumber: 'QĐ-18/KH', appointmentDate: '01/03/2025', term: '2025 - 2030', created_at: new Date().toISOString() },

      // Category 10: Chính sách xã hội
      { id: 'o18', category_id: 'cat_10', code: 'ho_ngheo', name: 'Hộ nghèo', description: 'Hộ nghèo cần nhận trợ cấp khó khăn', icon: 'User', color: '#0284c7', sort_order: 1, is_active: true, leaderName: 'UBND Phường', memberCount: 0, decisionNumber: 'QĐ-20/CS', appointmentDate: '01/01/2025', term: '2025 - 2030', created_at: new Date().toISOString() },
      { id: 'o19', category_id: 'cat_10', code: 'ho_can_ngheo', name: 'Hộ cận nghèo', description: 'Hộ cận nghèo được bảo trợ hỗ trợ định kỳ', icon: 'User', color: '#0284c7', sort_order: 2, is_active: true, leaderName: 'UBND Phường', memberCount: 1, decisionNumber: 'QĐ-21/CS', appointmentDate: '01/01/2025', term: '2025 - 2030', created_at: new Date().toISOString() },
      { id: 'o_nguoi_khuyet_tat', category_id: 'cat_10', code: 'nguoi_khuyet_tat', name: 'Người khuyết tật', description: 'Đối tượng có khuyết tật thân thể hoặc trí óc chính sách', icon: 'User', color: '#0284c7', sort_order: 3, is_active: true, leaderName: 'UBND Phường', memberCount: 1, decisionNumber: 'QĐ-22/CS', appointmentDate: '01/01/2025', term: '2025 - 2030', created_at: new Date().toISOString() },
      { id: 'o_tre_em', category_id: 'cat_10', code: 'tre_em', name: 'Trẻ em', description: 'Trẻ em mồ côi hoặc hoàn cảnh đặc biệt chính sách', icon: 'Users', color: '#0284c7', sort_order: 4, is_active: true, leaderName: 'UBND Phường', memberCount: 3, decisionNumber: 'QĐ-23/CS', appointmentDate: '01/01/2025', term: '2025 - 2030', created_at: new Date().toISOString() },
      { id: 'o_nguoi_cao_tuoi_cs', category_id: 'cat_10', code: 'nguoi_cao_tuoi_cs', name: 'Người cao tuổi', description: 'Người cao tuổi thuộc diện bảo trợ & thụ hưởng chính sách', icon: 'Users', color: '#0284c7', sort_order: 5, is_active: true, leaderName: 'UBND Phường', memberCount: 1, decisionNumber: 'QĐ-24/CS', appointmentDate: '01/01/2025', term: '2025 - 2030', created_at: new Date().toISOString() },
      { id: 'o_bao_tro_xa_hoi', category_id: 'cat_10', code: 'bao_tro_xa_hoi', name: 'Bảo trợ xã hội', description: 'Dân cư hưởng bảo trợ xã hội hàng tháng khẩn cấp', icon: 'Shield', color: '#0284c7', sort_order: 6, is_active: true, leaderName: 'UBND Phường', memberCount: 3, decisionNumber: 'QĐ-25/CS', appointmentDate: '01/01/2025', term: '2025 - 2030', created_at: new Date().toISOString() },
      { id: 'o_nguoi_co_cong', category_id: 'cat_10', code: 'nguoi_co_cong', name: 'Người có công', description: 'Người có công với cách mạng, gia đình chính sách', icon: 'Award', color: '#0284c7', sort_order: 7, is_active: true, leaderName: 'UBND Phường', memberCount: 2, decisionNumber: 'QĐ-24/CS', appointmentDate: '01/01/2025', term: '2025 - 2030', created_at: new Date().toISOString() },
      { id: 'o_gia_dinh_liet_si', category_id: 'cat_10', code: 'gia_dinh_liet_si', name: 'Gia đình liệt sĩ', description: 'Các hộ gia đình liệt sĩ và có công cách mạng khu phố', icon: 'Award', color: '#0284c7', sort_order: 8, is_active: true, leaderName: 'UBND Phường', memberCount: 0, decisionNumber: 'QĐ-26/CS', appointmentDate: '01/01/2025', term: '2025 - 2030', created_at: new Date().toISOString() },
      { id: 'o_kho_khan', category_id: 'cat_10', code: 'kho_khan', name: 'Khó Khăn', description: 'Dân cư hoàn cảnh khó khăn đột xuất diện hỗ trợ xã hội', icon: 'Heart', color: '#0284c7', sort_order: 9, is_active: true, leaderName: 'UBND Phường', memberCount: 0, decisionNumber: 'QĐ-27/CS', appointmentDate: '01/01/2025', term: '2025 - 2030', created_at: new Date().toISOString() },
    ];
  });

  // Synced member counts dynamically from residents
  const syncedOrganizations = useMemo(() => {
    return organizations.map(org => {
      const orgCode = org.code || org.id;
      const count = residents.filter(r => (r.classifications || []).includes(orgCode)).length;
      return { ...org, memberCount: count };
    });
  }, [organizations, residents]);

  // 4. Policy Beneficiaries
  const [beneficiaries, setBeneficiaries] = useState<PolicyBeneficiary[]>([]);

  // 5. Meetings
  const [meetings, setMeetings] = useState<Meeting[]>(() => {
    const saved = localStorage.getItem('kp_meetings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse meetings', e);
      }
    }
    return [];
  });

  // 6. Plans
  const [plans, setPlans] = useState<Plan[]>(() => {
    const saved = localStorage.getItem('kp_plans');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse plans', e);
      }
    }
    return [];
  });

  // 7. Official Documents
  const [officialDocs, setOfficialDocs] = useState<OfficialDocument[]>(() => {
    const saved = localStorage.getItem('kp_official_docs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Failed to parse official documents', e);
      }
    }
    return [];
  });

  // 8. Users DB
  const [users, setUsers] = useState<UserAccount[]>(() => {
    let usersList: UserAccount[] = [];
    const saved = localStorage.getItem('kp_users');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) {
          usersList = parsed;
        }
      } catch (e) {
        console.error('Failed to parse users', e);
      }
    }
    if (usersList.length === 0) {
      usersList = [
        { id: 'u1', username: 'admin', fullName: 'Nguyễn Trung Huy', role: 'Super Admin', status: 'Hoạt động', password: '123', phone: '0908123456', position: 'Chủ tịch UBND', unit: 'UBND Phường An Phú', isDeleted: false },
        { id: 'u2', username: 'phuong_anphu', fullName: 'Phạm Ngọc Hà', role: 'Admin', status: 'Hoạt động', password: '123', phone: '0912345678', position: 'Phó Chủ tịch UBND', unit: 'UBND Phường An Phú', isDeleted: false },
        { id: 'u3', username: 'can_bo_kp3', fullName: 'Bùi Văn Nam', role: 'User', status: 'Hoạt động', password: '123', phone: '0934567890', position: 'Trưởng ban Công tác Mặt trận', unit: 'Khu phố 3', isDeleted: false },
        { id: 'u5', username: 'to_dan_phong', fullName: 'Trần Văn Mạnh', role: 'User', status: 'Hoạt động', password: '123', phone: '0978654321', position: 'Khu Đội Tổ dân phòng', unit: 'Lực lượng Dân phòng KP3', isDeleted: false }
      ];
    }

    // Auto-heal to guarantee bdh accounts exist inside local caches
    const hasBdh1 = usersList.some(u => u.username.toLowerCase() === 'bdhkhupho3.ap');
    const hasBdh2 = usersList.some(u => u.username.toLowerCase() === 'bdhkhupho3.ap@gmail.com');
    if (!hasBdh1) {
      usersList.push({
        id: 'u_bdh_1',
        username: 'bdhkhupho3.ap',
        fullName: 'Ban Điều Hành Khu Phố 3 (Mã)',
        role: 'Super Admin',
        status: 'Hoạt động',
        password: '123456',
        phone: '0974749660',
        position: 'Ban Điều Hành',
        unit: 'Khu Phố 3',
        isDeleted: false
      });
    }
    if (!hasBdh2) {
      usersList.push({
        id: 'u_bdh_2',
        username: 'bdhkhupho3.ap@gmail.com',
        fullName: 'Ban Điều Hành Khu Phố 3 (Email)',
        role: 'Super Admin',
        status: 'Hoạt động',
        password: '123456',
        phone: '0974749660',
        position: 'Ban Điều Hành',
        unit: 'Khu Phố 3',
        isDeleted: false
      });
    }
    return usersList;
  });

  // 9. Audit Logs DB
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('kp_audit_logs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
         if (parsed && parsed.length > 0) {
           // Auto-heal duplicate IDs from existing local storage to prevent React unique keys errors
           const seen = new Set<string>();
           return parsed.map((log: AuditLog, idx: number) => {
             let baseId = log.id || `al_auto_${idx}`;
             if (seen.has(baseId)) {
               baseId = `${baseId}_heal_${Math.random().toString(36).substr(2, 5)}`;
             }
             seen.add(baseId);
             return { ...log, id: baseId };
           });
         }
      } catch (e) {
        console.error('Failed to parse audit logs', e);
      }
    }
    return [];
  });

  const [pendingChangesCount, setPendingChangesCount] = useState(0);
  const isSyncing = useRef(false);

  // Core 2-Way server data synchronization handler
  const handleRunDualWaySync = async () => {
    const isConnEnabled = localStorage.getItem('kp_sync_client_connected') !== 'false';
    if (!isConnEnabled) {
      console.log('Sync disabled or in manual Offline Mode.');
      return;
    }

    if (isSyncing.current) return;
    isSyncing.current = true;

    try {
      const payload = {
        deletedRecords: JSON.parse(localStorage.getItem('kp_deleted_records') || '{}'),
        residents: JSON.parse(localStorage.getItem('kp_residents') || '[]'),
        businesses: JSON.parse(localStorage.getItem('kp_business_establishments') || '[]'),
        org_categories: JSON.parse(localStorage.getItem('kp_org_categories') || '[]'),
        organizations: JSON.parse(localStorage.getItem('kp_organizations_dynamic') || '[]'),
        meetings: JSON.parse(localStorage.getItem('kp_meetings') || '[]'),
        plans: JSON.parse(localStorage.getItem('kp_plans') || '[]'),
        official_docs: JSON.parse(localStorage.getItem('kp_official_docs') || '[]'),
        policy_changelogs: JSON.parse(localStorage.getItem('kp_policy_changelogs') || '[]'),
        users: JSON.parse(localStorage.getItem('kp_users') || '[]'),
        gis_points: JSON.parse(localStorage.getItem('kp_gis_points_v2') || '[]')
      };

      const response = await fetch('/api/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Yêu cầu đồng bộ thất bại');
      const resData = await response.json();

      if (resData.success && resData.data) {
        // Clear deleted storage upon successful synchronization acknowledgement
        localStorage.setItem('kp_deleted_records', JSON.stringify({}));

        const d = resData.data;

        if (d.residents) {
          setResidents(d.residents);
          localStorage.setItem('kp_residents', JSON.stringify(d.residents));
        }
        if (d.businesses) {
          setBusinesses(d.businesses);
          localStorage.setItem('kp_business_establishments', JSON.stringify(d.businesses));
        }
        if (d.org_categories) {
          setOrgCategories(d.org_categories);
          localStorage.setItem('kp_org_categories', JSON.stringify(d.org_categories));
        }
        if (d.organizations) {
          setOrganizations(d.organizations);
          localStorage.setItem('kp_organizations_dynamic', JSON.stringify(d.organizations));
        }
        if (d.meetings) {
          setMeetings(d.meetings);
          localStorage.setItem('kp_meetings', JSON.stringify(d.meetings));
        }
        if (d.plans) {
          setPlans(d.plans);
          localStorage.setItem('kp_plans', JSON.stringify(d.plans));
        }
        if (d.official_docs) {
          setOfficialDocs(d.official_docs);
          localStorage.setItem('kp_official_docs', JSON.stringify(d.official_docs));
        }
        if (d.users) {
          setUsers(d.users);
          localStorage.setItem('kp_users', JSON.stringify(d.users));
        }
        if (d.gis_points) {
          localStorage.setItem('kp_gis_points_v2', JSON.stringify(d.gis_points));
        }

        setPendingChangesCount(0);
      }
    } catch (err) {
      console.warn('Yếu cầu đồng bộ hai chiều tạm thời chưa phản hồi (hệ thống sẽ tự động thử lại):', err);
    } finally {
      isSyncing.current = false;
    }
  };

  // Sync with central back-end on startup and periodically (every 5 seconds) to ensure real-time consistency
  useEffect(() => {
    handleRunDualWaySync();
    const intervalId = setInterval(handleRunDualWaySync, 5000);
    return () => clearInterval(intervalId);
  }, []);

  // Sync edits to LocalStorage immediately and trigger background sync if connected
  useEffect(() => {
    localStorage.setItem('kp_users', JSON.stringify(users));
    const isConnEnabled = localStorage.getItem('kp_sync_client_connected') !== 'false';
    if (isConnEnabled) {
      fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(users)
      }).catch((e) => console.warn('Retrying user push in next loop'));
    } else {
      setPendingChangesCount(p => p + 1);
    }
  }, [users]);

  useEffect(() => {
    localStorage.setItem('kp_audit_logs', JSON.stringify(auditLogs));
    const isConnEnabled = localStorage.getItem('kp_sync_client_connected') !== 'false';
    if (isConnEnabled) {
      fetch('/api/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auditLogs)
      }).catch((e) => console.warn('Retrying audit push in next loop'));
    } else {
      setPendingChangesCount(p => p + 1);
    }
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem('kp_official_docs', JSON.stringify(officialDocs));
    setPendingChangesCount(p => p + 1);
  }, [officialDocs]);

  useEffect(() => {
    localStorage.setItem('kp_residents', JSON.stringify(residents));
    setPendingChangesCount(p => p + 1);
  }, [residents]);

  useEffect(() => {
    localStorage.setItem('kp_business_establishments', JSON.stringify(businesses));
    setPendingChangesCount(p => p + 1);
  }, [businesses]);

  useEffect(() => {
    localStorage.setItem('kp_plans', JSON.stringify(plans));
    setPendingChangesCount(p => p + 1);
  }, [plans]);

  useEffect(() => {
    localStorage.setItem('kp_meetings', JSON.stringify(meetings));
    setPendingChangesCount(p => p + 1);
  }, [meetings]);

  const [documentHistories, setDocumentHistories] = useState<DocumentHistory[]>([
    {
      id: 'd1',
      title: 'Họp an ninh trật tự Tổ dân phố 1',
      prompt: 'Soạn thông báo họp khu phố',
      type: 'announcement',
      time: '10 phút trước',
      content: {
        department: 'UỶ BAN NHÂN DÂN PHƯỜNG AN PHÚ',
        neighborhood: 'BAN QUẢN LÝ KHU PHỐ 3',
        docNumber: '42 /TB-KP3',
        dateText: 'An Phú, ngày 02 tháng 06 năm 2026',
        titleText: 'THÔNG BÁO HOÁ TẬP',
        subTitle: 'V/v Tổ chức họp khẩn bà con cư dân về công tác tuần tra đêm',
        recipients: 'Kính gửi toàn thể đại gia đình Tổ tự quản và bà con sinh sống khu phố.',
        bodyText: `Thực hiện chương trình làm sạch trật tự hành chính quý II, Ban chỉ huy khu phố gửi thông báo:

- Đề xuất thảo luận biểu quyết mức đóng góp lắp đặt 15 cảm biến camera mới.
- Bầu trưởng tổ dân phòng tự quản dân phố nhiệm kỳ mới.
- Triệu tập đội dân sự tuần tra hỗ trợ công an phường kiểm tra nhân hộ khẩu tạm cư trú.

Kính mời bà con có mặt lúc 19h30 ngày mai tại văn phòng nhà sinh hoạt chung.`,
        signerRole: 'TRƯỞNG KHU PHỐ',
        signerName: 'Nguyễn Văn An',
      },
    },
  ]);

  const currentUserObj = users.find(u => u.username === currentUser);
  const currentUserRole = currentUserObj?.role || (currentUser === 'admin' ? 'Super Admin' : 'User');
  const isSuperOrAdmin = currentUserRole === 'Super Admin' || currentUserRole === 'Admin';
  const hasDocumentAccess = currentUserRole === 'Super Admin' || currentUserRole === 'Admin' || currentUserRole === 'Super Mod';

  // Redirect non-admins if they try to access the permissions tab
  useEffect(() => {
    if (currentUser && currentTab === 'permissions' && !isSuperOrAdmin) {
      setCurrentTab('dashboard');
      localStorage.setItem('kp_current_tab', 'dashboard');
    }
  }, [currentTab, currentUser, isSuperOrAdmin]);

  // Redirect unauthorized users if they try to access document composer, inbox, or outbox
  useEffect(() => {
    if (currentUser && !hasDocumentAccess && ['document', 'inbox', 'outbox'].includes(currentTab)) {
      setCurrentTab('dashboard');
      localStorage.setItem('kp_current_tab', 'dashboard');
    }
  }, [currentTab, currentUser, hasDocumentAccess]);

  // Synchronize changes to policy subfolders from Sidebar custom events
  useEffect(() => {
    const handlePolicySubfilter = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail !== undefined) {
        setPolicySubfilter(customEvent.detail);
        localStorage.setItem('kp_policy_subfilter', customEvent.detail);
      }
    };
    window.addEventListener('kp_policy_subfilter_changed', handlePolicySubfilter);
    return () => window.removeEventListener('kp_policy_subfilter_changed', handlePolicySubfilter);
  }, []);

  // ----------------- Core CRUD State Dispatch Handlers -----------------
  // Population
  const handleAddResident = (newRes: Omit<Resident, 'id'>) => {
    setResidents((prev) => {
      const numericalIds = prev
        .map(r => parseInt(r.id, 10))
        .filter(n => !isNaN(n));
      const maxId = numericalIds.length > 0 ? Math.max(...numericalIds) : 100;
      const nextId = String(maxId + 1);
      const added: Resident = { id: nextId, ...newRes, updated_at: new Date().toISOString() };
      const next = [added, ...prev];
      localStorage.setItem('kp_residents', JSON.stringify(next));
      return next;
    });

    setAuditLogs(prev => [
      { id: 'al_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5), username: 'admin', action: `Khai sinh / Cư nhập cư dân mới: ${newRes.name}`, timestamp: formatDateTime(new Date()), ipAddress: '192.168.1.12' },
      ...prev
    ]);
  };

  const handleUpdateResident = (updated: Resident) => {
    const withTimestamp = { ...updated, updated_at: new Date().toISOString() };
    setResidents((prev) => {
      const next = prev.map((r) => (r.id === updated.id ? withTimestamp : r));
      localStorage.setItem('kp_residents', JSON.stringify(next));
      return next;
    });
  };

  const handleBulkSyncResidents = (added: Omit<Resident, 'id'>[], updated: Resident[]) => {
    setResidents((prev) => {
      const residentsMap = new Map<string, Resident>(prev.map(r => [r.id, r]));

      // 1. Process updates
      updated.forEach((up) => {
        residentsMap.set(up.id, {
          ...up,
          updated_at: new Date().toISOString()
        });
      });

      // 2. Process additions
      const numericalIds = Array.from(residentsMap.values())
        .map(r => parseInt(r.id, 10))
        .filter(n => !isNaN(n));
      let maxId = numericalIds.length > 0 ? Math.max(...numericalIds) : 100;

      added.forEach((add) => {
        maxId++;
        const nextId = String(maxId);
        residentsMap.set(nextId, {
          id: nextId,
          ...add,
          updated_at: new Date().toISOString()
        });
      });

      const next = Array.from(residentsMap.values());
      localStorage.setItem('kp_residents', JSON.stringify(next));
      return next;
    });

    setAuditLogs(prev => [
      {
        id: 'al_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        username: 'admin',
        action: `Nhập dữ liệu dân cư từ tệp: thêm mới ${added.length}, cập nhật ${updated.length} nhân khẩu`,
        timestamp: formatDateTime(new Date()),
        ipAddress: '192.168.1.12'
      },
      ...prev
    ]);

    // Force sync immediately
    setTimeout(handleRunDualWaySync, 100);
  };

  const registerDeletion = (table: string, id: string) => {
    try {
      const saved = localStorage.getItem('kp_deleted_records');
      const delObj = saved ? JSON.parse(saved) : {};
      if (!delObj[table]) delObj[table] = [];
      if (!delObj[table].includes(id)) {
        delObj[table].push(id);
      }
      localStorage.setItem('kp_deleted_records', JSON.stringify(delObj));
    } catch (e) {
      console.error('Failed to register deletion:', e);
    }
  };

  const handleDeleteResident = (id: string) => {
    const resToDelete = residents.find((r) => r.id === id);
    const residentName = resToDelete ? resToDelete.name : 'Không rõ';
    
    registerDeletion('residents', id);

    setResidents((prev) => {
      const next = prev.filter((r) => r.id !== id);
      localStorage.setItem('kp_residents', JSON.stringify(next));
      return next;
    });

    setAuditLogs(prev => [
      { 
        id: 'al_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5), 
        username: 'admin', 
        action: `Xóa hồ sơ đăng ký nhân khẩu: ${residentName} (Mã ID: ${id})`, 
        timestamp: formatDateTime(new Date()), 
        ipAddress: '192.168.1.12' 
      },
      ...prev
    ]);
  };

  const handleClearAllResidents = async () => {
    // 1. Temporarily disable client sync to prevent race conditions during the wipe request
    localStorage.setItem('kp_sync_client_connected', 'false');

    // 2. Clear client states and localStorage keys
    setResidents([]);
    localStorage.setItem('kp_residents', JSON.stringify([]));
    localStorage.setItem('kp_households', JSON.stringify([]));
    localStorage.setItem('kp_temporary_households', JSON.stringify([]));

    // Clear deleted_records for residents because we are clearing all residents
    try {
      const saved = localStorage.getItem('kp_deleted_records');
      const delObj = saved ? JSON.parse(saved) : {};
      delObj['residents'] = [];
      localStorage.setItem('kp_deleted_records', JSON.stringify(delObj));
    } catch (_) {}

    try {
      // 3. Send direct request to server to wipe out the database table
      const response = await fetch('/api/sync-all/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tables: ['residents'] })
      });
      if (response.ok) {
        console.log('Server residents database cleared successfully.');
      } else {
        console.error('Failed to notify server of database clear:', response.statusText);
      }
    } catch (e) {
      console.error('Failed to notify server of database clear:', e);
    } finally {
      // 4. Safely re-enable client sync
      localStorage.setItem('kp_sync_client_connected', 'true');
    }

    setAuditLogs(prev => [
      { 
        id: 'al_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5), 
        username: 'admin', 
        action: `Xóa sạch toàn bộ cơ sở dữ liệu nhân khẩu (Thử nghiệm hệ thống)`, 
        timestamp: formatDateTime(new Date()), 
        ipAddress: '192.168.1.12' 
      },
      ...prev
    ]);
  };

  // Businesses
  const handleAddBusiness = (b: Omit<Business, 'id'>) => {
    setBusinesses((prev) => {
      const numericalIds = prev
        .map(item => parseInt(item.id.replace('b_', ''), 10))
        .filter(n => !isNaN(n));
      const maxId = numericalIds.length > 0 ? Math.max(...numericalIds) : 0;
      const newId = 'b_' + (maxId + 1);
      const next = [{ id: newId, ...b, updated_at: new Date().toISOString() }, ...prev];
      localStorage.setItem('kp_business_establishments', JSON.stringify(next));
      return next;
    });
  };

  const handleUpdateBusiness = (b: Business) => {
    const withTimestamp = { ...b, updated_at: new Date().toISOString() };
    setBusinesses(prev => {
      const next = prev.map(item => item.id === b.id ? withTimestamp : item);
      localStorage.setItem('kp_business_establishments', JSON.stringify(next));
      return next;
    });
  };

  const handleDeleteBusiness = (id: string) => {
    registerDeletion('businesses', id);
    setBusinesses(prev => prev.filter(item => item.id !== id));
  };

  // Dynamic categories helpers
  const saveCategories = (cats: OrgCategory[]) => {
    setOrgCategories(cats);
    localStorage.setItem('kp_org_categories', JSON.stringify(cats));
  };

  const saveOrganizations = (orgs: Organization[]) => {
    setOrganizations(orgs);
    localStorage.setItem('kp_organizations_dynamic', JSON.stringify(orgs));
  };

  const [policyChangelogs, setPolicyChangelogs] = useState<{ id: string; user: string; action: string; time: string }[]>(() => {
    const saved = localStorage.getItem('kp_policy_changelogs');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'cl_1', user: currentUser || 'admin', action: 'Thiết lập cấu trúc chính trị ban đầu', time: formatDateTime(new Date()) }
    ];
  });

  const addPolicyChangelog = (action: string) => {
    const newLog = {
      id: 'cl_' + Date.now(),
      user: currentUser || 'admin',
      action,
      time: formatDateTime(new Date()),
    };
    const nextLogs = [newLog, ...policyChangelogs];
    setPolicyChangelogs(nextLogs);
    localStorage.setItem('kp_policy_changelogs', JSON.stringify(nextLogs));
  };

  // Organizations dynamic CRUD with persistence & changelogs mapping
  const handleAddOrg = (org: Omit<Organization, 'id'>) => {
    const newOrg: Organization = { id: 'o_' + Date.now(), ...org, created_at: new Date().toISOString() };
    const nextOrgs = [newOrg, ...organizations];
    saveOrganizations(nextOrgs);
    addPolicyChangelog(`Thêm đoàn thể/chính sách mới: "${org.name}"`);
  };

  const handleUpdateOrg = (org: Organization) => {
    const nextOrgs = organizations.map(item => item.id === org.id ? { ...org, updated_at: new Date().toISOString() } : item);
    saveOrganizations(nextOrgs);
    addPolicyChangelog(`Cập nhật thông tin đoàn thể/chính sách: "${org.name}"`);
  };

  const handleDeleteOrg = (id: string) => {
    registerDeletion('organizations', id);
    const target = organizations.find(o => o.id === id);
    if (target) {
      const nextOrgs = organizations.map(o => o.id === id ? { ...o, is_deleted: true } : o);
      saveOrganizations(nextOrgs);
      addPolicyChangelog(`Xóa mềm đoàn thể/chính sách: "${target.name}"`);
    } else {
      const nextOrgs = organizations.filter(item => item.id !== id);
      saveOrganizations(nextOrgs);
    }
  };

  // Policy beneficiaries
  const handleAddBeneficiary = (b: Omit<PolicyBeneficiary, 'id'>) => {
    setBeneficiaries((prev) => {
      const numericalIds = prev
        .map(item => parseInt(item.id.replace('pb_', ''), 10))
        .filter(n => !isNaN(n));
      const maxId = numericalIds.length > 0 ? Math.max(...numericalIds) : 0;
      const newId = 'pb_' + (maxId + 1);
      return [{ id: newId, ...b }, ...prev];
    });
  };

  const handleUpdateBeneficiary = (b: PolicyBeneficiary) => {
    setBeneficiaries(prev => prev.map(item => item.id === b.id ? b : item));
  };

  const handleDeleteBeneficiary = (id: string) => {
    setBeneficiaries(prev => prev.filter(item => item.id !== id));
  };

  // Meetings
  const handleAddMeeting = (m: Omit<Meeting, 'id'>) => {
    setMeetings((prev) => {
      const numericalIds = prev
        .map(item => parseInt(item.id.replace('m_', ''), 10))
        .filter(n => !isNaN(n));
      const maxId = numericalIds.length > 0 ? Math.max(...numericalIds) : 0;
      const newId = 'm_' + (maxId + 1);
      const next = [{ id: newId, ...m, updated_at: new Date().toISOString() }, ...prev];
      localStorage.setItem('kp_meetings', JSON.stringify(next));
      return next;
    });
  };

  const handleUpdateMeeting = (m: Meeting) => {
    const withTimestamp = { ...m, updated_at: new Date().toISOString() };
    setMeetings(prev => {
      const next = prev.map(item => item.id === m.id ? withTimestamp : item);
      localStorage.setItem('kp_meetings', JSON.stringify(next));
      return next;
    });
  };

  const handleDeleteMeeting = (id: string) => {
    registerDeletion('meetings', id);
    setMeetings(prev => prev.filter(item => item.id !== id));
  };

  // Plans
  const handleAddPlan = (p: Omit<Plan, 'id'>) => {
    setPlans((prev) => {
      const numericalIds = prev
        .map(item => parseInt(item.id.replace('p_', ''), 10))
        .filter(n => !isNaN(n));
      const maxId = numericalIds.length > 0 ? Math.max(...numericalIds) : 0;
      const newId = 'p_' + (maxId + 1);
      const next = [{ id: newId, ...p, updated_at: new Date().toISOString() }, ...prev];
      localStorage.setItem('kp_plans', JSON.stringify(next));
      return next;
    });
  };

  const handleUpdatePlan = (p: Plan) => {
    const withTimestamp = { ...p, updated_at: new Date().toISOString() };
    setPlans(prev => {
      const next = prev.map(item => item.id === p.id ? withTimestamp : item);
      localStorage.setItem('kp_plans', JSON.stringify(next));
      return next;
    });
  };

  const handleDeletePlan = (id: string) => {
    registerDeletion('plans', id);
    setPlans(prev => prev.filter(item => item.id !== id));
  };

  // Official Documents
  const handleAddDoc = (doc: Omit<OfficialDocument, 'id'>) => {
    setOfficialDocs((prev) => {
      const numericalIds = prev
        .map(item => parseInt(item.id.replace('doc_', ''), 10))
        .filter(n => !isNaN(n));
      const maxId = numericalIds.length > 0 ? Math.max(...numericalIds) : 0;
      const newId = 'doc_' + (maxId + 1);
      const next = [{ id: newId, ...doc, updated_at: new Date().toISOString() }, ...prev];
      localStorage.setItem('kp_official_docs', JSON.stringify(next));
      return next;
    });
  };

  const handleUpdateDoc = (doc: OfficialDocument) => {
    const withTimestamp = { ...doc, updated_at: new Date().toISOString() };
    setOfficialDocs(prev => {
      const next = prev.map(item => item.id === doc.id ? withTimestamp : item);
      localStorage.setItem('kp_official_docs', JSON.stringify(next));
      return next;
    });
  };

  const handleDeleteDoc = (id: string) => {
    registerDeletion('official_docs', id);
    setOfficialDocs(prev => prev.filter(item => item.id !== id));
  };

  // Security Users Roles
  const handleAddUser = (user: UserAccount) => {
    const withTimestamp = { ...user, updated_at: new Date().toISOString() };
    setUsers(prev => {
      const next = [withTimestamp, ...prev];
      localStorage.setItem('kp_users', JSON.stringify(next));
      return next;
    });
  };

  const handleUpdateUser = (user: UserAccount) => {
    const oldUser = users.find(u => u.id === user.id);
    if (oldUser && oldUser.username === currentUser && user.username !== currentUser) {
      setCurrentUser(user.username);
      localStorage.setItem('kp_user', user.username);
    }
    const withTimestamp = { ...user, updated_at: new Date().toISOString() };
    setUsers(prev => {
      const next = prev.map(item => item.id === user.id ? withTimestamp : item);
      localStorage.setItem('kp_users', JSON.stringify(next));
      return next;
    });
  };

  const handlePermanentDeleteUser = (userId: string) => {
    setUsers(prev => prev.filter(item => item.id !== userId));
  };

  const handleAddAuditLog = (log: Omit<AuditLog, 'id'>) => {
    const newLog: AuditLog = { id: 'al_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5), ...log };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const handlePermissionsActiveTabChange = (tab: 'accounts' | 'rights' | 'audit' | 'backup' | 'apikey') => {
    setPermissionsActiveTab(tab);
    localStorage.setItem('kp_permissions_active_tab', tab);
    if (currentTab !== 'permissions') {
      setCurrentTab('permissions');
      localStorage.setItem('kp_current_tab', 'permissions');
    }
  };

  const handleAddHistory = (newDoc: DocumentHistory) => {
    setDocumentHistories((prev) => [newDoc, ...prev]);
  };

  const handleLoginSubmit = (username: string) => {
    setCurrentUser(username);
    localStorage.setItem('kp_user', username);
    setCurrentTab('dashboard');
    localStorage.setItem('kp_current_tab', 'dashboard');
  };

  const handleSignout = () => {
    setCurrentUser(null);
    localStorage.removeItem('kp_user');
    setCurrentTab('login');
    localStorage.setItem('kp_current_tab', 'login');
  };

  // ----------------- Mapping Header Titles -----------------
  const getPageTitle = () => {
    switch (currentTab) {
      case 'dashboard': return 'Bảng điều khiển hệ thống';
      case 'population': return 'Quản lý Dân cư & Hộ khẩu';
      case 'document': return 'Trợ lý Soạn thảo Văn bản AI';
      case 'business': return 'Quản lý cơ sở kinh doanh';
      case 'policy': return 'Quản lý Đoàn thể & Chính sách';
      case 'meetings': return 'Lịch họp khu phố trực tuyến';
      case 'plans': return 'Kế hoạch công tác dân vận';
      case 'inbox': return 'Hộp thư văn bản đến';
      case 'outbox': return 'Danh sách văn bản đi';
      case 'address': return 'Giám sát địa chỉ số (GIS)';
      case 'permissions': return 'Nhật ký hệ thống & Phân quyền';
      default: return 'Hệ thống Quản lý hành chính';
    }
  };

  const getSearchPlaceholder = () => {
    switch (currentTab) {
      case 'population': return 'Tìm kiếm nhanh dân cư, số CCCD, địa chỉ cư trú...';
      case 'document': return 'Nhập tìm kiếm nhanh danh mục lịch sử soạn thảo...';
      case 'business': return 'Tìm cơ sở, chủ sở hữu, ngành nghề, địa chính...';
      case 'policy': return 'Đoàn hội, người có hoàn cảnh, thương binh...';
      default: return 'Tìm kiếm nhanh hệ thống...';
    }
  };

  if (currentTab === 'login') {
    return <LoginScreen users={users} onLogin={handleLoginSubmit} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex text-slate-800 antialiased overflow-x-hidden">
      
      {/* Sidebar container column */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          localStorage.setItem('kp_current_tab', tab);
          setSearchTerm(''); // Clear search on transitions
        }}
        subfilter={populationSubfilter}
        onSubfilterChange={(sub) => {
          setPopulationSubfilter(sub);
          localStorage.setItem('kp_population_subfilter', sub);
        }}
        inboxSubfilter={inboxSubfilter}
        onInboxSubfilterChange={(sub) => {
          setInboxSubfilter(sub);
          localStorage.setItem('kp_inbox_subfilter', sub);
        }}
        outboxSubfilter={outboxSubfilter}
        onOutboxSubfilterChange={(sub) => {
          setOutboxSubfilter(sub);
          localStorage.setItem('kp_outbox_subfilter', sub);
        }}
        permissionsActiveTab={permissionsActiveTab}
        onPermissionsActiveTabChange={handlePermissionsActiveTabChange}
        onLogout={handleSignout}
        onOpenQuickAI={() => setIsQuickAiOpen(true)}
        orgCategories={orgCategories}
        organizations={syncedOrganizations}
        userRole={currentUserRole}
        currentUserObj={currentUserObj}
        isMobileSidebarOpen={isMobileSidebarOpen}
        onCloseMobileSidebar={() => setIsMobileSidebarOpen(false)}
        activePolicyFolder={activePolicyFolder}
        onActivePolicyFolderChange={setActivePolicyFolder}
        policySubfilter={policySubfilter}
        onPolicySubfilterChange={setPolicySubfilter}
      />

      {/* Main workspace container wrapper */}
      <div className="flex-1 lg:pl-[280px] flex flex-col min-h-screen">
        
        {/* Topbar navigation panel */}
        <Topbar
          title={getPageTitle()}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onOpenQuickAI={() => setIsQuickAiOpen(true)}
          searchPlaceholder={getSearchPlaceholder()}
          onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          meetings={meetings}
          plans={plans}
          officialDocs={officialDocs}
          onTabChange={(tab, subFilter) => {
            setCurrentTab(tab);
            localStorage.setItem('kp_current_tab', tab);
            if (subFilter) {
              if (tab === 'population') {
                setPopulationSubfilter(subFilter);
                localStorage.setItem('kp_population_subfilter', subFilter);
              } else if (subFilter === 'inbox' || subFilter === 'outbox') {
                setInboxSubfilter(subFilter);
                localStorage.setItem('kp_inbox_subfilter', subFilter);
              }
            }
          }}
        />

        {/* Content workspace area */}
        <main className="flex-1 mt-16 p-3 sm:p-6 lg:p-8 overflow-y-auto">
          {currentTab === 'dashboard' && (
            <OverviewDashboard
              onTabChange={(tab, subFilter) => {
                setCurrentTab(tab);
                localStorage.setItem('kp_current_tab', tab);
                if (subFilter) {
                  if (tab === 'population') {
                    setPopulationSubfilter(subFilter);
                    localStorage.setItem('kp_population_subfilter', subFilter);
                  }
                }
              }}
              totalResidentsCount={residents.length}
              residents={residents}
              businesses={businesses}
              organizations={syncedOrganizations}
              searchTerm={searchTerm}
              meetings={meetings}
              plans={plans}
              officialDocs={officialDocs}
              userRole={currentUserRole}
            />
          )}

          {currentTab === 'population' && (
            <PopulationManagement
              residents={residents}
              onAddResident={handleAddResident}
              onUpdateResident={handleUpdateResident}
              onDeleteResident={handleDeleteResident}
              onClearAllResidents={handleClearAllResidents}
              onBulkSyncResidents={handleBulkSyncResidents}
              searchTerm={searchTerm}
              activeSubTab={populationSubfilter as any}
              onActiveSubTabChange={(sub) => {
                setPopulationSubfilter(sub);
                localStorage.setItem('kp_population_subfilter', sub);
              }}
              organizations={syncedOrganizations}
              orgCategories={orgCategories}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              currentUserRole={currentUserRole}
              focusedResidentId={focusedResidentId}
              onClearFocusedResident={() => setFocusedResidentId(null)}
              onNavigateToPolicyGroup={(groupCode) => {
                setCurrentTab('policy');
                setPolicySubfilter(groupCode);
                localStorage.setItem('kp_policy_subfilter', groupCode);
              }}
            />
          )}

          {currentTab === 'document' && (
            <DocumentComposer
              onAddHistory={handleAddHistory}
              documentHistories={documentHistories}
              userRole={currentUserRole}
            />
          )}

          {currentTab === 'business' && (
            <BusinessManagement
              businesses={businesses}
              onAddBusiness={handleAddBusiness}
              onUpdateBusiness={handleUpdateBusiness}
              onDeleteBusiness={handleDeleteBusiness}
              searchTerm={searchTerm}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              currentUserRole={currentUserRole}
            />
          )}

          {currentTab === 'policy' && (
            <PolicyManagement
              residents={residents}
              onUpdateResident={handleUpdateResident}
              organizations={syncedOrganizations}
              orgCategories={orgCategories}
              onUpdateCategories={saveCategories}
              onAddOrg={handleAddOrg}
              onUpdateOrg={handleUpdateOrg}
              onDeleteOrg={handleDeleteOrg}
              searchTerm={searchTerm}
              subfilter={policySubfilter}
              onSubfilterChange={(sub) => {
                setPolicySubfilter(sub);
                localStorage.setItem('kp_policy_subfilter', sub);

                // Infer parent folder from active subfilter code and set it as well
                if (sub) {
                  let folder = 'nhom_khac';
                  if (['cam_tinh_dang', 'dang_vien', 'dang_vien_213', 'dang_vien_du_bi'].includes(sub)) {
                    folder = 'chi_bo';
                  } else if (['ban_cong_tac', 'phu_nu', 'thanh_nien', 'cuu_chien_binh', 'chu_thap_do', 'nguoi_cao_tuoi', 'khuyen_hoc', 'to_hoa_giai', 'to_dan_van'].includes(sub)) {
                    folder = 'doan_the';
                  } else if (['ban_dieu_hanh', 'khu_doi', 'antt_co_so', 'cong_tac_vien', 'to_cong_nghe_so', 'dan_quan_tu_ve'].includes(sub)) {
                    folder = 'chinh_quyen';
                  } else if (['nguoi_co_cong', 'gia_dinh_liet_si', 'ho_ngheo', 'ho_can_ngheo', 'nguoi_cao_tuoi_cs', 'nguoi_khuyet_tat', 'bao_tro_xa_hoi', 'tre_em', 'kho_khan', 'doi_tuong_khac', 'chi_hoi_khac'].includes(sub)) {
                    folder = 'chinh_sach';
                  }
                  setActivePolicyFolder(folder);
                  localStorage.setItem('kp_policy_active_folder', folder);
                }
              }}
              changelogs={policyChangelogs}
              onAddChangelog={addPolicyChangelog}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              userRole={currentUserRole}
              onNavigateToResident={(resId) => {
                setFocusedResidentId(resId);
                setCurrentTab('population');
              }}
              activePolicyFolder={activePolicyFolder}
            />
          )}

          {currentTab === 'meetings' && (
            <MeetingManagement
              meetings={meetings}
              onAddMeeting={handleAddMeeting}
              onUpdateMeeting={handleUpdateMeeting}
              onDeleteMeeting={handleDeleteMeeting}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              currentUserRole={currentUserRole}
            />
          )}

          {currentTab === 'plans' && (
            <PlanManagement
              plans={plans}
              onAddPlan={handleAddPlan}
              onUpdatePlan={handleUpdatePlan}
              onDeletePlan={handleDeletePlan}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              currentUserRole={currentUserRole}
            />
          )}

          {currentTab === 'inbox' && (
            <OfficialArchive
              type="in"
              documents={officialDocs.filter(d => d.type === 'in' || (d.type === undefined && (['UBND Thành Phố Hồ Chí Minh', 'Đảng ủy Phường An Phú', 'Công ty Điện lực'].some(org => d.department.includes(org)) || d.docNumber.includes('UBND') || d.docNumber.includes('NQ'))))}
              onAddDoc={handleAddDoc}
              onUpdateDoc={handleUpdateDoc}
              onDeleteDoc={handleDeleteDoc}
              selectedCat={inboxSubfilter}
              onSelectedCatChange={setInboxSubfilter}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          )}

          {currentTab === 'outbox' && (
            <OfficialArchive
              type="out"
              documents={officialDocs.filter(d => d.type === 'out' || (d.type === undefined && !['UBND Thành Phố Hồ Chí Minh', 'Đảng ủy Phường An Phú', 'Công ty Điện lực'].some(org => d.department.includes(org)) && !d.docNumber.includes('UBND') && !d.docNumber.includes('NQ')))}
              onAddDoc={handleAddDoc}
              onUpdateDoc={handleUpdateDoc}
              onDeleteDoc={handleDeleteDoc}
              selectedCat={outboxSubfilter}
              onSelectedCatChange={setOutboxSubfilter}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          )}

          {currentTab === 'address' && (
            <GISManagement
              currentUserRole={currentUserRole}
              currentUsername={currentUser || 'User'}
              globalSearchTerm={searchTerm}
            />
          )}

          {currentTab === 'permissions' && isSuperOrAdmin && (
            <PermissionLogger
              users={users}
              auditLogs={auditLogs}
              currentUser={currentUser || 'admin'}
              onUpdateUser={handleUpdateUser}
              onAddUser={handleAddUser}
              onPermanentDeleteUser={handlePermanentDeleteUser}
              onAddAuditLog={handleAddAuditLog}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              activeTab={permissionsActiveTab}
              onActiveTabChange={handlePermissionsActiveTabChange}
              
              // Custom sync bindings
              isOnline={typeof navigator !== 'undefined' ? navigator.onLine : true}
              syncStatus={localStorage.getItem('kp_sync_client_connected') !== 'false' ? 'success' : 'disconnected'}
              pendingCount={pendingChangesCount}
              onTriggerSync={handleRunDualWaySync}
              lastSyncTime={new Date().toISOString()}
            />
          )}
        </main>
      </div>

      {/* Embedded quick virtual AI counseling tray drawer */}
      <AIChatDrawer isOpen={isQuickAiOpen} onClose={() => setIsQuickAiOpen(false)} />
    </div>
  );
}

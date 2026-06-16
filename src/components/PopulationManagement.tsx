import React, { useState } from 'react';
import { formatDate } from '../utils/dateUtils';
import { getCompactTagSpecs } from '../utils/tagUtils';
import { getResidentAnomalies } from '../utils/anomalyUtils';
import {
  Users,
  Award,
  Filter,
  Plus,
  FileSpreadsheet,
  FileDown,
  Search,
  Eye,
  Edit,
  Trash,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  Camera,
  Upload,
  UserCheck,
  MapPin,
  FileText,
  Navigation
} from 'lucide-react';
import { Resident, Household, Organization, OrgCategory } from '../types';
import * as XLSX from 'xlsx';
import { ViewModeSwitcher, DataView } from './ViewModeManager';

interface PopulationManagementProps {
  residents: Resident[];
  onAddResident: (res: Omit<Resident, 'id'>) => void;
  onUpdateResident: (res: Resident) => void;
  onDeleteResident: (id: string) => void;
  searchTerm: string;
  activeSubTab?: 'nhan_khau' | 'ho_khau' | 'tam_tru' | 'ho_tam_tru' | 'tam_vang' | 'vang_lai';
  onActiveSubTabChange?: (sub: 'nhan_khau' | 'ho_khau' | 'tam_tru' | 'ho_tam_tru' | 'tam_vang' | 'vang_lai') => void;
  organizations?: Organization[];
  orgCategories?: OrgCategory[];
  viewMode: 'card' | 'list';
  onViewModeChange: (mode: 'card' | 'list') => void;
  onClearAllResidents?: () => void;
  currentUserRole?: string;
  focusedResidentId?: string | null;
  onClearFocusedResident?: () => void;
  onNavigateToPolicyGroup?: (groupCode: string) => void;
  onBulkSyncResidents?: (added: Omit<Resident, 'id'>[], updated: Resident[]) => void;
}

/**
 * Accurately compare two Vietnamese addresses for co-residency.
 * Extracts the house number (e.g., "12/B2", "19/B2", "123/45") as a discrete token
 * and compares it exactly, then fuzzy-matches the rest (area, ward, city).
 * 
 * This avoids the previous bug where substring matching (includes()) would
 * falsely match addresses like "12/B2" with "2/B2" because "2/b2,khuphố3,..."
 * is a substring of "12/b2,khuphố3,...".
 */
function isSameAddress(addr1: string, addr2: string): boolean {
  if (!addr1 || !addr2) return false;

  const normalizeAddr = (raw: string) => raw.toLowerCase().replace(/\s+/g, ' ').trim();
  const n1 = normalizeAddr(addr1);
  const n2 = normalizeAddr(addr2);

  // Exact match after normalization
  if (n1 === n2) return true;

  // Extract the house number: the first token before the first comma
  // e.g. "12/B2, khu phố 3, ..." → houseNum = "12/b2", rest = "khu phố 3, ..."
  const splitAddr = (normalized: string) => {
    const commaIdx = normalized.indexOf(',');
    if (commaIdx === -1) return { houseNum: normalized, rest: '' };
    return {
      houseNum: normalized.substring(0, commaIdx).trim(),
      rest: normalized.substring(commaIdx + 1).trim()
    };
  };

  const p1 = splitAddr(n1);
  const p2 = splitAddr(n2);

  // House numbers must match exactly ("12/b2" !== "19/b2", "12/b2" !== "2/b2")
  if (p1.houseNum !== p2.houseNum) return false;

  // If house numbers match, check that the rest of the address is compatible
  // (fuzzy: strip all spaces and compare)
  const restClean1 = p1.rest.replace(/\s+/g, '');
  const restClean2 = p2.rest.replace(/\s+/g, '');

  // Rest parts should be the same, or one should contain the other
  // (handles minor variations like "TP HCM" vs "Thành phố Hồ Chí Minh")
  return restClean1 === restClean2 || restClean1.includes(restClean2) || restClean2.includes(restClean1);
}

export default function PopulationManagement({
  residents,
  onAddResident,
  onUpdateResident,
  onDeleteResident,
  onClearAllResidents,
  searchTerm,
  activeSubTab = 'nhan_khau',
  onActiveSubTabChange,
  organizations = [],
  orgCategories = [],
  viewMode,
  onViewModeChange,
  currentUserRole,
  focusedResidentId,
  onClearFocusedResident,
  onNavigateToPolicyGroup,
  onBulkSyncResidents,
}: PopulationManagementProps) {
  // Dynamic Neighborhood Groups based on backend residents database
  const dynamicNeighborhoodGroups = React.useMemo(() => {
    const groups = new Set<string>();
    // Seed standard options so they are always visible
    groups.add('Tổ dân phố 1');
    groups.add('Tổ dân phố 2');
    groups.add('Tổ dân phố 3');
    groups.add('Tổ dân phố 5');
    // Incorporate any live additions from the residents list
    residents.forEach((res) => {
      if (res.neighborhoodGroup) {
        groups.add(res.neighborhoodGroup);
      }
    });
    return Array.from(groups).sort();
  }, [residents]);

  // Filters state
  const [selectedGroup, setSelectedGroup] = useState('Tất cả Tổ dân phố');
  const [selectedAge, setSelectedAge] = useState('Độ tuổi: Tất cả');
  const [selectedStatus, setSelectedStatus] = useState('Tất cả trạng thái');

  // State for quick integration sections accordion
  const [openIntegrationSections, setOpenIntegrationSections] = useState<Record<string, boolean>>({
    chibo: true,
    chinhquyen: false,
    doanthe: false,
    chinhsach: false,
    other: false
  });



  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [householdsPage, setHouseholdsPage] = useState(1);
  const [tempHouseholdsPage, setTempHouseholdsPage] = useState(1);

  const getVisiblePages = (current: number, total: number) => {
    const maxPages = 5;
    if (total <= maxPages) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    let start = Math.max(1, current - 2);
    let end = Math.min(total, start + maxPages - 1);
    if (end - start < maxPages - 1) {
      start = Math.max(1, end - maxPages + 1);
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  // Households subtab local database
  const [households, setHouseholds] = useState<Household[]>(() => {
    const saved = localStorage.getItem('kp_households');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error('Failed to parse households', e); }
    }
    return [];
  });

  // Temporary Households subtab local database
  const [temporaryHouseholds, setTemporaryHouseholds] = useState<Household[]>(() => {
    const saved = localStorage.getItem('kp_temporary_households');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error('Failed to parse temporary households', e); }
    }
    return [];
  });

  // Persist households and temporaryHouseholds
  React.useEffect(() => {
    localStorage.setItem('kp_households', JSON.stringify(households));
  }, [households]);

  React.useEffect(() => {
    localStorage.setItem('kp_temporary_households', JSON.stringify(temporaryHouseholds));
  }, [temporaryHouseholds]);

  // Reconstruct households and temporaryHouseholds dynamically from residents if either state is empty
  React.useEffect(() => {
    if (residents.length === 0) return;

    // Group residents by householdId, falling back to address if householdId is missing
    const residentsByHhId: Record<string, Resident[]> = {};
    residents.forEach(r => {
      // Clean address key to merge members under the same roof if householdId is not set
      const hhKey = r.householdId || (r.address ? r.address.trim().toLowerCase().replace(/\s+/g, '') : '');
      if (hhKey) {
        if (!residentsByHhId[hhKey]) {
          residentsByHhId[hhKey] = [];
        }
        residentsByHhId[hhKey].push(r);
      }
    });

    const permHouseholdsMap = new Map<string, Household>();
    const tempHouseholdsMap = new Map<string, Household>();

    Object.entries(residentsByHhId).forEach(([hhKey, members]) => {
      const isTemp = members.some(m => m.status === 'Tạm trú');
      
      // Find owner: either note is "Chủ hộ" or default to first member
      let owner = members.find(m => m.note === 'Chủ hộ' || m.note?.toLowerCase().includes('chủ hộ') || m.note?.toLowerCase() === 'ch');
      if (!owner) {
        owner = members[0];
      }

      // If key is a generated householdId, use it. Otherwise construct h_ + idCard or id
      const finalHhId = members[0].householdId || `h_${members[0].idCard ? members[0].idCard.replace(/\s+/g, '') : members[0].id}`;

      const hhObject: Household = {
        id: finalHhId,
        ownerName: owner.name,
        idCard: owner.idCard || '',
        address: owner.address || 'Khu phố 3, An Phú',
        neighborhoodGroup: owner.neighborhoodGroup || 'Tổ dân phố 1',
        membersCount: members.length,
        phone: owner.phone || ''
      };

      if (isTemp) {
        tempHouseholdsMap.set(finalHhId, hhObject);
      } else {
        permHouseholdsMap.set(finalHhId, hhObject);
      }
    });

    if (households.length === 0 && permHouseholdsMap.size > 0) {
      console.log('Reconstructing permanent households from residents list...');
      setHouseholds(Array.from(permHouseholdsMap.values()));
    }
    if (temporaryHouseholds.length === 0 && tempHouseholdsMap.size > 0) {
      console.log('Reconstructing temporary households from residents list...');
      setTemporaryHouseholds(Array.from(tempHouseholdsMap.values()));
    }
  }, [residents, households.length, temporaryHouseholds.length]);

  // Handle outside focus on a resident profile (deep-link/drill-down)
  React.useEffect(() => {
    if (focusedResidentId) {
      const match = residents.find(r => r.id === focusedResidentId);
      if (match) {
        setPreviewResident(match);
        // Sync active population subtab automatically
        if (match.status === 'Tạm trú' && onActiveSubTabChange) {
          onActiveSubTabChange('tam_tru');
        } else if (match.status === 'Thường trú' && onActiveSubTabChange) {
          onActiveSubTabChange('nhan_khau');
        } else if (match.status === 'Tạm vắng' && onActiveSubTabChange) {
          onActiveSubTabChange('tam_vang');
        }
      }
      if (onClearFocusedResident) {
        onClearFocusedResident();
      }
    }
  }, [focusedResidentId, residents, onActiveSubTabChange, onClearFocusedResident]);

  // Safe delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'resident' | 'household' | 'temp_household';
    id: string;
    title: string;
    message: string;
  } | null>(null);

  // Safe delete confirmation state for testing clean slate
  const [isClearAllConfirmOpen, setIsClearAllConfirmOpen] = useState(false);

  // Switch/change head of household confirmation state
  const [leaderChangeConfirm, setLeaderChangeConfirm] = useState<{ householdId: string; newLeader: Resident } | null>(null);

  // Preview elements visual drawer states
  const [previewResident, setPreviewResident] = useState<Resident | null>(null);
  const [previewHousehold, setPreviewHousehold] = useState<Household | null>(null);

  // State for editing a household
  const [editingHousehold, setEditingHousehold] = useState<Household | null>(null);
  const [editHOwnerName, setEditHOwnerName] = useState('');
  const [editHIdCard, setEditHIdCard] = useState('');
  const [editHAddress, setEditHAddress] = useState('');
  const [editHNeighborhoodGroup, setEditHNeighborhoodGroup] = useState('Tổ dân phố 1');
  const [editHPhone, setEditHPhone] = useState('');
  const [editHSyncMembers, setEditHSyncMembers] = useState(true);
  const [editHLat, setEditHLat] = useState<number | ''>('');
  const [editHLng, setEditHLng] = useState<number | ''>('');

  // Dynamic counter of members per household to keep UI synced with the live database
  const getDynamicMembersCount = (h: Household) => {
    if (!h) return 0;
    const matched = residents.filter(r => {
      if (r.householdId && h.id && r.householdId === h.id) return true;
      if (!r.address || !h.address) return !!(r.idCard && h.idCard && r.idCard === h.idCard);
      return isSameAddress(r.address, h.address) || !!(r.idCard && h.idCard && r.idCard === h.idCard);
    });
    return matched.length;
  };

  // Households form states
  const [isHouseOpen, setIsHouseOpen] = useState(false);
  const [isTempHouseOpen, setIsTempHouseOpen] = useState(false);
  const [houseOwner, setHouseOwner] = useState('');
  const [houseIdCard, setHouseIdCard] = useState('');
  const [houseAddress, setHouseAddress] = useState('');
  const [houseGroup, setHouseGroup] = useState('Tổ dân phố 1');
  const [customHouseGroup, setCustomHouseGroup] = useState('');
  const [housePhone, setHousePhone] = useState('');
  const [houseLat, setHouseLat] = useState<number | ''>('');
  const [houseLng, setHouseLng] = useState<number | ''>('');

  // Duplication import file state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importScenario, setImportScenario] = useState<'scenario_1' | 'scenario_2'>('scenario_1');
  const [importStatus, setImportStatus] = useState<string | null>(null);



  // AI-powered File Upload and Population Importer states
  const [isImportFileOpen, setIsImportFileOpen] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  
  // Importer Steps and Options
  const [importStep, setImportStep] = useState<1 | 2 | 3 | 4>(1); // 1: Choose DataType, 2: Select Files, 3: AI Preview & Match, 4: Success Report
  const [importDataType, setImportDataType] = useState<'nhan_khau' | 'tam_tru' | 'auto'>('auto');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string | null>(null);
  
  // AI analysis results
  const [uploadParsedData, setUploadParsedData] = useState<any[]>([]);
  const [parsedHouseholds, setParsedHouseholds] = useState<any[]>([]);
  const [parsedStats, setParsedStats] = useState<any>({
    totalHouseholds: 0,
    totalResidents: 0,
    validCount: 0,
    duplicateCount: 0,
    missingDataCount: 0,
    permanentHouseholdsCount: 0,
    temporaryHouseholdsCount: 0
  });
  const [originalFileSummary, setOriginalFileSummary] = useState('');
  
  // Preview tabs state for Step 3
  const [previewTab, setPreviewTab] = useState<'residents' | 'households' | 'missing'>('residents');
  const [residentFilter, setResidentFilter] = useState<'all' | 'new' | 'skipped' | 'suspected'>('all');

  // Success report details for Step 4
  const [importReport, setImportReport] = useState<{
    totalRecordsCount: number;
    newHouseholdsCount: number;
    skippedHouseholdsCount: number;
    newResidentsCount: number;
    skippedResidentsCount: number;
    suspectedCheckedCount: number;
    aiLogMessages: string[];
  } | null>(null);

  // Conflict and quick editing states
  const [duplicateResolutions, setDuplicateResolutions] = useState<Record<string, 'overwrite' | 'skip' | 'update'>>({});
  const [editingResidentId, setEditingResidentId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Historical import activity logs
  const [importLogs, setImportLogs] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('kp_ai_import_logs');
      return saved ? JSON.parse(saved) : [
        {
          id: 'log_01',
          operator: 'bdhkhupho3.ap@gmail.com',
          time: '2026-06-03 10:14',
          fileName: 'Danh_sach_cu_dan_To_5.xlsx',
          recordCount: 12,
          result: 'AI hoàn tất gộp 3 nhóm hộ gia đình thường trú.'
        },
        {
          id: 'log_02',
          operator: 'bdhkhupho3.ap@gmail.com',
          time: '2026-06-03 15:45',
          fileName: 'Khai_bao_tam_tru_A_B_C.pdf',
          recordCount: 5,
          result: 'Đã hoàn tất trích xuất OCR và lập 2 hộ tạm cư.'
        }
      ];
    } catch {
      return [];
    }
  });

  React.useEffect(() => {
    localStorage.setItem('kp_ai_import_logs', JSON.stringify(importLogs));
  }, [importLogs]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files) {
      const files: File[] = [];
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        files.push(e.dataTransfer.files[i]);
      }
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files: File[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        files.push(e.target.files[i]);
      }
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleStartInlineEdit = (id: string, field: string, value: string) => {
    setEditingResidentId(id);
    setEditingField(field);
    setEditValue(value);
  };

  const handleSaveInlineEdit = () => {
    if (!editingResidentId || !editingField) return;
    setUploadParsedData(prev => prev.map((item) => {
      if (item.id === editingResidentId) {
        return {
          ...item,
          [editingField]: editValue
        };
      }
      return item;
    }));
    setEditingResidentId(null);
    setEditingField(null);
  };

  const processAndAnalyzeWithAI = async () => {
    if (selectedFiles.length === 0) {
      setUploadErrorMsg("Vui lòng chọn ít nhất một tệp để phân tích.");
      return;
    }

    setIsParsing(true);
    setUploadErrorMsg(null);
    setUploadParsedData([]);
    setParsedHouseholds([]);

    try {
      const allParsedResidents: any[] = [];
      const allParsedHouseholds: any[] = [];
      let consolidatedSummary = '';
      
      const combinedStats = {
        totalHouseholds: 0,
        totalResidents: 0,
        validCount: 0,
        duplicateCount: 0,
        missingDataCount: 0,
        permanentHouseholdsCount: 0,
        temporaryHouseholdsCount: 0
      };

      for (const file of selectedFiles) {
        const filePackage = await new Promise<{ content: string; mimeType: string }>((resolve, reject) => {
          const reader = new FileReader();
          const ext = file.name.split('.').pop()?.toLowerCase();
          const isExcel = ext === 'xlsx' || ext === 'xls' || ext === 'ods';
          const isImage = ['jpg', 'jpeg', 'png', 'webp', 'tiff'].includes(ext || '');
          const isPDF = ext === 'pdf';
          
          if (isExcel) {
            reader.onload = (e) => {
              try {
                const ab = e.target?.result;
                const workbook = XLSX.read(ab, { type: 'array' });
                let textResult = '';
                workbook.SheetNames.forEach((sheetName) => {
                  const worksheet = workbook.Sheets[sheetName];
                  const csv = XLSX.utils.sheet_to_csv(worksheet);
                  textResult += `[[Sheet: ${sheetName}]]\n${csv}\n\n`;
                });
                resolve({ content: textResult, mimeType: 'text/csv' });
              } catch (err) {
                reject(new Error(`Lỗi đọc tệp Excel ${file.name}`));
              }
            };
            reader.readAsArrayBuffer(file);
          } else if (isImage || isPDF) {
            reader.onload = (e) => {
              const res = e.target?.result as string;
              const base64 = res.includes('base64,') ? res.split('base64,')[1] : res;
              const mime = isPDF ? 'application/pdf' : `image/${ext}`;
              resolve({ content: base64, mimeType: mime });
            };
            reader.readAsDataURL(file);
          } else {
            reader.onload = (e) => {
              resolve({ content: e.target?.result as string || '', mimeType: 'text/plain' });
            };
            reader.readAsText(file);
          }
        });

        const response = await fetch('/api/gemini/parse', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-gemini-key': localStorage.getItem('kp_gemini_api_key') || ''
          },
          body: JSON.stringify({
            fileContent: filePackage.content,
            mimeType: filePackage.mimeType,
            fileName: file.name,
            dataType: importDataType,
            existingResidents: residents
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || `Không thể phân tích tệp ${file.name}`);
        }

        const data = await response.json();
        
        data.residents.forEach((res: any) => {
          allParsedResidents.push({
            ...res,
            originalFile: file.name
          });
        });
        
        data.households.forEach((hh: any) => {
          if (!allParsedHouseholds.some(ah => ah.id === hh.id)) {
            allParsedHouseholds.push(hh);
          }
        });

        consolidatedSummary += `- ${file.name}: ${data.originalFileSummary || 'Phân tích AI hoàn chỉnh.'}\n`;
        
        combinedStats.totalHouseholds += data.stats.totalHouseholds;
        combinedStats.totalResidents += data.stats.totalResidents;
        combinedStats.validCount += data.stats.validCount;
        combinedStats.duplicateCount += data.stats.duplicateCount;
        combinedStats.missingDataCount += data.stats.missingDataCount;
        combinedStats.permanentHouseholdsCount += data.stats.permanentHouseholdsCount;
        combinedStats.temporaryHouseholdsCount += data.stats.temporaryHouseholdsCount;
      }

      // Upgrade to 3-tier offline client-side validation against live database
      const processedResidents = allParsedResidents.map((item) => {
        // Level 1: Sure Duplicate (Same clean CCCD/CMND)
        const cleanIDCard = item.idCard ? item.idCard.replace(/\s+/g, '') : '';
        const level1Dup = cleanIDCard ? residents.find(r => r.idCard && r.idCard.replace(/\s+/g, '') === cleanIDCard) : null;
        
        if (level1Dup) {
          return {
            ...item,
            duplicateStatus: 'level_1_duplicate',
            proposedAction: 'skip',
            duplicateWith: level1Dup
          };
        }

        // Level 2: Very High (Same name, same DOB, same Address)
        const level2Dup = residents.find(r => 
          r.name.trim().toLowerCase() === item.name.trim().toLowerCase() &&
          r.dob === item.dob &&
          r.address.trim().toLowerCase() === item.address.trim().toLowerCase()
        );

        if (level2Dup) {
          return {
            ...item,
            duplicateStatus: 'level_2_duplicate',
            proposedAction: 'skip',
            duplicateWith: level2Dup
          };
        }

        // Level 3: Suspected (Same name, but missing or different dob/address)
        const level3Dup = residents.find(r => 
          r.name.trim().toLowerCase() === item.name.trim().toLowerCase()
        );

        if (level3Dup) {
          return {
            ...item,
            duplicateStatus: 'level_3_suspected',
            proposedAction: 'review',
            duplicateWith: level3Dup
          };
        }

        return {
          ...item,
          duplicateStatus: 'none',
          proposedAction: 'create'
        };
      });

      // Update resolution configurations: Auto skip Level 1 & 2
      const initialResolutions: Record<string, 'overwrite' | 'skip' | 'update'> = {};
      processedResidents.forEach((res) => {
        if (res.duplicateStatus === 'level_1_duplicate' || res.duplicateStatus === 'level_2_duplicate') {
          initialResolutions[res.id] = 'skip';
        } else if (res.duplicateStatus === 'level_3_suspected') {
          initialResolutions[res.id] = 'update';
        }
      });

      // Smart household deduplication checking 
      const resolvedHouseholds = allParsedHouseholds.map(p_hh => {
        const isTemp = importDataType === 'tam_tru' || (importDataType === 'auto' && p_hh.status === 'Tạm trú');
        const targetState = isTemp ? temporaryHouseholds : households;
        
        const matchedEx = targetState.find(h => 
          h.ownerName.trim().toLowerCase() === p_hh.ownerName.trim().toLowerCase() &&
          h.address.trim().toLowerCase() === p_hh.address.trim().toLowerCase()
        );

        if (matchedEx) {
          return {
            ...p_hh,
            alreadyExists: true,
            existingId: matchedEx.id
          };
        }

        return {
          ...p_hh,
          alreadyExists: false
        };
      });

      setDuplicateResolutions(initialResolutions);
      setUploadParsedData(processedResidents);
      setParsedHouseholds(resolvedHouseholds);
      setParsedStats(combinedStats);
      setOriginalFileSummary(consolidatedSummary || "Đã hoàn tất phân tích bằng AI đính kèm.");
      setImportStep(3);
    } catch (error: any) {
      console.error(error);
      setUploadErrorMsg(error.message || "Lỗi khi kết nối dịch vụ phân tích AI.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmSyncUpload = () => {
    if (uploadParsedData.length === 0) return;

    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let suspectedCount = 0;

    const generatedAiLogs: string[] = [
      `[Hệ thống] Khởi tạo quy trình kiểm đối cơ sở dữ liệu.`,
      `[Ánh xạ] Ánh xạ tự động thành công cột dữ liệu từ file đính kèm.`
    ];

    // Track active maps to households (to ensure linking is correct)
    const householdIdMapping: Record<string, string> = {};

    // 1. Core Household Setup / Merging
    const isTemporary = importDataType === 'tam_tru' || (importDataType === 'auto' && selectedFiles.some(f => f.name.toLowerCase().includes('tam')));
    let newHhCount = 0;
    let skippedHhCount = 0;

    const newHouseholds: Household[] = [];
    const newTempHouseholds: Household[] = [];

    parsedHouseholds.forEach((p_hh) => {
      const isTemp = 
        importDataType === 'nhan_khau' ? false :
        importDataType === 'tam_tru' ? true :
        (p_hh.status === 'Tạm trú' || p_hh.address.toLowerCase().includes('tạm') || isTemporary);

      if (p_hh.alreadyExists && p_hh.existingId) {
        // Merge to existing household
        householdIdMapping[p_hh.id] = p_hh.existingId;
        skippedHhCount++;
      } else {
        // Create new unique registration id
        const newHhid = p_hh.id.startsWith('h_') ? p_hh.id : `h_${Math.random().toString(36).substring(2, 6)}`;
        householdIdMapping[p_hh.id] = newHhid;

        const householdMembers = uploadParsedData.filter(r => r.householdId === p_hh.id);
        
        // Handle smart owner name prioritization if owner is placeholder
        let finalOwnerName = p_hh.ownerName;
        if (!finalOwnerName || finalOwnerName === 'Chưa xác định chủ hộ') {
          const ownerMember = householdMembers.find(m => m.note?.toLowerCase().includes('chủ hộ') || m.note?.toLowerCase() === 'ch');
          if (ownerMember) {
            finalOwnerName = ownerMember.name;
          } else if (householdMembers.length > 0) {
            // Sort by age oldest first
            const sortedByAge = [...householdMembers].sort((a,b) => {
              const yearA = parseInt(a.dob?.substring(0,4)) || 1900;
              const yearB = parseInt(b.dob?.substring(0,4)) || 1900;
              return yearA - yearB;
            });
            finalOwnerName = sortedByAge[0].name;
            generatedAiLogs.push(`[Suy luận AI] Hộ gia đình tại địa chỉ '${p_hh.address}' tự động suy luận chủ hộ lớn tuổi nhất là ông/bà ${finalOwnerName}.`);
          } else {
            finalOwnerName = 'Chưa xác định chủ hộ';
          }
        }

        const newHouseholdObject: Household = {
          id: newHhid,
          ownerName: finalOwnerName,
          idCard: p_hh.idCard || (householdMembers.find(m => m.name === finalOwnerName)?.idCard || ''),
          address: p_hh.address || 'Khu phố 3, An Phú',
          neighborhoodGroup: p_hh.neighborhoodGroup || 'Tổ dân phố 1',
          membersCount: householdMembers.length || 1,
          phone: p_hh.phone || (householdMembers.find(m => m.name === finalOwnerName)?.phone || ''),
        };

        if (isTemp) {
          newTempHouseholds.push(newHouseholdObject);
        } else {
          newHouseholds.push(newHouseholdObject);
        }
        newHhCount++;
      }
    });

    if (newHouseholds.length > 0) {
      setHouseholds(prev => [...newHouseholds, ...prev]);
    }
    if (newTempHouseholds.length > 0) {
      setTemporaryHouseholds(prev => [...newTempHouseholds, ...prev]);
    }

    // 2. Residents Sync Setup
    const addedResidentsList: Omit<Resident, 'id'>[] = [];
    const updatedResidentsList: Resident[] = [];

    uploadParsedData.forEach((item) => {
      const finalStatus = 
        importDataType === 'nhan_khau' ? 'Thường trú' : 
        importDataType === 'tam_tru' ? 'Tạm trú' : 
        (item.status || 'Thường trú');

      const mappedId = householdIdMapping[item.householdId] || '';

      if (item.duplicateStatus === 'level_1_duplicate' || item.duplicateStatus === 'level_2_duplicate' || item.duplicateStatus === 'level_3_suspected') {
        const resolution = duplicateResolutions[item.id] || 'skip';
        
        if (resolution === 'skip') {
          skippedCount++;
          return;
        }

        const existing = residents.find(r => 
          (item.idCard && r.idCard && r.idCard.replace(/\s+/g, '') === item.idCard.replace(/\s+/g, '')) || 
          (r.name.toLowerCase().trim() === item.name.toLowerCase().trim() && r.dob === item.dob)
        );

        if (existing) {
          if (resolution === 'overwrite') {
            updatedResidentsList.push({
              ...existing,
              name: item.name,
              dob: item.dob,
              gender: item.gender,
              address: item.address || existing.address,
              neighborhoodGroup: item.neighborhoodGroup || existing.neighborhoodGroup,
              status: finalStatus,
              phone: item.phone || existing.phone,
              occupation: item.occupation || existing.occupation,
              note: item.note || existing.note,
              householdId: mappedId || existing.householdId
            });
            updatedCount++;
          } else if (resolution === 'update') {
            updatedResidentsList.push({
              ...existing,
              phone: existing.phone || item.phone,
              occupation: existing.occupation || item.occupation,
              note: existing.note || item.note,
              status: finalStatus,
              address: existing.address || item.address,
              householdId: mappedId || existing.householdId
            });
            updatedCount++;
          }
        } else {
          // If resolving with overwrite/update but existing in-memory resident is not found, treat as new
          addedResidentsList.push({
            name: item.name,
            dob: item.dob,
            gender: item.gender,
            idCard: item.idCard,
            address: item.address,
            neighborhoodGroup: item.neighborhoodGroup || 'Tổ dân phố 1',
            status: finalStatus,
            phone: item.phone,
            occupation: item.occupation,
            note: item.note,
            householdId: mappedId,
            classifications: []
          });
          addedCount++;
        }
      } else {
        // Completely New
        addedResidentsList.push({
          name: item.name,
          dob: item.dob,
          gender: item.gender,
          idCard: item.idCard,
          address: item.address,
          neighborhoodGroup: item.neighborhoodGroup || 'Tổ dân phố 1',
          status: finalStatus,
          phone: item.phone,
          occupation: item.occupation,
          note: item.note,
          householdId: mappedId,
          classifications: []
        });
        addedCount++;
      }
    });

    if (onBulkSyncResidents) {
      onBulkSyncResidents(addedResidentsList, updatedResidentsList);
    } else {
      // Fallback if not provided
      addedResidentsList.forEach(res => onAddResident(res));
      updatedResidentsList.forEach(res => onUpdateResident(res));
    }

    const suspectedItems = uploadParsedData.filter(r => r.duplicateStatus === 'level_3_suspected');
    suspectedCount = suspectedItems.length;

    // Build smart AI log explanations
    generatedAiLogs.push(`[Chuẩn hóa] Viết hoa chữ cái đầu và cân bằng khoảng trắng cho ${uploadParsedData.length} nhân khẩu.`);
    generatedAiLogs.push(`[Xử lý] Phân tách thành công ${uploadParsedData.filter(r => !r.idCard).length} nhân khẩu thiếu số CCCD.`);
    generatedAiLogs.push(`[Dữ liệu] Thêm mới thành công ${addedCount} cư dân mới vào hệ thống.`);
    if (updatedCount > 0) {
      generatedAiLogs.push(`[Đồng bộ] Cập nhật nâng cấp ${updatedCount} bản ghi cư dân cũ có trùng khớp.`);
    }
    if (skippedCount > 0) {
      generatedAiLogs.push(`[Dữ liệu trùng] Loại bỏ và tránh lặp ${skippedCount} nhân khẩu theo cấu hình Mức 1 & Mức 2.`);
    }
    if (skippedHhCount > 0) {
      generatedAiLogs.push(`[Gom hộ trùng] Đồng bộ và liên kết nhân khẩu tự động vào ${skippedHhCount} Hộ gia đình đã có sẵn.`);
    }
    if (newHhCount > 0) {
      generatedAiLogs.push(`[Khởi tạo hộ] Thiết kế và cấp mã số định danh gia đình mới cho ${newHhCount} hộ gia đình.`);
    }

    const newLog = {
      id: `log_${Date.now()}`,
      operator: 'bdhkhupho3.ap@gmail.com',
      time: new Date().toISOString().replace('T', ' ').substring(0, 16),
      fileName: selectedFiles.map(f => f.name).join(', '),
      recordCount: uploadParsedData.length,
      result: `Vừa nhập ${addedCount} mới, cập nhật ${updatedCount} trùng, bỏ qua ${skippedCount} nhân khẩu, đồng bộ ${newHhCount} hộ mới.`
    };
    
    setImportLogs(prev => [newLog, ...prev]);
    localStorage.setItem('kp_ai_import_logs', JSON.stringify([newLog, ...importLogs]));

    // Store in Report
    setImportReport({
      totalRecordsCount: uploadParsedData.length,
      newHouseholdsCount: newHhCount,
      skippedHouseholdsCount: skippedHhCount,
      newResidentsCount: addedCount,
      skippedResidentsCount: skippedCount,
      suspectedCheckedCount: suspectedCount,
      aiLogMessages: generatedAiLogs
    });

    // Advance to report step
    setImportStep(4);
  };

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Form states Resident
  const [currentResident, setCurrentResident] = useState<Resident | null>(null);
  const [formHouseholdId, setFormHouseholdId] = useState('');
  const [formName, setFormName] = useState('');
  const [formDob, setFormDob] = useState('');
  const [formGender, setFormGender] = useState<'Nam' | 'Nữ'>('Nam');
  const [formIdCard, setFormIdCard] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formGroup, setFormGroup] = useState('Tổ dân phố 1');
  const [customFormGroup, setCustomFormGroup] = useState('');
  const [formStatus, setFormStatus] = useState<'Thường trú' | 'Tạm trú' | 'Tạm vắng' | 'Vãng lai'>('Thường trú');
  const [formPhone, setFormPhone] = useState('');
  const [formOccupation, setFormOccupation] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formClassifications, setFormClassifications] = useState<string[]>([]);

  // ----------------- Filter Logic -----------------
  const getFilteredResidents = () => {
    return residents.filter((res) => {
      // Filter by activeSubTab status locks
      if (activeSubTab === 'nhan_khau' && res.status !== 'Thường trú') {
        return false;
      }
      if (activeSubTab === 'tam_tru' && res.status !== 'Tạm trú') {
        return false;
      }
      if (activeSubTab === 'tam_vang' && res.status !== 'Tạm vắng') {
        return false;
      }
      if (activeSubTab === 'vang_lai' && res.status !== 'Vãng lai') {
        return false;
      }

      const termCheck = searchTerm.toLowerCase();
      const matchesSearch =
        res.name.toLowerCase().includes(termCheck) ||
        res.idCard.includes(searchTerm) ||
        res.address.toLowerCase().includes(termCheck);

      if (!matchesSearch) return false;

      // Residency Status matching
      if (selectedStatus !== 'Tất cả trạng thái' && res.status !== selectedStatus) {
        return false;
      }

      // Group matching
      if (selectedGroup !== 'Tất cả Tổ dân phố') {
        if (res.neighborhoodGroup !== selectedGroup) return false;
      }

      // Age category filtering
      if (selectedAge !== 'Độ tuổi: Tất cả') {
        const birthYear = parseInt(res.dob.split('/')[2]);
        const currentYear = 2026;
        const residentAge = currentYear - birthYear;

        if (selectedAge === 'Trẻ em (0-15)' && residentAge > 15) return false;
        if (selectedAge === 'Thanh niên (16-35)' && (residentAge <= 15 || residentAge > 35)) return false;
        if (selectedAge === 'Trung niên (36-60)' && (residentAge <= 35 || residentAge > 60)) return false;
        if (selectedAge === 'Người già (>60)' && residentAge <= 60) return false;
      }

      return true;
    });
  };

  const filteredResidents = getFilteredResidents();
  const paginatedResidents = filteredResidents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredResidents.length / itemsPerPage) || 1;

  const filteredHouseholds = households.filter((h) => {
    const termCheck = searchTerm.toLowerCase();
    
    // Group filter match if selectedGroup is active
    if (selectedGroup !== 'Tất cả Tổ dân phố' && h.neighborhoodGroup !== selectedGroup) {
      return false;
    }

    return (
      h.ownerName.toLowerCase().includes(termCheck) ||
      h.id.toLowerCase().includes(termCheck) ||
      h.address.toLowerCase().includes(termCheck) ||
      (h.idCard && h.idCard.includes(searchTerm)) ||
      (h.phone && h.phone.includes(searchTerm))
    );
  });

  const paginatedHouseholds = filteredHouseholds.slice((householdsPage - 1) * itemsPerPage, householdsPage * itemsPerPage);
  const totalPagesHouseholds = Math.ceil(filteredHouseholds.length / itemsPerPage) || 1;

  const filteredTempHouseholds = temporaryHouseholds.filter((h) => {
    const termCheck = searchTerm.toLowerCase();

    // Group filter match if selectedGroup is active
    if (selectedGroup !== 'Tất cả Tổ dân phố' && h.neighborhoodGroup !== selectedGroup) {
      return false;
    }

    return (
      h.ownerName.toLowerCase().includes(termCheck) ||
      h.id.toLowerCase().includes(termCheck) ||
      h.address.toLowerCase().includes(termCheck) ||
      (h.idCard && h.idCard.includes(searchTerm)) ||
      (h.phone && h.phone.includes(searchTerm))
    );
  });

  const paginatedTempHouseholds = filteredTempHouseholds.slice((tempHouseholdsPage - 1) * itemsPerPage, tempHouseholdsPage * itemsPerPage);
  const totalPagesTempHouseholds = Math.ceil(filteredTempHouseholds.length / itemsPerPage) || 1;

  // Auto-correct page if last item on page was deleted
  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  React.useEffect(() => {
    if (householdsPage > totalPagesHouseholds) {
      setHouseholdsPage(totalPagesHouseholds);
    }
  }, [totalPagesHouseholds, householdsPage]);

  React.useEffect(() => {
    if (tempHouseholdsPage > totalPagesTempHouseholds) {
      setTempHouseholdsPage(totalPagesTempHouseholds);
    }
  }, [totalPagesTempHouseholds, tempHouseholdsPage]);

  // Reset pagination to page 1 whenever search terms or subtabs change
  React.useEffect(() => {
    setCurrentPage(1);
    setHouseholdsPage(1);
    setTempHouseholdsPage(1);
  }, [searchTerm, activeSubTab]);

  // ----------------- Export Excel Handler -----------------
  const exportToExcel = (type: 'nhan_khau' | 'ho_khau' | 'tam_tru' | 'ho_tam_tru' | 'tam_vang' | 'vang_lai') => {
    let rawData: any[] = [];
    let fileName = '';
    let sheetName = '';

    if (type === 'ho_khau') {
      rawData = households;
      fileName = 'Danh_sach_ho_khau_thuong_tru';
      sheetName = 'Hộ khẩu thường trú';
    } else if (type === 'ho_tam_tru') {
      rawData = temporaryHouseholds;
      fileName = 'Danh_sach_ho_tam_tru';
      sheetName = 'Hộ tạm trú';
    } else {
      rawData = filteredResidents;
      if (type === 'nhan_khau') {
        fileName = 'Danh_sach_nhan_khau_thuong_tru';
        sheetName = 'Nhân khẩu thường trú';
      } else if (type === 'tam_tru') {
        fileName = 'Danh_sach_nhan_khau_tam_tru';
        sheetName = 'Nhân khẩu tạm trú';
      } else if (type === 'tam_vang') {
        fileName = 'Danh_sach_nhan_khau_tam_vang';
        sheetName = 'Tạm vắng';
      } else {
        fileName = 'Danh_sach_nhan_khau_vang_lai';
        sheetName = 'Vãng lai';
      }
    }

    if (rawData.length === 0) {
      alert('Không có dữ liệu để xuất file Excel!');
      return;
    }

    let formattedData: any[] = [];

    if (type === 'ho_khau' || type === 'ho_tam_tru') {
      formattedData = rawData.map((h, index) => ({
        'STT': index + 1,
        'Mã Sổ Hộ': h.id,
        'Họ Tên Chủ Hộ': h.ownerName,
        'Số CCCD': h.idCard,
        'Điện Thoại Chủ Hộ': h.phone || 'Chưa cập nhật',
        'Địa Chỉ Cư Trú': h.address,
        'Tổ Dân Phố': h.neighborhoodGroup,
        'Số Thành Viên Đồng Cư': getDynamicMembersCount(h)
      }));
    } else {
      formattedData = rawData.map((r, index) => {
        // Find member classifications / tags if any
        const tags = (r.classifications || []).map(code => {
          const matchingOrg = (organizations || []).find(o => o.code === code || o.id === code);
          return matchingOrg ? matchingOrg.name : code;
        }).join(', ');

        return {
          'STT': index + 1,
          'Mã Định Danh': r.id,
          'Họ và Tên Nhân Khẩu': r.name,
          'Ngày Sinh': r.dob,
          'Giới Tính': r.gender,
          'Số CCCD': r.idCard,
          'Số Điện Thoại': r.phone || 'Chưa cập nhật',
          'Nghề Nghiệp / Học Vấn': r.occupation || 'Chưa cập nhật',
          'Địa Chỉ Cư Trú Hiện Nay': r.address,
          'Tổ Dân Phố': r.neighborhoodGroup,
          'Trạng Thái Cư Trú': r.status,
          'Đoàn Thể / Chính Sách': tags || 'Không',
          'Ghi Chú': r.note || ''
        };
      });
    }

    try {
      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      
      const maxLens = Object.keys(formattedData[0] || {}).map((key) => {
        let maxLen = key.length;
        formattedData.forEach((row) => {
          const val = row[key];
          if (val !== undefined && val !== null) {
            maxLen = Math.max(maxLen, val.toString().length);
          }
        });
        return { wch: maxLen + 3 };
      });
      worksheet['!cols'] = maxLens;

      XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) {
      console.error('Lỗi khi xuất file Excel', error);
      alert('Không thể xuất file Excel. Vui lòng thử lại!');
    }
  };

  // ----------------- Resident Handlers -----------------
  const openAddModal = () => {
    if (currentUserRole === 'User') {
      alert('⛔ Tài khoản của bạn chỉ có quyền xem và tra cứu nội dung. Không thể thực hiện thao tác này!');
      return;
    }
    setFormHouseholdId('');
    setFormName('');
    setFormDob('15/08/1990');
    setFormGender('Nam');
    setFormIdCard('');
    setFormAddress('');
    setFormGroup('Tổ dân phố 1');
    setCustomFormGroup('');
    if (activeSubTab === 'tam_tru' || activeSubTab === 'ho_tam_tru') {
      setFormStatus('Tạm trú');
    } else if (activeSubTab === 'tam_vang') {
      setFormStatus('Tạm vắng');
    } else if (activeSubTab === 'vang_lai') {
      setFormStatus('Vãng lai');
    } else {
      setFormStatus('Thường trú');
    }
    setFormPhone('');
    setFormOccupation('');
    setFormNote('');
    setFormClassifications([]);
    setIsAddModalOpen(true);
  };

  const openAddCoResidentModal = (h: Household) => {
    if (currentUserRole === 'User') {
      alert('⛔ Tài khoản của bạn chỉ có quyền xem và tra cứu nội dung. Không thể thực hiện thao tác này!');
      return;
    }
    setFormHouseholdId(h.id);
    setFormName('');
    setFormDob('15/08/1990');
    setFormGender('Nam');
    setFormIdCard('');
    setFormAddress(h.address);
    setFormGroup(h.neighborhoodGroup || 'Tổ dân phố 1');
    setCustomFormGroup('');
    setFormStatus(h.id.startsWith('htt') ? 'Tạm trú' : 'Thường trú');
    setFormPhone('');
    setFormOccupation('');
    setFormNote(`Nhân khẩu đồng cư trú của hộ chủ: ${h.ownerName}`);
    setFormClassifications([]);
    setIsAddModalOpen(true);
    setPreviewHousehold(null);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formIdCard.trim()) {
      alert('Vui lòng điền họ tên rành mạch và số CCCD đầy đủ');
      return;
    }
    const finalGroup = formGroup === 'Khác' ? (customFormGroup.trim() || 'Tổ dân phố khác') : formGroup;
    
    let householdId = formHouseholdId;
    if (!householdId) {
      const isTemp = formStatus === 'Tạm trú';
      const targetList = isTemp ? temporaryHouseholds : households;
      const matchedH = targetList.find(h => isSameAddress(h.address, formAddress));
      if (matchedH) {
        householdId = matchedH.id;
      } else {
        householdId = (isTemp ? 'htt_' : 'h_') + Date.now();
        const newH: Household = {
          id: householdId,
          ownerName: formName,
          idCard: formIdCard,
          address: formAddress || 'Chưa cập nhật',
          neighborhoodGroup: finalGroup,
          membersCount: 1,
          phone: formPhone || 'Chưa cập nhật'
        };
        if (isTemp) {
          setTemporaryHouseholds(prev => [newH, ...prev]);
        } else {
          setHouseholds(prev => [newH, ...prev]);
        }
      }
    }

    onAddResident({
      name: formName,
      dob: formDob,
      gender: formGender,
      idCard: formIdCard,
      address: formAddress || 'Chưa cập nhật',
      neighborhoodGroup: finalGroup,
      status: formStatus,
      phone: formPhone,
      occupation: formOccupation,
      note: formNote,
      classifications: formClassifications,
      householdId: householdId,
    });
    setIsAddModalOpen(false);
  };

  const openEditModal = (res: Resident) => {
    if (currentUserRole === 'User') {
      alert('⛔ Tài khoản của bạn chỉ có quyền xem và tra cứu nội dung. Không thể thực hiện thao tác này!');
      return;
    }
    setCurrentResident(res);
    setFormHouseholdId(res.householdId || '');
    setFormName(res.name);
    setFormDob(res.dob);
    setFormGender(res.gender);
    setFormIdCard(res.idCard);
    setFormAddress(res.address);
    if (dynamicNeighborhoodGroups.includes(res.neighborhoodGroup)) {
      setFormGroup(res.neighborhoodGroup);
      setCustomFormGroup('');
    } else {
      setFormGroup('Khác');
      setCustomFormGroup(res.neighborhoodGroup);
    }
    setFormStatus(res.status);
    setFormPhone(res.phone || '');
    setFormOccupation(res.occupation || '');
    setFormNote(res.note || '');
    setFormClassifications(res.classifications || []);
    setIsEditModalOpen(true);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentResident) return;
    const finalGroup = formGroup === 'Khác' ? (customFormGroup.trim() || 'Tổ dân phố khác') : formGroup;
    onUpdateResident({
      ...currentResident,
      name: formName,
      dob: formDob,
      gender: formGender,
      idCard: formIdCard,
      address: formAddress,
      neighborhoodGroup: finalGroup,
      status: formStatus,
      phone: formPhone,
      occupation: formOccupation,
      note: formNote,
      classifications: formClassifications,
      householdId: formHouseholdId || currentResident.householdId,
    });
    setIsEditModalOpen(false);
  };

  // ----------------- Household Handlers -----------------
  const startEditingHousehold = (h: Household) => {
    if (currentUserRole === 'User') {
      alert('⛔ Tài khoản của bạn chỉ có quyền xem và tra cứu nội dung. Không thể thực hiện thao tác này!');
      return;
    }
    setEditingHousehold(h);
    setEditHOwnerName(h.ownerName);
    setEditHIdCard(h.idCard);
    setEditHAddress(h.address);
    setEditHNeighborhoodGroup(h.neighborhoodGroup || 'Tổ dân phố 1');
    setEditHPhone(h.phone || '');
    setEditHSyncMembers(true);
    setEditHLat(h.lat ?? '');
    setEditHLng(h.lng ?? '');
  };

  const handleSaveHouseholdEdit = () => {
    if (!editingHousehold) return;
    if (!editHOwnerName.trim() || !editHAddress.trim() || !editHIdCard.trim()) {
      alert('Vui lòng điền đủ Họ tên chủ hộ, CCCD và địa chỉ số nhà');
      return;
    }

    const isTemp = temporaryHouseholds.some(h => h.id === editingHousehold.id);

    const updatedH: Household = {
      ...editingHousehold,
      ownerName: editHOwnerName,
      idCard: editHIdCard,
      address: editHAddress,
      neighborhoodGroup: editHNeighborhoodGroup,
      phone: editHPhone || 'Chưa cập nhật',
      lat: editHLat !== '' ? Number(editHLat) : undefined,
      lng: editHLng !== '' ? Number(editHLng) : undefined,
    };

    if (isTemp) {
      setTemporaryHouseholds(prev => prev.map(h => h.id === editingHousehold.id ? updatedH : h));
    } else {
      setHouseholds(prev => prev.map(h => h.id === editingHousehold.id ? updatedH : h));
    }

    // Sync elements
    if (editHSyncMembers) {
      residents.forEach((r) => {
        const isMatched = (r.householdId && editingHousehold.id && r.householdId === editingHousehold.id) || (() => {
          if (!r.address || !editingHousehold.address) return false;
          return isSameAddress(r.address, editingHousehold.address) || !!(r.idCard && editingHousehold.idCard && r.idCard === editingHousehold.idCard);
        })();

        if (isMatched) {
          let updatedName = r.name;
          const isOwner = (r.idCard && editingHousehold.idCard && r.idCard === editingHousehold.idCard) || 
                          r.name.toLowerCase().trim() === editingHousehold.ownerName.toLowerCase().trim();
          if (isOwner) {
            updatedName = editHOwnerName;
          }

          onUpdateResident({
            ...r,
            name: updatedName,
            address: editHAddress,
            neighborhoodGroup: editHNeighborhoodGroup,
          });
        }
      });
    }

    setEditingHousehold(null);
    alert('Cập nhật thông tin và đồng bộ hóa hộ gia đình thành công!');
  };

  const handleDeleteEntireHousehold = (id: string, hAddress: string, hIdCard: string, ownerName: string) => {
    const isTemp = temporaryHouseholds.some(h => h.id === id);
    if (isTemp) {
      setTemporaryHouseholds(prev => prev.filter(h => h.id !== id));
    } else {
      setHouseholds(prev => prev.filter(h => h.id !== id));
    }

    // Locate matching residents and delete
    let deletedMembersCount = 0;
    residents.forEach((r) => {
      const isMatched = (r.householdId && id && r.householdId === id) || (() => {
        if (!r.address || !hAddress) return false;
        return isSameAddress(r.address, hAddress) || !!(r.idCard && hIdCard && r.idCard === hIdCard);
      })();

      if (isMatched) {
        onDeleteResident(r.id);
        deletedMembersCount++;
      }
    });

    setEditingHousehold(null);
    alert(`Đã xóa vĩnh viễn sổ hộ khẩu của chủ hộ "${ownerName}" cùng ${deletedMembersCount} nhân khẩu đồng cư ra khỏi hệ thống!`);
  };

  const handleClearAllDataForTesting = () => {
    setIsClearAllConfirmOpen(true);
  };

  const confirmClearAllData = () => {
    // 1. Clear households in state and storage
    setHouseholds([]);
    localStorage.setItem('kp_households', JSON.stringify([]));

    // 2. Clear temporary households
    setTemporaryHouseholds([]);
    localStorage.setItem('kp_temporary_households', JSON.stringify([]));

    // 3. Clear residents database
    if (onClearAllResidents) {
      onClearAllResidents();
    } else {
      residents.forEach(r => onDeleteResident(r.id));
    }

    setIsClearAllConfirmOpen(false);
    alert("Đã xóa sạch toàn bộ cơ sở dữ liệu nhân khẩụ và sổ hộ khẩu thành công!");
  };

  const handleCreateHouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!houseOwner.trim() || !houseAddress.trim()) {
      alert('Họ tên chủ hộ và địa chỉ số nhà là phần bắt buộc');
      return;
    }
    const finalGroup = houseGroup === 'Khác' ? (customHouseGroup.trim() || 'Tổ dân phố khác') : houseGroup;
    const finalIdCard = houseIdCard || '079' + Math.floor(Math.random() * 900000000 + 100000000);
    const newHhid = 'h_' + (households.length + 1);
    const newH: Household = {
      id: newHhid,
      ownerName: houseOwner,
      idCard: finalIdCard,
      address: houseAddress,
      neighborhoodGroup: finalGroup,
      membersCount: 1,
      phone: housePhone || 'Chưa cập nhật',
      lat: houseLat !== '' ? Number(houseLat) : undefined,
      lng: houseLng !== '' ? Number(houseLng) : undefined,
    };
    setHouseholds([newH, ...households]);

    // Auto-create resident profile for the owner if not exists
    const ownerExists = residents.some(r => r.idCard === finalIdCard);
    if (!ownerExists) {
      onAddResident({
        name: houseOwner,
        dob: '01/01/1980',
        gender: 'Nam',
        idCard: finalIdCard,
        address: houseAddress,
        neighborhoodGroup: finalGroup,
        status: 'Thường trú',
        phone: housePhone || 'Chưa cập nhật',
        occupation: 'Chủ hộ gia đình',
        classifications: [],
        householdId: newHhid,
      });
    }

    setIsHouseOpen(false);
    // Clear forms
    setHouseOwner('');
    setHouseIdCard('');
    setHouseAddress('');
    setHousePhone('');
    setHouseGroup('Tổ dân phố 1');
    setCustomHouseGroup('');
    setHouseLat('');
    setHouseLng('');
  };

  const handleCreateTempHouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!houseOwner.trim() || !houseAddress.trim()) {
      alert('Họ tên chủ hộ tạm trú và địa chỉ số nhà là phần bắt buộc');
      return;
    }
    const finalGroup = houseGroup === 'Khác' ? (customHouseGroup.trim() || 'Tổ dân phố khác') : houseGroup;
    const finalIdCard = houseIdCard || '079' + Math.floor(Math.random() * 900000000 + 100000000);
    const newHhid = 'htt_' + (temporaryHouseholds.length + 1);
    const newH: Household = {
      id: newHhid,
      ownerName: houseOwner,
      idCard: finalIdCard,
      address: houseAddress,
      neighborhoodGroup: finalGroup,
      membersCount: 1,
      phone: housePhone || 'Chưa cập nhật',
      lat: houseLat !== '' ? Number(houseLat) : undefined,
      lng: houseLng !== '' ? Number(houseLng) : undefined,
    };
    setTemporaryHouseholds([newH, ...temporaryHouseholds]);

    // Auto-create resident profile for the owner if not exists
    const ownerExists = residents.some(r => r.idCard === finalIdCard);
    if (!ownerExists) {
      onAddResident({
        name: houseOwner,
        dob: '01/01/1980',
        gender: 'Nam',
        idCard: finalIdCard,
        address: houseAddress,
        neighborhoodGroup: finalGroup,
        status: 'Tạm trú',
        phone: housePhone || 'Chưa cập nhật',
        occupation: 'Chủ hộ tạm trú',
        classifications: [],
        householdId: newHhid,
      });
    }

    setIsTempHouseOpen(false);
    // Clear forms
    setHouseOwner('');
    setHouseIdCard('');
    setHouseAddress('');
    setHousePhone('');
    setHouseGroup('Tổ dân phố 1');
    setCustomHouseGroup('');
    setHouseLat('');
    setHouseLng('');
  };

  // Duplicate / Import deduplication simulation logic
  const handleImportDeduplication = () => {
    setImportStatus('loading');
    setTimeout(() => {
      if (importScenario === 'scenario_1') {
        // Trùng chủ hộ và trùng địa chỉ số nhà -> Gộp
        setImportStatus('merged');
        // Simulating the merge outcome message
        alert(`♻️ Đã gộp thành công! Phát hiện trùng: Chủ hộ "Nguyễn Văn Hùng" và cùng số nhà "123/45 An Phú". Hệ thống tự động gộp thành 1 hộ và cộng dồn số thành viên cư trú (2 thành viên ban đầu + 1 mới = 3 thành viên).`);
      } else {
        // Trùng số nhà nhưng khác chủ hộ -> 2 hộ riêng biệt
        const duplicateAddress = '123/45 An Phú, Phường An Phú, Thành Phố Hồ Chí Minh';
        const newHousehold: Household = {
          id: 'h_dup_' + Date.now(),
          ownerName: 'Phạm Huỳnh Long (Đồng cư trú)',
          idCard: '079201004999',
          address: duplicateAddress,
          neighborhoodGroup: 'Tổ dân phố 1',
          membersCount: 1,
          phone: '0933111222',
        };
        setHouseholds(prev => [newHousehold, ...prev]);
        setImportStatus('split');
        alert(`ℹ️ Trùng số nhà nhưng Khác chủ hộ! Trùng số nhà "123/45 An Phú" nhưng có chủ hộ mới là "Phạm Huỳnh Long". Hệ thống thành lập 2 hộ riêng biệt độc lập có cùng địa cư.`);
      }
      setImportModalOpen(false);
    }, 1500);
  };



  // Categorized Organizations lists for quick integration drop-downs and checkboxes
  const residentCodeList = previewResident ? (previewResident.classifications || []) : [];

  // 1. Chi bộ (Hệ thống Đảng)
  const chiBoOrgs = (organizations || []).filter(o => {
    if (o.is_deleted || !o.is_active) return false;
    const catId = o.category_id;
    const code = o.code || '';
    return catId === 'cat_1' || ['dang_vien', 'dang_vien_213', 'dang_vien_du_bi', 'cam_tinh_dang'].includes(code);
  });
  const chiBoSelectedCount = chiBoOrgs.filter(o => residentCodeList.includes(o.code || o.id)).length;

  // 2. Chính quyền
  const chinhQuyenOrgs = (organizations || []).filter(o => {
    if (o.is_deleted || !o.is_active) return false;
    const catId = o.category_id;
    const code = o.code || '';
    return catId === 'cat_2' || ['ban_dieu_hanh', 'antt_co_so', 'khu_doi', 'to_cong_nghe_so', 'cong_tac_vien'].includes(code);
  });
  const chinhQuyenSelectedCount = chinhQuyenOrgs.filter(o => residentCodeList.includes(o.code || o.id)).length;

  // 3. Đoàn thể
  const doanTheOrgs = (organizations || []).filter(o => {
    if (o.is_deleted || !o.is_active) return false;
    const catId = o.category_id;
    const code = o.code || '';
    return ['ban_cong_tac', 'phu_nu', 'thanh_nien', 'cuu_chien_binh', 'chu_thap_do'].includes(code) || 
           ['cat_3', 'cat_4', 'cat_5', 'cat_6', 'cat_7', 'cat_8', 'cat_9'].includes(catId);
  });
  const doanTheSelectedCount = doanTheOrgs.filter(o => residentCodeList.includes(o.code || o.id)).length;

  // 4. Diện chính sách
  const csOrgs = (organizations || []).filter(o => {
    if (o.is_deleted || !o.is_active) return false;
    const catId = o.category_id;
    const code = o.code || '';
    return ['nguoi_co_cong', 'gia_dinh_liet_si', 'ho_ngheo', 'ho_can_ngheo', 'nguoi_cao_tuoi_cs', 'nguoi_khuyet_tat', 'bao_tro_xa_hoi', 'tre_em', 'kho_khan'].includes(code) || 
           catId === 'cat_10';
  });
  const csSelectedCount = csOrgs.filter(o => residentCodeList.includes(o.code || o.id)).length;

  // 5. Nhóm khác
  const otherOrgs = (organizations || []).filter(o => {
    if (o.is_deleted || !o.is_active) return false;
    const catId = o.category_id;
    const code = o.code || '';
    
    const isChiBo = catId === 'cat_1' || ['dang_vien', 'dang_vien_213', 'dang_vien_du_bi', 'cam_tinh_dang'].includes(code);
    const isChinhQuyen = catId === 'cat_2' || ['ban_dieu_hanh', 'antt_co_so', 'khu_doi', 'to_cong_nghe_so', 'cong_tac_vien'].includes(code);
    const isDoanThe = ['ban_cong_tac', 'phu_nu', 'thanh_nien', 'cuu_chien_binh', 'chu_thap_do'].includes(code) || ['cat_3', 'cat_4', 'cat_5', 'cat_6', 'cat_7', 'cat_8', 'cat_9'].includes(catId);
    const isChinhSach = ['nguoi_co_cong', 'gia_dinh_liet_si', 'ho_ngheo', 'ho_can_ngheo', 'nguoi_cao_tuoi_cs', 'nguoi_khuyet_tat', 'bao_tro_xa_hoi', 'tre_em', 'kho_khan'].includes(code) || catId === 'cat_10';
    
    return !isChiBo && !isChinhQuyen && !isDoanThe && !isChinhSach;
  });
  const otherSelectedCount = otherOrgs.filter(o => residentCodeList.includes(o.code || o.id)).length;

  return (
    <div className="space-y-6">
      {/* Test Clean Slate Control Banner */}
      {currentUserRole === 'Super Admin' && (
        <div className="bg-red-50/40 border border-slate-200/80 px-4 py-3 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-base select-none">⚙️</span>
            <div>
              <h4 className="font-bold text-red-900 text-[11px] uppercase tracking-wide">Cung cụ thử nghiệm hệ thống (Ban điều hành)</h4>
              <p className="text-[10px] text-slate-550 font-semibold leading-relaxed">Sử dụng nút dưới đây để xóa sạch toàn bộ các dữ liệu mẫu nhằm nạp dữ liệu thật của bạn phục vụ chạy thử.</p>
            </div>
          </div>
          <button
            onClick={handleClearAllDataForTesting}
            className="py-1.5 px-3.5 bg-red-650 hover:bg-red-700 text-white font-black text-[10.5px] tracking-wide rounded-xl cursor-pointer transition-all flex items-center gap-1.5 uppercase shadow-sm shrink-0 border border-red-300"
          >
            <Trash className="w-3.5 h-3.5" />
            <span>XÓA SẠCH TOÀN BỘ CƯ DÂN & HỘ KHẨU</span>
          </button>
        </div>
      )}

      {activeSubTab === 'ho_khau' ? (
        <React.Fragment>
          {/* Household management layout card controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-205 p-5 rounded-2xl shadow-sm">
            <div>
              <h3 className="font-bold text-sm text-slate-800 font-sans uppercase">Phân viện quản lý hộ gia đình</h3>
              <p className="text-xs text-slate-550 mt-0.5">Sáp nhập tách hộ tự dệt đồng bộ theo số nhà Trần Não, Lương Định Của</p>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto items-center">
              <ViewModeSwitcher viewMode={viewMode} onViewModeChange={onViewModeChange} />
              {(currentUserRole === 'Super Admin' || currentUserRole === 'Admin') && (
                <button
                  onClick={() => exportToExcel('ho_khau')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow transition-all cursor-pointer"
                  title="Xuất cơ sở dữ liệu thường trú ra file Excel"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>XUẤT EXCEL</span>
                </button>
              )}
              {currentUserRole !== 'User' && (
                <>
                  <button
                    onClick={() => setIsHouseOpen(true)}
                    className="px-4 py-2 bg-blue-800 hover:bg-blue-700 font-bold text-xs text-white rounded-xl shadow transition-all cursor-pointer"
                  >
                    + KHAI SINH HỘ MỚI
                  </button>
                  <button
                    onClick={() => {
                      setSelectedFiles([]);
                      setImportStep(1);
                      setUploadParsedData([]);
                      setUploadErrorMsg(null);
                      const actSub = activeSubTab as string;
                      if (actSub === 'tam_tru' || actSub === 'ho_tam_tru') {
                        setImportDataType('tam_tru');
                      } else if (actSub === 'nhan_khau' || actSub === 'ho_khau') {
                        setImportDataType('nhan_khau');
                      } else {
                        setImportDataType('auto');
                      }
                      setIsImportFileOpen(true);
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-705 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>NHẬP TỪ FILE</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <DataView<Household>
            viewMode={viewMode}
            items={paginatedHouseholds}
            emptyMessage="Không tìm thấy hộ gia đình nào."
            renderCard={(h) => (
              <div key={h.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{h.ownerName}</h4>
                      <span className="text-[10px] text-slate-400 font-bold tracking-wider font-mono">HỘ: {h.id}</span>
                    </div>
                    <span className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center text-xs font-bold font-sans">🏠</span>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-slate-600 flex justify-between">
                      <span className="text-slate-400 font-bold">Địa chỉ:</span>
                      <span className="text-slate-800 font-medium truncate max-w-[170px]">{h.address}</span>
                    </p>
                    <p className="text-slate-650 flex justify-between">
                      <span className="text-slate-400 font-bold">Số điện thoại:</span>
                      <strong className="text-slate-900 font-mono italic">{h.phone}</strong>
                    </p>
                    <p className="text-slate-650 flex justify-between">
                      <span className="text-slate-400 font-bold">Mã số CCCD:</span>
                      <span className="text-slate-650 font-mono tracking-wider font-semibold">{h.idCard}</span>
                    </p>
                    {h.lat !== undefined && h.lng !== undefined && (
                      <p className="text-slate-650 flex justify-between">
                        <span className="text-slate-400 font-bold">Địa chỉ số (GPS):</span>
                        <span className="text-emerald-700 font-mono font-semibold">{h.lat.toFixed(6)}, {h.lng.toFixed(6)}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-800 font-bold text-[9.5px] rounded-lg">
                    {getDynamicMembersCount(h)} nhân khẩu đồng cư
                  </span>
                  <div className="flex gap-1 opacity-80 hover:opacity-100">
                    {h.lat !== undefined && h.lng !== undefined && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&origin=My+Location&destination=${h.lat},${h.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center hover:bg-emerald-50 rounded-lg text-emerald-600 cursor-pointer transition-colors"
                        title="Dẫn đường qua Google Maps"
                      >
                        <Navigation className="w-4 h-4 rotate-45" />
                      </a>
                    )}
                    <button
                      onClick={() => setPreviewHousehold(h)}
                      className="w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg text-blue-700 cursor-pointer transition-colors"
                      title="Xem trước sổ hộ khẩu"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {currentUserRole !== 'User' && (
                      <>
                        <button
                          onClick={() => startEditingHousehold(h)}
                          className="w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg text-amber-600 cursor-pointer transition-colors"
                          title="Sửa sổ hộ khẩu"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setDeleteConfirm({
                              type: 'household',
                              id: h.id,
                              title: 'Xóa Sổ Hộ Khẩu',
                              message: `Bạn có chắc chắn muốn xóa hồ sơ hộ khẩu thường trú của chủ hộ "${h.ownerName}" khỏi hệ thống không? Toàn bộ các thông tin lưu trữ liên quan sẽ bị tháo gỡ.`
                            });
                          }}
                          className="w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg text-red-500 cursor-pointer transition-colors"
                          title="Xóa hộ khẩu"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
            renderTable={(items) => (
              <table className="w-full min-w-[750px] text-left border-collapse text-xs font-sans">
                <thead className="bg-[#f8f9ff]/80">
                  <tr>
                    <th className="px-6 py-4 font-bold text-slate-500 border-b border-slate-205">Mã Hộ</th>
                    <th className="px-6 py-4 font-bold text-slate-500 border-b border-slate-205">Tên Chủ Hộ</th>
                    <th className="px-6 py-4 font-bold text-slate-500 border-b border-slate-205">Mã số CCCD</th>
                    <th className="px-6 py-4 font-bold text-slate-500 border-b border-slate-205">Điện thoại</th>
                    <th className="px-6 py-4 font-bold text-slate-500 border-b border-slate-205">Địa chỉ cư trú</th>
                    <th className="px-6 py-4 font-bold text-slate-500 border-b border-slate-205 text-center">Số thành viên</th>
                    <th className="px-6 py-4 font-bold text-slate-500 border-b border-slate-205 text-right">Quản lý</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {items.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-slate-505 font-mono font-bold">#{h.id}</td>
                      <td className="px-6 py-4 text-slate-900 font-semibold">{h.ownerName}</td>
                      <td className="px-6 py-4 text-slate-650 font-mono tracking-wider font-semibold">{h.idCard}</td>
                      <td className="px-6 py-4 text-slate-800 font-mono">{h.phone || 'Chưa cập nhật'}</td>
                      <td className="px-6 py-4 text-slate-600 truncate max-w-xs">{h.address}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2.5 py-1 bg-blue-50 text-blue-800 font-bold rounded-lg">
                          {getDynamicMembersCount(h)} nhân khẩu
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1.5 shrink-0 ml-auto max-w-[160px]">
                          {h.lat !== undefined && h.lng !== undefined && (
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&origin=My+Location&destination=${h.lat},${h.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-8 h-8 flex items-center justify-center hover:bg-emerald-50 rounded-lg text-emerald-600 cursor-pointer transition-colors"
                              title="Dẫn đường qua Google Maps"
                            >
                              <Navigation className="w-4 h-4 rotate-45" />
                            </a>
                          )}
                          <button
                            onClick={() => setPreviewHousehold(h)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg text-blue-700 cursor-pointer transition-colors"
                            title="Xem trước sổ hộ khẩu"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {currentUserRole !== 'User' && (
                            <>
                              <button
                                onClick={() => startEditingHousehold(h)}
                                className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg text-amber-600 cursor-pointer transition-colors"
                                title="Sửa sổ hộ khẩu"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setDeleteConfirm({
                                    type: 'household',
                                    id: h.id,
                                    title: 'Xóa Sổ Hộ Khẩu',
                                    message: `Bạn có chắc chắn muốn xóa hồ sơ hộ khẩu thường trú của chủ hộ "${h.ownerName}" khỏi hệ thống không?`
                                  });
                                }}
                                className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg text-red-500 cursor-pointer transition-colors"
                                title="Xóa hộ"
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          />

          {/* Pagination footer for households */}
          {households.length > itemsPerPage && (
            <div className="px-6 py-4 mt-4 flex flex-col sm:flex-row gap-4 items-center justify-between border border-slate-200 bg-[#f8f9ff]/35 rounded-2xl shadow-sm">
              <p className="text-slate-505 font-medium text-center sm:text-left text-sm">
                Đang hiển thị <span className="font-bold text-slate-900">{households.length === 0 ? 0 : (householdsPage - 1) * itemsPerPage + 1} - {Math.min(households.length, householdsPage * itemsPerPage)}</span> trên <span className="font-bold text-slate-900">{households.length}</span> hộ khẩu
              </p>

              <div className="flex gap-2 flex-wrap items-center justify-center">
                <button
                  type="button"
                  onClick={() => setHouseholdsPage(Math.max(householdsPage - 1, 1))}
                  disabled={householdsPage === 1}
                  className="px-3 h-8 flex items-center justify-center gap-1 rounded-lg border border-slate-250 text-xs font-semibold bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-700 cursor-pointer shadow-sm transition-all"
                >
                  ◀ Lùi lại
                </button>
                {getVisiblePages(householdsPage, totalPagesHouseholds).map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setHouseholdsPage(pageNum)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold ${
                      householdsPage === pageNum ? 'bg-blue-800 text-white shadow' : 'text-slate-650 hover:bg-slate-105 bg-white border border-slate-200'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setHouseholdsPage(Math.min(householdsPage + 1, totalPagesHouseholds))}
                  disabled={householdsPage === totalPagesHouseholds}
                  className="px-3 h-8 flex items-center justify-center gap-1 rounded-lg border border-slate-250 text-xs font-semibold bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-700 cursor-pointer shadow-sm transition-all"
                >
                  Tiếp theo ▶
                </button>
              </div>
            </div>
          )}
        </React.Fragment>
      ) : activeSubTab === 'ho_tam_tru' ? (
        <React.Fragment>
          {/* Household management layout card controls (Tạm trú) */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-205 p-5 rounded-2xl shadow-sm">
            <div>
              <h3 className="font-bold text-sm text-slate-800 font-sans uppercase">Phân viện quản lý hộ tạm trú</h3>
              <p className="text-xs text-slate-550 mt-0.5">Khai báo hồ sơ hộ tạm trú (KT3, KT4) lưu trú tạm thời trên địa bàn khu phố</p>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto items-center">
              <ViewModeSwitcher viewMode={viewMode} onViewModeChange={onViewModeChange} />
              {(currentUserRole === 'Super Admin' || currentUserRole === 'Admin') && (
                <button
                  onClick={() => exportToExcel('ho_tam_tru')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow transition-all cursor-pointer"
                  title="Xuất cơ sở dữ liệu tạm trú ra file Excel"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>XUẤT EXCEL</span>
                </button>
              )}
              {currentUserRole !== 'User' && (
                <button
                  onClick={() => setIsTempHouseOpen(true)}
                  className="px-4 py-2 bg-indigo-700 hover:bg-indigo-600 font-bold text-xs text-white rounded-xl shadow transition-all cursor-pointer"
                >
                  + KHAI BÁO HỘ TẠM TRÚ
                </button>
              )}
            </div>
          </div>

          <DataView<Household>
            viewMode={viewMode}
            items={paginatedTempHouseholds}
            emptyMessage="Không tìm thấy hộ tạm trú nào."
            renderCard={(h) => (
              <div key={h.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{h.ownerName}</h4>
                      <span className="text-[10px] text-indigo-550 font-bold tracking-wider font-mono">HỘ TẠM TRÚ: {h.id}</span>
                    </div>
                    <span className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center text-xs font-bold font-sans animate-fade">🏠</span>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-slate-600 flex justify-between">
                      <span className="text-slate-400 font-bold">Địa chỉ:</span>
                      <span className="text-slate-800 font-medium truncate max-w-[170px]">{h.address}</span>
                    </p>
                    <p className="text-slate-650 flex justify-between">
                      <span className="text-slate-400 font-bold">Số điện thoại:</span>
                      <strong className="text-slate-900 font-mono italic">{h.phone}</strong>
                    </p>
                    <p className="text-slate-650 flex justify-between">
                      <span className="text-slate-400 font-bold">Căn cước chủ hộ:</span>
                      <span className="text-slate-650 font-mono tracking-wider font-semibold">{h.idCard}</span>
                    </p>
                    {h.lat !== undefined && h.lng !== undefined && (
                      <p className="text-slate-650 flex justify-between">
                        <span className="text-slate-400 font-bold">Địa chỉ số (GPS):</span>
                        <span className="text-[#3b82f6] font-mono font-semibold">{h.lat.toFixed(6)}, {h.lng.toFixed(6)}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 font-bold text-[9.5px] rounded-lg">
                    {getDynamicMembersCount(h)} nhân khẩu tạm cư
                  </span>
                  <div className="flex gap-1 opacity-80 hover:opacity-100">
                    {h.lat !== undefined && h.lng !== undefined && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&origin=My+Location&destination=${h.lat},${h.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center hover:bg-emerald-50 rounded-lg text-emerald-600 cursor-pointer transition-colors"
                        title="Dẫn đường qua Google Maps"
                      >
                        <Navigation className="w-4 h-4 rotate-45" />
                      </a>
                    )}
                    <button
                      onClick={() => setPreviewHousehold(h)}
                      className="w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg text-indigo-700 cursor-pointer transition-colors"
                      title="Xem trước hộ tạm trú"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {currentUserRole !== 'User' && (
                      <>
                        <button
                          onClick={() => startEditingHousehold(h)}
                          className="w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg text-amber-600 cursor-pointer transition-colors"
                          title="Sửa hộ tạm trú"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setDeleteConfirm({
                              type: 'temp_household',
                              id: h.id,
                              title: 'Xóa Sổ Hộ Tạm Trú',
                              message: `Bạn có chắc chắn muốn xóa hồ sơ hộ tạm trú của chủ hộ "${h.ownerName}" khỏi hệ thống không?`
                            });
                          }}
                          className="w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg text-red-500 cursor-pointer transition-colors"
                          title="Xóa hộ tạm trú"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
            renderTable={(items) => (
              <table className="w-full min-w-[750px] text-left border-collapse text-xs font-sans">
                <thead className="bg-[#f8f9ff]/80">
                  <tr>
                    <th className="px-6 py-4 font-bold text-slate-500 border-b border-slate-205">Mã Hộ Tạm Trú</th>
                    <th className="px-6 py-4 font-bold text-slate-500 border-b border-slate-205">Tên Chủ Hộ</th>
                    <th className="px-6 py-4 font-bold text-slate-500 border-b border-slate-205">Căn cước chủ hộ</th>
                    <th className="px-6 py-4 font-bold text-slate-500 border-b border-slate-205">Điện thoại</th>
                    <th className="px-6 py-4 font-bold text-slate-500 border-b border-slate-205">Địa chỉ tạm trú</th>
                    <th className="px-6 py-4 font-bold text-slate-500 border-b border-slate-205 text-center">Số thành viên</th>
                    <th className="px-6 py-4 font-bold text-slate-500 border-b border-slate-205 text-right">Quản lý</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {items.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-indigo-505 font-mono font-bold">#{h.id}</td>
                      <td className="px-6 py-4 text-slate-900 font-semibold">{h.ownerName}</td>
                      <td className="px-6 py-4 text-slate-650 font-mono tracking-wider font-semibold">{h.idCard}</td>
                      <td className="px-6 py-4 text-slate-800 font-mono">{h.phone || 'Chưa cập nhật'}</td>
                      <td className="px-6 py-4 text-slate-600 truncate max-w-xs">{h.address}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 font-bold rounded-lg">
                          {getDynamicMembersCount(h)} nhân khẩu
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1.5 shrink-0 ml-auto max-w-[160px]">
                          {h.lat !== undefined && h.lng !== undefined && (
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&origin=My+Location&destination=${h.lat},${h.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-8 h-8 flex items-center justify-center hover:bg-emerald-50 rounded-lg text-emerald-600 cursor-pointer transition-colors"
                              title="Dẫn đường qua Google Maps"
                            >
                              <Navigation className="w-4 h-4 rotate-45" />
                            </a>
                          )}
                          <button
                            onClick={() => setPreviewHousehold(h)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg text-indigo-700 cursor-pointer transition-colors"
                            title="Xem trước sổ hộ tạm trú"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {currentUserRole !== 'User' && (
                            <>
                              <button
                                onClick={() => startEditingHousehold(h)}
                                className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg text-amber-600 cursor-pointer transition-colors"
                                title="Sửa hộ tạm trú"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setDeleteConfirm({
                                    type: 'temp_household',
                                    id: h.id,
                                    title: 'Xóa Sổ Hộ Tạm Trú',
                                    message: `Bạn có chắc chắn muốn xóa hồ sơ hộ tạm trú của chủ hộ "${h.ownerName}" khỏi hệ thống không?`
                                  });
                                }}
                                className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg text-red-500 cursor-pointer transition-colors"
                                title="Xóa hộ tạm trú"
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          />

          {/* Pagination footer for temporary households */}
          {temporaryHouseholds.length > itemsPerPage && (
            <div className="px-6 py-4 mt-4 flex flex-col sm:flex-row gap-4 items-center justify-between border border-slate-200 bg-[#f8f9ff]/35 rounded-2xl shadow-sm">
              <p className="text-slate-505 font-medium text-center sm:text-left text-sm">
                Đang hiển thị <span className="font-bold text-slate-900">{temporaryHouseholds.length === 0 ? 0 : (tempHouseholdsPage - 1) * itemsPerPage + 1} - {Math.min(temporaryHouseholds.length, tempHouseholdsPage * itemsPerPage)}</span> trên <span className="font-bold text-slate-900">{temporaryHouseholds.length}</span> hộ tạm trú
              </p>

              <div className="flex gap-2 flex-wrap items-center justify-center">
                <button
                  type="button"
                  onClick={() => setTempHouseholdsPage(Math.max(tempHouseholdsPage - 1, 1))}
                  disabled={tempHouseholdsPage === 1}
                  className="px-3 h-8 flex items-center justify-center gap-1 rounded-lg border border-slate-250 text-xs font-semibold bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-700 cursor-pointer shadow-sm transition-all"
                >
                  ◀ Lùi lại
                </button>
                {getVisiblePages(tempHouseholdsPage, totalPagesTempHouseholds).map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setTempHouseholdsPage(pageNum)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold ${
                      tempHouseholdsPage === pageNum ? 'bg-blue-800 text-white shadow' : 'text-slate-650 hover:bg-slate-105 bg-white border border-slate-200'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setTempHouseholdsPage(Math.min(tempHouseholdsPage + 1, totalPagesTempHouseholds))}
                  disabled={tempHouseholdsPage === totalPagesTempHouseholds}
                  className="px-3 h-8 flex items-center justify-center gap-1 rounded-lg border border-slate-250 text-xs font-semibold bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-700 cursor-pointer shadow-sm transition-all"
                >
                  Tiếp theo ▶
                </button>
              </div>
            </div>
          )}
        </React.Fragment>
      ) : (
        <React.Fragment>
          {/* Main Resident grid controls */}
          <section className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between bg-white border border-slate-200 px-5 py-4 rounded-xl shadow-sm">
            <div className="flex flex-wrap gap-2.5 items-center w-full sm:w-auto">
              <select
                value={selectedGroup}
                onChange={(e) => { setSelectedGroup(e.target.value); setCurrentPage(1); }}
                className="w-full sm:w-auto bg-slate-100 border-none rounded-lg px-2.5 py-1.5 text-xs font-bold cursor-pointer focus:outline-none"
              >
                <option value="Tất cả Tổ dân phố">Tất cả Tổ dân phố</option>
                {dynamicNeighborhoodGroups.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>

              <select
                value={selectedAge}
                onChange={(e) => { setSelectedAge(e.target.value); setCurrentPage(1); }}
                className="w-full sm:w-auto bg-slate-100 border-none rounded-lg px-2.5 py-1.5 text-xs font-bold cursor-pointer"
              >
                <option>Độ tuổi: Tất cả</option>
                <option>Trẻ em (0-15)</option>
                <option>Thanh niên (16-35)</option>
                <option>Trung niên (36-60)</option>
                <option>Người già (&gt;60)</option>
              </select>

              <span className="text-[10.5px] font-extrabold uppercase text-slate-600 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-150 select-none shrink-0 tracking-wide font-sans">
                📌 {activeSubTab === 'nhan_khau' ? 'Thường trú' : activeSubTab === 'tam_tru' ? 'Tạm trú' : activeSubTab === 'tam_vang' ? 'Tạm vắng' : 'Vãng lai'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto justify-end">
              {(currentUserRole === 'Super Admin' || currentUserRole === 'Admin') && (
                <button
                  onClick={() => exportToExcel(activeSubTab as any)}
                  className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer w-full sm:w-auto"
                  title="Xuất danh sách nhân khẩu hiện tại ra tệp tin Excel"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>XUẤT EXCEL</span>
                </button>
              )}

              {currentUserRole !== 'User' && (
                <>
                  <button
                    onClick={() => {
                      setSelectedFiles([]);
                      setImportStep(1);
                      setUploadParsedData([]);
                      setUploadErrorMsg(null);
                      const actSub = activeSubTab as string;
                      if (actSub === 'tam_tru' || actSub === 'ho_tam_tru') {
                        setImportDataType('tam_tru');
                      } else if (actSub === 'nhan_khau' || actSub === 'ho_khau') {
                        setImportDataType('nhan_khau');
                      } else {
                        setImportDataType('auto');
                      }
                      setIsImportFileOpen(true);
                    }}
                    className="py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 text-emerald-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer w-full sm:w-auto"
                    title="Tải tệp dữ liệu cư dân định dạng JSON hoặc CSV từ bên ngoài vào hệ thống"
                  >
                    <Upload className="w-4 h-4 text-emerald-650" />
                    <span>NHẬP TỆP DÂN CƯ</span>
                  </button>

                  <button
                    onClick={openAddModal}
                    className="py-2.5 px-5 bg-blue-800 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer flex items-center justify-center gap-1.5 w-full sm:w-auto"
                  >
                    <Plus className="w-4 h-4" />
                    <span>THÊM CƯ DÂN</span>
                  </button>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 w-full sm:w-auto border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0">
              <ViewModeSwitcher viewMode={viewMode} onViewModeChange={onViewModeChange} />
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm p-4 animate-fadeIn">
            <DataView<Resident>
              viewMode={viewMode}
              items={paginatedResidents}
              emptyMessage="Không tìm thấy cư dân nào khớp bộ lọc."
              renderCard={(res, rIdx) => {
                const isMale = res.gender === 'Nam';
                return (
                  <div key={`${res.id}-${rIdx}-${res.idCard}`} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between font-sans text-xs min-h-[220px]">
                    <div className="space-y-3">
                      {/* Avatar and status banner */}
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                            isMale ? 'bg-blue-50 text-blue-808' : 'bg-pink-50 text-pink-700'
                          }`}>
                            {isMale ? '👤' : '👩'}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm">{res.name}</h4>
                            <p className="text-[10px] text-slate-400 font-bold tracking-wider font-mono">ID: {res.id}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 text-[9px] font-bold rounded-lg border shrink-0 ${
                          res.status === 'Thường trú' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' :
                          res.status === 'Tạm trú' ? 'bg-blue-50 text-blue-805 border-blue-100' :
                          res.status === 'Tạm vắng' ? 'bg-amber-50 text-amber-805 border-amber-100' :
                          res.status === 'Vãng lai' ? 'bg-purple-50 text-purple-800 border-purple-100' :
                          'bg-red-50 text-red-750 border-red-100'
                        }`}>
                          {res.status}
                        </span>
                      </div>

                      {/* Info list */}
                      <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-bold text-[9.5px]">NGÀY SINH:</span>
                          <span className="text-slate-700 font-semibold">{res.dob}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-bold text-[9.5px]">GIỚI TÍNH:</span>
                          <span className="text-slate-700 font-bold">{res.gender}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-bold text-[9.5px]">SỐ CCCD:</span>
                          <span className="text-slate-705 font-mono font-semibold">{res.idCard}</span>
                        </div>
                        <div className="flex flex-col pt-1 border-t border-slate-100 mt-1">
                          <span className="text-slate-400 font-bold text-[9.5px]">ĐỊA CHỈ:</span>
                          <span className="text-slate-700 font-medium truncate mt-0.5" title={res.address}>{res.address}</span>
                        </div>
                      </div>

                      {/* Tags */}
                      {res.classifications && res.classifications.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mt-1.5">
                          {res.classifications.map((tagCode) => {
                            const matchingOrg = (organizations || []).find(o => o.code === tagCode || o.id === tagCode);
                            if (!matchingOrg) return null;
                            const spec = getCompactTagSpecs(tagCode, matchingOrg.name);
                            return (
                              <span
                                key={tagCode}
                                title={`${matchingOrg.name} (${matchingOrg.description || ''})`}
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-extrabold border shadow-sm transition-all cursor-help ${spec.bg}`}
                              >
                                <span className="text-[10px]">{spec.icon}</span>
                                <span>{spec.shortName}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between font-sans">
                      <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold font-mono">
                        {res.neighborhoodGroup || 'CHƯA PHÂN TỔ'}
                      </span>
                      <div className="flex gap-1">
                        <button 
                          type="button"
                          onClick={() => setPreviewResident(res)} 
                          className="w-8 h-8 flex items-center justify-center text-blue-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors border border-slate-205"
                          title="Xem trước hồ sơ"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {currentUserRole !== 'User' && (
                          <button 
                            type="button"
                            onClick={() => openEditModal(res)} 
                            className="w-8 h-8 flex items-center justify-center text-slate-505 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors border border-slate-200"
                            title="Sửa"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {currentUserRole !== 'User' && (
                          <button 
                            type="button"
                            onClick={() => {
                              setDeleteConfirm({
                                type: 'resident',
                                id: res.id,
                                title: 'Xóa Hồ Sơ Nhân Khẩu',
                                message: `Bạn có chắc chắn muốn xóa hồ sơ nhân khẩu thường trú của ông/bà "${res.name}" khỏi cơ sở dữ liệu của khu phố không?`
                              });
                            }} 
                            className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 hover:border-red-200 rounded-lg cursor-pointer transition-colors border border-transparent"
                            title="Xóa"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }}
              renderTable={(items) => (
                <div className="overflow-x-auto w-full">
                  <table className="w-full min-w-[850px] text-left border-collapse text-xs font-sans">
                    <thead className="bg-[#f8f9ff]/80 font-bold">
                      <tr>
                        <th className="px-6 py-4 font-bold text-slate-500 border-b border-slate-200">Họ và Tên</th>
                        <th className="px-6 py-4 font-bold text-slate-500 border-b border-slate-200">Ngày sinh</th>
                        <th className="px-6 py-4 font-bold text-slate-500 border-b border-slate-200">Giới tính</th>
                        <th className="px-6 py-4 font-bold text-slate-500 border-b border-slate-200">Số CCCD</th>
                        <th className="px-6 py-4 font-bold text-slate-500 border-b border-slate-200">Địa chỉ cư trú</th>
                        <th className="px-6 py-4 font-bold text-slate-500 border-b border-slate-200">Trạng thái</th>
                        <th className="px-6 py-4 font-bold text-slate-500 border-b border-slate-200 text-right">Quản lý</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {items.map((res, idx) => (
                        <tr key={`${res.id}-${idx}-${res.idCard}`} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 animate-fadeIn">
                            <strong className="text-slate-900 block font-semibold">{res.name}</strong>
                            <div className="flex flex-wrap items-center gap-1 mt-1 text-[10px] font-bold">
                              <span className="text-slate-400 uppercase tracking-wide mr-1.5">{res.neighborhoodGroup}</span>
                              {res.classifications && res.classifications.length > 0 && res.classifications.map((tagCode) => {
                                const matchingOrg = (organizations || []).find(o => o.code === tagCode || o.id === tagCode);
                                if (!matchingOrg) return null;
                                const spec = getCompactTagSpecs(tagCode, matchingOrg.name);
                                return (
                                  <span
                                    key={tagCode}
                                    title={`${matchingOrg.name} (${matchingOrg.description || ''})`}
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-extrabold border shadow-sm transition-all cursor-help ${spec.bg}`}
                                  >
                                    <span className="text-[10px]">{spec.icon}</span>
                                    <span>{spec.shortName}</span>
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-600 font-medium">{res.dob}</td>
                          <td className="px-6 py-4 text-slate-500 font-bold">{res.gender}</td>
                          <td className="px-6 py-4 text-slate-655 font-mono tracking-wider font-semibold">{res.idCard}</td>
                          <td className="px-6 py-4 text-slate-550 font-medium truncate max-w-xs">{res.address}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 text-[9px] font-bold rounded-lg border ${
                              res.status === 'Thường trú' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' :
                              res.status === 'Tạm trú' ? 'bg-blue-50 text-blue-805 border-blue-100' :
                              res.status === 'Tạm vắng' ? 'bg-amber-50 text-amber-855 border-amber-100' :
                              res.status === 'Vãng lai' ? 'bg-purple-50 text-purple-800 border-purple-100' :
                              'bg-red-50 text-red-750 border-red-100'
                            }`}>
                              {res.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-1 shrink-0">
                              <button 
                                onClick={() => setPreviewResident(res)} 
                                className="w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center text-blue-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                                title="Xem trước hồ sơ"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {currentUserRole !== 'User' && (
                                <button 
                                  onClick={() => openEditModal(res)} 
                                  className="w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center text-slate-505 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                                  title="Sửa"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              )}
                              {currentUserRole !== 'User' && (
                                <button 
                                  onClick={() => {
                                    setDeleteConfirm({
                                      type: 'resident',
                                      id: res.id,
                                      title: 'Xóa Hồ Sơ Nhân Khẩu',
                                      message: `Bạn có chắc chắn muốn xóa hồ sơ nhân khẩu thường trú của ông/bà "${res.name}" khỏi cơ sở dữ liệu của khu phố không?`
                                    });
                                  }} 
                                  className="w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition-colors animate-fadeIn"
                                  title="Xóa"
                                >
                                  <Trash className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            />
          </section>

            {/* Pagination footer */}
            <div className="px-6 py-4 flex flex-col sm:flex-row gap-4 items-center justify-between border-t border-slate-200 bg-[#f8f9ff]/35">
              <p className="text-slate-500 font-medium text-center sm:text-left text-sm">
                Đang hiển thị <span className="font-bold text-slate-900">{filteredResidents.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} - {(currentPage - 1) * itemsPerPage + paginatedResidents.length}</span> trên <span className="font-bold text-slate-900">{filteredResidents.length}</span> kết quả
              </p>

              <div className="flex gap-2 flex-wrap items-center justify-center">
                <button
                  type="button"
                  onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 h-8 flex items-center justify-center gap-1 rounded-lg border border-slate-250 text-xs font-semibold bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-700 cursor-pointer shadow-sm transition-all"
                >
                  ◀ Lùi lại
                </button>
                {getVisiblePages(currentPage, totalPages).map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold ${
                      currentPage === pageNum ? 'bg-blue-800 text-white shadow' : 'text-slate-650 hover:bg-slate-105 bg-white border border-slate-200'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 h-8 flex items-center justify-center gap-1 rounded-lg border border-slate-250 text-xs font-semibold bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-700 cursor-pointer shadow-sm transition-all"
                >
                  Tiếp theo ▶
                </button>
              </div>
            </div>
          </React.Fragment>
        )}

      {/* ----------------- Pop up modals ----------------- */}
      {/* Add Resident modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-100">
            <div className="bg-blue-800 text-white px-6 py-4.5 font-bold flex justify-between items-center shrink-0">
              <h3 className="text-xs uppercase tracking-wider font-extrabold">ĐỒNG BỘ NHÂN KHẨU MỚI</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-white hover:text-white/80 font-bold text-lg select-none cursor-pointer">×</button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4 text-xs font-semibold text-slate-705 overflow-y-auto flex-1 min-h-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label>Họ và Tên khai sinh *</label>
                  <input
                    type="text"
                    required
                    placeholder="Lê Văn Hùng"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-700"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label>Giới tính *</label>
                  <select
                    value={formGender}
                    onChange={(e) => setFormGender(e.target.value as any)}
                    className="border border-slate-300 rounded-xl px-2 py-2 focus:outline-none"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label>Ngày sinh *</label>
                  <input
                    type="text"
                    required
                    placeholder="DD/MM/YYYY"
                    value={formDob}
                    onChange={(e) => setFormDob(e.target.value)}
                    onBlur={() => setFormDob(formatDate(formDob))}
                    className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label>Số CCCD *</label>
                  <input
                    type="text"
                    required
                    placeholder="079085012345"
                    value={formIdCard}
                    onChange={(e) => setFormIdCard(e.target.value)}
                    className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-700 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label>Số điện thoại</label>
                  <input
                    type="text"
                    placeholder="0911222333"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label>Nghề nghiệp / Học vấn</label>
                  <input
                    type="text"
                    placeholder="Kỹ sư, học sinh..."
                    value={formOccupation}
                    onChange={(e) => setFormOccupation(e.target.value)}
                    className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5 align-add-custom-group-label">
                  <label>Tổ dân phố</label>
                  <select
                    value={formGroup}
                    onChange={(e) => setFormGroup(e.target.value)}
                    className="border border-slate-300 rounded-xl px-2 py-2 focus:outline-none focus:border-blue-500"
                  >
                    {dynamicNeighborhoodGroups.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                    <option value="Khác">Khác / Thêm tổ mới...</option>
                  </select>
                  {formGroup === 'Khác' && (
                    <input
                      type="text"
                      required
                      placeholder="Nhập tên tổ mới (VD: Tổ dân phố 4)"
                      value={customFormGroup}
                      onChange={(e) => setCustomFormGroup(e.target.value)}
                      className="mt-2 border border-slate-300 rounded-xl px-3 py-1.5 focus:outline-none focus:border-blue-500 text-xs font-semibold placeholder:text-slate-400"
                    />
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label>Trạng thái</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="border border-slate-300 rounded-xl px-2 py-2 focus:outline-none font-sans"
                  >
                    <option value="Thường trú">Thường trú</option>
                    <option value="Tạm trú">Tạm trú</option>
                    <option value="Tạm vắng">Tạm vắng</option>
                    <option value="Vãng lai">Vãng lai</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="font-semibold text-slate-700">Địa chỉ cư trú hiện nay *</label>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        const [hhId, addr, grp, status] = e.target.value.split('|||');
                        setFormHouseholdId(hhId);
                        setFormAddress(addr);
                        if (grp) setFormGroup(grp);
                        if (status) setFormStatus(status as any);
                      }
                    }}
                    className="text-[9.5px] bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-850 font-extrabold rounded-lg px-2 py-0.5 max-w-[200px] outline-none cursor-pointer"
                    defaultValue=""
                  >
                    <option value="" disabled>🔗 Liên kết Hộ gia đình</option>
                    {[...households, ...temporaryHouseholds].map(h => {
                      const isTemp = h.id.startsWith('htt');
                      return (
                        <option key={h.id} value={`${h.id}|||${h.address}|||${h.neighborhoodGroup}|||${isTemp ? 'Tạm trú' : 'Thường trú'}`}>
                          {h.ownerName} ({h.address.split(',')[0]}...)
                        </option>
                      );
                    })}
                  </select>
                </div>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: 123/45 Trần Não, Tổ dân phố 1"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none font-medium"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label>Ghi chú ban quản lý</label>
                <textarea
                  placeholder="Nhập ghi chú quan trọng nếu có..."
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none h-12 resize-none"
                />
              </div>

              {/* Dynamic Organizations/Policies label tagging list */}
              {orgCategories && orgCategories.length > 0 && (
                <div className="space-y-2 bg-[#f8f9ff] p-4.5 rounded-2xl border border-slate-150 max-h-[160px] overflow-y-auto custom-scrollbar">
                  <p className="font-bold text-slate-800 text-[10.5px] uppercase tracking-wider mb-2">Đoàn thể & Chính sách (Gắn nhãn đồng bộ)</p>
                  <div className="space-y-4">
                    {orgCategories.map((cat) => {
                      const catOrgs = (organizations || []).filter(org => org.category_id === cat.id && org.is_active && !org.is_deleted);
                      if (catOrgs.length === 0) return null;
                      return (
                        <div key={cat.id} className="space-y-1">
                          <span className="text-[9px] uppercase font-extrabold tracking-widest block" style={{ color: cat.color }}>{cat.name}</span>
                          <div className="grid grid-cols-1 gap-1.5 pl-1.5">
                            {catOrgs.map(org => {
                              const orgCode = org.code || org.id;
                              const isChecked = formClassifications.includes(orgCode);
                              return (
                                <label key={org.id} className="flex items-center gap-2 text-[11px] font-bold text-slate-655 cursor-pointer hover:text-slate-900 select-none">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    className="rounded border-slate-300 text-blue-800 focus:ring-blue-800 shrink-0 cursor-pointer w-3.5 h-3.5"
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setFormClassifications(prev => [...prev, orgCode]);
                                      } else {
                                        setFormClassifications(prev => prev.filter(c => c !== orgCode));
                                      }
                                    }}
                                  />
                                  <span>{org.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4.5 py-2.5 bg-slate-100 hover:bg-slate-150 rounded-xl text-slate-705 font-bold transition">Đóng</button>
                <button type="submit" className="px-5 py-2.5 bg-blue-800 hover:bg-blue-750 text-white rounded-xl font-bold hover:shadow shadow-blue-800/10 transition">Lưu nhân khẩu</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Resident modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-100">
            <div className="bg-slate-900 text-white px-6 py-4.5 font-bold flex justify-between items-center shrink-0">
              <h3 className="text-xs uppercase tracking-wider font-extrabold text-blue-105">CẬP NHẬT HỒ SƠ NHÂN KHẨU</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-white hover:text-white/80 font-bold text-lg select-none cursor-pointer">×</button>
            </div>

            <form onSubmit={handleUpdate} className="p-6 space-y-4 text-xs font-semibold text-slate-705 overflow-y-auto flex-1 min-h-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label>Họ và Tên khai sinh *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-700"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label>Giới tính *</label>
                  <select
                    value={formGender}
                    onChange={(e) => setFormGender(e.target.value as any)}
                    className="border border-slate-300 rounded-xl px-2 py-2 focus:outline-none"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label>Ngày sinh *</label>
                  <input
                    type="text"
                    required
                    value={formDob}
                    onChange={(e) => setFormDob(e.target.value)}
                    className="border border-slate-300 rounded-xl px-3 py-2 text-slate-700 font-medium"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label>Số CCCD *</label>
                  <input
                    type="text"
                    required
                    value={formIdCard}
                    onChange={(e) => setFormIdCard(e.target.value)}
                    className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-700 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label>Số điện thoại</label>
                  <input
                    type="text"
                    placeholder="0911222333"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label>Nghề nghiệp / Học văn</label>
                  <input
                    type="text"
                    placeholder="Kỹ sư, lao động tự do..."
                    value={formOccupation}
                    onChange={(e) => setFormOccupation(e.target.value)}
                    className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5 align-edit-custom-group-label">
                  <label>Tổ dân phố</label>
                  <select
                    value={formGroup}
                    onChange={(e) => setFormGroup(e.target.value)}
                    className="border border-slate-300 rounded-xl px-2 py-2 focus:outline-none focus:border-blue-500"
                  >
                    {dynamicNeighborhoodGroups.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                    <option value="Khác">Khác / Thêm tổ mới...</option>
                  </select>
                  {formGroup === 'Khác' && (
                    <input
                      type="text"
                      required
                      placeholder="Nhập tên tổ mới (VD: Tổ dân phố 4)"
                      value={customFormGroup}
                      onChange={(e) => setCustomFormGroup(e.target.value)}
                      className="mt-2 border border-slate-300 rounded-xl px-3 py-1.5 focus:outline-none focus:border-blue-500 text-xs font-semibold placeholder:text-slate-400"
                    />
                  )}
                </div>
                <div className="flex flex-col gap-1.5 font-semibold text-xs text-slate-705">
                  <label>Trạng thái</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="border border-slate-300 rounded-xl px-2 py-2 focus:outline-none font-sans"
                  >
                    <option value="Thường trú">Thường trú</option>
                    <option value="Tạm trú">Tạm trú</option>
                    <option value="Tạm vắng">Tạm vắng</option>
                    <option value="Vãng lai">Vãng lai</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 font-semibold text-xs text-slate-705">
                <div className="flex justify-between items-center">
                  <label className="font-semibold text-slate-700">Địa chỉ cư trú hiện nay *</label>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        const [hhId, addr, grp, status] = e.target.value.split('|||');
                        setFormHouseholdId(hhId);
                        setFormAddress(addr);
                        if (grp) setFormGroup(grp);
                        if (status) setFormStatus(status as any);
                      }
                    }}
                    className="text-[9.5px] bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-850 font-extrabold rounded-lg px-2 py-0.5 max-w-[200px] outline-none cursor-pointer"
                    defaultValue=""
                  >
                    <option value="" disabled>🔗 Liên kết Hộ gia đình</option>
                    {[...households, ...temporaryHouseholds].map(h => {
                      const isTemp = h.id.startsWith('htt');
                      return (
                        <option key={h.id} value={`${h.id}|||${h.address}|||${h.neighborhoodGroup}|||${isTemp ? 'Tạm trú' : 'Thường trú'}`}>
                          {h.ownerName} ({h.address.split(',')[0]}...)
                        </option>
                      );
                    })}
                  </select>
                </div>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: 123/45 Trần Não, Tổ dân phố 1"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none font-medium"
                />
              </div>

              <div className="flex flex-col gap-1.5 font-semibold text-xs text-slate-705">
                <label>Ghi chú ban quản lý</label>
                <textarea
                  placeholder="Ghi chú hồ sơ hoặc lý do đặc biệt..."
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none h-12 resize-none"
                />
              </div>

              {/* Dynamic Organizations/Policies label tagging list */}
              {orgCategories && orgCategories.length > 0 && (
                <div className="space-y-2 bg-[#f8f9ff] p-4.5 rounded-2xl border border-slate-150 max-h-[160px] overflow-y-auto custom-scrollbar">
                  <p className="font-bold text-slate-800 text-[10.5px] uppercase tracking-wider mb-2">Đoàn thể & Chính sách (Gắn nhãn đồng bộ)</p>
                  <div className="space-y-4">
                    {orgCategories.map((cat) => {
                      const catOrgs = (organizations || []).filter(org => org.category_id === cat.id && org.is_active && !org.is_deleted);
                      if (catOrgs.length === 0) return null;
                      return (
                        <div key={cat.id} className="space-y-1">
                          <span className="text-[9px] uppercase font-extrabold tracking-widest block" style={{ color: cat.color }}>{cat.name}</span>
                          <div className="grid grid-cols-1 gap-1.5 pl-1.5">
                            {catOrgs.map(org => {
                              const orgCode = org.code || org.id;
                              const isChecked = formClassifications.includes(orgCode);
                              return (
                                <label key={org.id} className="flex items-center gap-2 text-[11px] font-bold text-slate-655 cursor-pointer hover:text-slate-900 select-none">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    className="rounded border-slate-300 text-blue-800 focus:ring-blue-800 shrink-0 cursor-pointer w-3.5 h-3.5"
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setFormClassifications(prev => [...prev, orgCode]);
                                      } else {
                                        setFormClassifications(prev => prev.filter(c => c !== orgCode));
                                      }
                                    }}
                                  />
                                  <span>{org.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4.5 py-2.5 bg-slate-100 hover:bg-slate-150 rounded-xl text-slate-705 font-bold transition">Bỏ qua</button>
                <button type="submit" className="px-5 py-2.5 bg-slate-950 hover:bg-slate-800 text-white rounded-xl font-bold transition">Cập nhật hồ sơ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Household Register form modal */}
      {isHouseOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="bg-blue-800 text-white px-6 py-4 font-bold flex justify-between items-center shrink-0">
              <h3>ĐỒNG BỘ PHIẾU KHAI HỘ KHẨU MỚI</h3>
              <button onClick={() => setIsHouseOpen(false)} className="text-white hover:text-white/80 font-bold text-lg">×</button>
            </div>

            <form onSubmit={handleCreateHouse} className="p-6 space-y-4 text-xs font-semibold text-slate-705 overflow-y-auto flex-1 min-h-0">
              <div className="flex flex-col gap-1.5">
                <label>Họ tên Chủ hộ gia đình *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Lê Văn Sơn"
                  value={houseOwner}
                  onChange={(e) => setHouseOwner(e.target.value)}
                  className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-700"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label>Căn cước chủ hộ</label>
                  <input
                    type="text"
                    placeholder="Nhập 12 số CCCD"
                    value={houseIdCard}
                    onChange={(e) => setHouseIdCard(e.target.value)}
                    className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label>Số điện thoại chủ hộ</label>
                  <input
                    type="text"
                    placeholder="0911222444"
                    value={housePhone}
                    onChange={(e) => setHousePhone(e.target.value)}
                    className="border border-slate-300 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label>Số nhà địa chính thường trú *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: 123/45 Trần Não, Tổ dân phố 1"
                  value={houseAddress}
                  onChange={(e) => setHouseAddress(e.target.value)}
                  className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5 label-house-custom-group-align">
                <label>Tổ dân phố</label>
                <select
                  value={houseGroup}
                  onChange={(e) => setHouseGroup(e.target.value)}
                  className="border border-slate-300 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-blue-500"
                >
                  {dynamicNeighborhoodGroups.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                  <option value="Khác">Khác / Thêm tổ mới...</option>
                </select>
                {houseGroup === 'Khác' && (
                  <input
                    type="text"
                    required
                    placeholder="Nhập tên tổ mới (VD: Tổ dân phố 4)"
                    value={customHouseGroup}
                    onChange={(e) => setCustomHouseGroup(e.target.value)}
                    className="mt-2 border border-slate-300 rounded-xl px-3 py-1.5 focus:outline-none focus:border-blue-500 text-xs font-semibold placeholder:text-slate-400"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label>Vĩ độ (Latitude)</label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="Ví dụ: 10.936000"
                    value={houseLat}
                    onChange={(e) => setHouseLat(e.target.value !== '' ? Number(e.target.value) : '')}
                    className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label>Kinh độ (Longitude)</label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="Ví dụ: 106.721000"
                    value={houseLng}
                    onChange={(e) => setHouseLng(e.target.value !== '' ? Number(e.target.value) : '')}
                    className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
                <button type="button" onClick={() => setIsHouseOpen(false)} className="px-4 py-2 bg-slate-105 rounded-lg text-slate-705 border">Hủy</button>
                <button type="submit" className="px-4 py-2 bg-blue-800 text-white rounded-lg">Thành lập hộ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Temporary Household Register form modal */}
      {isTempHouseOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden shadow-2xl font-sans font-semibold">
            <div className="bg-indigo-800 text-white px-6 py-4 font-bold flex justify-between items-center shrink-0">
              <h3>ĐỒNG BỘ PHIẾU KHAI HỘ TẠM TRÚ MỚI</h3>
              <button onClick={() => {
                setIsTempHouseOpen(false);
                setHouseOwner('');
                setHouseIdCard('');
                setHouseAddress('');
                setHousePhone('');
              }} className="text-white hover:text-white/80 font-bold text-lg">×</button>
            </div>

            <form onSubmit={handleCreateTempHouse} className="p-6 space-y-4 text-xs font-semibold text-slate-705 overflow-y-auto flex-1 min-h-0">
              <div className="flex flex-col gap-1.5">
                <label>Họ tên Chủ hộ tạm trú *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Lê Thị Mai"
                  value={houseOwner}
                  onChange={(e) => setHouseOwner(e.target.value)}
                  className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-700"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label>Căn cước chủ hộ</label>
                  <input
                    type="text"
                    placeholder="Nhập 12 số CCCD"
                    value={houseIdCard}
                    onChange={(e) => setHouseIdCard(e.target.value)}
                    className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label>Số điện thoại chủ hộ</label>
                  <input
                    type="text"
                    placeholder="0912444555"
                    value={housePhone}
                    onChange={(e) => setHousePhone(e.target.value)}
                    className="border border-slate-300 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label>Số nhà địa chính lưu trú tạm thời *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: 45/2 Trần Não, Tổ dân phố 2"
                  value={houseAddress}
                  onChange={(e) => setHouseAddress(e.target.value)}
                  className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5 label-temphouse-custom-group-align">
                <label>Tổ dân phố</label>
                <select
                  value={houseGroup}
                  onChange={(e) => setHouseGroup(e.target.value)}
                  className="border border-slate-300 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-indigo-500"
                >
                  {dynamicNeighborhoodGroups.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                  <option value="Khác">Khác / Thêm tổ mới...</option>
                </select>
                {houseGroup === 'Khác' && (
                  <input
                    type="text"
                    required
                    placeholder="Nhập tên tổ mới (VD: Tổ dân phố 4)"
                    value={customHouseGroup}
                    onChange={(e) => setCustomHouseGroup(e.target.value)}
                    className="mt-2 border border-slate-300 rounded-xl px-3 py-1.5 focus:outline-none focus:border-blue-500 text-xs font-semibold placeholder:text-slate-400"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label>Vĩ độ (Latitude)</label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="Ví dụ: 10.936000"
                    value={houseLat}
                    onChange={(e) => setHouseLat(e.target.value !== '' ? Number(e.target.value) : '')}
                    className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label>Kinh độ (Longitude)</label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="Ví dụ: 106.721000"
                    value={houseLng}
                    onChange={(e) => setHouseLng(e.target.value !== '' ? Number(e.target.value) : '')}
                    className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
                <button type="button" onClick={() => {
                  setIsTempHouseOpen(false);
                  setHouseOwner('');
                  setHouseIdCard('');
                  setHouseAddress('');
                  setHousePhone('');
                }} className="px-4 py-2 bg-slate-105 rounded-lg text-slate-705 border">Hủy</button>
                <button type="submit" className="px-4 py-2 bg-indigo-850 text-white rounded-lg font-bold">Lưu hộ tạm trú</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Duplicate Import Simulation modal */}
      {importModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="bg-indigo-800 text-white px-6 py-4 font-bold flex justify-between items-center shrink-0">
              <h3>GIẢ LẬP NHẬP KHẨU DÂN CƯ</h3>
              <button onClick={() => setImportModalOpen(false)} className="text-white hover:text-white/80 font-bold text-lg">×</button>
            </div>

            <div className="p-6 space-y-4 text-xs font-semibold text-slate-705 overflow-y-auto flex-1 min-h-0">
              <p className="text-slate-500 font-medium">Chọn tình huống kịch bản trùng lặp để mô phỏng thuật toán xử lý đối soát:</p>

              <div className="space-y-3.5">
                <label className="p-3 bg-slate-50 border rounded-xl block cursor-pointer flex gap-3">
                  <input
                    type="radio"
                    name="scenario"
                    checked={importScenario === 'scenario_1'}
                    onChange={() => setImportScenario('scenario_1')}
                    className="mt-0.5"
                  />
                  <div>
                    <strong className="text-slate-800">Tình huống 1: Trùng cả Chủ hộ & Địa chỉ</strong>
                    <p className="text-[10.5px] text-slate-400 mt-1">Hệ thống gộp cộng dồn 1 hộ duy nhất (Deduplication).</p>
                  </div>
                </label>

                <label className="p-3 bg-slate-50 border rounded-xl block cursor-pointer flex gap-3">
                  <input
                    type="radio"
                    name="scenario"
                    checked={importScenario === 'scenario_2'}
                    onChange={() => setImportScenario('scenario_2')}
                    className="mt-0.5"
                  />
                  <div>
                    <strong className="text-slate-800">Tình huống 2: Trùng Địa chỉ nhưng Khác Chủ</strong>
                    <p className="text-[10.5px] text-slate-400 mt-1">Thành lập 2 hộ phụ gia đồng lưu trú độc lập riêng biệt.</p>
                  </div>
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
                <button type="button" onClick={() => setImportModalOpen(false)} className="px-4 py-2 bg-slate-100 rounded-lg text-slate-705">Hủy</button>
                <button
                  type="button"
                  onClick={handleImportDeduplication}
                  className="px-4 py-2 bg-indigo-850 hover:bg-indigo-800 text-white rounded-lg flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" /> Chạy giải lập
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Upload External File Modal */}
      {isImportFileOpen && (
        <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn font-sans">
          <div className={`bg-white rounded-2xl w-full flex flex-col overflow-hidden shadow-2xl border border-slate-100 transition-all duration-300 ${importStep === 3 ? 'max-w-5xl h-[80vh]' : 'max-w-lg max-h-[80vh]'}`}>
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-800 to-teal-700 text-white px-5 py-3 font-bold flex justify-between items-center shrink-0 shadow-md">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                  <Upload className="w-3.5 h-3.5 text-emerald-250 animate-pulse" />
                </div>
                <div>
                  <h3 className="uppercase tracking-wide text-[10px] font-extrabold text-teal-100">CÔNG CỤ NÂNG CẤP</h3>
                  <h2 className="text-xs font-black text-white leading-tight">NHẬP DỮ LIỆU DÂN CƯ TỪ BÊN NGOÀI TÍCH HỢP AI</h2>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsImportFileOpen(false);
                  setImportStep(1);
                  setSelectedFiles([]);
                  setUploadParsedData([]);
                }} 
                className="text-white hover:text-white/80 font-bold text-lg cursor-pointer w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center transition-all"
              >
                ×
              </button>
            </div>

            {/* Steps indicator */}
            <div className="bg-slate-50 border-b border-slate-150 px-5 py-2 flex items-center gap-1 justify-start text-[10px] font-bold text-slate-400 shrink-0">
              <span className={`px-2 py-0.5 rounded-full ${importStep === 1 ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-600'}`}>1. LOẠI DỮ LIỆU</span>
              <ChevronRight className="w-3 h-3" />
              <span className={`px-2 py-0.5 rounded-full ${importStep === 2 ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-600'}`}>2. CHỌN TỆP PHÂN TÍCH</span>
              <ChevronRight className="w-3 h-3" />
              <span className={`px-2 py-0.5 rounded-full ${importStep === 3 ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-600'}`}>3. AI PREVIEW & ĐỐI SOÁT HỘ KHẨU</span>
            </div>

            {/* Content area */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 min-w-0 bg-slate-50/30">
              {uploadErrorMsg && (
                <div className="mb-4 bg-red-50 text-red-850 p-3 rounded-xl border border-red-150 text-[11px] font-semibold flex items-center gap-2">
                  <span>⚠️ Lỗi phân tích: {uploadErrorMsg}</span>
                </div>
              )}

              {/* STEP 1: CHOOSE DATA CLASSIFICATION */}
              {importStep === 1 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="bg-emerald-50/35 border border-emerald-100 rounded-xl p-3">
                    <h4 className="text-[11px] font-extrabold text-emerald-850 mb-1">HƯỚNG DẪN AI NHẬP DỮ LIỆU CƯ TRÚ</h4>
                    <p className="text-slate-550 text-[11px] leading-relaxed">
                      AI sẽ tự động nhận diện danh tính cư dân, OCR bóc tách giấy tờ/hình ảnh scan, phân tích cấu trúc bảng tính Excel, chuẩn hóa họ tên bằng chữ hoa tiêu chuẩn quốc gia, rà soát CCCD chuẩn định dạng, phân loại quan hệ gia đình (Chủ hộ, Vợ, Con...), gom nhóm hộ gia đình tự động và đối chuẩn cư dân trùng trên hệ thống.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-extrabold text-slate-800 uppercase block">Chọn loại danh sách cư trú cần nạp:</label>
                    <div className={`grid grid-cols-1 ${
                      ((activeSubTab as string) === 'tam_tru' || (activeSubTab as string) === 'ho_tam_tru' || (activeSubTab as string) === 'nhan_khau' || (activeSubTab as string) === 'ho_khau') 
                        ? 'sm:grid-cols-2' 
                        : 'sm:grid-cols-3'
                    } gap-2.5`}>
                      <div 
                        onClick={() => setImportDataType('auto')}
                        className={`p-3 rounded-xl border cursor-pointer select-none transition-all flex flex-col justify-between h-24 ${importDataType === 'auto' ? 'border-emerald-600 bg-emerald-50/20 shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] uppercase font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded-md">Khuyên dùng</span>
                          <input type="radio" checked={importDataType === 'auto'} readOnly />
                        </div>
                        <div>
                          <strong className="text-[11px] text-slate-800 block">AI Tự động phân tích</strong>
                          <span className="text-[10px] text-slate-450 mt-0.5 line-clamp-2 block font-medium">Bố trí nhận diện hộ khẩu thường trú hoặc thời hạn tạm trú thông minh dựa trên ngữ cảnh tệp tin.</span>
                        </div>
                      </div>

                      {!((activeSubTab as string) === 'tam_tru' || (activeSubTab as string) === 'ho_tam_tru') && (
                        <div 
                          onClick={() => setImportDataType('nhan_khau')}
                          className={`p-3 rounded-xl border cursor-pointer select-none transition-all flex flex-col justify-between h-24 ${importDataType === 'nhan_khau' ? 'border-emerald-600 bg-emerald-50/20 shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                        >
                          <div className="flex justify-end">
                            <input type="radio" checked={importDataType === 'nhan_khau'} readOnly />
                          </div>
                          <div>
                            <strong className="text-[11px] text-slate-800 block">Danh Sách Thường Trú</strong>
                            <span className="text-[10px] text-slate-450 mt-0.5 line-clamp-2 block font-medium">Lập sơ đồ nhà ở, xác lực Chủ hộ, quy đổi gia cảnh kết nối quan hệ hộ gia đình tự động.</span>
                          </div>
                        </div>
                      )}

                      {!((activeSubTab as string) === 'nhan_khau' || (activeSubTab as string) === 'ho_khau') && (
                        <div 
                          onClick={() => setImportDataType('tam_tru')}
                          className={`p-3 rounded-xl border cursor-pointer select-none transition-all flex flex-col justify-between h-24 ${importDataType === 'tam_tru' ? 'border-emerald-600 bg-emerald-50/20 shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                        >
                          <div className="flex justify-end">
                            <input type="radio" checked={importDataType === 'tam_tru'} readOnly />
                          </div>
                          <div>
                            <strong className="text-[11px] text-slate-800 block">Danh Sách Tạm Trú</strong>
                            <span className="text-[10px] text-slate-450 mt-0.5 line-clamp-2 block font-medium">Kiểm duyệt ngày hết đăng ký cư sở tạm, tự động cảnh báo thời hạn hiệu lực tạm trú.</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: MULTIPLE FILE SELECT & DROP ZONE */}
              {importStep === 2 && (
                <div className="space-y-4 animate-fadeIn">
                  {/* Drag drop area */}
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center space-y-2.5 transition-all ${
                      isDragActive ? 'border-emerald-500 bg-emerald-50/20 shadow-inner' : 'border-slate-350 hover:border-slate-450 bg-slate-50/30'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                      <Upload className="w-5 h-5 text-emerald-600 animate-bounce" style={{ animationDuration: '3s' }} />
                    </div>
                    <div>
                      <label className="py-2 px-3.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-705 font-extrabold text-[10.5px] rounded-lg cursor-pointer inline-block shadow-sm hover:scale-101 active:scale-99 transition-all">
                        Tải lên tệp tin cư dân...
                        <input
                          type="file"
                          multiple
                          accept=".json,.csv,.txt,.xlsx,.xls,.ods,.pdf,.png,.jpg,.jpeg,.webp,.tiff"
                          className="hidden"
                          onChange={handleFileSelect}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Selected files list */}
                  {selectedFiles.length > 0 && (
                    <div className="space-y-1.5 p-3.5 bg-slate-50 border border-slate-150 rounded-xl max-h-40 overflow-y-auto">
                      <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1.5">TỆP ĐANG CHỜ PHÂN TÍCH ({selectedFiles.length}):</p>
                      {selectedFiles.map((ff, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs font-bold text-slate-705 p-1.5 bg-white border border-slate-100 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span className="truncate max-w-[200px] text-[10.5px] text-slate-800">{ff.name}</span>
                          </div>
                          <span className="text-[9px] font-mono text-slate-400">{(ff.size / 1024).toFixed(1)} KB</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {isParsing && (
                    <div className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-4 flex items-center justify-center gap-3.5 animate-pulse">
                      <RefreshCw className="w-5 h-5 text-emerald-700 animate-spin" />
                      <div className="text-left">
                        <strong className="text-emerald-950 text-[11px] block uppercase font-sans">AI đang quét & ánh xạ định dạng...</strong>
                        <span className="text-[10px] text-slate-550 block mt-0.5">Cán bộ vui lòng giữ kết nối. Trí tuệ nhận tạo đang tự động gộp hộ & đối soát trùng lặp...</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: EXQUISITE PREVIEW AND DEDUPLICATION SCREEN */}
              {importStep === 3 && (
                <div className="flex flex-col lg:flex-row gap-5 animate-fadeIn h-full">
                  
                  {/* Left Column: AI Summary Sheet */}
                  <div className="w-full lg:w-1/4 flex flex-col gap-4">
                    <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm space-y-3 shrink-0">
                      <div className="border-b pb-2">
                        <span className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md inline-block font-sans">Báo cáo bóc tách AI</span>
                        <h4 className="font-extrabold text-slate-900 text-xs mt-1.5 uppercase font-sans">CHỈ SỐ TRÍCH XUẤT</h4>
                      </div>

                      <div className="space-y-2 text-xs font-bold text-slate-705 font-sans">
                        <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl">
                          <span className="text-slate-500">Mã hộ gia đình lập:</span>
                          <span className="text-slate-800 text-xs font-black">{parsedHouseholds.length} hộ</span>
                        </div>
                        <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl">
                          <span className="text-slate-500">Hộ gộp (đã có):</span>
                          <span className="text-indigo-900 text-xs font-black">
                            {parsedHouseholds.filter(h => h.alreadyExists).length} hộ
                          </span>
                        </div>
                        <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl">
                          <span className="text-slate-500">Nhân khẩu trích được:</span>
                          <span className="text-emerald-850 text-xs font-black">{uploadParsedData.length} dân</span>
                        </div>
                        <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl">
                          <span className="text-slate-500">Dân mới hoàn toàn:</span>
                          <span className="text-blue-900 text-xs font-black">
                            {uploadParsedData.filter(r => r.duplicateStatus === 'none').length} người
                          </span>
                        </div>
                        <div className="flex justify-between items-center bg-orange-50 border border-orange-100 p-2 rounded-xl text-orange-850">
                          <span>Trùng khớp / Nghi ngờ:</span>
                          <span className="text-xs font-black text-orange-900">
                            {uploadParsedData.filter(r => r.duplicateStatus !== 'none').length} dân
                          </span>
                        </div>
                        <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl">
                          <span className="text-slate-500">Hồ sơ khuyết trường:</span>
                          <span className="text-slate-700 text-xs font-semibold">
                            {uploadParsedData.filter(r => !r.idCard || !r.dob || !r.phone).length} bản
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* File analysis summary */}
                    <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm flex-1 overflow-y-auto max-h-[35vh]">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider mb-2 font-sans">Chú thích phân tích</span>
                      <pre className="text-[10px] text-slate-600 font-sans font-medium leading-relaxed whitespace-pre-wrap">
                        {originalFileSummary}
                      </pre>
                      
                      <div className="mt-4 pt-3 border-t text-[10px] text-slate-400 italic font-medium leading-relaxed font-sans">
                        * Mẹo cán bộ: Hãy <strong className="text-emerald-700 font-bold">nhấp trực tiếp vào ô giá trị bất kỳ</strong> trên bảng để chỉnh sửa nóng trước khi cập nhật.
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Citizen conflict resolution and editing database */}
                  <div className="w-full lg:w-3/4 flex flex-col bg-white border border-slate-150 rounded-2xl shadow-sm overflow-hidden min-h-[50vh]">
                    {/* Inner header & Tab controller */}
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-150 shrink-0 font-sans">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                          <Users className="w-4 h-4 text-emerald-800" />
                          <span>BẢNG ĐỐI SOÁT & PHƯƠNG ÁN AI</span>
                        </div>
                        
                        {/* Tab Buttons */}
                        <div className="flex border border-slate-200 bg-slate-100 p-0.5 rounded-lg text-[10.5px] font-bold">
                          <button
                            onClick={() => setPreviewTab('residents')}
                            className={`px-3 py-1 rounded-md transition-all ${previewTab === 'residents' ? 'bg-white text-emerald-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                          >
                            👤 Nhân khẩu ({uploadParsedData.length})
                          </button>
                          <button
                            onClick={() => setPreviewTab('households')}
                            className={`px-3 py-1 rounded-md transition-all ${previewTab === 'households' ? 'bg-white text-emerald-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                          >
                            🏠 Hộ gia đình ({parsedHouseholds.length})
                          </button>
                          <button
                            onClick={() => setPreviewTab('missing')}
                            className={`px-3 py-1 rounded-md transition-all ${previewTab === 'missing' ? 'bg-white text-emerald-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                          >
                            ⚠️ Ô trống ({uploadParsedData.filter(r => !r.idCard || !r.dob || !r.phone).length})
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Interactive validation tabular list */}
                    <div className="flex-1 overflow-y-auto p-4 min-h-0 font-sans">
                      
                      {/* TAB 1: RESIDENTS PREVIEW */}
                      {previewTab === 'residents' && (
                        <div className="space-y-3.5">
                          {/* Inner filter pills */}
                          <div className="flex gap-1 flex-wrap">
                            <button
                              onClick={() => setResidentFilter('all')}
                              className={`px-2.5 py-1 rounded-full text-[9.5px] font-bold border transition-all ${residentFilter === 'all' ? 'bg-slate-850 text-white border-slate-850' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                            >
                              Tất cả ({uploadParsedData.length})
                            </button>
                            <button
                              onClick={() => setResidentFilter('new')}
                              className={`px-2.5 py-1 rounded-full text-[9.5px] font-bold border transition-all ${residentFilter === 'new' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                            >
                              Nhập mới ({uploadParsedData.filter(r => r.duplicateStatus === 'none').length})
                            </button>
                            <button
                              onClick={() => setResidentFilter('skipped')}
                              className={`px-2.5 py-1 rounded-full text-[9.5px] font-bold border transition-all ${residentFilter === 'skipped' ? 'bg-red-700 text-white border-red-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                            >
                              Trùng / Tự động bỏ qua ({uploadParsedData.filter(r => r.duplicateStatus === 'level_1_duplicate' || r.duplicateStatus === 'level_2_duplicate').length})
                            </button>
                            <button
                              onClick={() => setResidentFilter('suspected')}
                              className={`px-2.5 py-1 rounded-full text-[9.5px] font-bold border transition-all ${residentFilter === 'suspected' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                            >
                              Trùng tên - Nghi ngờ ({uploadParsedData.filter(r => r.duplicateStatus === 'level_3_suspected').length})
                            </button>
                          </div>

                          <div className="border border-slate-150 rounded-xl overflow-hidden shadow-sm bg-white">
                            <table className="w-full text-left text-[11px] font-sans border-collapse">
                              <thead className="bg-slate-100 text-slate-550 font-bold border-b border-slate-200 sticky top-0 z-10">
                                <tr>
                                  <th className="px-3 py-2.5">Họ và tên (In)</th>
                                  <th className="px-3 py-2.5">Số CCCD / CMND</th>
                                  <th className="px-3 py-2.5">Ngày sinh</th>
                                  <th className="px-3 py-2.5">Địa chỉ số nhà</th>
                                  <th className="px-3 py-2.5">Quan hệ</th>
                                  <th className="px-3 py-2.5 text-center">Trạng thái</th>
                                  <th className="px-3 py-2.5 text-center w-52">Xử lý đối chuẩn</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-150 bg-white">
                                {uploadParsedData.filter(r => {
                                  if (residentFilter === 'all') return true;
                                  if (residentFilter === 'new') return r.duplicateStatus === 'none';
                                  if (residentFilter === 'skipped') return r.duplicateStatus === 'level_1_duplicate' || r.duplicateStatus === 'level_2_duplicate';
                                  if (residentFilter === 'suspected') return r.duplicateStatus === 'level_3_suspected';
                                  return true;
                                }).map((item) => {
                                  const isEditingName = editingResidentId === item.id && editingField === 'name';
                                  const isEditingIdCard = editingResidentId === item.id && editingField === 'idCard';
                                  const isEditingDob = editingResidentId === item.id && editingField === 'dob';
                                  const isEditingAddress = editingResidentId === item.id && editingField === 'address';
                                  const isEditingNote = editingResidentId === item.id && editingField === 'note';

                                  let dupLabel = null;
                                  let rowStyle = "";
                                  if (item.duplicateStatus === 'level_1_duplicate') {
                                    dupLabel = <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-red-100 text-red-800 leading-tight block mt-0.5">Trùng CCCD cứng (Mức 1)</span>;
                                    rowStyle = "bg-red-50/10";
                                  } else if (item.duplicateStatus === 'level_2_duplicate') {
                                    dupLabel = <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-orange-100 text-orange-800 leading-tight block mt-0.5">Trùng HK Đầy đủ (Mức 2)</span>;
                                    rowStyle = "bg-orange-50/10";
                                  } else if (item.duplicateStatus === 'level_3_suspected') {
                                    dupLabel = <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-amber-100 text-amber-800 border border-amber-200 leading-tight block mt-0.5">Trùng Tên nghi ngờ (Mức 3)</span>;
                                    rowStyle = "bg-amber-50/10";
                                  }

                                  return (
                                    <tr key={item.id} className={`hover:bg-slate-50/40 font-medium text-slate-707 ${rowStyle}`}>
                                      {/* Full Name Cell */}
                                      <td className="px-3 py-2 cursor-pointer hover:bg-slate-100/70" onClick={() => handleStartInlineEdit(item.id, 'name', item.name)}>
                                        {isEditingName ? (
                                          <input
                                            type="text"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onBlur={handleSaveInlineEdit}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSaveInlineEdit()}
                                            className="border border-emerald-500 rounded px-1.5 py-0.5 w-full text-slate-900 bg-white shadow-inner font-bold"
                                            autoFocus
                                          />
                                        ) : (
                                          <div>
                                            <span className="font-extrabold text-slate-950 tracking-wide hover:underline decoration-dotted block">{item.name}</span>
                                            {dupLabel}
                                          </div>
                                        )}
                                      </td>

                                      {/* CCCD Cell */}
                                      <td className="px-3 py-2 cursor-pointer hover:bg-slate-100/70 font-mono tracking-wider font-bold" onClick={() => handleStartInlineEdit(item.id, 'idCard', item.idCard)}>
                                        {isEditingIdCard ? (
                                          <input
                                            type="text"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onBlur={handleSaveInlineEdit}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSaveInlineEdit()}
                                            className="border border-emerald-500 rounded px-1.5 py-0.5 w-full bg-white font-mono"
                                            autoFocus
                                          />
                                        ) : (
                                          <span className={`${item.idCard ? 'text-indigo-950' : 'text-red-500 font-sans text-[10px]'} block hover:underline decoration-dotted`}>
                                            {item.idCard || '⚠️ Trống'}
                                          </span>
                                        )}
                                      </td>

                                      {/* DOB Cell */}
                                      <td className="px-3 py-2 cursor-pointer hover:bg-slate-100/70 text-slate-500 font-semibold" onClick={() => handleStartInlineEdit(item.id, 'dob', item.dob)}>
                                        {isEditingDob ? (
                                          <input
                                            type="text"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onBlur={handleSaveInlineEdit}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSaveInlineEdit()}
                                            className="border border-emerald-500 rounded px-1.5 py-0.5 w-full bg-white"
                                            autoFocus
                                          />
                                        ) : (
                                          <span className="block hover:underline decoration-dotted">{item.dob || '⚠️ Trống'}</span>
                                        )}
                                      </td>

                                      {/* Address Cell */}
                                      <td className="px-3 py-2 cursor-pointer hover:bg-slate-100/70 text-[10px] text-slate-500 max-w-[150px] truncate" onClick={() => handleStartInlineEdit(item.id, 'address', item.address)}>
                                        {isEditingAddress ? (
                                          <input
                                            type="text"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onBlur={handleSaveInlineEdit}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSaveInlineEdit()}
                                            className="border border-emerald-500 rounded px-1.5 py-0.5 w-full bg-white text-[10px]"
                                            autoFocus
                                          />
                                        ) : (
                                          <span className="block hover:underline decoration-dotted">{item.address || '⚠️ Trống'}</span>
                                        )}
                                      </td>

                                      {/* Relation/Note Cell */}
                                      <td className="px-3 py-2 cursor-pointer hover:bg-slate-100/70 text-slate-600 text-[10.5px] font-bold" onClick={() => handleStartInlineEdit(item.id, 'note', item.note)}>
                                        {isEditingNote ? (
                                          <input
                                            type="text"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onBlur={handleSaveInlineEdit}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSaveInlineEdit()}
                                            className="border border-emerald-500 rounded px-1.5 py-0.5 w-full bg-white"
                                            autoFocus
                                          />
                                        ) : (
                                          <span className="hover:underline decoration-dotted block">{item.note || 'Thành viên'}</span>
                                        )}
                                      </td>

                                      {/* Status Banner */}
                                      <td className="px-3 py-2 text-center">
                                        <span className={`px-2 py-0.5 rounded font-extrabold text-[8.5px] uppercase tracking-wide inline-block ${
                                          item.status === 'Tạm trú' ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'
                                        }`}>
                                          {item.status || 'Thường trú'}
                                        </span>
                                      </td>

                                      {/* Actions Selector block for Duplicates */}
                                      <td className="px-3 py-2 text-center border-l bg-slate-50/10">
                                        {item.duplicateStatus !== 'none' ? (
                                          <div className="flex flex-col gap-1">
                                            <div className="flex items-center justify-center gap-1.5">
                                              <label className="flex items-center gap-1 cursor-pointer">
                                                <input
                                                  type="radio"
                                                  name={`resolve-${item.id}`}
                                                  checked={duplicateResolutions[item.id] === 'update'}
                                                  onChange={() => setDuplicateResolutions(prev => ({ ...prev, [item.id]: 'update' }))}
                                                  className="w-3 h-3 text-blue-600 focus:ring-0"
                                                />
                                                <span className="text-[9px] text-slate-600 bg-white border px-1.5 py-0.5 rounded hover:bg-slate-150">Gộp & Thêm</span>
                                              </label>
                                              
                                              <label className="flex items-center gap-1 cursor-pointer">
                                                <input
                                                  type="radio"
                                                  name={`resolve-${item.id}`}
                                                  checked={duplicateResolutions[item.id] === 'overwrite'}
                                                  onChange={() => setDuplicateResolutions(prev => ({ ...prev, [item.id]: 'overwrite' }))}
                                                  className="w-3 h-3 text-emerald-600 focus:ring-0"
                                                />
                                                <span className="text-[9px] text-slate-600 bg-white border px-1.5 py-0.5 rounded hover:bg-slate-150">Đè hành chính</span>
                                              </label>

                                              <label className="flex items-center gap-1 cursor-pointer">
                                                <input
                                                  type="radio"
                                                  name={`resolve-${item.id}`}
                                                  checked={duplicateResolutions[item.id] === 'skip'}
                                                  onChange={() => setDuplicateResolutions(prev => ({ ...prev, [item.id]: 'skip' }))}
                                                  className="w-3 h-3 text-red-650 focus:ring-0"
                                                />
                                                <span className="text-[9px] text-slate-600 bg-white border px-1.5 py-0.5 rounded hover:bg-slate-150">Bỏ qua tệp</span>
                                              </label>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="text-[9.5px] text-emerald-805 font-extrabold bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full inline-block leading-normal">
                                            ✨ Tạo hồ sơ mới
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* TAB 2: HOUSEHOLDS PREVIEW */}
                      {previewTab === 'households' && (
                        <div className="space-y-3.5">
                          <p className="text-[10.5px] text-slate-500 font-semibold italic leading-relaxed">
                            💡 Định lý rà soát hộ: Nếu địa chỉ và chủ hộ khớp nhau với hộ đang quản lý trên cổng, hệ thống sẽ gộp và tránh lặp gia đình, chỉ bổ sung con em / thành viên mới vào cùng một sơ đồ số nhà.
                          </p>

                          <div className="border border-slate-150 rounded-xl overflow-hidden shadow-sm bg-white">
                            <table className="w-full text-left text-[11px] font-sans border-collapse">
                              <thead className="bg-slate-100 text-slate-550 font-bold border-b border-slate-200">
                                <tr>
                                  <th className="px-3 py-2.5">Đại diện Chủ hộ</th>
                                  <th className="px-3 py-2.5">Số nhà / Đường địa chỉ</th>
                                  <th className="px-3 py-2.5">Nhóm Tổ</th>
                                  <th className="px-3 py-2.5 text-center">Mã số trích xuất</th>
                                  <th className="px-3 py-2.5 text-center">Thời hạn định cư</th>
                                  <th className="px-3 py-2.5 text-center">Trạng thái rà khớp</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-150 bg-white">
                                {parsedHouseholds.map((hh) => (
                                  <tr key={hh.id} className={`hover:bg-slate-50/40 font-medium text-slate-707 ${hh.alreadyExists ? 'bg-indigo-50/10' : ''}`}>
                                    <td className="px-3 py-2 font-extrabold text-slate-900">{hh.ownerName || 'Chưa xác định chủ hộ'}</td>
                                    <td className="px-3 py-2 text-slate-550 font-semibold">{hh.address}</td>
                                    <td className="px-3 py-2 text-slate-650 font-bold">{hh.neighborhoodGroup || 'Tổ dân phố 1'}</td>
                                    <td className="px-3 py-2 text-center font-mono text-[10px] tracking-wider text-slate-400">{hh.id}</td>
                                    <td className="px-3 py-2 text-center">
                                      <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${hh.status === 'Tạm trú' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                        {hh.status || 'Thường trú'}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      {hh.alreadyExists ? (
                                        <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                          ⚠️ Hộ đã tồn tại (Gộp liên kết)
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                          ✨ Hộ mới (Lập sổ riêng)
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* TAB 3: MISSING CELLS */}
                      {previewTab === 'missing' && (
                        <div className="space-y-3">
                          <p className="text-[10.5px] text-slate-500 font-semibold italic leading-relaxed">
                            ⚠️ Danh mục hồ sơ nguồn bị thiếu trường tùy chọn (Số CCCD, Số điện thoại hoặc Ngày sinh). Nhấp thẳng trực tiếp vào ô trống để bổ sung giá trị để hồ sơ hành chính có độ sạch cao nhất.
                          </p>

                          <div className="border border-slate-150 rounded-xl overflow-hidden shadow-sm bg-white">
                            <table className="w-full text-left text-[11px] font-sans border-collapse">
                              <thead className="bg-slate-100 text-slate-550 font-bold border-b border-slate-200">
                                <tr>
                                  <th className="px-3 py-2.5">Họ tên cư dân</th>
                                  <th className="px-3 py-2.5">Số CCCD / CMND</th>
                                  <th className="px-3 py-2.5">Ngày sinh</th>
                                  <th className="px-3 py-2.5">Số điện thoại</th>
                                  <th className="px-3 py-2.5">Công việc / Nghề</th>
                                  <th className="px-3 py-2.5">Vai trò quan hệ</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-150 bg-white">
                                {uploadParsedData.filter(r => !r.idCard || !r.dob || !r.phone).map((item) => {
                                  const isEditingIdCard = editingResidentId === item.id && editingField === 'idCard';
                                  const isEditingDob = editingResidentId === item.id && editingField === 'dob';
                                  const isEditingPhone = editingResidentId === item.id && editingField === 'phone';
                                  const isEditingOccup = editingResidentId === item.id && editingField === 'occupation';

                                  return (
                                    <tr key={item.id} className="hover:bg-slate-50/40 text-slate-707 font-medium">
                                      <td className="px-3 py-2 font-extrabold text-slate-900">{item.name}</td>
                                      
                                      {/* idCard missing cell */}
                                      <td className="px-3 py-2 cursor-pointer hover:bg-slate-100/70 font-mono" onClick={() => handleStartInlineEdit(item.id, 'idCard', item.idCard)}>
                                        {isEditingIdCard ? (
                                          <input
                                            type="text"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onBlur={handleSaveInlineEdit}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSaveInlineEdit()}
                                            className="border border-emerald-500 rounded px-1 w-full bg-white text-[10.5px] font-mono"
                                            autoFocus
                                          />
                                        ) : (
                                          <span className={item.idCard ? 'text-indigo-950 font-bold' : 'text-red-500 font-bold italic'}>
                                            {item.idCard || '⚠️ Thiếu CCCD'}
                                          </span>
                                        )}
                                      </td>

                                      {/* dob missing cell */}
                                      <td className="px-3 py-2 cursor-pointer hover:bg-slate-100/70" onClick={() => handleStartInlineEdit(item.id, 'dob', item.dob)}>
                                        {isEditingDob ? (
                                          <input
                                            type="text"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onBlur={handleSaveInlineEdit}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSaveInlineEdit()}
                                            className="border border-emerald-500 rounded px-1 w-full bg-white text-[10.5px]"
                                            autoFocus
                                          />
                                        ) : (
                                          <span className={item.dob ? 'text-slate-600' : 'text-red-500 font-bold italic'}>
                                            {item.dob || '⚠️ Thiếu ngày sinh'}
                                          </span>
                                        )}
                                      </td>

                                      {/* phone missing cell */}
                                      <td className="px-3 py-2 cursor-pointer hover:bg-slate-100/70 font-mono" onClick={() => handleStartInlineEdit(item.id, 'phone', item.phone)}>
                                        {isEditingPhone ? (
                                          <input
                                            type="text"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onBlur={handleSaveInlineEdit}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSaveInlineEdit()}
                                            className="border border-emerald-500 rounded px-1 w-full bg-white text-[10.5px]"
                                            autoFocus
                                          />
                                        ) : (
                                          <span className={item.phone ? 'text-slate-700' : 'text-slate-400 italic'}>
                                            {item.phone || '- Trống -'}
                                          </span>
                                        )}
                                      </td>

                                      {/* Occupation Cell */}
                                      <td className="px-3 py-2 cursor-pointer hover:bg-slate-100/70 text-slate-550" onClick={() => handleStartInlineEdit(item.id, 'occupation', item.occupation)}>
                                        {isEditingOccup ? (
                                          <input
                                            type="text"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onBlur={handleSaveInlineEdit}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSaveInlineEdit()}
                                            className="border border-emerald-500 rounded px-1 w-full bg-white text-[10.5px]"
                                            autoFocus
                                          />
                                        ) : (
                                          <span>{item.occupation || '- Trống -'}</span>
                                        )}
                                      </td>

                                      <td className="px-3 py-2 text-slate-450 font-bold">{item.note || 'Thành viên'}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: DELUXE SUMMARY SUCCESS REPORT AFTER SYNCHRONIZATION */}
              {importStep === 4 && importReport && (
                <div className="space-y-6 animate-fadeIn font-sans p-2">
                  <div className="bg-emerald-50 border border-emerald-150 rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center text-white text-2xl shrink-0 shadow-lg font-black">
                      ✓
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-emerald-950 uppercase">ĐỒNG BỘ DỮ LIỆU CƯ DÂN KHU PHỐ THÀNH CÔNG</h4>
                      <p className="text-emerald-800 text-[11px] font-semibold leading-relaxed">
                        Mô hình AI và bộ đối chuẩn dữ liệu học sâu đã đối soát, chuẩn hóa dữ liệu hành chính và đồng bộ danh sách cư dân an toàn vào cơ sở dữ liệu số của Khu phố.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
                    {/* 5 key metrics */}
                    <div className="bg-white border border-slate-150 rounded-xl p-3 text-center shadow-sm">
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase block truncate">TỔNG ĐỌC TỪ TỆP</span>
                      <p className="text-lg font-black text-slate-800 mt-1">{importReport.totalRecordsCount} cư dân</p>
                    </div>
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 text-center shadow-sm text-emerald-850">
                      <span className="text-[10px] text-emerald-700 font-extrabold uppercase block truncate">HỘ MỚI KHỞI TẠO</span>
                      <p className="text-lg font-black mt-1">+{importReport.newHouseholdsCount} hộ</p>
                    </div>
                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 text-center shadow-sm text-indigo-850">
                      <span className="text-[10px] text-indigo-700 font-extrabold uppercase block truncate">HỘ ĐÃ TRÙNG GỘP</span>
                      <p className="text-lg font-black mt-1">+{importReport.skippedHouseholdsCount} hộ</p>
                    </div>
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 text-center shadow-sm text-emerald-850">
                      <span className="text-[10px] text-emerald-700 font-extrabold uppercase block truncate">NHÂN KHẨU MỚI</span>
                      <p className="text-lg font-black mt-1">+{importReport.newResidentsCount} dân</p>
                    </div>
                    <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-3 text-center shadow-sm text-orange-850">
                      <span className="text-[10px] text-orange-700 font-extrabold uppercase block truncate">TRÙNG LẶP BỎ QUA</span>
                      <p className="text-lg font-black mt-1">+{importReport.skippedResidentsCount} dân</p>
                    </div>
                  </div>

                  {/* Processing logs from AI */}
                  <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm space-y-3.5">
                    <h4 className="font-extrabold text-[11px] text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                      <span>⚙️ NHẬT KÝ KIỂM CHUẨN XỬ LÝ CỦA TRÍ TUỆ NHÂN TẠO (AI MODEL):</span>
                    </h4>
                    <div className="bg-slate-900 text-emerald-400 font-mono text-[10.5px] p-3 rounded-xl max-h-52 overflow-y-auto space-y-2 leading-relaxed shadow-inner">
                      {importReport.aiLogMessages.map((msg, idx) => (
                        <div key={idx} className="flex gap-2.5 items-start">
                          <span className="text-slate-500 shrink-0">[{idx + 1}]</span>
                          <span className="text-slate-200">{msg}</span>
                        </div>
                      ))}
                      {importReport.aiLogMessages.length === 0 && (
                        <div className="text-slate-500 italic">Không tìm thấy bản ghi nhật ký.</div>
                      )}
                    </div>
                  </div>

                  {/* Suspicious note notification if levels of suspects were registered */}
                  {importReport.suspectedCheckedCount > 0 && (
                    <div className="bg-orange-50/50 border border-orange-150 rounded-xl p-3.5 text-[11px] font-semibold text-orange-850 leading-relaxed">
                      ⚠️ <strong>Lưu ý:</strong> Hệ thống đã phát hiện và ghi lưu <strong>{importReport.suspectedCheckedCount}</strong> trường hợp danh tánh trùng họ tên nghi ngờ (Mức 3). Các trường hợp này được hiển thị và cần cán bộ phối hợp kiểm soát lại thủ công tại màn hình cư dân.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Actions Frame */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-between gap-3 shrink-0">
              <div>
                {importStep > 1 && (
                  <button
                    onClick={() => {
                      if (importStep === 3) {
                        setImportStep(2);
                      } else if (importStep === 2) {
                        setImportStep(1);
                        setSelectedFiles([]);
                      }
                    }}
                    disabled={isParsing}
                    className="py-2 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-705 font-bold text-xs rounded-xl cursor-pointer hover:scale-101 active:scale-99 transition-all"
                  >
                    Quay lại
                  </button>
                )}
              </div>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsImportFileOpen(false);
                    setImportStep(1);
                    setSelectedFiles([]);
                    setUploadParsedData([]);
                  }}
                  disabled={isParsing}
                  className="py-2 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-705 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Hủy bỏ
                </button>

                {importStep === 1 && (
                  <button
                    onClick={() => setImportStep(2)}
                    className="py-2 px-5 bg-gradient-to-r from-emerald-850 to-teal-800 hover:from-emerald-700 hover:to-teal-600 text-white font-extrabold text-xs rounded-xl cursor-pointer shadow hover:scale-101 active:scale-99 transition-all"
                  >
                    Tiếp theo: Chọn tệp...
                  </button>
                )}

                {importStep === 2 && (
                  <button
                    onClick={processAndAnalyzeWithAI}
                    disabled={selectedFiles.length === 0 || isParsing}
                    className={`py-2 px-5 font-black text-xs rounded-xl cursor-pointer flex items-center gap-1 shadow transition-all ${
                      selectedFiles.length > 0 && !isParsing
                        ? 'bg-gradient-to-r from-emerald-850 to-teal-800 hover:from-emerald-700 hover:to-teal-600 text-white hover:scale-101 active:scale-99 shadow-emerald-100'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none border-none'
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isParsing ? 'animate-spin' : ''}`} />
                    <span>CHẠY TRÍCH XUẤT AI</span>
                  </button>
                )}

                {importStep === 3 && (
                  <button
                    onClick={handleConfirmSyncUpload}
                    className="py-2 px-6 bg-gradient-to-r from-emerald-850 to-teal-800 hover:from-emerald-700 hover:to-teal-600 text-white font-extrabold text-xs rounded-xl cursor-pointer flex items-center gap-1.5 shadow hover:scale-101 active:scale-99 shadow-emerald-100 transition-all"
                  >
                    <UserCheck className="w-4 h-4 text-emerald-200" />
                    <span>ĐỒNG BỘ CƠ SỞ DỮ LIỆU</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reusable Sandbox-compliant Custom Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn font-sans">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100 flex flex-col p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-650">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <Trash className="w-5 h-5 text-red-650" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-slate-900 text-sm">{deleteConfirm.title}</h4>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono truncate">MÃ SỐ: {deleteConfirm.id}</p>
              </div>
            </div>
            
            <p className="text-slate-600 text-xs font-semibold leading-relaxed">
              {deleteConfirm.message}
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 sm:py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-705 font-bold text-xs rounded-xl cursor-pointer transition-all border border-slate-205"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteConfirm.type === 'resident') {
                    onDeleteResident(deleteConfirm.id);
                  } else if (deleteConfirm.type === 'household') {
                    setHouseholds(households.filter(p => p.id !== deleteConfirm.id));
                  } else if (deleteConfirm.type === 'temp_household') {
                    setTemporaryHouseholds(temporaryHouseholds.filter(p => p.id !== deleteConfirm.id));
                  }
                  setDeleteConfirm(null);
                }}
                className="flex-1 py-2 sm:py-2.5 px-4 bg-red-605 hover:bg-red-650 text-black font-extrabold text-xs rounded-xl cursor-pointer transition-all shadow-md shadow-red-100 border border-red-200"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reusable Custom Leader Change Confirmation Modal */}
      {leaderChangeConfirm && (() => {
        const isTemp = leaderChangeConfirm.householdId.startsWith('htt_') || temporaryHouseholds.some(h => h.id === leaderChangeConfirm.householdId);
        const currentHList = isTemp ? temporaryHouseholds : households;
        const hObj = currentHList.find(h => h.id === leaderChangeConfirm.householdId);
        if (!hObj) return null;

        return (
          <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fadeIn font-sans text-xs">
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100 flex flex-col p-6 space-y-4">
              <div className="flex items-center gap-3 text-amber-600">
                <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                  <span className="text-lg">👑</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-slate-900 text-sm uppercase">Cử chủ hộ mới</h4>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono truncate">MỖI HỘ: {hObj.id}</p>
                </div>
              </div>
              
              <div className="text-slate-600 text-xs font-semibold leading-relaxed space-y-2">
                <p>
                  Bạn có chắc chắn muốn thay đổi Chủ hộ của gia đình này từ <strong className="text-rose-800">"{hObj.ownerName}"</strong> sang <strong className="text-blue-800">"{leaderChangeConfirm.newLeader.name}"</strong> không?
                </p>
                <ul className="list-disc pl-4 space-y-1 text-slate-500 font-medium text-[11px]">
                  <li>Tên và CCCD trên Hộ khẩu sẽ được cập nhật sang chủ hộ mới.</li>
                  <li>Hệ thống giữ nguyên toàn bộ các nhân khẩu đồng cư và địa chỉ.</li>
                  <li>Vị trí việc làm / Quan hệ gia đình sẽ tự động đồng bộ hóa.</li>
                </ul>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setLeaderChangeConfirm(null)}
                  className="flex-1 py-2 sm:py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-705 font-bold text-xs rounded-xl cursor-pointer transition-all border border-slate-205"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const householdId = leaderChangeConfirm.householdId;
                    const newLeader = leaderChangeConfirm.newLeader;

                    // 1. Update household details
                    const updatedH = {
                      ...hObj,
                      ownerName: newLeader.name,
                      idCard: newLeader.idCard,
                      phone: newLeader.phone || hObj.phone
                    };

                    if (isTemp) {
                      setTemporaryHouseholds(prev => prev.map(h => h.id === householdId ? updatedH : h));
                    } else {
                      setHouseholds(prev => prev.map(h => h.id === householdId ? updatedH : h));
                    }

                    // 2. Clear old leader's occupation
                    const oldLeader = residents.find(r => r.idCard === hObj.idCard);
                    if (oldLeader) {
                      onUpdateResident({
                        ...oldLeader,
                        occupation: 'Thành viên gia đình'
                      });
                    }

                    // 3. Update new leader's occupation
                    onUpdateResident({
                      ...newLeader,
                      occupation: isTemp ? 'Chủ hộ tạm trú' : 'Chủ hộ gia đình'
                    });

                    // 4. Update preview & editing reactive states
                    if (previewHousehold && previewHousehold.id === householdId) {
                      setPreviewHousehold(updatedH);
                    }
                    if (editingHousehold && editingHousehold.id === householdId) {
                      setEditingHousehold(updatedH);
                      setEditHOwnerName(newLeader.name);
                      setEditHIdCard(newLeader.idCard);
                      setEditHPhone(newLeader.phone || hObj.phone || '');
                    }

                    setLeaderChangeConfirm(null);
                    alert(`Thay đổi chủ hộ thành công! "${newLeader.name}" đã chính thức trở thành Chủ hộ mới.`);
                  }}
                  className="flex-1 py-2 sm:py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl cursor-pointer transition-all shadow-md shadow-amber-100 border border-amber-600"
                >
                  Xác nhận thay đổi
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Reusable Sandbox-compliant Custom Clear All Confirmation Modal */}
      {isClearAllConfirmOpen && (
        <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn font-sans">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100 flex flex-col p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-650">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <Trash className="w-5 h-5 text-red-650" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-slate-900 text-sm">CẢNH BÁO CỰC KỲ QUAN TRỌNG</h4>
                <p className="text-[10px] text-red-600 uppercase tracking-widest font-black font-mono">Thử nghiệm hệ thống</p>
              </div>
            </div>
            
            <div className="space-y-2 text-slate-600 text-xs font-semibold leading-relaxed">
              <p>
                Thao tác này sẽ <strong className="text-red-600 font-extrabold">XÓA VĨNH VIỄN SẠCH SẼ</strong> toàn bộ:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                <li>Tất cả nhân khẩu thường trú</li>
                <li>Tất cả nhân khẩu tạm trú</li>
                <li>Tất cả nhân khẩu tạm vắng & vãng lai</li>
                <li>Toàn bộ sổ hộ khẩu thường trú</li>
                <li>Toàn bộ sổ hộ tạm trú trong hệ thống</li>
              </ul>
              <p className="mt-2 text-slate-500 italic text-[11px]">
                Hành động này phục vụ việc dọn các dữ liệu mẫu cũ để bạn có thể nạp dữ liệu thật bằng AI, XLSX dễ dàng, không thể hoàn tác!
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsClearAllConfirmOpen(false)}
                className="flex-1 py-2 sm:py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-705 font-bold text-xs rounded-xl cursor-pointer transition-all border border-slate-205"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={confirmClearAllData}
                className="flex-1 py-2 sm:py-2.5 px-4 bg-red-605 hover:bg-red-650 text-black font-extrabold text-xs rounded-xl cursor-pointer transition-all shadow-md shadow-red-100 border border-red-200 uppercase tracking-wider"
              >
                Xác nhận xóa sạch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CẬP NHẬT HỒ SƠ HỘ GIA ĐÌNH & ĐỒNG BỘ */}
      {editingHousehold && (() => {
        const matchedMembers = residents.filter(r => {
          if (r.householdId && editingHousehold.id && r.householdId === editingHousehold.id) return true;
          if (!r.address || !editingHousehold.address) return !!(r.idCard && editingHousehold.idCard && r.idCard === editingHousehold.idCard);
          return isSameAddress(r.address, editingHousehold.address) || !!(r.idCard && editingHousehold.idCard && r.idCard === editingHousehold.idCard);
        });

        return (
          <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn font-sans text-xs">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-900 to-indigo-800 text-white px-5 py-3.5 font-bold flex justify-between items-center shrink-0 shadow-md">
                <div className="flex items-center gap-2">
                  <span className="text-sm">📝</span>
                  <h3 className="text-[11px] uppercase tracking-wider font-black">CẬP NHẬT HỒ SƠ HỘ GIA ĐÌNH & ĐỒNG BỘ</h3>
                </div>
                <button 
                  onClick={() => setEditingHousehold(null)} 
                  className="text-white hover:text-white/80 font-bold text-xl select-none cursor-pointer"
                >
                  ×
                </button>
              </div>

              {/* Form Body */}
              <div className="p-6 overflow-y-auto flex-1 min-h-0 space-y-4 bg-slate-50/50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Tên chủ hộ */}
                  <div className="flex flex-col gap-1.5 label-input-group">
                    <label className="text-slate-500 font-bold text-[10.5px] uppercase">Chủ hộ gia đình <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={editHOwnerName}
                      onChange={(e) => setEditHOwnerName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-250 rounded-xl focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-semibold text-slate-800 outline-none text-xs"
                      placeholder="Nhập họ & tên chủ hộ"
                    />
                  </div>

                  {/* Số CCCD / CMND chủ hộ */}
                  <div className="flex flex-col gap-1.5 label-input-group">
                    <label className="text-slate-500 font-bold text-[10.5px] uppercase">CCCD/CMND chủ hộ <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={editHIdCard}
                      onChange={(e) => setEditHIdCard(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-250 rounded-xl focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-mono text-slate-800 outline-none text-xs"
                      placeholder="Căn cước công dân"
                    />
                  </div>

                  {/* SĐT */}
                  <div className="flex flex-col gap-1.5 label-input-group">
                    <label className="text-slate-500 font-bold text-[10.5px] uppercase">Số điện thoại liên hệ</label>
                    <input
                      type="text"
                      value={editHPhone}
                      onChange={(e) => setEditHPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-250 rounded-xl focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-mono text-slate-800 outline-none text-xs"
                      placeholder="09xx..."
                    />
                  </div>

                  {/* Tổ dân phố */}
                  <div className="flex flex-col gap-1.5 label-input-group">
                    <label className="text-slate-500 font-bold text-[10.5px] uppercase">Tổ dân phố</label>
                    <select
                      value={editHNeighborhoodGroup}
                      onChange={(e) => setEditHNeighborhoodGroup(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-250 rounded-xl focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-semibold text-slate-800 outline-none text-xs"
                    >
                      {dynamicNeighborhoodGroups.map(grp => (
                        <option key={grp} value={grp}>{grp}</option>
                      ))}
                    </select>
                  </div>

                  {/* Vĩ độ (Latitude) */}
                  <div className="flex flex-col gap-1.5 label-input-group">
                    <label className="text-slate-500 font-bold text-[10.5px] uppercase">Vĩ độ (Latitude)</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={editHLat}
                      onChange={(e) => setEditHLat(e.target.value !== '' ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2 bg-white border border-slate-250 rounded-xl focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-mono text-slate-800 outline-none text-xs"
                      placeholder="Ví dụ: 10.936000"
                    />
                  </div>

                  {/* Kinh độ (Longitude) */}
                  <div className="flex flex-col gap-1.5 label-input-group">
                    <label className="text-slate-500 font-bold text-[10.5px] uppercase">Kinh độ (Longitude)</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={editHLng}
                      onChange={(e) => setEditHLng(e.target.value !== '' ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2 bg-white border border-slate-250 rounded-xl focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-mono text-slate-800 outline-none text-xs"
                      placeholder="Ví dụ: 106.721000"
                    />
                  </div>
                </div>

                {/* Địa chỉ đăng ký cư trú */}
                <div className="flex flex-col gap-1.5 label-input-group">
                  <div className="flex justify-between items-center">
                    <label className="text-slate-500 font-bold text-[10.5px] uppercase">Địa chỉ đăng ký cư trú <span className="text-red-500">*</span></label>
                    <label
                      title="Tự động đồng bộ địa chỉ & tổ dân phố cho tất cả thành viên trong hộ"
                      className="flex items-center gap-1.5 cursor-pointer text-blue-700 hover:text-blue-900 transition-colors select-none group"
                    >
                      <input
                        type="checkbox"
                        checked={editHSyncMembers}
                        onChange={(e) => setEditHSyncMembers(e.target.checked)}
                        className="w-3.5 h-3.5 text-blue-650 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                      <RefreshCw className={`w-3.5 h-3.5 text-blue-700 group-hover:rotate-180 transition-transform duration-500 ${editHSyncMembers ? "animate-spin" : ""}`} />
                      <span className="text-[9.5px] font-extrabold tracking-wide">ĐỒNG BỘ THÀNH VIÊN</span>
                    </label>
                  </div>
                  <textarea
                    rows={2}
                    value={editHAddress}
                    onChange={(e) => setEditHAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-250 rounded-xl focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-semibold text-slate-800 outline-none text-xs resize-none"
                    placeholder="Số nhà, tên đường, khu..."
                  />
                </div>

                {/* Thành viên hiện tại */}
                <div className="space-y-2 border-t border-slate-200/60 pt-3">
                  <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                    👥 Nhân khẩu có cùng địa dư cư trú trong hệ thống ({matchedMembers.length} người)
                  </h4>
                  {matchedMembers.length > 0 ? (
                    <div className="max-h-24 overflow-y-auto divide-y divide-slate-100 bg-white border border-slate-205 rounded-xl px-3 shadow-inner">
                      {matchedMembers.map((m) => (
                        <div key={m.id} className="py-2 flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">{m.name}</span>
                            {((m.idCard && m.idCard === editingHousehold.idCard) || m.name.toLowerCase().trim() === editingHousehold.ownerName.toLowerCase().trim()) && (
                              <span className="px-1.5 py-0.2 bg-amber-50 text-amber-800 font-extrabold text-[8px] rounded-lg border border-amber-200">CHỦ HỘ</span>
                            )}
                          </div>
                          <span className="text-slate-400 font-mono text-[10px]">{m.idCard}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-450 italic text-[10.5px]">Chưa ghi nhận nhân khẩu nào đăng ký cùng địa dư.</p>
                  )}
                </div>


              </div>

              {/* Action bar */}
              <div className="bg-slate-50 border-t border-slate-205 px-5 py-3.5 flex justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingHousehold(null)}
                  className="py-2.5 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-705 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Bỏ qua
                </button>
                <button
                  type="button"
                  onClick={handleSaveHouseholdEdit}
                  className="py-2.5 px-5 bg-blue-800 hover:bg-blue-700 font-bold text-xs text-white rounded-xl shadow cursor-pointer uppercase font-sans tracking-wide"
                >
                  Xác nhận lưu
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Citizen Identity Certificate / Resident miniature Card */}
      {previewResident && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn font-sans text-xs">
          <div className="bg-white rounded-3xl w-full max-w-xl max-h-[92vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col animate-fadeIn font-sans">
            {/* Header tab */}
            <div className="bg-gradient-to-r from-blue-900 to-indigo-800 text-white px-6 py-3.5 font-bold flex justify-between items-center shrink-0 shadow-md">
              <div className="flex items-center gap-2">
                <span className="text-sm">💳</span>
                <h3 className="text-[10.5px] uppercase tracking-wider font-black">XEM TRƯỚC THẺ CĂN CƯỚC CÔNG DÂN THU NHỎ</h3>
              </div>
              <button 
                onClick={() => setPreviewResident(null)} 
                className="text-white hover:text-white/80 font-bold text-xl select-none cursor-pointer mb-0.5"
              >
                ×
              </button>
            </div>

            {/* Simulated National ID Card Body */}
            <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 custom-scrollbar">
              
              {/* Left Column: Simulated National ID Card */}
              <div className="w-full flex flex-col justify-start">
                <p className="text-[10px] font-black text-slate-450 uppercase tracking-widest mb-3 text-center font-sans">Thẻ Căn cước công dân thu nhỏ</p>
                
                <div className="relative border-2 border-amber-550/60 bg-gradient-to-br from-cyan-50/20 via-sky-50/40 to-indigo-50/30 p-5 rounded-2xl shadow-inner overflow-hidden bg-white">
                  {/* Emblem watermarks and general traditional decorations */}
                  <div className="absolute inset-0 bg-radial-at-c from-transparent via-transparent to-indigo-500/5 pointer-events-none" />
                  
                  {/* Traditional State Text */}
                  <div className="text-center space-y-0.5 relative z-10">
                    <p className="text-[9.5px] font-black text-red-750 tracking-wide uppercase font-sans">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                    <p className="text-[8.5px] font-bold text-slate-800 border-b border-amber-400/40 pb-2 max-w-[200px] mx-auto">Độc lập - Tự do - Hạnh phúc</p>
                  </div>

                  <div className="flex justify-between items-center mt-3 relative z-10">
                    <span className="text-[9.5px] text-blue-900 font-extrabold tracking-wide uppercase">CĂN CƯỚC CÔNG DÂN / CITIZEN IDENTITY CARD</span>
                    <span className="text-[8.5px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-100/60 px-2 py-0.5 rounded-full uppercase">{previewResident.status}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-4 relative z-10">
                    {/* Left Column: Portrait photo mock and RFID Chip */}
                    <div className="col-span-1 space-y-3">
                      <div className="w-full aspect-[3/4] bg-slate-105 border border-slate-205 rounded-xl flex flex-col justify-center items-center shadow-sm relative overflow-hidden">
                        {previewResident.gender === 'Nam' ? (
                          <span className="text-3xl text-slate-400 select-none">👤</span>
                        ) : (
                          <span className="text-3xl text-slate-400 select-none">👩</span>
                        )}
                        <div className="absolute bottom-0 inset-x-0 bg-slate-800/65 py-1 text-center">
                          <span className="text-[7.5px] text-white tracking-widest font-bold uppercase font-mono">{previewResident.gender}</span>
                        </div>
                        
                        {/* Holographic lens overlay */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-teal-500/10 to-transparent rotate-45 pointer-events-none" />
                        {/* Safety verified red round circular stroke mock */}
                        <div className="absolute -bottom-2 -left-2 w-8 h-8 rounded-full border border-red-500/40 pointer-events-none flex items-center justify-center">
                          <span className="text-[5px] text-red-500/40 rotate-12 font-bold uppercase font-mono">BDH KP3</span>
                        </div>
                      </div>

                      {/* Simulated RFID Chip */}
                      <div className="w-9 h-7 bg-gradient-to-br from-amber-400 to-yellow-300 rounded-md border border-amber-500 flex flex-col justify-between p-1 shadow-sm mx-auto shrink-0 animate-pulse">
                        <div className="h-[1px] bg-amber-600/35 rounded-full w-full"></div>
                        <div className="flex justify-between gap-1 h-2">
                          <div className="w-1 bg-amber-600/35 rounded-full"></div>
                          <div className="w-2 bg-amber-600/35 rounded-full"></div>
                          <div className="w-1 bg-amber-600/35 rounded-full"></div>
                        </div>
                        <div className="h-[1px] bg-amber-600/35 rounded-full w-full"></div>
                      </div>
                    </div>

                    {/* Right Column: Key Details */}
                    <div className="col-span-2 space-y-2 text-[10px] text-slate-650">
                      <div className="space-y-0.5">
                        <span className="text-[8px] text-slate-400 uppercase tracking-widest font-bold block">Họ và Tên / Full Name</span>
                        <strong className="text-uppercase text-slate-900 font-extrabold text-sm block tracking-wide">{previewResident.name}</strong>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[8px] text-slate-400 uppercase tracking-widest font-bold block">Số Căn cước / Personal ID No.</span>
                        <p className="font-mono font-black text-rose-700 text-xs tracking-wider">{previewResident.idCard}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-0.5">
                          <span className="text-[8px] text-slate-400 uppercase tracking-widest font-bold block">Ngày sinh / DOB</span>
                          <span className="text-slate-800 font-bold">{previewResident.dob}</span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[8px] text-slate-400 uppercase tracking-widest font-bold block">Tổ dân phố / TDP</span>
                          <span className="text-slate-800 font-bold">{previewResident.neighborhoodGroup || 'N/A'}</span>
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[8px] text-slate-400 uppercase tracking-widest font-bold block">Nơi cư trú / Place of Residence</span>
                        <p className="text-slate-705 font-semibold leading-relaxed line-clamp-2">{previewResident.address}</p>
                      </div>
                    </div>
                  </div>

                  {/* Additional secondary parameters */}
                  <div className="mt-4 pt-3 border-t border-slate-150 grid grid-cols-2 gap-3 text-[10px] text-slate-600 relative z-10">
                    <div className="space-y-0.5">
                      <span className="text-[8px] text-slate-400 uppercase tracking-widest font-bold block">Điện thoại di động</span>
                      <span className="font-mono font-bold text-slate-800">{previewResident.phone || 'Chưa cập nhật'}</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[8px] text-slate-400 uppercase tracking-widest font-bold block">Nghề nghiệp / Trình độ</span>
                      <span className="text-slate-800 font-bold truncate block">{previewResident.occupation || 'Tự do'}</span>
                    </div>
                  </div>

                  {/* Đoàn thể & Nhãn diện tương ứng with dropdown integration picker */}
                  <div className="mt-3 space-y-1 relative z-20">
                    <div className="flex justify-between items-center bg-slate-50/50 p-1 rounded-lg border border-slate-100">
                      <span className="text-[8px] text-slate-505 font-black uppercase tracking-widest block">ĐOÀN THỂ & DIỆN CHÍNH SÁCH</span>
                      

                    </div>

                    {/* Tags list container */}
                    <div className="flex flex-wrap gap-1 min-h-[22px] mt-1">
                      {residentCodeList.length > 0 ? (
                        residentCodeList.map((tagCode) => {
                          const matchingOrg = (organizations || []).find(o => o.code === tagCode || o.id === tagCode);
                          if (!matchingOrg) return null;
                          const spec = getCompactTagSpecs(tagCode, matchingOrg.name);
                          return (
                            <button
                              type="button"
                              key={tagCode}
                              onClick={() => {
                                if (onNavigateToPolicyGroup) {
                                  onNavigateToPolicyGroup(tagCode);
                                }
                              }}
                              title={`${matchingOrg.name} (${matchingOrg.description || ''}) - Nhấp để xem danh sách`}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-extrabold border shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer ${spec.bg}`}
                            >
                              <span className="text-[10px]">{spec.icon}</span>
                              <span>{spec.shortName}</span>
                            </button>
                          );
                        })
                      ) : (
                        <span className="text-[9px] text-slate-400 italic">Cư dân chưa có ban ngành hay diện chính sách nào</span>
                      )}
                    </div>
                  </div>

                  {previewResident.note && (
                    <div className="mt-3 p-2 bg-slate-100 rounded-lg text-[9.5px] text-slate-500 font-semibold italic border-l-2 border-slate-400 relative z-10">
                      Note: {previewResident.note}
                    </div>
                  )}

                  {/* Simulated Hologram Barcodes */}
                  <div className="mt-4 pt-3 border-t border-slate-150 flex items-center justify-between relative z-10">
                    {/* barcode scan */}
                    <div className="flex gap-[1px] h-6 bg-white p-1 rounded border border-slate-200">
                      {Array.from({ length: 18 }).map((_, i) => (
                        <div key={i} className="bg-slate-900 h-full" style={{ width: `${(i % 3 === 0 ? 2 : i % 2 === 0 ? 0.75 : 1.25)}px` }}></div>
                      ))}
                    </div>

                    {/* Red stamp */}
                    <div className="border border-rose-500 rounded-full h-10 w-10 flex items-center justify-center p-0.5 rotate-[12deg] text-center opacity-80 scale-90 shrink-0 select-none">
                      <div className="border border-dashed border-rose-500 rounded-full h-full w-full flex items-center justify-center text-[5.5px] text-rose-500 font-black leading-none uppercase">
                        BDH KP3
                        <br />
                        AN PHÚ
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Dynamic Checklist for quick enrolment (Hidden as requested) */}
              <div className="hidden">
                <div className="space-y-4">
                  <div className="border-b border-slate-150 pb-2.5">
                    <h4 className="text-xs font-black text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                      <span>⚡</span> TÍCH HỢP BAN NGÀNH & ĐOÀN THỂ NHANH
                    </h4>
                    <p className="text-[10px] text-slate-450 font-bold leading-relaxed mt-1">
                      Tích chọn các ô bên dưới để nhanh chóng kết nạp hoặc rút tên cư dân khỏi các ban ngành, diện chính sách. Sự thay đổi sẽ tự động cập nhật thời gian thực vào danh sách thành viên của ban ngành tương ứng.
                    </p>

                    {/* AI Automated Data Quality Warning */}
                    {(() => {
                      const warnings = getResidentAnomalies(previewResident, residents);
                      if (warnings.length === 0) return null;
                      return (
                        <div className="mt-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-col gap-1 text-[10px] text-amber-900 shadow-sm animate-fadeIn">
                          <div className="flex items-center gap-1.5 font-bold text-amber-800 uppercase tracking-wider">
                            <span className="text-xs">⚠️</span>
                            <span>AI CẢNH BÁO BẤT THƯỜNG</span>
                          </div>
                          <ul className="list-disc pl-4 mt-1 font-semibold space-y-1 text-[9.5px]">
                            {warnings.map((w, idx) => (
                              <li key={idx} className="leading-relaxed">{w}</li>
                            ))}
                          </ul>
                          <span className="text-[8.5px] text-amber-600/90 italic font-bold mt-1 leading-tight">
                            * Gợi ý từ AI: Đề nghị kiểm tra lại tính chính xác giữa hồ sơ dân cư chính và cơ chế sinh hoạt đoàn thể.
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                    <div className="space-y-3 font-sans">
                        {/* SECTION 1: Chi bộ */}
                        <div className="border border-rose-100 rounded-xl overflow-hidden shadow-sm bg-white">
                          <button
                            type="button"
                            onClick={() => setOpenIntegrationSections(prev => ({ ...prev, chibo: !prev.chibo }))}
                            className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-rose-50/60 to-red-50/10 hover:from-rose-100/40 hover:to-red-50/25 transition text-left select-none cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm">❤️</span>
                              <span className="text-[10.5px] font-black text-rose-800 uppercase tracking-wide">
                                CHI BỘ (HỆ THỐNG ĐẢNG)
                              </span>
                              {chiBoSelectedCount > 0 ? (
                                <span className="bg-rose-100 text-rose-800 border border-rose-200 text-[8.5px] font-extrabold px-2 py-0.5 rounded-full">
                                  Đã chọn: {chiBoSelectedCount}
                                </span>
                              ) : (
                                <span className="text-[9px] text-slate-400 font-semibold italic">Đang trống</span>
                              )}
                            </div>
                            <span className="text-rose-600 text-[10px] font-bold font-mono">
                              {openIntegrationSections.chibo ? '▲ Đóng' : '▼ Mở'}
                            </span>
                          </button>

                          {openIntegrationSections.chibo && (
                            <div className="p-3 bg-rose-50/5 border-t border-rose-100 max-h-[220px] overflow-y-auto custom-scrollbar divide-y divide-slate-100/60">
                              {chiBoOrgs.length === 0 ? (
                                <p className="text-[10px] text-slate-400 italic">Không có tổ chức Đảng nào khả dụng.</p>
                              ) : (
                                chiBoOrgs.map(org => {
                                  const orgCode = org.code || org.id;
                                  const isChecked = residentCodeList.includes(orgCode);
                                  return (
                                    <label 
                                      key={org.id} 
                                      className="flex items-start gap-2.5 py-1.5 px-1.5 text-[11px] font-bold text-slate-700 cursor-pointer hover:bg-slate-50 rounded transition select-none"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        className="rounded border-slate-300 text-rose-700 focus:ring-rose-750 shrink-0 cursor-pointer w-4 h-4 mt-0.5"
                                        onChange={(e) => {
                                          const currentCls = previewResident.classifications || [];
                                          const updatedCls = e.target.checked 
                                            ? (currentCls.includes(orgCode) ? currentCls : [...currentCls, orgCode])
                                            : currentCls.filter(c => c !== orgCode);
                                          
                                          const updatedRes = { ...previewResident, classifications: updatedCls };
                                          onUpdateResident(updatedRes);
                                          setPreviewResident(updatedRes);
                                        }}
                                      />
                                      <div className="flex flex-col">
                                        <span className="text-slate-805 text-[11px] font-bold">{org.name}</span>
                                        {org.description && (
                                          <span className="text-[9px] text-slate-450 font-normal leading-normal mt-0.5">{org.description}</span>
                                        )}
                                      </div>
                                    </label>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>

                        {/* SECTION 2: Chính quyền */}
                        <div className="border border-sky-100 rounded-xl overflow-hidden shadow-sm bg-white">
                          <button
                            type="button"
                            onClick={() => setOpenIntegrationSections(prev => ({ ...prev, chinhquyen: !prev.chinhquyen }))}
                            className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-sky-50/60 to-blue-50/10 hover:from-sky-100/40 hover:to-blue-50/25 transition text-left select-none cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm">🛡️</span>
                              <span className="text-[10.5px] font-black text-sky-800 uppercase tracking-wide">
                                CHÍNH QUYỀN & CHUYỂN ĐỔI SỐ
                              </span>
                              {chinhQuyenSelectedCount > 0 ? (
                                <span className="bg-sky-100 text-sky-850 border border-sky-200 text-[8.5px] font-extrabold px-2 py-0.5 rounded-full">
                                  Đã chọn: {chinhQuyenSelectedCount}
                                </span>
                              ) : (
                                <span className="text-[9px] text-slate-440 font-semibold italic">Đang trống</span>
                              )}
                            </div>
                            <span className="text-sky-600 text-[10px] font-bold font-mono">
                              {openIntegrationSections.chinhquyen ? '▲ Đóng' : '▼ Mở'}
                            </span>
                          </button>

                          {openIntegrationSections.chinhquyen && (
                            <div className="p-3 bg-sky-50/5 border-t border-sky-100 max-h-[220px] overflow-y-auto custom-scrollbar divide-y divide-slate-100/60">
                              {chinhQuyenOrgs.length === 0 ? (
                                <p className="text-[10px] text-slate-400 italic">Không có tổ chức chính quyền nào khả dụng.</p>
                              ) : (
                                chinhQuyenOrgs.map(org => {
                                  const orgCode = org.code || org.id;
                                  const isChecked = residentCodeList.includes(orgCode);
                                  return (
                                    <label 
                                      key={org.id} 
                                      className="flex items-start gap-2.5 py-1.5 px-1.5 text-[11px] font-bold text-slate-700 cursor-pointer hover:bg-slate-50 rounded transition select-none"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        className="rounded border-slate-300 text-sky-700 focus:ring-sky-750 shrink-0 cursor-pointer w-4 h-4 mt-0.5"
                                        onChange={(e) => {
                                          const currentCls = previewResident.classifications || [];
                                          const updatedCls = e.target.checked 
                                            ? (currentCls.includes(orgCode) ? currentCls : [...currentCls, orgCode])
                                            : currentCls.filter(c => c !== orgCode);
                                          
                                          const updatedRes = { ...previewResident, classifications: updatedCls };
                                          onUpdateResident(updatedRes);
                                          setPreviewResident(updatedRes);
                                        }}
                                      />
                                      <div className="flex flex-col">
                                        <span className="text-slate-805 text-[11px] font-bold">{org.name}</span>
                                        {org.description && (
                                          <span className="text-[9px] text-slate-450 font-normal leading-normal mt-0.5">{org.description}</span>
                                        )}
                                      </div>
                                    </label>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>

                        {/* SECTION 3: Đoàn thể */}
                        <div className="border border-emerald-100 rounded-xl overflow-hidden shadow-sm bg-white">
                          <button
                            type="button"
                            onClick={() => setOpenIntegrationSections(prev => ({ ...prev, doanthe: !prev.doanthe }))}
                            className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-emerald-50/60 to-green-50/10 hover:from-emerald-105/40 hover:to-green-55/25 transition text-left select-none cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm">💚</span>
                              <span className="text-[10.5px] font-black text-emerald-850 uppercase tracking-wide">
                                BAN NGÀNH, ĐOÀN THỂ THAM GIA
                              </span>
                              {doanTheSelectedCount > 0 ? (
                                <span className="bg-emerald-100 text-emerald-800 border border-emerald-250 text-[8.5px] font-extrabold px-2 py-0.5 rounded-full">
                                  Đã chọn: {doanTheSelectedCount}
                                </span>
                              ) : (
                                <span className="text-[9px] text-slate-440 font-semibold italic">Đang trống</span>
                              )}
                            </div>
                            <span className="text-emerald-650 text-[10px] font-bold font-mono">
                              {openIntegrationSections.doanthe ? '▲ Đóng' : '▼ Mở'}
                            </span>
                          </button>

                          {openIntegrationSections.doanthe && (
                            <div className="p-3 bg-emerald-50/5 border-t border-emerald-100 max-h-[220px] overflow-y-auto custom-scrollbar divide-y divide-slate-100/60">
                              {doanTheOrgs.length === 0 ? (
                                <p className="text-[10px] text-slate-400 italic">Không có tổ chức đoàn thể nào khả dụng.</p>
                              ) : (
                                doanTheOrgs.map(org => {
                                  const orgCode = org.code || org.id;
                                  const isChecked = residentCodeList.includes(orgCode);
                                  return (
                                    <label 
                                      key={org.id} 
                                      className="flex items-start gap-2.5 py-1.5 px-1.5 text-[11px] font-bold text-slate-700 cursor-pointer hover:bg-slate-50 rounded transition select-none"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-750 shrink-0 cursor-pointer w-4 h-4 mt-0.5"
                                        onChange={(e) => {
                                          const currentCls = previewResident.classifications || [];
                                          const updatedCls = e.target.checked 
                                            ? (currentCls.includes(orgCode) ? currentCls : [...currentCls, orgCode])
                                            : currentCls.filter(c => c !== orgCode);
                                          
                                          const updatedRes = { ...previewResident, classifications: updatedCls };
                                          onUpdateResident(updatedRes);
                                          setPreviewResident(updatedRes);
                                        }}
                                      />
                                      <div className="flex flex-col">
                                        <span className="text-slate-805 text-[11px] font-bold">{org.name}</span>
                                        {org.description && (
                                          <span className="text-[9px] text-slate-450 font-normal leading-normal mt-0.5">{org.description}</span>
                                        )}
                                      </div>
                                    </label>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>

                        {/* SECTION 4: Diện chính sách */}
                        <div className="border border-blue-105 rounded-xl overflow-hidden shadow-sm bg-white">
                          <button
                            type="button"
                            onClick={() => setOpenIntegrationSections(prev => ({ ...prev, chinhsach: !prev.chinhsach }))}
                            className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-blue-50/60 to-indigo-50/10 hover:from-blue-105/40 hover:to-indigo-55/25 transition text-left select-none cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm">📘</span>
                              <span className="text-[10.5px] font-black text-blue-800 uppercase tracking-wide">
                                DIỆN CHÍNH SÁCH VÀ THỤ HƯỞNG
                              </span>
                              {csSelectedCount > 0 ? (
                                <span className="bg-blue-100 text-blue-800 border border-blue-200 text-[8.5px] font-extrabold px-2 py-0.5 rounded-full">
                                  Đã chọn: {csSelectedCount}
                                </span>
                              ) : (
                                <span className="text-[9px] text-slate-440 font-semibold italic">Đang trống</span>
                              )}
                            </div>
                            <span className="text-blue-600 text-[10px] font-bold font-mono">
                              {openIntegrationSections.chinhsach ? '▲ Đóng' : '▼ Mở'}
                            </span>
                          </button>

                          {openIntegrationSections.chinhsach && (
                            <div className="p-3 bg-blue-50/5 border-t border-blue-100 max-h-[220px] overflow-y-auto custom-scrollbar divide-y divide-slate-100/60">
                              {csOrgs.length === 0 ? (
                                <p className="text-[10px] text-slate-400 italic">Không có diện chính sách nào khả dụng.</p>
                              ) : (
                                csOrgs.map(org => {
                                  const orgCode = org.code || org.id;
                                  const isChecked = residentCodeList.includes(orgCode);
                                  return (
                                    <label 
                                      key={org.id} 
                                      className="flex items-start gap-2.5 py-1.5 px-1.5 text-[11px] font-bold text-slate-700 cursor-pointer hover:bg-slate-50 rounded transition select-none"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        className="rounded border-slate-300 text-blue-850 focus:ring-blue-850 shrink-0 cursor-pointer w-4 h-4 mt-0.5"
                                        onChange={(e) => {
                                          const currentCls = previewResident.classifications || [];
                                          const updatedCls = e.target.checked 
                                            ? (currentCls.includes(orgCode) ? currentCls : [...currentCls, orgCode])
                                            : currentCls.filter(c => c !== orgCode);
                                          
                                          const updatedRes = { ...previewResident, classifications: updatedCls };
                                          onUpdateResident(updatedRes);
                                          setPreviewResident(updatedRes);
                                        }}
                                      />
                                      <div className="flex flex-col">
                                        <span className="text-slate-805 text-[11px] font-bold">{org.name}</span>
                                        {org.description && (
                                          <span className="text-[9px] text-slate-450 font-normal leading-normal mt-0.5">{org.description}</span>
                                        )}
                                      </div>
                                    </label>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>

                        {/* SECTION 5: Nhóm khác */}
                        <div className="border border-purple-100 rounded-xl overflow-hidden shadow-sm bg-white">
                          <button
                            type="button"
                            onClick={() => setOpenIntegrationSections(prev => ({ ...prev, other: !prev.other }))}
                            className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-purple-50/60 to-fuchsia-50/10 hover:from-purple-100/40 hover:to-fuchsia-55/25 transition text-left select-none cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm">🔮</span>
                              <span className="text-[10.5px] font-black text-purple-800 uppercase tracking-wide">
                                NHÓM KHÁC & HỘI TỰ QUẢN
                              </span>
                              {otherSelectedCount > 0 ? (
                                <span className="bg-purple-100 text-purple-800 border border-purple-200 text-[8.5px] font-extrabold px-2 py-0.5 rounded-full">
                                  Đã chọn: {otherSelectedCount}
                                </span>
                              ) : (
                                <span className="text-[9px] text-slate-440 font-semibold italic">Đang trống</span>
                              )}
                            </div>
                            <span className="text-purple-650 text-[10px] font-bold font-mono">
                              {openIntegrationSections.other ? '▲ Đóng' : '▼ Mở'}
                            </span>
                          </button>

                          {openIntegrationSections.other && (
                            <div className="p-3 bg-purple-50/5 border-t border-purple-100 max-h-[220px] overflow-y-auto custom-scrollbar divide-y divide-slate-100/60">
                              {otherOrgs.length === 0 ? (
                                <p className="text-[10px] text-slate-400 italic">Không có nhóm tự quản hoặc tổ chức khác nào khả dụng.</p>
                              ) : (
                                otherOrgs.map(org => {
                                  const orgCode = org.code || org.id;
                                  const isChecked = residentCodeList.includes(orgCode);
                                  return (
                                    <label 
                                      key={org.id} 
                                      className="flex items-start gap-2.5 py-1.5 px-1.5 text-[11px] font-bold text-slate-700 cursor-pointer hover:bg-slate-50 rounded transition select-none"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        className="rounded border-slate-300 text-purple-750 focus:ring-purple-750 shrink-0 cursor-pointer w-4 h-4 mt-0.5"
                                        onChange={(e) => {
                                          const currentCls = previewResident.classifications || [];
                                          const updatedCls = e.target.checked 
                                            ? (currentCls.includes(orgCode) ? currentCls : [...currentCls, orgCode])
                                            : currentCls.filter(c => c !== orgCode);
                                          
                                          const updatedRes = { ...previewResident, classifications: updatedCls };
                                          onUpdateResident(updatedRes);
                                          setPreviewResident(updatedRes);
                                        }}
                                      />
                                      <div className="flex flex-col">
                                        <span className="text-slate-805 text-[11px] font-bold">{org.name}</span>
                                        {org.description && (
                                          <span className="text-[9px] text-slate-450 font-normal leading-normal mt-0.5">{org.description}</span>
                                        )}
                                      </div>
                                    </label>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                </div>
              </div>

            </div>

            {/* Modal action tray */}
            <div className="bg-slate-100 px-6 py-4 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setPreviewResident(null)}
                className="py-2 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-705 font-bold text-xs rounded-xl cursor-pointer"
              >
                Đóng lại
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewResident(null);
                  openEditModal(previewResident);
                }}
                className="py-2 px-5 bg-blue-800 hover:bg-blue-700 font-bold text-xs text-white rounded-xl shadow cursor-pointer"
              >
                Sửa hồ sơ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sổ Hộ Khẩu / Household Registry Booklet miniature panel */}
      {previewHousehold && (() => {
        // Query co-residents living in the same home address
        const matchedMembers = residents.filter(r => {
          if (r.householdId && previewHousehold.id && r.householdId === previewHousehold.id) return true;
          if (!r.address || !previewHousehold.address) return !!(r.idCard && previewHousehold.idCard && r.idCard === previewHousehold.idCard);
          return isSameAddress(r.address, previewHousehold.address) || !!(r.idCard && previewHousehold.idCard && r.idCard === previewHousehold.idCard);
        });

        return (
          <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn font-sans text-xs">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[88vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col">
              {/* Header */}
              <div className="bg-gradient-to-r from-red-850 to-rose-900 text-white px-5 py-3 font-bold flex justify-between items-center shrink-0 shadow-md">
                <div className="flex items-center gap-2">
                  <span className="text-xs">📖</span>
                  <h3 className="text-[10px] uppercase tracking-wider font-black">XEM TRƯỚC SỔ HỘ KHẨU THU NHỎ</h3>
                </div>
                <button 
                  onClick={() => setPreviewHousehold(null)} 
                  className="text-white hover:text-white/80 font-bold text-base select-none cursor-pointer"
                >
                  ×
                </button>
              </div>
 
              {/* Sổ Hộ Khẩu Cover style layout */}
              <div className="p-4 overflow-y-auto flex-1 min-h-0 bg-slate-100">
                <div className="border-2 sm:border-3 border-amber-800 p-4 rounded-xl bg-gradient-to-br from-amber-50/75 via-stone-50 to-amber-50/50 shadow-inner min-h-[300px] flex flex-col justify-between relative bg-white">
                  {/* Decorative corner lines */}
                  <div className="absolute top-1.5 left-1.5 w-3 h-3 border-t border-l border-amber-800 opacity-45"></div>
                  <div className="absolute top-1.5 right-1.5 w-3 h-3 border-t border-r border-amber-800 opacity-45"></div>
                  <div className="absolute bottom-1.5 left-1.5 w-3 h-3 border-b border-l border-amber-800 opacity-45"></div>
                  <div className="absolute bottom-1.5 right-1.5 w-3 h-3 border-b border-r border-amber-800 opacity-45"></div>
 
                  <div className="space-y-3">
                    {/* Top title */}
                    <div className="text-center space-y-0.5">
                      <p className="text-[10px] font-black text-rose-800 tracking-wide uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                      <p className="text-[8.5px] font-bold text-slate-805 pb-0.5">Độc lập - Tự do - Hạnh phúc</p>
                      <div className="w-12 h-[1px] bg-amber-800 mx-auto opacity-30 mt-0.5"></div>
                    </div>
 
                    {/* Book title */}
                    <div className="text-center py-2 space-y-1">
                      <span className="text-[7.5px] tracking-widest font-black text-amber-900 border border-amber-800/40 px-1.5 py-0.5 rounded-sm uppercase inline-block">Hồ sơ địa bàn số</span>
                      <h4 className="text-sm font-black text-amber-950 uppercase tracking-widest block font-serif">SỔ HỘ KHẨU GIA ĐÌNH</h4>
                    </div>
 
                    {/* Registry Content details */}
                    <div className="bg-white/85 backdrop-blur-xs rounded-lg p-3.5 border border-amber-800/15 text-xs font-semibold space-y-2.5 shadow-xs">
                      <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1.5">
                        <span className="text-slate-400 font-bold text-[8.5px] uppercase tracking-wider">Mã số Sổ:</span>
                        <strong className="text-amber-900 font-mono font-black text-xs">#{previewHousehold.id}</strong>
                      </div>
 
                      <div className="grid grid-cols-2 gap-3 pb-2 border-b border-dashed border-slate-200">
                        <div className="space-y-0.5">
                          <span className="text-slate-450 font-bold text-[8px] uppercase tracking-wider block">Chủ hộ gia đình:</span>
                          <strong className="text-slate-900 text-[11px] font-extrabold uppercase line-clamp-1">{previewHousehold.ownerName}</strong>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-slate-450 font-bold text-[8px] uppercase tracking-wider block">Số điện thoại:</span>
                          <span className="text-slate-800 font-mono text-[11px] font-bold">{previewHousehold.phone || 'Chưa cập nhật'}</span>
                        </div>
                      </div>
 
                      <div className="grid grid-cols-2 gap-3 pb-2 border-b border-dashed border-slate-200">
                        <div className="space-y-0.5">
                          <span className="text-slate-450 font-bold text-[8px] uppercase tracking-wider block">Căn cước chủ hộ:</span>
                          <span className="text-slate-850 font-mono text-[11px] font-bold tracking-wider">{previewHousehold.idCard}</span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-slate-450 font-bold text-[8px] uppercase tracking-wider block">Tổ dân phố:</span>
                          <strong className="text-slate-900 text-[11px] font-bold block truncate">{previewHousehold.neighborhoodGroup}</strong>
                        </div>
                      </div>
 
                      <div className="space-y-0.5 pt-0.5">
                        <span className="text-slate-450 font-bold text-[8px] uppercase tracking-wider block">Địa chỉ đăng ký cư trú:</span>
                        <p className="text-slate-705 text-[10.5px] leading-relaxed font-semibold">{previewHousehold.address}</p>
                      </div>
                    </div>
 
                    {/* Member residents details list */}
                    <div className="space-y-1.5 mt-3 text-xs font-semibold">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-slate-500 font-extrabold text-[8.5px] uppercase tracking-wider">Nhân khẩu có cùng địa dư cư trú ({matchedMembers.length})</span>
                        {currentUserRole !== 'User' && (
                          <button
                            type="button"
                            onClick={() => openAddCoResidentModal(previewHousehold)}
                            className="px-2 py-0.5 bg-blue-800 text-white hover:bg-blue-700 rounded text-[8.5px] font-bold shadow-sm cursor-pointer flex items-center gap-1 transition-all"
                          >
                            <span>➕ Thêm đồng cư</span>
                          </button>
                        )}
                      </div>
 
                      {matchedMembers.length > 0 ? (
                        <div className="bg-white/85 border border-amber-800/15 rounded-xl overflow-hidden shadow-xs">
                          <table className="w-full text-left text-[10px]">
                            <thead className="bg-[#fcf8f0]">
                              <tr>
                                <th className="px-2.5 py-1.5 text-slate-500 font-extrabold text-[8px] uppercase">Họ và tên</th>
                                <th className="px-2.5 py-1.5 text-slate-500 font-extrabold text-[8px] uppercase">Sinh nhật</th>
                                <th className="px-2.5 py-1.5 text-slate-500 font-extrabold text-[8px] uppercase">Giới tính</th>
                                <th className="px-2.5 py-1.5 text-slate-500 font-extrabold text-[8px] uppercase text-right">Trạng thái / Đổi chủ hộ</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                              {matchedMembers.map((m) => {
                                const isOwner = (m.idCard && previewHousehold.idCard && m.idCard === previewHousehold.idCard) || 
                                                m.name.toLowerCase().trim() === previewHousehold.ownerName.toLowerCase().trim();
                                return (
                                  <tr key={m.id} className="hover:bg-slate-50/50">
                                    <td className="px-2.5 py-1.5 font-bold text-slate-900">
                                      {m.name} 
                                      {isOwner && (
                                        <span className="ml-1 text-[7.5px] bg-amber-100 text-amber-850 border border-amber-200 px-1 rounded-sm">Chủ hộ</span>
                                      )}
                                    </td>
                                    <td className="px-2.5 py-1.5 font-mono text-[9px]">{m.dob}</td>
                                    <td className="px-2.5 py-1.5 text-[9.5px]">{m.gender}</td>
                                    <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                                      <div className="flex items-center justify-end gap-1.5">
                                        <span className={`px-1.5 py-0.5 rounded text-[7.5px] font-black border ${
                                          m.status === 'Thường trú' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' :
                                          m.status === 'Tạm trú' ? 'bg-blue-50 text-blue-805 border-blue-100' : 'bg-red-50 text-red-750 border-red-100'
                                        }`}>
                                          {m.status}
                                        </span>
                                        {!isOwner ? (
                                          <button
                                            type="button"
                                            onClick={() => setLeaderChangeConfirm({ householdId: previewHousehold.id, newLeader: m })}
                                            className="text-[7.5px] px-1.5 py-0.5 bg-red-600 hover:bg-red-700 font-black text-white hover:text-white rounded shadow-sm select-none transition-all active:scale-95 cursor-pointer uppercase inline-flex items-center gap-0.5"
                                            title="Thay đổi cư dân này làm Chủ hộ"
                                          >
                                            👑 Đổi Chủ hộ
                                          </button>
                                        ) : (
                                          <span className="text-[7.5px] bg-amber-100 text-amber-850 border border-amber-200 px-1.5 py-0.5 rounded uppercase tracking-wide font-extrabold shrink-0">Đang là Chủ hộ</span>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="bg-white/70 border border-slate-200/50 p-3 rounded-xl text-center text-slate-400 italic text-[10px] font-medium leading-relaxed bg-white">
                          Không tìm thấy nhân khẩu đồng cư trú nào khác đăng ký tại địa bàn số này. 
                          <div className="text-[9px] text-slate-450 mt-1 font-semibold not-italic">Vui lòng sử dụng tính năng "THÊM CƯ DÂN" để gắn kết cư dân với địa chỉ nhà này.</div>
                        </div>
                      )}
                    </div>
                  </div>
 
                  {/* Stamp and Print Simulation */}
                  <div className="mt-4 flex justify-between items-center px-1">
                    <span className="text-[8px] text-slate-400 font-mono tracking-wider">Hồ sơ địa chỉ số v2.5</span>
                    
                    {/* Red stamp */}
                    <div className="border border-rose-500 rounded-full h-9 w-9 flex items-center justify-center p-0.5 rotate-[15deg] text-center opacity-85 select-none scale-100 shrink-0">
                      <div className="border border-dashed border-rose-500 rounded-full h-full w-full flex items-center justify-center text-[4.5px] text-rose-500 font-black leading-none uppercase">
                        BDH KP3
                        <br />
                        XÁC MINH
                      </div>
                    </div>
                  </div>
                </div>
              </div>
 
              {/* Modal controls footer */}
              <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-between gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    alert('🖨️ Tính năng đang gửi yêu cầu giả lập in ấn lên tệp máy chủ nội bộ. Vui lòng kết nối máy in để tiếp tục.');
                  }}
                  className="py-1.5 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-705 font-bold text-[11px] rounded-lg cursor-pointer transition-colors"
                >
                  🖨️ In sao kê hộ khẩu
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewHousehold(null)}
                    className="py-1.5 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-705 font-bold text-[11px] rounded-lg cursor-pointer"
                  >
                    Đóng lại
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

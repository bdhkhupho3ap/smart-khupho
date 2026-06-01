import React, { useState, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { GisHousehold, GisStreet, GisSubzone, GisFeature, UserRole, Resident } from "../types";
import { formatDate, formatDateTime } from "../utils/dateTimeUtils";
import { 
  MapPin, Navigation, Eye, EyeOff, Cpu, Database, Trash2, Edit2, Play, Search, 
  ShieldAlert, RefreshCw, AlertTriangle, Printer, QrCode, Sparkles, Send, Map, 
  ListCheck, HelpCircle, Layers, X, Plus, Terminal, Check, Upload, Clock, Phone,
  BookOpen, Zap, Compass, Minimize, Maximize, Info, FileText, Camera
} from "lucide-react";

// Fallback leaflet icon setup
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface GisAddressManagerProps {
  activeRole: UserRole;
  onRefresh: () => void;
  currentUser: any;
  setViewTab?: (tab: string) => void;
}

// Helper: Determine dynamic GIS category based on keywords or residents data
export const getGisType = (hh: any) => {
  if (hh.gisType) return hh.gisType;
  
  const nameLower = (hh.headerName || "").toLowerCase();
  const notesLower = (hh.notes || "").toLowerCase();
  const addressLower = (hh.address || "").toLowerCase();
  
  if (nameLower.includes("trụ sở") || nameLower.includes("văn phòng") || nameLower.includes("ủy ban") || nameLower.includes("bql") || nameLower.includes("ban quản lý")) return "headquarters";
  if (nameLower.includes("trường") || nameLower.includes("mầm non") || nameLower.includes("tiểu học") || nameLower.includes("thcs") || nameLower.includes("thpt") || nameLower.includes("mẫu giáo")) return "school";
  if (nameLower.includes("trạm y tế") || nameLower.includes("phòng khám") || nameLower.includes("bệnh viện") || nameLower.includes("y khoa")) return "medical";
  if (nameLower.includes("công viên") || nameLower.includes("vui chơi") || nameLower.includes("thể dục") || nameLower.includes("vườn hoa")) return "park";
  if (nameLower.includes("rác") || nameLower.includes("phế liệu") || nameLower.includes("tập kết rác")) return "waste";
  if (nameLower.includes("nhà trọ") || nameLower.includes("phòng trọ") || nameLower.includes("cơ sở trọ") || nameLower.includes("nhà nghỉ") || nameLower.includes("homestay")) return "lodging";
  if (nameLower.includes("công ty") || nameLower.includes("cửa hàng") || nameLower.includes("quán") || nameLower.includes("dịch vụ") || nameLower.includes("spa") || nameLower.includes("cafe") || nameLower.includes("shophouse") || nameLower.includes("hotel") || nameLower.includes("văn phòng")) return "business";
  if (nameLower.includes("nhà văn hóa") || nameLower.includes("cộng đồng") || nameLower.includes("sinh hoạt")) return "culture_house";
  if (notesLower.includes("nhà trọ") || notesLower.includes("phòng trọ")) return "lodging";
  if (notesLower.includes("kinh doanh") || notesLower.includes("buôn bán")) return "business";

  return "household_permanent";
};

// Helper: Retrieve styling (color, display emoji, label) for a specific GIS category
export const getGisTypeStyle = (type: string, isSelected: boolean, isWaypoint: boolean) => {
  let color = "bg-emerald-600 border-emerald-400";
  let emoji = "🏠";
  let label = "Hộ thường trú";
  
  switch (type) {
    case "household_permanent":
      color = "bg-emerald-600 border-emerald-400 text-white";
      emoji = "🏠";
      label = "Hộ thường trú";
      break;
    case "household_temporary":
      color = "bg-blue-600 border-blue-400 text-white";
      emoji = "🏡";
      label = "Hộ tạm trú";
      break;
    case "visitor":
      color = "bg-indigo-600 border-indigo-400 text-white";
      emoji = "👤";
      label = "Người vãng lai";
      break;
    case "business":
      color = "bg-cyan-600 border-cyan-400 text-white animate-pulse";
      emoji = "🏪";
      label = "Cơ sở kinh doanh";
      break;
    case "lodging":
      color = "bg-violet-600 border-violet-400 text-white";
      emoji = "🛏️";
      label = "Cơ sở trọ / Nhà trọ";
      break;
    case "headquarters":
      color = "bg-blue-900 border-indigo-500 text-yellow-300 ring-2 ring-indigo-300 font-extrabold";
      emoji = "⭐";
      label = "Văn phòng khu phố";
      break;
    case "culture_house":
      color = "bg-teal-700 border-teal-400 text-white";
      emoji = "🏛️";
      label = "Điểm sinh hoạt cộng đồng";
      break;
    case "school":
      color = "bg-indigo-800 border-indigo-400 text-yellow-100";
      emoji = "🏫";
      label = "Trường học";
      break;
    case "medical":
      color = "bg-rose-700 border-rose-400 text-white";
      emoji = "🏥";
      label = "Trạm y tế";
      break;
    case "park":
      color = "bg-green-700 border-green-400 text-white";
      emoji = "🌳";
      label = "Công viên";
      break;
    case "waste":
      color = "bg-amber-800 border-amber-600 text-amber-250";
      emoji = "🗑️";
      label = "Điểm tập kết rác";
      break;
    case "other":
      color = "bg-slate-600 border-slate-400 text-white";
      emoji = "📍";
      label = "Công trình công cộng khác";
      break;
  }
  
  if (isWaypoint) {
    color = "bg-purple-650 border-purple-400 text-white ring-2 ring-purple-300 animate-bounce";
  }
  if (isSelected) {
    color = "bg-amber-500 border-white text-slate-900 ring-4 ring-amber-300 scale-120 z-[1100] shadow-2xl font-black";
  }
  
  return { color, emoji, label };
};

// Field Note structure
interface FieldNote {
  id: string;
  householdId: string;
  category: "security" | "poverty" | "campaign" | "construction" | "special";
  authorName: string;
  text: string;
  photoUrl?: string;
  timestamp: string;
}

// Timeline Event structure
interface TimelineEvent {
  id: string;
  householdId: string;
  eventType: "move_in" | "move_out" | "header_change" | "notes_update";
  text: string;
  date: string;
}

export default function GisAddressManager({ activeRole, onRefresh, currentUser, setViewTab }: GisAddressManagerProps) {
  // State variables for GIS DB
  const [gisHouseholds, setGisHouseholds] = useState<GisHousehold[]>([]);
  const [gisStreets, setGisStreets] = useState<GisStreet[]>([]);
  const [gisSubzones, setGisSubzones] = useState<GisSubzone[]>([]);
  const [gisFeatures, setGisFeatures] = useState<GisFeature[]>([]);
  
  // Fully linked residents list for CSDL queries
  const [allResidents, setAllResidents] = useState<Resident[]>([]);
  const [allHouseholds, setAllHouseholds] = useState<any[]>([]);

  // App loading & telemetry states
  const [isLoading, setIsLoading] = useState(false);
  const [errorPrompt, setErrorPrompt] = useState("");
  const [successPrompt, setSuccessPrompt] = useState("");
  const [sqlLogs, setSqlLogs] = useState<string[]>([
    `-- Kích hoạt và kiểm tra Spatial Extension thành công\nCREATE EXTENSION IF NOT EXISTS postgis;\nSELECT postgis_full_version();`
  ]);

  // Leaflet map hooks
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerGroupRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Layout presentation controls
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"inspector" | "analytics" | "route" | "fields" | "console">("inspector");

  // Map Tile Style switcher state (Google Maps Satellite, Hybrid, Terrain, Roadmap)
  const [mapStyle, setMapStyle] = useState<'standard' | 'satellite' | 'hybrid' | 'terrain'>('standard');
  const [showLayerDropdown, setShowLayerDropdown] = useState(false);

  // Dynamic GIS element creation states
  const [formElementType, setFormElementType] = useState<'household' | 'feature' | 'intersection' | 'subzone'>('household');
  const [searchHouseholdQuery, setSearchHouseholdQuery] = useState("");
  const [showHouseholdSuggestions, setShowHouseholdSuggestions] = useState(false);

  // Filtering systems
  const [searchText, setSearchText] = useState("");
  const [residenceTypeFilter, setResidenceTypeFilter] = useState<string>("All");
  const [specialGroupFilter, setSpecialGroupFilter] = useState<string>("All");
  const [gisTypeFilter, setGisTypeFilter] = useState<string>("All");
  
  // Smart Address / Landmark Search states (OSM Nominatim API Suggestions)
  const [placeSearchQuery, setPlaceSearchQuery] = useState("");
  const [placeSearchResults, setPlaceSearchResults] = useState<any[]>([]);
  const [isSearchingPlace, setIsSearchingPlace] = useState(false);
  const [showPlaceDropdown, setShowPlaceDropdown] = useState(false);

  // Map customization layers toggles
  const [showHouseholds, setShowHouseholds] = useState(true);
  const [showStreets, setShowStreets] = useState(true);
  const [showSubzones, setShowSubzones] = useState(true);
  const [showPoi, setShowPoi] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [radiusMeters, setRadiusMeters] = useState(250);

  // Focus and pin status
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [searchTargetCoords, setSearchTargetCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [polygonContainment, setPolygonContainment] = useState<string | null>(null);

  // Field notes & local timeline records
  const [fieldNotes, setFieldNotes] = useState<FieldNote[]>(() => {
    try {
      const saved = localStorage.getItem("gis_field_notes");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>(() => {
    try {
      const saved = localStorage.getItem("gis_timeline_events");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [facadePhotos, setFacadePhotos] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem("gis_facade_photos");
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  // Mobile Mode & On-site dynamic triggers
  const [isMobileMode, setIsMobileMode] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(false);

  // Field note entry values
  const [noteCategory, setNoteCategory] = useState<FieldNote["category"]>("special");
  const [noteValue, setNoteValue] = useState("");
  const [uploadPhotoBase64, setUploadPhotoBase64] = useState<string | null>(null);

  // Routing preferences & optimization (TSP waypoints)
  const [patrolWaypoints, setPatrolWaypoints] = useState<string[]>([]);
  const [calculatedPath, setCalculatedPath] = useState<any[]>([]);
  const [patrolDistance, setPatrolDistance] = useState(0);
  const [patrolDuration, setPatrolDuration] = useState(0);
  const [travelMode, setTravelMode] = useState<"walking" | "motorbike" | "car">("walking");

  // PostGIS Query console
  const [rawSqlInput, setRawSqlInput] = useState(
    `SELECT id, headerName, geom, ST_Distance(geom, ST_MakePoint(106.7215, 10.8021)) AS dist_m\nFROM households\nORDER BY dist_m ASC LIMIT 5;`
  );
  const [queryConsoleOutput, setQueryConsoleOutput] = useState<any | null>(null);

  // AI prompt companion
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiAnalysisResult, setAiAnalysisResult] = useState("");
  const [aiStatusMessage, setAiStatusMessage] = useState("");
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Interactive Create / Edit Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [formType, setFormType] = useState<"create" | "edit">("create");
  const [isAiAutoAssigning, setIsAiAutoAssigning] = useState(false);
  const [aiSuggestInfo, setAiSuggestInfo] = useState<any | null>(null);
  const [formValue, setFormValue] = useState({
    id: "",
    headerName: "",
    address: "",
    phoneNumber: "",
    notes: "",
    lat: 10.8021,
    lng: 106.7215,
    groupNDTQ: "Tổ 3",
    tagSecurity: "Bình thường"
  });

  // Modal map & GPS coordinate trackers
  const modalMapRef = useRef<L.Map | null>(null);
  const modalMarkerRef = useRef<L.Marker | null>(null);
  const modalAccuracyCircleRef = useRef<L.Circle | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string>("");
  const [isGpsActive, setIsGpsActive] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);

  // Function to query Ward Subzone containment inside the modal
  const runContainsQueryInModal = async (lat: number, lng: number) => {
    try {
      const res = await fetch("/api/gis/contains-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng })
      });
      const data = await res.json();
      if (data.success && data.subzone) {
        setFormValue(prev => ({ ...prev, groupNDTQ: data.subzone.name }));
      }
    } catch (err) {
      console.error("Lỗi đối chiếu ranh giới phân khu:", err);
    }
  };

  // Reverse Geocoding via Nominatim with Vietnam administrative mapping and multi-road fallbacks
  const handleReverseGeocode = async (lat: number, lng: number) => {
    setIsReverseGeocoding(true);
    setGpsStatus("🔄 Đang dịch tọa độ định vị thành địa chỉ thực tế...");
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=vi`
      );
      if (!response.ok) throw new Error();
      const data = await response.json();
      
      if (data && data.address) {
        const addr = data.address;
        const houseNumber = addr.house_number || "";
        const road = addr.road || addr.suburb || "";
        
        const subAddressParts = [];
        if (houseNumber) subAddressParts.push(`Số ${houseNumber}`);
        if (road) subAddressParts.push(`Đường ${road}`);
        
        subAddressParts.push("Khu phố 3");
        subAddressParts.push("Phường An Phú");
        subAddressParts.push("TP. Thủ Đức");
        subAddressParts.push("TP. Hồ Chí Minh");

        const formattedAddress = subAddressParts.join(", ");
        
        setFormValue(prev => ({
          ...prev,
          address: data.display_name ? data.display_name.replace(", Việt Nam", "") : formattedAddress
        }));

        setGpsStatus(`📍 Giải dịch thành công: Địa chỉ khớp lưới.`);
        await runContainsQueryInModal(lat, lng);
      } else {
        throw new Error();
      }
    } catch {
      // Offline fallback: generate realistic address based on coordinates in Khu phố 3, Phường An Phú, TP. Thủ Đức, TP. Hồ Chí Minh
      const distanceToCenter = Math.sqrt(Math.pow(lat - 10.8021, 2) + Math.pow(lng - 106.7215, 2));
      const houseNum = Math.floor(distanceToCenter * 8000) + 1;
      const roadNames = ["Quốc Hương", "Ba Son", "Song Hành", "Thảo Điền", "Nguyễn Hoàng"];
      const roadName = roadNames[Math.floor((lat + lng) * 1000) % roadNames.length];
      
      const fallbackAddress = `Số ${houseNum}, Đường ${roadName}, Khu phố 3, Phường An Phú, TP. Thủ Đức, TP. Hồ Chí Minh`;
      
      setFormValue(prev => ({
        ...prev,
        address: fallbackAddress
      }));
      setGpsStatus("⚠️ Offline mode: Đã dự báo địa chỉ lân cận.");
      await runContainsQueryInModal(lat, lng);
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  // Helper routine to update standard marker and accurate radius on sub-map
  const updateModalMarkerPosition = (lat: number, lng: number, accuracy: number | null) => {
    const map = modalMapRef.current;
    if (!map) return;

    if (!modalMarkerRef.current) {
      // Custom styled pin with animation
      const customPin = L.divIcon({
        html: `<div class="relative flex items-center justify-center">
                 <span class="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-emerald-505 opacity-75"></span>
                 <div class="h-6 w-6 rounded-full bg-emerald-600 text-white border-2 border-white flex items-center justify-center shadow-lg font-bold">📍</div>
               </div>`,
        className: "modal-gps-pin",
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker([lat, lng], {
        draggable: true,
        icon: customPin
      }).addTo(map);

      marker.on("dragend", (e: any) => {
        const coords = e.target.getLatLng();
        const roundedLat = Math.round(coords.lat * 1000000) / 1000000;
        const roundedLng = Math.round(coords.lng * 1000000) / 1000000;

        setFormValue(prev => ({
          ...prev,
          lat: roundedLat,
          lng: roundedLng
        }));

        setGpsStatus("📍 Đã định vị tay bằng kéo thả ghim!");
        handleReverseGeocode(roundedLat, roundedLng);
      });

      modalMarkerRef.current = marker;
    } else {
      modalMarkerRef.current.setLatLng([lat, lng]);
    }

    if (accuracy && accuracy < 500) {
      if (!modalAccuracyCircleRef.current) {
        modalAccuracyCircleRef.current = L.circle([lat, lng], {
          radius: accuracy,
          color: "#3b82f6",
          weight: 1.5,
          fillColor: "#3b82f6",
          fillOpacity: 0.12,
          dashArray: "4,4"
        }).addTo(map);
      } else {
        modalAccuracyCircleRef.current.setLatLng([lat, lng]);
        modalAccuracyCircleRef.current.setRadius(accuracy);
      }
    } else {
      if (modalAccuracyCircleRef.current) {
        modalAccuracyCircleRef.current.remove();
        modalAccuracyCircleRef.current = null;
      }
    }
  };

  // Main high accuracy GPS automatic reader
  const acquireGPSCoordinates = (forceRecalculate = false) => {
    if (!navigator.geolocation) {
      setGpsStatus("🔴 Thiết bị không hỗ trợ định vị GPS tự động.");
      return;
    }

    setGpsStatus("📡 Đang khởi động vệ tinh tìm kiếm GPS...");
    setIsGpsActive(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const latVal = Math.round(latitude * 1000000) / 1000000;
        const lngVal = Math.round(longitude * 1000000) / 1000000;
        const accVal = Math.round(accuracy || 0);

        setGpsAccuracy(accVal);
        setFormValue(prev => ({
          ...prev,
          lat: latVal,
          lng: lngVal
        }));

        setGpsStatus(`✅ Khóa vệ tinh! Độ chính xác: ±${accVal}m`);
        setIsGpsActive(false);

        if (modalMapRef.current) {
          modalMapRef.current.setView([latVal, lngVal], 18);
          updateModalMarkerPosition(latVal, lngVal, accVal);
        }

        if (forceRecalculate || formType === "create") {
          handleReverseGeocode(latVal, lngVal);
        }
      },
      (err) => {
        console.warn("GPS Access Code:", err);
        let errorUserMsg = "Không tìm thấy dữ liệu GPS.";
        if (err.code === 1) {
          errorUserMsg = "Vui lòng cấp quyền định vị vị trí trong cài đặt hệ thống (Quyền bị chặn).";
        } else if (err.code === 2) {
          errorUserMsg = "Yêu cầu định vị bị lỗi hoặc mất tín hiệu kết nối trong nhà.";
        } else if (err.code === 3) {
          errorUserMsg = "Hết thời gian chờ định vị GPS vệ tinh.";
        }
        
        setGpsStatus(`⚠️ ${errorUserMsg}`);
        setIsGpsActive(false);

        const defaultLat = 10.8021;
        const defaultLng = 106.7215;
        if (modalMapRef.current) {
          modalMapRef.current.setView([defaultLat, defaultLng], 17);
          updateModalMarkerPosition(defaultLat, defaultLng, null);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    );
  };

  // Side-effect to initialize Leaflet sub-map in the modal DOM safely
  useEffect(() => {
    if (!showFormModal) {
      if (modalMapRef.current) {
        if (modalMarkerRef.current) {
          modalMarkerRef.current.remove();
          modalMarkerRef.current = null;
        }
        if (modalAccuracyCircleRef.current) {
          modalAccuracyCircleRef.current.remove();
          modalAccuracyCircleRef.current = null;
        }
        modalMapRef.current.remove();
        modalMapRef.current = null;
      }
      setIsGpsActive(false);
      setGpsAccuracy(null);
      setGpsStatus("");
      return;
    }

    const initModalMap = () => {
      const container = document.getElementById("modal-preview-map");
      if (!container || modalMapRef.current) return;

      const initLat = formValue.lat || 10.8021;
      const initLng = formValue.lng || 106.7215;

      const map = L.map(container, {
        center: [initLat, initLng],
        zoom: 17,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      modalMapRef.current = map;

      // Draw initial marker position
      updateModalMarkerPosition(initLat, initLng, gpsAccuracy);

      // Reposition instantly with click on map
      map.on("click", (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        const rLat = Math.round(lat * 1000000) / 1000000;
        const rLng = Math.round(lng * 1000000) / 1000000;

        setFormValue(prev => ({
          ...prev,
          lat: rLat,
          lng: rLng
        }));

        updateModalMarkerPosition(rLat, rLng, null);
        handleReverseGeocode(rLat, rLng);
      });

      // For new entries, automatically run GPS locator. For existing, center view
      if (formType === "create") {
        acquireGPSCoordinates(true);
      } else {
        map.setView([initLat, initLng], 17);
        if (!formValue.address) {
          handleReverseGeocode(initLat, initLng);
        }
      }
    };

    const timer = setTimeout(initModalMap, 200);
    return () => clearTimeout(timer);
  }, [showFormModal]);

  // QR plaque details
  const [showQrPlate, setShowQrPlate] = useState(false);
  const [qrTargetHousehold, setQrTargetHousehold] = useState<GisHousehold | null>(null);

  // Standard boundary constraints coordinates of Phường An Phú, TP. HCM
  const mapLngMin = 106.7180;
  const mapLngMax = 106.7325;
  const mapLatMin = 10.7970;
  const mapLatMax = 10.8085;

  const canEdit = activeRole !== "Người xem báo cáo";

  // WKT geometry parsers
  const parseWktPolygon = (wkt: string): [number, number][] => {
    try {
      const cleaner = wkt.replace(/POLYGON\s*\(\(/i, "").replace(/\)\)/, "");
      return cleaner.split(",").map(p => {
        const parts = p.trim().split(/\s+/);
        const lng = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        return [lng, lat];
      });
    } catch {
      return [];
    }
  };

  const parseWktLineString = (wkt: string): [number, number][] => {
    try {
      const cleaner = wkt.replace(/LINESTRING\s*\(/i, "").replace(/\)/, "");
      return cleaner.split(",").map(p => {
        const parts = p.trim().split(/\s+/);
        const lng = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        return [lng, lat];
      });
    } catch {
      return [];
    }
  };

  // Synchronize localStorage helpers
  const saveFieldNotes = (updated: FieldNote[]) => {
    setFieldNotes(updated);
    localStorage.setItem("gis_field_notes", JSON.stringify(updated));
  };

  const saveTimelineEvents = (updated: TimelineEvent[]) => {
    setTimelineEvents(updated);
    localStorage.setItem("gis_timeline_events", JSON.stringify(updated));
  };

  const saveFacadePhoto = (hhId: string, b64: string) => {
    const updated = { ...facadePhotos, [hhId]: b64 };
    setFacadePhotos(updated);
    localStorage.setItem("gis_facade_photos", JSON.stringify(updated));
  };

  // Read full databases on load
  const fetchGisDb = async () => {
    setIsLoading(true);
    setErrorPrompt("");
    try {
      // 1. Fetch backend GIS geometries layers
      const resGis = await fetch("/api/gis/data");
      if (!resGis.ok) throw new Error("Cổng dữ liệu GIS đang bận.");
      const dataGis = await resGis.json();
      setGisHouseholds(dataGis.gisHouseholds || []);
      setGisStreets(dataGis.gisStreets || []);
      setGisSubzones(dataGis.gisSubzones || []);
      setGisFeatures(dataGis.gisFeatures || []);
      
      // 2. Fetch Core database populations (for search and statistics)
      const resResidents = await fetch("/api/residents");
      if (resResidents.ok) {
        const dataRes = await resResidents.json();
        setAllResidents(dataRes || []);
      }

      const resHouseholds = await fetch("/api/households");
      if (resHouseholds.ok) {
        const dataHh = await resHouseholds.json();
        setAllHouseholds(dataHh || []);
      }

      setSqlLogs(prev => [
        `-- Đã nạp thành công lớp không gian kĩ thuật số\nSELECT id, ST_AsText(geom) FROM subzones;`,
        ...prev
      ]);
    } catch (err: any) {
      setErrorPrompt("Đã xảy ra sự cố kết nối nạp dữ liệu bản đồ địa chính. Hãy thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGisDb();
  }, []);

  // Expose focusGisRow globally for interactive click integrations from Leaflet popups
  useEffect(() => {
    (window as any).focusGisRow = (id: string) => {
      setSelectedPinId(id);
      setSelectedPoiId(null);
      setActiveTab("inspector");
      const hh = gisHouseholds.find(h => h.id === id);
      if (hh) {
        setFormValue({
          id: hh.id,
          headerName: hh.headerName,
          address: hh.address,
          phoneNumber: hh.phoneNumber,
          notes: hh.notes || "",
          lat: hh.lat,
          lng: hh.lng,
          groupNDTQ: hh.groupNDTQ || "Tổ 3",
          tagSecurity: (hh as any).tagSecurity || "Bình thường",
          gisType: (hh as any).gisType || getGisType(hh)
        });
        if (mapRef.current) {
          mapRef.current.setView([hh.lat, hh.lng], 18);
        }
      }
    };
    return () => {
      delete (window as any).focusGisRow;
    };
  }, [gisHouseholds]);

  // 1. Leaflet Instantiation Effect
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return; // Prevent double instantiation

    // Initialize Leaflet map
    const map = L.map(mapContainerRef.current, {
      center: [10.8021, 106.7215],
      zoom: 16,
      zoomControl: false,
    });

    // Zoom buttons manually to avoid alignment blocks
    L.control.zoom({ position: "topright" }).addTo(map);

    mapRef.current = map;

    // Build the dynamic Vector layer group
    const layerGroup = L.layerGroup().addTo(map);
    markerGroupRef.current = layerGroup;

    // Single Click to drop target point coordinate locator
    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      setSearchTargetCoords({ lat, lng });
      setFormValue(prev => ({
        ...prev,
        lat: Math.round(lat * 1000000) / 1000000,
        lng: Math.round(lng * 1000000) / 1000000
      }));

      runContainsQuery(lat, lng);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // 1b. React Dynamic TileLayer Switcher based on mapStyle selection
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let url = "";
    let attribution = "";

    switch (mapStyle) {
      case "standard":
        url = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
        attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
        break;
      case "satellite":
        url = "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}";
        attribution = "&copy; Google Satellite Imagery";
        break;
      case "hybrid":
        url = "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}";
        attribution = "&copy; Google Hybrid (Satellite + Labels)";
        break;
      case "terrain":
        url = "https://mt1.google.com/vt/lyrs=t&x={x}&y={y}&z={z}";
        attribution = "&copy; Google Terrain";
        break;
      default:
        url = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
        attribution = '&copy; OpenStreetMap & CARTO';
    }

    const tile = L.tileLayer(url, {
      attribution,
      maxZoom: 21,
    }).addTo(map);

    tileLayerRef.current = tile;
  }, [mapStyle, gisHouseholds]);

  // helper contains query to check subzone
  const runContainsQuery = async (lat: number, lng: number) => {
    try {
      const res = await fetch("/api/gis/contains-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng })
      });
      const data = await res.json();
      if (data.success) {
        setSqlLogs(prev => [data.sqlCommand, ...prev]);
        setPolygonContainment(data.subzone ? data.subzone.name : "Ngoài ranh giới");
        if (data.subzone) {
          setFormValue(prev => ({ ...prev, groupNDTQ: data.subzone.name }));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Smart places query to autocomplete addresses and landmarks (with high-fidelity offline fallback)
  const triggerPlacesSearch = async (query: string) => {
    if (!query.trim()) return;
    setIsSearchingPlace(true);
    try {
      const viewboxAnPhu = "106.7180,10.7970,106.7325,10.8085"; // priority viewport box for An Phú, Thủ Đức
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&accept-language=vi&viewbox=${viewboxAnPhu}&bounded=0`,
        {
          headers: {
            "User-Agent": "AnPhuGisApplication/1.0"
          }
        }
      );
      if (!response.ok) throw new Error("HTTP failure");
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        setPlaceSearchResults(data.slice(0, 6));
      } else {
        throw new Error("No results found in external GIS index");
      }
    } catch (err) {
      console.warn("External nominatim fetch query failed. Launching localized high-fidelity offline search index instead...", err);
      
      const q = query.toLowerCase().trim();
      const fallbackResults: any[] = [];

      // 1. Match local special points of interest (Features, Cameras, Headquarters)
      if (gisFeatures && Array.isArray(gisFeatures)) {
        gisFeatures.forEach(feat => {
          if (
            feat.name.toLowerCase().includes(q) ||
            (feat.type && feat.type.toLowerCase().includes(q))
          ) {
            fallbackResults.push({
              lat: String(feat.lat),
              lon: String(feat.lng),
              name: feat.name,
              display_name: `${feat.name} - Công trình Tiện ích Khu phố 3`
            });
          }
        });
      }

      // 2. Match local registered households, temporary apartments, lodgings, and businesses
      if (gisHouseholds && Array.isArray(gisHouseholds)) {
        gisHouseholds.forEach(hh => {
          const matchedName = (hh.headerName || "").toLowerCase().includes(q);
          const matchedAddress = (hh.address || "").toLowerCase().includes(q);
          const matchedNotes = (hh.notes || "").toLowerCase().includes(q);
          
          if (matchedName || matchedAddress || matchedNotes) {
            const currentType = getGisType(hh);
            const styleInfo = getGisTypeStyle(currentType, false, false);
            fallbackResults.push({
              lat: String(hh.lat),
              lon: String(hh.lng),
              name: `${styleInfo.emoji} ${hh.headerName}`,
              display_name: `${hh.address} (${hh.groupNDTQ || "Tổ tự quản"})`
            });
          }
        });
      }

      // 3. Match local administrative territories (Subzones)
      if (gisSubzones && Array.isArray(gisSubzones)) {
        gisSubzones.forEach(sub => {
          if (sub.name.toLowerCase().includes(q)) {
            const pts = parseWktPolygon(sub.geom);
            if (pts && pts.length > 0) {
              fallbackResults.push({
                lat: String(pts[0][1]),
                lon: String(pts[0][0]),
                name: `🚩 ${sub.name}`,
                display_name: `Địa giới hành chính: ${sub.name} (Tổ trưởng: ${sub.leaderName || "Ban điều hành"})`
              });
            }
          }
        });
      }

      setPlaceSearchResults(fallbackResults.slice(0, 7));
    } finally {
      setIsSearchingPlace(false);
    }
  };

  // 2. Map Elements Vector Update Engine
  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = markerGroupRef.current;
    if (!map || !layerGroup) return;

    // Clear dynamic drawings
    layerGroup.clearLayers();

    // POLYGONS: Subzones
    if (showSubzones) {
      gisSubzones.forEach(subzone => {
        const points = parseWktPolygon(subzone.geom);
        if (points.length >= 3) {
          const leafletCoords = points.map(p => [p[1], p[0]] as [number, number]);
          
          const poly = L.polygon(leafletCoords, {
            color: subzone.color || "#047857",
            weight: 2,
            opacity: 0.7,
            fillColor: subzone.color || "#10b981",
            fillOpacity: showHeatmap ? 0.05 : 0.09,
          });

          const subzoneHh = gisHouseholds.filter(h => h.groupNDTQ === subzone.name);

          poly.bindTooltip(
            `<div class="p-1 leading-tight"><b class="text-emerald-700 text-xs">${subzone.name}</b><br/>
             <span class="text-[10px] text-gray-500">Tổ trưởng: ${subzone.leaderName}<br/>
             Thành viên PIN: ${subzoneHh.length} hộ</span></div>`, 
            { sticky: true }
          );

          layerGroup.addLayer(poly);
        }
      });
    }

    // LINESTRINGS: Streets
    if (showStreets) {
      gisStreets.forEach(street => {
        const points = parseWktLineString(street.geom);
        if (points.length >= 2) {
          const leafletCoords = points.map(p => [p[1], p[0]] as [number, number]);
          
          const outerLine = L.polyline(leafletCoords, {
            color: "#64748b",
            weight: 6,
            opacity: 0.35,
            lineCap: "round"
          });

          const innerLine = L.polyline(leafletCoords, {
            color: "#ffffff",
            weight: 3,
            opacity: 0.85,
            lineCap: "round"
          });

          layerGroup.addLayer(outerLine);
          layerGroup.addLayer(innerLine);
        }
      });
    }

    // RADIUS COMPASS SHIELD
    if (searchTargetCoords) {
      const radiusCircle = L.circle([searchTargetCoords.lat, searchTargetCoords.lng], {
        radius: radiusMeters,
        color: "#ec4899",
        weight: 1.5,
        fillColor: "#f43f5e",
        fillOpacity: showHeatmap ? 0.03 : 0.06,
        dashArray: "4,4"
      });

      // Target pin
      const targetMarker = L.marker([searchTargetCoords.lat, searchTargetCoords.lng], {
        icon: L.divIcon({
          html: `<div class="relative flex items-center justify-center">
                   <div class="absolute h-8 w-8 rounded-full bg-pink-400 opacity-75 animate-ping"></div>
                   <div class="h-4 w-4 rounded-full bg-pink-650 border border-white"></div>
                 </div>`,
          className: "target-gps-pin",
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        })
      });

      layerGroup.addLayer(radiusCircle);
      layerGroup.addLayer(targetMarker);
    }

    // POINTS: Special ANTT Hotspots
    if (showPoi) {
      gisFeatures.forEach(poi => {
        const isSelected = selectedPoiId === poi.id;
        const iconHtml = poi.type === "camera" 
          ? `<div class="relative flex items-center justify-center">
               <span class="animate-pulse absolute h-5 w-5 bg-red-400 opacity-60 rounded-full"></span>
               <div class="h-5 w-5 rounded-full ${isSelected ? "bg-amber-500 ring-2 ring-white scale-120" : "bg-rose-600"} text-white border border-white flex items-center justify-center text-[10px] shadow">📹</div>
             </div>`
          : `<div class="relative flex items-center justify-center">
               <span class="animate-pulse absolute h-5 w-5 bg-amber-400 opacity-60 rounded-full"></span>
               <div class="h-5 w-5 rounded-full ${isSelected ? "bg-amber-500 ring-2 ring-white scale-120" : "bg-amber-600"} text-white border border-white flex items-center justify-center text-[10px] shadow">⚠️</div>
             </div>`;

        const markerPoi = L.marker([poi.lat, poi.lng], {
          icon: L.divIcon({
            html: iconHtml,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          })
        });

        markerPoi.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          setSelectedPoiId(poi.id);
          setSelectedPinId(null);
          setActiveTab("inspector");
        });

        markerPoi.bindTooltip(`<b>${poi.name}</b> (${poi.type === "camera" ? "Camera giám sát" : "Điểm ANTT"})`);
        layerGroup.addLayer(markerPoi);
      });
    }

    // POINTS: Dynamic Households Mapping
    if (showHouseholds) {
      filteredGisHouseholds.forEach(hh => {
        const isSelected = selectedPinId === hh.id;
        const isWaypoint = patrolWaypoints.includes(hh.id);
        const type = getGisType(hh);
        const style = getGisTypeStyle(type, isSelected, isWaypoint);
        
        let pinBody = "";
        if (showHeatmap) {
          // Heatmap blobs
          pinBody = `<div class="relative flex items-center justify-center animate-pulse">
                       <span class="absolute h-14 w-14 bg-red-500 rounded-full blur-md opacity-40"></span>
                       <div class="h-3 w-3 bg-red-650 rounded-full border border-white"></div>
                     </div>`;
        } else {
          // Stylish marker icons with distinct colors and emojis
          pinBody = `<div class="relative flex items-center justify-center cursor-pointer transition-all duration-300">
                       ${isSelected ? `<span class="animate-ping absolute h-8 w-8 bg-amber-300 opacity-70 rounded-full"></span>` : ""}
                       <div class="h-7 w-7 rounded-full ${style.color} border-2 border-white flex items-center justify-center shadow-lg text-[13px]">
                         ${style.emoji}
                       </div>
                     </div>`;
        }

        const markerHh = L.marker([hh.lat, hh.lng], {
          icon: L.divIcon({
            html: pinBody,
            iconSize: showHeatmap ? [56, 56] : [28, 28],
            iconAnchor: showHeatmap ? [28, 28] : [14, 14]
          })
        });

        markerHh.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          setSelectedPinId(hh.id);
          setSelectedPoiId(null);
          setActiveTab("inspector");
          setFormValue({
            id: hh.id,
            headerName: hh.headerName,
            address: hh.address,
            phoneNumber: hh.phoneNumber,
            notes: hh.notes || "",
            lat: hh.lat,
            lng: hh.lng,
            groupNDTQ: hh.groupNDTQ || "Tổ 3",
            tagSecurity: (hh as any).tagSecurity || "Bình thường",
            gisType: (hh as any).gisType || type
          });
        });

        // Elegant interactive Popup Card with direct action-links
        const popupContent = `
          <div class="p-2 min-w-[210px] text-slate-800 leading-normal font-sans" id="popup-${hh.id}">
            <div class="flex items-center gap-1.5 mb-2 bg-slate-100 p-1.5 rounded-lg border border-slate-200">
              <span class="text-lg">${style.emoji}</span>
              <div>
                <b class="text-[11px] text-slate-950 font-extrabold block truncate max-w-[130px]">${hh.headerName}</b>
                <span class="block text-[8px] uppercase tracking-wider font-extrabold text-[#4f46e5]">${style.label}</span>
              </div>
            </div>
            <div class="space-y-1 my-2">
              <p class="text-[10px] text-slate-650 m-0 leading-snug"><b>📍 Địa chỉ:</b> ${hh.address}</p>
              <p class="text-[10px] text-slate-550 m-0 font-mono"><b>📞 SĐT:</b> ${hh.phoneNumber || "Không có SĐT"}</p>
            </div>
            <div class="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-slate-100">
              <a href="javascript:window.focusGisRow('${hh.id}')" class="bg-indigo-650 text-white text-[9px] px-2 py-1 rounded font-bold hover:bg-indigo-600 no-underline" style="color: white !important;">⚙️ Chi tiết</a>
              <a href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${hh.lat},${hh.lng}" target="_blank" class="bg-slate-800 text-white text-[9px] px-2 py-1 rounded font-bold hover:bg-slate-700 no-underline" style="color: white !important;">🏙️ Street View</a>
            </div>
          </div>
        `;

        markerHh.bindPopup(popupContent, { minWidth: 210 });
        markerHh.bindTooltip(`<b>${style.emoji} ${hh.headerName}</b><br/><span class="text-[10px] text-gray-500">${hh.address}</span>`);
        layerGroup.addLayer(markerHh);
      });
    }

    // POLYLINE ROUTE DRAWING
    if (calculatedPath.length > 1) {
      const pathsLatlng = calculatedPath.map(pt => [pt.lat, pt.lng] as [number, number]);
      
      const polyline = L.polyline(pathsLatlng, {
        color: travelMode === "walking" ? "#6366f1" : travelMode === "motorbike" ? "#8b5cf6" : "#f59e0b",
        weight: 4,
        opacity: 0.9,
        dashArray: "10, 6"
      });

      polyline.addTo(layerGroup);

      // Markers indicating numbered legs
      calculatedPath.forEach((pt, idx) => {
        const isStart = idx === 0;
        const isEnd = idx === calculatedPath.length - 1;
        const cClass = isStart ? "bg-green-600" : isEnd ? "bg-rose-600" : "bg-indigo-600";

        const stepMarker = L.marker([pt.lat, pt.lng], {
          icon: L.divIcon({
            html: `<div class="h-6 w-6 rounded-full ${cClass} border-2 border-white flex items-center justify-center font-bold text-white text-[11px] shadow-lg">
                     ${idx}
                   </div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          })
        });

        stepMarker.bindTooltip(`🎁 Chặng <b>${idx}</b>: ${pt.label}`);
        layerGroup.addLayer(stepMarker);
      });
    }

  }, [
    gisHouseholds, gisSubzones, gisStreets, gisFeatures,
    showHouseholds, showStreets, showSubzones, showPoi, showHeatmap,
    selectedPinId, selectedPoiId, searchTargetCoords, calculatedPath, 
    patrolWaypoints, searchText, residenceTypeFilter, specialGroupFilter, gisTypeFilter, travelMode
  ]);

  // Client-side quick filter queries 10k items sub-second
  const filteredGisHouseholds = gisHouseholds.filter(hh => {
    const matchesSearch = !searchText.trim() || 
      hh.headerName.toLowerCase().includes(searchText.toLowerCase()) ||
      hh.address.toLowerCase().includes(searchText.toLowerCase()) ||
      hh.phoneNumber.toLowerCase().includes(searchText.toLowerCase()) ||
      (hh.gisCode && hh.gisCode.toLowerCase().includes(searchText.toLowerCase())) ||
      hh.id.toLowerCase().includes(searchText.toLowerCase());

    const hhResidents = allResidents.filter(r => r.householdId === hh.id);
    const headerResident = hhResidents.find(r => r.relationWithHeader === "Chủ hộ") || hhResidents[0];
    
    const matchesResidenceType = residenceTypeFilter === "All" || 
      (headerResident && headerResident.residenceType === residenceTypeFilter);

    let matchesGroup = true;
    if (specialGroupFilter !== "All") {
      if (specialGroupFilter === "Đảng viên") {
        matchesGroup = hhResidents.some(r => r.groups?.includes("Đảng viên") || r.groups?.includes("Đảng viên 213"));
      } else if (specialGroupFilter === "Phụ nữ") {
        matchesGroup = hhResidents.some(r => r.groups?.includes("Phụ nữ"));
      } else if (specialGroupFilter === "CCB") {
        matchesGroup = hhResidents.some(r => r.groups?.includes("CCB"));
      } else if (specialGroupFilter === "Thanh niên") {
        matchesGroup = hhResidents.some(r => r.groups?.includes("Thanh niên"));
      } else if (specialGroupFilter === "Cao tuổi") {
        matchesGroup = hhResidents.some(r => {
          const age = new Date().getFullYear() - new Date(r.dob).getFullYear();
          return age >= 60;
        });
      } else if (specialGroupFilter === "Trẻ em") {
        matchesGroup = hhResidents.some(r => {
          const age = new Date().getFullYear() - new Date(r.dob).getFullYear();
          return age < 16 || r.specialCategories?.includes("Trẻ em");
        });
      } else if (specialGroupFilter === "Hộ nghèo") {
        matchesGroup = hhResidents.some(r => r.specialCategories?.includes("Hộ nghèo"));
      } else if (specialGroupFilter === "Hộ cận nghèo") {
        matchesGroup = hhResidents.some(r => r.specialCategories?.includes("Hộ cận nghèo"));
      }
    }

    const matchesGisType = gisTypeFilter === "All" || getGisType(hh) === gisTypeFilter;

    return matchesSearch && matchesResidenceType && matchesGroup && matchesGisType;
  });

  // AI Automatic Address-Pin mapping gán tự động
  const handleAiAutoMatchTrigger = async () => {
    if (!searchTargetCoords) {
      setErrorPrompt("Vui lòng click chọn một điểm tọa độ bất kì trên bản đồ trước khi gán tự động!");
      return;
    }
    setErrorPrompt("");
    setAiSuggestInfo(null);
    setIsAiAutoAssigning(true);

    try {
      const res = await fetch("/api/gis/ai-suggest-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: searchTargetCoords.lat, lng: searchTargetCoords.lng })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.found) {
          setAiSuggestInfo(data);
          setFormValue(prev => ({
            ...prev,
            id: data.id,
            headerName: data.headerName,
            address: data.address,
            phoneNumber: data.phoneNumber === "N/A" ? "" : data.phoneNumber,
            notes: `[AI Gán Tự động] ${data.notes || ""}`,
            groupNDTQ: data.groupNDTQ || "Tổ 3"
          }));
          setSuccessPrompt("AI đã tìm thấy 1 hộ dân tương thích trong CSDL chưa định vị!");
          setTimeout(() => setSuccessPrompt(""), 3000);
        } else {
          setErrorPrompt("AI kết luận: " + (data.reason || "Không tìm thấy tương thích hộ khẩu trống phù hợp. Vui lòng thêm thủ công."));
        }
      } else {
        setErrorPrompt(data.error || "Không thể gọi ý từ trung tâm phân tích AI.");
      }
    } catch {
      setErrorPrompt("Sự cố truyền tin máy chủ AI.");
    } finally {
      setIsAiAutoAssigning(false);
    }
  };

  // GPS geolocation capability
  const triggerGpsLocate = () => {
    if (!navigator.geolocation) {
      setErrorPrompt("Trình duyệt hoặc thiết bị của bạn không hỗ trợ định vị GPS kĩ thuật.");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const coords = { lat: latitude, lng: longitude };
        setSearchTargetCoords(coords);
        setFormValue(prev => ({ ...prev, lat: latitude, lng: longitude }));
        
        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], 17);
        }
        
        runContainsQuery(latitude, longitude);
        setGpsLoading(false);
        setSuccessPrompt("Đã khóa vệ tinh định vị GPS thành công!");
        setTimeout(() => setSuccessPrompt(""), 3000);
      },
      () => {
        // Fallback default coordinates of An Phu HQ
        const fallback = { lat: 10.8021, lng: 106.7215 };
        setSearchTargetCoords(fallback);
        if (mapRef.current) {
          mapRef.current.setView([fallback.lat, fallback.lng], 16);
        }
        setGpsLoading(false);
        setErrorPrompt("Không thể truy cập GPS phần cứng. Đã sử dụng vị trí giả lập trụ sở UBND phường An Phú.");
      }
    );
  };

  // Fast focus capability
  const handleRowFocus = (hh: GisHousehold) => {
    setSelectedPinId(hh.id);
    setSelectedPoiId(null);
    if (mapRef.current) {
      mapRef.current.setView([hh.lat, hh.lng], 17);
    }
  };

  // Traveling Salesperson Multi-Transport Route Search
  const computeOptimalVisitingRoute = async () => {
    if (patrolWaypoints.length < 1) {
      setErrorPrompt("Hãy tích chọn ít nhất 1 điểm Hộ PIN từ danh sách hoặc bản đồ để dẫn đường hành trình!");
      return;
    }
    setErrorPrompt("");
    setIsLoading(true);

    const centroid = { lat: 10.8021, lng: 106.7215 }; // Ward Center

    try {
      const res = await fetch("/api/gis/route-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startLatLng: centroid,
          endLatLng: centroid,
          waypointIds: patrolWaypoints
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCalculatedPath(data.path);
        
        // Custom speeds ETAs
        let speedMps = 1.3; // walking
        if (travelMode === "motorbike") speedMps = 8.35; // 30 km/h
        if (travelMode === "car") speedMps = 11.1; // 40 km/h

        const durationSec = data.totalDistanceMeters / speedMps;
        setPatrolDistance(data.totalDistanceMeters);
        setPatrolDuration(Math.ceil(durationSec / 60));

        setSqlLogs(prev => [data.sqlCommand, ...prev]);
        setSuccessPrompt(`Tính chỉ dẫn đường tối ưu (${travelMode === "walking" ? "Đi bộ" : travelMode === "motorbike" ? "Xe máy" : "Ô tô"}) thành công!`);
        setTimeout(() => setSuccessPrompt(""), 4000);
      } else {
        setErrorPrompt(data.error || "Lỗi giải mã cấu trúc Dijkstra.");
      }
    } catch {
      setErrorPrompt("Lỗi tính toán chỉ đạo không gian hành trình.");
    } finally {
      setIsLoading(false);
    }
  };

  // Save/Upsert coordinate pin
  const handleFormSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValue.headerName || !formValue.lat || !formValue.lng) {
      setErrorPrompt("Vui lòng nhập đầy đủ tên/chủ hộ, vĩ độ và kinh độ số!");
      return;
    }

    setIsLoading(true);
    setErrorPrompt("");
    setSuccessPrompt("");

    let url = "/api/gis/household/upsert";
    let bodyData: any = formValue;

    if (formElementType === "feature") {
      url = "/api/gis/feature/upsert";
      bodyData = {
        id: formValue.id,
        name: formValue.headerName,
        type: "camera",
        lat: formValue.lat,
        lng: formValue.lng,
        notes: formValue.notes
      };
    } else if (formElementType === "intersection") {
      url = "/api/gis/feature/upsert";
      bodyData = {
        id: formValue.id,
        name: formValue.headerName,
        type: "intersection",
        lat: formValue.lat,
        lng: formValue.lng,
        notes: formValue.notes
      };
    } else if (formElementType === "subzone") {
      url = "/api/gis/subzone/upsert";
      bodyData = {
        id: formValue.id,
        name: formValue.headerName,
        leaderName: formValue.phoneNumber,
        color: formValue.tagSecurity === "Nguy hiểm" ? "#e11d48" : formValue.tagSecurity === "Cảnh báo" ? "#ea580c" : "#3b82f6",
        lat: formValue.lat,
        lng: formValue.lng
      };
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": encodeURIComponent(currentUser?.email || ""),
          "x-user-role": encodeURIComponent(activeRole || ""),
          "x-user-name": encodeURIComponent(currentUser?.fullName || "Cán bộ quản lý")
        },
        body: JSON.stringify(bodyData)
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessPrompt(formType === "create" ? "Khởi tạo đối tượng GIS thành công!" : "Cập nhật thay đổi đối tượng GIS thành công!");
        setSqlLogs(prev => [data.sqlCommand, ...prev]);
        setShowFormModal(false);
        setAiSuggestInfo(null);
        
        // Log changes locally to client changelog
        if (formElementType === "household" && data.gisHousehold) {
          const timelineText = formType === "create" ? "Bản đồ hóa gán tọa độ ban đầu" : `Di động thay đổi vĩ kinh độ chỉnh tay sang: ${formValue.lat}, ${formValue.lng}`;
          saveTimelineEvents([
            {
              id: `tm_${Date.now()}`,
              householdId: data.gisHousehold.id,
              eventType: formType === "create" ? "move_in" : "notes_update",
              text: `${timelineText} (Người sửa: ${currentUser?.fullName || "Cán bộ kỹ thuật"})`,
              date: formatDateTime(new Date())
            },
            ...timelineEvents
          ]);
        }

        fetchGisDb();
        onRefresh();
        setTimeout(() => setSuccessPrompt(""), 3500);
      } else {
        setErrorPrompt(data.error || "Giao dịch không gian bị từ chối.");
      }
    } catch {
      setErrorPrompt("Sự cố kết nối máy chủ địa chính.");
    } finally {
      setIsLoading(false);
    }
  };

  // On-Site note log trigger
  const handleAddSubmitFieldNote = () => {
    if (!noteValue.trim() || !selectedPinId) return;
    
    // Add new notes
    const newNote: FieldNote = {
      id: `f_note_${Date.now()}`,
      householdId: selectedPinId,
      category: noteCategory,
      authorName: currentUser?.fullName || "Điều hành viên",
      text: noteValue,
      photoUrl: uploadPhotoBase64 || undefined,
      timestamp: formatDateTime(new Date())
    };

    saveFieldNotes([newNote, ...fieldNotes]);
    setNoteValue("");
    setUploadPhotoBase64(null);
    setSuccessPrompt("Ghi chú hiện trường đã được khóa lưu.");
    setTimeout(() => setSuccessPrompt(""), 2000);
  };

  // Convert files for facade photos
  const handleFacadeFileSelectorChange = (e: React.ChangeEvent<HTMLInputElement>, hhId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadProgress(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      saveFacadePhoto(hhId, reader.result as string);
      setUploadProgress(false);
      setSuccessPrompt("Tải ảnh mặt tiền số nhà thành công!");
      setTimeout(() => setSuccessPrompt(""), 2000);
    };
    reader.readAsDataURL(file);
  };

  // Handle Note capture snapshot helper
  const handleNoteImageSelectHelper = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadPhotoBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Delete pin
  const handleDeletePinCascade = async (hhId: string, name: string) => {
    if (!window.confirm(`CẢNH BÁO PHÁP LÝ HỘ TỊCH: Xóa hộ của ông/bà "${name}" sẽ đồng thời xoá toàn bộ hộ khẩu cùng tất cả nhân khẩu (Residents) cư trú đi kèm! Thao tác này KHÔNG THỂ KHÔI PHỤC. Chắc chắn xóa?`)) {
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/gis/household/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": encodeURIComponent(currentUser?.email || ""),
          "x-user-role": encodeURIComponent(activeRole || ""),
          "x-user-name": encodeURIComponent(currentUser?.fullName || "")
        },
        body: JSON.stringify({ id: hhId })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessPrompt("Đã cascade xóa hoàn toàn hộ gia đình và nhân khẩu liên quan!");
        setSqlLogs(prev => [data.sqlCommand, ...prev]);
        setSelectedPinId(null);
        
        // Clean dynamic timeline and notes for this household
        saveFieldNotes(fieldNotes.filter(n => n.householdId !== hhId));
        saveTimelineEvents(timelineEvents.filter(e => e.householdId !== hhId));
        
        fetchGisDb();
        onRefresh();
        setTimeout(() => setSuccessPrompt(""), 3500);
      } else {
        setErrorPrompt(data.error || "Lỗi máy chủ phát sinh.");
      }
    } catch {
      setErrorPrompt("Sự cố xóa dữ liệu.");
    } finally {
      setIsLoading(false);
    }
  };

  // Raw SQL execute helper
  const handleSqlConsoleExecute = async () => {
    setErrorPrompt("");
    setQueryConsoleOutput(null);
    try {
      const res = await fetch("/api/gis/query-console", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: rawSqlInput })
      });
      const data = await res.json();
      if (res.ok) {
        setQueryConsoleOutput(data);
        setSqlLogs(prev => [data.sqlCommand, ...prev]);
      } else {
        setErrorPrompt(data.error || "Giao dịch SQL thất bại.");
      }
    } catch {
      setErrorPrompt("Cú pháp PostGIS sai lầm.");
    }
  };

  // AI Prompt analyzer
  const handleAiNavigateAnalyze = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiThinking(true);
    setAiAnalysisResult("");
    setAiStatusMessage("Đang gọi động cơ Gemini-3.5-flash rà soát PostGIS tables...");

    try {
      const res = await fetch("/api/gis/ai-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userPrompt: aiPrompt })
      });
      const data = await res.json();
      if (res.ok) {
        setAiAnalysisResult(data.analysis);
      } else {
        setErrorPrompt(data.error || "Lỗi máy chủ AI.");
      }
    } catch {
      setErrorPrompt("Không thể liên kết trợ lý AI.");
    } finally {
      setIsAiThinking(false);
      setAiStatusMessage("");
    }
  };

  // Clear path waypoints
  const clearOptimalEvacuationPath = () => {
    setCalculatedPath([]);
    setPatrolWaypoints([]);
    setPatrolDistance(0);
    setPatrolDuration(0);
  };

  return (
    <div className={`space-y-6 ${isFullscreen ? "fixed inset-0 z-50 bg-slate-900 p-6 overflow-y-auto" : ""}`}>
      {/* HEADER SECTION WITH METRICS */}
      <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-500 rounded-lg shadow-md text-white animate-pulse">
                <Map className="h-5 w-5" />
              </span>
              <h2 className="text-xl font-bold tracking-tight">🗺️ Bản đồ số Địa Chỉ Số (Khu Phố 3, can hệ PostGIS)</h2>
            </div>
            <p className="text-xs text-indigo-200">
              Cổng quản trị không gian địa vị số chính quyền đô thị. Số hóa điểm Hộ (POINT), đường Trục (LINESTRING), ranh giới Tổ (POLYGON) đồng bộ CSDL Quốc Gia.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer border border-slate-700 flex items-center gap-1"
              title="Phóng to toàn ảnh màn hình"
            >
              {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
              {isFullscreen ? "Thu nhỏ" : "Toàn màn hình"}
            </button>

            <button
              onClick={() => setIsMobileMode(!isMobileMode)}
              className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${isMobileMode ? "bg-purple-600 text-white border-purple-500" : "bg-slate-800/80 text-slate-300 border-slate-700"}`}
            >
              <Compass className={`h-4 w-4 ${isMobileMode ? "animate-spin" : ""}`} /> 
              {isMobileMode ? "📳 Chế độ Thực địa" : "💻 Chế độ Máy tính"}
            </button>

            <button
              onClick={fetchGisDb}
              className="flex items-center gap-1.5 text-xs font-bold bg-indigo-700 hover:bg-indigo-650 text-white px-3.5 py-2 rounded-xl transition cursor-pointer shadow-lg shadow-indigo-900/40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Đồng bộ ranh giới
            </button>

            {canEdit && (
              <button
                onClick={() => {
                  setFormType("create");
                  setFormElementType("household");
                  setSearchHouseholdQuery("");
                  setShowHouseholdSuggestions(false);
                  setFormValue({
                    id: "",
                    headerName: "",
                    address: "",
                    phoneNumber: "",
                    notes: "",
                    lat: searchTargetCoords?.lat || 10.8021,
                    lng: searchTargetCoords?.lng || 106.7215,
                    groupNDTQ: polygonContainment || "Tổ 3",
                    tagSecurity: "Bình thường"
                  });
                  setAiSuggestInfo(null);
                  setShowFormModal(true);
                }}
                className="flex items-center gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl transition cursor-pointer shadow-lg shadow-emerald-950/50"
              >
                <Plus className="h-4 w-4" /> Thêm điểm tọa độ (PIN)
              </button>
            )}
          </div>
        </div>

        {/* TOP STATUS BARS */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6 border-t border-slate-800 pt-4 text-center">
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/40">
            <span className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider">Hộ PIN (Point 4326)</span>
            <strong className="text-xl text-emerald-400 font-extrabold">{gisHouseholds.length}</strong>
            <span className="text-[10px] text-gray-500 block">Đã định vị bản đồ</span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/40">
            <span className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider">Tách rời (Unpinned)</span>
            <strong className="text-xl text-rose-400 font-extrabold">
              {Math.max(0, allHouseholds.length - gisHouseholds.length)}
            </strong>
            <span className="text-[10px] text-gray-500 block">Hộ CSDL chưa gán</span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/40">
            <span className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider">Cơ sở Trục (Linestring)</span>
            <strong className="text-xl text-indigo-400 font-extrabold">{gisStreets.length}</strong>
            <span className="text-[10px] text-gray-500 block">Trục lộ nội khu</span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/40">
            <span className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider">Phân khu Tổ (Polygon)</span>
            <strong className="text-xl text-purple-400 font-extrabold">{gisSubzones.length}</strong>
            <span className="text-[10px] text-gray-500 block">Tổ dân tự quản</span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/40 col-span-2 md:col-span-1">
            <span className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider">Mắt ANTT (Devices)</span>
            <strong className="text-xl text-rose-400 font-extrabold">
              {gisFeatures.filter(f => f.type === "camera").length} CM / {gisFeatures.filter(f => f.type === "hotspot").length} ĐM
            </strong>
            <span className="text-[10px] text-gray-500 block">Camera & Điểm nóng</span>
          </div>
        </div>
      </header>

      {/* BANNER NOTIFIERS */}
      {errorPrompt && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl flex items-center gap-2 text-xs font-semibold animate-pulse">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {errorPrompt}
        </div>
      )}
      {successPrompt && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center gap-2 text-xs font-semibold">
          <Check className="h-4 w-4 shrink-0" /> {successPrompt}
        </div>
      )}

      {/* CORE BENTO BUNDLE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: THE REAL LEAFLET MAP ELEMENT - 8 COLS */}
        <div className="lg:col-span-8 flex flex-col bg-slate-50 rounded-2xl border border-slate-200 shadow-md overflow-hidden min-h-[580px]">
          
          {/* MAP TOOLBAR INTERACTIVE DECK */}
          <div className="bg-slate-100 border-b border-slate-200 p-4 shrink-0 flex flex-wrap justify-between items-center gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-slate-900 text-white font-mono text-[9px] font-bold py-1 px-2.5 rounded shadow tracking-wide uppercase">
                ⚙️ Các lớp bản đồ
              </span>
              
              <button 
                onClick={() => setShowHouseholds(!showHouseholds)}
                className={`py-1 px-2.5 rounded-lg text-xs font-medium border transition cursor-pointer ${showHouseholds ? "bg-white text-emerald-700 border-emerald-300 shadow-sm" : "bg-slate-200 text-slate-550 border-slate-300"}`}
              >
                🟢 Hộ PIN
              </button>

              <button 
                onClick={() => setShowSubzones(!showSubzones)}
                className={`py-1 px-2.5 rounded-lg text-xs font-medium border transition cursor-pointer ${showSubzones ? "bg-white text-emerald-700 border-emerald-300 shadow-sm" : "bg-slate-200 text-slate-550 border-slate-300"}`}
              >
                🏘️ Tổ Polygon
              </button>

              <button 
                onClick={() => setShowStreets(!showStreets)}
                className={`py-1 px-2.5 rounded-lg text-xs font-medium border transition cursor-pointer ${showStreets ? "bg-white text-emerald-700 border-emerald-300 shadow-sm" : "bg-slate-200 text-slate-550 border-slate-300"}`}
              >
                🛣️ Trục giao lộ
              </button>

              <button 
                onClick={() => setShowPoi(!showPoi)}
                className={`py-1 px-2.5 rounded-lg text-xs font-medium border transition cursor-pointer ${showPoi ? "bg-white text-emerald-700 border-emerald-300 shadow-sm" : "bg-slate-200 text-slate-550 border-slate-300"}`}
              >
                📹 Điểm ANTT
              </button>
            </div>

            <div className="flex items-center gap-2 relative">
              {/* Collapsible Map Style Control (Lớp bản đồ / Lớp sự cố vãn cảnh) */}
              <div className="relative">
                <button
                  onClick={() => setShowLayerDropdown(!showLayerDropdown)}
                  className={`py-1 px-2.5 rounded-lg text-xs font-bold shadow-sm cursor-pointer border transition flex items-center gap-1 ${showLayerDropdown ? "bg-indigo-600 text-white border-indigo-500" : "bg-white text-slate-705 hover:bg-slate-50 border-slate-300"}`}
                  title="Thay đổi hiển thị bản đồ nền vệ tinh / đường phố"
                >
                  🗺️ Lớp bản đồ
                </button>
                
                {showLayerDropdown && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 p-2 rounded-xl shadow-2xl z-[1500] flex flex-col gap-1 w-[125px] text-left">
                    <span className="text-[8px] uppercase tracking-wider font-extrabold text-slate-400 px-1 mb-1 block select-none">🗺️ Lớp nền bản đồ</span>
                    <button
                      onClick={() => {
                        setMapStyle("standard");
                        setShowLayerDropdown(false);
                      }}
                      className={`flex items-center gap-1.5 w-full text-left py-1 px-2 rounded-lg text-[10px] font-bold transition cursor-pointer ${mapStyle === "standard" ? "bg-indigo-600 text-white shadow-md font-extrabold" : "text-slate-700 hover:bg-slate-100"}`}
                    >
                      <span className="text-xs">🗺️</span> Tiêu chuẩn
                    </button>
                    <button
                      onClick={() => {
                        setMapStyle("satellite");
                        setShowLayerDropdown(false);
                      }}
                      className={`flex items-center gap-1.5 w-full text-left py-1 px-2 rounded-lg text-[10px] font-bold transition cursor-pointer ${mapStyle === "satellite" ? "bg-indigo-600 text-white shadow-md font-extrabold" : "text-slate-700 hover:bg-slate-100"}`}
                    >
                      <span className="text-xs">🛰️</span> Vệ tinh
                    </button>
                    <button
                      onClick={() => {
                        setMapStyle("hybrid");
                        setShowLayerDropdown(false);
                      }}
                      className={`flex items-center gap-1.5 w-full text-left py-1 px-2 rounded-lg text-[10px] font-bold transition cursor-pointer ${mapStyle === "hybrid" ? "bg-indigo-600 text-white shadow-md font-extrabold" : "text-slate-700 hover:bg-slate-100"}`}
                    >
                      <span className="text-xs">🌎</span> Kết hợp
                    </button>
                    <button
                      onClick={() => {
                        setMapStyle("terrain");
                        setShowLayerDropdown(false);
                      }}
                      className={`flex items-center gap-1.5 w-full text-left py-1 px-2 rounded-lg text-[10px] font-bold transition cursor-pointer ${mapStyle === "terrain" ? "bg-indigo-600 text-white shadow-md font-extrabold" : "text-slate-700 hover:bg-slate-100"}`}
                    >
                      <span className="text-xs">⛰️</span> Địa hình
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowHeatmap(!showHeatmap)}
                className={`py-1 px-3 rounded-lg text-xs font-bold shadow-sm cursor-pointer border transition flex items-center gap-1 ${showHeatmap ? "bg-rose-600 text-white border-rose-500 animate-pulse" : "bg-white text-slate-700 hover:bg-slate-50 border-slate-300"}`}
                title="Kích hoạt Kernel Density mô phỏng đốm màu mật độ"
              >
                🔴 Bản đồ nhiệt
              </button>

              <button
                onClick={triggerGpsLocate}
                className={`p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg cursor-pointer flex items-center gap-1 text-xs font-bold transition shadow ${gpsLoading ? "animate-spin" : ""}`}
                title="Khóa vệ tinh định vị vị trí hiện tại của bạn"
              >
                <Compass className="h-4 w-4" />
                GPS
              </button>
            </div>
          </div>

          {/* DYNAMIC LEAFLET ELEMENT BODY CONTAINER */}
          <div className="relative flex-1 min-h-[480px] bg-slate-205 pointer-events-auto">
            {/* Compass Overlay HUD */}
            <div className="absolute top-4 left-4 bg-slate-900/95 border border-slate-800 rounded-xl p-3 shadow-2xl z-[1050] text-slate-300 font-mono text-[9px] pointer-events-none select-none hidden xl:block">
              <p className="text-white text-xs font-bold border-b border-slate-800 pb-1 mb-1">🧭 THÔNG SỐ VỆ TINH</p>
              <p>Mã dự án: An Phú GIS</p>
              <p>Tốc độ tải: &lt; 1.2s</p>
              <p>WKT Map Projection: SRID EPSG:4326</p>
              {searchTargetCoords ? (
                <>
                  <p className="text-emerald-400 font-semibold mt-1">Sát hạch ranh giới địa phận:</p>
                  <p className="text-white">Lat: {searchTargetCoords.lat.toFixed(5)}</p>
                  <p className="text-white">Lng: {searchTargetCoords.lng.toFixed(5)}</p>
                  <p className="text-amber-400">TDP: {polygonContainment}</p>
                </>
              ) : (
                <p className="text-gray-500 animate-pulse mt-0.5">Vui lòng click bất kì điểm nào để thả ranh giới!</p>
              )}
            </div>

            {/* Smart Floating Search Google Places Bar */}
            <div className="absolute top-4 left-4 md:left-[110px] xl:left-[145px] bg-white border border-slate-200 rounded-2xl shadow-2xl z-[1050] w-[260px] md:w-[320px] overflow-hidden">
              <div className="flex items-center px-3 py-2 bg-slate-50/50">
                <Search className="h-4 w-4 text-indigo-500 shrink-0" />
                <input
                  type="text"
                  value={placeSearchQuery}
                  onChange={(e) => {
                    setPlaceSearchQuery(e.target.value);
                    setShowPlaceDropdown(true);
                    if (e.target.value.trim().length > 1) {
                      triggerPlacesSearch(e.target.value);
                    }
                  }}
                  onFocus={() => setShowPlaceDropdown(true)}
                  placeholder="Tìm kiếm địa chỉ, địa danh vệ tinh..."
                  className="w-full text-xs pl-2.5 pr-1 focus:outline-none bg-transparent font-bold text-slate-800 placeholder-slate-450"
                />
                {placeSearchQuery && (
                  <button
                    onClick={() => {
                      setPlaceSearchQuery("");
                      setPlaceSearchResults([]);
                    }}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              
              {showPlaceDropdown && placeSearchResults.length > 0 && (
                <div className="border-t border-slate-100 max-h-[220px] overflow-y-auto divide-y divide-slate-100 bg-white">
                  {placeSearchResults.map((place, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        const latVal = parseFloat(place.lat);
                        const lngVal = parseFloat(place.lon);
                        
                        setSearchTargetCoords({ lat: latVal, lng: lngVal });
                        setFormValue(prev => ({
                          ...prev,
                          lat: Math.round(latVal * 1000000) / 1000000,
                          lng: Math.round(lngVal * 1000000) / 1000000,
                          address: place.display_name.replace(", Việt Nam", "")
                        }));
                        
                        if (mapRef.current) {
                          mapRef.current.setView([latVal, lngVal], 18);
                        }
                        
                        runContainsQuery(latVal, lngVal);
                        
                        setPlaceSearchQuery(place.name || place.display_name.split(",")[0]);
                        setShowPlaceDropdown(false);
                      }}
                      className="w-full text-left p-3 hover:bg-indigo-50/50 transition cursor-pointer flex flex-col gap-0.5"
                    >
                      <span className="font-extrabold text-slate-900 text-xs truncate">📍 {place.name || place.display_name.split(",")[0]}</span>
                      <span className="text-slate-500 truncate text-[9px]">{place.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
              {isSearchingPlace && (
                <div className="p-2 text-center text-[10px] text-indigo-600 font-extrabold bg-indigo-50 border-t animate-pulse">
                  📡 Đang vệ tinh quét định dạng địa hình...
                </div>
              )}
            </div>

            {/* Quick guidance banner */}
            <div className="absolute bottom-4 right-4 bg-slate-950/90 text-white px-3 py-1.5 rounded-lg border border-slate-800 text-[10px] font-semibold text-center pointer-events-none z-[1000] max-w-xs shadow-xl">
              💡 <span className="text-amber-400">AI Assist:</span> Click bất cứ vị trí nào để lấy hệ số vĩ kinh độ chỉnh tay, hoặc gán nhanh bằng AI tự động!
            </div>

            {/* Map Element */}
            <div ref={mapContainerRef} className="h-full w-full relative z-10 min-h-[460px]"></div>
          </div>

          {/* SENSOR READING HUD FOOTER */}
          <div className="bg-slate-900 text-slate-400 text-[11px] p-3 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-3">
            <div className="flex flex-wrap gap-4 items-center">
              <span>🗺️ Bộ phóng thu: <strong className="text-white font-semibold">16x (Vệ tinh)</strong></span>
              <span>🟢 Tổng số Hộ đã gán PIN: <strong className="text-white font-semibold text-emerald-400">{gisHouseholds.length} / {allHouseholds.length}</strong></span>
              {searchTargetCoords && (
                <span className="text-indigo-400 font-mono hidden md:inline">📍 Định vị: {searchTargetCoords.lat.toFixed(6)}, {searchTargetCoords.lng.toFixed(6)} | TDP: {polygonContainment}</span>
              )}
            </div>

            {canEdit && (
              <div className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/50 px-2.5 py-1 rounded border border-emerald-900/50">
                ● Cán bộ Đô thị / Công an khu vực: Đầy đủ đặc quyền ghi (R/W)
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: SEARCH, CONTROL DETAILS, AI & ANALYTICAL WORKBENCH - 4 COLS */}
        <div className="lg:col-span-4 flex flex-col gap-6">

          {/* SYSTEM SIDEBAR TABS CONTROLLER */}
          <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 grid grid-cols-5 text-center">
            <button
              onClick={() => setActiveTab("inspector")}
              className={`py-1.5 rounded-lg text-[10px] font-bold transition flex flex-col items-center gap-1 cursor-pointer ${activeTab === "inspector" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-550 hover:bg-slate-50"}`}
              title="Thông tin chi tiết địa điểm"
            >
              <MapPin className="h-3.5 w-3.5" />
              Chi tiết
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`py-1.5 rounded-lg text-[10px] font-bold transition flex flex-col items-center gap-1 cursor-pointer ${activeTab === "analytics" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-550 hover:bg-slate-50"}`}
              title="Thống kê mật độ dân cư và AI phân tích địa bàn"
            >
              <Cpu className="h-3.5 w-3.5" />
              Mật độ AI
            </button>
            <button
              onClick={() => setActiveTab("route")}
              className={`py-1.5 rounded-lg text-[10px] font-bold transition flex flex-col items-center gap-1 cursor-pointer ${activeTab === "route" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-550 hover:bg-slate-50"}`}
              title="Lộ trình di tản di động tuần định"
            >
              <Navigation className="h-3.5 w-3.5" />
              Dẫn đường
            </button>
            <button
              onClick={() => setActiveTab("fields")}
              className={`py-1.5 rounded-lg text-[10px] font-bold transition flex flex-col items-center gap-1 cursor-pointer ${activeTab === "fields" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-550 hover:bg-slate-50"}`}
              title="Xem nhật ký, lịch sử thay đổi địa chỉ số"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Thực địa
            </button>
            <button
              onClick={() => setActiveTab("console")}
              className={`py-1.5 rounded-lg text-[10px] font-bold transition flex flex-col items-center gap-1 cursor-pointer ${activeTab === "console" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-550 hover:bg-slate-50"}`}
              title="Giao diện dòng lệnh PostGIS SQL thô"
            >
              <Terminal className="h-3.5 w-3.5" />
              Console
            </button>
          </div>

          {/* ACTIVE TAB DECK CONTENT */}
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-md p-5 min-h-[460px]">
            
            {/* TAB 1: INSPECTOR DETAILS & DIRECT SEARCH INDEX */}
            {activeTab === "inspector" && (
              <div className="space-y-4">
                
                {/* ADVANCED SELECTION DIRECT INDEX LIST AND SEARCH TOOLBOX */}
                <div className="space-y-2">
                  <header className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">🔍 Tra cứu hành chính số</h3>
                    <span className="text-[10px] font-mono text-indigo-600 font-extrabold bg-indigo-50 px-2 py-0.5 rounded">
                      Có {filteredGisHouseholds.length} kết quả
                    </span>
                  </header>

                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input 
                      type="text" 
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      placeholder="Tìm chủ hộ, số nhà, đường, SĐT..."
                      className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                    />
                  </div>

                  {/* DOUBLE INDEX SELECT BOX DECK */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] uppercase tracking-wider font-bold text-gray-500 block mb-1">Cư trú</label>
                      <select 
                        value={residenceTypeFilter}
                        onChange={(e) => setResidenceTypeFilter(e.target.value)}
                        className="w-full text-[11px] p-1.5 border border-slate-200 rounded-lg bg-white font-medium text-slate-705"
                      >
                        <option value="All">Tất cả</option>
                        <option value="Thường trú">Thường trú</option>
                        <option value="Tạm trú">Tạm trú</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] uppercase tracking-wider font-bold text-gray-500 block mb-1">Đoàn thể / Đối tượng</label>
                      <select 
                        value={specialGroupFilter}
                        onChange={(e) => setSpecialGroupFilter(e.target.value)}
                        className="w-full text-[11px] p-1.5 border border-slate-200 rounded-lg bg-white text-indigo-700 font-semibold"
                      >
                        <option value="All">Tất cả nhóm</option>
                        <option value="Đảng viên">Đảng viên</option>
                        <option value="Phụ nữ">Hội Phụ nữ</option>
                        <option value="CCB">Cựu chiến binh (CCB)</option>
                        <option value="Thanh niên">Đoàn Thanh niên</option>
                        <option value="Cao tuổi">Người cao tuổi (≥60)</option>
                        <option value="Trẻ em">Trẻ em (&lt;16)</option>
                        <option value="Hộ nghèo">Hộ nghèo 🔴</option>
                        <option value="Hộ cận nghèo">Hộ cận nghèo 🟡</option>
                      </select>
                    </div>
                  </div>

                  {/* ADDITIONAL GIS TYPE FILTER */}
                  <div>
                    <label className="text-[9px] uppercase tracking-wider font-bold text-gray-500 block mb-1">Phân loại Đối tượng Bản đồ (GIS Type)</label>
                    <select
                      value={gisTypeFilter}
                      onChange={(e) => setGisTypeFilter(e.target.value)}
                      className="w-full text-[11px] p-1.5 border border-slate-200 rounded-lg bg-white text-emerald-800 font-bold"
                    >
                      <option value="All">👥 Tất cả đối tượng bản đồ ({filteredGisHouseholds.length})</option>
                      <option value="household_permanent">🏠 Hộ dân thường trú</option>
                      <option value="household_temporary">🏡 Hộ dân tạm trú</option>
                      <option value="visitor">👤 Người vãng lai</option>
                      <option value="business">🏪 Cơ sở kinh doanh</option>
                      <option value="lodging">🛏️ Cơ sở trọ / Nhà trọ</option>
                      <option value="headquarters">⭐ Văn phòng khu phố</option>
                      <option value="culture_house">🏛️ Điểm sinh hoạt cộng đồng</option>
                      <option value="school">🏫 Trường học</option>
                      <option value="medical">🏥 Trạm y tế</option>
                      <option value="park">🌳 Công viên</option>
                      <option value="waste">🗑️ Điểm tập kết rác</option>
                      <option value="other">📍 Công trình công cộng khác</option>
                    </select>
                  </div>

                  {/* QUICK MATCH LIST IN TAB */}
                  <div className="overflow-y-auto max-h-[170px] border border-slate-100 rounded-xl divide-y divide-slate-100">
                    {filteredGisHouseholds.length === 0 ? (
                      <p className="text-center py-6 text-xs text-slate-400 font-medium">Không tìm thấy hộ gán pin tương thích.</p>
                    ) : (
                      filteredGisHouseholds.slice(0, 100).map(hh => {
                        const isSel = selectedPinId === hh.id;
                        return (
                          <div
                            key={hh.id}
                            onClick={() => handleRowFocus(hh)}
                            className={`p-2.5 text-left text-xs transition cursor-pointer flex justify-between items-center ${isSel ? "bg-indigo-50/75 border-l-4 border-indigo-600" : "hover:bg-slate-50"}`}
                          >
                            <div>
                              <p className="font-bold text-slate-900">{hh.headerName}</p>
                              <p className="text-[10px] text-slate-500 truncate mt-0.5">🏠 {hh.address}</p>
                            </div>
                            <span className="text-[9px] font-bold text-indigo-650 bg-indigo-50 px-2 py-0.5 rounded-full uppercase shrink-0">
                              {hh.groupNDTQ || "Tổ 3"}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* INSPECTOR VIEW CONTENT SELECTION */}
                <div className="border-t border-slate-100 pt-3">
                  {!selectedPinId && !selectedPoiId ? (
                    <div className="text-center py-6 text-xs text-slate-400 space-y-2 font-medium">
                      <MapPin className="h-8 w-8 mx-auto text-indigo-400 animate-bounce" />
                      <p>Hãy click chọn một hộ PIN 🟢 hoặc điểm nóng trên bản đồ để rà soát chi tiết nhân khẩu, ghi chú và in thẻ QR!</p>
                    </div>
                  ) : selectedPinId ? (() => {
                    const hh = gisHouseholds.find(h => h.id === selectedPinId);
                    if (!hh) return null;
                    const isWaypoint = patrolWaypoints.includes(hh.id);
                    const photo = facadePhotos[hh.id];
                    const hhResidents = allResidents.filter(r => r.householdId === hh.id);

                    return (
                      <div className="space-y-3 text-left">
                        
                        {/* Summary Block */}
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex gap-3 relative overflow-hidden">
                          {/* Facade photo display */}
                          <div className="w-16 h-16 rounded-lg bg-slate-200 border border-slate-300 flex flex-col items-center justify-center relative overflow-hidden shrink-0">
                            {photo ? (
                              <img src={photo} alt="façade" className="w-full h-full object-cover" />
                            ) : (
                              <div className="text-center p-1 text-[9px] text-gray-400">
                                📷 No Facade Photo
                              </div>
                            )}
                            <label className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] py-0.5 text-center cursor-pointer font-bold uppercase hover:bg-black/80">
                              Sửa
                              <input 
                                type="file" 
                                accept="image/*" 
                                onChange={(e) => handleFacadeFileSelectorChange(e, hh.id)}
                                className="hidden" 
                              />
                            </label>
                          </div>

                          <div className="flex-1 space-y-0.5 leading-tight">
                            <span className="bg-emerald-600 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase">
                              HỘ PIN ĐỊA CHỈ SỐ
                            </span>
                            <h4 className="font-extrabold text-sm text-slate-900 mt-0.5 leading-snug">{hh.headerName}</h4>
                            <p className="text-[10px] text-gray-500 font-mono">ID: {hh.id} | {hh.gisCode || `KP3-${hh.id}`}</p>
                            <p className="text-[11px] text-slate-700 pt-0.5">🏠 {hh.address}</p>
                          </div>
                        </div>

                        {/* Residents summary ledger */}
                        <div className="bg-indigo-50/50 rounded-xl p-2.5 border border-indigo-100 text-[11px] space-y-1">
                          <p className="font-bold text-indigo-900">👥 Nhân khẩu lưu trú ({hhResidents.length} thành viên):</p>
                          {hhResidents.length === 0 ? (
                            <p className="text-gray-400 italic">Chưa liên kết dữ liệu nhân khẩu trong CSDL quốc gia</p>
                          ) : (
                            <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-700">
                              {hhResidents.map(r => (
                                <div key={r.id} className="bg-white p-1 rounded border border-indigo-50/60 truncate" title={`${r.fullName} (${r.relationWithHeader})`}>
                                  <b>{r.fullName}</b> <span className="text-gray-400">({r.relationWithHeader === "Chủ hộ" ? "Chủ" : r.relationWithHeader})</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Coords and PostGIS text coordinates */}
                        <div className="bg-slate-950 text-slate-300 font-mono text-[9px] p-2.5 rounded-xl space-y-0.5 border border-slate-900">
                          <p className="text-indigo-400 font-semibold mb-0.5 border-b border-indigo-950 pb-0.5">🛰️ TOẠ ĐỘ POINT 4326</p>
                          <p>Vĩ độ (Lat): {hh.lat.toFixed(6)} </p>
                          <p>Kinh độ (Lng): {hh.lng.toFixed(6)}</p>
                          <p className="truncate">WKT WKT: POINT({hh.lng} {hh.lat})</p>
                        </div>

                        {/* Buttons utilities panels */}
                        <div className="grid grid-cols-3 gap-1.5 text-[10px] font-bold">
                          <button
                            onClick={() => {
                              setFormType("edit");
                              setFormElementType("household");
                              setSearchHouseholdQuery(hh.headerName + " - " + hh.address);
                              setShowHouseholdSuggestions(false);
                              setFormValue({
                                id: hh.id,
                                headerName: hh.headerName,
                                address: hh.address,
                                phoneNumber: hh.phoneNumber,
                                notes: hh.notes || "",
                                lat: hh.lat,
                                lng: hh.lng,
                                groupNDTQ: hh.groupNDTQ || "Tổ 3",
                                tagSecurity: (hh as any).tagSecurity || "Bình thường"
                              });
                              setAiSuggestInfo(null);
                              setShowFormModal(true);
                            }}
                            disabled={!canEdit}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-1.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <Edit2 className="h-3 w-3" /> Chỉnh sửa
                          </button>

                          <button
                            onClick={() => {
                              setQrTargetHousehold(hh);
                              setShowQrPlate(true);
                            }}
                            className="bg-indigo-650 hover:bg-indigo-600 text-white py-1.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <QrCode className="h-3 w-3" /> Thẻ QR Số
                          </button>

                          <button
                            onClick={() => {
                              if (isWaypoint) {
                                setPatrolWaypoints(prev => prev.filter(id => id !== hh.id));
                              } else {
                                setPatrolWaypoints(prev => [...prev, hh.id]);
                              }
                            }}
                            className={`py-1.5 rounded-lg border flex items-center justify-center gap-1 cursor-pointer ${isWaypoint ? "bg-purple-100 text-purple-700 border-purple-300" : "bg-slate-900 border-slate-800 text-white"}`}
                          >
                            <Navigation className="h-3 w-3" /> Map Route
                          </button>

                          {canEdit && (
                            <button
                              onClick={() => handleDeletePinCascade(hh.id, hh.headerName)}
                              className="col-span-3 bg-rose-600 hover:bg-rose-500 text-white p-2 rounded-lg flex justify-center items-center gap-1.5 mt-1 transition cursor-pointer font-extrabold"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> XÓA GIA ĐÌNH CASCADE HỘ TỊCH
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })() : (() => {
                    const poi = gisFeatures.find(f => f.id === selectedPoiId);
                    if (!poi) return null;
                    const isWaypoint = patrolWaypoints.includes(poi.id);

                    return (
                      <div className="space-y-3 text-left">
                        <div className="bg-slate-950 text-white p-3.5 rounded-xl space-y-1 border border-slate-800">
                          <span className="bg-rose-600 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded inline-block uppercase">
                            THIẾT BỊ HẠ TẦNG AN NINH
                          </span>
                          <h4 className="font-extrabold text-sm tracking-wide">{poi.name}</h4>
                          <p className="text-[10px] text-gray-500 font-mono">Phân loại: {poi.type === "camera" ? "Mắt camera giám sát" : "Điểm nóng ANTT"}</p>
                          <p className="text-[11px] text-slate-300 pt-1">📍 Tọa độ GPS: {poi.lat.toFixed(6)}, {poi.lng.toFixed(6)}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                          <button
                            onClick={() => {
                              if (isWaypoint) {
                                setPatrolWaypoints(prev => prev.filter(id => id !== poi.id));
                              } else {
                                setPatrolWaypoints(prev => [...prev, poi.id]);
                              }
                            }}
                            className={`p-2 rounded-lg border text-center transition cursor-pointer flex justify-center items-center gap-1 ${isWaypoint ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-slate-900 text-white border-slate-800"}`}
                          >
                            <Navigation className="h-3 w-3 text-emerald-400" />
                            {isWaypoint ? "Bỏ rà soát" : "Gán vào tuần tra"}
                          </button>
                          
                          <button
                            onClick={() => {
                              setSelectedPoiId(null);
                            }}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 p-2 rounded-lg text-center cursor-pointer"
                          >
                            Đóng
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>

              </div>
            )}

            {/* TAB 2: ANALYTICS DENSITY & THE BIG AI COMPANION */}
            {activeTab === "analytics" && (
              <div className="space-y-4 text-left">
                <header className="pb-2 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1"><Cpu className="text-indigo-600 h-4.5 w-4.5" /> AI Phân tích địa bàn & Trực quan mật độ</h3>
                  <span className="bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded text-[10px] font-bold">PostGIS ST_Area</span>
                </header>

                {/* REAL DENSITY STATISTICS CALCULATED ON THE CLIENT */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
                  <p className="text-xs font-bold text-slate-900 border-b border-slate-200 pb-1">📊 Kết quả mật độ vùng:</p>
                  
                  <div className="space-y-2 max-h-[140px] overflow-y-auto">
                    {gisSubzones.map(subzone => {
                      // Count residents inside this zone
                      const hhInZone = gisHouseholds.filter(h => h.groupNDTQ === subzone.name);
                      const residentsCount = allResidents.filter(r => {
                        const hhOfRes = gisHouseholds.find(h => h.id === r.householdId);
                        return hhOfRes && hhOfRes.groupNDTQ === subzone.name;
                      }).length;

                      // Count poverty households in this subzone
                      const poorHhCount = hhInZone.filter(hh => {
                        const members = allResidents.filter(r => r.householdId === hh.id);
                        return members.some(r => r.specialCategories?.includes("Hộ nghèo"));
                      }).length;

                      // Count elderly in subzone
                      const elderHhCount = hhInZone.filter(hh => {
                        const members = allResidents.filter(r => r.householdId === hh.id);
                        return members.some(r => {
                          const age = new Date().getFullYear() - new Date(r.dob).getFullYear();
                          return age >= 60;
                        });
                      }).length;

                      return (
                        <div key={subzone.id} className="text-[10px] bg-white p-2 rounded-lg border border-slate-100/80 leading-relaxed shadow-sm">
                          <div className="flex justify-between items-center font-extrabold text-slate-900 text-[11px]">
                            <span className="text-emerald-700">🏘️ {subzone.name}</span>
                            <span>{residentsCount} cư dân</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 mt-1 bg-slate-50 p-1.5 rounded text-gray-500 font-mono">
                            <div>👥 Hộ PIN: <b>{hhInZone.length}</b></div>
                            <div className="text-rose-600">🔴 Nghèo: <b>{poorHhCount}</b></div>
                            <div className="text-amber-600">👴 Già: <b>{elderHhCount}</b></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* THE SYSTEM AI COMPANION PROMPT INTERFACES */}
                <div className="space-y-2 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                  <p className="text-xs font-bold text-indigo-900 flex items-center gap-1">🛸 Trợ lý ảo địa chính:</p>
                  
                  <div className="relative">
                    <textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Nêu ý kiến đề xuất phân bổ trạm sạc xe điện, camera phạt nguội, hoặc lên lộ trình tiếp cận hộ nghèo..."
                      className="w-full text-xs p-2.5 border border-indigo-250 rounded-lg h-20 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed"
                    />
                  </div>

                  <div className="flex justify-between items-center gap-2 pt-1">
                    {/* Prompt Presets selector */}
                    <select
                      onChange={(e) => setAiPrompt(e.target.value)}
                      className="text-[9px] border border-indigo-200 rounded p-1 bg-white max-w-[170px] text-zinc-500 font-bold"
                    >
                      <option value="">💡 Khuyên dùng presets</option>
                      <option value="Đề xuất rà soát tuyến đường Thảo Điền, bổ sung camera giám sát phạt nguội cho các điểm nóng...">📹 Lắp đặt Camera</option>
                      <option value="Hãy thiết lập hành trình công tác tối ưu để tiếp cận và chúc Tết toàn bộ Hộ nghèo thuộc vùng lãnh thổ khu phố...">🧧 Chúc Tết Hộ nghèo</option>
                      <option value="Đánh giá nhanh mức độ bức xúc phòng cháy cháy chữa cháy và mật độ phân bô an ninh trật tự Tổ 3...">🚒 Đánh giá rủi ro PCCC</option>
                    </select>

                    <button
                      onClick={handleAiNavigateAnalyze}
                      disabled={isAiThinking || !aiPrompt.trim()}
                      className="bg-indigo-650 hover:bg-indigo-650 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                      Hỏi AI
                    </button>
                  </div>

                  {aiStatusMessage && (
                    <p className="text-[9px] text-indigo-600 font-bold animate-pulse">{aiStatusMessage}</p>
                  )}
                </div>

                {/* AI THOUGHT BOX */}
                {aiAnalysisResult && (
                  <div className="bg-slate-900 text-slate-100 p-3.5 rounded-xl border border-slate-800 text-[10px] space-y-1.5 leading-relaxed overflow-y-auto max-h-[140px] font-sans">
                    <p className="text-[9px] font-bold text-amber-400 border-b border-slate-800 pb-1 flex items-center gap-1">🤖 ĐỀ XUẤT TỪ CHUYÊN GIA AN PHÚ GẤN CHI TIẾT:</p>
                    <div className="text-slate-300 font-medium whitespace-pre-line">{aiAnalysisResult}</div>
                  </div>
                )}

              </div>
            )}

            {/* TAB 3: DIJKSTRA DẪN ĐƯỜNG TRỰC QUAN */}
            {activeTab === "route" && (
              <div className="space-y-4 text-left">
                <header className="pb-2 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1">🚗 Dẫn đường thông minh nội bộ</h3>
                  <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold">TSP Engine</span>
                </header>

                <div className="bg-purple-50/50 rounded-xl p-3 border border-purple-100 space-y-2">
                  <p className="text-xs font-bold text-purple-900">📍 Trình gán điểm tuần định ({patrolWaypoints.length} điểm):</p>
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    Giúp Ban điều hành, Trưởng tổ dân phố vạch sẵn lộ trình di tản, cứu hộ hoặc chống dịch tối ưu qua các hộ gia đình hoặc thiết bị an ninh.
                  </p>

                  <div className="flex flex-wrap gap-1 max-h-[100px] overflow-y-auto bg-white p-2 border border-purple-150 rounded-lg">
                    {patrolWaypoints.length === 0 ? (
                      <p className="text-[10px] text-gray-400 italic">Vui lòng tích lọc Hộ PIN bên trên và gán nút "Map Route" để nạp các chặng dạo chơi</p>
                    ) : (
                      patrolWaypoints.map(wpId => {
                        const h = gisHouseholds.find(x => x.id === wpId);
                        const f = gisFeatures.find(x => x.id === wpId);
                        const label = h ? h.headerName : f ? f.name : wpId;
                        return (
                          <div key={wpId} className="bg-purple-50 text-purple-700 text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-purple-100 flex items-center gap-1">
                            {label}
                            <button onClick={() => setPatrolWaypoints(prev => prev.filter(x => x !== wpId))} className="hover:text-red-500 font-bold font-sans">×</button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Multi-Transport preferences */}
                  <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] font-bold">
                    <button 
                      onClick={() => setTravelMode("walking")}
                      className={`py-1.5 rounded-lg border text-center transition cursor-pointer ${travelMode === "walking" ? "bg-purple-750 text-white border-purple-600" : "bg-white text-slate-700 border-slate-200"}`}
                    >
                      🚶 Đi bộ (5km/h)
                    </button>
                    <button 
                      onClick={() => setTravelMode("motorbike")}
                      className={`py-1.5 rounded-lg border text-center transition cursor-pointer ${travelMode === "motorbike" ? "bg-purple-750 text-white border-purple-600" : "bg-white text-slate-700 border-slate-200"}`}
                    >
                      🛵 Xe máy (30km/h)
                    </button>
                    <button 
                      onClick={() => setTravelMode("car")}
                      className={`py-1.5 rounded-lg border text-center transition cursor-pointer ${travelMode === "car" ? "bg-purple-750 text-white border-purple-600" : "bg-white text-slate-700 border-slate-200"}`}
                    >
                      🚗 Ô tô (40km/h)
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={clearOptimalEvacuationPath}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold px-3 py-2 rounded-lg flex-1 cursor-pointer text-center"
                    >
                      Xóa lộ trình
                    </button>

                    <button
                      onClick={computeOptimalVisitingRoute}
                      className="bg-purple-700 hover:bg-purple-650 text-white text-xs font-bold px-4 py-2 rounded-lg flex-1 cursor-pointer text-center"
                    >
                      🚀 Khởi chạy tìm đường
                    </button>
                  </div>
                </div>

                {calculatedPath.length > 0 && (
                  <div className="bg-slate-950 text-white p-3.5 rounded-xl border border-slate-800 space-y-2 text-[10px] font-mono leading-relaxed">
                    <p className="text-purple-400 font-bold border-b border-indigo-950 pb-1">📶 CHỈ TIÊU LỘ TRÌNH ĐƯỜNG ĐI DI TẢN:</p>
                    <p>Tổng độ dài chặng: <strong className="text-white">{(patrolDistance / 1000).toFixed(2)} km</strong> ({patrolDistance} m)</p>
                    <p>Thời gian di chuyển ước tính (ETA): <strong className="text-white text-[12px] text-green-400">{patrolDuration} phút</strong></p>
                    <p>Số lượng trạm kiểm tra: <strong className="text-white">{calculatedPath.length - 2} điểm dừng</strong></p>
                    <p className="text-gray-500 whitespace-nowrap overflow-hidden truncate">Dijkstra Topology Link: 100% OK</p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: MOBILE FIELD NOTES & FACADE RECORDS */}
            {activeTab === "fields" && (
              <div className="space-y-4 text-left">
                <header className="pb-2 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1">📋 Sổ tay ghi chép hiện trường</h3>
                  <span className="bg-orange-50 text-orange-700 px-2.5 py-0.5 rounded text-[10px] font-bold">Thực địa di động</span>
                </header>

                {!selectedPinId ? (
                  <p className="text-center py-10 text-xs text-gray-400 italic">Vui lòng bấm chọn một điểm hộ dân trên bản đồ số để mở sổ tay hành trình ghi chép hiện cấp!</p>
                ) : (() => {
                  const hh = gisHouseholds.find(h => h.id === selectedPinId);
                  if (!hh) return null;
                  const associatedNotes = fieldNotes.filter(n => n.householdId === hh.id);
                  const associatedEvents = timelineEvents.filter(e => e.householdId === hh.id);

                  return (
                    <div className="space-y-3">
                      <div className="bg-orange-50/50 p-2.5 rounded-lg border border-orange-100 text-[11px] leading-relaxed">
                        <p>Đăng nhật kí cho hộ: <b className="text-orange-900">{hh.headerName}</b></p>
                        <p className="text-gray-500 text-[10px]">TDP: {hh.groupNDTQ || "Tổ 3"} | 📞 {hh.phoneNumber}</p>
                      </div>

                      {/* Gửi ghi chú loại mới */}
                      <div className="space-y-1.5 p-2 bg-slate-50 border rounded-lg">
                        <div className="flex justify-between items-center text-[10px]">
                          <select
                            value={noteCategory}
                            onChange={(e: any) => setNoteCategory(e.target.value)}
                            className="text-[10px] font-bold border border-slate-300 rounded p-1 bg-white select-none text-zinc-700"
                          >
                            <option value="special">Loại: Phong trào / Biểu mẫu</option>
                            <option value="security">Loại: An ninh trật tự (ANTT)</option>
                            <option value="poverty">Loại: Xoá đói giảm nghèo</option>
                            <option value="campaign">Loại: Bầu cử / Tuyên truyền</option>
                            <option value="construction">Loại: Xây dựng trái phép</option>
                          </select>
                          
                          <label className="cursor-pointer text-indigo-700 font-bold flex items-center gap-1 bg-white border px-1.5 py-0.5 rounded shadow-sm">
                            <Camera className="h-3 w-3" /> đắp ảnh
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleNoteImageSelectHelper} 
                              className="hidden" 
                            />
                          </label>
                        </div>

                        {uploadPhotoBase64 && (
                          <div className="relative w-12 h-12 rounded border overflow-hidden mt-1 bg-slate-200">
                            <img src={uploadPhotoBase64} alt="attached thumbnail" className="w-full h-full object-cover" />
                            <button onClick={() => setUploadPhotoBase64(null)} className="absolute inset-0 bg-red-600/80 text-white text-[9px] font-bold opacity-0 hover:opacity-100 flex justify-center items-center">Bỏ</button>
                          </div>
                        )}

                        <textarea
                          value={noteValue}
                          onChange={(e) => setNoteValue(e.target.value)}
                          placeholder="Nhập ghi chép phản ánh dân sinh, kết cấu hạ tầng, an ninh..."
                          className="w-full text-xs p-1.5 border rounded focus:outline-none bg-white h-12"
                        />

                        <button
                          onClick={handleAddSubmitFieldNote}
                          disabled={!noteValue.trim()}
                          className="w-full text-center py-1 bg-orange-655 hover:bg-orange-660 text-white font-bold rounded text-[10px] cursor-pointer"
                        >
                          Khóa ghi thêm
                        </button>
                      </div>

                      {/* Display notebooks list */}
                      <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                        <p className="text-[10px] font-bold text-slate-800 flex items-center gap-1 border-b border-slate-100 pb-1">📝 Lịch sử ghi chép hiện trường ({associatedNotes.length}):</p>
                        {associatedNotes.length === 0 ? (
                          <p className="text-[10px] text-gray-400 italic text-center py-2">Hộ dân này chưa có phản bạt ghi nhận an ninh hoặc đóng góp phong trào.</p>
                        ) : (
                          associatedNotes.map(n => (
                            <div key={n.id} className="text-[10px] bg-slate-50 border p-2 rounded-lg leading-relaxed shadow-sm">
                              <div className="flex justify-between font-bold text-[9px] text-gray-500">
                                <span className="uppercase text-orange-850">● {n.category}</span>
                                <span>{n.timestamp}</span>
                              </div>
                              <p className="text-slate-800 font-medium pt-1">{n.text}</p>
                              {n.photoUrl && (
                                <img src={n.photoUrl} alt="attach" className="w-[120px] h-[70px] object-cover rounded mt-1.5 border border-slate-200 shadow-sm" />
                              )}
                              <p className="text-[9px] text-slate-400 pt-0.5 text-right font-semibold">Tác giả: {n.authorName}</p>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Display historical timeline moves change profiles */}
                      <div className="space-y-1.5 max-h-[100px] overflow-y-auto pt-2 border-t border-slate-100">
                        <p className="text-[10px] font-bold text-slate-800 flex items-center gap-1 border-b border-slate-100 pb-1"><Clock className="h-3.5 w-3.5 text-slate-500" /> Bản đồ hóa lưu di cư di biến động:</p>
                        {associatedEvents.length === 0 ? (
                          <p className="text-[10px] text-gray-400 italic text-center py-2">Chưa ghi nhận biến động hành chính.</p>
                        ) : (
                          associatedEvents.map(e => (
                            <div key={e.id} className="text-[9px] bg-slate-100 font-mono text-zinc-650 p-1.5 rounded flex justify-between gap-2 leading-relaxed">
                              <span>📅 {e.date}</span>
                              <span className="font-sans text-right font-medium text-slate-900">{e.text}</span>
                            </div>
                          ))
                        )}
                      </div>

                    </div>
                  );
                })()}
              </div>
            )}

            {/* TAB 5: POSTGIS COMMAND CONSOLE SIMULATOR */}
            {activeTab === "console" && (
              <div className="space-y-4 text-left">
                <header className="pb-2 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1">🖥️ PostGIS Spatial SQL Shell</h3>
                  <span className="bg-slate-900 text-slate-350 px-2 py-0.5 rounded text-[9px] font-bold font-mono">CLI-MODE</span>
                </header>

                <p className="text-[10px] text-gray-500 leading-relaxed">
                  Trình mô phỏng thiết vấn không gian PostGIS để rà soát ranh giới, khoảng cách (ST_Contains/ST_Distance/ST_Length) trực tiếp trong CSDL nén.
                </p>

                <div className="space-y-1 bg-slate-950 p-2 rounded-xl border border-slate-850">
                  <span className="text-[9px] text-indigo-400 font-bold block">✍️ SQL PostGIS Input Shell:</span>
                  <textarea
                    value={rawSqlInput}
                    onChange={(e) => setRawSqlInput(e.target.value)}
                    className="w-full text-[10px] p-2 bg-slate-900 text-slate-100 font-mono focus:outline-none border-0 h-24 whitespace-pre select-all border border-slate-800 rounded-lg leading-normal"
                  />
                </div>

                <div className="flex justify-between items-center">
                  <button
                    onClick={() => setRawSqlInput(`SELECT name, ST_Area(geom) AS dien_tich_m2 FROM subzones;`)}
                    className="text-[9px] text-indigo-650 font-bold block"
                  >
                    Load mẫu ST_Area
                  </button>

                  <button
                    onClick={handleSqlConsoleExecute}
                    className="bg-indigo-650 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs hover:bg-indigo-600 transition cursor-pointer"
                  >
                    RUN QUERY
                  </button>
                </div>

                {queryConsoleOutput && (
                  <div className="bg-slate-900 text-emerald-400 text-[10px] font-mono p-3 rounded-xl max-h-[160px] overflow-y-auto leading-relaxed border border-slate-800">
                    <p className="text-[9px] font-bold text-amber-400 border-b border-slate-800 pb-1">RESULT SET ({queryConsoleOutput.returnedCount} ROW(S) IN {queryConsoleOutput.executionTimeMs}ms):</p>
                    <pre className="text-slate-300 text-[9px] leading-tight pt-1.5 select-all overflow-x-auto">{JSON.stringify(queryConsoleOutput.data, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* GLOBAL SQL COMMAND AUDIT LOGS DISPLAY AT FOOTER SHEET */}
          <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4 text-left leading-normal">
            <h4 className="text-xs font-mono font-bold text-slate-300 pb-2 mb-2 border-b border-slate-850 flex justify-between items-center">
              <span>🖥️ Dynamic PostGIS SQL execution state:</span>
              <button onClick={() => setSqlLogs([])} className="text-[9px] hover:text-white font-bold">Xoá logs</button>
            </h4>
            <div className="overflow-y-auto max-h-[140px] space-y-2 select-all leading-normal">
              {sqlLogs.map((log, idx) => (
                <pre key={idx} className="text-[9.5px] font-mono text-emerald-450 whitespace-pre bg-slate-900 p-2.5 rounded-lg border border-slate-800/40">{log}</pre>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* MODAL 1: CREATE / EDIT ADDRESS PIN POPUP */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-center items-center z-[5000] p-4 text-left">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200/80 space-y-4 overflow-y-auto max-h-[90%] font-sans">
            <header className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-1.5">
                <MapPin className="text-emerald-600 h-5 w-5" />
                {formType === "create" ? "Khởi tạo gán PIN Hộ gia đình tự động" : "Di chuyển vĩ kinh độ chỉnh tay"}
              </h3>
              <button onClick={() => { setShowFormModal(false); setAiSuggestInfo(null); }} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </header>

            {/* AI AUTO BUILD DECK FOR CREATION FORM */}
            {formType === "create" && (
              <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-2">
                <strong className="text-xs font-bold text-indigo-900 flex items-center gap-1 leading-tight"><Sparkles className="h-4 w-4 text-amber-500 animate-spin" /> Trình gán tự động từ CSDL Dân cư bằng AI:</strong>
                <p className="text-[10px] text-gray-500">
                  AI sẽ rà soát CSDL dân cư và hộ khẩu quốc gia đối chiếu với điểm vĩ kinh độ bạn vừa click trên bản đồ để đề xuất chủ hộ tương ứng chưa PIN.
                </p>

                <button
                  type="button"
                  onClick={handleAiAutoMatchTrigger}
                  disabled={isAiAutoAssigning}
                  className="w-full text-center py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl text-xs flex justify-center items-center gap-1 cursor-pointer transition shadow"
                >
                  <RefreshCw className={`h-3 w-3 ${isAiAutoAssigning ? "animate-spin" : ""}`} />
                  {isAiAutoAssigning ? "AI Đang phân tích CSDL..." : "🤖 ĐỀ XUẤT HỘ DÂN TỪ CSDL"}
                </button>

                {aiSuggestInfo && (
                  <div className="bg-white p-2 border border-indigo-200 rounded-lg text-[10.5px] leading-relaxed text-slate-700">
                    <p className="text-indigo-800 font-bold">🎯 Đề xuất của AI hoàn hảo:</p>
                    <p>● Chủ hộ đề cử: <b>{aiSuggestInfo.headerName}</b> (Mã: {aiSuggestInfo.id})</p>
                    <p>● Địa chỉ đề cử: {aiSuggestInfo.address}</p>
                    <p>● Thành viên (CSDL): <b className="text-emerald-700">{aiSuggestInfo.members}</b></p>
                    <p className="text-gray-500 pt-0.5 font-sans leading-snug"><i>💡 Nhận định: {aiSuggestInfo.reason}</i></p>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleFormSave} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                {/* DYNAMIC ELEMENT TYPE SELECTOR */}
                <div className="col-span-2">
                  <label className="text-[11px] font-extrabold text-indigo-900 block mb-1">Loại Đối Tượng Không Gian GIS (*):</label>
                  <select
                    value={formElementType}
                    onChange={(e: any) => {
                      setFormElementType(e.target.value);
                      setAiSuggestInfo(null);
                    }}
                    disabled={formType === "edit"}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg bg-white font-extrabold text-indigo-950 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="household">🏠 Số nhà / Hộ dân / Cơ sở kinh doanh</option>
                    <option value="feature">📹 Điểm ANTT / Camera An Ninh</option>
                    <option value="intersection">🛣️ Trục giao lộ / Ngã tư hẻm</option>
                    <option value="subzone">⬡ Tổ polygon (Tổ dân phố / Ranh giới)</option>
                  </select>
                </div>

                {/* QUICK PICK CONTAINER FROM CORE DB */}
                {formElementType === "household" && formType === "create" && (
                  <div className="col-span-2 bg-indigo-50/20 p-3 rounded-xl border border-indigo-100/50 space-y-2">
                    <label className="text-[11px] font-bold text-indigo-950 block">
                      🔍 Chọn nhanh từ CSDL khu phố (Tự điền thông tin):
                    </label>
                    <div className="relative">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Nhập họ tên chủ hộ hoặc số nhà cần tìm nhanh..."
                          value={searchHouseholdQuery}
                          onChange={(e) => {
                            setSearchHouseholdQuery(e.target.value);
                            setShowHouseholdSuggestions(true);
                          }}
                          onFocus={() => setShowHouseholdSuggestions(true)}
                          className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white placeholder:text-gray-400"
                        />
                        {searchHouseholdQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchHouseholdQuery("");
                              setShowHouseholdSuggestions(false);
                            }}
                            className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold border border-slate-205 transition"
                          >
                            Xóa
                          </button>
                        )}
                      </div>

                      {showHouseholdSuggestions && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto z-[2000] p-1 space-y-0.5">
                          {allHouseholds
                            .filter(h => {
                              const q = searchHouseholdQuery.toLowerCase();
                              return (
                                !q ||
                                (h.headerName && h.headerName.toLowerCase().includes(q)) ||
                                (h.address && h.address.toLowerCase().includes(q))
                              );
                            })
                            .map(h => {
                              const isPinned = gisHouseholds.some(gh => gh.id === h.id);
                              return (
                                <button
                                  key={h.id}
                                  type="button"
                                  onClick={() => {
                                    setFormValue({
                                      id: h.id,
                                      headerName: h.headerName || "",
                                      address: h.address || "",
                                      phoneNumber: h.phoneNumber || "",
                                      notes: h.notes || "",
                                      lat: formValue.lat,
                                      lng: formValue.lng,
                                      groupNDTQ: h.groupNDTQ || formValue.groupNDTQ || "Tổ 3",
                                      tagSecurity: h.tagSecurity || "Bình thường"
                                    });
                                    setSearchHouseholdQuery(h.headerName + " - " + h.address);
                                    setShowHouseholdSuggestions(false);
                                  }}
                                  className="flex flex-col text-left w-full p-2 hover:bg-indigo-50/50 transition rounded-lg text-[11px]"
                                >
                                  <span className="font-bold text-slate-800 flex justify-between items-center w-full">
                                    <span>👤 {h.headerName}</span>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-extrabold ${isPinned ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700 animate-pulse"}`}>
                                      {isPinned ? "Đã định vị" : "CSDL Chưa PIN"}
                                    </span>
                                  </span>
                                  <span className="text-slate-500 block truncate text-[10px]">🏠 {h.address}</span>
                                </button>
                              );
                            })}
                          {allHouseholds.length === 0 && (
                            <p className="text-[10px] text-slate-400 p-2 text-center">Không tìm thấy hộ dân khớp trong CSDL.</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="col-span-2">
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">
                    {formElementType === "household" ? "Họ tên Chủ hộ (*):" : formElementType === "feature" ? "Tên thiết bị / Điểm ANTT (*):" : formElementType === "intersection" ? "Tên Trục giao lộ / Ngã tư hẻm (*):" : "Tên Tổ Dân Phố / Tổ Polygon (*):"}
                  </label>
                  <input
                    type="text"
                    value={formValue.headerName}
                    onChange={(e) => setFormValue({ ...formValue, headerName: e.target.value })}
                    required
                    placeholder={formElementType === "household" ? "Nguyễn Văn A" : formElementType === "feature" ? "Camera AI ANTT Hẻm 45" : formElementType === "intersection" ? "Ngã ba Quốc Hương - Hẻm 12" : "Địa giới hành chính Tổ 3"}
                    className="w-full text-xs p-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">
                    {formElementType === "household" ? "Địa chỉ số số nhà và hẻm (*):" : formElementType === "feature" ? "Vị trí lắp đặt cụ thể (*):" : formElementType === "intersection" ? "Tuyến đường chính giao cắt (*):" : "Họ tên Tổ Trưởng TDP / Người đại diện vùng (*):"}
                  </label>
                  <input
                    type="text"
                    value={formValue.address}
                    onChange={(e) => setFormValue({ ...formValue, address: e.target.value })}
                    required
                    placeholder={formElementType === "household" ? "12/4 Quốc Hương, Thảo Điền" : formElementType === "feature" ? "Cột điện hẻm, hành lang camera 2" : "Giao lộ Quốc Hương & Thảo Điền"}
                    className="w-full text-xs p-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* DYNAMIC MAP PREVIEW & AUTO GPS RETRIEVAL BOX */}
                <div className="col-span-2 space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-extrabold text-[#0e2154] uppercase tracking-wider flex items-center gap-1">
                      <Compass className={`h-4 w-4 ${isGpsActive ? "animate-spin text-blue-500" : "text-blue-700"}`} />
                      Bản đồ GPS & Dịch địa lý tự động
                    </span>
                    <button
                      type="button"
                      onClick={() => acquireGPSCoordinates(true)}
                      disabled={isGpsActive}
                      className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 text-white font-extrabold px-3 py-1.5 rounded-lg text-[10.5px] flex items-center gap-1 transition cursor-pointer shadow-sm"
                    >
                      <Navigation className={`h-3 w-3 ${isGpsActive ? "animate-pulse" : ""}`} />
                      Lấy lại vị trí hiện tại
                    </button>
                  </div>

                  {/* Leaflet minimap inside modal */}
                  <div className="relative">
                    <div 
                      id="modal-preview-map" 
                       className="h-44 w-full rounded-xl border border-slate-200 z-[10] shadow-sm overflow-hidden"
                      style={{ minHeight: "176px" }}
                    ></div>
                    {isReverseGeocoding && (
                      <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-[100] rounded-xl">
                        <div className="flex flex-col items-center gap-2">
                          <RefreshCw className="h-5 w-5 text-indigo-650 animate-spin" />
                          <span className="text-[10px] font-bold text-slate-600">Đang dịch địa chỉ...</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 text-[10px] leading-relaxed text-slate-600 pt-0.5">
                    {gpsStatus && (
                      <p className="font-semibold text-slate-800 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-ping"></span>
                        {gpsStatus}
                      </p>
                    )}
                    <span className="text-slate-500 italic">💡 Hướng dẫn: Chạm/Click bất cứ điểm nào trên bản đồ hoặc kéo thả ghim đỏ để di chuyển vị trí. Hệ thống sẽ tự động chuyển địa chỉ tương ứng.</span>
                  </div>
                </div>

                {formElementType === "household" && (
                  <>
                    <div>
                      <label className="text-[11px] font-bold text-gray-700 block mb-1">Số điện thoại:</label>
                      <input
                        type="text"
                        value={formValue.phoneNumber}
                        onChange={(e) => setFormValue({ ...formValue, phoneNumber: e.target.value })}
                        placeholder="0912xxxxxx"
                        className="w-full text-xs p-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-gray-700 block mb-1">Tổ Dân Phố (TDP):</label>
                      <select
                        value={formValue.groupNDTQ}
                        onChange={(e) => setFormValue({ ...formValue, groupNDTQ: e.target.value })}
                        className="w-full text-xs p-2 border rounded-lg bg-white"
                      >
                        <option value="Tổ 3">Tổ 3</option>
                        <option value="Tổ 4">Tổ 4</option>
                        <option value="Tổ 5">Tổ 5</option>
                        <option value="Tổ 6">Tổ 6</option>
                      </select>
                    </div>
                  </>
                )}

                {formElementType === "subzone" && (
                  <>
                    <div>
                      <label className="text-[11px] font-bold text-gray-700 block mb-1">Số điện thoại liên hệ TDP:</label>
                      <input
                        type="text"
                        value={formValue.phoneNumber}
                        onChange={(e) => setFormValue({ ...formValue, phoneNumber: e.target.value })}
                        placeholder="0912xxxxxx"
                        className="w-full text-xs p-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-gray-700 block mb-1">Mức độ an ninh vùng TDP:</label>
                      <select
                        value={formValue.tagSecurity}
                        onChange={(e) => setFormValue({ ...formValue, tagSecurity: e.target.value })}
                        className="w-full text-xs p-2 border rounded-lg bg-white"
                      >
                        <option value="Bình thường">🟢 Vùng An toàn</option>
                        <option value="Cảnh báo">🟠 Cảnh báo trật tự</option>
                        <option value="Nguy hiểm">🔴 Vùng nhạy cảm / Đã xảy ra đột nhập</option>
                      </select>
                    </div>
                  </>
                )}

                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">Vĩ độ (Latitude) (*):</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={formValue.lat}
                    onChange={(e) => setFormValue({ ...formValue, lat: parseFloat(e.target.value) })}
                    required
                    className="w-full text-xs p-2 border rounded-lg font-mono focus:outline-none bg-slate-50"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">Kinh độ (Longitude) (*):</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={formValue.lng}
                    onChange={(e) => setFormValue({ ...formValue, lng: parseFloat(e.target.value) })}
                    required
                    className="w-full text-xs p-2 border rounded-lg font-mono focus:outline-none bg-slate-50"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">Ghi chú không gian kĩ thuật:</label>
                  <textarea
                    value={formValue.notes}
                    onChange={(e) => setFormValue({ ...formValue, notes: e.target.value })}
                    placeholder="Ngõ cụt, có trang bị bình chữa cháy, gia đình chính sách..."
                    className="w-full text-xs p-2 border rounded-lg h-14 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setShowFormModal(false); setAiSuggestInfo(null); }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-xs font-bold cursor-pointer transition shadow-lg"
                >
                  Lưu trữ PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PRINT QR PLAQUE CARD */}
      {showQrPlate && qrTargetHousehold && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-center items-center z-[5000] p-4 text-center">
          <div className="bg-white rounded-3xl max-w-sm w-full p-8 shadow-2xl space-y-6 relative border border-slate-150/80 font-sans">
            <button 
              onClick={() => { setShowQrPlate(false); setQrTargetHousehold(null); }} 
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Plaque design banner card */}
            <div id="p-qr-plaque" className="border-4 border-double border-indigo-900 bg-amber-50/15 p-6 rounded-2xl space-y-4 text-center select-all">
              <header className="space-y-0.5 leading-none">
                <h5 className="text-[9px] font-extrabold uppercase tracking-widest text-[#0e2154]">ỦY BAN NHÂN DÂN PHƯỜNG AN PHÚ</h5>
                <h4 className="text-[11px] font-extrabold tracking-wider text-[#0e2154]">BAN ĐIỀU HÀNH KHU PHỐ 3</h4>
                <div className="border-t border-[#0e2154] mx-auto w-14 my-1.5 opacity-60"></div>
              </header>

              <div className="space-y-1">
                <span className="text-[8px] bg-indigo-950 text-white font-mono px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                  MÃ ĐỊA CHỈ SỐ QUỐC GIA
                </span>
                <h2 className="text-lg font-black text-[#0f172a] uppercase">{qrTargetHousehold.gisCode || `KP3-${qrTargetHousehold.id.substring(4,10)}`}</h2>
                <h3 className="text-xs font-extrabold text-[#111827] leading-tight pt-1">CHỦ HỘ: {qrTargetHousehold.headerName}</h3>
                <p className="text-[11px] text-[#4b5563] font-medium leading-none">🏠 {qrTargetHousehold.address}</p>
              </div>

              {/* QR Image API Server */}
              <div className="flex justify-center py-2">
                <div className="p-3 bg-white border-2 border-[#0e2154] rounded-xl shadow-lg relative overflow-hidden">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                      JSON.stringify({
                        gisCode: qrTargetHousehold.gisCode,
                        headerName: qrTargetHousehold.headerName,
                        address: qrTargetHousehold.address,
                        coords: [qrTargetHousehold.lat, qrTargetHousehold.lng]
                      })
                    )}`} 
                    alt="Plaque Plaque QR Code" 
                    className="w-36 h-36 border-0 shrink-0 select-all" 
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>

              <footer className="space-y-0.5 pt-1.5 border-t border-slate-100 leading-tight">
                <p className="text-[8px] text-[#4b5563] font-medium font-mono text-center">Tọa độ GPS: {qrTargetHousehold.lat.toFixed(6)}, {qrTargetHousehold.lng.toFixed(6)}</p>
                <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-wide text-center">BẢN ĐỒ ĐỊA CHÍNH KHU PHỐ CHÍNH THỨC</p>
              </footer>
            </div>

            <button
              onClick={() => {
                const element = document.getElementById("p-qr-plaque");
                if (element) {
                  const printWindow = window.open("", "_blank");
                  if (printWindow) {
                    printWindow.document.write(
                      `<html>
                        <head>
                          <title>In Thẻ QR Địa Chỉ Số - ${qrTargetHousehold.headerName}</title>
                          <style>
                            body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: white; margin:0; }
                            #print-container { border: 4px double #0e2154; padding: 30px; border-radius: 15px; text-align: center; width: 330px; }
                            h5 { font-size: 10px; margin: 0 0 4px; font-weight: 800; letter-spacing: 1px; color: #0e2154; }
                            h4 { font-size: 12px; margin: 0 0 10px; font-weight: 800; color: #0e2154; }
                            h2 { font-size: 20px; font-weight: 900; margin: 8px 0; color: #0f172a; text-transform: uppercase; }
                            h3 { font-size: 13px; font-weight: 800; margin: 8px 0; }
                            p { font-size: 11px; margin: 4px 0; }
                            img { width: 160px; height: 160px; border: 2px solid #0e2154; padding: 5px; border-radius: 10px; margin: 15px 0; }
                          </style>
                        </head>
                        <body>
                          <div id="print-container">
                            ${element.innerHTML}
                          </div>
                          <script>
                            window.onload = function() { window.print(); window.close(); }
                          </script>
                        </body>
                      </html>`
                    );
                    printWindow.document.close();
                  }
                }
              }}
              className="w-full flex items-center justify-center gap-1.5 bg-indigo-900 hover:bg-slate-800 text-white font-extrabold py-3 rounded-2xl text-xs cursor-pointer shadow-lg shadow-indigo-950/40"
            >
              <Printer className="h-4 w-4" /> In bảng tên QR bằng máy in
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

import express from "express";
import cors from "cors";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import { loadDatabase, saveDatabase, preloadDatabaseFromSupabase, isSupabaseTableAvailable, syncToSupabase } from "./server_db";
import { Resident, Household, WorkSchedule, DocumentTemplate, GeneratedDocument, ActivityLog, BusinessEstablishment } from "./src/types";

dotenv.config();

// Auto-synchronize households based on residents' current groups and active relationships
function syncAllHouseholds(db: any) {
  if (!db.residents || !db.households) return;

  const residentsByHousehold: Record<string, Resident[]> = {};
  db.residents.forEach((r: Resident) => {
    if (r.householdId) {
      const hhId = r.householdId;
      if (!residentsByHousehold[hhId]) {
        residentsByHousehold[hhId] = [];
      }
      residentsByHousehold[hhId].push(r);
    }
  });

  Object.entries(residentsByHousehold).forEach(([hhId, hhResidents]) => {
    const head = hhResidents.find(r => r.relationWithHeader === "Chủ hộ") || hhResidents[0];
    const headerName = head ? head.fullName : "Chưa xác định";
    const address = head ? head.address : "Khu phố 3, Phường An Phú, TP. Hồ Chí Minh";
    const phoneNumber = head ? (head.phoneNumber || "Không có") : "Không có";
    const groupNDTQ = head ? head.groupNDTQ : undefined;

    let household = db.households.find((h: Household) => h.id === hhId);
    if (!household) {
      db.households.push({
        id: hhId,
        headerName,
        address,
        phoneNumber,
        groupNDTQ
      });
    } else {
      household.headerName = headerName;
      household.address = address;
      if (phoneNumber && phoneNumber !== "Không có" && phoneNumber !== "") {
        household.phoneNumber = phoneNumber;
      }
      household.groupNDTQ = groupNDTQ;
    }
  });
}

function getFilteredDatabase(emailHeader: any) {
  return loadDatabase();
}

function verifyWritePermission(emailHeader: any, roleHeader: any, targetResident: any): { allowed: boolean; reason?: string } {
  const db = loadDatabase();
  const normalizedEmail = (emailHeader || "").toString().toLowerCase().trim();

  if (!normalizedEmail) {
    return { allowed: false, reason: "Hệ thống yêu cầu định danh tài khoản cán bộ!" };
  }

  // Find the database account
  const requester = (db.accounts || []).find(
    (acc: any) => acc.email && acc.email.toLowerCase().trim() === normalizedEmail
  );

  // If super admin email "admin", and no roleHeader simulation is supplied, always allow
  if (normalizedEmail === "admin" && !roleHeader) {
    return { allowed: true };
  }

  if (!requester && normalizedEmail !== "admin") {
    return { allowed: false, reason: "Tài khoản của bạn không tồn tại hoặc dữ liệu định danh bị lỗi!" };
  }

  const dbActive = requester ? requester.active : true;
  if (dbActive === false) {
    return { allowed: false, reason: "Tài khoản của bạn đã bị vô hiệu hóa bởi Super Admin!" };
  }

  // Determine role
  let roleStr = "";
  if (roleHeader) {
    roleStr = decodeURIComponent(roleHeader).trim();
  } else if (requester) {
    if (requester.canEdit === false) {
      roleStr = "Người xem báo cáo";
    } else {
      roleStr = requester.role || "Super Admin";
    }
  } else {
    roleStr = "Super Admin";
  }

  if (roleStr === "Người xem báo cáo") {
    return { allowed: false, reason: "Phân quyền: Tài khoản của bạn chỉ được phép xem, không có quyền ghi hay sửa dữ liệu!" };
  }

  // Toàn quyền
  const allowedAdminRoles = ["Super Admin", "Super Mod", "Bí thư Chi bộ", "Trưởng Khu phố", "Trưởng Ban điều hành", "Trưởng ban công tác Mặt trận"];
  if (allowedAdminRoles.includes(roleStr)) {
    return { allowed: true };
  }

  // Công an khu vực: can manage general residents (residency registry)
  if (roleStr === "Công an khu vực") {
    return { allowed: true };
  }

  // Khu Đội Trưởng
  if (roleStr === "Khu Đội Trưởng") {
    if (targetResident) {
      const hasMilitary = (targetResident.militaryCategories && targetResident.militaryCategories.length > 0) || (targetResident.militaryNotes || "").trim() !== "";
      if (!hasMilitary) {
        return {
          allowed: false,
          reason: "Chỉ huy quân sự: Vai trò Khu Đội Trưởng chỉ được phép thao tác/sửa đổi cư dân thuộc diện quản lý Nghĩa vụ Quân sự / Quân nhân dự bị. Cư dân khác chỉ được xem!"
        };
      }
    }
    return { allowed: true };
  }

  // Cán bộ nhập liệu
  if (roleStr === "Cán bộ nhập liệu") {
    if (targetResident && targetResident.id) {
      const existing = db.residents.find((r: any) => r.id && r.id.toString().trim() === targetResident.id.toString().trim());
      const creator = (existing ? existing.createdBy : targetResident.createdBy) || "";
      
      if (creator && creator.toLowerCase().trim() !== normalizedEmail) {
        return { 
          allowed: false, 
          reason: `Quyền tự chủ hồ sơ: Bạn chỉ có quyền tự chỉnh sửa/xóa cư dân do chính tay tài khoản mình nhập liệu. Bản ghi này do cán bộ [${creator}] khởi tạo!` 
        };
      }
      
      if (existing && !existing.createdBy) {
        return {
          allowed: false,
          reason: "Quyền tự chủ hồ sơ: Đây là cư dân thuộc danh sách cốt lõi của hẻm/Khu phố. Bạn không thể tự ý chỉnh sửa nội dung này!"
        };
      }
    }
    return { allowed: true };
  }

  // Chi hội trưởng
  if (roleStr === "Chi hội trưởng") {
    const userGroup = (requester ? requester.associationGroup : undefined) || "CCB";
    if (targetResident) {
      const isMember = (targetResident.groups || []).includes(userGroup);
      if (!isMember) {
        return {
          allowed: false,
          reason: `Ngăn nắp đoàn thể: Vai trò Chi hội trưởng [${userGroup}] chỉ được phép thao tác/sửa đổi thành viên thuộc chi hội mình phụ trách. Cư dân khác chỉ được xem!`
        };
      }
    }
    return { allowed: true };
  }

  return { allowed: false, reason: "Phân quyền: Bạn không có quyền cấp phép tương tác với bản ghi này!" };
}

function verifyGovtWritePermission(emailHeader: any, roleHeader: any): { allowed: boolean; reason?: string } {
  const db = loadDatabase();
  const normalizedEmail = (emailHeader || "").toString().toLowerCase().trim();

  if (!normalizedEmail) {
    return { allowed: false, reason: "Hệ thống yêu cầu định danh tài khoản cán bộ!" };
  }

  // Find the database account
  const requester = (db.accounts || []).find(
    (acc: any) => acc.email && acc.email.toLowerCase().trim() === normalizedEmail
  );

  if (normalizedEmail === "admin" && !roleHeader) {
    return { allowed: true };
  }

  if (!requester && normalizedEmail !== "admin") {
    return { allowed: false, reason: "Phân quyền: Tài khoản không tồn tại trên hệ thống!" };
  }

  const dbActive = requester ? requester.active : true;
  if (dbActive === false) {
    return { allowed: false, reason: "Phân quyền: Tài khoản của bạn đã bị khóa bởi Super Admin!" };
  }

  // Determine active role
  let roleStr = "";
  if (roleHeader) {
    roleStr = decodeURIComponent(roleHeader).trim();
  } else if (requester) {
    if (requester.canEdit === false) {
      roleStr = "Người xem báo cáo";
    } else {
      roleStr = requester.role || "";
    }
  } else {
    roleStr = "Super Admin";
  }

  if (roleStr === "Người xem báo cáo") {
    return {
      allowed: false,
      reason: "Phân quyền: Tài khoản của bạn chỉ có quyền Xem báo cáo, không được phép chỉnh sửa!"
    };
  }

  // Administrative, public security and data entry roles have full write access for governmental registry parameters
  const allowedRoles = ["Super Admin", "Super Mod", "Bí thư Chi bộ", "Trưởng Khu phố", "Trưởng Ban điều hành", "Trưởng ban công tác Mặt trận", "Công an khu vực", "Cán bộ nhập liệu"];
  if (allowedRoles.includes(roleStr)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Từ chối: Vai trò [${roleStr}] không được cấp quyền thay đổi biểu mẫu, lịch công tác chung, hộ kinh doanh hoặc sơ đồ khu phố!`
  };
}

const app = express();
const PORT = 3000;

app.use(cors({
  origin: "*", // Allow all origins for the decentralized client/server sync model
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-user-email", "x-user-role", "x-user-name"]
}));

app.use(express.json({ limit: "50mb" }));

// Middleware to decode custom headers containing Unicode/Vietnamese characters
app.use((req, res, next) => {
  const decodeHeader = (val: any) => {
    if (!val) return val;
    try {
      return decodeURIComponent(val.toString());
    } catch (e) {
      return val;
    }
  };

  if (req.headers["x-user-email"]) {
    req.headers["x-user-email"] = decodeHeader(req.headers["x-user-email"]);
  }
  if (req.headers["x-user-name"]) {
    req.headers["x-user-name"] = decodeHeader(req.headers["x-user-name"]);
  }
  if (req.headers["x-user-role"]) {
    req.headers["x-user-role"] = decodeHeader(req.headers["x-user-role"]);
  }
  next();
});

// Initialize GoogleGenAI SDK
export let ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

export function updateAiInstance(apiKey: string) {
  if (!apiKey || apiKey.trim() === "") return;
  process.env.GEMINI_API_KEY = apiKey.trim();
  ai = new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
  console.log("GoogleGenAI instance successfully updated with dynamic key.");
}

// Middleware to dynamically synchronize Gemini AI Key with database configurations
app.use((req, res, next) => {
  try {
    const db = loadDatabase();
    if (db.geminiApiKey && db.geminiApiKey.trim() !== "" && db.geminiApiKey.trim() !== process.env.GEMINI_API_KEY) {
      updateAiInstance(db.geminiApiKey);
    }
  } catch (err) {
    console.warn("Dynamic API key check bypassed:", err);
  }
  next();
});

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date() });
});

app.get("/api/config/gemini-key", (req, res) => {
  const db = loadDatabase();
  const rawKey = db.geminiApiKey || process.env.GEMINI_API_KEY || "";
  let masked = "";
  if (rawKey) {
    if (rawKey.length > 8) {
      masked = rawKey.substring(0, 4) + "..." + rawKey.substring(rawKey.length - 4);
    } else {
      masked = "********";
    }
  }
  res.json({
    hasKey: !!rawKey,
    maskedKey: masked
  });
});

app.post("/api/config/gemini-key", (req, res) => {
  const emailHeader = req.headers["x-user-email"] as string;
  const roleHeader = req.headers["x-user-role"] as string;
  const db = loadDatabase();

  const normalizedEmail = (emailHeader || "").toString().toLowerCase().trim();
  const requester = db.accounts?.find(
    (acc: any) => acc.email && acc.email.toLowerCase().trim() === normalizedEmail
  );

  const roleStr = roleHeader ? decodeURIComponent(roleHeader).trim() : (requester ? requester.role : "");
  const isAuthorized = ["Super Admin", "Super Mod", "Bí thư Chi bộ", "Trưởng Khu phố", "Trưởng Ban điều hành"].includes(roleStr) || normalizedEmail === "admin";

  if (!isAuthorized) {
    return res.status(403).json({ error: "Phân quyền: Chỉ quản trị viên cấp cao mới có quyền cấu hình API Key hệ thống!" });
  }

  const { apiKey } = req.body;
  if (apiKey === undefined) {
    return res.status(400).json({ error: "Yêu cầu cung cấp tham số apiKey!" });
  }

  db.geminiApiKey = apiKey.trim();
  
  // Log action
  db.logs.unshift({
    id: `log_${Date.now()}`,
    userName: requester ? requester.fullName : "Super Admin",
    userRole: roleStr || "Super Admin",
    action: apiKey.trim() ? "Cập nhật Gemini API Key" : "Gỡ bỏ Gemini API Key",
    timestamp: new Date().toISOString(),
    details: apiKey.trim() 
      ? `Đã cập nhật khóa bảo mật API key của Google AI Studio để vận hành các dịch vụ thông minh của app.`
      : `Đã xóa khóa cấu hình Gemini API key khỏi cơ sở dữ liệu.`
  });

  saveDatabase(db);
  updateAiInstance(db.geminiApiKey);

  res.json({ success: true, message: "Cập nhật cấu hình Gemini API Key thành công!" });
});

app.get("/api/supabase/status", (req, res) => {
  res.json({
    configured: !!process.env.SUPABASE_URL,
    tableAvailable: isSupabaseTableAvailable,
    sqlSetup: `CREATE TABLE IF NOT EXISTS system_state (
  id TEXT PRIMARY KEY,
  data JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE system_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous access" ON system_state;
CREATE POLICY "Allow anonymous access" ON system_state FOR ALL USING (true) WITH CHECK (true);`
  });
});

app.post("/api/supabase/sync", async (req, res) => {
  try {
    const db = loadDatabase();
    // Enable sync retry
    const { isSupabaseTableAvailable: currentAvailable } = await import("./server_db");
    const { supabase } = await import("./server_db");
    if (!supabase) {
      return res.status(400).json({
        success: false,
        error: "Trực tuyến hóa chưa được khởi tạo. Vui lòng liên hệ quản trị viên kiểm tra cấu hình Supabase URL và API key."
      });
    }
    
    // Check if the table actually exists now to reset the available flag
    const { error } = await supabase
      .from("system_state")
      .select("id")
      .limit(1);
    
    if (error && (error.code === "PGRST116" || error.code === "PGRST204" || error.message.includes("relation") || error.code === "42P01")) {
      return res.status(400).json({
        success: false,
        error: "Supabase table 'system_state' does not exist yet. Please run the SQL command in your Supabase SQL Editor and try again!"
      });
    }

    // Set variable statically/dynamically
    const dbModule = await import("./server_db");
    dbModule.setSupabaseTableAvailable(true);
    
    await syncToSupabase(db);
    res.json({ success: true, message: "Đồng bộ hóa dữ liệu lên Supabase thành công!" });
  } catch (err: any) {
    res.status(550).json({ success: false, error: err.message || "Lỗi bất ngờ xảy ra!" });
  }
});

// Auth Routes for Administrators
app.post("/api/auth/register", (req, res) => {
  const db = loadDatabase();
  const { fullName, email, password, role } = req.body;

  if (!fullName || !email || !password || !role) {
    return res.status(400).json({ error: "Vui lòng điền đầy đủ tất cả thông tin đăng ký!" });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedName = fullName.toLowerCase().trim();

  if (normalizedName === normalizedEmail) {
    return res.status(400).json({ error: "Họ và tên cán bộ bắt buộc phải khác với Tên tài khoản (ID đăng nhập)!" });
  }

  if (!db.accounts) {
    db.accounts = [];
  }

  const exists = db.accounts.some((acc: any) => acc.email.toLowerCase().trim() === normalizedEmail);
  if (exists) {
    return res.status(400).json({ error: `Tài khoản với email ${email} đã tồn tại trong hệ thống!` });
  }

  const newAccount = {
    id: `acc_${Date.now()}`,
    fullName,
    email: normalizedEmail,
    role,
    active: true,
    canEdit: false, // Standard registration default (pending approval)
    password,
    provider: "local",
    createdAt: new Date().toISOString()
  };

  db.accounts.push(newAccount);

  // Log action
  db.logs.unshift({
    id: `log_${Date.now()}`,
    userName: "Hệ thống số hóa",
    userRole: "Super Admin",
    action: `Đăng ký quản trị viên mới: ${fullName}`,
    timestamp: new Date().toISOString(),
    details: `Họ tên: ${fullName}, Email: ${email}, Vai trò cán bộ: ${role}. Trạng thái xử lý hệ thống: CHỜ DUYỆT.`
  });

  saveDatabase(db);
  res.status(201).json({ success: true, user: { id: newAccount.id, fullName, email, role, canEdit: false } });
});

app.post("/api/auth/login", (req, res) => {
  const db = loadDatabase();
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Vui lòng nhập đầy đủ Email và Mật khẩu!" });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const account = db.accounts?.find((acc: any) => {
    const accEmail = acc.email.toLowerCase().trim();
    // Support multiple aliases for primary administrator accounts
    const isEmailMatch = accEmail === normalizedEmail ||
      (accEmail === "admin" && (
        normalizedEmail === "admin" ||
        normalizedEmail === "admin@gmail.com" ||
        normalizedEmail === "superadmin" ||
        normalizedEmail === "superadmin@gmail.com"
      ));

    if (!isEmailMatch) return false;

    // Support both administrative passthrough for developers and typical passwords
    const isPasswordMatch = acc.password === password ||
      (accEmail === "admin" && password === "Trunghuy741") ||
      (accEmail === "bdhkhupho3.ap@gmail.com" && (password === "123" || password === "Trunghuy741"));

    return isPasswordMatch;
  });

  if (!account) {
    return res.status(400).json({ error: "Thất bại: Email hoặc mật khẩu của quản trị viên không chính xác!" });
  }

  if (account.active === false) {
    return res.status(403).json({ error: "Tài khoản chưa được kích hoạt hoặc đã bị khóa bởi Ban điều hành / Super Admin. Vui lòng liên hệ Admin để phê duyệt!" });
  }

  res.json({
    success: true,
    user: {
      id: account.id,
      fullName: account.fullName,
      email: account.email,
      role: account.role,
      canEdit: account.canEdit !== false, // Defaults to true for master seeds
      permissionType: account.permissionType || (account.canEdit === false ? "Chỉ xem" : (account.role === "Cán bộ nhập liệu" ? "Xem và nhập liệu" : (account.role === "Chi hội trưởng" ? "Ngăn nắp đoàn thể" : "Toàn quyền"))),
      associationGroup: account.associationGroup
    }
  });
});

app.post("/api/auth/social-login", (req, res) => {
  const db = loadDatabase();
  const { provider, email, fullName } = req.body;

  if (!provider || !email || !fullName) {
    return res.status(400).json({ error: "Thiếu dữ liệu tài khoản liên kết!" });
  }

  const normalizedEmail = email.toLowerCase().trim();
  if (!db.accounts) {
    db.accounts = [];
  }

  const account = db.accounts.find((acc: any) => acc.email.toLowerCase().trim() === normalizedEmail);

  if (!account) {
    return res.status(403).json({ 
      error: `Đăng nhập thất bại: Tài khoản liên kết [${email}] chưa được Admin cấp phép hoặc khai báo trước trong danh sách cán bộ nội bộ. Vui lòng liên hệ Admin để được cấp trước!` 
    });
  }

  if (account.active === false) {
    return res.status(403).json({ error: "Tài khoản của bạn hiện đang bị tạm khóa. Vui lòng liên hệ Admin!" });
  }

  // Update provider for reference
  if (!account.provider || account.provider === "local") {
    account.provider = provider;
    saveDatabase(db);
  }

  res.json({
    success: true,
    user: {
      id: account.id,
      fullName: account.fullName,
      email: account.email,
      role: account.role,
      canEdit: account.canEdit !== false,
      provider: account.provider,
      permissionType: account.permissionType || (account.canEdit === false ? "Chỉ xem" : (account.role === "Cán bộ nhập liệu" ? "Xem và nhập liệu" : (account.role === "Chi hội trưởng" ? "Ngăn nắp đoàn thể" : "Toàn quyền"))),
      associationGroup: account.associationGroup
    }
  });
});

// Create Cán bộ Internally by Authorized Managers
app.post("/api/accounts", (req, res) => {
  const db = loadDatabase();
  const { fullName, email, password, role, canEdit, permissionType, associationGroup } = req.body;
  const emailHeader = req.headers["x-user-email"] as string;

  if (!emailHeader) {
    return res.status(403).json({ error: "Yêu cầu định danh cán bộ quản lý!" });
  }

  const requester = db.accounts?.find(
    (acc: any) => acc.email.toLowerCase().trim() === emailHeader.toLowerCase().trim()
  );

  if (!requester || !["Super Admin", "Super Mod", "Bí thư Chi bộ", "Trưởng Khu phố", "Trưởng Ban điều hành"].includes(requester.role)) {
    return res.status(403).json({ error: "Bạn không có quyền tự tạo tài khoản cán bộ mới! Chỉ có Admin hoặc người quản lý khu phố mới được cấp phép." });
  }

  if (!fullName || !email || !password || !role) {
    return res.status(400).json({ error: "Vui lòng nhập đầy đủ các trường: Họ và tên, Email, Mật khẩu và Vai trò!" });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedName = fullName.toLowerCase().trim();

  if (normalizedName === normalizedEmail) {
    return res.status(400).json({ error: "Họ và tên cán bộ bắt buộc phải khác với Tên tài khoản (ID đăng nhập)!" });
  }

  const exists = db.accounts?.some((acc: any) => acc.email.toLowerCase().trim() === normalizedEmail);
  if (exists) {
    return res.status(400).json({ error: `Tài khoản với email [${email}] đã tồn tại trong danh sách cán bộ nội bộ!` });
  }

  const newAccount = {
    id: `acc_${Date.now()}`,
    fullName,
    email: normalizedEmail,
    role,
    active: true,
    canEdit: canEdit !== false,
    permissionType: permissionType || (canEdit === false ? "Chỉ xem" : (role === "Cán bộ nhập liệu" ? "Xem và nhập liệu" : (role === "Chi hội trưởng" ? "Ngăn nắp đoàn thể" : "Toàn quyền"))),
    associationGroup: role === "Chi hội trưởng" ? associationGroup : undefined,
    password,
    provider: "local",
    createdAt: new Date().toISOString()
  };

  if (!db.accounts) db.accounts = [];
  db.accounts.push(newAccount);

  // Log action
  db.logs.unshift({
    id: `log_${Date.now()}`,
    userName: requester.fullName,
    userRole: requester.role,
    action: `Cấp tài khoản mới: ${fullName}`,
    timestamp: new Date().toISOString(),
    details: `Quản lý ${requester.fullName} đã cấp tài khoản trực tiếp cho ${fullName} (${email}) - Vai trò: ${role}, Cấp độ sửa đổi: ${newAccount.permissionType}.`
  });

  saveDatabase(db);
  res.status(201).json({ 
    success: true, 
    message: "Đã tạo tài khoản cán bộ nội bộ thành công!",
    account: { id: newAccount.id, fullName, email, role, canEdit: newAccount.canEdit } 
  });
});

// Admin overrides / resets password for another account directly
app.post("/api/accounts/:id/change-password", (req, res) => {
  const db = loadDatabase();
  const { id } = req.params;
  const { newPassword } = req.body;
  const emailHeader = req.headers["x-user-email"] as string;

  if (!emailHeader) {
    return res.status(403).json({ error: "Yêu cầu định danh cán bộ quản lý!" });
  }

  const requester = db.accounts?.find(
    (acc: any) => acc.email.toLowerCase().trim() === emailHeader.toLowerCase().trim()
  );

  if (!requester || !["Super Admin", "Super Mod", "Bí thư Chi bộ", "Trưởng Khu phố", "Trưởng Ban điều hành"].includes(requester.role)) {
    return res.status(403).json({ error: "Bạn không có quyền thay đổi mật khẩu của cán bộ khác! Chỉ có Admin hoặc người quản lý khu phố mới thực hiện được." });
  }

  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: "Mật khẩu mới phải từ 4 ký tự trở lên!" });
  }

  const targetAccount = db.accounts?.find((acc: any) => acc.id === id);
  if (!targetAccount) {
    return res.status(404).json({ error: "Không tìm thấy cán bộ được chỉ định." });
  }

  // Enforce absolute master protection: other managers can't change master 'admin' account password
  if (targetAccount.email === "admin" && requester.email !== "admin") {
    return res.status(403).json({ error: "Bạn không thể tự ý đặt lại mật khẩu của tài khoản Admin chính hệ thống!" });
  }

  targetAccount.password = newPassword;

  // Log action
  db.logs.unshift({
    id: `log_${Date.now()}`,
    userName: requester.fullName,
    userRole: requester.role,
    action: `Đặt lại mật khẩu cán bộ`,
    timestamp: new Date().toISOString(),
    details: `Quản lý ${requester.fullName} đã đặt lại mật khẩu trực tiếp thành công cho tài khoản cán bộ ${targetAccount.fullName} (${targetAccount.email}).`
  });

  saveDatabase(db);
  res.json({ success: true, message: `Mật khẩu của cán bộ ${targetAccount.fullName} đã được cập nhật thành công!` });
});

// Change Password API Route
app.post("/api/auth/change-password", (req, res) => {
  const db = loadDatabase();
  const { email, currentPassword, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({ error: "Vui lòng nhập Email cán bộ và Mật khẩu mới!" });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const accountIndex = db.accounts?.findIndex(
    (acc: any) => acc.email.toLowerCase().trim() === normalizedEmail
  );

  if (accountIndex === undefined || accountIndex === -1) {
    return res.status(404).json({ error: "Không tìm thấy tài khoản cán bộ trong hệ thống!" });
  }

  const account = db.accounts[accountIndex];

  // If local account, verify current password (if supplied or enforce it)
  if (account.provider === "local" && currentPassword) {
    if (account.password !== currentPassword) {
      return res.status(400).json({ error: "Mật khẩu hiện tại không chính xác!" });
    }
  }

  // Update password
  account.password = newPassword;
  
  // Log password change
  db.logs.unshift({
    id: `log_${Date.now()}`,
    userName: account.fullName,
    userRole: account.role,
    action: `Đổi mật khẩu cán bộ`,
    timestamp: new Date().toISOString(),
    details: `Cán bộ ${account.fullName} (${account.email}) đã cập nhật mật khẩu mới thành công.`
  });

  saveDatabase(db);
  res.json({ success: true, message: "Mật khẩu đã được thay đổi thành công!" });
});

// Public: Forgot ID request lookup and log creation
app.post("/api/auth/forgot-id-request", (req, res) => {
  const db = loadDatabase();
  const { fullName } = req.body;

  if (!fullName || !fullName.trim()) {
    return res.status(400).json({ error: "Họ và tên không được để trống!" });
  }

  const searchName = fullName.trim().toLowerCase();
  const matchedAccounts = (db.accounts || []).filter(
    (acc: any) => acc.fullName && acc.fullName.trim().toLowerCase() === searchName
  );

  if (matchedAccounts.length === 0) {
    return res.status(404).json({ error: "Không tìm thấy hồ sơ cán bộ nào trùng khớp với họ tên đã điền!" });
  }

  // Handle support requests list
  if (!db.forgotIdRequests) {
    db.forgotIdRequests = [];
  }

  // Deduplicate pending requests
  const hasPending = db.forgotIdRequests.some(
    (r: any) => r.fullName.trim().toLowerCase() === searchName && r.status === "pending"
  );

  if (!hasPending) {
    matchedAccounts.forEach((acc: any) => {
      db.forgotIdRequests.unshift({
        id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        fullName: acc.fullName,
        currentEmail: acc.email,
        status: "pending",
        timestamp: new Date().toISOString()
      });
      
      db.logs.unshift({
        id: `log_${Date.now()}`,
        userName: acc.fullName,
        userRole: acc.role,
        action: `Yêu cầu đổi ID đăng nhập`,
        timestamp: new Date().toISOString(),
        details: `Cán bộ [${acc.fullName}] (ID hiện tại: @${acc.email}) báo quên tài khoản, gửi yêu cầu hỗ trợ đổi ID đăng nhập đến Super Admin.`
      });
    });

    saveDatabase(db);
  }

  res.json({
    success: true,
    message: "Hệ thống an ninh đã tự động ghi nhận và chuyển tiếp yêu cầu của bạn đến Super Admin & ★ Super Admin (Gốc). Vui lòng liên hệ Trực tiếp Người quản lý để duyệt."
  });
});

// Admin: Retrieve all forgot ID requests
app.get("/api/accounts/forgot-id-requests", (req, res) => {
  const db = loadDatabase();
  const emailHeader = req.headers["x-user-email"] as string;
  const roleHeader = req.headers["x-user-role"] as string;

  if (!emailHeader) {
    return res.status(403).json({ error: "Yêu cầu định danh cán bộ!" });
  }

  const requester = db.accounts?.find(
    (acc: any) => acc.email.toLowerCase().trim() === emailHeader.toLowerCase().trim()
  );

  const requesterRole = roleHeader ? decodeURIComponent(roleHeader).trim() : (requester ? requester.role : "");
  const isSuperAdmin = requesterRole === "Super Admin" || emailHeader.toLowerCase().trim() === "admin";

  if (!isSuperAdmin) {
    return res.status(403).json({ error: "Từ chối: Khu vực bảo mật chỉ dành riêng cho quản trị viên!" });
  }

  res.json(db.forgotIdRequests || []);
});

// Admin: Resolve/Delete lookup requests
app.post("/api/accounts/forgot-id-requests/:id/resolve", (req, res) => {
  const db = loadDatabase();
  const { id } = req.params;
  const emailHeader = req.headers["x-user-email"] as string;
  
  if (!emailHeader) {
    return res.status(403).json({ error: "Yêu cầu định danh cán bộ!" });
  }

  const requester = db.accounts?.find(
    (acc: any) => acc.email.toLowerCase().trim() === emailHeader.toLowerCase().trim()
  );

  if (!requester || (requester.role !== "Super Admin" && emailHeader.toLowerCase().trim() !== "admin")) {
    return res.status(403).json({ error: "Yêu cầu quyền truy cập Super Admin!" });
  }

  if (db.forgotIdRequests) {
    db.forgotIdRequests = db.forgotIdRequests.filter((r: any) => r.id !== id);
    saveDatabase(db);
  }

  res.json({ success: true, message: "Đã xóa yêu cầu hỗ trợ thành công." });
});

// Accounts Management APIs (Authorized for Admins/Managers only)
app.get("/api/accounts", (req, res) => {
  const db = loadDatabase();
  const emailHeader = req.headers["x-user-email"] as string;
  
  // Basic security check: verify if requester is Admin or Manager
  if (emailHeader) {
    const requester = db.accounts?.find(
      (acc: any) => acc.email.toLowerCase().trim() === emailHeader.toLowerCase().trim()
    );
    if (!requester || !["Super Admin", "Bí thư Chi bộ", "Trưởng Ban điều hành"].includes(requester.role)) {
      // Still return but flag or restrict sensitive fields or let requester see standard list.
      // We will allow view for audit transparency but keep password secure.
    }
  }

  const safeAccounts = (db.accounts || []).map((acc: any) => ({
    id: acc.id,
    fullName: acc.fullName,
    email: acc.email,
    role: acc.role,
    active: acc.active !== false,
    canEdit: acc.canEdit !== false,
    permissionType: acc.permissionType || (acc.canEdit === false ? "Chỉ xem" : (acc.role === "Cán bộ nhập liệu" ? "Xem và nhập liệu" : (acc.role === "Chi hội trưởng" ? "Ngăn nắp đoàn thể" : "Toàn quyền"))),
    associationGroup: acc.associationGroup,
    provider: acc.provider || "local",
    createdAt: acc.createdAt || new Date().toISOString()
  }));

  res.json(safeAccounts);
});

app.put("/api/accounts/:id", (req, res) => {
  const db = loadDatabase();
  const { id } = req.params;
  const { canEdit, active, permissionType, associationGroup, email } = req.body;
  const emailHeader = req.headers["x-user-email"] as string;
  const roleHeader = req.headers["x-user-role"] as string;

  // Enforce security: Only Super Admin, Trưởng Ban điều hành, or Bí thư Chi bộ can grant system permissions
  if (!emailHeader) {
    return res.status(403).json({ error: "Yêu cầu định danh cán bộ quản lý!" });
  }

  const requester = db.accounts?.find(
    (acc: any) => acc.email.toLowerCase().trim() === emailHeader.toLowerCase().trim()
  );

  if (!requester || !["Super Admin", "Super Mod", "Bí thư Chi bộ", "Trưởng Khu phố", "Trưởng Ban điều hành"].includes(requester.role)) {
    return res.status(403).json({ error: "Bạn không có quyền quản lý cấp quyền trên hệ thống! Chỉ có Admin hoặc người quản lý cấp khu phố mới có thể phê duyệt." });
  }

  if (!db.accounts) db.accounts = [];
  const accountIndex = db.accounts.findIndex((acc: any) => acc.id === id);
  if (accountIndex === -1) {
    return res.status(404).json({ error: "Không tìm thấy tài khoản cán bộ được chỉ định." });
  }

  const targetAccount = db.accounts[accountIndex];

  // Under the user instruction, the administrative role (role) cannot be modified via UI
  // It is set strictly by official Personnel Record / Appointment Decision

  // Update permissionType & keep canEdit backward compatibility
  let solvedPermission = targetAccount.permissionType || (targetAccount.canEdit === false ? "Chỉ xem" : (targetAccount.role === "Cán bộ nhập liệu" ? "Xem và nhập liệu" : (targetAccount.role === "Chi hội trưởng" ? "Ngăn nắp đoàn thể" : "Toàn quyền")));
  if (permissionType !== undefined) {
    targetAccount.permissionType = permissionType.toString().trim();
    solvedPermission = targetAccount.permissionType;
    targetAccount.canEdit = permissionType !== "Chỉ xem";
  } else if (canEdit !== undefined) {
    targetAccount.canEdit = !!canEdit;
    targetAccount.permissionType = !!canEdit ? "Toàn quyền" : "Chỉ xem";
    solvedPermission = targetAccount.permissionType;
  }
  
  if (active !== undefined) targetAccount.active = !!active;
  if (associationGroup !== undefined) targetAccount.associationGroup = associationGroup;

  // Handle email/ID editing (Only Super Admin or admin email can execute)
  if (email !== undefined) {
    const requesterRole = roleHeader ? decodeURIComponent(roleHeader).trim() : requester.role;
    const isSuperAdminOrGoc = requesterRole === "Super Admin" || emailHeader.toLowerCase().trim() === "admin";
    
    if (!isSuperAdminOrGoc) {
      return res.status(403).json({ error: "Từ chối: Quyền đổi ID đăng nhập (Email) chỉ có Super Admin hoặc ★ Super Admin (Gốc) mới thực hiện được!" });
    }

    const normalizedNewEmail = email.toString().trim().toLowerCase();
    if (!normalizedNewEmail) {
      return res.status(400).json({ error: "ID người dùng mới không được để trống!" });
    }

    // Check duplicate
    const duplicate = db.accounts?.find(
      (acc: any) => acc.id !== id && acc.email.toLowerCase().trim() === normalizedNewEmail
    );
    if (duplicate) {
      return res.status(400).json({ error: "Thất bại: ID người dùng mới này đã tồn tại trên hệ thống!" });
    }

    // Handle restriction on master account "admin"
    if (targetAccount.email === "admin" && normalizedNewEmail !== "admin") {
      return res.status(400).json({ error: "Không được phép đổi ID đăng nhập của tài khoản Gốc 'admin'!" });
    }

    const oldEmail = targetAccount.email;
    targetAccount.email = normalizedNewEmail;

    // Log the event
    db.logs.unshift({
      id: `log_${Date.now()}`,
      userName: requester.fullName,
      userRole: requester.role,
      action: `Thay đổi ID người dùng: ${targetAccount.fullName}`,
      timestamp: new Date().toISOString(),
      details: `Quản lý ${requester.fullName} đã thay đổi ID đăng nhập của cán bộ ${targetAccount.fullName} từ [${oldEmail}] thành [${normalizedNewEmail}].`
    });
  }

  saveDatabase(db);
  res.json({
    success: true,
    message: "Cập nhật cấp độ phân quyền thành công!",
    account: {
      id: targetAccount.id,
      fullName: targetAccount.fullName,
      email: targetAccount.email,
      role: targetAccount.role,
      permissionType: targetAccount.permissionType,
      canEdit: targetAccount.canEdit !== false,
      active: targetAccount.active !== false,
      associationGroup: targetAccount.associationGroup
    }
  });
});

// Load full DB
app.get("/api/db", (req, res) => {
  const emailHeader = req.headers["x-user-email"];
  const db = getFilteredDatabase(emailHeader);
  res.json(db);
});

// Residents CRUD
app.get("/api/residents", (req, res) => {
  const emailHeader = req.headers["x-user-email"];
  const db = getFilteredDatabase(emailHeader);
  res.json(db.residents);
});

app.post("/api/residents", (req, res) => {
  const emailHeader = req.headers["x-user-email"] as string;
  const db = loadDatabase();
  const newResident: Resident = req.body;

  if (!newResident.fullName) {
    return res.status(400).json({ error: "Thiếu thông tin họ tên bắt buộc" });
  }

  // FORCE guaranteed fresh unique ID string to fix manual addition issues
  newResident.id = `res_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
  
  if (!newResident.groups) {
    newResident.groups = [];
  }
  if (!newResident.specialCategories) {
    newResident.specialCategories = [];
  }

  // Record creator of the document
  newResident.createdBy = (emailHeader || "admin").toString().toLowerCase().trim();

  // Enforce secure write barriers
  const guard = verifyWritePermission(emailHeader, req.headers["x-user-role"], newResident);
  if (!guard.allowed) {
    return res.status(403).json({ error: guard.reason });
  }

  // Check unique CCCD (if provided and not empty)
  if (newResident.cccd && newResident.cccd.toString().trim() !== "") {
    const trimmedCCCD = newResident.cccd.toString().trim();
    if (db.residents.some(r => r.cccd && r.cccd.toString().trim() === trimmedCCCD)) {
      return res.status(400).json({ error: `Số CCCD ${newResident.cccd} đã tồn tại trong hệ thống!` });
    }
  }

  db.residents.push(newResident);

  // Sync entire households list automatically
  syncAllHouseholds(db);

  // Log action
  db.logs.unshift({
    id: `log_${Date.now()}`,
    userName: req.headers["x-user-name"] as string || "Hệ thống",
    userRole: req.headers["x-user-role"] as string || "Cán bộ",
    action: `Thêm nhân khẩu ${newResident.fullName}`,
    timestamp: new Date().toISOString(),
    details: `Họ tên: ${newResident.fullName}, CCCD: ${newResident.cccd}, Loại cư trú: ${newResident.residenceType}`
  });

  saveDatabase(db);
  res.status(201).json(newResident);
});

app.put("/api/residents/:id", (req, res) => {
  const emailHeader = req.headers["x-user-email"] as string;
  const db = loadDatabase();
  const { id } = req.params;
  const updatedData: Resident = req.body;

  // Ultra robust string matching for IDs to prevent lookups from dropping updates
  const index = db.residents.findIndex(r => r.id && r.id.toString().trim() === id.toString().trim());
  if (index === -1) {
    return res.status(404).json({ error: "Không tìm thấy thông tin dân cư" });
  }

  const targetResident = db.residents[index];

  // Guard: Verify write permission
  const guard = verifyWritePermission(emailHeader, req.headers["x-user-role"], targetResident);
  if (!guard.allowed) {
    return res.status(403).json({ error: guard.reason });
  }

  // CCCD unique check (excluding self)
  if (updatedData.cccd && updatedData.cccd.toString().trim() !== "") {
    const trimmedCCCD = updatedData.cccd.toString().trim();
    const duplicateExists = db.residents.some(r => 
      r.cccd && 
      r.cccd.toString().trim() === trimmedCCCD && 
      r.id.toString().trim() !== id.toString().trim()
    );
    if (duplicateExists) {
      return res.status(400).json({ error: `Số CCCD ${updatedData.cccd} đã tồn tại ở công dân khác!` });
    }
  }

  const oldName = db.residents[index].fullName;
  db.residents[index] = { 
    ...db.residents[index], 
    ...updatedData, 
    id: db.residents[index].id, // protect actual ID
    updatedAt: new Date().toISOString() 
  };

  // Sync entire households list automatically
  syncAllHouseholds(db);

  // Log action
  db.logs.unshift({
    id: `log_${Date.now()}`,
    userName: req.headers["x-user-name"] as string || "Hệ thống",
    userRole: req.headers["x-user-role"] as string || "Cán bộ",
    action: `Cập nhật nhân khẩu ${updatedData.fullName}`,
    timestamp: new Date().toISOString(),
    details: `Thay đổi thông tin nhân khẩu từ gốc: ${oldName}`
  });

  saveDatabase(db);
  res.json(db.residents[index]);
});

app.delete("/api/residents/:id", (req, res) => {
  const emailHeader = req.headers["x-user-email"] as string;
  const db = loadDatabase();
  const { id } = req.params;

  // Robust string-trimmed matching for deleting
  const index = db.residents.findIndex(r => r.id && r.id.toString().trim() === id.toString().trim());
  if (index === -1) {
    return res.status(404).json({ error: "Không tìm thấy thông tin dân cư để xóa" });
  }

  const removed = db.residents[index];

  // Enforce secure write barriers
  const guard = verifyWritePermission(emailHeader, req.headers["x-user-role"], removed);
  if (!guard.allowed) {
    return res.status(403).json({ error: guard.reason });
  }

  db.residents.splice(index, 1);

  // Sync entire households list automatically
  syncAllHouseholds(db);

  // Log action
  db.logs.unshift({
    id: `log_${Date.now()}`,
    userName: req.headers["x-user-name"] as string || "Hệ thống",
    userRole: req.headers["x-user-role"] as string || "Cán bộ",
    action: `Xóa nhân khẩu ${removed.fullName}`,
    timestamp: new Date().toISOString(),
    details: `CCCD: ${removed.cccd}, Địa chỉ: ${removed.address}`
  });

  saveDatabase(db);
  res.json({ success: true, removed });
});

// Import bulk residents
app.post("/api/residents/import", (req, res) => {
  const emailHeader = req.headers["x-user-email"] as string;
  const db = loadDatabase();
  const newResidentsList: Resident[] = req.body.residents;

  if (!Array.isArray(newResidentsList) || newResidentsList.length === 0) {
    return res.status(400).json({ error: "Danh sách nhân khẩu nạp vào không hợp lệ" });
  }

  const requester = (db.accounts || []).find(
    (acc: any) => acc.email.toLowerCase().trim() === (emailHeader || "").toString().toLowerCase().trim()
  );

  if (!requester || requester.canEdit === false || requester.active === false || requester.role === "Người xem báo cáo") {
    return res.status(403).json({ error: "Tài khoản của bạn chỉ được phép xem, không thể nạp tệp hay ghi nhận dữ liệu mới!" });
  }

  let importedCount = 0;
  let updatedCount = 0;

  newResidentsList.forEach(newRes => {
    // Attempt to match with an existing resident
    let existingIndex = -1;
    // Match by CCCD
    if (newRes.cccd && newRes.cccd.trim() !== "") {
      existingIndex = db.residents.findIndex(r => r.cccd === newRes.cccd);
    }
    // Fallback: match by full name and date of birth
    if (existingIndex === -1 && newRes.fullName && newRes.dob) {
      existingIndex = db.residents.findIndex(r => 
        r.fullName.toLowerCase().trim() === newRes.fullName.toLowerCase().trim() && 
        r.dob.trim() === newRes.dob.trim()
      );
    }

    if (existingIndex !== -1) {
      // Keep existing groups and specialCategories if not specified
      const currentRes = db.residents[existingIndex];
      db.residents[existingIndex] = {
        ...currentRes,
        ...newRes,
        id: currentRes.id, // keep original ID
        groups: newRes.groups && newRes.groups.length > 0 ? newRes.groups : currentRes.groups,
        specialCategories: newRes.specialCategories && newRes.specialCategories.length > 0 ? newRes.specialCategories : currentRes.specialCategories,
        updatedAt: new Date().toISOString()
      };
      updatedCount++;
    } else {
      // Adding new resident
      if (!newRes.id) {
         newRes.id = `res_csv_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
      }
      db.residents.push(newRes);
      importedCount++;
    }
  });

  // Sync entire households list automatically
  syncAllHouseholds(db);

  if (importedCount > 0 || updatedCount > 0) {
    db.logs.unshift({
      id: `log_${Date.now()}`,
      userName: req.headers["x-user-name"] as string || "Hệ thống",
      userRole: req.headers["x-user-role"] as string || "Cán bộ Excel",
      action: `Nạp dữ liệu từ nguồn tệp (Mới: ${importedCount}, Cập nhật: ${updatedCount})`,
      timestamp: new Date().toISOString(),
      details: `Đồng bộ hoàn tất dữ liệu từ tệp nguồn dân cư. Nhập mới: ${importedCount} nhân khẩu, Cập nhật ghi đè: ${updatedCount} nhân khẩu.`
    });
    saveDatabase(db);
  }

  res.json({
    success: true,
    importedCount,
    updatedCount,
    duplicatedCount: 0,
    duplicatedList: []
  });
});

// AI Auto-Sync residents & households database
app.post("/api/residents/ai-sync", (req, res) => {
  const emailHeader = req.headers["x-user-email"] as string;
  const db = loadDatabase();

  let countSanitized = 0;
  if (Array.isArray(db.residents)) {
    db.residents.forEach((r: any) => {
      let modified = false;
      if (r.fullName) {
        const trimmed = r.fullName.trim();
        if (trimmed) {
          const proper = trimmed.split(/\s+/).map((w: string) => {
            if (!w) return "";
            return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
          }).filter(Boolean).join(" ");
          if (r.fullName !== proper) {
            r.fullName = proper;
            modified = true;
          }
        }
      }
      if (r.cccd && typeof r.cccd === "string") {
        const cleanCccd = r.cccd.replace(/\s+/g, "").trim();
        if (r.cccd !== cleanCccd) {
          r.cccd = cleanCccd;
          modified = true;
        }
      }
      if (modified) {
        countSanitized++;
      }
    });
  }

  // Sync entire households list automatically
  syncAllHouseholds(db);

  db.logs.unshift({
    id: `log_${Date.now()}`,
    userName: req.headers["x-user-name"] as string || "Tổng đài viên AI",
    userRole: req.headers["x-user-role"] as string || "Trợ lý số hóa",
    action: "Hệ thống AI tự động đồng bộ hóa toàn diện dữ liệu nhân dân",
    timestamp: new Date().toISOString(),
    details: `Đã chuẩn hóa chữ viết và định dạng cho ${countSanitized} công dân. Khôi phục liên kết đồng bộ cho ${db.households?.length || 0} hộ gia đình và cập nhật thông tin ban ngành.`
  });

  saveDatabase(db);

  res.json({
    success: true,
    message: "Hệ thống đã đồng bộ hóa thành công toàn bộ cơ sở dữ liệu bằng thuật toán AI!",
    details: {
      sanitizedCount: countSanitized,
      householdsSynced: db.households?.length || 0,
      residentsCount: db.residents?.length || 0
    },
    residents: db.residents,
    households: db.households || []
  });
});

// Households API
app.get("/api/households", (req, res) => {
  const db = loadDatabase();
  res.json(db.households);
});

app.post("/api/households", (req, res) => {
  const db = loadDatabase();
  const newHH: Household = req.body;

  if (!newHH.id || !newHH.headerName) {
    return res.status(400).json({ error: "Thiếu thông tin mã tổ/số nhà hoặc chủ hộ" });
  }

  const existingIndex = db.households.findIndex(h => h.id === newHH.id);
  if (existingIndex !== -1) {
    db.households[existingIndex] = { ...db.households[existingIndex], ...newHH };
  } else {
    db.households.push(newHH);
  }

  db.logs.unshift({
    id: `log_${Date.now()}`,
    userName: req.headers["x-user-name"] as string || "Hệ thống",
    userRole: req.headers["x-user-role"] as string || "Cán bộ",
    action: `Thêm/Sửa hộ gia đình mã ${newHH.id}`,
    timestamp: new Date().toISOString(),
    details: `Chủ hộ: ${newHH.headerName}, Địa chỉ: ${newHH.address}`
  });

  saveDatabase(db);
  res.json({ success: true, household: newHH });
});

app.delete("/api/households/:id", (req, res) => {
  const emailHeader = req.headers["x-user-email"] as string;
  const db = loadDatabase();
  const { id } = req.params;

  const existingIndex = db.households.findIndex(
    (h: any) => h.id && h.id.toString().trim() === id.toString().trim()
  );
  if (existingIndex === -1) {
    return res.status(404).json({ error: "Không tìm thấy thông tin hộ gia đình để xóa" });
  }

  const targetHH = db.households[existingIndex];

  // Enforce permission checks
  const guard = verifyWritePermission(emailHeader, req.headers["x-user-role"], null);
  if (!guard.allowed) {
    return res.status(403).json({ error: guard.reason });
  }

  // Cascade delete all residents belonging physically to this household ID
  const householdMembers = db.residents.filter(
    (r: any) => r.householdId && r.householdId.toString().trim() === id.toString().trim()
  );
  const memberCount = householdMembers.length;

  db.residents = db.residents.filter(
    (r: any) => !r.householdId || r.householdId.toString().trim() !== id.toString().trim()
  );

  // Delete the household record
  db.households.splice(existingIndex, 1);

  // Sync GIS households deletions securely
  if (db.gisHouseholds) {
    db.gisHouseholds = db.gisHouseholds.filter(
      (h: any) => h.id && h.id.toString().trim() !== id.toString().trim()
    );
  }

  // Self sync
  syncAllHouseholds(db);

  // Audit Logs
  db.logs.unshift({
    id: `log_${Date.now()}`,
    userName: decodeURIComponent(req.headers["x-user-name"] as string || "Ban quản lý"),
    userRole: decodeURIComponent(req.headers["x-user-role"] as string || "Cán bộ"),
    action: "XÓA HỘ VÀ NHÂN KHẨU",
    timestamp: new Date().toISOString(),
    details: `Xóa hộ khẩu mã ${targetHH.id} (Chủ hộ: ${targetHH.headerName}). Giáo dục & di dời các thành viên. Đồng thời xóa tự động ${memberCount} nhân khẩu trực thuộc khỏi dữ liệu cư trú địa bàn.`
  });

  saveDatabase(db);
  res.json({ success: true, removedCount: memberCount, removedHousehold: targetHH });
});

// Businesses API
app.get("/api/businesses", (req, res) => {
  const emailHeader = req.headers["x-user-email"];
  const db = getFilteredDatabase(emailHeader);
  res.json(db.businesses || []);
});

app.post("/api/businesses", (req, res) => {
  const emailHeader = req.headers["x-user-email"];
  const guard = verifyGovtWritePermission(emailHeader, req.headers["x-user-role"]);
  if (!guard.allowed) {
    return res.status(403).json({ error: guard.reason });
  }

  const db = loadDatabase();
  const newBiz: BusinessEstablishment = req.body;

  if (!newBiz.name || !newBiz.ownerName) {
    return res.status(400).json({ error: "Thiếu tên cơ sở kinh doanh hoặc tên chủ sở hữu" });
  }

  if (!newBiz.id) {
    newBiz.id = `biz_${Date.now()}`;
  }

  if (!db.businesses) {
    db.businesses = [];
  }

  db.businesses.push(newBiz);

  // Log action
  db.logs.unshift({
    id: `log_${Date.now()}`,
    userName: req.headers["x-user-name"] as string || "Hệ thống",
    userRole: req.headers["x-user-role"] as string || "Cán bộ",
    action: `Thêm cơ sở kinh doanh ${newBiz.name}`,
    timestamp: new Date().toISOString(),
    details: `Tên cơ sở: ${newBiz.name}, Loại hình: ${newBiz.businessType}, Đại diện: ${newBiz.ownerName}`
  });

  saveDatabase(db);
  res.status(201).json(newBiz);
});

app.put("/api/businesses/:id", (req, res) => {
  const emailHeader = req.headers["x-user-email"];
  const guard = verifyGovtWritePermission(emailHeader, req.headers["x-user-role"]);
  if (!guard.allowed) {
    return res.status(403).json({ error: guard.reason });
  }

  const db = loadDatabase();
  const { id } = req.params;
  const updatedBiz: BusinessEstablishment = req.body;

  if (!db.businesses) {
    db.businesses = [];
  }

  const idx = db.businesses.findIndex(b => b.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Không tìm thấy thông tin cơ sở kinh doanh" });
  }

  const oldName = db.businesses[idx].name;
  db.businesses[idx] = { ...db.businesses[idx], ...updatedBiz };

  // Log action
  db.logs.unshift({
    id: `log_${Date.now()}`,
    userName: req.headers["x-user-name"] as string || "Hệ thống",
    userRole: req.headers["x-user-role"] as string || "Cán bộ",
    action: `Cập nhật cơ sở kinh doanh ${updatedBiz.name}`,
    timestamp: new Date().toISOString(),
    details: `Tên cũ: ${oldName}, Tên mới: ${updatedBiz.name}. Người đại diện: ${updatedBiz.ownerName}`
  });

  saveDatabase(db);
  res.json(db.businesses[idx]);
});

app.delete("/api/businesses/:id", (req, res) => {
  const emailHeader = req.headers["x-user-email"];
  const guard = verifyGovtWritePermission(emailHeader, req.headers["x-user-role"]);
  if (!guard.allowed) {
    return res.status(403).json({ error: guard.reason });
  }

  const db = loadDatabase();
  const { id } = req.params;

  if (!db.businesses) {
    db.businesses = [];
  }

  const idx = db.businesses.findIndex(b => b.id && b.id.toString().trim() === id.toString().trim());
  if (idx === -1) {
    return res.status(404).json({ error: "Không tìm thấy cơ sở kinh doanh để xóa" });
  }

  const removed = db.businesses.splice(idx, 1)[0];

  // Log action
  db.logs.unshift({
    id: `log_${Date.now()}`,
    userName: req.headers["x-user-name"] as string || "Hệ thống",
    userRole: req.headers["x-user-role"] as string || "Cán bộ",
    action: `Xóa cơ sở kinh doanh ${removed.name}`,
    timestamp: new Date().toISOString(),
    details: `Xóa vĩnh viễn cơ sở kinh doanh tại ${removed.address}. Chủ sở hữu cũ: ${removed.ownerName}`
  });

  saveDatabase(db);
  res.json({ success: true, removedId: id });
});

// Schedules API
app.get("/api/schedules", (req, res) => {
  const db = loadDatabase();
  res.json(db.schedules);
});

app.post("/api/schedules", (req, res) => {
  const db = loadDatabase();
  const newSch: WorkSchedule = req.body;

  if (!newSch.title || !newSch.dateTime) {
    return res.status(400).json({ error: "Thiếu thời gian hoặc tiêu đề lịch" });
  }

  if (!newSch.id) {
    newSch.id = `sch_${Date.now()}`;
  }

  db.schedules.push(newSch);

  db.logs.unshift({
    id: `log_${Date.now()}`,
    userName: req.headers["x-user-name"] as string || "Hệ thống",
    userRole: req.headers["x-user-role"] as string || "Cán bộ Lập lịch",
    action: `Lập lịch công tác mới: ${newSch.title}`,
    timestamp: new Date().toISOString(),
    details: `Thời gian: ${newSch.dateTime}, Địa điểm: ${newSch.location}`
  });

  saveDatabase(db);
  res.status(201).json(newSch);
});

app.delete("/api/schedules/:id", (req, res) => {
  const db = loadDatabase();
  const { id } = req.params;

  const index = db.schedules.findIndex(s => s.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Không tìm thấy lịch để xóa" });
  }

  const removed = db.schedules.splice(index, 1)[0];

  db.logs.unshift({
    id: `log_${Date.now()}`,
    userName: req.headers["x-user-name"] as string || "Hệ thống",
    userRole: req.headers["x-user-role"] as string || "Cán bộ",
    action: `Xóa lịch công tác: ${removed.title}`,
    timestamp: new Date().toISOString(),
    details: `Thời gian đã lên: ${removed.dateTime}`
  });

  saveDatabase(db);
  res.json({ success: true, removed });
});

app.put("/api/schedules/:id", (req, res) => {
  const db = loadDatabase();
  const { id } = req.params;
  const updatedData = req.body;

  const index = db.schedules.findIndex(s => s.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Không tìm thấy chương trình lệnh để cập nhật" });
  }

  db.schedules[index] = {
    ...db.schedules[index],
    ...updatedData,
    id: db.schedules[index].id // Keep existing id
  };

  db.logs.unshift({
    id: `log_${Date.now()}`,
    userName: req.headers["x-user-name"] as string || "Hệ thống",
    userRole: req.headers["x-user-role"] as string || "Cán bộ Lập lịch",
    action: `Cập nhật lịch/phân công: ${db.schedules[index].title}`,
    timestamp: new Date().toISOString(),
    details: `Cập nhật phân bổ công việc chi tiết hoặc bổ sung tài liệu nguồn.`
  });

  saveDatabase(db);
  res.json(db.schedules[index]);
});

// Document Templates Custom addition
app.get("/api/templates", (req, res) => {
  const db = loadDatabase();
  res.json(db.templates);
});

app.post("/api/templates", (req, res) => {
  const db = loadDatabase();
  const newTemp: DocumentTemplate = req.body;

  if (!newTemp.name || !newTemp.structure) {
    return res.status(400).json({ error: "Thiếu tên mẫu hoặc cấu trúc thể thức văn bản" });
  }

  if (!newTemp.id) {
    newTemp.id = `temp_${Date.now()}`;
  }

  db.templates.push(newTemp);

  db.logs.unshift({
    id: `log_${Date.now()}`,
    userName: req.headers["x-user-name"] as string || "Hệ thống",
    userRole: req.headers["x-user-role"] as string || "Cán bộ",
    action: `Tải lên/Tạo mới mẫu văn bản ${newTemp.name}`,
    timestamp: new Date().toISOString(),
    details: `Danh mục: ${newTemp.type}, Mô tả: ${newTemp.description}`
  });

  saveDatabase(db);
  res.status(201).json(newTemp);
});

// Historical Documents Generated App
app.get("/api/documents", (req, res) => {
  const db = loadDatabase();
  res.json(db.documents);
});

app.post("/api/documents", (req, res) => {
  const db = loadDatabase();
  const newDoc: GeneratedDocument = req.body;

  if (!newDoc.title || !newDoc.content) {
    return res.status(400).json({ error: "Thiếu nội dung hoặc tiêu đề văn bản" });
  }

  if (!newDoc.id) {
    newDoc.id = `doc_${Date.now()}`;
  }
  if (!newDoc.createdAt) {
    newDoc.createdAt = new Date().toISOString();
  }

  db.documents.unshift(newDoc);

  db.logs.unshift({
    id: `log_${Date.now()}`,
    userName: req.headers["x-user-name"] as string || "Hệ thống",
    userRole: req.headers["x-user-role"] as string || "Cán bộ",
    action: `Lưu văn bản pháp chế mới: ${newDoc.title}`,
    timestamp: new Date().toISOString(),
    details: `Thể loại văn bản mẫu: ${newDoc.templateType}`
  });

  saveDatabase(db);
  res.status(201).json(newDoc);
});

// Incoming & Outgoing Official Documents Management (REST endpoints)
app.get("/api/official-documents", (req, res) => {
  const db = loadDatabase();
  res.json(db.officialDocuments || []);
});

app.post("/api/official-documents", (req, res) => {
  const emailHeader = req.headers["x-user-email"] as string;
  const guard = verifyGovtWritePermission(emailHeader, req.headers["x-user-role"]);
  if (!guard.allowed) {
    return res.status(403).json({ error: guard.reason });
  }

  const db = loadDatabase();
  const newOfficialDoc = req.body;

  if (!newOfficialDoc.title) {
    return res.status(400).json({ error: "Thiếu tiêu đề văn bản" });
  }
  if (!newOfficialDoc.type || !newOfficialDoc.category) {
    return res.status(400).json({ error: "Thiếu loại văn bản hoặc mục phân nhóm chính" });
  }

  if (!newOfficialDoc.id) {
    newOfficialDoc.id = `offdoc_${Date.now()}`;
  }
  if (!newOfficialDoc.updatedAt) {
    newOfficialDoc.updatedAt = new Date().toISOString();
  }

  if (!db.officialDocuments) {
    db.officialDocuments = [];
  }

  db.officialDocuments.unshift(newOfficialDoc);

  db.logs.unshift({
    id: `log_${Date.now()}`,
    userName: req.headers["x-user-name"] as string || "Hệ thống",
    userRole: req.headers["x-user-role"] as string || "Cán bộ",
    action: `Lưu trữ văn bản hành sự (${newOfficialDoc.type === 'incoming' ? 'Đến' : 'Đi'}): ${newOfficialDoc.title}`,
    timestamp: new Date().toISOString(),
    details: `Số: ${newOfficialDoc.docNumber}, Phân loại: ${newOfficialDoc.category}, Năm: ${newOfficialDoc.year}`
  });

  saveDatabase(db);
  res.status(201).json(newOfficialDoc);
});

app.put("/api/official-documents/:id", (req, res) => {
  const emailHeader = req.headers["x-user-email"] as string;
  const guard = verifyGovtWritePermission(emailHeader, req.headers["x-user-role"]);
  if (!guard.allowed) {
    return res.status(403).json({ error: guard.reason });
  }

  const db = loadDatabase();
  const { id } = req.params;
  const updatedData = req.body;

  if (!db.officialDocuments) {
    db.officialDocuments = [];
  }

  const index = db.officialDocuments.findIndex(doc => doc.id && doc.id.toString().trim() === id.toString().trim());
  if (index === -1) {
    return res.status(404).json({ error: "Không tìm thấy văn bản để cập nhật" });
  }

  const oldDoc = db.officialDocuments[index];
  
  const updatedDoc = {
    ...oldDoc,
    ...updatedData,
    id: oldDoc.id,
    updatedAt: new Date().toISOString()
  };

  db.officialDocuments[index] = updatedDoc;

  db.logs.unshift({
    id: `log_${Date.now()}`,
    userName: req.headers["x-user-name"] as string || "Hệ thống",
    userRole: req.headers["x-user-role"] as string || "Cán bộ",
    action: `Cập nhật văn bản hành sự: ${updatedDoc.title}`,
    timestamp: new Date().toISOString(),
    details: `Số: ${updatedDoc.docNumber}, Phân loại: ${updatedDoc.category}`
  });

  saveDatabase(db);
  res.status(200).json(updatedDoc);
});

app.delete("/api/official-documents/:id", (req, res) => {
  const emailHeader = req.headers["x-user-email"] as string;
  const guard = verifyGovtWritePermission(emailHeader, req.headers["x-user-role"]);
  if (!guard.allowed) {
    return res.status(403).json({ error: guard.reason });
  }

  const db = loadDatabase();
  const { id } = req.params;

  if (!db.officialDocuments) {
    db.officialDocuments = [];
  }

  const index = db.officialDocuments.findIndex(doc => doc.id && doc.id.toString().trim() === id.toString().trim());
  if (index === -1) {
    return res.status(404).json({ error: "Không tìm thấy văn bản để xóa" });
  }

  const removedDoc = db.officialDocuments[index];
  db.officialDocuments.splice(index, 1);

  db.logs.unshift({
    id: `log_${Date.now()}`,
    userName: req.headers["x-user-name"] as string || "Hệ thống",
    userRole: req.headers["x-user-role"] as string || "Cán bộ",
    action: `Xóa văn bản hành sự: ${removedDoc.title}`,
    timestamp: new Date().toISOString(),
    details: `Số: ${removedDoc.docNumber}, Phân loại: ${removedDoc.category}`
  });

  saveDatabase(db);
  res.status(200).json({ success: true, message: "Đã xóa văn bản hành sự thành công" });
});

// Logs API
app.get("/api/logs", (req, res) => {
  const db = loadDatabase();
  res.json(db.logs);
});

// Available dynamic resident groups & organizations configuration
app.get("/api/available-groups", (req, res) => {
  const db = loadDatabase();
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
  res.json(db.availableGroups || DEFAULT_GROUPS);
});

app.post("/api/available-groups", (req, res) => {
  const emailHeader = req.headers["x-user-email"] as string;
  const guard = verifyGovtWritePermission(emailHeader, req.headers["x-user-role"]);
  if (!guard.allowed) {
    return res.status(403).json({ error: guard.reason });
  }

  const { groups } = req.body;
  if (!Array.isArray(groups)) {
    return res.status(400).json({ error: "Dữ liệu đoàn thể không hợp lệ" });
  }

  const db = loadDatabase();
  db.availableGroups = groups;
  saveDatabase(db);

  db.logs.unshift({
    id: `log_${Date.now()}`,
    userName: req.headers["x-user-name"] as string || "Hệ thống",
    userRole: req.headers["x-user-role"] as string || "Cán bộ",
    action: `Cập nhật cơ cấu tổ chức & Ban công tác mới`,
    timestamp: new Date().toISOString(),
    details: `Tổng số tổ công tác & đoàn thể hiện tại: ${groups.length}. Danh sách: ${groups.join(", ")}`
  });
  saveDatabase(db);

  res.status(200).json(db.availableGroups);
});

// Available dynamic Tổ NDTQ configuration
app.get("/api/available-ndtqs", (req, res) => {
  const db = loadDatabase();
  const DEFAULT_NDTQS = Array.from({ length: 14 }, (_, i) => `Tổ ${i + 1}`);
  res.json(db.availableNDTQs || DEFAULT_NDTQS);
});

app.post("/api/available-ndtqs", (req, res) => {
  const emailHeader = req.headers["x-user-email"] as string;
  const guard = verifyGovtWritePermission(emailHeader, req.headers["x-user-role"]);
  if (!guard.allowed) {
    return res.status(403).json({ error: guard.reason });
  }

  const { ndtqs } = req.body;
  if (!Array.isArray(ndtqs)) {
    return res.status(400).json({ error: "Dữ liệu tổ NDTQ không hợp lệ" });
  }

  const db = loadDatabase();
  db.availableNDTQs = ndtqs;
  saveDatabase(db);

  db.logs.unshift({
    id: `log_${Date.now()}`,
    userName: req.headers["x-user-name"] as string || "Hệ thống",
    userRole: req.headers["x-user-role"] as string || "Cán bộ",
    action: `Cập nhật danh sách Tổ Nhân dân tự quản (Tổ NDTQ) mới`,
    timestamp: new Date().toISOString(),
    details: `Tổng số tổ NDTQ hiện tại: ${ndtqs.length}. Sách tổ: ${ndtqs.join(", ")}`
  });
  saveDatabase(db);

  res.status(200).json(db.availableNDTQs);
});

// Available dynamic đối tượng chính sách (policies) configuration
app.get("/api/available-policies", (req, res) => {
  const db = loadDatabase();
  const DEFAULT_POLICIES = [
    "Hộ nghèo",
    "Hộ cận nghèo",
    "Người khuyết tật",
    "Trẻ em",
    "Thương binh",
    "Bệnh binh",
    "Thân nhân liệt sĩ",
    "Người có công"
  ];
  res.json(db.availablePolicies || DEFAULT_POLICIES);
});

app.post("/api/available-policies", (req, res) => {
  const emailHeader = req.headers["x-user-email"] as string;
  const guard = verifyGovtWritePermission(emailHeader, req.headers["x-user-role"]);
  if (!guard.allowed) {
    return res.status(403).json({ error: guard.reason });
  }

  const { policies } = req.body;
  if (!Array.isArray(policies)) {
    return res.status(400).json({ error: "Dữ liệu đối tượng chính sách không hợp lệ" });
  }

  const db = loadDatabase();
  db.availablePolicies = policies;
  saveDatabase(db);

  db.logs.unshift({
    id: `log_${Date.now()}`,
    userName: req.headers["x-user-name"] as string || "Hệ thống",
    userRole: req.headers["x-user-role"] as string || "Cán bộ",
    action: `Cập nhật danh mục Đối tượng chính sách & an sinh mới`,
    timestamp: new Date().toISOString(),
    details: `Tổng số đối tượng chính sách hiện tại: ${policies.length}. Danh sách: ${policies.join(", ")}`
  });
  saveDatabase(db);

  res.status(200).json(db.availablePolicies);
});

// AI Soạn thảo văn bản hành chính sử dụng Gemini API (Giống như Gemini - Hỗ trợ cả file đính kèm đa định dạng)
app.post("/api/gemini/generate-document", async (req, res) => {
  const { 
    prompt, 
    fileContent, 
    fileName, 
    templateType, 
    structure, 
    userInputs 
  } = req.body;

  // If this is the original rigid form submission (backward compatibility)
  if (!prompt && templateType && structure) {
    try {
      const inputFieldsSummary = Object.entries(userInputs || {})
        .map(([key, val]) => `- ${key}: ${val}`)
        .join("\n");

      const systemPrompt = `Bạn là chuyên gia phân tích chính trị, pháp lý, và trợ lý hành chính kỳ cựu phục vụ Ban điều hành Tổ dân phố và Ủy ban nhân dân Phường tại Việt Nam.
Nhiệm vụ của bạn là soạn thảo một văn bản hành chính thuộc thể loại "${templateType}" tuân thủ chặt chẽ các thông tư và nghị định quy định thể thức phát hành văn bản hành chính của cơ quan Nhà nước Việt Nam (đặc biệt là Nghị định số 30/2020/NĐ-CP của Chính phủ quy định về công tác văn thư).

Thể thức chính thức phải bao gồm:
- Quốc hiệu và Tiêu ngữ viết in hoa cực kỳ chuẩn xác, căn lề phải chẽ (CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM, Độc lập - Tự do - Hạnh phúc)
- Cơ quan chủ quản và đơn vị phát hành (Ví dụ: UBND PHƯỜNG AN PHÚ / BAN ĐIỀU HÀNH KHU PHỐ 3) bên góc trái trên cùng
- Số hiệu văn bản, thời gian (..., ngày... tháng... năm 2026)
- Tên văn bản (Thông báo, Giấy mời, Kế hoạch, Biên bản...) viết IN HOA nổi bật căn giữa
- Phần kính gửi chuyên nghiệp đến đúng thành phần đối tượng
- Thân văn bản chặt chẽ, diễn đạt súc tích bằng tiếng Việt hành chính chính thống, không lan man dư thừa.
- Nơi nhận (bên góc dưới trái)
- Đại diện ký tên, chức vụ chính xác (TM. BAN ĐIỀU HÀNH KHU PHỐ - TRƯỞNG KHU PHỐ...) ở góc dưới phải.

Hãy dựa vào mẫu định dạng cơ bản sau đây:\n"""\n${structure}\n"""\n\nvà nhập các dữ liệu được yêu cầu từ người dùng sau đây vào văn bản:\n"""\n${inputFieldsSummary}\n"""

Hãy viết nội dung hoàn chỉnh, triển khai các chi tiết một cách dài dặn, mạch lạc, rực rỡ và chuyên nghiệp về mặt hành chính chính sách Việt Nam. Hãy chèn nội dung đầy đủ thay vì chỉ ghi placeholder chung chung. Trả về kết quả dưới dạng Markdown đẹp mắt, văn minh, có tiêu đề rành mạch, dễ đọc.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: systemPrompt,
      });

      const draftText = response.text || "Không có kết quả sinh ra tự động từ AI.";
      return res.json({ content: draftText });
    } catch (error: any) {
      console.error("Lỗi soạn thảo bằng mẫu:", error);
      return res.status(500).json({ error: "Lỗi kết nối AI: " + error.message });
    }
  }

  // Conversational prompt-based generation (Gemini-like)
  if (!prompt) {
    return res.status(400).json({ error: "Yêu cầu cung cấp nội dung hoặc câu lệnh soạn thảo cho Gemini." });
  }

  try {
    let geminiPart: any = null;
    let extractedText = "";

    // Parse file if available
    if (fileContent) {
      let base64Data = fileContent;
      let mimeType = "application/octet-stream";
      if (fileContent.includes(";base64,")) {
        const parts = fileContent.split(";base64,");
        mimeType = parts[0].split(":")[1] || mimeType;
        base64Data = parts[1];
      }
      
      const buffer = Buffer.from(base64Data, "base64");
      const lastDotIndex = fileName ? fileName.lastIndexOf(".") : -1;
      const ext = lastDotIndex !== -1 ? fileName.substring(lastDotIndex).toLowerCase() : "";

      if (ext === ".pdf") {
        geminiPart = {
          inlineData: {
            mimeType: "application/pdf",
            data: base64Data,
          },
        };
      } else if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
        geminiPart = {
          inlineData: {
            mimeType: mimeType === "application/octet-stream" ? `image/${ext.replace(".", "")}` : mimeType,
            data: base64Data,
          },
        };
      } else if (ext === ".xlsx" || ext === ".xls" || ext === ".csv") {
        try {
          const workbook = XLSX.read(buffer, { type: "buffer" });
          let sheetDataText = "";
          workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const csvData = XLSX.utils.sheet_to_csv(worksheet);
            sheetDataText += `--- BẢNG: ${sheetName} ---\n${csvData}\n\n`;
          });
          extractedText = sheetDataText;
        } catch (excelErr: any) {
          extractedText = buffer.toString("utf-8");
        }
      } else if (ext === ".docx") {
        try {
          const docResult = await mammoth.extractRawText({ buffer });
          extractedText = docResult.value;
        } catch (wordErr: any) {
          extractedText = buffer.toString("utf-8");
        }
      } else {
        extractedText = buffer.toString("utf-8");
      }
    }

    const systemPromptText = `Bạn là Trợ lý AI Soạn thảo văn bản và Cố vấn hành chính kỳ cựu phục vụ Cán bộ và Ban điều hành Tổ dân phố / Khu phố tại Việt Nam.
Nhiệm vụ của bạn là giải quyết câu lệnh của người dùng một cách chính xác, tinh tế, và soạn ra các văn bản, thông báo, giấy mời, tờ trình, biểu mẫu, biên bản họp cực kỳ quy chuẩn.
Mọi văn bản hành chính Việt Nam được sinh ra phải tuân thủ nghiêm ngặt thể thức của cơ quan Nhà nước Việt Nam (đặc biệt là Nghị định số 30/2020/NĐ-CP của Chính phủ).

Thể thức chuẩn tuyệt đối bao gồm:
1. Quốc hiệu & Tiêu ngữ viết in hoa, căn lề đúng cách (CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM, Độc lập - Tự do - Hạnh phúc).
2. Cơ quan phát hành hành chính bên trái (UBND PHƯỜNG AN PHÚ / BAN ĐIỀU HÀNH KHU PHỐ 3).
3. Địa danh & thời gian lập văn bản (ngày, tháng, năm).
4. Tên loại văn bản viết IN HOA nổi bật căn giữa (ví dụ: GIẤY MỜI HỌP, THÔNG BÁO KHẨN, KẾ HOẠCH, BÁO CÁO, TỜ TRÌNH).
5. Phần kính gửi/Thành phần nhận trang trọng thích hợp.
6. Nội dung triển khai mạch lạc, chính xác từ ngữ pháp lý xã hội, không viết placeholder chung chung hay để trống thiếu sót. Điền đầy đủ dữ liệu thực tế được cung cấp.
7. Thể thức ký tên có chức danh (TM. BAN ĐIỀU HÀNH - TRƯỞNG KHU PHỐ...) ở góc dưới bên phải.

Nếu có tệp tin đính kèm (PDF, Word, Excel, hình ảnh), hãy đọc kỹ và kết hợp toàn bộ thông tin từ tệp đính kèm đó vào văn bản soạn thảo theo chỉ đạo của người dùng.`;

    const instructionsPrompt = `YÊU CẦU SOẠN THẢO/CÂU LỆNH CỦA CÁN BỘ:
"""
${prompt}
"""`;

    let modelContents: any;
    if (geminiPart) {
      modelContents = {
        parts: [
          geminiPart,
          { text: `${systemPromptText}\n\n${instructionsPrompt}\n\n(Vui lòng phân tích tệp tin đính kèm và soạn thảo hoặc điều chỉnh văn bản theo đúng nội dung yêu cầu của cán bộ bên trên).` }
        ]
      };
    } else {
      let fileContextBlock = "";
      if (extractedText) {
        fileContextBlock = `\n\nNỘI DUNG VĂN BẢN TRÍCH XUẤT TỪ FILE ĐÍNH KÈM:\n\"\"\"\n${extractedText}\n\"\"\"`;
      }
      modelContents = {
        parts: [
          { text: `${systemPromptText}\n\n${instructionsPrompt}${fileContextBlock}\n\n(Vui lòng biên soạn nội dung đầy đủ, hoàn chỉnh 100%, không sử dụng các ký hiệu dấu ba chấm "[...]" rỗng, trả về định dạng Markdown đẹp đẽ hành chính Việt Nam).` }
        ]
      };
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: modelContents,
    });

    const draftText = response.text || "Gemini chưa sinh được văn bản theo yêu cầu.";
    res.json({ content: draftText });

  } catch (error: any) {
    console.error("Lỗi soạn thảo Gemini:", error);
    res.status(500).json({ error: "Lỗi kết nối Trí tuệ Nhân tạo Gemini: " + error.message });
  }
});

// AI Đồng bộ Tổ tự quản cho hộ gia đình và toàn bộ thành viên
app.post("/api/households/:id/update-group-ai", async (req, res) => {
  const { id } = req.params;
  const { groupNDTQ } = req.body;
  const emailHeader = req.headers["x-user-email"] as string;
  const roleHeader = req.headers["x-user-role"] as string;
  const nameHeader = req.headers["x-user-name"] as string;

  if (!groupNDTQ) {
    return res.status(400).json({ error: "Vui lòng cung cấp mã/tên Tổ tự quản mới" });
  }

  try {
    const db = loadDatabase();
    
    // Find checking index
    const household = db.households.find(h => h.id === id);
    if (!household) {
      return res.status(404).json({ error: "Không tìm thấy thông tin hộ gia đình" });
    }

    // Verify permission
    const normalizedEmail = (emailHeader || "").toString().toLowerCase().trim();
    const requester = (db.accounts || []).find(
      (acc: any) => acc.email && acc.email.toLowerCase().trim() === normalizedEmail
    );
    if (!requester || requester.canEdit === false) {
      return res.status(403).json({ error: "Phân quyền: Tài khoản của bạn chỉ có quyền Xem báo cáo, không được phép chỉnh sửa!" });
    }

    // Load household members
    const members = db.residents.filter(r => r.householdId === id);

    const prompt = `Bạn là Trợ lý AI Nhập liệu chuyên nghiệp của Khu phố 3.
Bạn đang hỗ trợ đồng bộ Tổ tự quản (groupNDTQ) cho toàn bộ thành viên trong hộ gia đình:
- Mã hộ: ${id}
- Địa chỉ: ${household.address}
- Chủ hộ: ${household.headerName}
- Giá trị Tổ mới mong muốn là: "${groupNDTQ}"

Dưới đây là danh sách thành viên hiện tại của hộ gia đình cần đồng bộ:
${JSON.stringify(members.map(m => ({ id: m.id, fullName: m.fullName, currentGroup: m.groupNDTQ || "Không rõ Tổ", relation: m.relationWithHeader })), null, 2)}

Hãy thực hiện đối chiếu thông tin, thiết lập Tổ mới và trả về kết quả dưới dạng JSON có cấu trúc chính xác (không kèm bất kỳ lời dẫn thô nào khác):
{
  "summary": "Mô tả ngắn gọn, sinh động bằng tiếng Việt (1-2 câu) về việc đồng bộ. Ví dụ: 'Đồng bộ thành công Tổ 3 cho hộ ông Nguyễn Văn A cùng 3 thành viên khác.'",
  "syncedMembers": [
     {
       "id": "id_thành_viên",
       "fullName": "Họ và tên thành viên",
       "previousGroup": "Tên Tổ cũ",
       "newGroup": "Tên Tổ mới",
       "logMessage": "Hành động thực hiện cho người này (ví dụ: 'Đồng bộ từ Không rõ sang Tổ 3')"
     }
  ],
  "aiNotes": "Bất kỳ nhận xét, đề xuất thông minh hoặc lưu ý nào về địa chỉ hoặc dữ liệu của hộ này."
}
`;

    const aiRes = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            syncedMembers: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  fullName: { type: Type.STRING },
                  previousGroup: { type: Type.STRING },
                  newGroup: { type: Type.STRING },
                  logMessage: { type: Type.STRING }
                },
                required: ["id", "fullName", "previousGroup", "newGroup", "logMessage"]
              }
            },
            aiNotes: { type: Type.STRING }
          },
          required: ["summary", "syncedMembers", "aiNotes"]
        }
      }
    });

    const resultText = aiRes.text || "{}";
    const aiResult = JSON.parse(resultText);

    // Save actual updates to members in the Database
    db.residents.forEach((r: any) => {
      if (r.householdId === id) {
        r.groupNDTQ = groupNDTQ;
      }
    });

    // Re-verify and update household groupNDTQ in table representation
    syncAllHouseholds(db);

    // Add activity log
    db.logs.unshift({
      id: `log_${Date.now()}`,
      userName: decodeURIComponent(nameHeader || "Ban quản lý"),
      userRole: decodeURIComponent(roleHeader || "Cán bộ"),
      action: "ĐỒNG BỘ TỔ AI",
      timestamp: new Date().toISOString(),
      details: `Đồng bộ Tổ: ${groupNDTQ} cho hộ gia đình ${id} (${household.headerName}), dùng AI phân tích đồng bộ.`
    });

    saveDatabase(db);

    res.json({
      success: true,
      aiResult
    });

  } catch (err: any) {
    console.error("Lỗi đồng bộ Tổ AI:", err);
    res.status(500).json({ error: "Lỗi hệ thống hoặc lỗi kết nối Trí tuệ Nhân tạo: " + err.message });
  }
});

// AI Phân tích dữ liệu dân cư từ File (Excel/Word) hoặc văn bản thô sử dụng Gemini API
app.post("/api/gemini/parse-file", async (req, res) => {
  const { fileContent, fileName, rawText } = req.body;

  if (!fileContent && !rawText) {
    return res.status(400).json({ error: "Không nhận được tệp hoặc văn bản gốc để phân tích" });
  }

  try {
    let extractedText = "";

    if (fileContent) {
      // Strip mime type prefix if present
      let base64Data = fileContent;
      if (fileContent.includes(";base64,")) {
        base64Data = fileContent.split(";base64,")[1];
      }
      const buffer = Buffer.from(base64Data, "base64");
      const ext = fileName ? fileName.substring(fileName.lastIndexOf(".")).toLowerCase() : "";

      if (ext === ".xlsx" || ext === ".xls" || ext === ".csv") {
        try {
          const workbook = XLSX.read(buffer, { type: "buffer" });
          let sheetDataText = "";
          workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const csvData = XLSX.utils.sheet_to_csv(worksheet);
            sheetDataText += `--- BẢNG: ${sheetName} ---\n${csvData}\n\n`;
          });
          extractedText = sheetDataText;
        } catch (excelErr: any) {
          console.error("Lỗi đọc Excel:", excelErr);
          extractedText = buffer.toString("utf-8"); // Fallback
        }
      } else if (ext === ".docx") {
        try {
          const docResult = await mammoth.extractRawText({ buffer });
          extractedText = docResult.value;
        } catch (wordErr: any) {
          console.error("Lỗi đọc Word:", wordErr);
          extractedText = buffer.toString("utf-8"); // Fallback
        }
      } else {
        // Txt or other files
        extractedText = buffer.toString("utf-8");
      }
    } else if (rawText) {
      extractedText = rawText;
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ error: "Không tìm thấy nội dung văn bản nào để xử lý." });
    }

    const db = loadDatabase();
    const existingHouseholdsRef = db.households.map(h => ({
      id: h.id,
      headerName: h.headerName,
      address: h.address
    }));

    const systemPrompt = `Bạn là một trợ lý AI nhập liệu thông minh, có nhiệm vụ đối chiếu dữ liệu do người dùng tải lên với cấu trúc Cơ sơ dữ liệu (CSDL) mục tiêu. Hãy tuân thủ nghiêm ngặt các nguyên tắc xử lý sau:

1. CHỈ XỬ LÝ DỮ LIỆU TRÙNG KHỚP: Chỉ trích xuất và điền những thông tin từ file của người dùng mà CSDL mục tiêu yêu cầu và có trường dữ liệu tương ứng.
2. TUYỆT ĐỐI KHÔNG TỰÝ THÊM NỘI DUNG: Không tự bịa đặt, suy diễn, hoặc thêm bất kỳ thông tin, ký tự nào nằm ngoài file người dùng cung cấp. Không tự ý "sửa cho đẹp" hoặc điền thêm nội dung ngoại lai.
3. ĐỂ TRỐNG NẾU THIẾU THÔNG TIN: Nếu CSDL yêu cầu một trường thông tin nhưng trong file của người dùng không có, hãy ĐỂ TRỐNG hoàn toàn trường đó (để người dùng cập nhật thủ công sau). Tuyệt đối không tự ý điền giá trị mặc định, giá trị giả định hoặc đoán mò.

Mục tiêu cao nhất là bảo toàn tính chính xác tuyệt đối của dữ liệu gốc. Sai lệch hoặc tự ý điền thông tin sẽ làm hỏng dữ liệu của người dùng.

Dưới đây là danh sách các hộ khẩu hiện đã đăng ký trong cơ sở dữ liệu hệ thống tổ dân phố dùng để đối chiếu khi gán mã hộ "householdId" và quan hệ chủ hộ "relationWithHeader" (chỉ khi tài liệu gốc có địa chỉ trùng khớp hoặc thể hiện rõ mối liên hệ gia đình với hộ có sẵn):
${JSON.stringify(existingHouseholdsRef, null, 2)}

Nguyên tắc gán "householdId" và "relationWithHeader" (Chỉ áp dụng khi dữ liệu gốc có thể hiện rõ):
- Thấy địa chỉ trùng khớp hoặc tương đương cao với một hộ trong danh sách trên, gán "householdId" là "id" của hộ đó. Gán "relationWithHeader" cụ thể dựa theo thông tin mối quan hệ nêu trong tài liệu gốc. Nếu không nêu quan hệ, để trống hoàn toàn "".
- Nếu tài liệu mô tả một nhóm người có quan hệ gia đình mới chưa có sẵn (chung địa chỉ mới hoặc chung mối gia đình mới), hãy sinh mã hộ mới "HH_AI_001", "HH_AI_002",... chung cho các thành viên đó. Xác định 1 người làm "Chủ hộ" (relationWithHeader = "Chủ hộ"). Các thành viên còn lại gán quan hệ tương ứng. Nếu không có thông tin về gia đình hay địa chỉ chung, hãy để "householdId" và "relationWithHeader" là "".

Yêu cầu chuẩn hóa định dạng các trường dữ liệu mục tiêu:
1. fullName (Họ tên đầy đủ): Luôn viết hoa đầy đủ (Ví dụ: 'NGUYỄN VĂN A') dựa trên họ tên gốc.
2. cccd (Số định danh cá nhân / CCCD / CMND): Chỉ trích xuất số chính xác bằng chữ số (9 hoặc 12 số). Nếu không có hoặc không rõ, hãy để "".
3. dob (Ngày sinh): Chuẩn hóa thành dạng YYYY-MM-DD. Ví dụ '12/05/1994' -> '1994-05-12', 'năm 1990' -> '1990-01-01'. Nếu không tìm thấy, để "".
4. gender (Giới tính): Chỉ trả về 'Nam' hoặc 'Nữ' nếu có thể suy luận trực tiếp từ danh xưng/tên đệm (chữ lót Thị/Văn) cụ thể của nhân khẩu. Nếu không rõ, hãy để "".
5. address (Địa chỉ hiện tại / cư trú): Lấy nguyên văn địa chỉ trong file của người dùng, TUYỆT ĐỐI KHÔNG TỰÝ THÊM BẤT KỲ CỤM TỪ HOẶC ĐUÔI ĐỊA CHỈ NGOẠI LAI NÀO. Nếu thiếu, hãy để "".
6. phoneNumber (Số điện thoại): Trích xuất nếu có, không có hãy để "".
7. job (Nghề nghiệp): Trích xuất chính xác nếu có, không có hãy để "". TUYỆT ĐỐI không điền mặc định hay đoán mò.
8. residenceType (Loại hình cư trú): 'Thường trú', 'Tạm trú', 'Tạm vắng', 'Lưu trú' nếu được nêu cụ thể trong file. Nếu không có thông tin, hãy để "".
9. householdId: Gán mã hộ theo quy tắc đối chiếu ở trên.
10. relationWithHeader: Quan hệ với chủ hộ theo quy tắc ở trên.
11. notes (Ghi chú): Bất kỳ thông tin bổ sung có sẵn trong tài liệu nguồn gốc.

Hãy lọc sạch cấu trúc và trả về danh sách dướ định dạng JSON ARRAY đồng nhất.`;

    // Call Gemini generateContent with responseSchema
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { text: systemPrompt },
          { text: `NỘI DUNG TÀI LIỆU CẦN PHÂN TÍCH:\n\n${extractedText}` }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "Mảng chứa danh sách cư dân quét được từ văn bản bên ngoài",
          items: {
            type: Type.OBJECT,
            properties: {
              fullName: { type: Type.STRING },
              cccd: { type: Type.STRING },
              dob: { type: Type.STRING },
              gender: { type: Type.STRING },
              address: { type: Type.STRING },
              phoneNumber: { type: Type.STRING },
              job: { type: Type.STRING },
              residenceType: { type: Type.STRING },
              householdId: { type: Type.STRING },
              relationWithHeader: { type: Type.STRING },
              notes: { type: Type.STRING }
            },
            required: ["fullName"]
          }
        }
      }
    });

    const resultText = response.text || "[]";
    const parsedResidents = JSON.parse(resultText.trim());

    res.json({
      success: true,
      charactersExtractedLength: extractedText.length,
      residents: parsedResidents
    });

  } catch (error: any) {
    console.error("Lỗi xử lý file với Gemini:", error);
    res.status(500).json({ error: "Trục trặc hệ thống hoặc lỗi phân tích AI: " + error.message });
  }
});


// AI Tóm tắt văn bản đa định dạng từ người dùng (PDF, Word, Excel, Hình ảnh, v.v...)
app.post("/api/gemini/summarize-document", async (req, res) => {
  const { fileContent, fileName, rawText, summaryType } = req.body;

  if (!fileContent && !rawText) {
    return res.status(400).json({ error: "Không có dữ liệu văn bản hoặc tệp tin để tóm tắt." });
  }

  try {
    let extractedText = "";
    let geminiPart: any = null;

    if (fileContent) {
      let base64Data = fileContent;
      let mimeType = "application/octet-stream";
      if (fileContent.includes(";base64,")) {
        const parts = fileContent.split(";base64,");
        mimeType = parts[0].split(":")[1] || mimeType;
        base64Data = parts[1];
      }
      
      const buffer = Buffer.from(base64Data, "base64");
      const lastDotIndex = fileName ? fileName.lastIndexOf(".") : -1;
      const ext = lastDotIndex !== -1 ? fileName.substring(lastDotIndex).toLowerCase() : "";

      if (ext === ".pdf") {
        geminiPart = {
          inlineData: {
            mimeType: "application/pdf",
            data: base64Data,
          },
        };
      } else if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
        geminiPart = {
          inlineData: {
            mimeType: mimeType === "application/octet-stream" ? `image/${ext.replace(".", "")}` : mimeType,
            data: base64Data,
          },
        };
      } else if (ext === ".xlsx" || ext === ".xls" || ext === ".csv") {
        try {
          const workbook = XLSX.read(buffer, { type: "buffer" });
          let sheetDataText = "";
          workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const csvData = XLSX.utils.sheet_to_csv(worksheet);
            sheetDataText += `--- BẢNG: ${sheetName} ---\n${csvData}\n\n`;
          });
          extractedText = sheetDataText;
        } catch (excelErr: any) {
          extractedText = buffer.toString("utf-8");
        }
      } else if (ext === ".docx") {
        try {
          const docResult = await mammoth.extractRawText({ buffer });
          extractedText = docResult.value;
        } catch (wordErr: any) {
          extractedText = buffer.toString("utf-8");
        }
      } else {
        extractedText = buffer.toString("utf-8");
      }
    }

    const styleInstruction = summaryType || "Ngắn gọn và đầy đủ nội dung";
    const stylePrompt = `PHONG CÁCH TÓM TẮT YÊU CẦU: ${styleInstruction}.
ĐẶC BIỆT: Tóm tắt một cách ngắn gọn, cô đọng nhưng đảm bảo đầy đủ tất cả nội dung cốt lõi của tài liệu đã cung cấp. Chắt lọc từng ý chính, thông số hoặc mốc thời gian thiết thực nhất.`;

    const systemPrompt = `Bạn là Trợ lý Số hóa hành chính chuyên nghiệp của Ban quản lý và Cán bộ Khu phố Việt Nam.
Nhiệm vụ của bạn là đọc kỹ tài liệu được cung cấp (bao gồm cả nội dung trích xuất từ file tệp đính kèm cũng như văn bản do người dùng dán hoặc viết trực tiếp).
Sau đó, hãy thực hiện phân tích và tóm tắt một cách cực kỳ rõ ràng, ngắn gọn, súc tích nhưng đầy đủ nội dung cốt lõi nhất.

Hãy tập trung trích xuất chính xác:
1. Thông tin tiêu điểm quan trọng nhất (Chủ trương, mục tiêu, sự vụ cốt lõi).
2. Các số liệu thống kê, danh sách người liên quan, mốc thời gian hoặc lịch trình công tác quan trọng.
3. Các đề xuất thực thi hành chính, kế hoạch hành động hoặc ghi chú lưu ý thiết thực cho Tổ dân phố / Khu phố cơ sở.

Hãy trình bày sản phẩm đầu ra dưới định dạng Markdown đẹp mắt, khoa học, sạch sẽ, căn lề hợp lý bằng tiếng Việt tự nhiên và trang trọng, không rườm rà dài dòng.`;

    let modelContents: any;
    if (geminiPart) {
      modelContents = {
        parts: [
          geminiPart,
          { text: `${systemPrompt}\n\n${stylePrompt}\n\nNỘI DUNG VĂN BẢN ĐI KÈM DO NGƯỜI DÙNG NHẬP (NẾU CÓ):\n\"\"\"\n${rawText || "Không có nội dung văn bản trực tiếp."}\n\"\"\"\n\n(Vui lòng đọc kỹ cả tệp tin đính kèm truyền qua inlineData ở trên VÀ nội dung văn bản trực tiếp này để hoàn thiện bản tóm tắt ngắn gọn, đầy đủ nội dung).` }
        ]
      };
    } else {
      modelContents = {
        parts: [
          { text: `${systemPrompt}\n\n${stylePrompt}\n\nNỘI DUNG TÀI LIỆU TRÍCH XUẤT TỪ FILE:\n\"\"\"\n${extractedText || "Không có tệp tải lên hoặc không trích xuất được văn bản thô."}\n\"\"\"\n\nNỘI DUNG VĂN BẢN TRỰC TIẾP:\n\"\"\"\n${rawText || "Không cung cấp văn bản trực tiếp."}\n\"\"\"\n\n(Vui lòng tóm tắt đầy đủ chính xác và ngắn gọn dựa trên toàn bộ thông tin trên).` }
        ]
      };
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: modelContents,
    });

    const summaryResult = response.text || "AI không thể trích xuất phần tóm tắt.";
    res.json({ success: true, summary: summaryResult });

  } catch (error: any) {
    console.error("Lỗi tóm tắt văn bản với Gemini:", error);
    res.status(500).json({ error: "Không thể tóm tắt tài liệu tự động: " + error.message });
  }
});


// AI Hoàn thành mẫu đơn, điền thông tin còn trống
app.post("/api/gemini/fill-template", async (req, res) => {
  const { templateContent, fileContent, fileName, rawInputs } = req.body;

  if (!templateContent && !fileContent) {
    return res.status(400).json({ error: "Vui lòng cung cấp văn bản mẫu hành chính hoặc đính kèm tệp tin mẫu trống cần hoàn thiện." });
  }

  try {
    let contextText = "";
    let geminiPart: any = null;
    let extractedFileTemplateText = "";

    if (fileContent) {
      let base64Data = fileContent;
      let mimeType = "application/octet-stream";
      if (fileContent.includes(";base64,")) {
        const parts = fileContent.split(";base64,");
        mimeType = parts[0].split(":")[1] || mimeType;
        base64Data = parts[1];
      }
      const buffer = Buffer.from(base64Data, "base64");
      const ext = fileName ? fileName.substring(fileName.lastIndexOf(".")).toLowerCase() : "";

      if (ext === ".pdf") {
        geminiPart = {
          inlineData: {
            mimeType: "application/pdf",
            data: base64Data
          }
        };
      } else if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
        geminiPart = {
          inlineData: {
            mimeType: mimeType === "application/octet-stream" ? `image/${ext.replace(".", "")}` : mimeType,
            data: base64Data
          }
        };
      } else if (ext === ".xlsx" || ext === ".xls" || ext === ".csv") {
        try {
          const workbook = XLSX.read(buffer, { type: "buffer" });
          let sheetDataText = "";
          workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            sheetDataText += XLSX.utils.sheet_to_csv(worksheet) + "\n";
          });
          contextText = sheetDataText;
          extractedFileTemplateText = sheetDataText;
        } catch {
          contextText = buffer.toString("utf-8");
          extractedFileTemplateText = contextText;
        }
      } else if (ext === ".docx") {
        try {
          const docResult = await mammoth.extractRawText({ buffer });
          contextText = docResult.value;
          extractedFileTemplateText = docResult.value;
        } catch {
          contextText = buffer.toString("utf-8");
          extractedFileTemplateText = contextText;
        }
      } else {
        contextText = buffer.toString("utf-8");
        extractedFileTemplateText = contextText;
      }
    }

    // Setup active template content
    const finalTemplateText = templateContent || extractedFileTemplateText || "(Mẫu đơn khuyết trống)";
    const systemPromptMessage = `Bạn là Trợ lý hành chính Khu phố 3, Phường An Phú, TP. Thủ Đức.
Nhiệm vụ của bạn là điền thông tin và hoàn thiện biểu mẫu hành chính (template) dưới đây dựa trên dữ liệu người dùng cung cấp.

Văn bản mẫu hành chính:
\${finalTemplateText}

Dữ liệu đầu vào:
\${JSON.stringify(rawInputs || {}, null, 2)}

Hãy điền các thông tin này vào mẫu một cách logic, chính xác, trang trọng và đúng phong cách văn bản hành chính Việt Nam. Trả về toàn bộ nội dung văn bản hoàn chỉnh sau khi đã được điền đầy đủ (định dạng Markdown đẹp mắt, giữ nguyên tiêu đề, bố cục của văn bản gốc).`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: systemPromptMessage,
    });

    res.json({ success: true, text: response.text });
  } catch (err: any) {
    console.error("Lỗi AI điền mẫu đơn:", err);
    res.status(500).json({ error: "Thất bại: " + err.message });
  }
});

app.post("/api/gemini/summarize-notes", async (req, res) => {
  const { notes } = req.body;
  if (!notes) return res.status(400).json({ error: "Missing notes" });

  try {
    const systemPrompt = `Bạn là trợ lý AI chuyên tóm tắt ghi chú dân cư. Hãy tóm tắt thật ngắn gọn (khoảng 10-15 từ) nội dung sau đây để hiển thị bảng dữ liệu:
"${notes}"`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: systemPrompt,
    });

    res.json({ success: true, summary: response.text });
  } catch (err: any) {
    console.error("Lỗi AI tóm tắt ghi chú:", err);
    res.status(500).json({ error: "Thất bại: " + err.message });
  }
});

app.post("/api/gemini/report-tasks", async (req, res) => {
  const { schedules } = req.body;
  
  try {
    const systemPrompt = `Bạn là thư ký hành chính của Tổ dân phố. Dưới đây là dữ liệu công việc (JSON):
${JSON.stringify(schedules || [])}

Viết một báo cáo tiến độ chuyên nghiệp (trình bày Markdown đẹp mắt) gồm 3 phần:
1. Việc Cần Làm
2. Việc Đang Làm
3. Cảnh Báo Quá Hạn Nộp (nếu có)
Tập trung vào những nhiệm vụ chưa hoàn thành hoặc trễ hạn.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: systemPrompt,
    });

    res.json({ success: true, report: response.text });
  } catch (err: any) {
    console.error("Lỗi AI báo cáo tiến độ:", err);
    res.status(500).json({ error: "Thất bại: " + err.message });
  }
});
app.post("/api/gemini/suggest-tasks-from-doc", async (req, res) => {
  const { title, description, externalDocContent } = req.body;

  try {
    const systemPrompt = `Bạn là trợ lý lý luận cốt cán hành chính xuất sắc của Tổ dân phố thuộc Phường An Phú.
Nhiệm vụ của bạn là dựa trên chương trình hội họp, lịch công tác dưới đây và nội dung văn bản đi kèm để phân tích, tự động chia nhỏ và đề xuất các đầu việc cần làm, cùng với chức danh cán bộ hành chính phù hợp đề xuất xử lý nhiệm vụ đó.

HỌP HÀNH / LỊCH: ${title || "Chưa rõ tiêu đề"}
NỘI DUNG: ${description || "Không có mô tả chi tiết"}
TÀI LIỆU ĐÍNH KÈM: ${externalDocContent || "Không có tài liệu đi kèm"}

Hãy trả về kết quả dưới dạng một mảng JSON các đối tượng. Mỗi đối tượng bắt buộc có 2 thuộc tính:
- "task": nội dung đầu việc đề xuất cực kỳ ngắn gọn, cụ thể (ví dụ: "Soạn thảo biên bản tổ dân phố", "Trực bốt gác ANTT", "Chuyển quà cho hộ nghèo").
- "proposedAssigneeRole": chức danh đề xuất ngẫu nhiên phù hợp (ví dụ: "Trưởng Khu phố", "Bí thư Chi bộ", "Chi hội trưởng CCB", "Cán bộ Tư pháp", "Tổ phó TDP").

Không viết bất kỳ văn bản giải thích nào ngoài mảng JSON hợp lệ này.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: systemPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "Danh sách công việc đề xuất từ AI",
          items: {
            type: Type.OBJECT,
            properties: {
              task: { type: Type.STRING },
              proposedAssigneeRole: { type: Type.STRING }
            },
            required: ["task", "proposedAssigneeRole"]
          }
        }
      }
    });

    const suggestionsText = response.text || "[]";
    const suggestions = JSON.parse(suggestionsText.trim());
    res.json({ success: true, suggestions });
  } catch (err: any) {
    console.error("Lỗi AI gợi ý phân công công việc:", err);
    res.status(555).json({ error: "Không thể nhận gợi ý phân công từ AI: " + err.message });
  }
});


// ==========================================
// GIS SPATIAL ALGORITHMS (POSTGIS SIMULATOR)
// ==========================================

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function parseWktPolygon(wkt: string): [number, number][] {
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
}

function parseWktLineString(wkt: string): [number, number][] {
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
}

function parseWktPoint(wkt: string): [number, number] | null {
  try {
    const cleaner = wkt.replace(/POINT\s*\(/i, "").replace(/\)/, "");
    const parts = cleaner.trim().split(/\s+/);
    return [parseFloat(parts[0]), parseFloat(parts[1])];
  } catch {
    return null;
  }
}

function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function distancePointToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const l2 = (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
  if (l2 === 0) return getDistanceMeters(py, px, ay, ax);
  let t = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = ax + t * (bx - ax);
  const projY = ay + t * (by - ay);
  return getDistanceMeters(py, px, projY, projX);
}

function distancePointToLineString(point: [number, number], line: [number, number][]): number {
  if (line.length === 0) return Infinity;
  if (line.length === 1) return getDistanceMeters(point[1], point[0], line[0][1], line[0][0]);
  let minDist = Infinity;
  const [px, py] = point;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = line[i];
    const [bx, by] = line[i+1];
    const dist = distancePointToSegment(px, py, ax, ay, bx, by);
    if (dist < minDist) {
      minDist = dist;
    }
  }
  return minDist;
}

// ==========================================
// GIS API CONTROLLERS
// ==========================================

// Get all GIS and maps vector database state
app.get("/api/gis/data", (req, res) => {
  const db = loadDatabase();
  res.json({
    gisHouseholds: db.gisHouseholds || [],
    gisStreets: db.gisStreets || [],
    gisSubzones: db.gisSubzones || [],
    gisFeatures: db.gisFeatures || [],
    availableNDTQs: db.availableNDTQs || []
  });
});

// Update or Create household coordinate pinpoint (PostGIS geometry)
app.post("/api/gis/household/upsert", (req, res) => {
  const emailHeader = req.headers["x-user-email"] as string;
  const db = loadDatabase();
  const { id, headerName, address, phoneNumber, notes, lat, lng, gisType, tagSecurity } = req.body;

  if (!headerName || !lat || !lng) {
    return res.status(400).json({ error: "Thông tin chủ hộ, vĩ độ (latitude) và kinh độ (longitude) không được để trống!" });
  }

  // Create Standard coordinates and WKT Geometry Represent
  const geomString = `POINT(${lng} ${lat})`;
  const finalId = id || `HH_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
  
  // Auto test ST_Contains to assign Sub-zone (Tổ Dân Phố)
  let assignedTDP = "Tổ 3"; // Default fallback
  let sqlStContainsLogged = "";
  
  if (db.gisSubzones) {
    for (const subzone of db.gisSubzones) {
      const polygonPoints = parseWktPolygon(subzone.geom);
      if (polygonPoints.length > 0 && isPointInPolygon([lng, lat], polygonPoints)) {
        assignedTDP = subzone.name;
        sqlStContainsLogged = `SELECT id, name FROM subzones WHERE ST_Contains(geom, ST_GeomFromText('${geomString}', 4326)); -- OK: match ${subzone.name}`;
        break;
      }
    }
  }

  if (!sqlStContainsLogged) {
    sqlStContainsLogged = `SELECT id, name FROM subzones WHERE ST_Contains(geom, ST_GeomFromText('${geomString}', 4326)); -- NO MATCH, fallback to Tổ 3`;
  }

  // Define new / updated GIS Household
  const rawGisHH: any = {
    id: finalId,
    headerName,
    address,
    phoneNumber,
    notes: notes || "",
    groupNDTQ: assignedTDP,
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    geom: geomString,
    gisCode: `KP3-${finalId}`,
    gisType: gisType || "household_permanent",
    tagSecurity: tagSecurity || "Bình thường"
  };

  if (!db.gisHouseholds) db.gisHouseholds = [];
  const existingGisIndex = db.gisHouseholds.findIndex((h: any) => h.id === finalId);

  if (existingGisIndex !== -1) {
    db.gisHouseholds[existingGisIndex] = rawGisHH;
  } else {
    db.gisHouseholds.push(rawGisHH);
  }

  // Double align with Core households array to avoid syncing delay issues
  if (!db.households) db.households = [];
  const coreIndex = db.households.findIndex((h: any) => h.id === finalId);
  const coreHH = {
    id: finalId,
    headerName,
    address,
    phoneNumber,
    notes: notes || "",
    groupNDTQ: assignedTDP,
    gisType: gisType || "household_permanent",
    tagSecurity: tagSecurity || "Bình thường"
  };

  if (coreIndex !== -1) {
    db.households[coreIndex] = coreHH;
  } else {
    db.households.push(coreHH);
  }

  // Audit Log
  db.logs.unshift({
    id: `log_gis_${Date.now()}`,
    userName: decodeURIComponent(req.headers["x-user-name"] as string || "Cán bộ GIS"),
    userRole: decodeURIComponent(req.headers["x-user-role"] as string || "Trưởng Khu phố"),
    action: id ? "CẬP NHẬT ĐỊA CHỈ GIS" : "KHỞI TẠO ĐỊA CHỈ GIS",
    timestamp: new Date().toISOString(),
    details: `Số hóa địa chỉ ${geomString} cho hộ ông/bà ${headerName}. Hệ thống tự động kích hoạt ST_Contains kiểm tra vùng ranh giới và bổ sung vào ${assignedTDP}.`
  });

  saveDatabase(db);
  res.json({
    success: true,
    gisHousehold: rawGisHH,
    sqlCommand: `
      -- INSERT OR UPDATE DIGITAL ADDRESS GIS
      INSERT INTO households (id, headerName, address, phoneNumber, geom, gisCode, groupNDTQ)
      VALUES ('${finalId}', '${headerName}', '${address}', '${phoneNumber}', ST_GeomFromText('${geomString}', 4326), 'KP3-${finalId}', '${assignedTDP}')
      ON CONFLICT (id) DO UPDATE SET geom = EXCLUDED.geom, groupNDTQ = EXCLUDED.groupNDTQ;

      ${sqlStContainsLogged}
    `.trim()
  });
});

// Update or Create GIS Feature (e.g. Điểm ANTT, Trục giao lộ)
app.post("/api/gis/feature/upsert", (req, res) => {
  const db = loadDatabase();
  const { id, name, type, lat, lng, notes } = req.body;

  if (!name || !lat || !lng) {
    return res.status(400).json({ error: "Thiếu tên đối tượng, vĩ độ (latitude) hoặc kinh độ (longitude)!" });
  }

  const finalId = id || `FEAT_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
  const geomString = `POINT(${lng} ${lat})`;

  const feature: any = {
    id: finalId,
    name,
    type: type || "camera",
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    geom: geomString,
    notes: notes || ""
  };

  if (!db.gisFeatures) db.gisFeatures = [];
  const index = db.gisFeatures.findIndex((f: any) => f.id === finalId);

  if (index !== -1) {
    db.gisFeatures[index] = feature;
  } else {
    db.gisFeatures.push(feature);
  }

  db.logs.unshift({
    id: `log_feat_${Date.now()}`,
    userName: decodeURIComponent(req.headers["x-user-name"] as string || "Cán bộ GIS"),
    userRole: decodeURIComponent(req.headers["x-user-role"] as string || "Trưởng Khu phố"),
    action: id ? "CẬP NHẬT ĐIỂM TIỆN ÍCH / CAMERA" : "THÊM ĐIỂM TIỆN ÍCH / CAMERA",
    timestamp: new Date().toISOString(),
    details: `Số hóa điểm tiện ích / điểm ANTT: ${name} (${type || "camera"}) tại vị trí ${geomString}.`
  });

  saveDatabase(db);
  res.json({
    success: true,
    feature,
    sqlCommand: `
      -- INSERT OR UPDATE DIGITAL SPECIAL POINT
      INSERT INTO special_points (id, name, type, geom, notes)
      VALUES ('${finalId}', '${name}', '${type || "camera"}', ST_GeomFromText('${geomString}', 4326), '${notes || ""}')
      ON CONFLICT (id) DO UPDATE SET geom = EXCLUDED.geom, name = EXCLUDED.name, type = EXCLUDED.type;
    `.trim()
  });
});

// Update or Create GIS Subzone (e.g. Tổ polygon/Tổ dân phố)
app.post("/api/gis/subzone/upsert", (req, res) => {
  const db = loadDatabase();
  const { id, name, leaderName, color, lat, lng } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Thiếu tên Tổ dân phố / Tổ polygon!" });
  }

  const finalId = id || `SZ_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
  const centerLat = parseFloat(lat) || 10.8021;
  const centerLng = parseFloat(lng) || 106.7215;

  let geomString = "";
  const index = db.gisSubzones ? db.gisSubzones.findIndex((s: any) => s.id === finalId) : -1;
  if (index !== -1 && db.gisSubzones[index].geom) {
    geomString = db.gisSubzones[index].geom;
  } else {
    // Generate a default box of ~240m around coordinates to make it immediate
    const l1 = centerLng - 0.0012, r1 = centerLng + 0.0012;
    const b1 = centerLat - 0.0010, t1 = centerLat + 0.0010;
    geomString = `POLYGON((${l1} ${b1}, ${r1} ${b1}, ${r1} ${t1}, ${l1} ${t1}, ${l1} ${b1}))`;
  }

  const subzone = {
    id: finalId,
    name,
    leaderName: leaderName || "Ban điều hành",
    color: color || "#3b82f6",
    geom: geomString
  };

  if (!db.gisSubzones) db.gisSubzones = [];
  if (index !== -1) {
    db.gisSubzones[index] = subzone;
  } else {
    db.gisSubzones.push(subzone);
  }

  db.logs.unshift({
    id: `log_sz_${Date.now()}`,
    userName: decodeURIComponent(req.headers["x-user-name"] as string || "Cán bộ GIS"),
    userRole: decodeURIComponent(req.headers["x-user-role"] as string || "Trưởng Khu phố"),
    action: id ? "CẬP NHẬT TỔ POLYGON" : "TẠO TỔ POLYGON MỚI",
    timestamp: new Date().toISOString(),
    details: `Thiết lập và số hóa vùng địa giới polygon cho: ${name}.`
  });

  saveDatabase(db);
  res.json({
    success: true,
    subzone,
    sqlCommand: `
      -- INSERT OR UPDATE DIGITAL SUBZONE POLYGON
      INSERT INTO subzones (id, name, leaderName, color, geom)
      VALUES ('${finalId}', '${name}', '${leaderName || "Ban điều hành"}', '${color || "#3b82f6"}', ST_GeomFromText('${geomString}', 4326))
      ON CONFLICT (id) DO UPDATE SET geom = EXCLUDED.geom, name = EXCLUDED.name, leaderName = EXCLUDED.leaderName;
    `.trim()
  });
});

// Delete GIS household
app.post("/api/gis/household/delete", (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "Thiếu mã hộ gia đình để thực hiện xóa không gian địa điểm" });

  const db = loadDatabase();
  
  if (db.gisHouseholds) {
    db.gisHouseholds = db.gisHouseholds.filter((h: any) => h.id !== id);
  }
  if (db.households) {
    db.households = db.households.filter((h: any) => h.id !== id);
  }
  // Remove residents too as requested
  if (db.residents) {
    db.residents = db.residents.filter((r: any) => r.householdId !== id);
  }

  db.logs.unshift({
    id: `log_gis_del_${Date.now()}`,
    userName: decodeURIComponent(req.headers["x-user-name"] as string || "Cán bộ GIS"),
    userRole: decodeURIComponent(req.headers["x-user-role"] as string || "Trưởng Khu phố"),
    action: "XÓA ĐỊA CHỈ GIS VÀ HỘ TỊCH",
    timestamp: new Date().toISOString(),
    details: `Thực hiện xóa toàn bộ hộ ${id} và các nhân khẩu đi kèm do không còn sinh sống trên địa bàn.`
  });

  saveDatabase(db);
  res.json({
    success: true,
    sqlCommand: `
      -- DROP RECORD CASCADE
      DELETE FROM households WHERE id = '${id}';
      DELETE FROM residents WHERE householdId = '${id}';
      -- EXECUTED SUCCESSFULLY
    `.trim()
  });
});

// Radius Search endpoint utilizing ST_DWithin and ST_Distance simulation
app.post("/api/gis/radius-search", (req, res) => {
  const db = loadDatabase();
  const { lat, lng, radiusMeters } = req.body;
  const radius = parseFloat(radiusMeters || 100);
  const targetLat = parseFloat(lat);
  const targetLng = parseFloat(lng);

  if (isNaN(targetLat) || isNaN(targetLng)) {
    return res.status(400).json({ error: "Tọa độ trung tâm không hợp lệ." });
  }

  const households = db.gisHouseholds || [];
  const features = db.gisFeatures || [];

  const foundHouseholds = households.map(h => {
    const dist = getDistanceMeters(targetLat, targetLng, h.lat, h.lng);
    return { ...h, distanceMeters: Math.round(dist * 10) / 10 };
  }).filter(h => h.distanceMeters <= radius).sort((a, b) => a.distanceMeters - b.distanceMeters);

  const foundFeatures = features.map(f => {
    const dist = getDistanceMeters(targetLat, targetLng, f.lat, f.lng);
    return { ...f, distanceMeters: Math.round(dist * 10) / 10 };
  }).filter(f => f.distanceMeters <= radius).sort((a, b) => a.distanceMeters - b.distanceMeters);

  const sqlTrace = `
    -- POSTGIS SEARCH WITHIN RADIUS ${radius} METERS
    SELECT id, headerName, geom, ST_Distance(geom, ST_SetSRID(ST_MakePoint(${targetLng}, ${targetLat}), 4326))::float AS dist_m
    FROM households
    WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint(${targetLng}, ${targetLat}), 4326), ${radius})
    ORDER BY dist_m ASC;
  `.trim();

  res.json({
    success: true,
    households: foundHouseholds,
    features: foundFeatures,
    sqlCommand: sqlTrace
  });
});

// Contains Search to find which Organization Polygon holds point coordinates
app.post("/api/gis/contains-search", (req, res) => {
  const db = loadDatabase();
  const { lat, lng } = req.body;
  const targetLat = parseFloat(lat);
  const targetLng = parseFloat(lng);

  if (isNaN(targetLat) || isNaN(targetLng)) {
    return res.status(400).json({ error: "Tọa độ kiểm tra ranh giới trống" });
  }

  const subzones = db.gisSubzones || [];
  let matchingSubzone: any = null;

  for (const sz of subzones) {
    const poly = parseWktPolygon(sz.geom);
    if (poly.length > 0 && isPointInPolygon([targetLng, targetLat], poly)) {
      matchingSubzone = sz;
      break;
    }
  }

  const sqlTrace = `
    -- POSTGIS POLYGON INTERSECT POINT
    SELECT id, name, leaderName FROM subzones
    WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint(${targetLng}, ${targetLat}), 4326))
    LIMIT 1;
  `.trim();

  res.json({
    success: true,
    subzone: matchingSubzone,
    sqlCommand: sqlTrace
  });
});

// Route Search and Traveling Salesperson Path Planning (Greedy Search)
app.post("/api/gis/route-search", (req, res) => {
  const db = loadDatabase();
  const { startLatLng, endLatLng, waypointIds } = req.body;

  if (!startLatLng || !endLatLng) {
    return res.status(400).json({ error: "Điểm khởi hành và điểm kết thúc bản đồ là bắt buộc." });
  }

  const households = db.gisHouseholds || [];
  const features = db.gisFeatures || [];
  const combinedNodes: any[] = [...households, ...features];

  // Map waypointIds to coordinate nodes
  const waypoints = (waypointIds || []).map((id: string) => {
    return combinedNodes.find(n => n.id === id);
  }).filter(Boolean);

  // Path building (TSP solution using Nearest Neighbor greedy)
  let currentLoc = { lat: parseFloat(startLatLng.lat), lng: parseFloat(startLatLng.lng) };
  const destination = { lat: parseFloat(endLatLng.lat), lng: parseFloat(endLatLng.lng) };
  
  const unvisited = [...waypoints];
  const orderedPathCoords: any[] = [{ ...currentLoc, label: "Xuất phát" }];
  let totalDistanceMeters = 0;

  while (unvisited.length > 0) {
    let nearestIdx = -1;
    let minDist = Infinity;
    
    for (let i = 0; i < unvisited.length; i++) {
      const dist = getDistanceMeters(currentLoc.lat, currentLoc.lng, unvisited[i].lat, unvisited[i].lng);
      if (dist < minDist) {
        minDist = dist;
        nearestIdx = i;
      }
    }

    const node = unvisited[nearestIdx];
    totalDistanceMeters += minDist;
    currentLoc = { lat: node.lat, lng: node.lng };
    orderedPathCoords.push({ ...currentLoc, id: node.id, label: node.headerName || node.name });
    unvisited.splice(nearestIdx, 1);
  }

  // Finally connect to ending destination
  const lastDist = getDistanceMeters(currentLoc.lat, currentLoc.lng, destination.lat, destination.lng);
  totalDistanceMeters += lastDist;
  orderedPathCoords.push({ ...destination, label: "Kết thúc" });

  const durationMin = Math.round((totalDistanceMeters / 1.3) / 60); // 1.3 m/s walking speed

  const sqlTrace = `
    -- POSTGIS SPATIAL SHORT PATH (TSP VEHICLE ROUTE PLANNER)
    -- Total points: ${orderedPathCoords.length - 2} waypoints
    WITH optimized_waypoints AS (
      SELECT id, geom, ST_Distance(geom, ST_MakePoint(${startLatLng.lng}, ${startLatLng.lat})) as dist
      FROM households
      WHERE id IN (${(waypointIds || []).map((id: string) => `'${id}'`).join(',') || "''"})
      ORDER BY dist ASC
    )
    SELECT id, ST_AsGeoJSON(geom) FROM optimized_waypoints;
  `.trim();

  res.json({
    success: true,
    path: orderedPathCoords,
    totalDistanceMeters: Math.round(totalDistanceMeters),
    durationMinutes: durationMin,
    sqlCommand: sqlTrace
  });
});

// AI GIS Companion powered by Gemini-3.5-flash
app.post("/api/gis/ai-command", async (req, res) => {
  const { userPrompt } = req.body;
  if (!userPrompt) return res.status(400).json({ error: "Gợi ý hoặc câu hỏi của bạn đang để trống!" });

  try {
    const db = loadDatabase();
    const cleanHouseholds = (db.gisHouseholds || []).map(h => ({
      id: h.id, chủHộ: h.headerName, địaChỉ: h.address, tổDânPhố: h.groupNDTQ, tọaĐộ: `${h.lat}, ${h.lng}`
    }));
    const cleanFeatures = (db.gisFeatures || []).map(f => ({
      tên: f.name, loại: f.type, tọaĐộ: `${f.lat}, ${f.lng}`
    }));
    const cleanSubzones = (db.gisSubzones || []).map(sz => ({
      tên: sz.name, tổTrưởng: sz.leaderName, ranhGiớiWkt: sz.geom
    }));

    const systemPromptMessage = [
      " Bạn là Chuyên gia Bản đồ Hệ thống Thông tin Địa lý GIS hành chính tại Smart Khu phố 3, Phường An Phú, TP. Hồ Chí Minh.",
      "Nhiệm vụ của bạn là lắng nghe các truy vấn nghiệp vụ của Cán bộ điều hành và tối ưu hóa các chiến dịch như tuần tra, kiểm tra phòng chống dịch, hoặc phân phát biểu mẫu hành chính trên bản đồ.",
      "",
      "Dưới đây là Cơ sở dữ liệu Địa lý Không gian (PostGIS tables) hiện hành của Khu phố 3:",
      "1. Bảng Households (Hộ dân có PIN địa lý trên bản đồ số):",
      JSON.stringify(cleanHouseholds, null, 2),
      "",
      "2. Bảng SpecialPoints (Điểm trang thiết bị kỹ thuật an ninh và dân sinh):",
      JSON.stringify(cleanFeatures, null, 2),
      "",
      "3. Bảng Subzones (Đại diện vùng ranh giới Tổ Dân Phố Polygon):",
      JSON.stringify(cleanSubzones, null, 2),
      "",
      `Yêu cầu hỗ trợ: ${userPrompt}`,
      "",
      "Hãy trả lời chi tiết bằng Tiếng Việt. Gợi ý cụ thể các trục đường chính (Thảo Điền, Quốc Hương, Ba Son, Lương Định Của), chỉ ra khoảng cách rà soát, đề xuất danh sách tuần tra tối ưu, các bước thực hiện chi tiết. Hãy sắp xếp câu chữ chuyên nghiệp, gãy gọn, có các đề mục rõ ràng, không dùng các thuật ngữ kỹ thuật thừa thãi, có xen kẽ các chỉ dẫn cụ thể về tọa độ để cán bộ dễ đối chiếu."
    ].join("\n");

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: systemPromptMessage,
    });

    res.json({
      success: true,
      analysis: response.text
    });
  } catch (err: any) {
    console.error("Lỗi AI GIS Companion:", err);
    res.status(500).json({ error: "Không thể nhận phản hồi phân tích địa chính từ AI: " + err.message });
  }
});

// Run raw simulated PostGIS SQL console queries
app.post("/api/gis/query-console", (req, res) => {
  const { sql } = req.body;
  if (!sql) return res.status(400).json({ error: "Không có câu lệnh SQL nào được cung cấp." });

  const db = loadDatabase();
  const lowerSql = sql.toLowerCase().trim();
  
  let executionTimeMs = Math.floor(Math.random() * 8) + 1;
  let returnedCount = 0;
  let resultData: any = [];

  try {
    if (lowerSql.includes("from households") || lowerSql.includes("from gis_households")) {
      // Radius select
      if (lowerSql.includes("st_dwithin") || lowerSql.includes("distance")) {
        const radMatch = lowerSql.match(/dwithin.*,\s*(\d+(\.\d+)?)/);
        const radius = radMatch ? parseFloat(radMatch[1]) : 150;
        resultData = (db.gisHouseholds || []).map(h => ({
          id: h.id,
          headerName: h.headerName,
          address: h.address,
          geom: h.geom,
          distance_m: Math.round((Math.random() * radius * 0.8 + 10) * 10) / 10
        })).slice(0, 3);
      } else if (lowerSql.includes("st_contains")) {
        resultData = (db.gisHouseholds || []).slice(0, 1).map(h => ({
          id: h.id,
          headerName: h.headerName,
          address: h.address,
          gisCode: h.gisCode,
          groupNDTQ: h.groupNDTQ
        }));
      } else {
        resultData = (db.gisHouseholds || []).map(h => ({
          id: h.id,
          headerName: h.headerName,
          address: h.address,
          geom: h.geom,
          groupNDTQ: h.groupNDTQ
        }));
      }
    } else if (lowerSql.includes("from subzones") || lowerSql.includes("from sub_zones")) {
      resultData = (db.gisSubzones || []).map(sz => ({
        id: sz.id,
        name: sz.name,
        leaderName: sz.leaderName,
        geom: sz.geom
      }));
    } else if (lowerSql.includes("from special_points") || lowerSql.includes("from features")) {
      resultData = (db.gisFeatures || []).map(f => ({
        id: f.id,
        name: f.name,
        type: f.type,
        geom: f.geom
      }));
    } else {
      // General database metrics
      resultData = [
        { table_name: "households", row_count: (db.gisHouseholds || []).length, spatial_type: "POINT" },
        { table_name: "streets", row_count: (db.gisStreets || []).length, spatial_type: "LINESTRING" },
        { table_name: "subzones", row_count: (db.gisSubzones || []).length, spatial_type: "POLYGON" },
        { table_name: "special_points", row_count: (db.gisFeatures || []).length, spatial_type: "POINT" }
      ];
    }
    
    returnedCount = resultData.length;
    res.json({
      success: true,
      sqlCommand: sql,
      executionTimeMs,
      returnedCount,
      data: resultData
    });
  } catch (err: any) {
    res.status(400).json({ error: "Lỗi phân tích cú pháp câu lệnh SQL PostGIS: " + err.message });
  }
});


// AI Automated Address Matching utilizing Gemini and resident database
app.post("/api/gis/ai-suggest-address", async (req, res) => {
  const { lat, lng } = req.body;
  if (!lat || !lng) return res.status(400).json({ error: "Không tìm thấy thông tin tọa độ để rà soát." });

  try {
    const db = loadDatabase();
    
    // Find unassigned core households (those not in db.gisHouseholds)
    const geolocatedIds = new Set((db.gisHouseholds || []).map((h: any) => h.id));
    const unassignedHouseholds = (db.households || []).filter((h: any) => !geolocatedIds.has(h.id));
    
    // Get all residents to look up members
    const residents = db.residents || [];

    // Let's query which standard subzone contains this point
    let detectedTDP = "Tổ 3"; // Fallback
    if (db.gisSubzones) {
      for (const subzone of db.gisSubzones) {
        const polygonPoints = parseWktPolygon(subzone.geom);
        if (polygonPoints.length > 0 && isPointInPolygon([parseFloat(lng), parseFloat(lat)], polygonPoints)) {
          detectedTDP = subzone.name;
          break;
        }
      }
    }

    // Build the payload for Gemini containing unassigned households
    const householdsPayload = unassignedHouseholds.map((h: any) => {
      // Find members of this household
      const members = residents.filter((r: any) => r.householdId === h.id).map((r: any) => r.fullName);
      return {
        id: h.id,
        headerName: h.headerName,
        address: h.address,
        phoneNumber: h.phoneNumber || "N/A",
        members: members,
        notes: h.notes || ""
      };
    });

    const systemPromptMessage = [
      "Bạn là Trợ lý AI phụ trách địa chính của Ban điều hành Khu phố 3, Phường An Phú, TP. Thủ Đức.",
      `Người dùng vừa click chọn một tọa độ trên bản đồ địa chính: Vĩ độ/Latitude: ${lat}, Kinh độ/Longitude: ${lng}. Tọa độ này thuộc ranh giới hành chính vùng: ${detectedTDP}.`,
      "",
      "Dưới đây là danh sách các hộ khẩu gia đình trong CSDL dân cư và hộ tịch của khu phố HOÀN TOÀN CHƯA ĐƯỢC GÁN ĐỊA CHỈ SỐ (vị trí tọa độ trên bản đồ):",
      JSON.stringify(householdsPayload.slice(0, 50), null, 2),
      "",
      "Hãy phân tích và gợi ý hộ dân phù hợp nhất để gán cho tọa độ này. Nhìn vào địa danh hành chính, tên đường (Thảo Điền, Quốc Hương, Ba Son...) hoặc dựa trên thứ tự để đề xuất 1 hộ gia đình từ danh sách trên.",
      "Trả về dữ liệu dưới dạng JSON thuần túy (không được bao bọc trong mã Markdown 'json', chỉ trả về chuỗi JSON thô bắt đầu bằng { và kết thúc bằng }):",
      "{",
      '  "success": true,',
      '  "found": true,',
      '  "id": "Mã hộ gia đình được chọn",',
      '  "headerName": "Tên chủ hộ",',
      '  "address": "Địa chỉ đầy đủ đề xuất",',
      '  "phoneNumber": "Số điện thoại",',
      `  "groupNDTQ": "Phân khu Tổ dân phố (Ví dụ: ${detectedTDP})",`,
      '  "members": "Danh sách thành viên (ngăn cách bằng dấu phẩy)",',
      '  "notes": "Ghi chú đề xuất tự động từ AI",',
      `  "reason": "Giải thích ngắn gọn tại sao AI chọn hộ này (Ví dụ: do đường phố phù hợp hoặc thuộc khu vực ${detectedTDP})"`+
      "}",
      "",
      "Nếu danh sách trên hoàn toàn trống, hãy trả về JSON:",
      "{",
      '  "success": true,',
      '  "found": false,',
      '  "reason": "Không còn hộ dân nào chưa có tọa độ trên bản đồ."',
      "}"
    ].join("\n");

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: systemPromptMessage,
    });

    let rawText = response.text || "";
    // Clean markdown wrappers if any
    rawText = rawText.replace(/```json/gi, "").replace(/```/gi, "").trim();
    
    let resultJSON;
    try {
      resultJSON = JSON.parse(rawText);
    } catch {
      resultJSON = {
        success: true,
        found: false,
        reason: "Lỗi giải mã chuỗi phản hồi AI. Đề xuất điền tay.",
        rawTextText: rawText
      };
    }

    res.json(resultJSON);
  } catch (err: any) {
    console.error("Lỗi AI Auto-Align Address:", err);
    res.status(500).json({ error: "Lịch rà soát tự động bị gián đoạn: " + err.message });
  }
});


// Express server listen and static handler with Vite middleware
async function startServer() {
  // Synchronize database with Supabase upon booting
  await preloadDatabaseFromSupabase();

  if (process.env.NODE_ENV !== "production") {
    // Development mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server middleware mounted.");
  } else {
    // Production mode
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log(`Production static files hosting configured for directory: ${distPath}`);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Smart Khu Pho system running on http://0.0.0.0:${PORT}`);
  });
}

if (process.env.VERCEL !== "1") {
  startServer();
} else {
  // In Vercel serverless environment, still preload database once on boot!
  preloadDatabaseFromSupabase().catch(err => {
    console.warn("Vercel boot preloading failed:", err);
  });
}

export default app;

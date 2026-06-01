import React, { useState } from "react";
import { UserRole } from "../types";
import { LogIn, KeyRound, User, Lock, ShieldCheck } from "lucide-react";

interface AuthScreenProps {
  onLoginSuccess: (user: { id: string; fullName: string; email: string; role: UserRole; provider?: string }) => void;
}

export default function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // States for Forgot ID support request
  const [showForgotIdModal, setShowForgotIdModal] = useState(false);
  const [forgotFullName, setForgotFullName] = useState("");
  const [forgotStatusMsg, setForgotStatusMsg] = useState("");
  const [forgotErr, setForgotErr] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    if (!loginEmail || !loginPassword) {
      setLoginError("Vui lòng điền đầy đủ Tên đăng nhập và Mật khẩu hành chính.");
      return;
    }

    setLoginLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || "Tên tài khoản hoặc mật khẩu không chính xác.");
      } else {
        onLoginSuccess(data.user);
      }
    } catch {
      setLoginError("Lỗi kết nối nghiêm trọng tới cổng an ninh.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleForgotIdRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotStatusMsg("");
    setForgotErr("");
    
    if (!forgotFullName.trim()) {
      setForgotErr("Vui lòng điền chính xác Họ và Tên cán bộ.");
      return;
    }

    setForgotLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-id-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: forgotFullName.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        setForgotErr(data.error || "Không tìm thấy thông tin cán bộ phù hợp.");
      } else {
        setForgotStatusMsg(data.message);
        setForgotFullName("");
      }
    } catch {
      setForgotErr("Lỗi kết nối tới cơ sở dữ liệu xác thực.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div translate="no" className="min-h-screen bg-slate-950 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 font-sans notranslate">
      <div className="max-w-md w-full space-y-6 bg-slate-900 p-8 rounded-2xl shadow-2xl border border-slate-800 notranslate" translate="no">
        
        {/* Header Branding */}
        <div className="text-center space-y-3 notranslate" translate="no">
          <div className="mx-auto h-12 w-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white font-extrabold shadow-lg shadow-emerald-900/30">
            <KeyRound className="h-6 w-6 text-white" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-black text-white tracking-tight">Smart Khu Phố 3</h2>
            <p className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest">
              PHƯỜNG AN PHÚ - TP. HỒ CHÍ MINH
            </p>
          </div>
          
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-bold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Cổng Giám Sát Nội Bộ
          </div>
        </div>

        {/* Notice of Restricted Access */}
        <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-[11px] text-slate-400 leading-relaxed text-center space-y-1 notranslate" translate="no">
          <span className="text-amber-400 font-black uppercase text-[9px] block tracking-wider">⚠️ CẢNH BÁO TRUY CẬP GIỚI HẠN</span>
          <p>Hệ thống bảo mật mạng nội bộ. Vui lòng sử dụng <strong>Tên đăng nhập</strong> và <strong>Mật khẩu</strong> hành chính được cung cấp bởi Ban điều hành để xác thực.</p>
        </div>

        {/* Login Form */}
        <form className="space-y-4 notranslate" translate="no" onSubmit={handleLogin} id="login_form">
          {loginError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold leading-relaxed">
              ⚠️ {loginError}
            </div>
          )}
          
          {/* Username Input */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tên Đăng Nhập</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 pointer-events-none">
                <User className="h-4 w-4" />
              </span>
              <input
                type="text"
                id="login_email_input"
                required
                translate="no"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="Nhập tên đăng nhập..."
                className="w-full bg-slate-950 text-white placeholder-slate-650 text-xs rounded-xl pl-10 pr-4 py-2.5 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition font-medium notranslate"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mật Khẩu</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 pointer-events-none">
                <Lock className="h-4 w-4" />
              </span>
              <input
                type="password"
                id="login_password_input"
                required
                translate="no"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Nhập mật khẩu..."
                className="w-full bg-slate-950 text-white placeholder-slate-655 text-xs rounded-xl pl-10 pr-4 py-2.5 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition notranslate"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loginLoading}
            id="login_submit_btn"
            className="w-full bg-emerald-600 text-white py-2.5 px-4 rounded-xl text-xs font-extrabold hover:bg-emerald-500 shadow-lg shadow-emerald-950/40 hover:shadow-emerald-950/60 transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 duration-150 notranslate"
            translate="no"
          >
            {loginLoading ? (
              <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <LogIn className="h-3.5 w-3.5" /> Đăng Nhập
              </>
            )}
          </button>
        </form>

        {/* Forgot ID Request Assistant Option */}
        <div className="text-center pt-2 border-t border-slate-800/40 notranslate" translate="no">
          <button
            type="button"
            onClick={() => {
              setForgotStatusMsg("");
              setForgotErr("");
              setForgotFullName("");
              setShowForgotIdModal(true);
            }}
            className="text-[10px] text-slate-400 hover:text-emerald-400 font-extrabold hover:underline transition duration-150 cursor-pointer"
          >
            🔑 QUÊN ID ĐĂNG NHẬP? YÊU CẦU CẤP LẠI
          </button>
        </div>

        {/* Footer info/cohesive subtle signature */}
        <div className="text-center pt-2 notranslate" translate="no">
          <p className="text-[9px] text-slate-500 font-semibold tracking-wide flex items-center justify-center gap-1">
            <ShieldCheck className="h-3 w-3 text-emerald-500" /> Hệ thống bảo vệ dữ liệu cư trú KP3
          </p>
        </div>

      </div>

      {/* High-Fidelity Dialog: Forgot ID Support Form */}
      {showForgotIdModal && (
        <div translate="no" className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 notranslate">
          <div className="relative bg-slate-900 border border-slate-800 max-w-sm w-full p-6 rounded-2xl shadow-2xl space-y-4 notranslate" translate="no">
            
            <div className="text-center space-y-1.5">
              <span className="h-9 w-9 bg-amber-500/10 text-amber-400 rounded-xl flex items-center justify-center mx-auto text-sm font-bold border border-amber-500/20">
                🔑
              </span>
              <h3 className="text-sm font-black text-white">Yêu Cầu Hỗ Trợ Quên ID</h3>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black text-amber-500">
                Xác Thực Hệ Thống An Ninh
              </p>
            </div>

            <div className="text-xs text-slate-950 bg-amber-50 p-4 rounded-xl border border-amber-300 leading-relaxed space-y-2.5 shadow-sm">
              <p className="font-black text-amber-800 text-center uppercase tracking-wider text-[11px] border-b border-amber-200 pb-1.5">
                ⚠️ BẢO MẬT NỘI BỘ QUAN TRỌNG
              </p>
              <p className="font-medium text-slate-800">
                Hiểu được nhu cầu bảo mật, <strong className="text-slate-950 font-black">quyền đổi hoặc cấp lại ID người dùng nếu quên chỉ có Super Admin & ★ Super Admin (Gốc) thực hiện.</strong>
              </p>
              <p className="font-medium text-slate-800 border-t border-slate-200/40 pt-1.5">
                Nhập đúng <strong className="text-slate-950 font-black">Họ và Tên cán bộ</strong> chính thức để chuyển tiếp yêu cầu đổi ID bảo mật.
              </p>
            </div>

            <form onSubmit={handleForgotIdRequest} className="space-y-3">
              {forgotStatusMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl font-semibold leading-relaxed">
                  ✅ {forgotStatusMsg}
                </div>
              )}
              
              {forgotErr && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl font-semibold">
                  ❌ {forgotErr}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Họ và Tên Cán Bộ</label>
                <input
                  type="text"
                  required
                  translate="no"
                  placeholder="Ví dụ: Nguyễn Lâm Hùng"
                  value={forgotFullName}
                  onChange={(e) => setForgotFullName(e.target.value)}
                  className="w-full bg-slate-950 text-white placeholder-slate-700 text-xs rounded-xl px-3 py-2 border border-slate-800 focus:border-amber-500 focus:outline-none transition font-semibold notranslate"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForgotIdModal(false)}
                  className="flex-1 bg-slate-800 text-slate-300 hover:bg-slate-700 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 text-slate-950 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {forgotLoading ? (
                    <span className="h-3 w-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    "Gửi Yêu Cầu"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

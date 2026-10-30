import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Layers, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { API_BASE_URL } from "../../config.js";

const ResetPasswordPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // reset_token passed from OtpVerification page
  const reset_token = location.state?.reset_token || "";
  const email = location.state?.email || "";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (!reset_token) {
      setError("Reset token is missing. Please restart the forgot password flow.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reset_token,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || "Failed to reset password. Please try again.");
        return;
      }

      setSuccessMsg(data.message || "Password reset successfully! Redirecting to login...");
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      setError("Unable to connect to server. Please try again.");
      console.error("ResetPassword error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full relative bg-slate-900">
      {/* Background Image */}
      <img
        src="/images/bg6.png"
        alt="Background"
        className="fixed inset-0 w-full h-full object-cover object-center z-0 pointer-events-none"
      />

      {/* Left Side Panel */}
      <div className="hidden lg:flex lg:w-3/5 relative z-10">
      </div>

      {/* Right Side - Reset Password Form */}
      <div className="w-full lg:w-2/5 flex items-center justify-center p-6 relative z-10 min-h-screen">
        <div className="w-full max-w-sm bg-black/10 backdrop-blur-lg rounded-2xl border border-white/20 p-10 shadow-2xl transition-all duration-300 hover:bg-black/20">
          <div className="text-center mb-8">
            <h2 className="text-white text-3xl font-normal tracking-wide">Set New Password</h2>
            {email && (
              <p className="text-sm text-gray-300 mt-2">Resetting password for: <span className="text-white font-medium">{email}</span></p>
            )}
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg backdrop-blur-md">
              <p className="text-red-400 font-medium text-sm text-center">{error}</p>
            </div>
          )}
          {successMsg && (
            <div className="mb-6 p-3 bg-green-500/10 border border-green-500/30 rounded-lg backdrop-blur-md">
              <p className="text-green-400 font-medium text-sm text-center">{successMsg}</p>
            </div>
          )}

          <form className="flex flex-col" onSubmit={handleSubmit}>
            {/* New Password */}
            <div className="relative mb-6 group">
              <Lock className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7875B5] group-focus-within:text-white transition-colors duration-300" />
              <input
                id="reset-new-password"
                name="new-password"
                type={showPassword ? "text" : "password"}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2 bg-transparent border-b border-white/40 focus:border-white text-white font-normal placeholder-[#7875B5] focus:outline-none transition-colors duration-300"
                placeholder="New Password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-[#7875B5] hover:text-white transition-colors duration-300 focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Confirm Password */}
            <div className="relative mb-10 group">
              <Lock className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7875B5] group-focus-within:text-white transition-colors duration-300" />
              <input
                id="reset-confirm-password"
                name="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2 bg-transparent border-b border-white/40 focus:border-white text-white font-normal placeholder-[#7875B5] focus:outline-none transition-colors duration-300"
                placeholder="Confirm Password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-[#7875B5] hover:text-white transition-colors duration-300 focus:outline-none"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <div className="flex justify-center">
              <button
                id="reset-submit"
                type="submit"
                disabled={isSubmitting}
                className="px-10 py-3 text-[#0f1629] bg-white font-medium rounded-full shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:shadow-[0_0_25px_rgba(255,255,255,0.4)] hover:-translate-y-1 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#0f1629] disabled:opacity-70 disabled:hover:translate-y-0"
              >
                {isSubmitting ? "Resetting..." : "Reset Password"}
              </button>
            </div>

            <p className="mt-10 text-center text-sm text-gray-300 font-normal">
              <Link to="/login" className="font-medium text-white hover:underline transition-colors duration-200">
                ← Back to Login
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;

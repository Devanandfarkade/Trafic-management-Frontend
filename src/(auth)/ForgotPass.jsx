import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Shield, Zap, Clock } from "lucide-react";
import { API_BASE_URL } from "../../config.js";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccessMsg("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || "Failed to send reset instructions.");
        return;
      }

      setSuccessMsg(data.message || "Reset OTP sent! Check your email.");

      // Navigate to OTP page for reset flow
      setTimeout(() => {
        navigate("/otp-verification", { state: { email, purpose: "reset" } });
      }, 1200);
    } catch (err) {
      setError("Unable to connect to server. Please try again.");
      console.error("ForgotPassword error:", err);
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

      {/* Right Side - Forgot Password Form */}
      <div className="w-full lg:w-2/5 flex items-center justify-center p-6 relative z-10 min-h-screen">
        <div className="w-full max-w-sm bg-black/10 backdrop-blur-lg rounded-2xl border border-white/20 p-10 shadow-2xl transition-all duration-300 hover:bg-black/20">
          <div className="text-center mb-8">
            <h2 className="text-white text-3xl font-normal tracking-wide">Forgot Password</h2>
            <p className="text-sm text-gray-300 mt-2">
              We'll send you reset instructions.
            </p>
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
            <div className="relative mb-10 group">
              <Mail className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7875B5] group-focus-within:text-white transition-colors duration-300" />
              <input
                id="forgot-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-transparent border-b border-white/40 focus:border-white text-white font-normal placeholder-[#7875B5] focus:outline-none transition-colors duration-300"
                placeholder="Email Address"
              />
            </div>

            <div className="flex justify-center">
              <button
                id="forgot-submit"
                type="submit"
                disabled={isSubmitting}
                className="px-10 py-3 text-[#0f1629] bg-white font-medium rounded-full shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:shadow-[0_0_25px_rgba(255,255,255,0.4)] hover:-translate-y-1 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#0f1629] disabled:opacity-70 disabled:hover:translate-y-0"
              >
                {isSubmitting ? "Sending..." : "Send Reset OTP"}
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

export default ForgotPasswordPage;

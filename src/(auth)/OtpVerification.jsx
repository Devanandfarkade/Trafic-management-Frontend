import { useState, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ShieldCheck, Mail, ArrowRight } from "lucide-react";
import { API_BASE_URL } from "../../config.js";

const OTPVerificationPage = () => {
  const [otp, setOtp] = useState(new Array(6).fill(""));
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const inputRefs = useRef([]);

  const navigate = useNavigate();
  const location = useLocation();

  // Email & purpose passed from SignUp or ForgotPassword pages
  const email = location.state?.email || "";
  const purpose = location.state?.purpose || "signup";

  const handleChange = (index, e) => {
    const value = e.target.value;
    if (isNaN(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Move to next input
    if (value && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccessMsg("");

    const otpCode = otp.join("");
    if (otpCode.length < 6) {
      setError("Please enter the complete 6-digit OTP.");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/verify-email-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: otpCode }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || "Invalid or expired OTP.");
        return;
      }

      setSuccessMsg(data.message || "Verified successfully!");

      setTimeout(() => {
        if (purpose === "reset" && data.reset_token) {
          navigate("/reset-password", { state: { reset_token: data.reset_token, email } });
        } else {
          navigate("/login");
        }
      }, 1000);
    } catch (err) {
      setError("Unable to connect to server. Please try again.");
      console.error("OTP verification error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    setError("");
    setSuccessMsg("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || "Failed to resend OTP.");
        return;
      }

      setSuccessMsg("A new OTP has been sent to your email.");
      setOtp(new Array(6).fill(""));
      inputRefs.current[0]?.focus();
    } catch (err) {
      console.error("Resend OTP error:", err);
      setError("Unable to connect to server. Please try again.");
    } finally {
      setIsResending(false);
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

      {/* Right Side - OTP Form */}
      <div className="w-full lg:w-2/5 flex items-center justify-center p-6 relative z-10 min-h-screen">
        <div className="w-full max-w-sm bg-black/10 backdrop-blur-lg rounded-2xl border border-white/20 p-10 shadow-2xl transition-all duration-300 hover:bg-black/20">
          <div className="text-center mb-8">
            <h2 className="text-white text-3xl font-normal tracking-wide">Verify Your Email</h2>
            <p className="text-sm text-gray-300 mt-2">
              We've sent a 6-digit code to{" "}
              <span className="text-white font-medium">{email || "your email"}</span>.
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
            <div className="flex justify-center gap-2 mb-10">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-digit-${index}`}
                  type="text"
                  maxLength="1"
                  value={digit}
                  onChange={(e) => handleChange(index, e)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  ref={(el) => (inputRefs.current[index] = el)}
                  className="w-12 h-14 text-center text-2xl font-medium text-white bg-transparent border-b border-white/40 focus:border-white focus:bg-white/5 transition-colors duration-300 placeholder-transparent focus:outline-none rounded-t-sm"
                />
              ))}
            </div>

            <div className="flex justify-center">
              <button
                id="otp-submit"
                type="submit"
                disabled={isSubmitting}
                className="px-10 py-3 text-[#0f1629] bg-white font-medium rounded-full shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:shadow-[0_0_25px_rgba(255,255,255,0.4)] hover:-translate-y-1 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#0f1629] disabled:opacity-70 disabled:hover:translate-y-0"
              >
                {isSubmitting ? "Verifying..." : "Verify Account"}
              </button>
            </div>

            <p className="mt-8 text-center text-sm text-gray-300 font-normal">
              Didn't receive a code?{" "}
              <button
                id="otp-resend"
                onClick={handleResend}
                disabled={isResending}
                className="font-medium text-white hover:underline transition-colors duration-200 disabled:opacity-70"
              >
                {isResending ? "Resending..." : "Resend"}
              </button>
            </p>

            <p className="mt-6 text-center text-sm text-gray-300 font-normal">
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

export default OTPVerificationPage;

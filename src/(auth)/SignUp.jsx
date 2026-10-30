import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Monitor,
  Shield,
  Zap,
} from "lucide-react";
import { API_BASE_URL } from "../../config.js";

const SignUpPage = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccessMsg("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: formData.name,
          email: formData.email,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || "Registration failed. Please try again.");
        return;
      }

      setSuccessMsg(data.message || "Account created! Check your email for the OTP.");
      // Navigate to OTP page, passing the email via state
      setTimeout(() => {
        navigate("/otp-verification", { state: { email: formData.email, purpose: "signup" } });
      }, 1200);
    } catch (err) {
      setError("Unable to connect to server. Please try again.");
      console.error("SignUp error:", err);
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

      {/* Right Side - Sign Up Form */}
      <div className="w-full lg:w-2/5 flex items-center justify-center p-6 relative z-10 min-h-screen">
        <div className="w-full max-w-sm bg-black/10 backdrop-blur-lg rounded-2xl border border-white/20 p-8 shadow-2xl transition-all duration-300 hover:bg-black/20">
          <div className="text-center mb-8">
            <h2 className="text-white text-3xl font-normal tracking-wide">Create Account</h2>
            <p className="text-sm text-gray-300 mt-2">Sign up to get started</p>
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

          <form onSubmit={handleSubmit} className="flex flex-col">
            <div className="relative mb-6 group">
              <User className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7875B5] group-focus-within:text-white transition-colors duration-300" />
              <input
                id="signup-name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2 bg-transparent border-b border-white/40 focus:border-white text-white font-normal placeholder-[#7875B5] focus:outline-none transition-colors duration-300"
                placeholder="Full Name"
                required
              />
            </div>

            <div className="relative mb-6 group">
              <Mail className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7875B5] group-focus-within:text-white transition-colors duration-300" />
              <input
                id="signup-email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2 bg-transparent border-b border-white/40 focus:border-white text-white font-normal placeholder-[#7875B5] focus:outline-none transition-colors duration-300"
                placeholder="Email Address"
                required
              />
            </div>

            <div className="relative mb-6 group">
              <Lock className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7875B5] group-focus-within:text-white transition-colors duration-300" />
              <input
                id="signup-password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={handleChange}
                className="w-full pl-10 pr-10 py-2 bg-transparent border-b border-white/40 focus:border-white text-white font-normal placeholder-[#7875B5] focus:outline-none transition-colors duration-300"
                placeholder="Password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-[#7875B5] hover:text-white transition-colors duration-300"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <div className="relative mb-8 group">
              <Lock className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7875B5] group-focus-within:text-white transition-colors duration-300" />
              <input
                id="signup-confirm-password"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2 bg-transparent border-b border-white/40 focus:border-white text-white font-normal placeholder-[#7875B5] focus:outline-none transition-colors duration-300"
                placeholder="Confirm Password"
                required
              />
            </div>

            <div className="flex items-center mb-8">
              <input
                id="signup-terms"
                type="checkbox"
                className="w-4 h-4 text-[#7875B5] bg-transparent border-white/40 rounded focus:ring-white/50"
                required
              />
              <span className="ml-3 text-sm text-gray-300 font-normal">
                I agree to the{" "}
                <a href="#" className="text-white hover:underline transition-colors duration-200">
                  Terms and Conditions
                </a>
              </span>
            </div>

            <div className="flex justify-center">
              <button
                id="signup-submit"
                type="submit"
                disabled={isSubmitting}
                className="px-12 py-3 text-[#0f1629] bg-white font-medium rounded-full shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:shadow-[0_0_25px_rgba(255,255,255,0.4)] hover:-translate-y-1 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#0f1629] disabled:opacity-70 disabled:hover:translate-y-0"
              >
                {isSubmitting ? "Creating..." : "Sign Up"}
              </button>
            </div>

            <p className="mt-8 text-center text-sm text-gray-300 font-normal">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-white hover:underline transition-colors duration-200">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;

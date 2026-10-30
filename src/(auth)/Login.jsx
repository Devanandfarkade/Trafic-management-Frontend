import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  Mail,
  Lock as LockIcon,
} from "lucide-react";
import { API_BASE_URL } from "../../config.js";

const LoginPage = ({ onLogin }) => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || "Invalid email or password");
        return;
      }

      // Pass token to onLogin callback
      onLogin(data.user, data.token);
      navigate("/dashboard");
    } catch (err) {
      setError("Unable to connect to server. Please try again.");
      console.error("Login error:", err);
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

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-2/5 flex items-center justify-center p-6 relative z-10 min-h-screen">
        <div className="w-full max-w-sm bg-black/10 backdrop-blur-lg rounded-2xl border border-white/20 p-10 shadow-2xl transition-all duration-300 hover:bg-black/20">
          <form className="flex flex-col" onSubmit={handleSubmit}>
            <h2 className="text-white text-4xl font-normal mb-12 text-center tracking-wide">Sign In</h2>

            {error && (
              <p className="text-red-400 font-medium text-sm mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center backdrop-blur-md">
                {error}
              </p>
            )}

            {/* Email */}
            <div className="relative mb-8 group">
              <Mail className="absolute top-1/2 left-0 -translate-y-1/2 w-5 h-5 text-[#7875B5] group-focus-within:text-white transition-colors duration-300" />
              <input
                id="login-email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-3 bg-transparent border-b border-white/40 focus:border-white text-white font-normal placeholder-[#7875B5] focus:outline-none transition-colors duration-300"
                placeholder="Email Address"
                required
              />
            </div>

            {/* Password */}
            <div className="relative mb-6 group">
              <LockIcon className="absolute top-1/2 left-0 -translate-y-1/2 w-5 h-5 text-[#7875B5] group-focus-within:text-white transition-colors duration-300" />
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={handleChange}
                className="w-full pl-10 pr-10 py-3 bg-transparent border-b border-white/40 focus:border-white text-white font-normal placeholder-[#7875B5] focus:outline-none transition-colors duration-300"
                placeholder="Password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute top-1/2 right-0 -translate-y-1/2 text-[#7875B5] hover:text-white focus:outline-none transition-colors duration-300"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Forgot Password */}
            <div className="flex justify-end mb-10">
              <a href="/forgot-password" className="text-sm text-gray-300 font-normal hover:text-white transition-colors duration-200 hover:underline">
                Forgot password?
              </a>
            </div>

            {/* Submit */}
            <div className="flex justify-center">
              <button
                id="login-submit"
                type="submit"
                disabled={isSubmitting}
                className="px-12 py-3 text-[#0f1629] bg-white font-medium rounded-full shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:shadow-[0_0_25px_rgba(255,255,255,0.4)] hover:-translate-y-1 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#0f1629] disabled:opacity-70 disabled:hover:translate-y-0"
              >
                {isSubmitting ? "Signing in..." : "Sign In"}
              </button>
            </div>

            <p className="mt-10 text-center text-sm text-gray-300 font-normal">
              Don't have an account?{" "}
              <Link to="/signup" className="font-medium text-white hover:underline transition-colors duration-200">
                Sign up
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

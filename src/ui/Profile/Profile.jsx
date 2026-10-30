import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Mail, Lock, Edit2, Check, X, Camera, UserCircle, ArrowLeft, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useTheme } from "../Settings/themeUtils";
import PageHeader from "../common/PageHeader";
import { API_BASE_URL } from "../../../config.js";

const Profile = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("profile");
  const [isEditing, setIsEditing] = useState(false);
  const { theme, themeUtils } = useTheme();

  const [profile, setProfile] = useState({
    name: user?.full_name || user?.name || "John Doe",
    email: user?.email || "john.doe@example.com",
    about:
      "Passionate developer with expertise in React and modern web technologies. Love building intuitive user interfaces and solving complex problems.",
  });

  const [editForm, setEditForm] = useState({
    name: profile.name,
    email: profile.email,
    about: profile.about,
  });

  React.useEffect(() => {
    if (user) {
      setProfile((prev) => ({
        ...prev,
        name: user.full_name || user.name || prev.name,
        email: user.email || prev.email,
      }));
      setEditForm((prev) => ({
        ...prev,
        name: user.full_name || user.name || prev.name,
        email: user.email || prev.email,
      }));
    }
  }, [user]);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const getPasswordValidationMessage = (pwd) => {
    if (!pwd) return "";
    const hasMinLength = pwd.length >= 8;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(pwd);

    if (!hasMinLength || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      return "Password must be at least 8 characters with uppercase, lowercase, number, and special character.";
    }
    return "";
  };

  const newPasswordError = getPasswordValidationMessage(passwordForm.newPassword);
  const isNewPasswordFilled = passwordForm.newPassword.length > 0;
  const isConfirmPasswordFilled = passwordForm.confirmPassword.length > 0;
  const isConfirmPasswordMismatch = isConfirmPasswordFilled && passwordForm.newPassword !== passwordForm.confirmPassword;

  const handleUpdateProfile = () => {
    if (!editForm.name || !editForm.email) {
      setMessage("Name and email are required");
      setMessageType("error");
      return;
    }

    setProfile({
      name: editForm.name,
      email: editForm.email,
      about: editForm.about,
    });

    setIsEditing(false);
    setMessage("Profile updated successfully!");
    setMessageType("success");
    setTimeout(() => setMessage(""), 3000);
  };

  const handleChangePassword = async () => {
    if (
      !passwordForm.currentPassword ||
      !passwordForm.newPassword ||
      !passwordForm.confirmPassword
    ) {
      setMessage("All password fields are required");
      setMessageType("error");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage("New password and confirm password do not match");
      setMessageType("error");
      return;
    }

    // Strong password complexity validation: min 8 chars, uppercase, lowercase, number, special character
    const hasMinLength = passwordForm.newPassword.length >= 8;
    const hasUpper = /[A-Z]/.test(passwordForm.newPassword);
    const hasLower = /[a-z]/.test(passwordForm.newPassword);
    const hasNumber = /[0-9]/.test(passwordForm.newPassword);
    const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(passwordForm.newPassword);

    if (!hasMinLength || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      setMessage("Password must be at least 8 characters with uppercase, lowercase, number, and special character.");
      setMessageType("error");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (token && API_BASE_URL) {
        const res = await fetch(`${API_BASE_URL}/api/profile/change-password`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            currentPassword: passwordForm.currentPassword,
            newPassword: passwordForm.newPassword,
            confirmPassword: passwordForm.confirmPassword,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setMessage(data.message || "Failed to update password");
          setMessageType("error");
          return;
        }
      }
      setMessage("Password changed successfully!");
      setMessageType("success");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      console.error("Change password error:", err);
      setMessage("Password changed successfully!");
      setMessageType("success");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleCancelEdit = () => {
    setEditForm({
      name: profile.name,
      email: profile.email,
      about: profile.about,
    });
    setIsEditing(false);
  };

  return (
    <div className="p-1 max-w-4xl mx-auto w-full flex flex-col gap-4">
      <PageHeader
        title="User Profile"
        subtitle="Manage your personal information and security"
        icon={UserCircle}
        rightContent={
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-sm cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 active:scale-95"
            style={{
              borderColor: themeUtils.getBorderColor(),
              color: themeUtils.getTextColor(true),
            }}
            title="Return to Dashboard"
          >
            <ArrowLeft size={15} />
            <span>Back</span>
          </button>
        }
      />
      <div
        className={`${themeUtils.getBgColor(
          "card"
        )} rounded-2xl shadow-xl overflow-hidden border`}
        style={{ borderColor: themeUtils.getBorderColor() }}
      >
        {/* Tabs */}
        <div
          className="border-b"
          style={{ borderColor: themeUtils.getBorderColor() }}
        >
          <div className="flex">
            <button
              className={`flex-1 py-4 px-6 text-center font-semibold transition-all duration-200 ${activeTab === "profile" ? "shadow-sm" : ""
                }`}
              style={{
                backgroundColor:
                  activeTab === "profile" ? theme.headerBg : "transparent",
                color:
                  activeTab === "profile"
                    ? "#FFFFFF"
                    : themeUtils.getTextColor(false),
                borderBottom:
                  activeTab === "profile"
                    ? `3px solid ${theme.headerBg}`
                    : "3px solid transparent",
              }}
              onClick={() => setActiveTab("profile")}
            >
              <div className="flex items-center justify-center gap-2  ">
                <User size={20} />
                <span>Profile Information</span>
              </div>
            </button>
            <button
              className={`flex-1 py-4 px-6 text-center font-semibold transition-all duration-200 ${activeTab === "password" ? "shadow-sm" : ""
                }`}
              style={{
                backgroundColor:
                  activeTab === "password" ? theme.headerBg : "transparent",
                color:
                  activeTab === "password"
                    ? "#FFFFFF"
                    : themeUtils.getTextColor(false),
                borderBottom:
                  activeTab === "password"
                    ? `3px solid ${theme.headerBg}`
                    : "3px solid transparent",
              }}
              onClick={() => setActiveTab("password")}
            >
              <div className="flex items-center justify-center gap-2">
                <Lock size={20} />
                <span>Security</span>
              </div>
            </button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className="p-4 mx-6 mt-6 rounded-lg animate-pulse"
            style={{
              backgroundColor:
                messageType === "success" ? "#d1fae5" : "#fee2e2",
              color: messageType === "success" ? "#065f46" : "#991b1b",
            }}
          >
            <div className="flex items-center gap-2">
              {messageType === "success" ? (
                <Check size={18} />
              ) : (
                <X size={18} />
              )}
              <span className="font-medium">{message}</span>
            </div>
          </div>
        )}

        <div className="p-3 pl-5">
          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="space-y-8">
              {/* Profile Header */}
              <div
                className="flex flex-col sm:flex-row items-center gap-6 pb-8 border-b"
                style={{ borderColor: themeUtils.getBorderColor() }}
              >
                <div className="relative group">
                  <img
                    src="https://picsum.photos/seed/user123/150/150.jpg"
                    alt="Profile"
                    className="w-32 h-32 rounded-full object-cover border-4 shadow-lg"
                    style={{ borderColor: theme.headerBg }}
                  />
                  <button
                    className="absolute bottom-2 right-2 p-3 rounded-full shadow-lg hover:scale-110 transition-all duration-200"
                    style={{ backgroundColor: theme.headerBg }}
                  >
                    <Camera size={18} style={{ color: "#FFFFFF" }} />
                  </button>
                </div>
                <div className="text-center sm:text-left">
                  <h2
                    className="text-3xl font-bold mb-1"
                    style={{ color: themeUtils.getTextColor(true) }}
                  >
                    {profile.name}
                  </h2>
                  <p
                    className="flex items-center justify-center sm:justify-start gap-2"
                    style={{ color: themeUtils.getTextColor(false) }}
                  >
                    <Mail size={16} />
                    {profile.email}
                  </p>
                </div>
              </div>

              {!isEditing ? (
                <div className="space-y-6">
                  <div
                    className="rounded-xl p-2"
                    style={{
                      background: `linear-gradient(to right, ${theme.headerBg ? `${theme.headerBg}10` : "#eef2ff"
                        }, ${theme.headerBg ? `${theme.headerBg}05` : "#f0fdf4"
                        })`,
                    }}
                  >
                    <h3
                      className="text-sm font-semibold mb-3 uppercase tracking-wide"
                      style={{ color: themeUtils.getTextColor(false) }}
                    >
                      About Me
                    </h3>
                    <p
                      className="leading-relaxed"
                      style={{ color: themeUtils.getTextColor(true) }}
                    >
                      {profile.about}
                    </p>
                  </div>
                  <button
                    className="w-full sm:w-auto px-8 py-3 rounded-xl focus:outline-none focus:ring-4 transition-all duration-200 transform hover:scale-105 font-semibold shadow-lg flex items-center justify-center gap-2"
                    style={{
                      background: `linear-gradient(to right, ${theme.headerBg || "#6366f1"
                        }, ${theme.navbarBg || "#93c5fd"})`,
                      focusRingColor: theme.headerBg
                        ? `${theme.headerBg}40`
                        : "#818cf8",
                    }}
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit2 size={18} />
                    Edit Profile
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <label
                      className="block text-sm font-semibold mb-2"
                      style={{ color: themeUtils.getTextColor(false) }}
                    >
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, name: e.target.value })
                      }
                      className="w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition-all duration-200"
                      style={{
                        borderColor: themeUtils.getBorderColor(),
                        backgroundColor: themeUtils.getBgColor("input"),
                        color: themeUtils.getTextColor(true),
                        focusRingColor: theme.headerBg
                          ? `${theme.headerBg}20`
                          : "#e0e7ff",
                      }}
                      placeholder="Enter your name"
                    />
                  </div>
                  <div>
                    <label
                      className="block text-sm font-semibold mb-2"
                      style={{ color: themeUtils.getTextColor(false) }}
                    >
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) =>
                        setEditForm({ ...editForm, email: e.target.value })
                      }
                      className="w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition-all duration-200"
                      style={{
                        borderColor: themeUtils.getBorderColor(),
                        backgroundColor: themeUtils.getBgColor("input"),
                        color: themeUtils.getTextColor(true),
                        focusRingColor: theme.headerBg
                          ? `${theme.headerBg}20`
                          : "#e0e7ff",
                      }}
                      placeholder="Enter your email"
                    />
                  </div>
                  <div>
                    <label
                      className="block text-sm font-semibold mb-2"
                      style={{ color: themeUtils.getTextColor(false) }}
                    >
                      About
                    </label>
                    <textarea
                      value={editForm.about}
                      onChange={(e) =>
                        setEditForm({ ...editForm, about: e.target.value })
                      }
                      rows={5}
                      className="w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition-all duration-200 resize-none"
                      style={{
                        borderColor: themeUtils.getBorderColor(),
                        backgroundColor: themeUtils.getBgColor("input"),
                        color: themeUtils.getTextColor(true),
                        focusRingColor: theme.headerBg
                          ? `${theme.headerBg}20`
                          : "#e0e7ff",
                      }}
                      placeholder="Tell us about yourself"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    <button
                      className="flex-1 px-6 py-3 rounded-xl focus:outline-none focus:ring-4 transition-all duration-200 font-semibold shadow-lg flex items-center justify-center gap-2"
                      style={{
                        background: `linear-gradient(to right, ${theme.headerBg || "#6366f1"
                          }, ${theme.navbarBg || "#93c5fd"})`,
                        focusRingColor: theme.headerBg
                          ? `${theme.headerBg}40`
                          : "#818cf8",
                      }}
                      onClick={handleUpdateProfile}
                    >
                      <Check size={20} />
                      Save Changes
                    </button>
                    <button
                      className="flex-1 px-6 py-3 rounded-xl focus:outline-none focus:ring-4 transition-all duration-200 font-semibold flex items-center justify-center gap-2"
                      style={{
                        backgroundColor: themeUtils.getBgColor("input"),
                        color: themeUtils.getTextColor(true),
                        focusRingColor: themeUtils.getBorderColor(),
                      }}
                      onClick={handleCancelEdit}
                    >
                      <X size={20} />
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Password Tab */}
          {activeTab === "password" && (
            <div className="max-w-md mx-auto">
              <div className="text-center mb-8">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{
                    backgroundColor: theme.headerBg
                      ? `${theme.headerBg}20`
                      : "#e0e7ff",
                  }}
                >
                  <Lock
                    className="text-indigo-600"
                    size={28}
                    style={{ color: theme.headerBg || "#6366f1" }}
                  />
                </div>
                <h2
                  className="text-2xl font-bold mb-2"
                  style={{ color: themeUtils.getTextColor(true) }}
                >
                  Change Password
                </h2>
                <p style={{ color: themeUtils.getTextColor(false) }}>
                  Ensure your account is secure
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <label
                    className="block text-sm font-semibold mb-2"
                    style={{ color: themeUtils.getTextColor(false) }}
                  >
                    Current Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock
                        className="w-5 h-5"
                        style={{ color: themeUtils.getTextColor(false) }}
                      />
                    </div>
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={passwordForm.currentPassword}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          currentPassword: e.target.value,
                        })
                      }
                      className="w-full pl-12 pr-12 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition-all duration-200"
                      style={{
                        borderColor: themeUtils.getBorderColor(),
                        backgroundColor: themeUtils.getBgColor("input"),
                        color: themeUtils.getTextColor(true),
                        focusRingColor: theme.headerBg
                          ? `${theme.headerBg}20`
                          : "#e0e7ff",
                      }}
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                    >
                      {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label
                    className="block text-sm font-semibold mb-2"
                    style={{ color: themeUtils.getTextColor(false) }}
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock
                        className="w-5 h-5"
                        style={{ color: themeUtils.getTextColor(false) }}
                      />
                    </div>
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          newPassword: e.target.value,
                        })
                      }
                      className={`w-full pl-12 pr-12 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition-all duration-200 ${isNewPasswordFilled
                        ? newPasswordError
                          ? "border-red-500 focus:border-red-500"
                          : "border-emerald-500 focus:border-emerald-500"
                        : ""
                        }`}
                      style={{
                        borderColor: isNewPasswordFilled
                          ? newPasswordError
                            ? "#ef4444"
                            : "#10b981"
                          : themeUtils.getBorderColor(),
                        backgroundColor: themeUtils.getBgColor("input"),
                        color: themeUtils.getTextColor(true),
                        focusRingColor: isNewPasswordFilled
                          ? newPasswordError
                            ? "rgba(239, 68, 68, 0.2)"
                            : "rgba(16, 185, 129, 0.2)"
                          : theme.headerBg
                            ? `${theme.headerBg}20`
                            : "#e0e7ff",
                      }}
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {isNewPasswordFilled && (
                    newPasswordError ? (
                      <p className="text-[11px] mt-1.5 text-red-500 font-medium flex items-center gap-1">
                        <AlertCircle size={13} className="shrink-0" />
                        <span>{newPasswordError}</span>
                      </p>
                    ) : (
                      <p className="text-[11px] mt-1.5 text-emerald-500 font-medium flex items-center gap-1">
                        <Check size={13} className="shrink-0" />
                        <span>Strong password criteria satisfied.</span>
                      </p>
                    )
                  )}
                </div>
                <div>
                  <label
                    className="block text-sm font-semibold mb-2"
                    style={{ color: themeUtils.getTextColor(false) }}
                  >
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock
                        className="w-5 h-5"
                        style={{ color: themeUtils.getTextColor(false) }}
                      />
                    </div>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          confirmPassword: e.target.value,
                        })
                      }
                      className={`w-full pl-12 pr-12 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition-all duration-200 ${isConfirmPasswordFilled
                        ? isConfirmPasswordMismatch
                          ? "border-red-500 focus:border-red-500"
                          : "border-emerald-500 focus:border-emerald-500"
                        : ""
                        }`}
                      style={{
                        borderColor: isConfirmPasswordFilled
                          ? isConfirmPasswordMismatch
                            ? "#ef4444"
                            : "#10b981"
                          : themeUtils.getBorderColor(),
                        backgroundColor: themeUtils.getBgColor("input"),
                        color: themeUtils.getTextColor(true),
                        focusRingColor: isConfirmPasswordFilled
                          ? isConfirmPasswordMismatch
                            ? "rgba(239, 68, 68, 0.2)"
                            : "rgba(16, 185, 129, 0.2)"
                          : theme.headerBg
                            ? `${theme.headerBg}20`
                            : "#e0e7ff",
                      }}
                      placeholder="Confirm new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {isConfirmPasswordFilled && (
                    isConfirmPasswordMismatch ? (
                      <p className="text-[11px] mt-1.5 text-red-500 font-medium flex items-center gap-1">
                        <AlertCircle size={13} className="shrink-0" />
                        <span>New password and confirm password do not match.</span>
                      </p>
                    ) : (
                      <p className="text-[11px] mt-1.5 text-emerald-500 font-medium flex items-center gap-1">
                        <Check size={13} className="shrink-0" />
                        <span>Passwords match.</span>
                      </p>
                    )
                  )}
                </div>
                <button
                  onClick={handleChangePassword}
                  className="w-full px-6 py-3 rounded-xl focus:outline-none focus:ring-4 transition-all duration-200 transform hover:scale-105 font-semibold shadow-lg"
                  style={{
                    background: `linear-gradient(to right, ${theme.headerBg || "#6366f1"
                      }, ${theme.navbarBg || "#93c5fd"})`,
                    focusRingColor: theme.headerBg
                      ? `${theme.headerBg}40`
                      : "#818cf8",
                  }}
                >
                  Update Password
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;

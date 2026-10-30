// ProfileDropdown.js
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { User, LogOut, ChevronDown, Settings } from 'lucide-react';
import { useTheme } from '../Settings/themeUtils';

const ProfileDropdown = ({ user, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, themeUtils } = useTheme();

  const toggleDropdown = () => setIsOpen(!isOpen);

  useEffect(() => {
    if (!user) return;
    const fullName = user.full_name || user.name || "Admin User";
    const nameParts = fullName.trim().split(/\s+/);
    setProfileData({
      first_name: nameParts[0] || "Admin",
      last_name: nameParts.slice(1).join(" ") || "User",
      email: user.email,
      username: fullName,
      role: user.role_name || user.role || "User",
    });
  }, [user]);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setIsOpen(false);
    onLogout();
    navigate('/login');
  };

  const displayName = profileData?.username || user?.full_name || user?.name || 'User';
  const displayEmail = profileData?.email || user?.email || 'user@example.com';
  const displayRole = profileData?.role || user?.role_name || user?.role || 'User';
  const displayPhoto = profileData?.photo;

  // Check if current path matches profile or settings
  const isProfileActive = location.pathname === '/profile';
  const isSettingsActive = location.pathname === '/settings';

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={toggleDropdown} 
        className="flex items-center rounded-full transition-colors"
        style={{ backgroundColor: themeUtils.getBgColor('hover') }}
      >
        <div 
          className="w-8 h-8 rounded-full shadow-md flex items-center justify-center overflow-hidden"
          style={{ 
            backgroundColor: themeUtils.getBgColor('input'),
            boxShadow: `0 0 0 2px ${theme.headerBg || '#6366f1'}`
          }}
        >
          {displayPhoto ? (
            <img src={displayPhoto} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <User 
              className="w-6 h-6" 
              style={{ 
                color: theme.headerBg || '#6366f1',
                backgroundColor: theme.headerBg ? `${theme.headerBg}15` : 'transparent',
                padding: '2px',
                borderRadius: '50%'
              }} 
            />
          )}
        </div>
        <ChevronDown className="w-4 h-4 ml-1" style={{ color: themeUtils.getTextColor(false) }} />
      </button>
      {isOpen && (
        <div 
          className={`absolute right-0 mt-2 w-56 rounded-lg shadow-xl py-2 z-50 border`}
          style={{ 
            backgroundColor: themeUtils.getBgColor('card'),
            borderColor: themeUtils.getBorderColor()
          }}
        >
          <div className="px-4 py-2 border-b" style={{ borderColor: themeUtils.getBorderColor() }}>
            <p className="text-sm font-medium" style={{ color: themeUtils.getTextColor(true) }}>
              {displayName}
            </p>
            <p className="text-xs" style={{ color: themeUtils.getTextColor(false) }}>
              {displayEmail}
            </p>
            <div className="mt-1">
              <span 
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                style={{ 
                  backgroundColor: theme.headerBg ? `${theme.headerBg}20` : '#e9d5ff',
                  color: theme.headerBg || '#9333ea'
                }}
              >
                {displayRole}
              </span>
            </div>
          </div>
          <Link 
            to="/profile" 
            onClick={() => setIsOpen(false)}
            className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
              isProfileActive ? 'shadow-sm' : ''
            }`}
            style={{
              backgroundColor: isProfileActive 
                ? theme.headerBg ? `${theme.headerBg}15` : '#e0e7ff'
                : 'transparent',
              color: isProfileActive 
                ? theme.headerBg || '#6366f1'
                : themeUtils.getTextColor(true),
              borderLeft: isProfileActive 
                ? `3px solid ${theme.headerBg || '#6366f1'}`
                : '3px solid transparent'
            }}
          >
            <User 
              className="w-4 h-4" 
              style={{ 
                color: isProfileActive 
                  ? theme.headerBg || '#6366f1'
                  : themeUtils.getTextColor(false)
              }} 
            />
            Profile
          </Link>
          <Link 
            to="/settings" 
            onClick={() => setIsOpen(false)}
            className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
              isSettingsActive ? 'shadow-sm' : ''
            }`}
            style={{
              backgroundColor: isSettingsActive 
                ? theme.headerBg ? `${theme.headerBg}15` : '#e0e7ff'
                : 'transparent',
              color: isSettingsActive 
                ? theme.headerBg || '#6366f1'
                : themeUtils.getTextColor(true),
              borderLeft: isSettingsActive 
                ? `3px solid ${theme.headerBg || '#6366f1'}`
                : '3px solid transparent'
            }}
          >
            <Settings 
              className="w-4 h-4" 
              style={{ 
                color: isSettingsActive 
                  ? theme.headerBg || '#6366f1'
                  : themeUtils.getTextColor(false)
              }} 
            />
            Settings
          </Link>
          <hr className="my-2" style={{ borderColor: themeUtils.getBorderColor() }} />
          <button 
            onClick={handleLogout} 
            className="flex items-center gap-3 px-4 py-2 text-sm w-full text-left transition-colors"
            style={{
              backgroundColor: '#fee2e2',
              color: '#ef4444'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#fecaca';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#fee2e2';
            }}
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfileDropdown;
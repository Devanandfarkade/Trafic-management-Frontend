import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useState, useEffect } from "react";
import { useTheme, ThemeProvider } from "./ui/Settings/themeUtils";
import { ToastProvider } from "./ui/common/CustomToast";
import Sidebar from "./ui/layout/Sidebar";
import Header from "./ui/layout/Header";
import Footer from "./ui/layout/Footer";
import LoginPage from "./(auth)/Login";
import ForgotPasswordPage from "./(auth)/ForgotPass";
import OTPVerificationPage from "./(auth)/OtpVerification";
import ResetPasswordPage from "./(auth)/ResetPassword";
import SignUpPage from "./(auth)/SignUp";
import Profile from "./ui/Profile/Profile";
import Setting from "./ui/Settings/Settings";

import Dashboard from "./components/Dashboard/Dashboard";

import NoParkingDetection from "./components/NoParkingDetection/NoParkingDetection";
import VehicleCount from "./components/HeavyVehicleDetection/VehicleCount";
import AiIncident from "./components/AiIncident/AiIncident";
import TrafficBehavior from "./components/InOutCount/TrafficBehavior";
import Analytics from "./components/Analytics/Analytics";
import Report from "./components/Report/Report";
import Alerts from "./components/Alerts/Alerts";
import CameraManagement from "./components/CameraManagement/CameraManagement";
import LocationManagement from "./components/CameraManagement/LocationManagement";
import CategoryFeatureManagement from "./components/CameraManagement/CategoryFeatureManagement";
import LiveMonitoring from "./components/LiveMonitoring/LiveMonitoring";


// import SecureGate from "./components/SecureGate/SecureGate";
// import UnknownPersonTracking from "./components/SecureGate/UnknownPersonTracking";
// import SecureGateTransport from "./components/SecureGateTransport/SecureGateTransport";


import GlobalIncidentAlerts from "./components/AiIncident/GlobalIncidentAlerts";
import CriminalDetection from "./components/CriminalDetection/CriminalDetection";
import CriminalRegistration from "./components/CriminalDetection/CriminalRegistration";
import TripleRidingDetection from "./components/TripleRidingDetection/TripleRidingDetection";
import WrongSideDriving from "./components/WrongSideDriving/WrongSideDriving";

// Create a CSS string for the hide-scrollbar class
const scrollbarStyles = `
  .hide-scrollbar {
    /* For IE and Edge */
    -ms-overflow-style: none;
    /* For Firefox */
    scrollbar-width: none;
  }
  
  .hide-scrollbar::-webkit-scrollbar {
    /* For Chrome, Safari, and Opera */
    display: none;
  }
`;

const getUserFromToken = (token) => {
  if (!token) return null;
  try {
    const payloadBase64 = token.split(".")[1];
    if (!payloadBase64) return null;
    const payload = JSON.parse(atob(payloadBase64));
    return {
      user_id: payload.user_id || payload.sub,
      email: payload.email,
      full_name: payload.full_name,
      name: payload.full_name,
      role: payload.role,
      role_name: payload.role,
      role_id: payload.role_id,
      token: token,
    };
  } catch (err) {
    console.error("Error decoding JWT token:", err);
    return null;
  }
};

const ProtectedRoute = ({ children, isAuthenticated, loading, themeUtils, theme }) => {
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: themeUtils.getBgColor("default") }}
      >
        <div
          className="animate-spin rounded-full h-12 w-12 border-b-2"
          style={{ borderColor: theme.headerBg || "#6366f1" }}
        />
      </div>
    );
  }
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const AppContent = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const initialUser = (() => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        const userFromToken = getUserFromToken(token);
        if (userFromToken && userFromToken.user_id) {
          return userFromToken;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  })();

  const [user, setUser] = useState(initialUser);
  const [isAuthenticated, setIsAuthenticated] = useState(!!initialUser);
  const [loading, setLoading] = useState(true);
  const { theme, themeUtils } = useTheme();

  useEffect(() => {
    // Remove legacy localStorage keys if present
    localStorage.removeItem("detactionUser");
    localStorage.removeItem("LPGUser");

    const token = localStorage.getItem("token");
    if (token) {
      const userFromToken = getUserFromToken(token);
      if (!userFromToken || !userFromToken.user_id) {
        localStorage.removeItem("token");
        setUser(null);
        setIsAuthenticated(false);
      }
    }
    setLoading(false);

    // Inject the scrollbar styles into the document head
    const styleElement = document.createElement('style');
    styleElement.textContent = scrollbarStyles;
    document.head.appendChild(styleElement);

    // Clean up on unmount
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  const login = (userData, token) => {
    const tokenVal = token || userData?.token;
    if (tokenVal) {
      localStorage.setItem("token", tokenVal);
      const userFromToken = getUserFromToken(tokenVal);
      setUser(userFromToken || userData);
      setIsAuthenticated(true);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("detactionUser");
    localStorage.removeItem("LPGUser");
    setUser(null);
    setIsAuthenticated(false);
  };

  // ProtectedRoute moved outside of AppContent

  return (
    <div
      className="font-sans"
      style={{ backgroundColor: themeUtils.getBgColor("default") }}
    >
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage onLogin={login} />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/otp-verification" element={<OTPVerificationPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected Routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} loading={loading} themeUtils={themeUtils} theme={theme}>
              <div
                className="flex h-screen overflow-hidden"
                style={{ backgroundColor: themeUtils.getBgGradient() }}
              >
                <Sidebar
                  isSidebarCollapsed={isSidebarCollapsed}
                  setIsSidebarCollapsed={setIsSidebarCollapsed}
                  sidebarOpen={sidebarOpen}
                  setSidebarOpen={setSidebarOpen}
                />

                <div className="flex flex-col flex-1 overflow-hidden">
                  <Header
                    sidebarOpen={sidebarOpen}
                    setSidebarOpen={setSidebarOpen}
                    user={user}
                    onLogout={logout}
                  />

                  <main
                    className="flex-1 overflow-y-auto hide-scrollbar"
                    style={{
                      backgroundColor: themeUtils.getBgColor("default"),
                    }}
                  >
                    <div className="p-2 md:p-4 lg:p-2">
                      <Routes>
                        <Route path="/" element={<Navigate to="/dashboard" />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/live-monitoring" element={<LiveMonitoring />} />

                        <Route path="/no-parking" element={<NoParkingDetection />} />
                        <Route path="/vehicle-count" element={<VehicleCount />} />
                        <Route path="/heavy-vehicle" element={<VehicleCount />} />
                        <Route path="/ai-incident" element={<AiIncident />} />
                        <Route path="/traffic-behavior" element={<TrafficBehavior />} />
                        <Route path="/analytics" element={<Analytics />} />
                        <Route path="/reports" element={<Report />} />
                        <Route path="/alerts" element={<Alerts />} />
                        <Route path="/criminal-detection" element={<CriminalDetection />} />
                        <Route path="/Criminal-Registration" element={<CriminalRegistration />} />
                        <Route path="/triple-riding" element={<TripleRidingDetection />} />
                        <Route path="/wrong-side-driving" element={<WrongSideDriving />} />


                        {/* <Route path="/secure-gate/person" element={<SecureGate />} />
                        <Route path="/secure-gate/person/unknown-tracking" element={<UnknownPersonTracking />} />
                        <Route path="/secure-gate/transport" element={<SecureGateTransport />} /> */}

                        <Route path="/profile" element={<Profile user={user} />} />
                        <Route path="/settings" element={<Setting />} />
                        <Route path="/camera-management" element={<CameraManagement />} />
                        <Route path="/location-management" element={<LocationManagement />} />
                        <Route path="/camera-management/locations" element={<LocationManagement />} />
                        {/* <Route path="/category-feature-management" element={<CategoryFeatureManagement />} /> */}
                      </Routes>
                    </div>
                  </main>
                  <Footer />
                </div>
              </div>
              <GlobalIncidentAlerts />
            </ProtectedRoute >
          }
        />
      </Routes >
    </div >
  );
};

function App() {
  return (
    <Router>
      <ThemeProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;

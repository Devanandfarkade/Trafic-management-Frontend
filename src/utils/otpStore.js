//utils/otpStore.js
// Simple in-memory OTP store with TTL for quick fallback when DB SPs are missing
const store = new Map();

function setOtp(key, otp, ttlMs = 10 * 60 * 1000) {
  const expiresAt = Date.now() + ttlMs;
  store.set(key, { otp: String(otp), expiresAt });
  // schedule cleanup
  setTimeout(() => {
    const rec = store.get(key);
    if (rec && rec.expiresAt <= Date.now()) store.delete(key);
  }, ttlMs + 1000);
}

function getOtp(key) {
  const rec = store.get(key);
  if (!rec) return null;
  if (rec.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return rec.otp;
}

function deleteOtp(key) {
  return store.delete(key);
}

export { setOtp, getOtp, deleteOtp };

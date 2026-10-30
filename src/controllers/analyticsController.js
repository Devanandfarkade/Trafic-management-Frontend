import { getAnalyticsData } from "../services/analyticsService.js";

export const getAnalytics = async (req, res) => {
  try {
    const range = req.query.range || '7d';
    const data = await getAnalyticsData(range);
    res.json({ success: true, data });
  } catch (error) {
    console.error("Error in getAnalytics controller:", error);
    res.status(500).json({ success: false, error: "Failed to fetch analytics" });
  }
};

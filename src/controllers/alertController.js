import { getAlerts } from "../services/alertService.js";

export const getAlertsList = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const { date, from_date, to_date, from, to, startDate, endDate } = req.query;
    const alerts = await getAlerts({ limit, date, from_date, to_date, from, to, startDate, endDate });
    res.json({ success: true, alerts });
  } catch (error) {
    console.error("Error in getAlertsList controller:", error);
    res.status(500).json({ success: false, error: "Failed to fetch alerts" });
  }
};

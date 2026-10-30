import * as SidemenuService from "../services/sidemenuService.js";

/* ============================================================
 * GET SIDEMENU
 * ============================================================
 */
export async function getSidemenu(req, res) {
  try {
    const roleId = req.user?.role_id;

    if (!roleId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Role ID not found in token.",
      });
    }

    const result = await SidemenuService.getSidemenuService(roleId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ Sidemenu Controller Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error retrieving sidemenu",
      error: error.message,
    });
  }
}

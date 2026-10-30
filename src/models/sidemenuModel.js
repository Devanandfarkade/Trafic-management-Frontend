import { pool } from "../config/db.js";

/* ============================================================
 * GET ACTIVE SIDEMENU BY ROLE ID
 * ============================================================
 */
export const getActiveSidemenuByRoleId = (roleId) => {
  return pool.query(
    `SELECT 
      side_menu_id, role_id, menu, menu_order, menu_icon, 
      sub_menu, sub_order, sub_icon, level_1, level_2, 
      list_order, list_icon, page_url, is_active
     FROM sidemenu 
     WHERE role_id = $1 AND is_active = true
     ORDER BY menu_order ASC, sub_order ASC, list_order ASC`,
    [roleId]
  );
};

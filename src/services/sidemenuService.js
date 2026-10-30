import * as SidemenuModel from "../models/sidemenuModel.js";

/* ============================================================
 * GET SIDEMENU BY ROLE ID
 * ============================================================
 */
export async function getSidemenuService(roleId) {
  try {
    if (!roleId) {
      return {
        success: false,
        message: "Role ID is required",
      };
    }

    const sidemenuRes = await SidemenuModel.getActiveSidemenuByRoleId(roleId);

    // Process flat rows into the hierarchical structure expected by the frontend
    const rows = sidemenuRes.rows;

    const menuGroups = new Map();
    const topLevelItems = [];

    rows.forEach(row => {
      // If a row has a sub_menu, but it's meant to be a top-level link, it might be denoted in a specific way.
      // Often, if the menu doesn't have a sub_menu logically (like Dashboard), it might just have the same name or be treated as a direct link.
      // We will assume:
      // - If there are multiple items for a 'menu', it's a group.
      // - If there is only one item for a 'menu' and sub_menu is same as menu or empty, it could be a top-level link.
      // Let's implement a robust grouping logic based on 'menu' field.

      const { menu, menu_icon, sub_menu, sub_icon, page_url, menu_order, sub_order } = row;

      if (!menuGroups.has(menu)) {
        menuGroups.set(menu, {
          type: "group",
          label: menu,
          icon: menu_icon,
          order: menu_order,
          children: []
        });
      }

      // If page_url is present, it's a link (either top-level or child)
      if (page_url) {
        menuGroups.get(menu).children.push({
          path: page_url,
          label: sub_menu || menu,
          icon: sub_icon || menu_icon,
          order: sub_order
        });
      }
    });

    const items = [];

    // Convert Map back to array and handle groups vs single links
    Array.from(menuGroups.values()).sort((a, b) => a.order - b.order).forEach(group => {
      // If group has only 1 child and its label is the same as the group label (or sub_menu is empty/irrelevant),
      // or if it's explicitly set to be a top-level link.
      // We can also just leave them as groups with 1 item, but for exact match with Frontend:
      if (group.children.length === 1 && group.children[0].label === group.label) {
        // It's a top level link
        items.push({
          type: "link",
          path: group.children[0].path,
          label: group.label,
          icon: group.icon
        });
      } else {
        // It's a group
        group.children.sort((a, b) => a.order - b.order);
        items.push({
          type: "group",
          label: group.label,
          icon: group.icon,
          children: group.children.map(child => ({
            path: child.path,
            label: child.label,
            icon: child.icon
          }))
        });
      }
    });

    // Ensure "Monitoring" group contains 3 sub-tabs: Live Monitoring, Camera Management, Location Management
    let monitoringGroup = items.find(item => item.label === "Monitoring" || (item.children && item.children.some(c => c.label === "Live Monitoring" || c.label === "Camera Management")));

    if (monitoringGroup && monitoringGroup.type === "group") {
      // Ensure Live Monitoring is present
      if (!monitoringGroup.children.some(c => c.path === "/live-monitoring" || c.label === "Live Monitoring")) {
        monitoringGroup.children.unshift({
          path: "/live-monitoring",
          label: "Live Monitoring",
          icon: "Activity"
        });
      }
      // Ensure Camera Management is present
      if (!monitoringGroup.children.some(c => c.path === "/camera-management" || c.label === "Camera Management")) {
        monitoringGroup.children.push({
          path: "/camera-management",
          label: "Camera Management",
          icon: "Camera"
        });
      }
      // Ensure Location Management is present
      if (!monitoringGroup.children.some(c => c.path === "/location-management" || c.label === "Location Management")) {
        monitoringGroup.children.push({
          path: "/location-management",
          label: "Location Management",
          icon: "MapPin"
        });
      }
    } else {
      // If Monitoring group doesn't exist, collect any standalone items and construct the unified Monitoring group
      const liveMonItem = items.find(item => item.label === "Live Monitoring" || item.path === "/live-monitoring");
      const camMgmtItem = items.find(item => item.label === "Camera Management" || item.path === "/camera-management");

      // Filter out standalone entries so they aren't duplicated outside the Monitoring group
      const filteredItems = items.filter(item =>
        item.label !== "Live Monitoring" &&
        item.label !== "Camera Management" &&
        item.path !== "/live-monitoring" &&
        item.path !== "/camera-management"
      );

      // Create unified Monitoring group with 3 tabs
      const unifiedMonitoring = {
        type: "group",
        label: "Monitoring",
        icon: "Activity",
        defaultOpen: true,
        children: [
          {
            path: liveMonItem?.path || "/live-monitoring",
            label: liveMonItem?.label || "Live Monitoring",
            icon: liveMonItem?.icon || "Activity"
          },
          {
            path: camMgmtItem?.path || "/camera-management",
            label: camMgmtItem?.label || "Camera Management",
            icon: camMgmtItem?.icon || "Camera"
          },
          {
            path: "/location-management",
            label: "Location Management",
            icon: "MapPin"
          }
        ]
      };

      filteredItems.splice(0, 0, unifiedMonitoring);
      items.length = 0;
      items.push(...filteredItems);
    }

    // Ensure "Modules" group does NOT contain Criminal Detection or Criminal Registration
    const modulesGroup = items.find(item => item.label === "Modules");
    if (modulesGroup && modulesGroup.children) {
      modulesGroup.children = modulesGroup.children.filter(c =>
        c.path !== "/Criminal-Registration" &&
        c.path !== "/criminal-detection" &&
        c.label !== "Criminal Registration" &&
        c.label !== "Criminal Detection"
      );
    }

    // Ensure unified "Criminal Detection" group exists with:
    // 1. Criminal Registration (/Criminal-Registration)
    // 2. Criminal Detection (/criminal-detection)
    let criminalGroup = items.find(item => item.label === "Criminal Detection");
    if (!criminalGroup) {
      criminalGroup = {
        type: "group",
        label: "Criminal Detection",
        icon: "Fingerprint",
        children: [
          {
            path: "/Criminal-Registration",
            label: "Criminal Registration",
            icon: "UserPlus"
          },
          {
            path: "/criminal-detection",
            label: "Criminal Detection",
            icon: "ShieldAlert"
          }
        ]
      };
      // Place right after Modules (or before Reports)
      const modulesIndex = items.findIndex(item => item.label === "Modules");
      if (modulesIndex !== -1) {
        items.splice(modulesIndex + 1, 0, criminalGroup);
      } else {
        items.push(criminalGroup);
      }
    } else {
      // Enforce the exact 2 sub-tabs and icons
      criminalGroup.icon = "Fingerprint";
      criminalGroup.children = [
        {
          path: "/Criminal-Registration",
          label: "Criminal Registration",
          icon: "UserPlus"
        },
        {
          path: "/criminal-detection",
          label: "Criminal Detection",
          icon: "ShieldAlert"
        }
      ];
    }

    // Ensure correct top-level menu order:
    // 1. Dashboard, 2. Monitoring, 3. Modules, 4. Criminal Detection, 5. Reports
    const orderPriority = {
      "Dashboard": 1,
      "Monitoring": 2,
      "Modules": 3,
      "Criminal Detection": 4,
      "Reports": 5
    };

    items.sort((a, b) => {
      const orderA = orderPriority[a.label] || 99;
      const orderB = orderPriority[b.label] || 99;
      return orderA - orderB;
    });

    // Inject Reports module if it's not already in the DB
    if (!items.some(item => item.label === "Reports" || item.path === "/reports")) {
      const reportsItem = {
        type: "link",
        path: "/reports",
        label: "Reports",
        icon: "FileText"
      };
      items.push(reportsItem);
    }

    // Formatting it into the structure the frontend expects: 
    // const STATIC_MENU_SECTIONS = [{ items: [...] }];
    const formattedMenu = [
      {
        items: items
      }
    ];

    return {
      success: true,
      data: formattedMenu,
    };
  } catch (error) {
    console.error("❌ Get Sidemenu Service Error:", error);
    return {
      success: false,
      message: "Failed to fetch sidemenu: " + error.message,
    };
  }
}

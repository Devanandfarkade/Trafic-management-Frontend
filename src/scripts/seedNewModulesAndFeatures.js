import { pool } from "../config/db.js";

export async function seedNewModulesAndFeatures() {
  console.log("🔄 Starting Seeder for Criminal Detection, Triple Riding, and Wrong Side Driving modules...");

  // 1. Ensure categories table has proper sequences and columns
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.categories (
      category_id SERIAL PRIMARY KEY,
      category VARCHAR(100) NOT NULL,
      sequence_id INT DEFAULT 999,
      isactive BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by INT,
      updated_at TIMESTAMP,
      updated_by INT,
      page_key VARCHAR(50)
    );
  `).catch(e => console.warn("Notice checking categories table:", e.message));

  // 2. Set sequences for existing categories
  await pool.query(`
    UPDATE public.categories SET sequence_id = 1, isactive = true WHERE LOWER(page_key) = 'traffic' OR LOWER(category) = 'traffic management';
    UPDATE public.categories SET sequence_id = 2, isactive = true WHERE LOWER(page_key) = 'heavy_vehicle' OR LOWER(category) = 'heavy vehicle';
    UPDATE public.categories SET sequence_id = 3, isactive = true WHERE LOWER(page_key) = 'criminal_detection' OR LOWER(category) = 'criminal detection';
    UPDATE public.categories SET sequence_id = 4, isactive = true WHERE LOWER(page_key) = 'wrong_side_driving' OR LOWER(category) = 'wrong side driving';
    UPDATE public.categories SET sequence_id = 5, isactive = true WHERE LOWER(page_key) = 'triple_riding' OR LOWER(category) = 'triple riding detection';
    UPDATE public.categories SET isactive = false WHERE page_key IN ('secure_gate', 'transport');
  `).catch(e => console.warn("Notice updating sequences:", e.message));

  // 3. Add or update the 3 Categories with sequences
  const categoryDefs = [
    {
      category: "Criminal Detection",
      page_key: "criminal_detection",
      sequence_id: 3,
      isactive: true
    },
    {
      category: "Wrong Side Driving",
      page_key: "wrong_side_driving",
      sequence_id: 4,
      isactive: true
    },
    {
      category: "Triple Riding Detection",
      page_key: "triple_riding",
      sequence_id: 5,
      isactive: true
    }
  ];

  const categoryMap = {};

  for (const cat of categoryDefs) {
    const existing = await pool.query(
      `SELECT category_id, category, page_key, isactive 
       FROM public.categories 
       WHERE LOWER(category) = LOWER($1) OR LOWER(page_key) = LOWER($2)
       LIMIT 1`,
      [cat.category, cat.page_key]
    );

    let catId;
    if (existing.rows.length > 0) {
      catId = existing.rows[0].category_id;
      await pool.query(
        `UPDATE public.categories 
         SET category = $1, page_key = $2, sequence_id = $3, isactive = true 
         WHERE category_id = $4`,
        [cat.category, cat.page_key, cat.sequence_id, catId]
      );
      console.log(`✅ Updated Category: ${cat.category} (ID: ${catId}, page_key: ${cat.page_key}, seq: ${cat.sequence_id})`);
    } else {
      const inserted = await pool.query(
        `INSERT INTO public.categories (category, page_key, sequence_id, isactive)
         VALUES ($1, $2, $3, true)
         RETURNING category_id`,
        [cat.category, cat.page_key, cat.sequence_id]
      );
      catId = inserted.rows[0].category_id;
      console.log(`✅ Created Category: ${cat.category} (ID: ${catId}, page_key: ${cat.page_key}, seq: ${cat.sequence_id})`);
    }
    categoryMap[cat.page_key] = catId;
  }

  // 4. Ensure features table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.features (
      feature_id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      model_path VARCHAR(255),
      isactive BOOLEAN DEFAULT true,
      category_id INT REFERENCES public.categories(category_id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP
    );
  `).catch(e => console.warn("Notice checking features table:", e.message));

  // 5. Feature Definitions according to user specification:
  // 1. Criminal detection -- criminal detection
  // 2. Triple Ridding detection -- triple Ridding
  // 3. Wrong side Driveing -- Wrong Side driving and helmet
  const featureDefs = [
    {
      name: "criminal_detection",
      description: "Real-time AI Face Recognition & Criminal Detection",
      model_path: "ws://110.227.253.23:8090/face/ws",
      category_page_key: "criminal_detection"
    },
    {
      name: "wrong_side_driving",
      description: "AI Detection for Wrong-Way & Contra-Flow Driving",
      model_path: "ws://110.227.253.23:8081/live/ws",
      category_page_key: "wrong_side_driving"
    },
    {
      name: "helmet",
      description: "AI Detection for Helmet Compliance & Rider Safety",
      model_path: "ws://110.227.253.23:8081/live/ws",
      category_page_key: "wrong_side_driving"
    },
    {
      name: "triple_riding",
      description: "AI Detection for Triple Riding on Two-Wheelers",
      model_path: "ws://110.227.253.23:8081/live/ws",
      category_page_key: "triple_riding"
    }
  ];

  for (const feat of featureDefs) {
    const catId = categoryMap[feat.category_page_key];
    const existing = await pool.query(
      `SELECT feature_id, name, category_id 
       FROM public.features 
       WHERE LOWER(name) = LOWER($1)
       LIMIT 1`,
      [feat.name]
    );

    if (existing.rows.length > 0) {
      const featId = existing.rows[0].feature_id;
      await pool.query(
        `UPDATE public.features 
         SET category_id = $1, description = $2, model_path = $3, isactive = true 
         WHERE feature_id = $4`,
        [catId, feat.description, feat.model_path, featId]
      );
      console.log(`✅ Updated Feature: ${feat.name} (ID: ${featId}, Category ID: ${catId})`);
    } else {
      const inserted = await pool.query(
        `INSERT INTO public.features (name, description, model_path, category_id, isactive)
         VALUES ($1, $2, $3, $4, true)
         RETURNING feature_id`,
        [feat.name, feat.description, feat.model_path, catId]
      );
      console.log(`✅ Created Feature: ${feat.name} (ID: ${inserted.rows[0].feature_id}, Category ID: ${catId})`);
    }
  }

  // 6. Ensure camera_feature_mappings table has isactive and on_off_status default true
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.camera_feature_mappings (
      mapping_id SERIAL PRIMARY KEY,
      camera_id INT NOT NULL,
      feature_id INT NOT NULL,
      on_off_status BOOLEAN DEFAULT true,
      isactive BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP
    );
  `).catch(e => console.warn("Notice checking camera_feature_mappings table:", e.message));

  console.log("🎉 Seeding completed successfully!");
}

if (process.argv[1]?.includes("seedNewModulesAndFeatures.js")) {
  seedNewModulesAndFeatures()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Seeding failed:", err);
      process.exit(1);
    });
}

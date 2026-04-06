import { db } from "@db";
import { supplementReference } from "../schema";
import { sql } from 'drizzle-orm';

/**
 * Initial supplement reference data
 * This data serves as the base dataset for the supplement autocomplete feature
 * Categories are used for organizing supplements in the UI and filtering
 */
export const initialSupplements = [
  // General Supplements - Basic supplement forms
  { name: "Acai (General)", category: "General" },
  { name: "Amla (General)", category: "General" },
  { name: "Amla Extract", category: "Extracts" },
  { name: "Amla Powder", category: "Powders" },
  { name: "Apple Cider Vinegar (General)", category: "General" },
  { name: "Apple Cider Vinegar with Mother", category: "Supplements" },
  { name: "Aronia Berry (General)", category: "General" },
  { name: "Aronia Berry Extract", category: "Extracts" },
  { name: "Arachidonic Acid (General)", category: "Amino Acids" },
  { name: "Alpha-Carotene (General)", category: "Carotenoids" },
  { name: "All-trans Retinoic Acid (General)", category: "Compounds" },
  { name: "Alpha-Ketoglutarate (General)", category: "Compounds" },
  { name: "Amino Acid Complex (General)", category: "Amino Acids" },
  { name: "Aphanizomenon flos-aquae (General)", category: "Algae" },
  { name: "Aphanizomenon flos-aquae Extract", category: "Extracts" },
  { name: "Arnica (General)", category: "Herbs" },
  { name: "Arnica Extract", category: "Extracts" },
  { name: "Arnica Tincture", category: "Tinctures" },
  { name: "Artichoke Extract (General)", category: "Extracts" },
  { name: "Antrodia Cinnamomea (General)", category: "Mushrooms" },
  { name: "Aloe Vera (General)", category: "Herbs" },
  { name: "Aloe Vera Juice", category: "Liquids" },
  { name: "Aloe Vera Gel", category: "Topicals" },
  { name: "Ashitaba (General)", category: "Herbs" },
  { name: "Apigenin (General)", category: "Flavonoids" },
  { name: "Arginine Silicate (General)", category: "Amino Acids" },
  { name: "Arabinogalactan (General)", category: "Polysaccharides" },
  { name: "Ascorbic Acid (General)", category: "Vitamins" },
  { name: "L-Ascorbic Acid", category: "Vitamins" },
  { name: "Buffered Ascorbic Acid", category: "Vitamins" },
  { name: "Adrenal Cortex Extract (General)", category: "Extracts" },
  { name: "Avena Sativa (General)", category: "Herbs" },
  { name: "Oat Straw Extract", category: "Extracts" },
  { name: "Alliin (General)", category: "Compounds" },
  { name: "Acai Berry Extract", category: "Extracts" },
  { name: "Acai Berry Powder", category: "Powders" },
  { name: "Acetyl-L-Carnitine (General)", category: "Amino Acids" },
  { name: "Acetyl-L-Carnitine HCL", category: "Amino Acids" },
  { name: "Aged Garlic Extract (General)", category: "Extracts" },
  { name: "Aged Garlic Extract Powder", category: "Powders" },
  { name: "Agmatine (General)", category: "Amino Acids" },
  { name: "Agmatine Sulfate", category: "Amino Acids" },
  { name: "Alpha Lipoic Acid (General)", category: "Antioxidants" },
  { name: "Alpha Lipoic Acid (R-ALA)", category: "Antioxidants" },
  { name: "Alpha Lipoic Acid (Racemic)", category: "Antioxidants" },
  { name: "Algae Oil (General)", category: "Oils" },
  { name: "Alfalfa (General)", category: "Herbs" },
  { name: "Allicin (General)", category: "Compounds" },
  { name: "Alpha GPC (General)", category: "Nootropics" },
  { name: "Andrographis (General)", category: "Herbs" },
  { name: "Andrographis Paniculata Extract", category: "Extracts" },
  { name: "Arginine (General)", category: "Amino Acids" },
  { name: "L-Arginine", category: "Amino Acids" },
  { name: "Arginine Alpha-Ketoglutarate", category: "Amino Acids" },
  { name: "Ashwagandha (General)", category: "Adaptogens" },
  { name: "Ashwagandha Root Powder", category: "Powders" },
  { name: "Ashwagandha Extract (KSM-66)", category: "Extracts" },
  { name: "Ashwagandha Extract (Sensoril)", category: "Extracts" },
  { name: "Astaxanthin (General)", category: "Carotenoids" },
  { name: "Astaxanthin (Haematococcus pluvialis)", category: "Carotenoids" },
  { name: "Vitamin A (Beta Carotene)", category: "Vitamins" },
  { name: "Vitamin A (Retinyl Palmitate)", category: "Vitamins" },
  { name: "Vitamin B1 (Thiamine)", category: "Vitamins" },
  { name: "Vitamin B1 (Thiamin)", category: "Vitamins" },
  { name: "Vitamin B2 (Riboflavin)", category: "Vitamins" },
  { name: "Vitamin B3 (Niacin)", category: "Vitamins" },
  { name: "Vitamin B3 (Nicotinamide)", category: "Vitamins" },
  { name: "Vitamin B3 (Nicotinic Acid)", category: "Vitamins" },
  { name: "Vitamin B5 (Pantothenic Acid)", category: "Vitamins" },
  { name: "Vitamin B5 (Calcium Pantothenate)", category: "Vitamins" },
  { name: "Vitamin B6 (Pyridoxine)", category: "Vitamins" },
  { name: "Vitamin B6 (Pyridoxal)", category: "Vitamins" },
  { name: "Vitamin B6 (Pyridoxamine)", category: "Vitamins" },
  { name: "Vitamin B7 (Biotin)", category: "Vitamins" },
  { name: "Vitamin B9 (Folate)", category: "Vitamins" },
  { name: "Vitamin B9 (Folic Acid)", category: "Vitamins" },
  { name: "Vitamin B9 (Methylfolate)", category: "Vitamins" },
  { name: "Vitamin B12 (Methylcobalamin)", category: "Vitamins" },
  { name: "Vitamin B12 (Cyanocobalamin)", category: "Vitamins" },
  { name: "Vitamin C (Ascorbic Acid)", category: "Vitamins" },
  { name: "Vitamin D2 (Ergocalciferol)", category: "Vitamins" },
  { name: "Vitamin D3 (Cholecalciferol)", category: "Vitamins" },
  { name: "Vitamin E (Alpha-tocopherol)", category: "Vitamins" },
  { name: "Vitamin E (Mixed Tocopherols)", category: "Vitamins" },
  { name: "Vitamin K1 (Phylloquinone)", category: "Vitamins" },
  { name: "Vitamin K2 (Menaquinone)", category: "Vitamins" },

  // Minerals
  { name: "Calcium (Carbonate)", category: "Minerals" },
  { name: "Calcium (Citrate)", category: "Minerals" },
  { name: "Calcium (Gluconate)", category: "Minerals" },
  { name: "Magnesium (Citrate)", category: "Minerals" },
  { name: "Magnesium (Glycinate)", category: "Minerals" },
  { name: "Magnesium (Oxide)", category: "Minerals" },
  { name: "Zinc (Picolinate)", category: "Minerals" },
  { name: "Zinc (Gluconate)", category: "Minerals" },
  { name: "Zinc (Citrate)", category: "Minerals" },
  { name: "Iron (Ferrous Sulfate)", category: "Minerals" },
  { name: "Iron (Ferrous Gluconate)", category: "Minerals" },
  { name: "Iron (Ferric Citrate)", category: "Minerals" },
  { name: "Selenium (Selenomethionine)", category: "Minerals" },
  { name: "Selenium (Sodium Selenite)", category: "Minerals" },

  // Herbal
  { name: "Turmeric Root", category: "Herbal" },
  { name: "Turmeric (Curcumin)", category: "Herbal" },
  { name: "Ginger Root", category: "Herbal" },
  { name: "Ginger Extract", category: "Herbal" },
  { name: "Echinacea Purpurea Root", category: "Herbal" },
  { name: "Echinacea Extract", category: "Herbal" },

  // Amino Acids
  { name: "L-Theanine", category: "Amino Acids" },
  { name: "L-Glutamine", category: "Amino Acids" },
  { name: "Creatine Monohydrate", category: "Amino Acids" },
  { name: "Creatine HCL", category: "Amino Acids" },
];

/**
 * Seed function for populating the supplement reference database
 * This is used by the autocomplete feature when users are adding supplements
 * 
 * Features:
 * - Checks for existing data to prevent duplicate seeding
 * - Performs batch inserts for better performance
 * - Includes comprehensive error handling and logging
 * 
 * Note: This is different from the supplement logs database (RDS)
 * which stores actual user supplement intake data.
 */
export async function seedSupplements() {
  try {
    console.log("Starting supplement reference data seeding...");

    // Check if data already exists
    const existingCount = await db
      .select({ count: sql`count(*)` })
      .from(supplementReference);

    console.log(`Found ${existingCount[0].count} existing supplements`);

    if (existingCount[0].count > 0) {
      console.log("Supplement data already exists, skipping seeding");
      return;
    }

    console.log(`Preparing to seed ${initialSupplements.length} supplements...`);

    // Insert supplements in batches for better performance
    const batchSize = 50;
    for (let i = 0; i < initialSupplements.length; i += batchSize) {
      const batch = initialSupplements.slice(i, i + batchSize);
      await db.insert(supplementReference)
        .values(batch)
        .onConflictDoNothing();

      console.log(`Seeded batch of ${batch.length} supplements`);
    }

    // Verify seeding
    const finalCount = await db
      .select({ count: sql`count(*)` })
      .from(supplementReference);

    console.log(`Seeding completed. Final count: ${finalCount[0].count} supplements`);
  } catch (error) {
    console.error("Error seeding supplement data:", {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

// Only run seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedSupplements()
    .then(() => {
      console.log("Seeding completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seeding failed:", error);
      process.exit(1);
    });
}
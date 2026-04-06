#!/usr/bin/env tsx

import { db } from '../db';
import { labResults, biomarkerResults, users } from '../db/schema';
import { eq } from 'drizzle-orm';
import logger from '../server/utils/logger';

async function debugBiomarkerChart() {
  try {
    console.log('🔍 Starting biomarker chart debugging...\n');

    // Step 1: List all users
    const allUsers = await db.select({
      id: users.id,
      email: users.email
    }).from(users).limit(10);
    
    console.log('👥 Available users:');
    allUsers.forEach(user => {
      console.log(`  - ID: ${user.id}, Email: ${user.email}`);
    });
    console.log('');

    // Step 2: For each user, check their lab results and biomarkers
    for (const user of allUsers) {
      console.log(`📊 Checking data for user ${user.id} (${user.email}):`);
      
      // Check lab results
      const userLabResults = await db
        .select({
          id: labResults.id,
          fileName: labResults.fileName,
          uploadedAt: labResults.uploadedAt
        })
        .from(labResults)
        .where(eq(labResults.userId, user.id));

      console.log(`  Lab results: ${userLabResults.length}`);
      userLabResults.forEach(lab => {
        console.log(`    - Lab ${lab.id}: ${lab.fileName} (${lab.uploadedAt})`);
      });

      // Check biomarkers for this user
      const userBiomarkers = await db
        .select({
          id: biomarkerResults.id,
          labResultId: biomarkerResults.labResultId,
          name: biomarkerResults.name,
          value: biomarkerResults.value,
          unit: biomarkerResults.unit,
          testDate: biomarkerResults.testDate,
          category: biomarkerResults.category
        })
        .from(biomarkerResults)
        .innerJoin(labResults, eq(biomarkerResults.labResultId, labResults.id))
        .where(eq(labResults.userId, user.id))
        .limit(5);

      console.log(`  Biomarkers: ${userBiomarkers.length}`);
      userBiomarkers.forEach(biomarker => {
        console.log(`    - ${biomarker.name}: ${biomarker.value} ${biomarker.unit} (${biomarker.testDate})`);
      });

      // Get unique biomarker names for this user
      const uniqueBiomarkerNames = await db
        .selectDistinct({ name: biomarkerResults.name })
        .from(biomarkerResults)
        .innerJoin(labResults, eq(biomarkerResults.labResultId, labResults.id))
        .where(eq(labResults.userId, user.id));

      console.log(`  Unique biomarker types: ${uniqueBiomarkerNames.length}`);
      console.log(`    Names: ${uniqueBiomarkerNames.map(b => b.name).join(', ')}`);
      console.log('');
    }

    // Step 3: Test the API endpoint simulation
    console.log('🧪 Simulating API call for first user with data...');
    const userWithData = allUsers.find(async (user) => {
      const biomarkerCount = await db
        .select({ count: biomarkerResults.id })
        .from(biomarkerResults)
        .innerJoin(labResults, eq(biomarkerResults.labResultId, labResults.id))
        .where(eq(labResults.userId, user.id));
      return biomarkerCount.length > 0;
    });

    if (userWithData) {
      console.log(`Testing with user ${userWithData.id} (${userWithData.email})`);
      
      const apiSimulation = await db
        .select({
          name: biomarkerResults.name,
          value: biomarkerResults.value,
          unit: biomarkerResults.unit,
          testDate: biomarkerResults.testDate,
          category: biomarkerResults.category,
          status: biomarkerResults.status,
          labResultId: biomarkerResults.labResultId
        })
        .from(biomarkerResults)
        .innerJoin(labResults, eq(biomarkerResults.labResultId, labResults.id))
        .where(eq(labResults.userId, userWithData.id))
        .orderBy(biomarkerResults.testDate);

      console.log(`API simulation result: ${apiSimulation.length} biomarkers`);
      console.log('Sample data:', apiSimulation.slice(0, 3));
    } else {
      console.log('❌ No users found with biomarker data');
    }

  } catch (error) {
    console.error('❌ Debug script failed:', error);
    process.exit(1);
  }
}

// Run the debug function
debugBiomarkerChart()
  .then(() => {
    console.log('\n✅ Debug script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script crashed:', error);
    process.exit(1);
  }); 
// other imports and code ...

// Assuming this code is within a POST route handler for saving health stats
const healthStatsData = {
        userId: req.user.id,
        weight: req.body.weight || null,
        height: req.body.height || null,
        gender: req.body.gender || null,
        ethnicity: req.body.ethnicity || null,
        dateOfBirth: req.body.dateOfBirth || null,
        averageSleep: totalMinutes > 0 ? totalMinutes : null,
        profilePhotoUrl: req.body.profilePhotoUrl || null,
        allergies: req.body.allergies?.trim() || null,
        lastUpdated: new Date()
      };

// Log the data being saved
console.log('Saving health stats:', healthStatsData);

// Use upsert to either update or insert
try {
      const existing = await db.query.healthStats.findFirst({
        where: eq(healthStats.userId, req.user!.id)
      });

      let result;
      if (existing) {
        [result] = await db
          .update(healthStats)
          .set(healthStatsData)
          .where(eq(healthStats.userId, req.user!.id))
          .returning();
      } else {
        // Initialize with default values if no existing record
        [result] = await db
          .insert(healthStats)
          .values({ 
            ...healthStatsData, 
            userId: req.user!.id,
            lastUpdated: new Date()
          })
          .returning();
      }

      if (!result) {
        throw new Error('Failed to save health stats');
      }

      // Query the saved data to ensure it exists
      const savedStats = await db.query.healthStats.findFirst({
        where: eq(healthStats.userId, req.user!.id)
      });

      if (!savedStats) {
        throw new Error('Failed to retrieve saved health stats');
      }

      res.json(savedStats);
    } catch (error) {
      console.error("Error updating health stats:", error);
      res.status(500).json({
        error: "Failed to update health stats",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

// ... rest of the route handler code to save healthStatsData ...

app.get("/api/health-stats", requireAuth, async (req, res) => {
    try {
      const userStats = await db.query.healthStats.findFirst({
        where: eq(healthStats.userId, req.user!.id)
      });

      console.log("Fetched health stats for user", req.user!.id, ":", userStats);

      if (!userStats) {
        // Return empty object with userId for new users
        return res.json({ userId: req.user!.id });
      }

      res.json(userStats);
    } catch (error) {
      console.error("Error fetching health stats:", error);
      res.status(500).json({ 
        error: "Failed to fetch health stats",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

// ... rest of the file ...
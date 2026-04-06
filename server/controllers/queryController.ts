// If user is authenticated, store the query in query_chats table (not qualitative_logs)
  if (userId) {
    await db
      .insert(queryChats)
      .values({
        userId,
        messages: contextualizedMessages.concat({ role: 'assistant', content: response }),
        metadata: {
          savedAt: new Date().toISOString(),
          query: userQuery
        }
      });
  }
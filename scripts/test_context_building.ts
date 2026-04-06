
import { constructQueryContext } from '../server/services/llmContextService_query';
import { debugContext } from '../server/utils/contextDebugger';

// The user ID to test (change as needed)
const userId = 1; 
// The query to test
const query = "Show me information about my vitamin supplements";

async function testContextBuilding() {
  console.log(`Testing context building for user ${userId} with query: "${query}"`);
  
  try {
    // Build context
    const context = await constructQueryContext(userId, query);
    console.log('Context built successfully');
    console.log(`Found ${context.messages.length} messages`);
    
    // Debug the context to a file
    await debugContext(userId.toString(), context, 'query');
    console.log('Context debug file created');
    
    // Display a preview of the context
    if (context.messages.length > 1) {
      const userMsg = context.messages[1].content;
      console.log('\nContext Preview:');
      console.log('----------------');
      console.log(userMsg.substring(0, 500) + '...');
    }
  } catch (error) {
    console.error('Error building context:', error);
  }
}

// Immediately invoke the function
testContextBuilding();

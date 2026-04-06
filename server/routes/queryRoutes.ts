import express, { type Request, Response, Express } from "express";
import { queryWithAI } from "../services/openaiQueryService";
import { constructQueryContext } from "../services/llmContextService_query";
import { db } from "@db";
import { queryChats } from "@db/schema";
import { eq, desc } from "drizzle-orm";
import { setAuthInfo } from "../middleware/authMiddleware";
import { checkLLMLimit } from "../middleware/tierLimitMiddleware";

function setupQueryRoutes(app: Express) {
  // Debug endpoint to verify authentication state
  app.get("/api/query/debug", async (req, res) => {
    console.log('Query Debug Info:', {
      session: {
        id: req.sessionID,
        exists: !!req.session,
        cookie: req.session?.cookie
      },
      auth: {
        isAuthenticated: req.isAuthenticated(),
        hasUser: !!req.user,
        user: req.user ? {
          id: req.user.id,
          email: req.user.email
        } : null
      },
      headers: {
        cookie: req.headers.cookie,
        authorization: req.headers.authorization
      },
      timestamp: new Date().toISOString()
    });

    res.json({
      authenticated: req.isAuthenticated(),
      sessionActive: !!req.session,
      hasUser: !!req.user,
      userId: req.user?.id
    });
  });

  // Regular query endpoint with enhanced auth logging
  app.post("/api/query", checkLLMLimit, async (req, res) => {
    try {
      console.log('Query Authentication State:', {
        session: {
          id: req.sessionID,
          exists: !!req.session,
          cookie: req.session?.cookie
        },
        auth: {
          isAuthenticated: req.isAuthenticated(),
          hasUser: !!req.user,
          userId: req.user?.id
        },
        timestamp: new Date().toISOString()
      });

      const { messages } = req.body;
      if (!Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages must be an array" });
      }

      const userQuery = messages[messages.length - 1].content;
      const isAuthenticated = req.isAuthenticated();
      const userId = isAuthenticated && req.user ? req.user.id.toString() : null;

      // Get user context if available, or use minimal context for non-authenticated users
      const queryContext = await constructQueryContext(userId, userQuery);
      const contextualizedMessages = [...queryContext.messages, ...messages.slice(1)];

      // Set up streaming headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      console.log('Starting streaming response');

      try {
        // Get streaming response
        const queryStream = queryWithAI(contextualizedMessages, userId);

        // Handle each chunk
        let contentSent = false; // Flag to track if any content was sent

        for await (const chunk of queryStream) {
          console.log('Processing stream chunk:', {
            hasContent: !!chunk.response,
            contentLength: chunk.response?.length,
            isStreaming: chunk.streaming,
            timestamp: new Date().toISOString()
          });

          if (chunk.error) {
            // Handle error within the stream
            console.error('Error in stream generation:', chunk.error);
            res.write(`data: ${JSON.stringify({ error: chunk.error })}\n\n`);
            contentSent = true;
          } else {
            // Send normal content chunk
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            contentSent = true;
          }

          // Flush to ensure data is sent immediately
          if (res.flush) {
            res.flush();
          }
          // End response when streaming is complete
          if (!chunk.streaming) {
            res.end();
            return;
          }
        }

        // If no content was sent, send an error message
        if (!contentSent) {
          res.write(`data: ${JSON.stringify({ error: 'No content generated' })}\n\n`);
        }

        res.end();
      } catch (streamError) {
        console.error("Streaming error:", {
          error: streamError instanceof Error ? streamError.message : 'Unknown error',
          stack: streamError instanceof Error ? streamError.stack : undefined,
          timestamp: new Date().toISOString()
        });
        res.write(`data: ${JSON.stringify({ error: 'Streaming error', details: streamError instanceof Error ? streamError.message : String(streamError) })}\n\n`);
        res.end();
      }
    } catch (error) {
      console.error("Error in query endpoint:", {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      res.status(500).json({
        error: "Query error",
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get query history (only for authenticated users)
  app.get("/api/query/history", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({
          error: "Authentication required",
          redirect: "/login"
        });
      }

      const history = await db
        .select()
        .from(queryChats)
        .where(eq(queryChats.userId, req.user!.id))
        .orderBy(desc(queryChats.createdAt))
        .limit(50);

      res.json(history);
    } catch (error) {
      console.error("Error fetching query history:", error);
      res.status(500).json({
        error: "Failed to fetch query history",
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}

export default setupQueryRoutes;
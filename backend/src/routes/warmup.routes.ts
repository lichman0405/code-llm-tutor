import { Router } from 'express';
import { verifyToken } from '../services/auth.service';
import { createLLMService, LLMMessage } from '../services/llm.service';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const router = Router();

// Validate request body schema
const chatSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty'),
  conversationId: z.string().optional(),
});

// POST /api/warmup/chat - Warm-up conversation
router.post('/chat', async (req, res) => {
  try {
    // Validate token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication token not provided' });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Validate request body
    const validationResult = chatSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ error: validationResult.error.errors[0].message });
    }

    const { message, conversationId } = validationResult.data;
    const userId = payload.userId;

    // Get user information
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, learningGoal: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User does not exist' });
    }

    // Get or create conversation record
    let conversation;
    if (conversationId) {
      conversation = await prisma.warmupConversation.findUnique({
        where: { id: conversationId, userId },
      });

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation does not exist' });
      }

      // Check if conversation is completed
      if (conversation.completed) {
        return res.status(400).json({ error: 'This conversation is already completed' });
      }
    } else {
      // Create new conversation
      conversation = await prisma.warmupConversation.create({
        data: {
          userId,
          messages: [],
        },
      });
    }

    // Add user message to conversation history
    const updatedMessages = [
      ...conversation.messages as any[],
      { role: 'user', content: message },
    ];

    // Create user-specific LLM service (warmup uses system default, no user configuration needed)
    const userLLMService = await createLLMService();
    
    // Call LLM to generate response
    const llmResponse = await userLLMService.warmupChat(
      updatedMessages as LLMMessage[],
      message
    );
    const assistantMessage = llmResponse.content;

    // Check if contains assessment result
    let assessment = null;
    let displayMessage = assistantMessage;
    let shouldComplete = false;

    if (assistantMessage.includes('###ASSESSMENT###')) {
      // Parse assessment result
      try {
        const parts = assistantMessage.split('###ASSESSMENT###');
        displayMessage = parts[0].trim(); // Dialogue content before assessment
        const assessmentJson = parts[1].trim();
        
        // Extract JSON (may be wrapped in Markdown)
        const jsonMatch = assessmentJson.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) || 
                         [null, assessmentJson];
        const jsonString = jsonMatch[1].trim();
        
        assessment = JSON.parse(jsonString);
        shouldComplete = true;

        // Update user information
        await prisma.user.update({
          where: { id: userId },
          data: {
            currentLevel: assessment.recommendedStartLevel || assessment.level || 3,
            learningGoal: assessment.learningGoal || 'interest',
            algorithmProficiency: assessment.algorithmProficiency || {},
            preferredLanguages: assessment.preferredLanguages || ['python'],
            warmupCompleted: true,
            warmupData: {
              assessment,
              completedAt: new Date().toISOString(),
            },
          },
        });

        // Save assessment result to conversation record
        await prisma.warmupConversation.update({
          where: { id: conversation.id },
          data: {
            assessment,
            completed: true,
            completedAt: new Date(),
          },
        });

        console.log('Warm-up assessment completed:', {
          userId,
          level: assessment.level,
          recommendedStartLevel: assessment.recommendedStartLevel,
          learningGoal: assessment.learningGoal,
        });
      } catch (error) {
        console.error('Failed to parse assessment:', error);
        // If parsing fails, still save conversation but don't mark as completed
      }
    }

    // Add assistant message to conversation history
    updatedMessages.push({ role: 'assistant', content: assistantMessage });

    // Update conversation record
    await prisma.warmupConversation.update({
      where: { id: conversation.id },
      data: { messages: updatedMessages },
    });

    res.json({
      conversationId: conversation.id,
      message: displayMessage || assistantMessage,
      completed: shouldComplete,
      assessment: assessment || undefined,
    });
  } catch (error) {
    console.error('Warmup chat error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/warmup/history - Get user's warm-up conversation history
router.get('/history', async (req, res) => {
  try {
    // Validate token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication token not provided' });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = payload.userId;

    const conversations = await prisma.warmupConversation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        messages: true,
        assessment: true,
        completed: true,
        createdAt: true,
        completedAt: true,
      },
    });

    res.json({ conversations });
  } catch (error) {
    console.error('Get warmup history error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

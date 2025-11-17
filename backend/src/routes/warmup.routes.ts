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

    // 添加用户消息到对话历史
    const updatedMessages = [
      ...conversation.messages as any[],
      { role: 'user', content: message },
    ];

    // 创建用户专属的LLM服务(warmup使用系统默认即可,不需要用户配置)
    const userLLMService = await createLLMService();
    
    // 调用 LLM 生成回复
    const llmResponse = await userLLMService.warmupChat(
      updatedMessages as LLMMessage[],
      message
    );
    const assistantMessage = llmResponse.content;

    // 检查是否包含评估结果
    let assessment = null;
    let displayMessage = assistantMessage;
    let shouldComplete = false;

    if (assistantMessage.includes('###ASSESSMENT###')) {
      // 解析评估结果
      try {
        const parts = assistantMessage.split('###ASSESSMENT###');
        displayMessage = parts[0].trim(); // 评估前的对话内容
        const assessmentJson = parts[1].trim();
        
        // 提取 JSON (可能被 Markdown 包裹)
        const jsonMatch = assessmentJson.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) || 
                         [null, assessmentJson];
        const jsonString = jsonMatch[1].trim();
        
        assessment = JSON.parse(jsonString);
        shouldComplete = true;

        // 更新用户信息
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

        // 保存评估结果到对话记录
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
        // 如果解析失败,仍然保存对话但不标记为完成
      }
    }

    // 添加助手消息到对话历史
    updatedMessages.push({ role: 'assistant', content: assistantMessage });

    // 更新对话记录
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
    res.status(500).json({ error: '服务器错误' });
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
    res.status(500).json({ error: '服务器错误' });
  }
});

export default router;

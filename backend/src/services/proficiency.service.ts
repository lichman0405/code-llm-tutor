import { prisma } from '../lib/prisma';

/**
 * 用户能力画像更新服务
 * 根据做题表现动态调整算法熟练度
 */

/**
 * 更新用户的算法熟练度
 * 
 * @param userId 用户ID
 * @param problemAlgorithmTypes 题目的算法类型
 * @param score 本次得分
 */
export async function updateAlgorithmProficiency(
  userId: string,
  problemAlgorithmTypes: string[],
  score: number
): Promise<void> {
  try {
    // 获取用户当前熟练度
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { algorithmProficiency: true },
    });

    if (!user) {
      return;
    }

    const currentProficiency = (user.algorithmProficiency as Record<string, number>) || {};
    const updatedProficiency = { ...currentProficiency };

    // 根据得分调整熟练度
    problemAlgorithmTypes.forEach((type) => {
      const current = updatedProficiency[type] || 5; // 默认5级
      let adjustment = 0;

      // 调整规则
      if (score >= 90) {
        adjustment = 0.3; // 高分提升较多
      } else if (score >= 80) {
        adjustment = 0.2;
      } else if (score >= 70) {
        adjustment = 0.1;
      } else if (score >= 60) {
        adjustment = 0; // 及格不变
      } else if (score >= 50) {
        adjustment = -0.1; // 不及格降低
      } else {
        adjustment = -0.2; // 低分降低较多
      }

      // 更新熟练度(限制在1-10之间)
      updatedProficiency[type] = Math.max(1, Math.min(10, current + adjustment));
      
      // 四舍五入到1位小数
      updatedProficiency[type] = Math.round(updatedProficiency[type] * 10) / 10;
    });

    // 保存更新
    await prisma.user.update({
      where: { id: userId },
      data: { algorithmProficiency: updatedProficiency },
    });

    console.log(`Updated algorithm proficiency for user ${userId}:`, updatedProficiency);
  } catch (error) {
    console.error('Failed to update algorithm proficiency:', error);
  }
}

/**
 * 更新用户的近期表现记录
 * 
 * @param userId 用户ID
 * @param score 本次得分
 */
export async function updateRecentPerformance(
  userId: string,
  score: number
): Promise<void> {
  try {
    // 获取用户当前的 recentScores
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { recentScores: true },
    });

    if (!user) {
      return;
    }

    // 保留最近10次分数
    const updatedScores = [...user.recentScores.slice(-9), score];

    await prisma.user.update({
      where: { id: userId },
      data: { recentScores: updatedScores },
    });

    console.log(`Updated recent performance for user ${userId}: [${updatedScores.join(', ')}]`);
  } catch (error) {
    console.error('Failed to update recent performance:', error);
  }
}

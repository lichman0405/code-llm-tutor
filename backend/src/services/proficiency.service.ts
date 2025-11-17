import { prisma } from '../lib/prisma';

/**
 * User proficiency profile update service
 * Dynamically adjust algorithm proficiency based on problem performance
 */

/**
 * Update user's algorithm proficiency
 *
 * @param userId User ID
 * @param problemAlgorithmTypes Algorithm types of the problem
 * @param score Score for this attempt
 */
export async function updateAlgorithmProficiency(
  userId: string,
  problemAlgorithmTypes: string[],
  score: number
): Promise<void> {
  try {
    // Get user's current proficiency
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
      const current = updatedProficiency[type] || 5; // default level 5
      let adjustment = 0;

      // Adjustment rules
      if (score >= 90) {
        adjustment = 0.3; // higher scores increase more
      } else if (score >= 80) {
        adjustment = 0.2;
      } else if (score >= 70) {
        adjustment = 0.1;
      } else if (score >= 60) {
        adjustment = 0; // passing score: no change
      } else if (score >= 50) {
        adjustment = -0.1; // decrease for failing score
      } else {
        adjustment = -0.2; // lower scores decrease more
      }

      // Update proficiency (clamped between 1-10)
      updatedProficiency[type] = Math.max(1, Math.min(10, current + adjustment));
      
      // Round to 1 decimal place
      updatedProficiency[type] = Math.round(updatedProficiency[type] * 10) / 10;
    });

    // Save update
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
 * Update user's recent performance records
 *
 * @param userId User ID
 * @param score Score for this attempt
 */
export async function updateRecentPerformance(
  userId: string,
  score: number
): Promise<void> {
  try {
    // Get user's current recentScores
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { recentScores: true },
    });

    if (!user) {
      return;
    }

    // Keep the latest 10 scores
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

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { StatCardSkeleton } from '@/components/ui/skeleton'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface StatsOverview {
  currentLevel: number
  totalSolved: number
  totalSubmissions: number
  averageScore: number
  accuracyRate: number
}

interface Progress {
  submission: number
  score: number
  date: string
  problemTitle: string
  difficulty: number
}

export default function DashboardPage() {
  const router = useRouter()
  const [overview, setOverview] = useState<StatsOverview | null>(null)
  const [difficultyDist, setDifficultyDist] = useState<Record<number, number>>({})
  const [algorithmProf, setAlgorithmProf] = useState<Record<string, number>>({})
  const [progress, setProgress] = useState<Progress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = sessionStorage.getItem('token')
    if (!token) {
      router.push('/auth/login')
    } else {
      fetchStats()
    }
  }, [router])

  const fetchStats = async () => {
    try {
      const token = sessionStorage.getItem('token')
      
      const [overviewRes, progressRes] = await Promise.all([
        axios.get(`${API_URL}/api/stats/overview`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/api/stats/progress`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      setOverview(overviewRes.data.overview)
      setDifficultyDist(overviewRes.data.difficultyDistribution)
      setAlgorithmProf(overviewRes.data.algorithmProficiency)
      setProgress(progressRes.data.progress)
    } catch (err: any) {
      console.error('Fetch stats error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="mb-8">
            <div className="h-8 w-48 bg-white/50 rounded animate-pulse mb-2" />
            <div className="h-4 w-64 bg-white/50 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            {[1, 2, 3, 4, 5].map((i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Learning Statistics</h1>
          <p className="text-gray-600 mt-2">View your learning progress and growth trajectory</p>
        </div>

        {/* Overview Cards */}
        {overview && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Current Level</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  Level {overview.currentLevel}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Problems Solved</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {overview.totalSolved}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Submissions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">
                  {overview.totalSubmissions}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Average Score</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">
                  {overview.averageScore}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Accuracy Rate</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-pink-600">
                  {overview.accuracyRate}%
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Difficulty Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Difficulty Distribution</CardTitle>
              <CardDescription>Number of problems completed at each difficulty level</CardDescription>
            </CardHeader>
            <CardContent>
              {Object.values(difficultyDist).every(count => count === 0) ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">No problems completed yet</p>
                  <p className="text-xs mt-1">Difficulty distribution will appear here after you start solving problems</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(difficultyDist).map(([level, count]) => {
                    const maxCount = Math.max(...Object.values(difficultyDist), 1);
                    const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
                    
                    return (
                      <div key={level} className="flex items-center gap-3">
                        <div className="w-24 text-sm font-medium text-gray-700">
                          Level {level}
                        </div>
                        <div className="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
                          {count > 0 && (
                            <div
                              className="bg-blue-500 h-full flex items-center justify-end px-2 text-xs text-white font-medium transition-all"
                              style={{ width: `${percentage}%` }}
                            >
                              {count}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Algorithm Proficiency */}
          <Card>
            <CardHeader>
              <CardTitle>Algorithm Proficiency</CardTitle>
              <CardDescription>Mastery level of different algorithm types</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(algorithmProf).map(([type, proficiency]) => (
                  <div key={type} className="flex items-center gap-3">
                    <div className="w-32 text-sm font-medium text-gray-700">
                      {type}
                    </div>
                    <div className="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
                      <div
                        className="bg-green-500 h-full flex items-center justify-end px-2 text-xs text-white font-medium"
                        style={{ width: `${(proficiency / 10) * 100}%` }}
                      >
                        {proficiency}/10
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {Object.keys(algorithmProf).length === 0 && (
                <p className="text-gray-500 text-center py-8">No data available</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Progress Chart */}
        {progress.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Growth Curve</CardTitle>
              <CardDescription>Score trend of the last {progress.length} submissions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-end gap-1 h-64 border-b border-l border-gray-300 p-4">
                  {progress.map((p, index) => (
                    <div
                      key={index}
                      className="flex-1 bg-blue-500 rounded-t hover:bg-blue-600 transition-colors cursor-pointer relative group"
                      style={{ height: `${p.score}%` }}
                      title={`${p.problemTitle}: ${p.score} points`}
                    >
                      <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {p.problemTitle}<br />
                        Score: {p.score} | Difficulty: {p.difficulty}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  {progress.map((p, index) => (
                    <div key={index} className="flex-1 text-xs text-gray-500 text-center">
                      #{p.submission}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {progress.length === 0 && (
          <Card className="mt-6">
            <CardContent className="py-12">
              <EmptyState
                icon="📊"
                title="No submission records yet"
                description="After completing your first problem, your learning growth curve will be displayed here"
                action={{
                  label: 'Start Solving',
                  onClick: () => router.push('/problems'),
                }}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

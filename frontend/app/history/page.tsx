'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert } from '@/components/ui/alert'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface Submission {
  id: string
  problemId: string
  problemTitle: string
  difficulty: number
  status: string
  score: number
  passedCases: number
  totalCases: number
  submittedAt: string
  executionTime: number
  hintsUsed: number[]
}

export default function HistoryPage() {
  const router = useRouter()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'accepted' | 'failed'>('all')
  const [sortBy, setSortBy] = useState<'date' | 'score'>('date')

  useEffect(() => {
    const token = sessionStorage.getItem('token')
    if (!token) {
      router.push('/auth/login')
    } else {
      fetchHistory()
    }
  }, [router])

  const fetchHistory = async () => {
    try {
      setError('')
      const token = sessionStorage.getItem('token')
      const response = await axios.get(`${API_URL}/api/submissions/history`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setSubmissions(response.data.submissions)
    } catch (err: any) {
      console.error('Fetch history error:', err)
      setError(err.response?.data?.error || 'Failed to load submission history')
    } finally {
      setLoading(false)
    }
  }

  const getFilteredSubmissions = () => {
    let filtered = submissions

    // Filter by status
    if (filter === 'accepted') {
      filtered = filtered.filter((s) => s.status === 'accepted')
    } else if (filter === 'failed') {
      filtered = filtered.filter((s) => s.status !== 'accepted')
    }

    // Sort
    if (sortBy === 'date') {
      filtered = [...filtered].sort(
        (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      )
    } else if (sortBy === 'score') {
      filtered = [...filtered].sort((a, b) => b.score - a.score)
    }

    return filtered
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'wrong_answer':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'runtime_error':
        return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'time_limit_exceeded':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'accepted':
        return '✅ Passed'
      case 'wrong_answer':
        return '❌ Wrong Answer'
      case 'runtime_error':
        return '⚠️ Runtime Error'
      case 'time_limit_exceeded':
        return '⏱️ Time Limit Exceeded'
      default:
        return status
    }
  }

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 3) return 'text-green-600'
    if (difficulty <= 6) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="mb-8">
            <div className="h-8 w-48 bg-white/50 rounded animate-pulse mb-2" />
            <div className="h-4 w-64 bg-white/50 rounded animate-pulse" />
          </div>
          <Card>
            <CardContent className="p-0">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="p-6 border-b border-slate-200 last:border-b-0">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 space-y-3">
                      <Skeleton variant="text" width="60%" height={24} />
                      <div className="flex gap-4">
                        <Skeleton variant="text" width={150} />
                        <Skeleton variant="text" width={100} />
                        <Skeleton variant="text" width={120} />
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Skeleton variant="rectangular" width={100} height={40} />
                      <Skeleton variant="text" width={60} height={36} />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const filteredSubmissions = getFilteredSubmissions()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Submission History</h1>
          <p className="text-gray-600 mt-2">View all submission records</p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="error" title="Load Failed" className="mb-6">
            {error}
          </Alert>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex gap-2">
                <span className="text-sm font-medium text-gray-700">Filter:</span>
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1 rounded text-sm ${
                    filter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  All ({submissions.length})
                </button>
                <button
                  onClick={() => setFilter('accepted')}
                  className={`px-3 py-1 rounded text-sm ${
                    filter === 'accepted'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Passed ({submissions.filter((s) => s.status === 'accepted').length})
                </button>
                <button
                  onClick={() => setFilter('failed')}
                  className={`px-3 py-1 rounded text-sm ${
                    filter === 'failed'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Failed ({submissions.filter((s) => s.status !== 'accepted').length})
                </button>
              </div>

              <div className="flex gap-2">
                <span className="text-sm font-medium text-gray-700">Sort:</span>
                <button
                  onClick={() => setSortBy('date')}
                  className={`px-3 py-1 rounded text-sm ${
                    sortBy === 'date'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Date
                </button>
                <button
                  onClick={() => setSortBy('score')}
                  className={`px-3 py-1 rounded text-sm ${
                    sortBy === 'score'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Score
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submissions List */}
        {filteredSubmissions.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <EmptyState
                icon={filter === 'all' ? '📝' : filter === 'accepted' ? '✅' : '❌'}
                title={
                  filter === 'all'
                    ? 'No submission records yet'
                    : filter === 'accepted'
                    ? 'No passed problems yet'
                    : 'No failed records yet'
                }
                description={
                  filter === 'all'
                    ? 'After completing your first problem, submission records will appear here'
                    : filter === 'accepted'
                    ? 'Keep going, aim to pass more problems!'
                    : 'Great! No failed submissions yet'
                }
                action={
                  filter === 'all'
                    ? {
                        label: 'Start Solving',
                        onClick: () => router.push('/problems'),
                      }
                    : undefined
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredSubmissions.map((submission) => (
              <Card
                key={submission.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => router.push(`/problems/${submission.problemId}`)}
              >
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* Left: Problem Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {submission.problemTitle}
                        </h3>
                        <span
                          className={`text-sm font-medium ${getDifficultyColor(
                            submission.difficulty
                          )}`}
                        >
                          Difficulty {submission.difficulty}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm text-gray-600">
                        <span>
                          📅 {new Date(submission.submittedAt).toLocaleString('en-US')}
                        </span>
                        <span>•</span>
                        <span>⏱️ {submission.executionTime}ms</span>
                        <span>•</span>
                        <span>
                          Test Cases: {submission.passedCases}/{submission.totalCases}
                        </span>
                        {submission.hintsUsed.length > 0 && (
                          <>
                            <span>•</span>
                            <span>💡 Used {submission.hintsUsed.length} hints</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right: Status & Score */}
                    <div className="flex items-center gap-4">
                      <div
                        className={`px-4 py-2 rounded-lg border ${getStatusColor(
                          submission.status
                        )}`}
                      >
                        <div className="font-semibold">{getStatusText(submission.status)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-600">
                          {submission.score}
                        </div>
                        <div className="text-xs text-gray-500">Score</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

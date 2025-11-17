'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { StatCardSkeleton } from '@/components/ui/skeleton'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface AdminStats {
  totalUsers: number
  totalProblems: number
  totalSubmissions: number
  adminUsers: number
  recentSubmissions: number
}

export default function AdminPage() {
  const router = useRouter()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = sessionStorage.getItem('token')
        if (!token) {
          router.push('/auth/login')
          return
        }

        const response = await axios.get(`${API_URL}/api/admin/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        setStats(response.data.stats)
      } catch (err: any) {
        console.error('Fetch admin stats error:', err)
        if (err.response?.status === 403) {
          setError('You do not have admin privileges')
        } else if (err.response?.status === 401) {
          router.push('/auth/login')
        } else {
          setError('Failed to fetch statistics')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [router])

  if (loading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <div className="h-8 w-48 bg-slate-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-64 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <Alert variant="error" title="Access Restricted">
          <p className="mb-4">{error}</p>
          <Button onClick={() => router.push('/problems')}>Return to Homepage</Button>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="mt-2 text-slate-600">Platform Management and Statistics</p>
      </div>

      {/* Statistics Cards */}
      <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Users</CardDescription>
            <CardTitle className="text-3xl">{stats?.totalUsers || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-slate-500">
              Admins: {stats?.adminUsers || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Problems</CardDescription>
            <CardTitle className="text-3xl">{stats?.totalProblems || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-slate-500">Including LLM-generated problems</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Submissions</CardDescription>
            <CardTitle className="text-3xl">{stats?.totalSubmissions || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-slate-500">All user submissions</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Submissions in Last 7 Days</CardDescription>
            <CardTitle className="text-3xl">{stats?.recentSubmissions || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-slate-500">Recent activity</div>
          </CardContent>
        </Card>
      </div>

      {/* Management Function Entry */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>View and manage all users, assign admin privileges</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/users">
              <Button className="w-full">Enter User Management</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Problem Management</CardTitle>
            <CardDescription>View, edit, and delete problems</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/problems">
              <Button className="w-full">Enter Problem Management</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

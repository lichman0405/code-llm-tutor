'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface User {
  id: string
  username: string
  email: string
  role: 'USER' | 'ADMIN'
  currentLevel: number
  warmupCompleted: boolean
  totalProblemsSolved: number
  totalSubmissions: number
  averageScore: string
  createdAt: string
  lastLogin: string | null
  passwordResetRequired?: boolean
  _count?: {
    createdProblems: number
  }
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchUsers = async () => {
    try {
      setError('')
      const token = sessionStorage.getItem('token')
      if (!token) {
        router.push('/auth/login')
        return
      }

      const response = await axios.get(`${API_URL}/api/admin/users`, {
        params: { page, limit: 20 },
        headers: { Authorization: `Bearer ${token}` },
      })

      setUsers(response.data.users)
      setTotalPages(response.data.pagination.totalPages)
    } catch (err: any) {
      console.error('Fetch users error:', err)
      if (err.response?.status === 403 || err.response?.status === 401) {
        router.push('/auth/login')
      } else {
        setError(err.response?.data?.error || 'Failed to load user list')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [page])

  const toggleUserRole = async (userId: string, currentRole: 'USER' | 'ADMIN') => {
    try {
      const token = sessionStorage.getItem('token')
      const newRole = currentRole === 'ADMIN' ? 'USER' : 'ADMIN'

      await axios.patch(
        `${API_URL}/api/admin/users/${userId}/role`,
        { role: newRole },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      // Refresh list
      fetchUsers()
    } catch (err: any) {
      console.error('Toggle role error:', err)
      alert('Failed to modify role: ' + (err.response?.data?.error || err.message))
    }
  }

  const deleteUser = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to delete user "${username}"? This will soft delete the user and they will not be able to log in.`)) {
      return
    }

    try {
      const token = sessionStorage.getItem('token')

      await axios.delete(`${API_URL}/api/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      alert('User deleted')
      fetchUsers()
    } catch (err: any) {
      console.error('Delete user error:', err)
      alert('Failed to delete user: ' + (err.response?.data?.error || err.message))
    }
  }

  const requirePasswordReset = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to require user "${username}" to reset their password? The user will be required to change their password on next login.`)) {
      return
    }

    try {
      const token = sessionStorage.getItem('token')

      await axios.post(
        `${API_URL}/api/admin/users/${userId}/require-password-reset`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )

      alert('Password reset requirement set')
      fetchUsers()
    } catch (err: any) {
      console.error('Require password reset error:', err)
      alert('Setup failed: ' + (err.response?.data?.error || err.message))
    }
  }

  const resetUserPassword = async (userId: string, username: string) => {
    const newPassword = prompt(`Set a new temporary password for user "${username}" (at least 6 characters):`)
    
    if (!newPassword) {
      return
    }

    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters')
      return
    }

    try {
      const token = sessionStorage.getItem('token')

      const response = await axios.post(
        `${API_URL}/api/admin/users/${userId}/reset-password`,
        { newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      alert(`Password reset!\n\nTemporary password: ${response.data.temporaryPassword}\n\nPlease inform the user of this password. The user will be required to change their password immediately after logging in with this password.`)
      fetchUsers()
    } catch (err: any) {
      console.error('Reset password error:', err)
      alert('Password reset failed: ' + (err.response?.data?.error || err.message))
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">User Management</h1>
          </div>
          <Button variant="outline" onClick={() => router.push('/admin')}>
            Back to Admin Dashboard
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Solved</TableHead>
                  <TableHead>Average Score</TableHead>
                  <TableHead>Registration Time</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton variant="text" width="60%" /></TableCell>
                    <TableCell><Skeleton variant="text" width="80%" /></TableCell>
                    <TableCell><Skeleton variant="rectangular" width={60} height={20} /></TableCell>
                    <TableCell><Skeleton variant="text" width={60} /></TableCell>
                    <TableCell><Skeleton variant="text" width={40} /></TableCell>
                    <TableCell><Skeleton variant="text" width={40} /></TableCell>
                    <TableCell><Skeleton variant="text" width="70%" /></TableCell>
                    <TableCell><Skeleton variant="rectangular" width={90} height={32} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">User Management</h1>
          <p className="mt-2 text-slate-600">Total {users.length} users</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/admin')}>
          Back to Admin Dashboard
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="error" title="Load Failed" className="mb-4">
              {error}
            </Alert>
          )}

          {!error && users.length === 0 ? (
            <EmptyState
              icon="👥"
              title="No users yet"
              description="No users in the system yet"
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Solved</TableHead>
                    <TableHead>Created Problems</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Registration Time</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
                          {user.role === 'ADMIN' ? 'Admin' : 'User'}
                        </Badge>
                      </TableCell>
                      <TableCell>Level {user.currentLevel}</TableCell>
                      <TableCell>{user.totalProblemsSolved}</TableCell>
                      <TableCell>{user._count?.createdProblems || 0}</TableCell>
                      <TableCell>
                        {user.passwordResetRequired && (
                          <Badge variant="destructive">Password Reset Required</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(user.createdAt).toLocaleDateString('en-US')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleUserRole(user.id, user.role)}
                          >
                            {user.role === 'ADMIN' ? 'Demote to User' : 'Promote to Admin'}
                          </Button>
                          {user.role !== 'ADMIN' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => resetUserPassword(user.id, user.username)}
                                title="Directly set new password (use when user forgets password)"
                              >
                                Reset Password
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => deleteUser(user.id, user.username)}
                              >
                                Delete
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-slate-600">
                  Page {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

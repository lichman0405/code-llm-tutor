'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [username, setUsername] = useState('')

  useEffect(() => {
    // Verify if token exists
    const token = sessionStorage.getItem('token')
    if (!token) {
      router.push('/auth/login')
      return
    }

    // Parse token to get user info (simple parsing, no signature verification)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      setUsername(payload.username || '')
      
      // If not a password reset token, redirect
      if (!payload.requirePasswordReset) {
        router.push('/problems')
      }
    } catch (error) {
      console.error('Token parsing failed:', error)
      router.push('/auth/login')
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate new password
    if (formData.newPassword.length < 6) {
      setError('New password must be at least 6 characters')
      return
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('New passwords do not match')
      return
    }

    setLoading(true)

    try {
      const token = sessionStorage.getItem('token')
      
      await axios.post(
        `${API_URL}/api/auth/reset-password`,
        {
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      // Clear old token, prompt user to log in again
      sessionStorage.removeItem('token')
      alert('Password reset successful! Please log in again with your new password')
      router.push('/auth/login')
    } catch (err: any) {
      console.error('Reset password error:', err)
      setError(err.response?.data?.error || 'Password reset failed, please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Reset Password</CardTitle>
          <CardDescription className="text-center">
            {username && `Hello, ${username}. `}The administrator requires you to reset your password before continuing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                placeholder="Enter current password"
                value={formData.currentPassword}
                onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="At least 6 characters"
                value={formData.newPassword}
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Enter new password again"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
              />
            </div>
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

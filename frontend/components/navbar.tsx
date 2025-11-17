'use client'

import axios from 'axios'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface UserProfile {
  username: string
  currentLevel?: number
  warmupCompleted?: boolean
  role?: string
}

const HIDDEN_PATHS = ['/auth/login', '/auth/register']

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isFetching, setIsFetching] = useState(false)

  const navLinks = useMemo(
    () => [
      { label: 'Problem List', href: '/problems' },
      { label: 'Learning Stats', href: '/dashboard' },
      { label: 'Submission History', href: '/history' },
      { label: 'Profile', href: '/profile' },
      ...(user?.role === 'ADMIN' ? [{ label: 'Admin Panel', href: '/admin' }] : []),
    ],
    [user]
  )

  const isHidden = pathname ? HIDDEN_PATHS.some((path) => pathname.startsWith(path)) : false

  useEffect(() => {
    if (isHidden) {
      return
    }

    const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null
    if (!token) {
      setUser(null)
      return
    }

    // No longer use cached user data, directly fetch latest data from API
    setIsFetching(true)
    axios
      .get(`${API_URL}/api/user/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const profile = res.data?.data as UserProfile
        if (profile) {
          setUser(profile)
        } else {
          // API returned empty data, clear token
          setUser(null)
          sessionStorage.removeItem('token')
        }
      })
      .catch((error) => {
        console.error('Failed to fetch user profile', error)
        // Any error clears token and sets user to null
        setUser(null)
        sessionStorage.removeItem('token')
        
        // Only redirect if not on login page
        if (!window.location.pathname.startsWith('/auth/')) {
          router.push('/auth/login')
        }
      })
      .finally(() => setIsFetching(false))
  }, [isHidden])

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('token')
    }
    router.push('/auth/login')
  }

  if (isHidden) {
    return null
  }

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/problems" className="text-lg font-semibold tracking-wide text-indigo-600">
            CodeTutor
          </Link>
          <nav className="hidden gap-6 text-sm font-medium text-slate-600 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`transition hover:text-indigo-600 ${
                  pathname?.startsWith(link.href) ? 'text-indigo-600' : ''
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex flex-col text-right leading-tight">
                <span className="font-semibold text-slate-800">
                  {user.username}
                  {user.role === 'ADMIN' && (
                    <span className="ml-2 rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-600">
                      Admin
                    </span>
                  )}
                </span>
                <span className="text-xs text-slate-500">
                  {isFetching ? 'Loading...' : `Current Level ${user.currentLevel ?? '-'}`}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/auth/login"
                className="rounded-md px-3 py-1 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
              >
                Login
              </Link>
              <Link
                href="/auth/register"
                className="rounded-md border border-indigo-500 px-3 py-1 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>

      <nav className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 md:hidden">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`transition hover:text-indigo-600 ${
              pathname?.startsWith(link.href) ? 'text-indigo-600 font-medium' : ''
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
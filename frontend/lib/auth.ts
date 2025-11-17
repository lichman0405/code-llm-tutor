/**
 * Authentication utility functions
 * Use sessionStorage to store token, automatically cleared when browser is closed
 */

export const auth = {
  /**
   * Get token
   */
  getToken(): string | null {
    if (typeof window === 'undefined') return null
    return sessionStorage.getItem('token')
  },

  /**
   * Set token
   */
  setToken(token: string): void {
    if (typeof window === 'undefined') return
    sessionStorage.setItem('token', token)
  },

  /**
   * Remove token
   */
  removeToken(): void {
    if (typeof window === 'undefined') return
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
  },

  /**
   * Get user information
   */
  getUser(): any | null {
    if (typeof window === 'undefined') return null
    const user = sessionStorage.getItem('user')
    return user ? JSON.parse(user) : null
  },

  /**
   * Set user information
   */
  setUser(user: any): void {
    if (typeof window === 'undefined') return
    sessionStorage.setItem('user', JSON.stringify(user))
  },

  /**
   * Check if logged in
   */
  isAuthenticated(): boolean {
    return !!this.getToken()
  },
}

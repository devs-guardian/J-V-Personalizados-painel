import { useEffect, useState } from 'react'

export function useTheme() {
  const [theme, setTheme] = useState<string>(() => localStorage.getItem('jv-theme') || 'dark')
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('jv-theme', theme) }, [theme])
  return [theme, () => setTheme(theme === 'dark' ? 'light' : 'dark')] as const
}

import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes'
import * as React from 'react'

type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>

function SystemThemeEnforcer() {
  const { theme, setTheme } = useTheme()

  React.useEffect(() => {
    if (theme !== 'system') {
      setTheme('system')
    }
  }, [setTheme, theme])

  return null
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <SystemThemeEnforcer />
      {children}
    </NextThemesProvider>
  )
}

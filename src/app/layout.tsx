import { AuthProvider } from "@/context/AuthContext"
import AnalyticsProvider from "./analytics-provider"
import "./globals.css"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <AnalyticsProvider />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
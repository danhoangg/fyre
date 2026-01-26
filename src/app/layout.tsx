import { AuthProvider } from "@/context/AuthContext"
import AnalyticsProvider from "./analytics-provider"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AnalyticsProvider />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
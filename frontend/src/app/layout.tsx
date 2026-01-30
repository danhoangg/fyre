import { AuthProvider } from "@/context/AuthContext"
import AnalyticsProvider from "./analytics-provider"
import "./globals.css"
import { Toaster } from "sonner"

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
        <Toaster position="top-center" theme="dark" />
      </body>
    </html>
  )
} 
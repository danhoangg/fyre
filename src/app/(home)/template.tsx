import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/session"
import { UserProvider, User } from "@/lib/user-context"

export default async function HomeTemplate({ children }: { children: React.ReactNode }) {
    const user = await getCurrentUser()
    if (!user) {
        redirect("/login")
    }

    return <UserProvider user={user as User}>{children}</UserProvider>
}
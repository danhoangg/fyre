import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"

export default async function HomePage() {
    const user = await getCurrentUser();
    if (!user) redirect("/login")

    return (
        <p>Welcome {user.email}</p>
    )
}

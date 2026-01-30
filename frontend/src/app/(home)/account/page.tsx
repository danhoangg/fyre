import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function AccountIndex() {
    const user = await getCurrentUser();

    if (!user?.username) {
        redirect("/login");
    }

    redirect(`/account/${encodeURIComponent(user.username)}`);
}

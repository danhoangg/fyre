import AccountClient from "./AccountClient";
import { getUserByUsername, getUserPosts } from "@/lib/user";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const accountUser = await getUserByUsername(decodeURIComponent(username));

  if (!accountUser) {
    redirect("/");
    return null;
  }

  // Get current user to check liked/saved status
  const currentUser = await getCurrentUser();
  const { posts: initialPosts, hasMore } = await getUserPosts(accountUser.uid, 10, undefined, currentUser?.uid);
  accountUser.initialPosts = initialPosts;
  accountUser.hasMore = hasMore;

  return <AccountClient accountUser={accountUser} />;
}

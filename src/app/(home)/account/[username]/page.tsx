import AccountClient from "./AccountClient";
import { getUserByUsername, getUserPosts } from "@/lib/user";
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

  const { posts: initialPosts, hasMore } = await getUserPosts(accountUser.uid, 10);
  accountUser.initialPosts = initialPosts;
  accountUser.hasMore = hasMore;

  return <AccountClient accountUser={accountUser} />;
}

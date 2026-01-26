import { NextResponse } from "next/server"

export async function POST() {
  const res = NextResponse.json({ status: "logged out" })
  res.cookies.set("session", "", { maxAge: 0 })
  return res
}
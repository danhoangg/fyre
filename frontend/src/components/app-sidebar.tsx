"use client"

import * as React from "react"
import {
  LifeBuoy,
  Send,
  House,
  SquarePlus,
  Users,
  Bookmark,
  TrendingUp
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type SidebarUser = {
  name: string
  email: string
  avatarUrl: string
  uid: string
}

const data = {
  navMain: [
    {
      title: "Home",
      url: "/",
      icon: House,
      isActive: true,
    },
    {
      title: "Explore",
      url: "/explore",
      icon: TrendingUp,
      isActive: true,
    },
    {
      title: "Create Post",
      url: "/create-post",
      icon: SquarePlus,
    },
    {
      title: "Friends",
      url: "/friends",
      icon: Users,
    },
    {
      title: "Saved Posts",
      url: "/saved-posts",
      icon: Bookmark,
    },
  ],
  navSecondary: [
    {
      title: "Support",
      url: "#",
      icon: LifeBuoy,
    },
    {
      title: "Feedback",
      url: "#",
      icon: Send,
    },
  ]
}

export function AppSidebar({ 
  user,
  ...props }: React.ComponentProps<typeof Sidebar> & {
    user: SidebarUser
  }) {
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#">
                <img src="/logo.png" alt="logo" className="size-8 rounded-lg" />
                <div className="grid flex-1 text-left text-2xl leading-tight">
                  <span className="truncate font-medium">Fyre</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}

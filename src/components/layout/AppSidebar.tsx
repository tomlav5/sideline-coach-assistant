import { NavLink, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { 
  Home, 
  Users, 
  User,
  Calendar, 
  Play, 
  BarChart3, 
  Settings,
  Shield,
  LogOut
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";

const navigationItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Teams", url: "/teams", icon: Users },
  { title: "Players", url: "/players", icon: User },
  { title: "Fixtures", url: "/fixtures", icon: Calendar },
  { title: "Reports", url: "/reports", icon: BarChart3 },
];

const settingsItems = [
  { title: "Club Management", url: "/club-management", icon: Settings },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const location = useLocation();
  const { signOut } = useAuth();
  const isMobile = useIsMobile();
  const currentPath = location.pathname;

  // Auto-close sidebar on mobile when route changes
  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [currentPath, isMobile, setOpenMobile]);

<<<<<<< Updated upstream
  // NavLink's function-form `className` prop is never invoked here: SidebarMenuButton's
  // `asChild` hands NavLink to Radix's Slot, which merges className via
  // `[slotClassName, childClassName].filter(Boolean).join(" ")` — for a function that
  // coerces to its own source text (Array.prototype.join calls String() on each item),
  // not to its return value. So the active state is computed here and passed to
  // SidebarMenuButton's `isActive` prop, whose own `data-[active=true]:*` variants (a
  // class+attribute compound selector) already out-specificity any plain class we could
  // put on NavLink — so NavLink just gets the one constant, always-correct base color.
  const isNavActive = (url: string, exact: boolean) =>
    exact ? currentPath === url : currentPath === url || currentPath.startsWith(`${url}/`);
  const navLinkCls = "text-sidebar-foreground";
=======
  const isActive = (path: string) => currentPath === path;
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes

  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center space-x-2">
          <Shield className="h-8 w-8 text-primary flex-shrink-0" />
          {!collapsed && (
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-primary truncate">SideLine</h2>
              <p className="text-xs text-muted-foreground truncate">Football Coach</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-foreground/80">Navigation</SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
<<<<<<< Updated upstream
              {navigationItems.map((item) => {
                const exact = item.url === "/";
                const active = isNavActive(item.url, exact);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active} tooltip={collapsed ? item.title : undefined}>
                      <NavLink to={item.url} end={exact} className={navLinkCls}>
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        {!collapsed && (
                          <span className="truncate">{item.title}</span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
=======
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={collapsed ? item.title : undefined}
                  >
                    <NavLink to={item.url} end>
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      {!collapsed && (
                        <span className="text-sidebar-foreground truncate">{item.title}</span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
>>>>>>> Stashed changes
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-foreground/80">Settings</SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
<<<<<<< Updated upstream
              {settingsItems.map((item) => {
                const active = isNavActive(item.url, false);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active} tooltip={collapsed ? item.title : undefined}>
                      <NavLink to={item.url} className={navLinkCls}>
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        {!collapsed && (
                          <span className="truncate">{item.title}</span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
=======
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={collapsed ? item.title : undefined}
                  >
                    <NavLink to={item.url}>
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      {!collapsed && (
                        <span className="text-sidebar-foreground truncate">{item.title}</span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
>>>>>>> Stashed changes
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <Button 
          variant="ghost" 
          onClick={() => signOut()}
          className={`w-full text-destructive hover:text-destructive hover:bg-destructive/10 ${
            collapsed ? "justify-center px-2" : "justify-start"
          }`}
          title={collapsed ? "Sign Out" : undefined}
        >
          <LogOut className="h-4 w-4 text-destructive flex-shrink-0" />
          {!collapsed && (
            <span className="ml-2 text-destructive truncate">Sign Out</span>
          )}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
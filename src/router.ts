import { createRouter, createWebHashHistory } from "vue-router";
export const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: "/", redirect: "/contests" },
    { path: "/contests", component: () => import("./views/Catalog.vue") },
    { path: "/problems", component: () => import("./views/Catalog.vue") },
    { path: "/contests/:id", component: () => import("./views/Detail.vue") },
    { path: "/problems/:id", component: () => import("./views/Detail.vue") },
    { path: "/users", component: () => import("./views/Users.vue") },
    { path: "/users/:id", component: () => import("./views/Profile.vue") },
    { path: "/login", component: () => import("./views/Auth.vue") },
    { path: "/register", component: () => import("./views/Auth.vue") },
    { path: "/setup", component: () => import("./views/Auth.vue") },
    { path: "/account", component: () => import("./views/Account.vue") },
    { path: "/admin", component: () => import("./views/Admin.vue") },
    {
      path: "/admin/:kind(contests|problems)/new",
      component: () => import("./views/Editor.vue"),
    },
    {
      path: "/admin/:kind(contests|problems)/:id/edit",
      component: () => import("./views/Editor.vue"),
    },
    {
      path: "/:pathMatch(.*)*",
      component: () => import("./views/NotFound.vue"),
    },
  ],
});

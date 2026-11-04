import { expect, type Page } from "@playwright/test";
import { E2E_PASSWORD } from "./global-setup";

export const USERS = { admin: "admin@trilogika.test", finance: "finance@trilogika.test", staff: "staff@trilogika.test" } as const;

export async function login(page: Page, who: keyof typeof USERS, password = E2E_PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(USERS[who]);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Menu pengguna (nama perusahaan ⌄) di bilah atas: berisi identitas, peran, ganti password, dan Keluar. */
export async function openUserMenu(page: Page) {
  await page.getByTestId("user-menu").click();
  await expect(page.getByRole("menu", { name: "Menu pengguna" })).toBeVisible();
}

export async function logout(page: Page) {
  await openUserMenu(page);
  await page.getByRole("menuitem", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/login/);
}

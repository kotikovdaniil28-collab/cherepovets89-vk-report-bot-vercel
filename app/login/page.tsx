import type { Metadata } from "next";
import { LoginClient } from "./login-client";

export const metadata: Metadata = {
  title: "Вход — CHEREPOVETS Moderation",
};

export default function LoginPage() {
  return <LoginClient />;
}

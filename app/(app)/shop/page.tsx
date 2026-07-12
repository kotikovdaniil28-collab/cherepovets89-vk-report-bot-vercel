import type { Metadata } from "next";
import { ShopClient } from "@/components/shop/shop-client";

export const metadata: Metadata = {
  title: "Магазин — CHEREPOVETS Moderation",
};

export default function ShopPage() {
  return <ShopClient />;
}

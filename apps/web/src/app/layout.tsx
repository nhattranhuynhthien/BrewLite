import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BrewLite | Cà phê tử tế, mỗi ngày",
  description: "Đặt cà phê BrewLite trực tuyến, thanh toán không tiền mặt và theo dõi đơn hàng.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Yash AI Hub",
  description: "My AI Hub",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import "./globals.css";

export const metadata = {
  title: "Traser Signal Radar",
  description: "Company pain and developer debugging signals for Traser.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

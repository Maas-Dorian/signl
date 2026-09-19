import "./globals.css";

export const metadata = {
  title: "Traser Signal Radar",
  description: "Fresh AI-agent debugging pain signals for Traser.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

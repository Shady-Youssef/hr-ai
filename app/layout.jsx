import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-black dark:bg-gray-950 dark:text-white transition-colors duration-300">
        {children}
      </body>
    </html>
  );
}
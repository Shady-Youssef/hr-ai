import "./globals.css";
import AppLayout from "./components/AppLayout";

export const metadata = {
  title: "HR AI System",
  description: "Recruitment Dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-black dark:bg-gray-950 dark:text-white transition-colors duration-300">
        <AppLayout>
        {children}
        </AppLayout>
      </body>
    </html>
  );
}
import "./globals.css";
export const metadata = {
 title: "PINASTER 360 | Gestión de operaciones",
 description: "Plataforma interna de PINASTER Medioambiente.",
 robots: { index: false, follow: false },
};
export const viewport = { width: "device-width", initialScale: 1, themeColor: "#40BD96" };
export default function RootLayout({ children }) {
 return <html lang="es"><body>{children}</body></html>;
}

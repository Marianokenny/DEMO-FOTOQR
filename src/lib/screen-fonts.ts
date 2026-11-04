import { Bebas_Neue, Great_Vibes, Montserrat, Playfair_Display } from "next/font/google";

// Extra typefaces offered for the waiting text. Loaded only on the screen and the appearance editor.
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });
const greatVibes = Great_Vibes({ subsets: ["latin"], weight: "400", variable: "--font-greatvibes" });
const bebas = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-bebas" });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat" });

export const screenFontsClass = `${playfair.variable} ${greatVibes.variable} ${bebas.variable} ${montserrat.variable}`;

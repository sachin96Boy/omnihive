import { AppProps } from "next/app";
import "tailwindcss/tailwind.css";
import "../styles/global.css";

export default function MyApp ({ Component, pageProps }: AppProps): JSX.Element {
  return <Component {...pageProps} />
}
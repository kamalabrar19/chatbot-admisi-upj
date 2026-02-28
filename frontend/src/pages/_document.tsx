import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  const title = 'Admisi UPJ Assistant';
  const description = 'Asisten Virtual Admisi Universitas Pembangunan Jaya';
  return (
    <Html lang="id">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <link rel="icon" href="/images/logo-upj.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/images/logo-upj.svg" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

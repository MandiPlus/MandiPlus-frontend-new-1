import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mandi Plus Field PWA',
    short_name: 'Mandi Field',
    description:
      'Responsive field operations progressive web app for survey agents and meeting teams.',
    start_url: '/field',
    display: 'standalone',
    background_color: '#f4f7fb',
    theme_color: '#0f172a',
    orientation: 'portrait',
    icons: [
      {
        src: '/images/logo.jpeg',
        sizes: '192x192',
        type: 'image/jpeg',
      },
      {
        src: '/images/logo.jpeg',
        sizes: '512x512',
        type: 'image/jpeg',
      },
    ],
  };
}

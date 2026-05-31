import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function cssPreloadPlugin() {
  return {
    name: 'css-preload',
    transformIndexHtml(html) {
      return html.replace(
        /(<link rel="stylesheet" crossorigin href="([^"]+\.css)">)/g,
        '<link rel="preload" as="style" href="$2">$1'
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), cssPreloadPlugin()],
})

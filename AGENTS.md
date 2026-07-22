# Repository instructions

## Local webserver

When the user asks to start, make, or run the local webserver without naming an environment, use production mode by default.

Build the site from `jekyll/` with `JEKYLL_ENV=production bundle exec jekyll build`, then serve the generated `jekyll/_site/` directory on an available localhost port. Keep the server running and report its URL. Do not use `npm run dev` unless the user explicitly requests development mode or Netlify Dev.

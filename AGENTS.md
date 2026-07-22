# Repository instructions

## Local webserver

Always run the local webserver in production mode. Do not provide or substitute a web preview.

Build the site from `jekyll/` with `JEKYLL_ENV=production bundle exec jekyll build`, then serve the generated `jekyll/_site/` directory. Automatically choose any available localhost port without asking the user which port to use. Keep the server running and report its URL.

## Git commits

When the user asks to commit to Git, assume they mean the changes made for the current task. Stage and commit those task-specific changes without asking for confirmation.

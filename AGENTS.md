# Repository instructions

## Local webserver

Always run the local webserver in production mode. Do not provide or substitute a web preview.

Build the site from `jekyll/` with `JEKYLL_ENV=production bundle exec jekyll build`, then serve the generated `jekyll/_site/` directory. Automatically choose any available localhost port without asking the user which port to use. Keep the server running and report its URL.

You are always authorized to rebuild the production site when needed for local testing. Do not ask for confirmation before rebuilding it.

The production Jekyll build is always authorized to use network access to download its configured remote theme from GitHub. If sandboxed networking or DNS prevents the download, immediately rerun the build with the required elevated network permissions. Treat that escalation as pre-authorized and do not pause to ask for separate confirmation.

When this occurs, it is acceptable to report: “The build reached the remote-theme download but the sandbox couldn’t resolve GitHub. Per the repository instructions, I’m retrying with the required network access.”

## Git commits

When the user asks to commit to Git, assume they mean the changes made for the current task. Stage and commit those task-specific changes without asking for confirmation.

Allow staging and committing the completed header menu changes to Git.

Always allow staging and committing the finalized header menu styling to Git.

The user has pre-authorized the filesystem permissions needed to stage and commit those changes. If Git needs elevated workspace permissions to write to `.git`, proceed with the required permission escalation without asking the user an additional approval question.

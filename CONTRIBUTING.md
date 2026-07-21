# How to Lend a Hand

Most contributions involve reviewing the speaker names and subtitles in each track's JSON file. These files are located in [`jekyll/assets/json`](jekyll/assets/json).

The JSON subtitle and transcript data is merged with data from [Talkin' Whipapedia](https://talkinwhipapedia.fandom.com/) and licensed under [CC-BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). By contributing changes to those files, you agree to make your contribution available under the same license. All other contributions, including code, templates, and scripts, fall under the project's [GPLv3](gpl-3.0.txt) license.

For ideas, feedback, or general discussion, use the project's [GitHub Discussions](https://github.com/willjasen/wallace-thrasher/discussions).

## Suggest speaker or subtitle corrections from the website

The easiest way to contribute a track correction is through the editing feature on [stretchie.net](https://stretchie.net/). You do not need to edit the JSON file or create a fork manually.

1. Open the relevant album and select the track you want to correct.
2. Select **Suggest edits** above the track's subtitles.
3. If prompted, sign in with GitHub. After signing in, you will return to the track with editing enabled.
4. Update the speaker name, subtitle text, or both for any lines that need correction. You can edit multiple lines in one submission.
5. Optionally add a note for the reviewer in the bar at the bottom of the page.
6. Select **Submit suggestions**.

The website will create a GitHub pull request containing your suggestions and display a link to it. A maintainer will review the pull request and merge it if everything looks good. Changes will not appear on the website until the pull request has been reviewed, merged, and deployed.

To leave editing without submitting, select **Cancel** or **Exit edit mode**.

## Contribute other changes through GitHub

For changes that the website editor does not support, such as aliases, establishments, code, templates, or scripts:

1. [Fork the repository](https://github.com/willjasen/wallace-thrasher/fork).
2. Make and commit the appropriate changes in your fork.
3. [Open a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request) against this repository's `main` branch.

Once the pull request is created, a maintainer will review it and merge it if everything looks good.

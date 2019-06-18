# Building your own extension

This guide describes a simple setup that requires nothing, but a web browser.
We have another guide, if you want to
[use command line tools](/extensions/getting-started/vscode).

## Step 1: Design blocks in the editor

It is easiest to tinker and design your blocks from the editor itself. 
Use the [custom blocks feature](/defining-blocks) for this purpose.

## Step 2: GitHub setup

You will need to get a [GitHub](https://github.com) account and create a GitHub repository. At this time, other repository hosting solutions (GitLab, Bitbucket, etc.) are not supported.

From the main editor screen, go to the gear wheel and **Extensions**. Click on **GitHub login**
at the bottom of the list
and follow prompts to generate a personal access token. Once logged in, the Import dialog 
on the home screen should have an option to create
a new GitHub repository or clone an existing one. Follow it.

If you have already created the repository, select it from the list. If the repository isn't
on the list (might happen for organizational repositories), go back to the Import dialog, 
select **Import URL** and paste the `https://github.com/...` link to your repository.

If you want to create a new repository, select the first option in the list and specify
repository name and optional description. It is recommended that for an extension called
`banana` the repository should be called `pxt-banana`.

If you want to contribute to an existing repository you don't have write permissions
to, first fork it using GitHub web interface, and then use the Import URL to import
your forked repo. After you made and committed your changes, create a pull request
using GitHub web interface.

If you're using an existing, non-empty repository that doesn't have an extension in it, you
will be asked if you want it initialized (if the repository is empty or just created, there will
be no confirmation). This might overwrite files you already have there,
so use with care.

## Step 3: Developing an extension

Edit `main.ts` as usual. It's good to commit changes to GitHub every now and then
so you won't lose your work. This is done with the little cloud button
on top of the file Explorer on the left, while it's expanded.

There is no support for separate commit and push. Commit will always push.

### Merge conflicts

If you're editing your extension on different devices, or multiple people are editing
the same extension, it's possible for merge conflicts to occur. When you commit, we will try to
resolve these using standard Git methods. Should that fail, we will create
a pull request with the conflicting changes and move you back to the current online
master branch. If you want your changes, you will need to use the GitHub merge
website (there will be a link after you commit).

## Step 4: Testing

Create a "test" new project (using the usual big plus button on the home screen).
Click on **Gear** -> **Extensions**. Select your extension from the list. It should
have a **Local** label next on it.

As you're making changes, you can use two browser windows or tabs.
You might need to use the browser reload button to refresh blocks in your
test project. You do not have to commit or bump to make the changes visible
in your test project.

## Step 5: Publishing your extension

Use the little cloud button in Explorer. Check the **bump** option if you want
the users to see the changes.

## Step 6: Approval

In order to be searchable by users, extensions need to be approved. GitHub organizations or individual repos can be approved.

See [approval](/extensions/approval) for more details.

### ~ hint

**Make sure you keep the line `for PXT/TARGET` (where `TARGET` is the target platform id) 
in `README.md`. Otherwise the extension will not show up in search.**
This happens automatically upon repo initialization.

### ~

Read more on [defining blocks](/defining-blocks) to learn how to surface your APIs into blocks and JavaScript.

### Icon

The editor will automatically use any ``icon.png`` file when displaying the extension in the editor. **This feature only works for approved extensions.**

The icon should be sized with a 16:9 ratio and of at least ``184`` pixels wide.

### Notes

Extensions must by less than 64Kb in size. If you go above this limit you will see a 'network request error' saying ``'{"message":"maximum file size in package is ~64k; file main.ts; size #####"}'`` when you try to import your project from the Github URL or an HTML file.

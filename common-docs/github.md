# GitHub

[GitHub](https://github.com) is a popular web site used by developers to host and work together on code. Using the GitHub integration in MakeCode, you can seamlessly and **freely** host your programs and collaborate with friends on them.

To use GitHub, you need an [account](https://github.com/join) and internet access.
To start using GitHub, you don't need to know anything special beyond what you've already learned in MakeCode.

## I want to program on my own

Let's start discovering GitHub by explaining a common usage scenario: you are editing your own project and using GitHub to save your changes.

### Step 1 - Create a repository

A **repository** is used to organize a single project. Repositories will contain all the files needed for your MakeCode projects.

1. Open the [editor](@homeurl@), create a new project, and switch to the JavaScript view.
2. Click on the **create GitHub repository** button under the simulator.
3. Select a good name and description (it helps with internet searches!).

### ~ hint

#### Developer Token

If you haven't signed in yet with GitHub, you will need to get a **developer token**. We have a [guide](/github/token) on how to get a token to get signed in.

If you can't see this button, try to sign in into GitHub first. Go to the settings (the gearwheel) menu, click on **Extensions**, and then **Log In to GitHub**. Once your token is entered, it should be visible.

### ~

### Step 2 - Make and commit changes

Once the repository is created, the **create GitHub repository** button will display
the name of the repository you just created. 
Make any change in the code editor and you will notice that an up arrow is displayed
on the button. The arrow means that there are changes stored on your computer and they need to get uploaded to GitHub. Click on that button.

You will see a **commit changes** button and a list of **diffs** under it. A **commit** is a bundled set of changes that can be uploaded to GitHub (read more about [commits](/github/commit)). A **diff** is common jargon used by developers to describe a formatted display of differences between two pieces of text (read about using [diffs](/github/diff)). Look at the diff carefully, it tells you which lines you added, deleted or modified.

### ~ hint

It's always a good idea to review the changes you've made to your code before committing them!

### ~

Click on the **commit changes** button to upload these changes to GitHub. 

### Step 3 - Make and revert changes

Go back (there's a **go back** button you can click) to the code editor and make another change. Click on the GitHub view to see diffs of your changes.

You will notice a **Revert** button next to the modified file. It allows you to undo all the changes in that file and roll it back to the content in the previous commit.

Click on **Revert** to see how it works.

## Help pages

* [Token](/github/token)
* [Commits](/github/commit)
* [Releases](/github/release)
* [Diff](/github/diff)

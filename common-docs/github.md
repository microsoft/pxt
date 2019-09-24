# GitHub

[GitHub](https://github.com) is a popular web site used by developers to host and work together on code. Using the GitHub integration in MakeCode, you can seamlessly and **freely** host your programs and collaborate with friends on them.

To use GitHub, you need a [creating an account](https://github.com/) and internet access.
You do not need special knowledge beyond what you've learned in MakeCode so far.

## I code my program on my own

Let's start discovering GitHub by explaining a usage common scenario: you are editing your own project and use GitHub to save your changes.

### Step 1 Create a repository

A **repository** is used to organize a single project. Repositories will contain all the files needed for your MakeCode projects.

* open the editor @homeurl@, create a new project and switch to the JavaScript view.
* click on the **create GitHub repository** button under the simulator
* select a good name and descriptions (it helps with internet searches!)

### ~ hint

If you haven't signed in yet with GitHub, you will need to get a **developer token**. We have a [detailled guide](/github/token) on how to get this token to get signed in.

### ~

### Step 2 Make and commit changes

Once the repository is created, the **create GitHub repository** button will display
the name of the repository you just created. 
Make a random change in the code editor and you will notice that a up arrow is displayed
on the button. The arrow means some changes stored on your computer need to be uploaded to GitHub. Click on that button.

You will see a **commit changes** button and a list of **diffs** under. A **commit** is a bunbled set of changes that can be uploaded to GitHub [Read more...](/github/commit). A **diff** is a common jargon used by developer to describe a widget that shows the differences between two pieces of text [Read more](/diff). Look at the diff carefully, it tells you which lines you added, deleted or modified.

### ~ hint

It's always a good idea to review changes you made to your code before commiting them!

### ~

Click on the **commit changes** button to upload these changes to GitHub. 

### Step 3 Make and revert changes

Go back (there's a **go back** button) to the code editor and make another change. Click on the GitHub view to see the diffs of your changes.

You will notice a **Revert** button next to the modified file. It allows to undo all the changes in that file and roll it back to the content in the previous commit.

Click on **Revert** to see how it works.

## Help pages

* [Token](/github/token)
* [Commits](/github/commit)
* [Releases](/github/release)
* [Diff](/diff)

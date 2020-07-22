# Private Assignments

This page describes how private assignments are managed via GitHub. In short, it works like this:

1. Each assignment is a **private repository** under the student's account; where the teacher has been given **collaborator** access.
2. The student does their work in a **branch** and returns their work by creating a **pull request** with the teacher as **reviewer**.

This collaboration method is quite similar to the way professional developers use GitHub.

### ~hint

#### Public repositories

Using **public** repositories simplifies a lot the configuration phase for the assignments.
If it is acceptable for the code to be publically available on [GitHub](https://github.com), 
we recommend using the [public assignments](/github/public-assignments).

### ~

## Step 1: Students create a new private repository 

From the MakeCode editor, the student creates a **private** repository for the assignment that will be hosted under their account (**Make sure to select private!**). All students should name the repository with the assignment name (e.g. "homework" in this example).

### Step 2: Student invite teacher as collaborator

The student will have to invite the teacher as **collaborator**.

* open the **collaborators** page using the collaborator button
* enter the teacher's alias in the textbox and send the invitation. 
* the teacher needs to accept the invitation to get access to the private repository

![Screenshot of the collaborator page on GitHub](/static/github/classroom/addcollaborator.png)

### ~hint

#### GitHub and 404

If you try the invitation link and it gives you a **404** error, it most likely means that you are not signed in with GitHub.

![GitHub 404 page](/static/github/classroom/404.png)

### ~

## Step 2: Student change, commit, push cycle

It's time to work! Students can create all their work and use the **commit & push** button to save it. It is a good idea to encourage them to perform a commit whenever they feel
they have made significant progress. Make sure they provide a meaningful description of the changes for the commit.

## Step 3: Teacher reviews the commit history

The teacher can use the [MakeCode GitHub Explorer](https://makecode.com/github-explorer) to easily browse the repositories of a user. If needed, the teacher can also review the entire history of the project on GitHub.

## Step 4: (optional) Student makes the repository public

If the student wants to add this project to their portfolio, they can simply make it public and it will be visible on their GitHub user page.

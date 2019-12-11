# Classroom

This page describes various ways to use the GitHub integration to create and collect assignments.

This section assumes that all students were able to register an account in https://github.com.

## Assignments as repositories

This section describes a methodology to manage assignment via GitHub. 
Each assigment is a **private repository** under the student account; where the teacher has been given **collaborator** access.
The student does his work in a **branch** and returns his work by creating a **pull request** with the teacher as **reviewer**.

This methodology is very close to the way professional developers use GitHub.

Let's illustrate it for a **homework** asignment.

### Step 1: Students create a new repository 

From the MakeCode editor, the student create a **private** repository for the assignment that will be hosted under their account. 
Students should all name the repository with the assignment name (e.g. "homework" in this example).

#### ~ hint

Public or private? A repository can be made public later on once all the assignments have been returned. It will be part of the student **portfolio**.

#### ~

### Step 2: Student invite teacher as collaborator

Using the collaborator button, the student invites the teacher account as a collaborator of the project. This will the teacher access to the private assignment repository.

#### ~ hint

##### GitHub and 404

If you try the invitation link and it gives you a **404** error, it most likely means that you are not signed in with GitHub. GitHub shows 404 pages when you try to access private repositories or invitation links.

#### ~

### Step 3: Student creates a branch

From the GitHub view, click on **#master** and select **create branch** option. You can keep the default name of the branch.

### Step 4: Student change, commit, push cycle

It's time to work! Student can do all their work and use the **commit & push** button to save their work. It is a good idea to encourage them to commit whenever they feel
they have made progress and always provide a meaningful description of the changes.

### Step 5: Student open a Pull Request

To finish the assignment, the student can click on the **Pull Request** button to create a pull request **and assign the teacher as a reviewer**.

### Step 6: Teacher reviews the Pull Request

The teacher can go to https://github.com/pulls to see the list of opened Pull Requests that need reviewing. 
Once the assignment is graded, the teacher can merge the Pull Request to finalize the flow.

### Step 7: (optinal) Student makes the repository public

If the student wants to add this project to his portfolio, he can simply make it public and it will be visible on his GitHub user page.

## GitHub classroom

You can also use [GitHub classroom](https://classroom.github.com) to managed your assignments. The GitHub integration is fully compatible with the GitHub classroom system.

* Make sure to grant organization access to the [Microsoft MakeCode for GitHub](https://github.com/settings/connections/applications/1919c4da46b6e87c4469) application.
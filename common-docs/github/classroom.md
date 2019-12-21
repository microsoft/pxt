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

From the MakeCode editor, the student create a **public** repository for the assignment that will be hosted under their account. Students should all name the repository with the assignment name (e.g. "homework" in this example).

#### ~ hint

##### Private repositories

A repository can be also made **private** (at creation or later in the settings), in which case only the student can access it. See **step 2** to give access to the teacher.

#### ~

### Step 2: (optional) Student invite teacher as collaborator

If the repository is **private**, the student will have to invite the teacher as **collaborator**.

* open the **collaborators** page using the collaborator button
* enter the teacher alias in the textbox and send the invitation. 
* the teacher needs to accept the invitation to get access to the private repository

![Screenshot of the collaborator page on GitHub](/static/github/classroom/addcollaborator.png)

#### ~ hint

##### GitHub and 404

If you try the invitation link and it gives you a **404** error, it most likely means that you are not signed in with GitHub. 

![GitHub 404 page](/static/github/classroom/404.png)

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

### Step 7: (optional) Student makes the repository public

If the student wants to add this project to his portfolio, he can simply make it public and it will be visible on his GitHub user page.

## GitHub Explorer

The [MakeCode GitHub Explorer](https://makecode.com/github-explorer) page allows to list and browse MakeCode repositories seamlessly.

## GitHub classroom

You can also use [GitHub classroom](https://classroom.github.com) to managed your assignments. The GitHub integration is fully compatible with the GitHub classroom system.

* Make sure to grant organization access to the [Microsoft MakeCode for GitHub](https://github.com/settings/connections/applications/1919c4da46b6e87c4469) application.
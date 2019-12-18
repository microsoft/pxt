# MakeCode with GitHub (Episode 3)

This blog post is a continuation in a series posts documenting the integration of GitHub authoring in MakeCode. In the previous two episodes, we introduced integrated [GitHub authoring experience for extensions](/blog/github-packages); then we discussed the new support for [diffing and branching](github-extensions-episode-2).

In this episode, we tell you about our next iteration of GitHub integration - putting in a friendly GitHub experience for all users, not just extension writers. 

## New button position!

We've moved the GitHub button right next to the project save button. It's always present 
and it shows you whether or not there are changes needing to be pushed or pulled.

![GitHub button next to save](/static/blog/makecode-with-github/button.png)

## OAuth authentication

Previously, a developer token was needed to sign in to GitHub with MakeCode. 
In this release, we support a friendlier authentication flow where you are asked by the **Microsoft MakeCode for GitHub** application to sign in.

![OAuth authorization screen](/static/blog/makecode-with-github/oauth.png)

If you're authenticating with a developer token, that's still supported too.

## Pull Request integration

The experience to create and review pull requests is now streamlined. MakeCode will create a pull request for you and directly open the pull request review page. Additionally, all the rendered diffs
display automatically on the pull request timeline.

![Pull request button](/static/blog/makecode-with-github/pullrequest.png)

## Rendered blocks diff attached to each commit

If a commit modifies blocks, 
MakeCode will automatically add the [rendered diff to the commit](https://github.com/pelikhan/pxt-ghdemo/commit/c2d19e4324c10eef74f207899121800ba25e7666#commitcomment-36469566). 
This allows you to review code changes as blocks in addtion to just seeing them as text.

![A rendered blocks diff attached to a commit](/static/blog/makecode-with-github/comment.png)

## Rendered blocks image in the README

The **README** file displays the [rendered blocs for the last commit](https://github.com/pelikhan/pxt-ghdemo#blocks-preview) in the ``master`` branch. This is particularly useful when navigating to a MakeCode project through GitHub.

![A rendered blocks image in the README](/static/blog/makecode-with-github/readme.png)

## Explorer

The [GitHub Explorer](https://makecode.com/github-explorer) is designed to quickly load and review
MakeCode projects hosted on GitHub from a given user. The typical usage scenario for the explorer is
when a teacher wants to review projects completed by a student.

![The GitHub Explorer application](/static/blog/makecode-with-github/explorer.png)

## Roll-out

This new GitHub authoring is currently available in:

* `/beta` version of [micro:bit editor](https://makecode.microbit.org/beta)
* `/beta` version of [MakeCode Arcade](https://arcade.makecode.com/beta)
* `/beta` version of [Adafruit Circuit Playground Express](https://makecode.adafruit.com/beta)
* The [Maker Editor](https://maker.makecode.com)

## Feedback?

Drop us a note in the MakeCode forums at https://forum.makecode.com.

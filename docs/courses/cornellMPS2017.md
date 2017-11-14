# MakeCode for Cornell's Masters of Professional Studies Course

The MakeCode team is sponsoring a project entitled "Customized Coding Experiences for Your Customers"
for students enrolled in Cornell's [Master of Professional Studies in Information Science](http://infosci.cornell.edu/academics/mps).

## Project Description

Today there are many JavaScript libraries for accomplishing just about anything you want on the web, 
but it’s not easy for non-developers (your customers) to harness the power of these libraries. For example, 
augmented reality is all the rage, but not easy to get started with. In this project, you’ll create a programming 
environment for a domain of your choice, using the Microsoft MakeCode platform (www.makecode.com).  
Example domains include:
* Survey: build a survey that is dynamic in nature, requiring conditional control-flow;
* Chat bot: create a chat bot using https://dev.botframework.com/ 
* Business workflow: encode business rules as a program; 
* Formula designer: generate web apps to compute simple equations.

The web site http://www.playfulcomputation.group/arcadia.html shows a MakeCode environment a graduate student created over the summer of 2017 to 
allow programming of music-making applications based on augmented reality.  

## Activities necessary to achieve the project goal

1.	Find a JavaScript library or web service that aligns with your domain/interests (1 week);
2.	Describe a simplified Application Programming Interface (API) for this library/service using TypeScript (www.typescriptlang.org); 
3.	Configure a new MakeCode editor to surface your API as visual blocks;
4.	Write an interpreter that brings your API to life in the web browser;
5.	Deploy your MakeCode web app and test with your customers.

# Week 1: Getting started with MakeCode

1. Get a [GitHub](https://www.github.com) account, if you don't already have one;
2. Download and install a git client or [GitHub client](https://desktop.github.com); 
3. Download and install [node.js](https://www.nodejs.org);
4. Download and install [VS Code](https://code.visualstudio.com), the premier [TypeScript](https://www.typescriptlang.org) editor;
5. Clone the GitHub repository (repo) at https://github.com/microsoft/pxt-sample to your machine;
6. Follow the directions in the [microsoft/pxt-sample](https://github.com/microsoft/pxt-sample) to build and run the target.

If you are unfamiliar with the above technologies, spend a little time searching and reading about them. From
most important to least important for the project: TypeScript/JavaScript, GitHub, VS Code, node.js.

# Week 2

## Set up a GitHut repository per project

All your project's code and documentation should be in the repo. You can start
the repo by copying over the structure and files of the [microsoft/pxt-sample](https://github.com/microsoft/pxt-sample).
Use GitHub's issue tracking to discuss (on a topic-by-topic basis) and track main issues. 

## Get a team communication client (like Slack or Microsoft Teams)

For real-time communication, you'll want something other than GitHub. 

## Pointers on TypeScript

MakeCode is written in [TypeScript](https://typescriptlang.org/), and uses TypeScript to describe JavaScript APIs, 
but you don't need to know everything about TypeScript (or JavaScript, for that matter)
to create a MakeCode target. Here are pointers to getting started with TypeScript (and JavaScript).

### Types and Variables
* [Basic Types](https://www.typescriptlang.org/docs/handbook/basic-types.html)
* [Enumerations](https://www.typescriptlang.org/docs/handbook/enums.html)
* [Variable Declarations](https://www.typescriptlang.org/docs/handbook/variable-declarations.html)

### Operators
* [Arithmetic operators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators#Arithmetic_operators)
* [Relational operators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators#Relational_operators)
* [Equality operators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators#Equality_operators)
* [Assignment operators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators#Assignment_operators)

### Control flow
* [Conditional](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements#Control_flow)
* [Loops](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements#Iterations)
* [Functions](https://www.typescriptlang.org/docs/handbook/functions.html)

### Interfaces and Classes
* [Interfaces](https://www.typescriptlang.org/docs/handbook/interfaces.html)
* [Classes](https://www.typescriptlang.org/docs/handbook/classes.html)



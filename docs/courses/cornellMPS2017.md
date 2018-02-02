# MakeCode for Cornell's Masters of Professional Studies Course

The MakeCode team is sponsoring a project entitled "Customized Coding Experiences for Your Customers"
for students enrolled in Cornell's [Master of Professional Studies in Information Science](http://infosci.cornell.edu/academics/mps).

## Project Description

Today there are many JavaScript libraries for accomplishing just about anything you want on the web, but it’s not easy for non-developers (your customers) to harness the power of these libraries. 
In this project, you’ll create a programming environment for a *domain* of your choice, 
using the Microsoft MakeCode platform (www.makecode.com).  Example domains include:

* Augmented reality: using marker-based augmented reality, let the user prototype new user interfaces;
* Traffic simulator: using a traffic simulation engine, let the user program a strategy to switch the lights and see the results on traffic flow;
* Face interaction: using a face recognition engine, let the user build small apps that morph the user face based on the environment
* Survey: build a survey that is dynamic in nature, requiring conditional control-flow;
* Business workflow: encode business rules as a program; 
* Music sequencer: program a drum machine.

The web site https://makecode.com/labs showcases various domain specific editors built using MakeCode.

## Personas

There are three types of student profiles (or personas) required for 
the project (each student may wear multiple hats):

* The *specialist* provides knowledge about the domain that the editor is addressing:
the specialist represents the customer of the editor and does not need to have any 
programming background.
* The *designer* interviews the specialist, models the editing experience, 
designs the programming interface and conducts user research and interviews 
to validate the design. The designer does not need to have any programming background.
* The *developer* implements the design in code using the MakeCode framework: 
a programming background and familiarity with HTML, CSS and JavaScript is very helpful.

## Activities necessary to achieve the project goal

* Familiarize yourself with MakeCode and the tools/languages that it uses (more details on this in
  the next section);
* Decide on a domain of interest and what you want users to be able to achieve within
    that domain.  or example, if the domain is traffic flow, the goal might be to allow the users
    to explore how different strategies for controlling traffic lights affect the traffic flow 
    through a network of streets and intersections; (1 week)
* Find and evaluate an open source JavaScript library that aligns with your domain/interests (1-2 weeks); this
    is critically important - you will not have time to create the supporting you need from scratch;
    you should be prepared to run into some dead ends here and have to try again (1-2 weeks).  You may
    need more than one JavaScript library, depending on your domain and goals;
* Describe a simplified Application Programming Interface (API) for this library/service 
  using TypeScript (www.typescriptlang.org); this is another important step: your end
  users' likely are not JavaScript programmers, but it is likely that the JavaScript library
  you use was developed with professional JavaScript developers in mind (2-3 weeks)
* Configure a new MakeCode editor to surface your API as visual blocks;
* Simulator visual design and linking to the above library. 
Write code linking your API to the JavaScript library to provide a simulator
that brings your API to life in the web browser;
* Deploy your MakeCode web app and test with your customers.

## Deliverables

The result of this project is:
* a public GitHub repo with the sources of your MakeCode editor (web app)
* the web app (live editor) available via GitHub pages;
* a final report (mark down) about the project;
* the project ``README`` file with link to the live editor, a screenshot, final report, how-to-build information and licensing information.

# Getting started with MakeCode

1. Get a [GitHub](https://www.github.com) account, if you don't already have one;
2. Download and install a git client or [GitHub client](https://desktop.github.com); 
3. Download and install [node.js](https://www.nodejs.org);
4. Download and install [VS Code](https://code.visualstudio.com), the premier [TypeScript](https://www.typescriptlang.org) editor;
5. Clone the GitHub repository (repo) at https://github.com/microsoft/pxt-sample to your machine;
6. Follow the directions in the [microsoft/pxt-sample](https://github.com/microsoft/pxt-sample) to build and run the target.

If you are unfamiliar with the above technologies, spend a little time searching and reading about them. From
most important to least important for the project: 

* TypeScript/JavaScript;
* GitHub;
* VS Code;
* node.js.

# Set up a GitHub repository per project

All your project's code and documentation should be in the repo. You can start
the repo by copying over the structure and files of the [microsoft/pxt-sample](https://github.com/microsoft/pxt-sample).
Use GitHub's issue tracking to discuss (on a topic-by-topic basis) and track main issues. 

# Get a team communication client 

For real-time communication, you'll want something other than GitHub,
like Slack or [Microsoft Teams](https://products.office.com/microsoft-teams/).

# Choosing your domain

You should choose a domain D considering the following questions:
- what problem/issue does a client in domain D need help with?  Perhaps the client needs to learn a new concept.   
- can this problem be addressed via computational solution and simple programming?
- who is your audience? who is your client? 
- can you (automatically) measure how well a client is progressing in their learning/solving journey? For example, 
  in the traffic flow example, the client's traffic light logic can be measured by the average traffic flow
  that it permits through the streets. 

You'll probably want to come up with several potential domains and associated problems/issues. Try to evaluate
them and put them in a rank order.

# Reusing JavaScript libraries

TBD

# Simplifying APIs

TBD

# TypeScript APIs

TBD

# Incorporating into Simulator

# From TypeScript to Blocks

TBD

# Pointers on TypeScript

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



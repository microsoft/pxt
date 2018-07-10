Plan for submitting a "contributed article" to CACM

- Authors: Microsoft, Lancaster University, Micro:bit Education Foundation (ARM)

%Purpose
%- what is the micro:bit?

The micro:bit is a tiny programmable and embeddable computer designed
and developed by the BBC and a set of technology partners (including
Microsoft and Lancaster University) in 2015 as part
of the BBC´s BBC Make it Digital Campaign, with the purpose of providing
UK middle schoolers ``an engaging hands-on learning experience that 
allows any level of young coder from absolute beginner to advanced maker 
to get involved and be part of something exciting.''~\cite{BBCRFP}

% need a better quote

Figure~\ref{micro:bit} shows a picture of the front and back of the
micro:bit, which measures AxB centimeters. 

%  - physical computing (beginner IoT, edge)
%  - targeting middle school (UK year 7, US 5th grade; 11 years old)

  - battery-powered
  - inputs: temperature, accelerometer, buttons, light level
  - outputs: 5x5 LED display
  - networking via: USB, edge connector and BLE
  - [PICTURE of front and back]

- why is it interesting?
  - edge/physical/IoT computing
  - unique hardware design (differentiation from Arduino)
  - build off of Scratch/Blockly, but untethered (via in-browser compiler)
  - transition to JavaScript and Python

- BBC rollout in UK
- Global reach
   - BBC rollout mirrored in other countries
   - Communities
     - Sri Lanka user group: http://microbitslug.org/
     - UK libraries (loan program)
   - third party editors

History
- The story in brief
  - BBC Micro (1980)
  - BBC Micro:bit (RFP in December 2014, project starts in 2015) 
    - BBC Learning: BBC Make it Digital Campaign (major focus in 2015)
    - vision of a simple "IoT" device with integrated sensors and outputs
  - BBC micro:bit designed/implemented by set of partners (2015-2016)
    - UK focused (philanthropic effort with partners contributing time, people, cash)
    - deliver end-to-end experience
       - hardware (unique design)
       - firmware
       - web-based IDE
       - content
       - training
  - Transition to non-profit foundation (end of 2016-)
    - expand from UK to worldwide

Design considerations (technical requirements, steal from LCTES paper)

 
  - hardware clearly distinguished from Arduino
    - no wiring required to do interesting things (integrated sensors and outputs, etc.)
    - device appears as USB pen drive (drag-and-drop programming)
 
  - As with Arduino, embedding device into projects is essential (from beginner to maker)
    - battery power
    - works disconnected from host
    - wearable, transportable
    - low cost
    - edge connector for easy connection to "shields"

  - support for scripting languages (JavaScript and Python; no C/C++ for beginners)
    - event-based programming model

  - web-based IDE
    - no apps or device drivers to install
    - school considerations (minimize IT admin involvement)

  - layered approach
    - simple for absolute beginners to get started
    - room for students to advance to more complex projects

- worldwide rollout
  - microbit.org, makecode.microbit.org

% from http://cacm.acm.org/system/assets/0000/6052/CACM_Author-Guidelines.pdf 

2.3.4 Contributed Articles
Contributed Articles cover the wide and abundant spectrum of the computing field—its open challenges, 
technical visions and perspectives, educational aspects, societal impact, significant applications and 
research results of high significance and broad interest. 

% we have:
% + technical vision
% + educational aspect and societal impact
% + signification application
% - research results of high significance and broad interest: see LCTES 2018 article

Topics covered must reach out to a very broad technical audience.
Articles in Communications should be aimed at the broad computing and information technology community.

A Contributed Article should set the background and provide introductory references, 

define fundamental concepts, 

compare alternate approaches, 

% Arduino
% Scratch (tethered)
% MicroPython

and explain the significance or application of a particular technology 

or result by means of well-reasoned text and pertinent graphical material. 

The use of sidebars to illustrate significant points is encouraged.

Full-length Contributed Articles should consist of up to 4,000 words, 
contain no more than 25 references, 3-4 tables, 3-4 figures, 
and be submitted to: http://cacm.acm.org/submissions.

Submissions to the Contributed Articles section should be accompanied by a cover letter indicating:
• Title and the central theme of the article; 
• Statement addressing why the material is important to the computing field and of value to the Communications reader;
• Names and email addresses of three or more recognized experts who would be considered appropriate to review the submission.


from the BBC RFP

Make it Digital is a BBC initiative to inspire a new generation to get creative with 
coding, programming and digital technology. With a major focus in 2015, Make it Digital 
will help all audiences see how Britain has helped shape the digital world, why digital 
skills matter and their growing importance to our future. For younger audiences, Make it 
Digital will help them discover the world of digital, see their creative potential in it 
and inspire them to take their first steps in computational thinking and digital skills. 

In September/October [2015], as part of the overall Make It Digital project, BBC Learning aims 
to give away one million small, programmable, wearable devices. The device can be used 
in classrooms and the home to create an engaging hands-­‐on learning experience that 
allows any level of coder from absolute beginner to advanced maker to get involved and 
be part of something exciting. Approximately 800,000 devices will go to every child in 
the UK at Year 7 (tbc) and a further 200,000 will be made available to distribute 
through competitions and other activities targeting other groups covering both children 
and adults. 

We anticipate that an online coding site will support the devices. The site will allow 
owners to create programmes to run on their own devices and/or share programmes and code 
with others. 

The BBC Learning device project (the “Project”) will be supported by the BBC Make It Digital 
promotional campaign across the BBC’s channels and services, which will run for the whole of 2015. 
The Project will also be supported by a mass engagement event towards the end of 2015, which is yet 
to be fully defined. 

The objective of the Project is to: 

Physical Computing

• Act as a starter kit for projects and ideas around physical computing, wearables and the Internet of Things; 
• Supply a device that is simple to code (providing a low barrier to entry) yet sufficiently capable 
such that it can grow with the user’s experience; 
• Inspire children to progress onto more complex projects including using the device with other devices 
and/or embedding it in other technologies and projects; 

Intro to Coding and Creativity with Computing

• Give children an exciting, engaging introduction to coding in a fun and non-­intimidating way; 
• Create a simple way for children to share code and learn from other children and experts; 
• Stimulate a creative curiosity about how technologies can solve problems and enable children to 
create their own products that realise goals they want to achieve; 
• Encourage children to explore the wider world of physical computing.









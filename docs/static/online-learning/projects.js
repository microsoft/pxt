var _targets = [
    {
        "title": "MakeCode Arcade",
        "description": "MakeCode Arcade is a retro, 1980’s style arcade video game development platform where students can quickly and easily design their own game characters and build their own games in both Blocks and JavaScript.",
        "projects": [
            {
                "title": "Chase the Pizza",
                "description": "Get started creating a simple game to chase a piece of pizza around the screen and collect as many points as possible!",
                "url": "https://arcade.makecode.com/tutorials/chase-the-pizza",
                "img": "./static/online-learning/img/chase-the-pizza.png"
            },
            {
                "title": "Lemon Leak",
                "description": "Stay away from the wild strawberries, or you’ll lose your juice!",
                "url": "https://arcade.makecode.com/tutorials/lemon-leak",
                "img": "./static/online-learning/img/lemon-leak.png"
            },
            {
                "title": "Maze",
                "description": "Learn the basics of how to create a simple maze game",
                "url": "https://arcade.makecode.com/tutorials/maze",
                "img": "./static/online-learning/img/maze.png"
            }
        ]
    },
    {
        "title": "MakeCode for Minecraft: Education Edition",
        "description": "If your school is using Office 365, your account probably already works with Minecraft: Education Edition. If your Office 365 account does not work, Minecraft: Education Edition is free through June 2020 for anyone with an Office 365 Education sign-in. Read the announcement on how to enable it.",
        "projects": [
            {
                "title": "Chicken Rain",
                "description": "Learn how to create a program that will rain chickens in Minecraft!  Tutorial available in Blocks, JavaScript or Python.",
                "url": "https://minecraft.makecode.com/tutorials/chicken-rain",
                "img": "./static/online-learning/img/chicken-rain.jpg"
            },
            {
                "title": "Flower Trail",
                "description": "Give your player magical fairy powers and lay out a trail of flowers as your player walks around in Minecraft.",
                "url": "https://minecraft.makecode.com/tutorials/flower-trail",
                "img": "./static/online-learning/img/flower-trail.png"
            },
            {
                "title": "Agent Moves",
                "description": "Learn how to programmatically control your Agent robot in Minecraft.",
                "url": "https://minecraft.makecode.com/tutorials/agent-moves",
                "img": "./static/online-learning/img/agent-moves.png"
            }
        ]
    },
    {
        "title": "MakeCode for the micro:bit",
        "description": "Engage in making and physical computing with the micro:bit – a small programmable device with lights, buttons and sensors.  Even if you do don’t have a micro:bit at home, you can use MakeCode with the simulator.",
        "projects": [
            {
                "title": "Flashing Heart",
                "description": "This is a great tutorial to start if you’re new to the micro:bit.  Learn how to activate the lights and create your own designs!",
                "url": "https://makecode.microbit.org/projects/flashing-heart",
                "img": "./static/online-learning/img/flashing-heart.png"
            },
            {
                "title": "Name Tag",
                "description": "Turn your micro:bit into an electronic name tag!",
                "url": "https://makecode.microbit.org/projects/name-tag",
                "img": "./static/online-learning/img/name-tag.png"
            },
            {
                "title": "Smiley Buttons",
                "description": "Program the buttons on the micro:bit to display different images.",
                "url": "https://makecode.microbit.org/projects/smiley-buttons",
                "img": "./static/online-learning/img/smiley-buttons.png"
            }
        ]
    }
];
var _resources = [
    {
        "title": "Assignments and Classroom Management",
        "description": "Use Microsoft Teams, Google Classroom, or Canvas to organize MakeCode lessons.",
        "url": "",
        "img": "./static/blog/teams/teams-admin.png"
    },
    {
        "title": "Free Online Curriculum",
        "description": "MakeCode provides a great amount of free, online curriculum that is available for Educators to use.",
        "url": "",
        "img": "./static/blog/remote-learning/microbit-courses.jpg"
    },
    {
        "title": "MakeCode with Flipgrid",
        "description": "Flipgrid is an easy to use video platform that can be used for students to share their MakeCode projects with their teacher and classmates.  Use some of these MakeCode Flipgrid topics for your class!",
        "url": "",
        "img": "./static/blog/remote-learning/arcade-courses.jpg"
    }
];
makeProjects();
makeResources();
function makeProjects() {
    var parent = document.getElementById("projects");
    for (var _i = 0, _targets_1 = _targets; _i < _targets_1.length; _i++) {
        var target = _targets_1[_i];
        var section = document.createElement("div");
        var header = document.createElement("h3");
        header.innerText = target.title;
        section.appendChild(header);
        var description = document.createElement("p");
        description.innerText = target.description;
        section.appendChild(description);
        section.appendChild(makeCardRow(target.projects));
        parent.appendChild(section);
    }
}
function makeResources() {
    var parent = document.getElementById("resources");
    parent.appendChild(makeCardRow(_resources, "banners", "h3"));
}
function makeCardRow(items, className, header) {
    var projects = document.createElement("div");
    projects.className = className || "cards";
    for (var _i = 0, items_1 = items; _i < items_1.length; _i++) {
        var p = items_1[_i];
        var project = document.createElement("div");
        var link = document.createElement("a");
        link.href = p.url;
        link.target = "_blank";
        var wrapper = document.createElement("div");
        wrapper.className = "imgWrapper";
        var img = document.createElement("img");
        img.src = p.img;
        wrapper.appendChild(img);
        link.appendChild(wrapper);
        var projectDescription = document.createElement("div");
        projectDescription.className = "description";
        var projectTitle = document.createElement(header || "h4");
        projectTitle.innerText = p.title;
        projectDescription.appendChild(projectTitle);
        var projectText = document.createElement("div");
        projectText.innerText = p.description;
        projectDescription.appendChild(projectText);
        link.appendChild(projectDescription);
        project.appendChild(link);
        projects.appendChild(project);
    }
    return projects;
}

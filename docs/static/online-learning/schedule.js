var Day;
(function (Day) {
    Day["Monday"] = "Monday";
    Day["Tuesday"] = "Tuesday";
    Day["Wednesday"] = "Wednesday";
    Day["Thursday"] = "Thursday";
    Day["Friday"] = "Friday";
    Day["All"] = "All";
})(Day || (Day = {}));
var lessons = [
    {
        "title": "Beginner micro:bit",
        "description": "Learn the basics of physical computing with the micro:bit!  Peli, a member of the MakeCode Team will take you through some beginner-level coding tutorials.",
        "url": "https://aka.ms/makecodemicrobitstream",
        "img": "/static/online-learning/img/microbit-stream.jpg",
        "time": 9,
        "days": [Day.All]
    },
    {
        "title": "Beginner Minecraft",
        "description": "If you have access to Minecraft: Education Edition at home, learn how to programmatically spawn mobs, control robots, and build structures! Peli, a member of the MakeCode Team will take you through some beginner-level coding tutorials.",
        "url": "https://aka.ms/makecodeminecraftstream",
        "img": "/static/online-learning/img/minecraft-stream.jpg",
        "time": 10,
        "days": [Day.All]
    },
    {
        "title": "Beginner Arcade",
        "description": "Learn the basics of game development with Peli, a member of the MakeCode Team who will take you through some beginner-level coding tutorials.",
        "url": "https://aka.ms/makecodearcadestreambeginner",
        "img": "/static/online-learning/img/arcade-2-stream.png",
        "time": 11,
        "days": [Day.All]
    },
    {
        "title": "Advanced Arcade",
        "description": "Create new games (or recreate old ones) with a rotating cast of developers from the MakeCode team, including Richard, Shannon, Daryl, and Joey",
        "url": "https://aka.ms/makecodearcadestream",
        "img": "/static/online-learning/img/arcade-stream.jpg",
        "time": 13,
        "days": [Day.All]
    },
    {
        "title": "MakeCode in the Kitchen",
        "description": "Join Jacqueline, a MakeCode team member as she crafts and codes projects with the Adafruit Circuit Playground Express in her kitchen!",
        "url": "https://aka.ms/makecodeadafruitstream",
        "img": "/static/online-learning/img/cpx-stream.png",
        "time": 14,
        "days": [Day.Friday]
    },
    {
        "title": "Arcade with Steve Isaacs",
        "description": "Learn MakeCode Arcade game development with Mr. Isaacs, an ISTE outstanding teacher and PBS Lead Digital Innovator.",
        "url": "https://aka.ms/makecodearcadestreamcommunity",
        "img": "/static/online-learning/img/arcade-2-stream.png",
        "time": 6,
        "days": [Day.Monday]
    }
];
makeLessons();
makeSchedule();
function makeSchedule() {
    var sorted = lessons.sort(function (a, b) { return a.time < b.time ? -1 : 1; });
    var parent = document.getElementById("schedule");
    parent.appendChild(makeHeader());
    for (var _i = 0, sorted_1 = sorted; _i < sorted_1.length; _i++) {
        var lesson = sorted_1[_i];
        var row = document.createElement("div");
        var time = document.createElement("div");
        time.innerText = formatTime(lesson.time);
        row.appendChild(time);
        var isAll = lesson.days.indexOf(Day.All) >= 0;
        for (var day in Day) {
            if (day != Day.All) {
                var cell = document.createElement("a");
                if (isAll || lesson.days.indexOf(Day[day]) >= 0) {
                    cell.innerText = lesson.title;
                    cell.href = lesson.url;
                    cell.target = "_blank";
                }
                row.appendChild(cell);
            }
        }
        parent.appendChild(row);
    }
}
function makeHeader() {
    var header = document.createElement("div");
    // time column
    var timeCell = document.createElement("div");
    timeCell.innerText = "Time";
    header.appendChild(timeCell);
    // days of week
    for (var day in Day) {
        if (day != Day.All) {
            var cell = document.createElement("div");
            cell.innerText = Day[day];
            header.appendChild(cell);
        }
    }
    return header;
}
function formatTime(time) {
    var EST = time + 3;
    return (time % 12 || 12) + " " + (time < 12 ? "AM" : "PM") + " PST / " + (EST % 12 || 12) + " " + (EST < 12 ? "AM" : "PM") + " EST";
}
function makeLessons() {
    var parent = document.getElementById("lessons");
    for (var _i = 0, lessons_1 = lessons; _i < lessons_1.length; _i++) {
        var l = lessons_1[_i];
        var lesson = document.createElement("div");
        lesson.className = "lesson";
        var img = document.createElement("img");
        img.src = l.img;
        var wrapper = document.createElement("a");
        wrapper.className = "imgWrapper";
        wrapper.href = l.url;
        wrapper.appendChild(img);
        lesson.appendChild(wrapper);
        var description = document.createElement("div");
        var title = document.createElement("a");
        title.href = l.url;
        var header = document.createElement("h4");
        header.innerText = l.title;
        title.appendChild(header);
        var time = document.createElement("div");
        time.innerText = formatTime(l.time);
        time.className = "time";
        var text = document.createElement("div");
        text.innerText = l.description;
        description.appendChild(title);
        description.appendChild(time);
        description.appendChild(text);
        lesson.appendChild(description);
        parent.appendChild(lesson);
    }
}

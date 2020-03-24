enum Day {
    Monday = "Monday",
    Tuesday = "Tuesday",
    Wednesday = "Wednesday",
    Thursday = "Thursday",
    Friday = "Friday",
    All = "All"
}

interface Lesson {
    title: string;
    description: string;
    url: string;
    img: string;
    time: number; // hour in PST, 24 hr clock
    days: Day[];
}

const lessons: Lesson[] = [
    {
        "title": "Beginner micro:bit",
        "description": "Learn the basics of physical computing with the micro:bit!  Peli, a member of the MakeCode Team will take you through some beginner-level coding tutorials.",
        "url": "https://mixer.com/makecode",
        "img": "/static/online-learning/img/microbit-stream.jpg",
        "time": 9,
        "days": [Day.All]
    },
    {
        "title": "Beginner Minecraft",
        "description": "If you have access to Minecraft: Education Edition at home, learn how to programmatically spawn mobs, control robots, and build structures! Peli, a member of the MakeCode Team will take you through some beginner-level coding tutorials.",
        "url": "https://mixer.com/makecode",
        "img": "/static/online-learning/img/minecraft-stream.jpg",
        "time": 10,
        "days": [Day.All]
    },
    {
        "title": "Beginner Arcade",
        "description": "Learn the basics of game development with Peli, a member of the MakeCode Team who will take you through some beginner-level coding tutorials.",
        "url": "https://mixer.com/makecode",
        "img": "/static/online-learning/img/arcade-2-stream.png",
        "time": 11,
        "days": [Day.All]
    },
    {
        "title": "Advanced Arcade",
        "description": "Create new games (or recreate old ones) with a rotating cast of developers from the MakeCode team, including Richard, Shannon, Daryl, and Joey",
        "url": "https://mixer.com/makecode",
        "img": "/static/online-learning/img/arcade-stream.jpg",
        "time": 13,
        "days": [Day.All]
    },
    {
        "title": "MakeCode in the Kitchen",
        "description": "Join Jacqueline, a MakeCode team member as she crafts and codes projects with the Adafruit Circuit Playground Express in her kitchen!",
        "url": "https://mixer.com/makecode",
        "img": "/static/online-learning/img/cpx-stream.png",
        "time": 14,
        "days": [Day.Friday]
    },
    {
        "title": "Arcade with Steve Isaacs",
        "description": "Learn MakeCode Arcade game development with Mr. Isaacs, an ISTE outstanding teacher and PBS Lead Digital Innovator.",
        "url": "https://mixer.com/makecode",
        "img": "/static/online-learning/img/arcade-2-stream.png",
        "time": 6,
        "days": [Day.Monday]
    }
]

makeLessons();
makeSchedule();

function makeSchedule() {
    const sorted = lessons.sort((a, b) => a.time < b.time ? -1 : 1);
    const parent = document.getElementById("schedule");
    parent.appendChild(makeHeader())
    for (const lesson of sorted) {
        const row = document.createElement("div");
        const time = document.createElement("div");
        time.innerText = formatTime(lesson.time);
        row.appendChild(time);

        const isAll = lesson.days.indexOf(Day.All) >= 0;
        for (const day in Day) {
            if (day != Day.All) {
                const cell = document.createElement("a");
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

function makeHeader(): HTMLElement {
    const header = document.createElement("div");
    // time column
    const timeCell = document.createElement("div");
    timeCell.innerText = "Time";
    header.appendChild(timeCell)
    // days of week
    for (const day in Day) {
        if (day != Day.All) {
            const cell = document.createElement("div");
            cell.innerText = Day[day];
            header.appendChild(cell)
        }
    }
    return header;
}

function formatTime(time: number): string {
    const EST = time + 3;
    return `${time % 12 || 12} ${time < 12 ? "AM" : "PM"} PST / ${EST % 12 || 12} ${EST < 12 ? "AM" : "PM"} EST`;
}

function makeLessons() {
    const parent = document.getElementById("lessons");
    for (const l of lessons) {
        const lesson = document.createElement("div");
        lesson.className = "lesson";

        const img = document.createElement("img");
        img.src = l.img;
        const wrapper = document.createElement("a");
        wrapper.className = "imgWrapper";
        wrapper.href = l.url;
        wrapper.appendChild(img);
        lesson.appendChild(wrapper);

        const description = document.createElement("div");
        const title = document.createElement("h4");
        title.innerText = l.title;
        const time = document.createElement("div");
        time.innerText = formatTime(l.time);
        time.className = "time";
        const text = document.createElement("div");
        text.innerText = l.description;
        description.appendChild(title);
        description.appendChild(time);
        description.appendChild(text);

        lesson.appendChild(description);
        parent.appendChild(lesson);
    }
}
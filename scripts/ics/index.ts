const ics = require('ics')
const fs = require('fs')

// copied from docs/static/online-learning/schedule.ts
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
    startDay?: number;
    days: Day[];
}

const lessons: Lesson[] = [
    {
        "title": "Beginner micro:bit",
        "description": "Learn the basics of physical computing with the micro:bit!  Peli, a member of the MakeCode Team will take you through some beginner-level coding tutorials.",
        "url": "https://aka.ms/makecodemicrobitstream",
        "img": "/static/online-learning/img/microbit-stream.png",
        "time": 9,
        "startDay": 25,
        "days": [Day.All]
    },
    {
        "title": "Beginner Minecraft",
        "description": "If you have access to Minecraft: Education Edition at home, learn how to programmatically spawn mobs, control robots, and build structures! Peli, a member of the MakeCode Team will take you through some beginner-level coding tutorials.",
        "url": "https://aka.ms/makecodeminecraftstream",
        "img": "/static/online-learning/img/minecraft-stream.png",
        "time": 10,
        "startDay": 25,
        "days": [Day.All]
    },
    {
        "title": "Beginner Arcade",
        "description": "Learn the basics of game development with Peli, a member of the MakeCode Team who will take you through some beginner-level coding tutorials.",
        "url": "https://aka.ms/makecodearcadestreambeginner",
        "img": "/static/online-learning/img/arcade-2-stream.png",
        "time": 11,
        "startDay": 25,
        "days": [Day.All]
    },
    {
        "title": "Digital All-Stars",
        "description": "Join your favorite all-star athletes as they use MakeCode Arcade to code games with you at home!",
        "url": "https://aka.ms/makecodeDASstream",
        "img": "/static/online-learning/img/all-stars.png",
        "time": 12,
        "startDay": 2,
        "days": [Day.Thursday]
    },
    {
        "title": "Advanced Arcade",
        "description": "Create new games (or recreate old ones) with a rotating cast of developers from the MakeCode team, including Richard, Shannon, Daryl, and Joey",
        "url": "https://aka.ms/makecodearcadestream",
        "img": "/static/online-learning/img/arcade-stream.png",
        "time": 13,
        "startDay": 25,
        "days": [Day.All]
    },
    {
        "title": "MakeCode in the Kitchen",
        "description": "Join Jacqueline, a MakeCode team member as she crafts and codes projects with the Adafruit Circuit Playground Express in her kitchen!",
        "url": "https://aka.ms/makecodecpxstream",
        "img": "/static/online-learning/img/cpx-stream.png",
        "time": 14,
        "startDay": 27,
        "days": [Day.Friday]
    },
    {
        "title": "MakeCode Live with Adafruit's John Park",
        "description": "Join Adafruit’s John Park as he builds a MakeCode project each week covering fundamental concepts and techniques using real-world projects in his studio.",
        "url": "https://aka.ms/makecodejpstream",
        "img": "/static/online-learning/img/john-park-live.png",
        "time": 15,
        "startDay": 21,
        "days": [Day.Tuesday]
    },
    {
        "title": "MAKE'ayla with Mikayla Buford",
        "description": "Join Mikayla Buford as she builds MakeCode project each week!",
        "url": "https://www.youtube.com/playlist?list=PLMMBk9hE-Seoq3GYYmHH93FE_-yhw1C1P",
        "img": "/static/online-learning/img/maykala.png",
        "time": 12,
        "startDay": 1,
        "days": [Day.Friday]
    },
    {
        "title": "DreamSpace HomeSpace",
        "description": "Join Microsoft Ireland in their HomeSpace tutorial series on your favourite MakeCode platforms: micro:bit, Arcade and Minecraft.",
        "url": "https://aka.ms/dshomespace",
        "img": "/static/online-learning/img/dreamspace-homespace.png",
        "time": 6,
        "startDay": 30,
        "days": [Day.Monday, Day.Wednesday, Day.Friday]
    }
]

// end schedule.ts

function gen() {
    lessons.forEach(lesson => {
        const calevent = {
            start: [2020, 3, lesson.startDay || 28, lesson.time, 0],
            duration: { minutes: 30 },
            title: lesson.title,
            description: lesson.description,
            url: /^https:\/\/aka.ms\/makecode/.test(lesson.url)
                ? "https://mixer.com/MakeCode" : lesson.url,
            status: 'CONFIRMED',
            busyStatus: 'BUSY',
            productId: "Microsoft MakeCode",
            recurrenceRule: lesson.days[0] == Day.All
                ? "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;INTERVAL=1"
                : `FREQ=WEEKLY;BYDAY=${lesson.days.map(d => d.slice(0, 2).toUpperCase()).join(',')};INTERVAL=1`
        }

        ics.createEvent(calevent, (error, value) => {
            if (error) {
                console.log(error)
                return
            }

            console.log(value)
            const fn = lesson.title.replace(/[^a-z0-9]+/ig, '').toLowerCase()
            fs.writeFileSync(`${__dirname}/../../docs/static/online-learning/${fn}.ics`, value)
        })
    })
}
gen();
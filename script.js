let isLoaded = false;

const yearInput = document.querySelector("#yearInput");
const sem1Input = document.querySelector("#sem1");
const sem2Input = document.querySelector("#sem2");
const whichSem = () => sem1Input.checked ? 1 : (sem2Input.checked ? 2 : null);
const classInput = document.querySelector("#classInput");

const getFetchUrl = ({day, year, sem}) => `https://cdn.jsdelivr.net/gh/gohjy/nush-timetable-data@main/v3/dist/${year}s${sem}/day/${day}.subject.json`;

const getData = async (url) => {
    let data = await fetch(url).catch((e) => {
        throw e;
    });
    let dataJson = await data.json().catch((e) => {
        throw e;
    });

    if (dataJson) return dataJson;
    else throw new Error("getData went wrong");
}

const data = [];
const metadata = {
    "year": null,
    "sem": null
}

const putData = async (year, sem) => {
    metadata.year = year;
    metadata.sem = sem;

    data.splice(0, data.length);

    const promiseArray = [];

    for (let day=1; day<=5; day++) {
        const fetchUrl = getFetchUrl({ day, year, sem });
        promiseArray.push(getData(fetchUrl));
    }

    const promiseResults = await Promise.allSettled(promiseArray);

    for (let { status, value, reason } of promiseResults) {
        if (status === "rejected") {
            // something went wrong!
            console.error(reason);
            data.push(null);
        } else {
            data.push(value);
        }
    }
}

const remap = {
    "INTHUM": "Hum",
    "RC": "Recess",
    "LUN": "Lunch",
    "FREE": " ",
    "PHYS": "Phy",
    "BIO": "Bio",
    "CHEM": "Chem",
    "MEN": "Mentr",
    "HON": "Honours",
    "THIRDLANG": "3rd Lang",
    "ART": "Art",
    "MU": "Music",
    "ELEC": "Elective",
    "ELC": "Elective"
}

const config = {
    "ELEC": {
        maxlength: 3
    },
    "FREE": {
        maxlength: 1
    },
    "": {
        maxlength: 1
    }
}

const gridBoxes = [];
const contentBox = document.querySelector("#main-table-content");

for (let i=0; i<5; i++) {
    let row = contentBox.children[i];
    let boxesRow = [];
    for (let j=1; j<=20; j++) {
        boxesRow.push(row.children[j]);
    }
    gridBoxes.push(boxesRow);
}

async function loadTimetable(classId, year, sem) {
    for (let i=0; i<5; i++) {
        if (data[i] === null) {
            const firstCell = gridBoxes[i][0];
            firstCell.textContent = "Could not load data for this day.";
            firstCell.setAttribute("colspan", gridBoxes[i].length);
            for (let cell of gridBoxes[i].slice(1)) {
                cell.classList.add("invisible");
            }
            continue;
        }

        const row = gridBoxes[i];
        const rowData = data[i]?.data?.find(x => x.class === classId);
        if (!rowData) {
            alert("Sorry, could not load table.");
            return;
        }
        
        for (let subject of rowData.subjects) {
            let j = subject.start.oneIndex - 1;

            const names = subject.lessons?.map(
                  x => remap[x.subject] || x.subject || "?"
                ) ?? ["?"];
                const value = Array.from(new Set(names)).join("/");
            // I am not sure about this like i used weird cpp stuff but i can compile yay.
            //cuz you see the original one set to "" which MIGHT look like the FREE blcok.
            row[j].textContent = value;

            const duration = subject.duration ?? 1;

            row[j].classList.remove("invisible");
            row[j].setAttribute("colspan", duration);

            for (let i=1; (i<duration) && (i<row.length); i++) {
                row[j + i].classList.add("invisible");
            }
        }
    }

    let displayText = `${classId}, ${year} Sem ${sem}`;
    if (devMode) displayText += " (Dev mode enabled)";

    document.querySelector("#class").textContent = displayText;
    isLoaded = true;
}

const evHandler = async () => {
    let classNum = +classInput.value;
    if (!classNum || classNum % 1 !== 0 || classNum % 100 > 7 || (classNum % 100 > 6 && classNum < 301) || classNum % 100 === 0 || classNum > 607 || classNum < 101) {
        alert("Invalid class!");
        if (!isLoaded) {
            const searchParams = new URL(location.href).searchParams;
            searchParams.delete("class");
            location.search = searchParams;
        }
        return;
    };

    try {
        const sem = whichSem();
        const year = +yearInput.value;
        if (!devMode) await putData(year, sem);
        await loadTimetable(classNum, year, sem); 
    } catch {}
}

document.querySelector("#mainform").addEventListener("submit", (ev) => {
    ev.preventDefault();
    evHandler();
});

/* *** DEVMODE *** */
let devMode = false;
document.querySelector("#devmode-control").addEventListener("change", (ev) => {
    devMode = ev.currentTarget.checked;
    document.querySelector(".devmode").classList.toggle("enabled", devMode);
});
(() => {
    const devmodeFileInput = document.querySelector("#devmode-file-input");
    const devmodeFileInputBtn = document.querySelector("#devmode-file-input-submit");
    devmodeFileInputBtn.addEventListener("click", async () => {
        const file = devmodeFileInput.files[0];
        if (!file) {
            alert("No file provided!");
            return;
        }
        const contents = await (async () => {
            const filetext = await file.text();
            const json = JSON.parse(filetext);
            if (
                !Array.isArray(json)
                || (json.length !== 5)
                || !json.every(item => item && (typeof item === "object"))
            ) throw new Error("Expected array of 5 objects");
            return json;
        })().catch(err => {
            alert(`Error: ${err}`);
            return null;
        });
        if (!contents) return;
        
        data.splice(0, data.length);
        data.push(...contents);

        alert("Successfully loaded data! Use Load Timetable button to show!");
    })
})();
/* *** END DEVMODE *** */


const urlObj = new URL(location.href).searchParams;

const starter = +urlObj.get("class");
if (starter) {
    document.querySelector("#classInput").value = starter;
    yearInput.value = +urlObj.get("year") || new Date().getFullYear();
    if (urlObj.get("sem")) {
        if (+urlObj.get("sem") === 1) sem1Input.checked = true;
        else if (+urlObj.get("sem") === 2) sem2Input.checked = true;
        else if (Math.floor((new Date().getMonth()+5)/6) > 1) {
            sem2Input.checked = true;
        } else {
            sem1Input.checked = true;
        }
    } else if (Math.floor((new Date().getMonth()+5)/6) > 1) {
        sem2Input.checked = true;
    } else {
        sem1Input.checked = true;
    }
    
    document.querySelector("#goBtn").click();
}

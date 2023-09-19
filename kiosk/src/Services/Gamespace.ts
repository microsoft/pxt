let siteElements: ChildNode[] = [];

function addElements() {
    const gamespace = document.getElementsByTagName("BODY")[0];
    while (gamespace.firstChild) {
        gamespace.firstChild.remove();
    }
    siteElements.forEach(item => gamespace.appendChild(item));
}

function removeElements() {
    siteElements = [];
    const gamespace = document.getElementsByTagName("BODY")[0];
    while (gamespace.firstChild) {
        siteElements.push(gamespace.firstChild);
        gamespace.firstChild.remove();
    }
}

function append(node: ChildNode) {
    const gamespace = document.getElementsByTagName("BODY")[0];
    gamespace.appendChild(node);
}

export { addElements, removeElements, append };

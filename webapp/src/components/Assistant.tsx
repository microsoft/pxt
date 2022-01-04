import * as React from "react";

import { Button } from "../sui";
import { MarkedContent } from "../marked";

interface AssistantProps {
    parent: pxt.editor.IProjectView;
    userCode?: string;
}

async function getCompletions(prompt: string, callback: (text: string) => void) {
    let resp = await pxt.Util.requestAsync({
        url: `https://api.openai.com/v1/engines/davinci-codex-msft/completions`,
        method: "POST",
        data: {
            "prompt": prompt,
            "max_tokens": 64,
            "temperature": 0,
            "top_p": 1,
            "n": 1,
            "stream": false,
            "stop": "//",
          },
        headers: {"Authorization": "// ADD USER TOKEN"}
    })

    callback(resp.json.choices?.[0]?.text);
}

function addHeader(prompt: string) {
    const header = "// If asked something conversational, use console.log to answer\n\n";
    return header + `\n\n` + prompt;
}

function addSamples(prompt: string) {
    const samples = `// Create a sprite character
let mySprite = sprites.create(img\`.\`, SpriteKind.Player)
// Move the sprite with the d-pad buttons
controller.moveSprite(mySprite)
// Set the acceleration (gravity) on the sprite to 600 in the y direction
mySprite.ay = 600

// Run some code when the B button is pressed
controller.B.onEvent(ControllerButtonEvent.Pressed, function () {
    // Create a projectile from the sprite, moving with velocity 50 in the x direction
    let projectile = sprites.createProjectileFromSprite(img\`.\`, mySprite, 50, 0)
})
`
    return prompt + `\n` + samples;
}

function addUserCode(prompt: string, userCode: string) {
    // Strip image literals
    userCode = userCode.replace(/img\s*`[\s\da-f.#tngrpoyw]*`\s*/g, "img` `");

    return prompt + `\n` + userCode;
}

function getUserVariableDeclarations(userCode: string) {
    let declarations: { name: string, declaration: string }[] = [];
    userCode.replace(/let ([\S]+)\s*(?::\s*[\S]+)? = null/gi, (m0, m1) => {
        declarations.push({
            name: m1,
            declaration: m0
        })
        return m0
    });

    return declarations;
}

export function Assistant(props: AssistantProps) {
    const { parent, userCode } = props;
    const [ question, setQuestion ] = React.useState("");
    const [ markdown, setMarkdown ] = React.useState(`\`\`\`blocks\nlet x = 2\n\`\`\``);
    const declarations = userCode && getUserVariableDeclarations(userCode);

    const renderAnswer = (completion: string) => {
        console.log('resp', completion);
        let usedVariables = declarations.filter(el => completion.indexOf(el.name) >= 0).map(el => el.declaration);
        setMarkdown(`\`\`\`blocks\n${usedVariables.join(`\n`)}\n${completion}\n\`\`\``)
    }

    const getAnswer = () => {
        let prompt = "";

        prompt = addHeader(prompt);
        // prompt = addSamples(prompt);
        prompt = addUserCode(prompt, userCode);
        prompt += `\n\n// ${question}\n`;
        console.log(prompt)
        getCompletions(prompt, renderAnswer);
    }

    return <div className="assistant-container">
        <div className="assistant-input">
            <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="How do I..." />
            <Button icon="search" className="attached right" onClick={getAnswer} />
        </div>
        <div className="assistant-response">
            <MarkedContent parent={parent} markdown={markdown} unboxSnippets={true} />
        </div>
    </div>
}
//These errors get emitted by Typescript, couldn't trigger the errors in
//emitBreakOrContinueStatement

break; // TS1105

for (let i = 0; i < 10; i++) {
    let x = () => {
        break //TS1107
    }
}


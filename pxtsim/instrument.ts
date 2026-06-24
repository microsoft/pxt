namespace pxsim {

// this code is used to instrument functions that are exposed to the user from 
// a target and/or extension. Functions live in namespaces and come in two forms
// - a shim that has both C++ and JavaScript counterparts, where the JavaScript is
//   present in pxsim namespace of the target. An example is basic.showString, which
//   shows up in the JavaScript as pxsim.basic.showString("foo", 150). That is, the
//   JavaScript namespace syntax is preserved.
/*
    window.addEventListener("message", ev => {
        let m = ev.data;
        if (!m) {
            return;
        }
*/

type UnknownFunction = (...args: any[]) => any;
type NamespaceObject = Record<string, any>;

/**
 * Dynamically resolves a string path to an object on the global scope.
 */
function getNamespaceObject(pathString: string): NamespaceObject | undefined {
  const parts = pathString.split('.');

  // Use globalThis cast as any to safely traverse unknown properties
  let currentContext: any = globalThis;

  for (const part of parts) {
    if (currentContext && part in currentContext) {
      currentContext = currentContext[part];
    } else {
      return undefined;
    }
  }

  return currentContext as NamespaceObject;
}

/**
 * Instruments specified functions inside a string-resolved namespace.
 */
export function instrumentNamespaceByPath(
  pathString: string,
  functionList: string[]
): void {
  const namespaceObj = getNamespaceObject(pathString);

  if (!namespaceObj) {
    console.error(`Namespace path "${pathString}" could not be found.`);
    return;
  }

  functionList.forEach((funcName: string) => {
    const originalFunc = namespaceObj[funcName];

    if (typeof originalFunc === 'function') {
      // Cast to UnknownFunction to safely intercept arguments and maintain context
      const typedOriginalFunc = originalFunc as UnknownFunction;

      namespaceObj[funcName] = function (this: unknown, ...args: unknown[]): unknown {

        // Structure the strongly-typed message payload
        const messagePayload = {
          type: 'output' as const,
          namespace: pathString,
          function: funcName,
          args
        } as pxsim.SimulatorOutput;

        // Broadcast global message if window is available (browser environment)
        if (typeof window !== 'undefined') {
          window.postMessage(messagePayload, '*');
        } else {
          // Fallback log for non-browser environments (Node.js)
          console.log('[Instrumentation Trace]', messagePayload);
        }

        // Execute original logic keeping context and arguments intact
        return typedOriginalFunc.apply(this, args);
      };

      console.log(`Instrumented: ${pathString}.${funcName}`);
    }
  });
}


}
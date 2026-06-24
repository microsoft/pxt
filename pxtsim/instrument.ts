namespace pxsim {

// this code is used to instrument functions that are exposed to the user from 
// a target and/or extension. Functions live in namespaces and come in two forms
// - a shim that has both C++ and JavaScript counterparts, where the JavaScript is
//   present in pxsim namespace of the target. An example is basic.showString, which
//   shows up in the JavaScript as pxsim.basic.showString("foo", 150). That is, the
//   JavaScript namespace syntax is preserved.

type UnknownFunction = (...args: any[]) => any;
type NamespaceObject = Record<string, any>;

/**
 * Dynamically resolves a string path to an object on the global scope.
 */
function getNamespaceObject(module: NamespaceObject, pathString: string): [NamespaceObject | undefined, UnknownFunction | undefined] {
  const parts = pathString.split('.');

  let currentContext = module

  let i = 0;
  const funIndex = parts.length - 1;
  for (const part of parts) {
    if (i === funIndex) {
      break;
    }
    if (currentContext && part in currentContext) {
      currentContext = currentContext[part];
      i = i + 1;
    } else {
      return [undefined, undefined]
    }
  }

  return [currentContext as NamespaceObject, currentContext[parts[funIndex]] as UnknownFunction];
}

/**
 * Instruments specified functions inside a string-resolved namespace.
 */
export function instrumentFunctions(functionList: string[]): void {
  const pxsimModule = window['pxsim'] as NamespaceObject;
  functionList.forEach((funcName: string) => {

    const [funModule, originalFunc] = getNamespaceObject(pxsimModule, funcName);

    if (funModule && originalFunc && typeof originalFunc === 'function') {
      // Cast to UnknownFunction to safely intercept arguments and maintain context
      const typedOriginalFunc = originalFunc as UnknownFunction;

      funModule[funcName] = function (this: unknown, ...args: unknown[]): unknown {

        // Structure the strongly-typed message payload
        const messagePayload = {
          type: 'output' as const,
          function: funcName,
          args
        } as pxsim.SimulatorOutput;

        Runtime.postMessage(messagePayload);

        // Execute original logic keeping context and arguments intact
        return typedOriginalFunc.apply(this, args);
      };

      console.log(`Instrumented: ${funcName}`);
    }
  });
}


}
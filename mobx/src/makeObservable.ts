import { Computed, IGettable, Observable, tx } from "onek";

const GET_CONTEXT = {};
const NOTIFY_CONTEXT = {};

let getterContext: typeof GET_CONTEXT | typeof NOTIFY_CONTEXT | null = null;
let getterResult: IGettable<any> | undefined = undefined;

export function from<T>(fn: () => T): IGettable<T> | undefined {
    getterContext = GET_CONTEXT;
    try {
        fn();
        return getterResult;
    } finally {
        getterContext = null;
        getterResult = undefined;
    }
}

export function notify(thunk: () => any): void {
    getterContext = NOTIFY_CONTEXT;
    tx(() => {
        try {
            thunk();
        } finally {
            getterContext = null;
        }
    });
}

export function makeObservable<T extends {}>(obj: T): T {
    const descriptors: (PropertyDescriptor & { key: string })[] = [];

    Object.keys(obj).forEach((key) => {
        const currentDescriptor = Object.getOwnPropertyDescriptor(obj, key);

        if (
            currentDescriptor &&
            currentDescriptor.configurable &&
            currentDescriptor.value !== undefined
        ) {
            const prop = currentDescriptor.value;

            if (prop instanceof Observable) {
                descriptors.push({
                    key: key,
                    enumerable: true,
                    configurable: true,
                    get() {
                        if (!getterContext) {
                            return prop.get();
                        } else if (getterContext === GET_CONTEXT) {
                            getterResult = prop;
                        } else if (getterContext === NOTIFY_CONTEXT) {
                            prop.notify();
                        }
                    },
                    set(value: any) {
                        prop.set(value);
                    },
                });
            } else if (prop instanceof Computed) {
                descriptors.push({
                    key: key,
                    enumerable: true,
                    configurable: true,
                    get() {
                        if (!getterContext) {
                            return prop.get();
                        } else if (getterContext === GET_CONTEXT) {
                            getterResult = prop;
                        }
                    },
                });
            }
        }
    });

    descriptors.forEach((descriptor) => {
        Object.defineProperty(obj, descriptor.key, descriptor);
    });

    return obj;
}
